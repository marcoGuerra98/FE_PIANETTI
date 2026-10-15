import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, startWith } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { FASE_LABEL, MarcatoreInput, Match, Player, ResultInput, Ruolo } from '../../core/models';
import { PlayersService } from '../../core/services/players.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { RoleBadge } from '../../shared/role-badge';
import { Loading } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';

/** Lato della partita. */
type Side = 'casa' | 'trasferta';

/**
 * Valore speciale nella select dei marcatori: autogol a favore di quel lato.
 * Nel form ogni riga ha un solo campo `giocatore_id`; questo valore sentinella (che non può
 * coincidere con un UUID) distingue l'autogol, convertito da `toInput` nel formato delle API.
 * Come ogni opzione può essere scelto in una sola riga per lato (`availableOptions`):
 * più autogol a favore della stessa squadra si esprimono aumentando il campo "Gol".
 */
const OWN_GOAL = '__autogol__';

/** Opzione della select marcatori. */
interface ScorerOption {
  id: string;
  label: string;
  /** null per l'autogol e per gli ex giocatori della squadra */
  ruolo: Ruolo | null;
}

/** Riga marcatore del FormArray: giocatore (o `OWN_GOAL`) e numero di goal. */
type ScorerGroup = FormGroup<{ giocatore_id: FormControl<string>; goal: FormControl<number> }>;

/**
 * Inserimento/modifica del risultato con marcatori (e vincitore ai rigori nella fase finale).
 * I marcatori sono due FormArray, uno per lato; la somma dei loro goal è confrontata in tempo
 * reale con il punteggio (contatore verde/rosso) e verificata di nuovo al salvataggio.
 * Si chiude con la partita aggiornata restituita dal backend.
 */
