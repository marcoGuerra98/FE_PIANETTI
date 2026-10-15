import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../api';
import { NotifyService } from '../services/notify.service';
import { AuthService } from './auth.service';

/**
 * Aggiunge il token JWT alle chiamate verso il backend.
 * Su 401 (token mancante, scaduto o revocato) esegue il logout e porta al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotifyService);

  // il token va solo al nostro backend, mai a domini terzi (es. Google Fonts)
  const isApi = req.url.startsWith(API_URL);
  // il login non riceve il Bearer e un suo 401 significa "credenziali errate", gestito dalla pagina
  const isLogin = req.url === `${API_URL}/auth/login`;
  const token = auth.token;

  const authReq =
    isApi && token && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && isApi && !isLogin) {
        // Da letto prima del logout: distingue la sessione scaduta/revocata (es. password
        // cambiata da un'altra sessione) dall'utente anonimo che tenta un'azione protetta.
        const wasLogged = auth.isAdmin();
        auth.logout({ redirectToLogin: true, returnUrl: router.url });
        notify.error(wasLogged ? 'Sessione scaduta: effettua di nuovo il login' : 'Effettua il login per continuare');
      }
      // l'errore si propaga comunque, così il chiamante può chiudere gli stati di caricamento
      return throwError(() => err);
    }),
  );
};
