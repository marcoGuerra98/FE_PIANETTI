import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { Player, RUOLO_LABEL } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { Avatar } from '../../shared/avatar';
import { ConfirmService } from '../../shared/confirm-dialog';
import { OverallBadge } from '../../shared/overall-badge';
import { RoleBadge } from '../../shared/role-badge';
import { ErrorState, Loading } from '../../shared/states';

/** Scheda giocatore (/players/:id): profilo, statistiche, descrizione e azioni admin. */
@Component({
  selector: 'app-player-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, Avatar, RoleBadge, OverallBadge, Loading, ErrorState],
  template: `
    <div class="page">
      <a mat-button routerLink="/players" class="back"><mat-icon>arrow_back</mat-icon> Giocatori</a>

      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()!" (retry)="load()" />
      } @else if (player(); as p) {
        <section class="hero card">
          <div class="hero-bg"></div>
          <div class="hero-content">
            <app-avatar [src]="p.foto" [name]="p.nome + ' ' + p.cognome" [size]="132" />
            <div class="identity">
              <app-role-badge [ruolo]="p.ruolo" />
              <h1>
                <span class="first">{{ p.nome }}</span> {{ p.cognome }}
              </h1>
              @if (p.squadra_id) {
                <a class="team" [routerLink]="['/teams', p.squadra_id]">
                  <mat-icon>shield</mat-icon>{{ p.squadra_nome }}
                </a>
              } @else {
                <span class="team free">Svincolato</span>
              }
            </div>
            @if (auth.isAdmin()) {
              <div class="admin-actions">
                <a mat-stroked-button [routerLink]="['/players', p.id, 'edit']"><mat-icon>edit</mat-icon> Modifica</a>
                <button mat-stroked-button class="btn-danger" (click)="remove(p)">
                  <mat-icon>delete</mat-icon> Elimina
                </button>
              </div>
            }
          </div>
        </section>

        <section class="stats">
          <div class="stat card">
            <app-overall [value]="p.overall" [size]="52" />
            <span class="label">Overall</span>
          </div>
          <div class="stat card">
            <span class="value">{{ p.goal }}</span>
            <span class="label">Goal segnati</span>
          </div>
          <div class="stat card">
            <span class="value role-name">{{ ruoloLabel[p.ruolo] }}</span>
            <span class="label">Ruolo</span>
          </div>
        </section>

        <section class="card card-padded">
          <h2 class="section-title" style="margin-top: 0">Descrizione</h2>
          @if (p.descrizione) {
            <p class="descr">{{ p.descrizione }}</p>
          } @else {
            <p class="muted">Nessuna descrizione disponibile.</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .back {
      margin: -6px 0 10px -8px;
    }
    .hero {
      position: relative;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .hero-bg {
      position: absolute;
      inset: 0 0 auto;
      height: 96px;
      background:
        radial-gradient(circle at 85% -20%, rgb(25 184 102 / 55%), transparent 55%),
        linear-gradient(90deg, var(--brand-navy), var(--brand-navy-2));
    }
    .hero-content {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 20px;
      padding: 32px 24px 22px;
    }
    app-avatar {
      border: 4px solid #fff;
      box-shadow: var(--shadow);
    }
    .identity {
      flex: 1;
      min-width: 200px;
    }
    h1 {
      margin: 8px 0 4px;
      font-size: 1.9rem;
      font-weight: 800;
      color: var(--brand-navy);
      letter-spacing: -0.02em;
    }
    .first {
      font-weight: 500;
    }
    .team {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--brand-navy-2);
      font-weight: 600;
      text-decoration: none;
    }
    .team:hover {
      text-decoration: underline;
    }
    .team mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .team.free {
      color: var(--muted);
      font-style: italic;
    }
    .admin-actions {
      display: flex;
      gap: 8px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 16px 8px;
      min-height: 96px;
      box-sizing: border-box;
    }
    .value {
      font-size: 2rem;
      font-weight: 800;
      color: var(--brand-navy);
      line-height: 52px;
    }
    .role-name {
      font-size: 1rem;
    }
    .label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      text-align: center;
    }
    .descr {
      margin: 0;
      line-height: 1.6;
      white-space: pre-line;
    }
    @media (max-width: 639px) {
      .hero-content {
        justify-content: center;
        text-align: center;
      }
      h1 {
        font-size: 1.5rem;
      }
      .admin-actions {
        width: 100%;
        justify-content: center;
      }
    }
  `,
})
export class PlayerDetail {
  private api = inject(PlayersService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  protected readonly auth = inject(AuthService);

  /** parametro di route `:id`, tramite withComponentInputBinding */
  readonly id = input.required<string>();

  protected readonly ruoloLabel = RUOLO_LABEL;
  protected readonly player = signal<Player | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // ricarica a ogni cambio di `id` (navigazione tra giocatori senza distruggere il componente)
    effect(() => this.load(this.id()));
  }

  /** Carica il giocatore; usato anche dal pulsante "Riprova". */
  protected load(id = this.id()): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (p) => {
        this.player.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Giocatore non trovato'));
        this.loading.set(false);
      },
    });
  }

  /** Elimina il giocatore dopo conferma e torna all'elenco. */
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
        switchMap(() => this.api.delete(p.id)),
      )
      .subscribe({
        next: () => {
          this.notify.success('Giocatore eliminato');
          this.router.navigateByUrl('/players');
        },
        error: (err) => this.notify.apiError(err, 'Eliminazione non riuscita'),
      });
  }
}