@Component({
  selector: 'app-result-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatTooltipModule,
    TeamCrest,
    RoleBadge,
    Loading,
  ],
  templateUrl: './result-dialog.html',
  styleUrl: './result-dialog.scss',
})
export class ResultDialog implements OnInit {
  protected readonly match = inject<Match>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ResultDialog, Match>);
  private scheduleApi = inject(ScheduleService);
  private playersApi = inject(PlayersService);
  private fb = inject(NonNullableFormBuilder);

  protected readonly knockout = this.match.fase !== 'GIRONE';
  protected readonly faseLabel = FASE_LABEL[this.match.fase];
  protected readonly sides: Side[] = ['casa', 'trasferta'];
  protected readonly ownGoal = OWN_GOAL;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** opzioni della select marcatori per lato, costruite da `buildOptions` */
  protected readonly options = signal<Record<Side, ScorerOption[]>>({ casa: [], trasferta: [] });

  protected readonly form = this.fb.group({
    gol_casa: [this.match.gol_casa ?? 0, [Validators.required, Validators.min(0), Validators.max(99)]],
    gol_trasferta: [this.match.gol_trasferta ?? 0, [Validators.required, Validators.min(0), Validators.max(99)]],
    casa: this.fb.array<ScorerGroup>([]),
    trasferta: this.fb.array<ScorerGroup>([]),
    // id della squadra vincitrice ai rigori; usato solo se `needsPenalties()`
    rigori: [this.match.vincitore_rigori_id ?? ''],
  });

  // Valore del form come signal: i computed sotto si aggiornano a ogni modifica, anche
  // quando si aggiungono o rimuovono righe dai FormArray.
  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** somma dei goal dei marcatori per lato, per il controllo in tempo reale */
  protected readonly sums = computed(() => {
    const v = this.value();
    const sum = (rows: { goal?: number }[] | undefined) => (rows ?? []).reduce((s, r) => s + (Number(r.goal) || 0), 0);
    return { casa: sum(v.casa), trasferta: sum(v.trasferta) };
  });
  /** punteggio inserito; valori non numerici contano come 0 */
  protected readonly score = computed(() => ({
    casa: Number(this.value().gol_casa) || 0,
    trasferta: Number(this.value().gol_trasferta) || 0,
  }));
  protected readonly isDraw = computed(() => this.score().casa === this.score().trasferta);
  /** i rigori servono solo nella fase finale in caso di parità */
  protected readonly needsPenalties = computed(() => this.knockout && this.isDraw());

  /** Carica le rose delle due squadre e ricostruisce le righe dei marcatori già registrati. */
  ngOnInit(): void {
    const m = this.match;
    forkJoin({
      casa: this.playersApi.list({ squadra_id: m.squadra_casa_id, sort: 'nome' }),
      trasferta: this.playersApi.list({ squadra_id: m.squadra_trasferta_id, sort: 'nome' }),
    }).subscribe({
      next: (rosters) => {
        this.options.set({
          casa: this.buildOptions(rosters.casa, m.squadra_casa_id),
          trasferta: this.buildOptions(rosters.trasferta, m.squadra_trasferta_id),
        });
        for (const mk of m.marcatori) {
          // `squadra_id` è la squadra a cui è assegnato il gol (per l'autogol: chi ne beneficia)
          const side: Side = mk.squadra_id === m.squadra_casa_id ? 'casa' : 'trasferta';
          this.array(side).push(this.scorerGroup(mk.autogol ? OWN_GOAL : mk.giocatore_id!, mk.goal));
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Impossibile caricare le rose'));
        this.loading.set(false);
      },
    });
  }

  /**
   * Costruisce le opzioni marcatore di un lato, nell'ordine:
   * 1. autogol (gol a favore di questa squadra segnato da un avversario);
   * 2. rosa attuale della squadra, ordinata per cognome;
   * 3. marcatori già registrati per questa squadra che nel frattempo hanno cambiato squadra,
   *    marcati "(ex)": senza di loro la select non saprebbe mostrare il valore salvato
   *    e la modifica di un vecchio risultato perderebbe quei goal.
   */
  private buildOptions(roster: Player[], teamId: string): ScorerOption[] {
    const opts: ScorerOption[] = [
      { id: OWN_GOAL, label: 'Autogol avversario', ruolo: null },
      ...roster.map((p) => ({ id: p.id, label: `${p.cognome} ${p.nome}`, ruolo: p.ruolo })),
    ];
    for (const mk of this.match.marcatori) {
      if (mk.giocatore_id && mk.squadra_id === teamId && !opts.some((o) => o.id === mk.giocatore_id)) {
        const name = [mk.giocatore_cognome, mk.giocatore_nome].filter(Boolean).join(' ') || 'Giocatore';
        opts.push({ id: mk.giocatore_id, label: `${name} (ex)`, ruolo: null });
      }
    }
    return opts;
  }

  /** FormArray dei marcatori di un lato. */
  protected array(side: Side): FormArray<ScorerGroup> {
    return this.form.controls[side];
  }

  /** Nome della squadra di un lato. */
  protected teamName(side: Side): string {
    return (side === 'casa' ? this.match.squadra_casa_nome : this.match.squadra_trasferta_nome) ?? '';
  }

  /** Stemma della squadra di un lato. */
  protected teamCrest(side: Side): string | null {
    return side === 'casa' ? this.match.squadra_casa_stemma : this.match.squadra_trasferta_stemma;
  }

  /** giocatori non ancora scelti in un'altra riga dello stesso lato */
  protected availableOptions(side: Side, index: number): ScorerOption[] {
    const taken = new Set(
      this.array(side)
        .getRawValue()
        .filter((_, i) => i !== index)
        .map((r) => r.giocatore_id),
    );
    return this.options()[side].filter((o) => !taken.has(o.id));
  }

  /** Ruolo del giocatore scelto in una riga (null per autogol ed ex giocatori). */
  protected roleOf(side: Side, id: string): Ruolo | null {
    return this.options()[side].find((o) => o.id === id)?.ruolo ?? null;
  }

  /** Aggiunge una riga vuota con 1 goal. */
  protected addScorer(side: Side): void {
    this.array(side).push(this.scorerGroup('', 1));
  }

  /** Rimuove una riga marcatore. */
  protected removeScorer(side: Side, index: number): void {
    this.array(side).removeAt(index);
  }

  /** Crea una riga marcatore (goal tra 1 e 50). */
  private scorerGroup(id: string, goal: number): ScorerGroup {
    return this.fb.group({
      giocatore_id: [id, Validators.required],
      goal: [goal, [Validators.required, Validators.min(1), Validators.max(50)]],
    });
  }

  /**
   * Salva il risultato dopo tre controlli, in ordine: campi validi, somma dei marcatori
   * uguale al punteggio di ciascun lato, vincitore ai rigori se richiesto.
   * Gli errori sono mostrati nel dialog (`role="alert"`), che resta aperto.
   */
  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa i campi evidenziati');
      return;
    }
    const s = this.score();
    const sums = this.sums();
    if (sums.casa !== s.casa || sums.trasferta !== s.trasferta) {
      this.error.set('La somma dei goal dei marcatori deve coincidere con il punteggio di ciascuna squadra');
      return;
    }
    const v = this.form.getRawValue();
    if (this.needsPenalties() && !v.rigori) {
      this.error.set('Partita della fase finale in parità: indica chi ha vinto ai rigori');
      return;
    }
    const body: ResultInput = {
      gol_casa: s.casa,
      gol_trasferta: s.trasferta,
      marcatori: [
        ...v.casa.map((r) => this.toInput(r, this.match.squadra_casa_id)),
        ...v.trasferta.map((r) => this.toInput(r, this.match.squadra_trasferta_id)),
      ],
      // un valore residuo (es. punteggio cambiato da pari a non pari) non deve essere inviato
      vincitore_rigori_id: this.needsPenalties() ? v.rigori : null,
    };
    this.saving.set(true);
    this.error.set(null);
    this.scheduleApi.setResult(this.match.id, body).subscribe({
      next: (m) => this.ref.close(m),
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito'));
      },
    });
  }

  /**
   * Converte una riga del form nel formato `MarcatoreInput` delle API:
   * - giocatore: `{ giocatore_id, goal }` (la squadra la ricava il backend);
   * - `OWN_GOAL`: `{ autogol: true, squadra_id, goal }`, dove `squadra_id` è la squadra del lato
   *   in cui la riga è inserita, cioè quella che beneficia dell'autogol.
   */
  private toInput(row: { giocatore_id: string; goal: number }, teamId: string): MarcatoreInput {
    const goal = Number(row.goal);
    return row.giocatore_id === OWN_GOAL
      ? { autogol: true, squadra_id: teamId, goal }
      : { giocatore_id: row.giocatore_id, goal };
  }
}
