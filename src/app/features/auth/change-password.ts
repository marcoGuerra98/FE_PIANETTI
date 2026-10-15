import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { NotifyService } from '../../core/services/notify.service';

/** Validatore di gruppo: nuova password e conferma devono coincidere. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const n = group.get('newPassword')?.value;
  const c = group.get('confirm')?.value;
  return n && c && n !== c ? { mismatch: true } : null;
}

/**
 * Cambio password dell'amministratore (/account/password).
 * Il backend revoca i token precedenti e ne emette uno nuovo, che `AuthService` salva:
 * la sessione corrente resta attiva, le altre vengono disconnesse.
 */
@Component({
  selector: 'app-change-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page">
      <div class="card card-padded box">
        <h1>Cambia password</h1>
        <p class="muted">Dopo il cambio, le altre sessioni aperte verranno disconnesse.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>Password attuale</mat-label>
            <input matInput type="password" formControlName="current" autocomplete="current-password" />
            <mat-error>Inserisci la password attuale</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Nuova password</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
            <mat-hint>Almeno 8 caratteri</mat-hint>
            <mat-error>La password deve avere almeno 8 caratteri</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Conferma nuova password</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
            <mat-error>Conferma la nuova password</mat-error>
          </mat-form-field>
          @if (form.hasError('mismatch') && form.controls.confirm.touched) {
            <p class="error">Le due password non coincidono</p>
          }
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="form-actions">
            <button mat-button type="button" (click)="location.back()">Annulla</button>
            <button mat-flat-button type="submit" [disabled]="saving()">
              <mat-icon>key</mat-icon> {{ saving() ? 'Salvataggio…' : 'Aggiorna password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: `
    .box {
      max-width: 440px;
      margin: 24px auto;
    }
    h1 {
      margin: 0 0 4px;
      color: var(--brand-navy);
      font-size: 1.35rem;
    }
    form {
      display: flex;
      flex-direction: column;
      margin-top: 16px;
    }
    .error {
      color: var(--danger);
      margin: 0 0 8px;
      font-size: 0.9rem;
    }
  `,
})
export class ChangePasswordPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  protected readonly location = inject(Location);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      current: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  /** Valida il form e invia la richiesta; gli errori del server sono mostrati nel form. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { current, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(current, newPassword).subscribe({
      next: () => {
        this.notify.success('Password aggiornata');
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.saving.set(false);
        // 422 = password attuale errata o nuova non valida: messaggio mostrato nel form
        this.error.set(apiErrorMessage(err, 'Aggiornamento non riuscito'));
      },
    });
  }
}
