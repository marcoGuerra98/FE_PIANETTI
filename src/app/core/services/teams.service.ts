import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api';
import { Team, TeamDeleteResult, TeamDetail, TeamInput } from '../models';

/** Accesso alle API delle squadre (`/teams`). */
@Injectable({ providedIn: 'root' })
export class TeamsService {
  private http = inject(HttpClient);
  private base = `${API_URL}/teams`;

  /** Elenco squadre. */
  list(): Observable<Team[]> {
    return this.http.get<Team[]>(this.base);
  }

  /** Dettaglio squadra con la rosa. */
  get(id: string): Observable<TeamDetail> {
    return this.http.get<TeamDetail>(`${this.base}/${id}`);
  }

  /** Crea una squadra (admin); il nome deve essere univoco. */
  create(data: TeamInput): Observable<Team> {
    return this.http.post<Team>(this.base, data);
  }

  /** Rinomina una squadra (admin). */
  update(id: string, data: TeamInput): Observable<Team> {
    return this.http.put<Team>(`${this.base}/${id}`, data);
  }

  /** Senza `force` risponde 409 se la squadra ha partite già giocate. */
  delete(id: string, force = false): Observable<TeamDeleteResult> {
    const params = new HttpParams().set('force', force);
    return this.http.delete<TeamDeleteResult>(`${this.base}/${id}`, { params });
  }

  /** Carica lo stemma come multipart (`file`). */
  uploadLogo(id: string, file: File): Observable<Team> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Team>(`${this.base}/${id}/logo`, form);
  }

  /** Rimuove lo stemma. */
  deleteLogo(id: string): Observable<Team> {
    return this.http.delete<Team>(`${this.base}/${id}/logo`);
  }
}
