import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Player, Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';
import { TeamDeleteFlow } from './team-delete';

/** Elenco squadre (/teams) a griglia, con numero di giocatori e azioni admin. */
@Component({
  selector: 'app-teams-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, TeamCrest, Loading, ErrorState, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Squadre</h1>
          <p class="subtitle">{{ teams().length }} squadre iscritte</p>
        </div>
        @if (auth.isAdmin()) {
          <div class="actions">
            <a mat-flat-button routerLink="/teams/new"><mat-icon>add</mat-icon> Nuova squadra</a>
          </div>
        }
      </div>

      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state (retry)="ngOnInit()" />
      } @else if (!teams().length) {
        <app-empty-state icon="shield" title="Nessuna squadra iscritta">
          @if (auth.isAdmin()) {
            <a mat-flat-button routerLink="/teams/new">Crea la prima squadra</a>
          }
        </app-empty-state>
      } @else {
        <div class="grid">
          @for (t of teams(); track t.id) {
            <article class="team card">
              <a class="body" [routerLink]="['/teams', t.id]">
                <app-team-crest [src]="t.stemma" [name]="t.nome" [size]="72" />
                <h2>{{ t.nome }}</h2>
                <span class="count">
                  <mat-icon>groups</mat-icon> {{ counts()[t.id] ?? 0 }} giocatori
                </span>
              </a>
              @if (auth.isAdmin()) {
                <div class="actions">
                  <a mat-icon-button [routerLink]="['/teams', t.id, 'edit']" matTooltip="Modifica" aria-label="Modifica">
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button mat-icon-button class="btn-danger" matTooltip="Elimina" aria-label="Elimina" (click)="remove(t)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
    .team {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition:
        box-shadow 0.15s,
        transform 0.15s;
    }
    .team:hover {
      box-shadow: var(--shadow-hover);
      transform: translateY(-1px);
    }
    .body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 22px 14px 16px;
      text-decoration: none;
      color: inherit;
      text-align: center;
      flex: 1;
    }
    h2 {
      margin: 6px 0 0;
      font-size: 1.02rem;
      font-weight: 800;
      color: var(--brand-navy);
    }
    .count {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .count mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .actions {
      display: flex;
      justify-content: center;
      border-top: 1px solid var(--border);
      background: #fafbfd;
    }
  `,
})
export class TeamsList implements OnInit {
  private teamsApi = inject(TeamsService);
  private playersApi = inject(PlayersService);
  private deleteFlow = inject(TeamDeleteFlow);
  private notify = inject(NotifyService);
  private router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly teams = signal<Team[]>([]);
  private readonly players = signal<Player[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  /** giocatori per squadra, contati sull'elenco completo (l'API squadre non li espone) */
  protected readonly counts = computed(() => {
    const c: Record<string, number> = {};
    for (const p of this.players()) if (p.squadra_id) c[p.squadra_id] = (c[p.squadra_id] ?? 0) + 1;
    return c;
  });

  /** Carica squadre e giocatori in parallelo; usato anche da "Riprova" e dopo un'eliminazione. */
  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({ teams: this.teamsApi.list(), players: this.playersApi.list() }).subscribe({
      next: ({ teams, players }) => {
        this.teams.set(teams);
        this.players.set(players);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Elimina la squadra con il flusso in due passi di `TeamDeleteFlow`. */
  protected remove(team: Team): void {
    this.deleteFlow.run(team, this.counts()[team.id] ?? 0).subscribe((res) => {
      this.notify.success(this.deleteFlow.describe(res));
      this.ngOnInit();
    });
  }
}
