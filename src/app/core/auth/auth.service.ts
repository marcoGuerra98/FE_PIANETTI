import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api';
import { TokenResponse } from '../models';

/** Chiave di localStorage in cui è salvata la sessione. */
const STORAGE_KEY = 'pianetti.auth';

/** Sessione persistita in localStorage. */
interface StoredSession {
  token: string;
  username: string;
  /** scadenza in ms epoch, letta dal claim `exp` del JWT */
  expiresAt: number;
}

/**
 * Legge il claim `exp` dal payload del JWT (base64url) senza verificarne la firma,
 * che resta compito del backend.
 * @returns scadenza in ms epoch, oppure `null` se il token non è decodificabile
 */
function readExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Sessione dell'amministratore.
 * Il JWT è salvato in localStorage e ripristinato all'avvio se non scaduto; allo scadere
 * del claim `exp` un timer esegue il logout automatico. Lo stato è esposto tramite signal,
 * così header e pulsanti admin si aggiornano da soli.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private session = signal<StoredSession | null>(this.load());
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  /** true se c'è una sessione valida: governa guard e visibilità delle azioni admin */
  readonly isAdmin = computed(() => this.session() !== null);
  /** username dell'amministratore loggato, mostrato nell'header */
  readonly username = computed(() => this.session()?.username ?? null);

  constructor() {
    // la sessione ripristinata da localStorage ha già una scadenza da programmare
    this.scheduleExpiry();
  }

  /** Token JWT corrente, letto dall'interceptor. */
  get token(): string | null {
    return this.session()?.token ?? null;
  }

  /** Esegue il login (`POST /auth/login`) e, in caso di successo, salva la sessione. */
  login(username: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_URL}/auth/login`, { username, password })
      .pipe(tap((res) => this.store(res)));
  }

  /**
   * Cambia la password (`POST /auth/change-password`). Il backend invalida i token
   * precedenti e ne restituisce uno nuovo, che sostituisce quello in sessione.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_URL}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .pipe(tap((res) => this.store(res)));
  }

  /** Esegue il logout; con `returnUrl` porta alla pagina di login. */
  logout(options: { redirectToLogin?: boolean; returnUrl?: string } = {}): void {
    this.session.set(null);
    clearTimeout(this.expiryTimer);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage non disponibile */
    }
    if (options.redirectToLogin) {
      this.router.navigate(['/login'], {
        queryParams: options.returnUrl ? { returnUrl: options.returnUrl } : {},
      });
    }
  }

  /**
   * Salva la sessione in memoria e in localStorage.
   * La scadenza viene dal claim `exp`; `expires_in` è solo un ripiego.
   */
  private store(res: TokenResponse): void {
    const expiresAt = readExp(res.access_token) ?? Date.now() + res.expires_in * 1000;
    const session: StoredSession = { token: res.access_token, username: res.username, expiresAt };
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* storage non disponibile: la sessione resta solo in memoria */
    }
    this.scheduleExpiry();
  }

  /** Ripristina la sessione salvata, scartandola se scaduta o malformata. */
  private load(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as StoredSession;
      return s.token && s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  }

  /** Logout automatico allo scadere del token. */
  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const s = this.session();
    if (!s) return;
    const ms = s.expiresAt - Date.now();
    // setTimeout accetta al massimo ~24,8 giorni (2^31 - 1 ms): oltre quella soglia non si
    // programma nulla, e la scadenza verrà comunque intercettata al prossimo avvio o da un 401
    if (ms < 2_000_000_000) {
      this.expiryTimer = setTimeout(() => this.logout(), Math.max(ms, 0));
    }
  }
}
