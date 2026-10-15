import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api';
import { Team } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { TeamsService } from '../../core/services/teams.service';
import { ErrorState, Loading } from '../../shared/states';
import { TeamForm, TeamFormValue } from '../../shared/team-form';

/** Creazione (/teams/new) e modifica (/teams/:id/edit) di una squadra. */
@Component({
  selector: 'app-team-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, TeamForm, Loading, ErrorState],
  template: `
    <div class="page narrow">
      <a mat-button [routerLink]="backLink()" class="back"><mat-icon>arrow_back</mat-icon> Indietro</a>
      <div class="page-header">
        <h1>{{ id() ? 'Modifica squadra' : 'Nuova squadra' }}</h1>
      </div>
      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()!" (retry)="ngOnInit()" />
      } @else {
        <div class="card card-padded">
          <app-team-form
            [team]="team()"
            [saving]="saving()"
            (saved)="save($event)"
            (cancelled)="router.navigateByUrl(backLink())"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 560px;
    }
    .back {
      margin: -6px 0 6px -8px;
    }
  `,
})
export class TeamEdit implements OnInit {
  private api = inject(TeamsService);
  private notify = inject(NotifyService);
  protected readonly router = inject(Router);

  /** parametro di route; assente in creazione */
  readonly id = input<string>();

  protected readonly team = signal<Team | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly backLink = computed(() => (this.id() ? `/teams/${this.id()}` : '/teams'));

  /** In modifica carica la squadra; in creazione non serve alcuna chiamata. */
  ngOnInit(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (t) => {
        this.team.set(t);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Squadra non trovata'));
        this.loading.set(false);
      },
    });
  }

  /**
   * Salva i dati e poi lo stemma (stessa logica di `PlayerEdit.savePhoto`):
   * l'upload richiede l'id, e un suo errore non annulla il salvataggio del nome.
   */
  protected save({ data, logo }: TeamFormValue): void {
    const id = this.id();
    this.saving.set(true);
    (id ? this.api.update(id, data) : this.api.create(data)).subscribe({
      next: (saved) => {
        let logo$: Observable<Team> = of(saved);
        if (logo instanceof File) logo$ = this.api.uploadLogo(saved.id, logo);
        else if (logo === null && saved.stemma) logo$ = this.api.deleteLogo(saved.id);
        logo$.pipe(finalize(() => this.router.navigate(['/teams', saved.id]))).subscribe({
          next: () => this.notify.success(id ? 'Squadra aggiornata' : 'Squadra creata'),
          error: (err) =>
            this.notify.error(`Dati salvati, ma lo stemma non è stato aggiornato: ${apiErrorMessage(err)}`),
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.apiError(err, 'Salvataggio non riuscito');
      },
    });
  }
}
