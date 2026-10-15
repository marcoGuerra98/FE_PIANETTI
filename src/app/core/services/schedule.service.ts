import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api';
import { Match, MatchUpdate, ResultInput, Schedule } from '../models';

/** Accesso alle API di calendario (`/schedule`) e partite (`/matches`). */
@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);

  /** Calendario completo, raggruppato per giornata. */
  get(): Observable<Schedule> {
    return this.http.get<Schedule>(`${API_URL}/schedule`);
  }

  /** Senza `confirm` risponde 409 se esiste già un calendario. */
  generate(confirm = false): Observable<Schedule> {
    const params = new HttpParams().set('confirm', confirm);
    return this.http.post<Schedule>(`${API_URL}/schedule/generate`, null, { params });
  }

  /** Elimina il calendario. Senza `confirm` risponde 409 se ci sono partite. */
  delete(confirm = false): Observable<void> {
    const params = new HttpParams().set('confirm', confirm);
    return this.http.delete<void>(`${API_URL}/schedule`, { params });
  }

  /** Modifica parziale di una partita (data/ora, squadre, giornata). */
  updateMatch(id: string, data: MatchUpdate): Observable<Match> {
    return this.http.patch<Match>(`${API_URL}/matches/${id}`, data);
  }

  /** Inserisce o sostituisce il risultato con i marcatori. */
  setResult(id: string, data: ResultInput): Observable<Match> {
    return this.http.put<Match>(`${API_URL}/matches/${id}/result`, data);
  }

  /** Annulla il risultato: la partita torna "da giocare" e i goal vengono stornati. */
  clearResult(id: string): Observable<Match> {
    return this.http.delete<Match>(`${API_URL}/matches/${id}/result`);
  }
}
