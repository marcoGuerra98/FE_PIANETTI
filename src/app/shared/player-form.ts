import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Player, PlayerInput, RUOLI, RUOLO_LABEL, Ruolo, Team } from '../core/models';
import { ImagePicker } from './image-picker';
import { RoleBadge } from './role-badge';

/** Valore emesso dal form giocatore. */
export interface PlayerFormValue {
  data: PlayerInput;
  /** File = nuova foto, null = rimuovi, undefined = invariata */
  photo: File | null | undefined;
}

/**
 * Form di creazione/modifica giocatore, condiviso tra creazione e modifica.
 * Non chiama le API: emette `saved` con i dati normalizzati e la foto scelta,
 * il salvataggio lo esegue la pagina.
 */
@Component({
  selector: 'app-player-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    ImagePicker,
    RoleBadge,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <app-image-picker
        label="Foto giocatore"
        shape="circle"
        placeholderIcon="person"
        [current]="player()?.foto"
        (changed)="photo = $event"
      />

      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="nome" autocomplete="off" />
          @if (form.controls.nome.hasError('required')) {
            <mat-error>Il nome è obbligatorio</mat-error>
          }
          @if (form.controls.nome.hasError('maxlength')) {
            <mat-error>Massimo 50 caratteri</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cognome</mat-label>
          <input matInput formControlName="cognome" autocomplete="off" />
          @if (form.controls.cognome.hasError('required')) {
            <mat-error>Il cognome è obbligatorio</mat-error>
          }
          @if (form.controls.cognome.hasError('maxlength')) {
            <mat-error>Massimo 50 caratteri</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ruolo</mat-label>
          <mat-select formControlName="ruolo">
            @for (r of ruoli; track r) {
              <mat-option [value]="r">
                <span class="role-opt"><app-role-badge [ruolo]="r" /> {{ label[r] }}</span>
              </mat-option>
            }
          </mat-select>
          <mat-error>Seleziona un ruolo</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Overall</mat-label>
          <input matInput type="number" formControlName="overall" min="1" max="99" />
          <mat-hint>Da 1 a 99</mat-hint>
          <mat-error>Inserisci un valore intero tra 1 e 99</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Squadra</mat-label>
          <mat-select formControlName="squadra_id">
            <mat-option [value]="null"><em>Svincolato</em></mat-option>
            @for (t of teams(); track t.id) {
              <mat-option [value]="t.id">{{ t.nome }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Descrizione</mat-label>
          <textarea matInput formControlName="descrizione" rows="4"></textarea>
          <mat-hint align="end">{{ form.controls.descrizione.value.length }}/1000</mat-hint>
          <mat-error>Massimo 1000 caratteri</mat-error>
        </mat-form-field>
      </div>

      <div class="form-actions">
        <button mat-button type="button" (click)="cancelled.emit()">Annulla</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          <mat-icon>save</mat-icon> {{ saving() ? 'Salvataggio…' : 'Salva' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .role-opt {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class PlayerForm {
  private fb = inject(NonNullableFormBuilder);

  /** giocatore da modificare; null in creazione */
  readonly player = input<Player | null>(null);
  /** squadre selezionabili */
  readonly teams = input<Team[]>([]);
  /** salvataggio in corso: disabilita il submit */
  readonly saving = input(false);
  /** squadra preselezionata in creazione (es. da dettaglio squadra) */
  readonly defaultTeamId = input<string | null>(null);
  /** submit valido */
  readonly saved = output<PlayerFormValue>();
  /** clic su "Annulla" */
  readonly cancelled = output<void>();

  protected readonly ruoli = RUOLI;
  protected readonly label = RUOLO_LABEL;
  /** ultima scelta dell'image picker (non fa parte del FormGroup) */
  protected photo: File | null | undefined = undefined;

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(50)]],
    cognome: ['', [Validators.required, Validators.maxLength(50)]],
    ruolo: this.fb.control<Ruolo | ''>('', Validators.required),
    overall: this.fb.control<number | null>(70, [
      Validators.required,
      Validators.min(1),
      Validators.max(99),
      Validators.pattern(/^\d+$/), // solo interi, come richiede il backend
    ]),
    squadra_id: this.fb.control<string | null>(null),
    descrizione: ['', Validators.maxLength(1000)],
  });

  constructor() {
    // Precompila il form quando arriva il giocatore; in creazione applica la squadra preselezionata.
    effect(() => {
      const p = this.player();
      if (p) {
        this.form.reset({
          nome: p.nome,
          cognome: p.cognome,
          ruolo: p.ruolo,
          overall: p.overall,
          squadra_id: p.squadra_id,
          descrizione: p.descrizione,
        });
      } else {
        this.form.controls.squadra_id.setValue(this.defaultTeamId());
      }
    });
  }

  /** Valida e, se il form è corretto, emette i dati ripuliti dagli spazi superflui. */
  protected submit(): void {
    if (this.form.invalid) {
      // mostra gli errori anche sui campi mai toccati
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saved.emit({
      data: {
        nome: v.nome.trim(),
        cognome: v.cognome.trim(),
        ruolo: v.ruolo as Ruolo,
        overall: Number(v.overall),
        squadra_id: v.squadra_id,
        descrizione: v.descrizione.trim(),
      },
      photo: this.photo,
    });
  }
}
