import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { TournamentResetResult } from '../../core/models';
import { TournamentService } from '../../core/services/tournament.service';

/**
 * Fine torneo / reset (solo admin): spiega le conseguenze e chiede di nuovo la password.
 * Gli errori (password errata 403, troppi tentativi 429, rete) restano nel dialog;
 * si chiude con l'esito del reset solo in caso di successo.
 */
@Component({
  selector: 'app-reset-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="danger">restart_alt</mat-icon>
      Fine torneo / Reset
    </h2>
    <form (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="lead">Chiudi il torneo e riparti da zero per la prossima edizione.</p>
        <ul class="effects">
          <li>
            <mat-icon>event_busy</mat-icon>
            <span><strong>Calendario e risultati</strong> vengono eliminati</span>
          </li>
          <li>
            <mat-icon>sports_soccer</mat-icon>
            <span><strong>Goal</strong> di tutti i giocatori azzerati</span>
          </li>
          <li>
            <mat-icon>person_remove</mat-icon>
            <span>Tutti i giocatori diventano <strong>svincolati</strong></span>
          </li>
          <li class="keep">
            <mat-icon>shield</mat-icon>
            <span
              >Le <strong>squadre</strong> e i giocatori restano (con foto, overall e fascia)</span
            >
          </li>
        </ul>
        <p class="warning" id="reset-warning">
          <mat-icon>warning</mat-icon>
          L'operazione è irreversibile.
        </p>

        <mat-form-field class="password">
          <mat-label>Password amministratore</mat-label>
          <input
            #passwordInput
            matInput
            name="password"
            [type]="showPassword() ? 'text' : 'password'"
            [ngModel]="password()"
            (ngModelChange)="password.set($event); error.set(null)"
            autocomplete="current-password"
            aria-describedby="reset-warning"
            [disabled]="saving()"
            cdkFocusInitial
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="showPassword.update((v) => !v)"
            [attr.aria-label]="showPassword() ? 'Nascondi password' : 'Mostra password'"
          >
            <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint
            >Per confermare, inserisci la password con cui hai effettuato l'accesso</mat-hint
          >
        </mat-form-field>

        @if (error()) {
          <div class="error" role="alert"><mat-icon>error</mat-icon> {{ error() }}</div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="saving()">Annulla</button>
        <button
          mat-flat-button
          type="submit"
          class="btn-danger"
          [disabled]="!password() || saving()"
        >
          <mat-icon>restart_alt</mat-icon>
          {{ saving() ? 'Reset in corso…' : 'Azzera il torneo' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    mat-icon.danger {
      color: var(--danger);
    }
    .lead {
      margin: 0 0 12px;
      line-height: 1.5;
    }
    .effects {
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .effects li {
      display: flex;
      align-items: center;
      gap: 10px;
      line-height: 1.4;
    }
    .effects mat-icon {
      flex: none;
      color: var(--danger);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .effects li.keep mat-icon {
      color: var(--brand-accent-dark);
    }
    .warning {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 16px;
      font-weight: 700;
      color: var(--danger);
    }
    .warning mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .password {
      width: 100%;
    }
    .error {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--danger);
      background: #fdecec;
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      margin-top: 4px;
      font-size: 0.9rem;
    }
  `,
})
export class ResetDialog {
  private api = inject(TournamentService);
  private auth = inject(AuthService);
  private ref = inject(MatDialogRef<ResetDialog, TournamentResetResult>);
  private passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // sessione scaduta o logout mentre il dialog è aperto: non ha più senso restare qui
    effect(() => {
      if (!this.auth.isAdmin()) this.ref.close();
    });
  }

  /** Invia la richiesta di reset; in caso di errore il dialog resta aperto con il messaggio. */
  protected submit(): void {
    const password = this.password();
    if (!password || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    // durante la richiesta Esc e clic fuori non chiudono il dialog
    this.ref.disableClose = true;
    this.api.reset(password).subscribe({
      next: (res) => this.ref.close(res),
      error: (err: unknown) => {
        this.saving.set(false);
        this.ref.disableClose = false;
        if (err instanceof HttpErrorResponse && err.status === 401) return; // gestito dall'interceptor
        if (err instanceof HttpErrorResponse && err.status === 403) {
          // password errata: si svuota il campo per riprovare subito
          this.password.set('');
          this.error.set(apiErrorMessage(err, 'Password non corretta'));
        } else {
          this.error.set(apiErrorMessage(err, 'Reset non riuscito'));
        }
        // il campo torna abilitato al prossimo ciclo di rendering: focus dopo l'aggiornamento
        setTimeout(() => this.passwordInput().nativeElement.focus());
      },
    });
  }
}
