import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Team, TeamInput } from '../core/models';
import { ImagePicker } from './image-picker';

/** Valore emesso dal form squadra. */
export interface TeamFormValue {
  data: TeamInput;
  /** File = nuovo stemma, null = rimuovi, undefined = invariato */
  logo: File | null | undefined;
}

/** Form di creazione/modifica squadra (nome e stemma); come `PlayerForm`, emette senza salvare. */
@Component({
  selector: 'app-team-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, ImagePicker],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <app-image-picker
        label="Stemma"
        placeholderIcon="shield"
        [current]="team()?.stemma"
        (changed)="logo = $event"
      />
      <mat-form-field appearance="outline" class="name">
        <mat-label>Nome squadra</mat-label>
        <input matInput formControlName="nome" autocomplete="off" />
        <mat-hint>Deve essere univoco</mat-hint>
        @if (form.controls.nome.hasError('required')) {
          <mat-error>Il nome è obbligatorio</mat-error>
        }
        @if (form.controls.nome.hasError('maxlength')) {
          <mat-error>Massimo 60 caratteri</mat-error>
        }
      </mat-form-field>
      <div class="form-actions">
        <button mat-button type="button" (click)="cancelled.emit()">Annulla</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <mat-icon>save</mat-icon> {{ saving() ? 'Salvataggio…' : 'Salva' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .name {
      width: 100%;
    }
  `,
})
export class TeamForm {
  private fb = inject(NonNullableFormBuilder);

  /** squadra da modificare; null in creazione */
  readonly team = input<Team | null>(null);
  /** salvataggio in corso: disabilita il submit */
  readonly saving = input(false);
  /** submit valido */
  readonly saved = output<TeamFormValue>();
  /** clic su "Annulla" */
  readonly cancelled = output<void>();

  /** ultima scelta dell'image picker (non fa parte del FormGroup) */
  protected logo: File | null | undefined = undefined;
  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(60)]],
  });

  constructor() {
    // precompila il nome quando arriva la squadra da modificare
    effect(() => {
      const t = this.team();
      if (t) this.form.reset({ nome: t.nome });
    });
  }

  /** Valida e, se il form è corretto, emette il nome ripulito e lo stemma scelto. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit({ data: { nome: this.form.getRawValue().nome.trim() }, logo: this.logo });
  }
}
