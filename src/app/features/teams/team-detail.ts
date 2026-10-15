import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, forkJoin, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { Player, RUOLI, Ruolo, StandingRow, TeamDetail } from '../../core/models';
import { PlayersService } from '../../core/services/players.service';
import { ConfirmService } from '../../shared/confirm-dialog';
import { NotifyService } from '../../core/services/notify.service';
import { StandingsService } from '../../core/services/standings.service';
import { TeamsService } from '../../core/services/teams.service';
import { PlayerCard } from '../../shared/player-card';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';
import { TeamDeleteFlow } from './team-delete';

/** Titoli delle sezioni della rosa. */
const PLURAL: Record<Ruolo, string> = {
  POR: 'Portieri',
  DIF: 'Difensori',
  CEN: 'Centrocampisti',
  ATT: 'Attaccanti',
};

/** Dettaglio squadra (/teams/:id): intestazione, statistiche di classifica e rosa divisa per ruolo. */
@Component({
  selector: 'app-team-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, TeamCrest, PlayerCard, Loading, ErrorState, EmptyState],
  template: `
    <div class="page">
      <a mat-button routerLink="/teams" class="back"><mat-icon>arrow_back</mat-icon> Squadre</a>

      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()!" (retry)="load()" />
      } @else if (team(); as t) {
        <section class="hero">
          <app-team-crest [src]="t.stemma" [name]="t.nome" [size]="88" />
          <div class="title">
            <h1>{{ t.nome }}</h1>
            <span>{{ t.giocatori.length }} giocatori in rosa</span>
          </div>
          @if (auth.isAdmin()) {
            <div class="admin">
              <a mat-stroked-button [routerLink]="['/players/new']" [queryParams]="{ squadra: t.id }">
                <mat-icon>person_add</mat-icon> Aggiungi giocatore
              </a>
              <a mat-stroked-button [routerLink]="['/teams', t.id, 'edit']"><mat-icon>edit</mat-icon> Modifica</a>
              <button mat-stroked-button class="btn-danger" (click)="remove()"><mat-icon>delete</mat-icon> Elimina</button>
            </div>
          }
        </section>

        @if (standing(); as s) {
          <section class="stats">
            <div class="stat"><strong>{{ s.posizione }}°</strong><span>Posizione</span></div>
            <div class="stat"><strong>{{ s.punti }}</strong><span>Punti</span></div>
            <div class="stat"><strong>{{ s.vinte }}-{{ s.pareggiate }}-{{ s.perse }}</strong><span>V-N-P</span></div>
            <div class="stat">
              <strong>{{ s.gol_fatti }}:{{ s.gol_subiti }}</strong><span>Gol fatti/subiti</span>
            </div>
          </section>
        }

        @if (!t.giocatori.length) {
          <app-empty-state icon="groups" title="Nessun giocatore in rosa" />
        }
        @for (group of roster(); track group.ruolo) {
          <h2 class="section-title">{{ group.label }} · {{ group.players.length }}</h2>
          <div class="grid-cards">
            @for (p of group.players; track p.id) {
              <app-player-card
                [player]="p"
                [admin]="auth.isAdmin()"
                (edit)="router.navigate(['/players', p.id, 'edit'])"
                (remove)="removePlayer(p)"
              />
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .back {
      margin: -6px 0 10px -8px;
    }
    .hero {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 18px;
      padding: 22px;
      border-radius: var(--radius);
      color: #fff;
      background:
        radial-gradient(circle at 90% 0%, rgb(25 184 102 / 45%), transparent 50%),
        linear-gradient(90deg, var(--brand-navy), var(--brand-navy-2));
      box-shadow: var(--shadow);
    }
    .title {
      flex: 1;
      min-width: 180px;
    }
    h1 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .title span {
      opacity: 0.75;
    }
    .admin {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      --mat-button-outlined-label-text-color: #fff;
      --mat-button-outlined-outline-color: rgb(255 255 255 / 40%);
    }
    .admin .btn-danger {
      --mat-button-outlined-label-text-color: #ffb3b3;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .stat {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
    }
    .stat strong {
      font-size: 1.3rem;
      color: var(--brand-navy);
    }
    .stat span {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 700;
    }
    @media (max-width: 639px) {
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
      h1 {
        font-size: 1.4rem;
      }
    }
  `,
})
export class TeamDetailPage {
  private teamsApi = inject(TeamsService);
  private playersApi = inject(PlayersService);
  private confirm = inject(ConfirmService);
  private standingsApi = inject(StandingsService);
  private deleteFlow = inject(TeamDeleteFlow);
  private notify = inject(NotifyService);
  protected readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  /** parametro di route `:id` */
  readonly id = input.required<string>();

  protected readonly team = signal<TeamDetail | null>(null);
  protected readonly standing = signal<StandingRow | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** rosa raggruppata per ruolo (POR, DIF, CEN, ATT) */
  protected readonly roster = computed(() => {
    const players = this.team()?.giocatori ?? [];
    return RUOLI.map((ruolo) => ({
      ruolo,
      label: PLURAL[ruolo],
      players: players.filter((p: Player) => p.ruolo === ruolo),
    })).filter((g) => g.players.length);
  });

  constructor() {
    // ricarica a ogni cambio di `id`
    effect(() => this.load(this.id()));
  }

  /**
   * Carica squadra e classifica in parallelo. Un errore sulla classifica è tollerato
   * (le statistiche semplicemente non compaiono); un errore sulla squadra mostra lo stato di errore.
   */
  protected load(id = this.id()): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      team: this.teamsApi.get(id),
      standings: this.standingsApi.standings().pipe(catchError(() => of([] as StandingRow[]))),
    }).subscribe({
      next: ({ team, standings }) => {
        this.team.set(team);
        const row = standings.find((s) => s.squadra_id === id);
        // le statistiche hanno senso solo dopo almeno una partita giocata
        this.standing.set(row && row.giocate > 0 ? row : null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Squadra non trovata'));
        this.loading.set(false);
      },
    });
  }

  /** Elimina la squadra con il flusso in due passi di `TeamDeleteFlow`. */
  protected remove(): void {
    const t = this.team();
    if (!t) return;
    this.deleteFlow.run(t, t.giocatori.length).subscribe((res) => {
      this.notify.success(this.deleteFlow.describe(res));
      this.router.navigateByUrl('/teams');
    });
  }

  /** Elimina un giocatore della rosa dopo conferma e ricarica la squadra. */
  protected removePlayer(p: Player): void {
    this.confirm
      .ask({
        title: 'Elimina giocatore',
        message: `Vuoi eliminare definitivamente ${p.nome} ${p.cognome}?`,
        confirmText: 'Elimina',
        danger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.playersApi.delete(p.id)),
      )
      .subscribe({
        next: () => {
          this.notify.success('Giocatore eliminato');
          this.load();
        },
        error: (err) => this.notify.apiError(err, 'Eliminazione non riuscita'),
      });
  }
}
