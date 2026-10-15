import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, filter, finalize, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FASE_LABEL, Fase, Giornata, Marcatore, Match, Schedule, Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { TeamsService } from '../../core/services/teams.service';
import { ConfirmService } from '../../shared/confirm-dialog';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';
import { MatchEditData, MatchEditDialog } from './match-edit-dialog';
import { ResultDialog } from './result-dialog';

/** Etichette brevi delle giornate a eliminazione diretta nel selettore. */
const SHORT_FASE: Record<Fase, string> = {
  GIRONE: '',
  SEMIFINALE: 'SF',
  FINALE_3_4: 'F',
  FINALE_1_2: 'F',
};

/**
 * Calendario (/calendar): navigazione per giornata, partite con risultati e marcatori.
 * Per l'amministratore: generazione/rigenerazione ed eliminazione del calendario,
 * modifica delle partite, inserimento e annullamento dei risultati.
 */
@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TeamCrest,
    Loading,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class CalendarPage implements OnInit {
  private api = inject(ScheduleService);
  private teamsApi = inject(TeamsService);
  private dialog = inject(MatDialog);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  protected readonly auth = inject(AuthService);

  protected readonly schedule = signal<Schedule | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  /** generazione/eliminazione in corso: disabilita il pulsante principale */
  protected readonly busy = signal(false);

  protected readonly giornate = computed(() => this.schedule()?.giornate ?? []);

  /**
   * Giornata selezionata: di default la prima con partite da giocare (o l'ultima se tutte giocate).
   * `linkedSignal` la ricalcola a ogni ricarica del calendario ma resta scrivibile dall'utente:
   * `computation` riceve la selezione precedente e la conserva se la giornata esiste ancora,
   * così salvare un risultato non riporta l'utente a un'altra giornata.
   * Impostarla a `null` prima di ricaricare forza di nuovo la scelta automatica.
   */
  protected readonly selected = linkedSignal<Giornata[], number | null>({
    source: this.giornate,
    computation: (days, previous) => {
      if (!days.length) return null;
      if (previous?.value != null && days.some((d) => d.giornata === previous.value)) return previous.value;
      return (days.find((d) => d.partite.some((m) => !m.giocata)) ?? days[days.length - 1]).giornata;
    },
  });

  /** giornata mostrata */
  protected readonly current = computed(() => this.giornate().find((d) => d.giornata === this.selected()) ?? null);
  /** true se esistono già partite della fase finale */
  protected readonly hasKnockout = computed(() => this.giornate().some((d) => d.fase !== 'GIRONE'));

  protected readonly faseLabel = FASE_LABEL;

  private readonly dayList = viewChild<ElementRef<HTMLElement>>('dayList');

  constructor() {
    // tiene visibile la giornata selezionata nella barra scorrevole (mobile);
    // afterRenderEffect agisce dopo il rendering, quando il pulsante della giornata esiste nel DOM
    afterRenderEffect(() => {
      const list = this.dayList()?.nativeElement;
      const day = this.selected();
      list
        ?.querySelector<HTMLElement>(`[data-day="${day}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }

  /** true se il calendario contiene partite della fase indicata (per i segnaposto SF/F). */
  protected hasPhase(fase: Fase): boolean {
    return this.giornate().some((d) => d.partite.some((m) => m.fase === fase));
  }

  ngOnInit(): void {
    this.load();
  }

  /**
   * Carica il calendario. Lo stato di caricamento a pagina intera compare solo al primo
   * caricamento: le ricariche successive aggiornano i dati senza far sparire la vista.
   */
  protected load(): void {
    this.loading.set(!this.schedule());
    this.error.set(false);
    this.api.get().subscribe({
      next: (s) => {
        this.schedule.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Etichetta breve nel selettore: numero di giornata, "SF" o "F". */
  protected dayLabel(d: Giornata): string {
    return d.fase === 'GIRONE' ? String(d.giornata) : SHORT_FASE[d.fase];
  }

  /** Titolo esteso della giornata (anche `aria-label` del selettore). */
  protected dayTitle(d: Giornata): string {
    if (d.fase === 'GIRONE') return `Giornata ${d.giornata}`;
    return d.fase === 'SEMIFINALE' ? 'Semifinali' : 'Finali';
  }

  protected dayComplete(d: Giornata): boolean {
    return d.partite.every((m) => m.giocata);
  }

  protected selectDay(d: Giornata): void {
    this.selected.set(d.giornata);
  }

  /** Passa alla giornata precedente (-1) o successiva (+1), se esiste. */
  protected step(delta: number): void {
    const days = this.giornate();
    const i = days.findIndex((d) => d.giornata === this.selected());
    const next = days[i + delta];
    if (next) this.selected.set(next.giornata);
  }

  /**
   * Marcatori di un lato della partita. Gli autogol hanno `squadra_id` della squadra che
   * beneficia del gol, quindi compaiono dal lato giusto senza logica aggiuntiva.
   */
  protected scorersOf(m: Match, side: 'casa' | 'trasferta'): Marcatore[] {
    const teamId = side === 'casa' ? m.squadra_casa_id : m.squadra_trasferta_id;
    return m.marcatori.filter((mk) => mk.squadra_id === teamId);
  }

  /** Nome della squadra vincitrice ai rigori, se presente. */
  protected penaltyWinner(m: Match): string | null {
    if (!m.vincitore_rigori_id) return null;
    return m.vincitore_rigori_id === m.squadra_casa_id ? m.squadra_casa_nome : m.squadra_trasferta_nome;
  }

  /** Lato vincente (anche ai rigori) per evidenziarlo; null per pareggio o partita da giocare. */
  protected winnerSide(m: Match): 'casa' | 'trasferta' | null {
    if (!m.giocata) return null;
    if (m.gol_casa! > m.gol_trasferta!) return 'casa';
    if (m.gol_trasferta! > m.gol_casa!) return 'trasferta';
    if (m.vincitore_rigori_id) return m.vincitore_rigori_id === m.squadra_casa_id ? 'casa' : 'trasferta';
    return null;
  }

  // --- Azioni admin ---

  /**
   * Genera il calendario. Prima conferma: spiegazione del formato del torneo.
   * Se esiste già un calendario il backend risponde 409 e `withConflictConfirm`
   * chiede una seconda conferma prima di rigenerare con `confirm=true`.
   */
  protected generate(): void {
    const exists = (this.schedule()?.totale_partite ?? 0) > 0;
    this.confirm
      .ask({
        title: exists ? 'Rigenera calendario' : 'Genera calendario',
        message:
          'Verrà creato il girone unico (sola andata) tra tutte le squadre iscritte. ' +
          'Al termine del girone le semifinali (1ª-4ª, 2ª-3ª) e poi le finali verranno create automaticamente.',
        confirmText: 'Genera',
        icon: 'calendar_month',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.withConflictConfirm(this.api.generate(false), () => this.api.generate(true), 'Rigenera')),
      )
      .subscribe(() => {
        // nuovo calendario: si torna alla scelta automatica della giornata
        this.selected.set(null);
        this.notify.success('Calendario generato');
        this.load();
      });
  }

  /** Elimina il calendario con lo stesso schema a doppia conferma della generazione. */
  protected deleteSchedule(): void {
    this.confirm
      .ask({
        title: 'Elimina calendario',
        message: 'Tutte le partite verranno eliminate.',
        confirmText: 'Continua',
        danger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.withConflictConfirm(this.api.delete(false), () => this.api.delete(true), 'Elimina')),
      )
      .subscribe(() => {
        this.notify.success('Calendario eliminato');
        this.load();
      });
  }

  /**
   * Esegue `first$`; su 409 il backend spiega cosa si perderebbe (`detail`) e si chiede
   * una seconda conferma esplicita, dopo la quale si esegue `forced()` (stessa chiamata con
   * `confirm=true`). Se l'utente annulla lo stream completa senza emettere.
   * Gli altri errori sono notificati con un toast e non arrivano al chiamante.
   * Gestisce anche lo stato `busy` per tutta la durata del flusso.
   * @param first$ chiamata senza conferma
   * @param forced fabbrica della chiamata forzata, invocata solo se serve
   * @param confirmText testo del pulsante della seconda conferma
   */
  private withConflictConfirm<T>(first$: Observable<T>, forced: () => Observable<T>, confirmText: string): Observable<T> {
    this.busy.set(true);
    return first$.pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          return this.confirm
            .ask({
              title: 'Attenzione',
              message: err.error?.detail ?? 'Esiste già un calendario.',
              confirmText,
              danger: true,
            })
            .pipe(
              filter(Boolean),
              switchMap(() => forced()),
            );
        }
        return throwError(() => err);
      }),
      catchError((err) => {
        this.notify.apiError(err);
        return EMPTY;
      }),
      finalize(() => this.busy.set(false)),
    );
  }

  /** Apre la modifica della partita; le squadre servono per le select e si caricano al momento. */
  protected editMatch(m: Match): void {
    this.teamsApi.list().subscribe({
      next: (teams: Team[]) => {
        this.dialog
          .open<MatchEditDialog, MatchEditData, Match>(MatchEditDialog, {
            data: { match: m, teams },
            width: '560px',
            maxWidth: 'calc(100vw - 32px)',
          })
          .afterClosed()
          .pipe(filter(Boolean))
          .subscribe((updated) => {
            this.notify.success('Partita aggiornata');
            // segue la partita se è stata spostata in un'altra giornata
            this.selected.set(updated.giornata);
            this.load();
          });
      },
      error: (err) => this.notify.apiError(err),
    });
  }

  /** Apre il dialog del risultato; ricarica il calendario solo se il risultato è stato salvato. */
  protected editResult(m: Match): void {
    this.dialog
      .open<ResultDialog, Match, Match>(ResultDialog, {
        data: m,
        width: '720px',
        maxWidth: 'calc(100vw - 24px)',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.notify.success('Risultato salvato');
        this.load();
      });
  }

  /** Annulla il risultato dopo conferma: la partita torna da giocare e i goal vengono stornati. */
  protected clearResult(m: Match): void {
    this.confirm
      .ask({
        title: 'Annulla risultato',
        message: `Il risultato di ${m.squadra_casa_nome} - ${m.squadra_trasferta_nome} e i relativi goal verranno rimossi.`,
        confirmText: 'Annulla risultato',
        cancelText: 'Indietro',
        danger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.clearResult(m.id)),
      )
      .subscribe({
        next: () => {
          this.notify.success('Risultato annullato');
          this.load();
        },
        error: (err) => this.notify.apiError(err),
      });
  }
}
