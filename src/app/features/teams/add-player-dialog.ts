import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { apiErrorMessage } from '../../core/api';
import { Player, RUOLO_LABEL, Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { Avatar } from '../../shared/avatar';
import { FasciaBadge, fasciaLabel } from '../../shared/fascia-badge';
import { OverallBadge } from '../../shared/overall-badge';
import { matchesPlayer, normalizeText } from '../../shared/player-search';
import { PluralPipe } from '../../shared/plural';
import { RoleBadge } from '../../shared/role-badge';
import { EmptyState, ErrorState, Loading } from '../../shared/states';

/**
 * Aggiunta di giocatori svincolati alla rosa di una squadra (solo admin).
 * Gli svincolati si caricano una volta e si filtrano in locale (risposta immediata alla
 * digitazione). Il dialog resta aperto dopo ogni assegnazione per comporre la rosa di seguito:
 * il giocatore aggiunto sparisce dall'elenco e `assigned` avvisa la pagina di aggiornare la rosa.
 */
@Component({
  selector: 'app-add-player-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    Avatar,
    RoleBadge,
    FasciaBadge,
    OverallBadge,
    Loading,
    ErrorState,
    EmptyState,
    PluralPipe,
  ],
  template: `
    <h2 mat-dialog-title>Aggiungi a {{ team.nome }}</h2>
    <mat-dialog-content>
      @if (loading()) {
        <app-loading label="Caricamento svincolati…" />
      } @else if (loadError()) {
        <app-error-state [message]="loadError()!" (retry)="load()" />
      } @else if (!players().length) {
        <app-empty-state icon="person_off" title="Nessun giocatore svincolato">
          <p class="muted">Tutti i giocatori sono già assegnati a una squadra.</p>
        </app-empty-state>
      } @else {
        <mat-form-field class="search" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Cerca per nome o cognome</mat-label>
          <input
            #searchInput
            matInput
            [ngModel]="q()"
            (ngModelChange)="q.set($event)"
            autocomplete="off"
            cdkFocusInitial
          />
          @if (q()) {
            <button mat-icon-button matSuffix (click)="q.set('')" aria-label="Svuota ricerca">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <p class="count" aria-live="polite">
          {{ filtered().length | plural: 'giocatore svincolato' : 'giocatori svincolati' }}
          @if (q().trim()) {
            su {{ players().length }}
          }
        </p>

        @if (!filtered().length) {
          <app-empty-state icon="person_search" title="Nessuno svincolato corrisponde alla ricerca">
            <button mat-stroked-button (click)="q.set('')">Svuota ricerca</button>
          </app-empty-state>
        } @else {
          <div class="list" role="radiogroup" aria-label="Giocatori svincolati">
            @for (p of filtered(); track p.id) {
              <label class="row" [class.selected]="selected()?.id === p.id">
                <input
                  type="radio"
                  name="add-player"
                  class="visually-hidden"
                  [checked]="selected()?.id === p.id"
                  (change)="selected.set(p)"
                  [attr.aria-label]="ariaLabel(p)"
                />
                <app-avatar [src]="p.foto" [name]="p.nome + ' ' + p.cognome" [size]="38" />
                <span class="who">
                  <strong>{{ p.cognome }}</strong> {{ p.nome }}
                </span>
                <app-role-badge [ruolo]="p.ruolo" [full]="false" />
                <app-fascia-badge [fascia]="p.fascia" />
                <app-overall [value]="p.overall" [size]="30" />
              </label>
            }
          </div>
        }
      }
      @if (error()) {
        <div class="error" role="alert"><mat-icon>error</mat-icon> {{ error() }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Chiudi</button>
      <button mat-flat-button [disabled]="!selected() || saving()" (click)="assign()">
        <mat-icon>person_add</mat-icon>
        @if (saving()) {
          Aggiunta…
        } @else if (selected(); as s) {
          Aggiungi {{ s.cognome }}
        } @else {
          Aggiungi alla squadra
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .search {
      width: 100%;
      margin-top: 4px;
    }
    .count {
      margin: 8px 0;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: min(52vh, 420px);
      overflow-y: auto;
      padding: 2px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition:
        background 0.15s,
        border-color 0.15s;
    }
    .row:hover {
      background: var(--row-hover);
    }
    .row:has(input:focus-visible) {
      outline: 2px solid var(--brand-accent-dark);
      outline-offset: 1px;
    }
    .row.selected {
      border-color: var(--brand-accent-dark);
      background: rgb(25 184 102 / 10%);
    }
    .who {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .who strong {
      color: var(--brand-navy);
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
    .error {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--danger);
      background: #fdecec;
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      margin-top: 12px;
      font-size: 0.9rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .row {
        transition: none;
      }
    }
  `,
})
export class AddPlayerDialog {
  protected readonly team = inject<Pick<Team, 'id' | 'nome'>>(MAT_DIALOG_DATA);
  private playersApi = inject(PlayersService);
  private teamsApi = inject(TeamsService);
  private notify = inject(NotifyService);
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** giocatore appena assegnato alla squadra: la pagina aggiorna la rosa */
  readonly assigned = output<Player>();

  protected readonly players = signal<Player[]>([]);
  protected readonly q = signal('');
  protected readonly selected = signal<Player | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const query = normalizeText(this.q());
    return this.players().filter((p) => matchesPlayer(p, query));
  });

  constructor() {
    this.load();
  }

  /** Carica gli svincolati, già ordinati per ruolo (POR → ATT) dal backend. */
  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.playersApi.list({ stato: 'svincolato', sort: 'ruolo' }).subscribe({
      next: (players) => {
        this.players.set(players);
        // la selezione resta solo se il giocatore è ancora svincolato
        const sel = this.selected();
        if (sel && !players.some((p) => p.id === sel.id)) this.selected.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiErrorMessage(err, 'Impossibile caricare i giocatori svincolati'));
        this.loading.set(false);
      },
    });
  }

  /** Assegna il giocatore selezionato; il dialog resta aperto per aggiungerne altri. */
  protected assign(): void {
    const p = this.selected();
    if (!p || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.teamsApi.assignPlayer(this.team.id, p.id).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.players.update((list) => list.filter((x) => x.id !== p.id));
        this.selected.set(null);
        this.notify.success(`${p.nome} ${p.cognome} aggiunto a ${this.team.nome}`);
        this.assigned.emit(updated);
        // pronto per cercare il prossimo giocatore
        this.searchInput()?.nativeElement.focus();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Assegnazione non riuscita'));
        // 409/404: il giocatore non è più disponibile, l'elenco va riallineato
        if (err instanceof HttpErrorResponse && (err.status === 409 || err.status === 404)) {
          this.load();
        }
      },
    });
  }

  protected ariaLabel(p: Player): string {
    return `${p.nome} ${p.cognome}, ${RUOLO_LABEL[p.ruolo]}, ${fasciaLabel(p.fascia)}, overall ${p.overall}`;
  }
}
