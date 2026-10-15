import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, EMPTY, filter, Observable, switchMap, throwError } from 'rxjs';
import { Team, TeamDeleteResult } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { TeamsService } from '../../core/services/teams.service';
import { ConfirmService } from '../../shared/confirm-dialog';
import { plural } from '../../shared/plural';

/** Campo `details` della risposta 409: le partite giocate che andrebbero perse. */
interface PlayedConflict {
  partite_giocate: { giornata: number; descrizione: string }[];
}

/**
 * Eliminazione squadra in due passi:
 * 1. conferma generica (i giocatori verranno svincolati, le partite non giocate rimosse);
 * 2. se il backend risponde 409 (partite già giocate) seconda conferma esplicita con force=true.
 */
@Injectable({ providedIn: 'root' })
export class TeamDeleteFlow {
  private api = inject(TeamsService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);

  /**
   * Avvia il flusso di eliminazione.
   * L'Observable emette solo se la squadra viene eliminata; se l'utente annulla completa
   * senza emettere, e gli errori sono già notificati con un toast (non arrivano al chiamante).
   * @param playersCount numero di giocatori in rosa, per un messaggio più preciso
   */
  run(team: Team, playersCount?: number): Observable<TeamDeleteResult> {
    const who =
      playersCount === undefined
        ? 'Tutti i giocatori della squadra verranno svincolati'
        : playersCount === 0
          ? 'La squadra non ha giocatori in rosa'
          : `${playersCount === 1 ? 'Il giocatore' : `I ${playersCount} giocatori`} della rosa ${playersCount === 1 ? 'verrà svincolato' : 'verranno svincolati'}`;

    return this.confirm
      .ask({
        title: `Elimina ${team.nome}`,
        message: `${who} e le partite non ancora giocate della squadra verranno rimosse dal calendario. Continuare?`,
        confirmText: 'Elimina',
        danger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.delete(team.id)),
        catchError((err: unknown) => {
          // 409: la squadra ha partite già giocate, elencate in `details`
          if (err instanceof HttpErrorResponse && err.status === 409) {
            const details = (err.error?.details ?? {}) as PlayedConflict;
            return this.confirm
              .ask({
                title: 'La squadra ha già giocato',
                message: `${err.error?.detail ?? ''} Le partite seguenti verranno eliminate:`,
                items: (details.partite_giocate ?? []).map((m) => `G${m.giornata} · ${m.descrizione}`),
                confirmText: 'Elimina comunque',
                danger: true,
              })
              .pipe(
                filter(Boolean),
                switchMap(() => this.api.delete(team.id, true)),
              );
          }
          return throwError(() => err);
        }),
        // qualsiasi altro errore (anche del secondo tentativo con force) finisce in un toast
        catchError((err) => {
          this.notify.apiError(err, 'Eliminazione non riuscita');
          return EMPTY;
        }),
      );
  }

  /** Messaggio riepilogativo per il toast di successo. */
  describe(res: TeamDeleteResult): string {
    const parts = ['Squadra eliminata'];
    if (res.giocatori_svincolati) {
      parts.push(plural(res.giocatori_svincolati, 'giocatore svincolato', 'giocatori svincolati'));
    }
    if (res.partite_rimosse) parts.push(plural(res.partite_rimosse, 'partita rimossa', 'partite rimosse'));
    return parts.join(' · ');
  }
}
