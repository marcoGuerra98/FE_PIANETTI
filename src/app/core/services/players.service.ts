import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api';
import { Player, PlayerFilters, PlayerInput } from '../models';

/** Accesso alle API dei giocatori (`/players`). */
@Injectable({ providedIn: 'root' })
export class PlayersService {
  private http = inject(HttpClient);
  private base = `${API_URL}/players`;

  /**
   * Elenco giocatori filtrato e ordinato lato server.
   * I filtri vuoti (`null`, `undefined`, stringa vuota, `false`) non vengono inviati.
   */
  list(filters: PlayerFilters = {}): Observable<Player[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '' && value !== false) {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Player[]>(this.base, { params });
  }

  /** Dettaglio di un giocatore. */
  get(id: string): Observable<Player> {
    return this.http.get<Player>(`${this.base}/${id}`);
  }

  /** Crea un giocatore (admin). */
  create(data: PlayerInput): Observable<Player> {
    return this.http.post<Player>(this.base, data);
  }

  /** Aggiorna un giocatore (admin). */
  update(id: string, data: PlayerInput): Observable<Player> {
    return this.http.put<Player>(`${this.base}/${id}`, data);
  }

  /** Elimina un giocatore (admin). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Carica la foto come multipart (`file`); restituisce il giocatore aggiornato. */
  uploadPhoto(id: string, file: File): Observable<Player> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Player>(`${this.base}/${id}/photo`, form);
  }

  /** Rimuove la foto del giocatore. */
  deletePhoto(id: string): Observable<Player> {
    return this.http.delete<Player>(`${this.base}/${id}/photo`);
  }
}
