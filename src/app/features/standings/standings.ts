import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ScorerRow, StandingRow } from '../../core/models';
import { StandingsService } from '../../core/services/standings.service';
import { Avatar } from '../../shared/avatar';
import { CellDef, DataTable, TableColumn } from '../../shared/data-table';
import { RoleBadge } from '../../shared/role-badge';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { TeamCrest } from '../../shared/team-crest';

/** Posti che danno accesso alla fase finale (semifinali 1ª-4ª e 2ª-3ª). */
const FINAL_PHASE_SPOTS = 4;

/** Classifiche (/standings, home page): tab squadre e tab marcatori. */
@Component({
  selector: 'app-standings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatTabsModule,
    MatIconModule,
    DataTable,
    CellDef,
    TeamCrest,
    Avatar,
    RoleBadge,
    Loading,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './standings.html',
  styleUrl: './standings.scss',
})
export class StandingsPage implements OnInit {
  private api = inject(StandingsService);
  private router = inject(Router);

  protected readonly standings = signal<StandingRow[]>([]);
  protected readonly scorers = signal<ScorerRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly standingColumns: TableColumn<StandingRow>[] = [
    { key: 'posizione', header: '#', align: 'center', width: '44px' },
    { key: 'squadra', header: 'Squadra' },
    { key: 'punti', header: 'Pt', align: 'center', strong: true, title: 'Punti' },
    { key: 'giocate', header: 'G', align: 'center', title: 'Giocate' },
    { key: 'vinte', header: 'V', align: 'center', title: 'Vinte' },
    { key: 'pareggiate', header: 'N', align: 'center', title: 'Pareggiate' },
    { key: 'perse', header: 'P', align: 'center', title: 'Perse' },
    { key: 'gol_fatti', header: 'GF', align: 'center', title: 'Gol fatti', hideOnMobile: true },
    { key: 'gol_subiti', header: 'GS', align: 'center', title: 'Gol subiti', hideOnMobile: true },
    { key: 'differenza_reti', header: 'DR', align: 'center', title: 'Differenza reti' },
  ];

  protected readonly scorerColumns: TableColumn<ScorerRow>[] = [
    { key: 'posizione', header: '#', align: 'center', width: '44px' },
    { key: 'giocatore', header: 'Giocatore' },
    { key: 'ruolo', header: 'R', align: 'center', title: 'Ruolo', width: '50px' },
    { key: 'squadra', header: 'Squadra', hideOnMobile: true },
    { key: 'goal', header: 'Gol', align: 'center', strong: true, width: '60px' },
  ];

  /** evidenzia la zona fase finale, ma solo quando la squadra ha già giocato */
  protected readonly standingRowClass = (r: StandingRow) =>
    r.posizione <= FINAL_PHASE_SPOTS && r.giocate > 0 ? 'zone-final' : '';

  /** Carica le due classifiche in parallelo; usato anche da "Riprova". */
  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({ standings: this.api.standings(), scorers: this.api.scorers() }).subscribe({
      next: ({ standings, scorers }) => {
        this.standings.set(standings);
        this.scorers.set(scorers);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected openTeam(r: StandingRow): void {
    this.router.navigate(['/teams', r.squadra_id]);
  }

  protected openPlayer(r: ScorerRow): void {
    this.router.navigate(['/players', r.giocatore_id]);
  }
}
