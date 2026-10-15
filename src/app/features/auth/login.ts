import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { NotifyService } from '../../core/services/notify.service';

/** Login amministratore (/login); al termine torna alla pagina indicata da `returnUrl`. */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page">
      <div class="card login">
        <div class="head">
          <span class="icon"><mat-icon>admin_panel_settings</mat-icon></span>
          <h1>Area amministratore</h1>
          <p class="muted">Accedi per gestire giocatori, squadre, calendario e risultati.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" autocomplete="username" />
            <mat-error>Inserisci lo username</mat-error>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Password</mat-label>
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
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
            <mat-error>Inserisci la password</mat-error>
          </mat-form-field>

          @if (error()) {
            <div class="error" role="alert"><mat-icon>error</mat-icon> {{ error() }}</div>
          }

          <button mat-flat-button type="submit" class="submit" [disabled]="loading()">
            {{ loading() ? 'Accesso in corso…' : 'Accedi' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: `
    .login {
      max-width: 400px;
      margin: 32px auto;
      padding: 28px 24px;
    }
    .head {
      text-align: center;
      margin-bottom: 20px;
    }
    .icon {
      display: inline-grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--brand-navy);
      color: var(--brand-accent);
    }
    h1 {
      margin: 12px 0 4px;
      font-size: 1.35rem;
      color: var(--brand-navy);
    }
    form {
      display: flex;
      flex-direction: column;
    }
    .error {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--danger);
      background: #fdecec;
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 0.9rem;
    }
    .submit {
      height: 46px;
    }
  `,
})
export class LoginPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  /** dalla query string (?returnUrl=…) grazie a withComponentInputBinding */
  readonly returnUrl = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** Valida, esegue il login e naviga alla destinazione; in caso di errore svuota la password. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        this.notify.success('Accesso effettuato');
        const target = this.returnUrl();
        // solo percorsi interni, per evitare open redirect
        this.router.navigateByUrl(target?.startsWith('/') && !target.startsWith('//') ? target : '/');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.form.controls.password.reset();
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 401
            ? 'Credenziali non valide'
            : apiErrorMessage(err, 'Accesso non riuscito'),
        );
      },
    });
  }
}
