import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { Player, Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { PlayerForm, PlayerFormValue } from '../../shared/player-form';
import { ErrorState, Loading } from '../../shared/states';

/** Creazione (/players/new) e modifica (/players/:id/edit) di un giocatore. */
@Component({
  selector: 'app-player-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, PlayerForm, Loading, ErrorState],
  template: `
    <div class="page narrow">
      <a mat-button [routerLink]="backLink()" class="back"><mat-icon>arrow_back</mat-icon> Indietro</a>
      <div class="page-header">
        <h1>{{ id() ? 'Modifica giocatore' : 'Nuovo giocatore' }}</h1>
      </div>
      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()!" (retry)="ngOnInit()" />
      } @else {
        <div class="card card-padded">
          <app-player-form
            [player]="player()"
            [teams]="teams()"
            [saving]="saving()"
            [defaultTeamId]="squadra() ?? null"
            (saved)="save($event)"
            (cancelled)="router.navigateByUrl(backLink())"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 760px;
    }
    .back {
      margin: -6px 0 6px -8px;
    }
  `,
})
export class PlayerEdit implements OnInit {
  private playersApi = inject(PlayersService);
  private teamsApi = inject(TeamsService);
  private notify = inject(NotifyService);
  protected readonly router = inject(Router);

  /** parametro di route; assente in creazione */
  readonly id = input<string>();
  /** query param opzionale ?squadra=<id> per preselezionare la squadra */
  readonly squadra = input<string>();

  protected readonly player = signal<Player | null>(null);
  protected readonly teams = signal<Team[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly backLink = computed(() => (this.id() ? `/players/${this.id()}` : '/players'));

  /** Carica in parallelo le squadre (per la select) e, in modifica, il giocatore. */
  ngOnInit(): void {
    const id = this.id();
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      teams: this.teamsApi.list(),
      player: id ? this.playersApi.get(id) : of(null),
    }).subscribe({
      next: ({ teams, player }) => {
        this.teams.set(teams);
        this.player.set(player);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Impossibile caricare i dati'));
        this.loading.set(false);
      },
    });
  }

  /** Crea o aggiorna i dati, poi passa alla gestione della foto. */
  protected save({ data, photo }: PlayerFormValue): void {
    const id = this.id();
    this.saving.set(true);
    const save$ = id ? this.playersApi.update(id, data) : this.playersApi.create(data);

    save$.subscribe({
      next: (saved) => this.savePhoto(saved, photo, !id),
      error: (err) => {
        this.saving.set(false);
        this.notify.apiError(err, 'Salvataggio non riuscito');
      },
    });
  }

  /**
   * Gestisce la foto dopo il salvataggio dei dati, perché in creazione l'id esiste solo ora.
   * - `File`: upload della nuova foto;
   * - `null`: rimozione, solo se il giocatore ne aveva una;
   * - `undefined`: nessuna chiamata.
   * Un errore sulla foto non annulla il salvataggio dei dati: si segnala con un toast dedicato.
   * In ogni caso (`finalize`) si naviga al dettaglio del giocatore.
   * @param created true se il giocatore è stato appena creato (cambia il messaggio di conferma)
   */
  private savePhoto(saved: Player, photo: File | null | undefined, created: boolean): void {
    let photo$: Observable<Player> = of(saved);
    if (photo instanceof File) photo$ = this.playersApi.uploadPhoto(saved.id, photo);
    else if (photo === null && saved.foto) photo$ = this.playersApi.deletePhoto(saved.id);

    photo$.pipe(finalize(() => this.router.navigate(['/players', saved.id]))).subscribe({
      next: () => this.notify.success(created ? 'Giocatore creato' : 'Giocatore aggiornato'),
      error: (err) => this.notify.error(`Dati salvati, ma la foto non è stata aggiornata: ${apiErrorMessage(err)}`),
    });
  }
}
