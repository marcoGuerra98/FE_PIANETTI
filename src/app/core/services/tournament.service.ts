import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api';
import { TournamentResetResult } from '../models';

/** Operazioni sull'intero torneo (`/tournament`). */
@Injectable({ providedIn: 'root' })
export class TournamentService {
  private http = inject(HttpClient);

  /**
   * Fine torneo (admin): elimina calendario e risultati, svincola tutti i giocatori
   * e azzera i goal; le squadre restano. Richiede di nuovo la password dell'amministratore:
   * se errata risponde 403 (non 401, quindi nessun logout automatico), 429 dopo troppi tentativi.
   */
  reset(password: string): Observable<TournamentResetResult> {
    return this.http.post<TournamentResetResult>(`${API_URL}/tournament/reset`, { password });
  }
}
