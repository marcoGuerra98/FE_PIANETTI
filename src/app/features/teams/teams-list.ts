import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { Player, Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { Avatar } from '../../shared/avatar';
import { CellDef, DataTable, TableColumn } from '../../shared/data-table';
import { FasciaBadge } from '../../shared/fascia-badge';
import { OverallBadge } from '../../shared/overall-badge';
import { RoleBadge } from '../../shared/role-badge';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { PluralPipe } from '../../shared/plural';
import { TeamCrest } from '../../shared/team-crest';
import { TeamDeleteFlow } from './team-delete';

/**
 * Elenco squadre (/teams) a griglia, con numero di giocatori e azioni admin.
 * Con `?vista=giocatori` mostra invece la tabella di tutti i giocatori assegnati alle squadre:
 * lo stato sta nella query string, così il "indietro" del browser riporta alla griglia.
 */
@Component({
  selector: 'app-teams-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TeamCrest,
    Avatar,
    RoleBadge,
    FasciaBadge,
    OverallBadge,
    DataTable,
    CellDef,
    Loading,
    ErrorState,
    EmptyState,
    PluralPipe,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Squadre</h1>
          <p class="subtitle">
            <!-- il contatore compare solo a dati caricati; &nbsp; riserva lo spazio della riga -->
            @if (showPlayers()) {
              @if (!playersLoading() && !playersError()) {
                {{ assigned().length | plural: 'giocatore in rosa' : 'giocatori in rosa' }}
              } @else {
                &nbsp;
              }
            } @else if (!loading() && !error()) {
              {{ teams().length | plural: 'squadra iscritta' : 'squadre iscritte' }}
            } @else {
              &nbsp;
            }
          </p>
        </div>
        <div class="actions">
          @if (showPlayers()) {
            <a mat-stroked-button routerLink="/teams">
              <mat-icon>arrow_back</mat-icon> Torna alle squadre
            </a>
          } @else {
            <a mat-stroked-button routerLink="/teams" [queryParams]="{ vista: 'giocatori' }">
              <mat-icon>groups</mat-icon> Mostra tutti i giocatori
            </a>
          }
          @if (auth.isAdmin()) {
            <a mat-flat-button routerLink="/teams/new"><mat-icon>add</mat-icon> Nuova squadra</a>
          }
        </div>
      </div>

      @if (showPlayers()) {
        <!-- Vista "tutti i giocatori": rose di tutte le squadre, nell'ordine POR, DIF, CEN, ATT del server -->
        @if (playersLoading()) {
          <app-loading />
        } @else if (playersError()) {
          <app-error-state [message]="playersError()!" (retry)="loadAssigned()" />
        } @else if (!assigned().length) {
          <app-empty-state icon="groups" title="Nessun giocatore assegnato alle squadre">
            <a mat-stroked-button routerLink="/draw">Vai al sorteggio</a>
          </app-empty-state>
        } @else {
          <div class="card">
            <app-data-table
              [columns]="columns"
              [data]="assigned()"
              idKey="id"
              [clickable]="true"
              (rowClick)="openPlayer($event)"
            >
              <ng-template appCell="giocatore" let-p>
                <span class="player-cell">
                  <app-avatar [src]="p.foto" [name]="p.nome + ' ' + p.cognome" [size]="34" />
                  <span>
                    <strong>{{ p.cognome }}</strong> {{ p.nome }}
                  </span>
                </span>
              </ng-template>
              <ng-template appCell="ruolo" let-p>
                <app-role-badge [ruolo]="p.ruolo" [full]="false" />
              </ng-template>
              <ng-template appCell="squadra" let-p>
                <span class="team-cell">
                  <app-team-crest
                    [src]="crests()[p.squadra_id]"
                    [name]="p.squadra_nome"
                    [size]="22"
                  />
                  <span>{{ p.squadra_nome }}</span>
                </span>
              </ng-template>
              <ng-template appCell="fascia" let-p>
                <app-fascia-badge [fascia]="p.fascia" />
              </ng-template>
              <ng-template appCell="overall" let-p>
                <app-overall [value]="p.overall" [size]="30" />
              </ng-template>
            </app-data-table>
          </div>
        }
      } @else if (loading()) {
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
                  <mat-icon>groups</mat-icon> {{ counts()[t.id] ?? 0 | plural: 'giocatore' : 'giocatori' }}
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
    .player-cell,
    .team-cell {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
    }
    .team-cell {
      gap: 8px;
      font-weight: 600;
      color: var(--brand-navy-2);
    }
    .player-cell strong {
      color: var(--brand-navy);
    }
    .team .actions {
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

  /** query param `?vista=…` (withComponentInputBinding) */
  readonly vista = input<string>();
  protected readonly showPlayers = computed(() => this.vista() === 'giocatori');

  // Vista "tutti i giocatori"
  protected readonly assigned = signal<Player[]>([]);
  protected readonly playersLoading = signal(false);
  protected readonly playersError = signal<string | null>(null);
  private assignedSub?: Subscription;

  /** stemma per id squadra, per la colonna Squadra */
  protected readonly crests = computed(() =>
    Object.fromEntries(this.teams().map((t) => [t.id, t.stemma])),
  );

  protected readonly columns: TableColumn<Player>[] = [
    { key: 'giocatore', header: 'Giocatore' },
    { key: 'ruolo', header: 'Ruolo', align: 'center', width: '70px' },
    { key: 'squadra', header: 'Squadra' },
    {
      key: 'fascia',
      header: 'Fascia',
      align: 'center',
      width: '70px',
      hideOnMobile: true,
      title: 'Fascia (1 = migliore, 4 = peggiore)',
    },
    {
      key: 'overall',
      header: 'OVR',
      align: 'center',
      width: '70px',
      title: 'Overall',
      hideOnMobile: true,
    },
  ];

  constructor() {
    // carica l'elenco ogni volta che si entra nella vista giocatori (dati sempre aggiornati)
    effect(() => {
      if (this.showPlayers()) this.loadAssigned();
    });
  }

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

  /** Tutti i giocatori assegnati, ordinati dal server per ruolo (POR, DIF, CEN, ATT) e cognome. */
  protected loadAssigned(): void {
    this.assignedSub?.unsubscribe();
    this.playersLoading.set(true);
    this.playersError.set(null);
    this.assignedSub = this.playersApi.list({ stato: 'assegnato', sort: 'ruolo' }).subscribe({
      next: (players) => {
        this.assigned.set(players);
        this.playersLoading.set(false);
      },
      error: (err) => {
        this.playersError.set(apiErrorMessage(err, 'Impossibile caricare i giocatori'));
        this.playersLoading.set(false);
      },
    });
  }

  protected openPlayer(p: Player): void {
    this.router.navigate(['/players', p.id]);
  }

  /** Elimina la squadra con il flusso in due passi di `TeamDeleteFlow`. */
  protected remove(team: Team): void {
    this.deleteFlow.run(team, this.counts()[team.id] ?? 0).subscribe((res) => {
      this.notify.success(this.deleteFlow.describe(res));
      this.ngOnInit();
    });
  }
}
