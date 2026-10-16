import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, filter, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  FASCE,
  Fascia,
  Player,
  PlayerFilters,
  PlayerSort,
  RUOLI,
  Ruolo,
  Team,
} from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { Avatar } from '../../shared/avatar';
import { ConfirmService } from '../../shared/confirm-dialog';
import { CellDef, DataTable, TableColumn } from '../../shared/data-table';
import { FasciaBadge } from '../../shared/fascia-badge';
import { OverallBadge } from '../../shared/overall-badge';
import { PlayerCard } from '../../shared/player-card';
import { PluralPipe } from '../../shared/plural';
import { RoleBadge } from '../../shared/role-badge';
import { EmptyState, ErrorState, Loading } from '../../shared/states';

/** Modalità di visualizzazione dell'elenco. */
type ViewMode = 'cards' | 'table';
/** Chiave di localStorage che ricorda la modalità scelta. */
const VIEW_KEY = 'pianetti.players.view';

/**
 * Elenco giocatori (/players) con ricerca, filtri per squadra, ruolo e fascia, ordinamento
 * e vista a card o a tabella. Il filtraggio avviene lato server.
 */
@Component({
  selector: 'app-players-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    PlayerCard,
    DataTable,
    CellDef,
    Avatar,
    RoleBadge,
    FasciaBadge,
    OverallBadge,
    Loading,
    ErrorState,
    EmptyState,
    PluralPipe,
  ],
  templateUrl: './players-list.html',
  styleUrl: './players-list.scss',
})
export class PlayersList {
  private playersApi = inject(PlayersService);
  private teamsApi = inject(TeamsService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly ruoli = RUOLI;
  protected readonly fasce = FASCE;

  // Filtri
  protected readonly q = signal('');
  protected readonly ruolo = signal<Ruolo | null>(null);
  protected readonly fascia = signal<Fascia | null>(null);
  /** '' = tutte, 'free' = svincolati, altrimenti id squadra */
  protected readonly team = signal<string>('');
  protected readonly sort = signal<PlayerSort>('overall_desc');
  protected readonly view = signal<ViewMode>(this.loadView());

  // Stato
  protected readonly players = signal<Player[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** incrementato da "Riprova" per rieseguire la ricerca con gli stessi filtri */
  private readonly reloadTick = signal(0);

  /** true se è attivo almeno un filtro: cambia il messaggio dello stato vuoto */
  protected readonly hasFilters = computed(
    () => !!(this.q().trim() || this.ruolo() || this.fascia() || this.team()),
  );

  /**
   * Filtri pronti per l'API. Il valore 'free' della select squadra diventa `svincolati=true`;
   * `tick` rende diverso l'oggetto anche a filtri invariati, così "Riprova" scatena una nuova richiesta.
   */
  private readonly filters = computed<PlayerFilters & { tick: number }>(() => ({
    q: this.q().trim() || null,
    ruolo: this.ruolo(),
    fascia: this.fascia(),
    squadra_id: this.team() && this.team() !== 'free' ? this.team() : null,
    svincolati: this.team() === 'free',
    sort: this.sort(),
    tick: this.reloadTick(),
  }));

  protected readonly columns: TableColumn<Player>[] = [
    { key: 'giocatore', header: 'Giocatore' },
    { key: 'ruolo', header: 'Ruolo', align: 'center', width: '70px' },
    { key: 'squadra', header: 'Squadra', value: (p) => p.squadra_nome ?? 'Svincolato', hideOnMobile: true },
    {
      key: 'fascia',
      header: 'Fascia',
      align: 'center',
      width: '70px',
      title: 'Fascia (1 = migliore, 4 = peggiore)',
    },
    { key: 'goal', header: 'Gol', align: 'center', width: '60px' },
    { key: 'overall', header: 'OVR', align: 'center', width: '70px', title: 'Overall' },
  ];

  constructor() {
    this.teamsApi
      .list()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (t) => this.teams.set(t), error: () => this.teams.set([]) });

    // Ricerca reattiva sui filtri:
    // - debounceTime(250) evita una richiesta a ogni tasto digitato nella ricerca;
    // - switchMap annulla la richiesta precedente se i filtri cambiano prima della risposta;
    // - catchError interno: un errore non chiude lo stream, i filtri successivi continuano a funzionare.
    // Durante i ricaricamenti i risultati precedenti restano visibili, attenuati (classe `dim`).
    toObservable(this.filters)
      .pipe(
        debounceTime(250),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ tick: _, ...f }) =>
          this.playersApi.list(f).pipe(
            map((players) => ({ players, error: null as unknown })),
            catchError((error: unknown) => of({ players: [] as Player[], error })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ players, error }) => {
        this.loading.set(false);
        if (error) this.error.set('Impossibile caricare i giocatori');
        this.players.set(players);
      });
  }

  /** Ripete la ricerca con i filtri correnti. */
  protected reload(): void {
    this.reloadTick.update((v) => v + 1);
  }

  /** Azzera ricerca, ruolo, fascia e squadra (l'ordinamento resta invariato). */
  protected resetFilters(): void {
    this.q.set('');
    this.ruolo.set(null);
    this.fascia.set(null);
    this.team.set('');
  }

  /** Cambia vista e la ricorda per le visite successive. */
  protected setView(v: ViewMode): void {
    this.view.set(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignora */
    }
  }

  protected open(p: Player): void {
    this.router.navigate(['/players', p.id]);
  }

  protected edit(p: Player): void {
    this.router.navigate(['/players', p.id, 'edit']);
  }

  /** Elimina un giocatore dopo conferma, togliendolo dall'elenco senza ricaricare. */
  protected remove(p: Player): void {
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
          this.players.update((list) => list.filter((x) => x.id !== p.id));
          this.notify.success('Giocatore eliminato');
        },
        error: (err) => this.notify.apiError(err, 'Eliminazione non riuscita'),
      });
  }

  /** Vista salvata; default card (anche se localStorage non è disponibile). */
  private loadView(): ViewMode {
    try {
      return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  }
}
