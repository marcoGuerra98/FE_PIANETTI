import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Player } from '../core/models';
import { Avatar } from './avatar';
import { FasciaBadge } from './fascia-badge';
import { OverallBadge } from './overall-badge';
import { RoleBadge } from './role-badge';

/**
 * Card giocatore: foto, ruolo, nome, fascia, squadra, overall e goal.
 * L'intera card porta al dettaglio; con `admin` compaiono le azioni di modifica ed eliminazione,
 * che vengono solo emesse: la gestione spetta alla pagina che ospita la card.
 */
@Component({
  selector: 'app-player-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Avatar,
    RoleBadge,
    OverallBadge,
    FasciaBadge,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <a class="body" [routerLink]="['/players', player().id]">
      <div class="photo-wrap">
        <app-avatar [src]="player().foto" [name]="player().nome + ' ' + player().cognome" [size]="64" />
        <app-role-badge class="role" [ruolo]="player().ruolo" [full]="false" />
      </div>
      <div class="info">
        <span class="surname">{{ player().cognome }}</span>
        <span class="name">{{ player().nome }}</span>
        <span class="meta">
          @if (player().fascia) {
            <app-fascia-badge [fascia]="player().fascia" />
          }
          <span class="team" [class.free]="!player().squadra_nome">
            {{ player().squadra_nome ?? 'Svincolato' }}
          </span>
        </span>
      </div>
      <div class="stats">
        <app-overall [value]="player().overall" />
        <span class="goals" matTooltip="Goal segnati">
          <mat-icon>sports_soccer</mat-icon>{{ player().goal }}
        </span>
      </div>
    </a>
    @if (admin()) {
      <div class="actions">
        <button mat-icon-button matTooltip="Modifica" (click)="edit.emit(player())" aria-label="Modifica giocatore">
          <mat-icon>edit</mat-icon>
        </button>
        <button
          mat-icon-button
          class="btn-danger"
          matTooltip="Elimina"
          (click)="remove.emit(player())"
          aria-label="Elimina giocatore"
        >
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      transition:
        box-shadow 0.15s,
        transform 0.15s;
      overflow: hidden;
    }
    :host:hover {
      box-shadow: var(--shadow-hover);
      transform: translateY(-1px);
    }
    .body {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px;
      text-decoration: none;
      color: inherit;
    }
    .photo-wrap {
      position: relative;
    }
    .role {
      position: absolute;
      bottom: -4px;
      right: -6px;
      box-shadow: 0 0 0 2px #fff;
    }
    .info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .surname {
      font-weight: 800;
      font-size: 1.02rem;
      color: var(--brand-navy);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .name {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      min-width: 0;
    }
    .team {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--brand-navy-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .team.free {
      color: var(--muted);
      font-style: italic;
    }
    .stats {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .goals {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--muted);
    }
    .goals mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid var(--border);
      padding: 2px 6px;
      background: #fafbfd;
    }
  `,
})
export class PlayerCard {
  /** giocatore da mostrare */
  readonly player = input.required<Player>();
  /** mostra le azioni amministrative */
  readonly admin = input(false);
  /** richiesta di modifica */
  readonly edit = output<Player>();
  /** richiesta di eliminazione */
  readonly remove = output<Player>();
}
