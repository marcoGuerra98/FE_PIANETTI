import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { FASCE, Fascia, Player, RUOLI, RUOLO_PLURAL, Ruolo, Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { Avatar } from '../../shared/avatar';
import { FasciaBadge } from '../../shared/fascia-badge';
import { OverallBadge } from '../../shared/overall-badge';
import { matchesPlayer, normalizeText } from '../../shared/player-search';
import { PluralPipe } from '../../shared/plural';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';
import { AssignTeamData, AssignTeamDialog } from './assign-team-dialog';

/** Gruppo di una fascia all'interno di un ruolo (`fascia` null = senza fascia). */
interface FasciaGroup {
  fascia: Fascia | null;
  players: Player[];
}

/** Sezione di un ruolo con i contatori e i gruppi per fascia. */
interface RoleGroup {
  ruolo: Ruolo;
  label: string;
  total: number;
  free: number;
  fasce: FasciaGroup[];
}

/**
 * Sorteggio (/draw): tutti i giocatori raggruppati per ruolo e, dentro ogni ruolo, per fascia
 * (1 → 4, poi "Senza fascia"). Pubblica in lettura; l'admin può assegnare gli svincolati a una
 * squadra. Ricerca e filtro "Solo svincolati" sono locali: i dati si caricano una volta.
 */
@Component({
  selector: 'app-draw',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    Avatar,
    FasciaBadge,
    OverallBadge,
    TeamCrest,
    Loading,
    ErrorState,
    EmptyState,
    PluralPipe,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Sorteggio</h1>
          <p class="subtitle">
            @if (!loading() && !error()) {
              {{ players().length | plural: 'giocatore' : 'giocatori' }} ·
              {{ freeCount() | plural: 'svincolato' : 'svincolati' }}
            } @else {
              &nbsp;
            }
          </p>
        </div>
      </div>

      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()!" (retry)="load()" />
      } @else if (!players().length) {
        <app-empty-state icon="person_search" title="Nessun giocatore inserito">
          @if (auth.isAdmin()) {
            <a mat-flat-button routerLink="/players/new">Aggiungi il primo giocatore</a>
          }
        </app-empty-state>
      } @else {
        <section class="card filters" aria-label="Filtri">
          <mat-form-field class="search" subscriptSizing="dynamic">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Cerca per nome o cognome</mat-label>
            <input matInput [ngModel]="q()" (ngModelChange)="q.set($event)" autocomplete="off" />
            @if (q()) {
              <button mat-icon-button matSuffix (click)="q.set('')" aria-label="Svuota ricerca">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
          <mat-slide-toggle [checked]="onlyFree()" (change)="onlyFree.set($event.checked)">
            Solo svincolati
          </mat-slide-toggle>
        </section>

        <p class="visually-hidden" aria-live="polite">
          {{ visibleCount() | plural: 'giocatore mostrato' : 'giocatori mostrati' }}
        </p>

        @if (!groups().length) {
          <app-empty-state icon="person_search" title="Nessun giocatore corrisponde ai filtri">
            <button mat-stroked-button (click)="resetFilters()">Azzera filtri</button>
          </app-empty-state>
        }

        @for (g of groups(); track g.ruolo) {
          <section class="role-section" [attr.aria-labelledby]="'role-' + g.ruolo">
            <h2 class="section-title" [id]="'role-' + g.ruolo">
              {{ g.label }} · {{ g.total }}
              <span class="free-count">({{ g.free | plural: 'svincolato' : 'svincolati' }})</span>
            </h2>

            @for (f of g.fasce; track f.fascia) {
              <h3 class="fascia-title">
                <app-fascia-badge [fascia]="f.fascia" [full]="true" />
                <span class="muted">{{ f.players.length }}</span>
              </h3>
              <div class="grid">
                @for (p of f.players; track p.id) {
                  <article class="item" [class.free]="!p.squadra_id">
                    <div class="top">
                      <a class="who" [routerLink]="['/players', p.id]">
                        <app-avatar [src]="p.foto" [name]="p.nome + ' ' + p.cognome" [size]="40" />
                        <span class="names">
                          <strong>{{ p.cognome }}</strong>
                          <span>{{ p.nome }}</span>
                        </span>
                      </a>
                      <app-overall [value]="p.overall" [size]="32" />
                    </div>
                    <div class="status">
                      @if (p.squadra_id) {
                        <a class="team" [routerLink]="['/teams', p.squadra_id]">
                          <app-team-crest
                            [src]="crests()[p.squadra_id]"
                            [name]="p.squadra_nome"
                            [size]="20"
                          />
                          <span>{{ p.squadra_nome }}</span>
                        </a>
                      } @else {
                        <span class="free-label">
                          <mat-icon aria-hidden="true">person_off</mat-icon> Svincolato
                        </span>
                        @if (auth.isAdmin()) {
                          <button
                            mat-stroked-button
                            class="assign-btn"
                            (click)="assign(p)"
                            [attr.aria-label]="
                              'Assegna ' + p.nome + ' ' + p.cognome + ' a una squadra'
                            "
                          >
                            <mat-icon>how_to_reg</mat-icon> Assegna
                          </button>
                        }
                      }
                    </div>
                  </article>
                }
              </div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 20px;
      padding: 14px;
      margin-bottom: 8px;
    }
    .search {
      flex: 1 1 260px;
    }
    .free-count {
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
    }
    .fascia-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 14px 0 8px;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: #f6f8fb;
    }
    /* svincolati: card bianca in evidenza con bordo d'accento */
    .item.free {
      background: var(--card);
      box-shadow: var(--shadow);
      border-left: 4px solid var(--brand-accent);
    }
    .top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .who {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }
    .who:hover strong {
      text-decoration: underline;
    }
    .names {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .names strong,
    .names span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .names strong {
      color: var(--brand-navy);
    }
    .names span {
      font-size: 0.85rem;
      color: var(--muted);
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 36px;
      border-top: 1px solid var(--border);
      padding-top: 8px;
    }
    .team {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-navy-2);
      text-decoration: none;
    }
    .team span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .team:hover span {
      text-decoration: underline;
    }
    .free-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text);
    }
    .free-label mat-icon {
      color: var(--brand-accent-dark);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .assign-btn {
      height: 36px;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class DrawPage {
  private playersApi = inject(PlayersService);
  private teamsApi = inject(TeamsService);
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);
  protected readonly auth = inject(AuthService);

  protected readonly players = signal<Player[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Filtri locali
  protected readonly q = signal('');
  protected readonly onlyFree = signal(false);

  protected readonly freeCount = computed(() => this.players().filter((p) => !p.squadra_id).length);

  /** stemma per id squadra (il giocatore espone solo il nome della squadra) */
  protected readonly crests = computed(() =>
    Object.fromEntries(this.teams().map((t) => [t.id, t.stemma])),
  );

  /** giocatori filtrati, raggruppati per ruolo e poi per fascia (1 → 4, senza fascia in fondo) */
  protected readonly groups = computed<RoleGroup[]>(() => {
    const query = normalizeText(this.q());
    const onlyFree = this.onlyFree();
    const visible = this.players().filter(
      (p) => matchesPlayer(p, query) && (!onlyFree || !p.squadra_id),
    );
    const fasce: (Fascia | null)[] = [...FASCE, null];
    return RUOLI.map((ruolo) => {
      const inRole = visible.filter((p) => p.ruolo === ruolo);
      return {
        ruolo,
        label: RUOLO_PLURAL[ruolo],
        total: inRole.length,
        free: inRole.filter((p) => !p.squadra_id).length,
        fasce: fasce
          .map((fascia) => ({
            fascia,
            players: inRole.filter((p) => (p.fascia ?? null) === fascia),
          }))
          .filter((g) => g.players.length),
      };
    }).filter((g) => g.total);
  });

  protected readonly visibleCount = computed(() => this.groups().reduce((n, g) => n + g.total, 0));

  constructor() {
    this.load();
  }

  /** Carica giocatori (ordinati per ruolo e cognome) e squadre; usato anche da "Riprova". */
  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      players: this.playersApi.list({ sort: 'ruolo' }),
      teams: this.teamsApi.list(),
    }).subscribe({
      next: ({ players, teams }) => {
        this.players.set(players);
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Impossibile caricare i giocatori'));
        this.loading.set(false);
      },
    });
  }

  protected resetFilters(): void {
    this.q.set('');
    this.onlyFree.set(false);
  }

  /** Apre la scelta della squadra; al termine aggiorna il giocatore e riallinea l'elenco. */
  protected assign(p: Player): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open<AssignTeamDialog, AssignTeamData, Player>(AssignTeamDialog, {
        data: { player: p, teams: this.teams() },
        width: '460px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.players.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
          this.notify.success(`${p.nome} ${p.cognome} assegnato a ${updated.squadra_nome}`);
        }
        // riallinea in background (es. dopo un 409 il giocatore era già stato assegnato altrove)
        this.refresh();
      });
  }

  /** Ricarica i giocatori senza stato di caricamento, mantenendo filtri e scroll. */
  private refresh(): void {
    this.playersApi.list({ sort: 'ruolo' }).subscribe({
      next: (players) => this.players.set(players),
      error: () => {
        /* si mantiene l'elenco attuale */
      },
    });
  }
}
