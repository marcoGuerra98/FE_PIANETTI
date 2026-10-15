import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { apiErrorMessage } from '../../core/api';
import { FASE_LABEL, Match, MatchUpdate, Team } from '../../core/models';
import { ScheduleService } from '../../core/services/schedule.service';

/** Dati passati al dialog: la partita e le squadre selezionabili. */
export interface MatchEditData {
  match: Match;
  teams: Team[];
}

/** Validatore di gruppo: casa e trasferta devono essere squadre diverse. */
function differentTeams(group: AbstractControl): ValidationErrors | null {
  const h = group.get('casa')?.value;
  const a = group.get('trasferta')?.value;
  return h && a && h === a ? { sameTeam: true } : null;
}

/**
 * Modifica data/ora, squadre e giornata di una partita.
 * Nella fase finale si può cambiare solo la data (accoppiamenti decisi dalla classifica);
 * nelle partite già giocate del girone le squadre sono bloccate.
 * Si chiude con la partita aggiornata, o senza valore se non c'era nulla da salvare.
 */
@Component({
  selector: 'app-match-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Modifica partita</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        @if (knockout) {
          <p class="info">
            <mat-icon>info</mat-icon>
            {{ faseLabel }}: squadre e giornata sono determinate dalla classifica, puoi modificare solo data e ora.
          </p>
        }
        <div class="form-grid">
          <mat-form-field class="full">
            <mat-label>Data e ora</mat-label>
            <input matInput type="datetime-local" formControlName="dataOra" />
            @if (form.controls.dataOra.value) {
              <button mat-icon-button matSuffix type="button" (click)="form.controls.dataOra.setValue('')" aria-label="Rimuovi data">
                <mat-icon>close</mat-icon>
              </button>
            }
            <mat-hint>Lascia vuoto se ancora da definire</mat-hint>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Squadra in casa</mat-label>
            <mat-select formControlName="casa">
              @for (t of data.teams; track t.id) {
                <mat-option [value]="t.id">{{ t.nome }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Squadra in trasferta</mat-label>
            <mat-select formControlName="trasferta">
              @for (t of data.teams; track t.id) {
                <mat-option [value]="t.id">{{ t.nome }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Giornata</mat-label>
            <input matInput type="number" min="1" formControlName="giornata" />
            <mat-error>Inserisci un numero di giornata valido</mat-error>
          </mat-form-field>
        </div>
        @if (form.hasError('sameTeam')) {
          <p class="error">Le due squadre devono essere diverse</p>
        }
        @if (data.match.giocata && !knockout) {
          <p class="hint">Partita già giocata: per cambiare le squadre annulla prima il risultato.</p>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ saving() ? 'Salvataggio…' : 'Salva' }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .info {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      background: #eef5ff;
      color: var(--brand-navy-2);
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      margin: 0 0 16px;
      font-size: 0.88rem;
    }
    .error {
      color: var(--danger);
      margin: 4px 0 0;
    }
    .hint {
      color: var(--muted);
      font-size: 0.85rem;
      margin: 4px 0 0;
    }
  `,
})
export class MatchEditDialog {
  protected readonly data = inject<MatchEditData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<MatchEditDialog, Match>);
  private api = inject(ScheduleService);
  private fb = inject(NonNullableFormBuilder);

  protected readonly knockout = this.data.match.fase !== 'GIRONE';
  protected readonly faseLabel = FASE_LABEL[this.data.match.fase];
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      // "YYYY-MM-DDTHH:mm": formato richiesto da <input type="datetime-local">
      dataOra: [this.data.match.data_ora?.slice(0, 16) ?? ''],
      casa: [this.data.match.squadra_casa_id, Validators.required],
      trasferta: [this.data.match.squadra_trasferta_id, Validators.required],
      giornata: [this.data.match.giornata, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    },
    { validators: differentTeams },
  );

  constructor() {
    if (this.knockout) {
      this.form.controls.casa.disable();
      this.form.controls.trasferta.disable();
      this.form.controls.giornata.disable();
    } else if (this.data.match.giocata) {
      this.form.controls.casa.disable();
      this.form.controls.trasferta.disable();
    }
  }

  /** Invia solo le differenze rispetto alla partita originale; senza modifiche chiude il dialog. */
  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const m = this.data.match;
    const v = this.form.getRawValue();
    // si inviano solo i campi modificati
    const patch: MatchUpdate = {};
    // il backend si aspetta ISO senza fuso con i secondi; stringa vuota = data da definire
    const dataOra = v.dataOra ? `${v.dataOra}:00` : null;
    if ((m.data_ora?.slice(0, 16) ?? '') !== v.dataOra) patch.data_ora = dataOra;
    if (!this.knockout) {
      if (v.casa !== m.squadra_casa_id) patch.squadra_casa_id = v.casa;
      if (v.trasferta !== m.squadra_trasferta_id) patch.squadra_trasferta_id = v.trasferta;
      if (Number(v.giornata) !== m.giornata) patch.giornata = Number(v.giornata);
    }
    if (!Object.keys(patch).length) {
      this.ref.close();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.updateMatch(m.id, patch).subscribe({
      next: (updated) => this.ref.close(updated),
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Modifica non riuscita'));
      },
    });
  }
}
