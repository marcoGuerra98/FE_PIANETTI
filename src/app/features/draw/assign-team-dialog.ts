import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { apiErrorMessage } from '../../core/api';
import { Player, Team } from '../../core/models';
import { TeamsService } from '../../core/services/teams.service';
import { Avatar } from '../../shared/avatar';
import { FasciaBadge } from '../../shared/fascia-badge';
import { OverallBadge } from '../../shared/overall-badge';
import { RoleBadge } from '../../shared/role-badge';
import { EmptyState } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';

/** Dati del dialog: il giocatore da assegnare e le squadre disponibili. */
export interface AssignTeamData {
  player: Player;
  teams: Team[];
}

/**
 * Assegnazione di un giocatore svincolato a una squadra (sorteggio, solo admin).
 * Gli errori (es. 409 se nel frattempo è stato assegnato altrove) restano nel dialog;
 * si chiude con il giocatore aggiornato solo in caso di successo.
 */
@Component({
  selector: 'app-assign-team-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    Avatar,
    RoleBadge,
    FasciaBadge,
    OverallBadge,
    TeamCrest,
    EmptyState,
  ],
  template: `
    <h2 mat-dialog-title>Assegna a una squadra</h2>
    <mat-dialog-content>
      <div class="player">
        <app-avatar [src]="p.foto" [name]="p.nome + ' ' + p.cognome" [size]="44" />
        <span class="who">
          <strong>{{ p.cognome }}</strong> {{ p.nome }}
          <span class="badges">
            <app-role-badge [ruolo]="p.ruolo" [full]="false" />
            <app-fascia-badge [fascia]="p.fascia" />
          </span>
        </span>
        <app-overall [value]="p.overall" [size]="34" />
      </div>

      @if (!data.teams.length) {
        <app-empty-state icon="shield" title="Nessuna squadra iscritta">
          <p class="muted">Crea prima le squadre dalla sezione Squadre.</p>
        </app-empty-state>
      } @else {
        <div class="list" role="radiogroup" aria-label="Squadra di destinazione">
          @for (t of data.teams; track t.id) {
            <label class="row" [class.selected]="selected()?.id === t.id">
              <input
                type="radio"
                name="assign-team"
                class="visually-hidden"
                [checked]="selected()?.id === t.id"
                (change)="selected.set(t); error.set(null)"
                [attr.aria-label]="t.nome"
              />
              <app-team-crest [src]="t.stemma" [name]="t.nome" [size]="28" />
              <span class="team-name">{{ t.nome }}</span>
              @if (selected()?.id === t.id) {
                <mat-icon class="check" aria-hidden="true">check_circle</mat-icon>
              }
            </label>
          }
        </div>
      }

      @if (error()) {
        <div class="error" role="alert"><mat-icon>error</mat-icon> {{ error() }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Annulla</button>
      <button mat-flat-button [disabled]="!selected() || saving()" (click)="confirm()">
        <mat-icon>how_to_reg</mat-icon>
        {{ saving() ? 'Assegnazione…' : 'Assegna' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .player {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      margin-bottom: 14px;
      background: #f6f8fb;
      border-radius: var(--radius-sm);
    }
    .who {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .who strong {
      color: var(--brand-navy);
    }
    .badges {
      display: flex;
      gap: 6px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: min(46vh, 360px);
      overflow-y: auto;
      padding: 2px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
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
    .team-name {
      flex: 1;
      font-weight: 600;
    }
    .check {
      color: var(--brand-accent-dark);
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
export class AssignTeamDialog {
  protected readonly data = inject<AssignTeamData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AssignTeamDialog, Player>);
  private api = inject(TeamsService);

  protected readonly p = this.data.player;
  protected readonly selected = signal<Team | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    const team = this.selected();
    if (!team || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.ref.disableClose = true;
    this.api.assignPlayer(team.id, this.p.id).subscribe({
      next: (updated) => this.ref.close(updated),
      error: (err) => {
        this.saving.set(false);
        this.ref.disableClose = false;
        this.error.set(apiErrorMessage(err, 'Assegnazione non riuscita'));
      },
    });
  }
}
