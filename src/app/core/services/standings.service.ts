import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api';
import { ScorerRow, StandingRow } from '../models';

/** Accesso alle classifiche calcolate dal backend (`/standings`). */
@Injectable({ providedIn: 'root' })
export class StandingsService {
  private http = inject(HttpClient);

  /** Classifica del girone, già ordinata. */
  standings(): Observable<StandingRow[]> {
    return this.http.get<StandingRow[]>(`${API_URL}/standings`);
  }

  /** Classifica marcatori, già ordinata. */
  scorers(): Observable<ScorerRow[]> {
    return this.http.get<ScorerRow[]>(`${API_URL}/standings/scorers`);
  }
}
