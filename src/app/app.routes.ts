import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

/**
 * Route dell'applicazione. Ogni pagina è caricata in lazy loading con `loadComponent`;
 * le pagine di creazione/modifica e il cambio password sono protette da `adminGuard`.
 * Le route statiche (`new`) precedono quelle parametriche (`:id`) per non essere catturate da queste.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'standings' },

  // Giocatori
  {
    path: 'players',
    title: 'Giocatori',
    loadComponent: () => import('./features/players/players-list').then((m) => m.PlayersList),
  },
  {
    path: 'players/new',
    title: 'Nuovo giocatore',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/players/player-edit').then((m) => m.PlayerEdit),
  },
  {
    path: 'players/:id/edit',
    title: 'Modifica giocatore',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/players/player-edit').then((m) => m.PlayerEdit),
  },
  {
    path: 'players/:id',
    title: 'Giocatore',
    loadComponent: () => import('./features/players/player-detail').then((m) => m.PlayerDetail),
  },

  // Squadre
  {
    path: 'teams',
    title: 'Squadre',
    loadComponent: () => import('./features/teams/teams-list').then((m) => m.TeamsList),
  },
  {
    path: 'teams/new',
    title: 'Nuova squadra',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/teams/team-edit').then((m) => m.TeamEdit),
  },
  {
    path: 'teams/:id/edit',
    title: 'Modifica squadra',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/teams/team-edit').then((m) => m.TeamEdit),
  },
  {
    path: 'teams/:id',
    title: 'Squadra',
    loadComponent: () => import('./features/teams/team-detail').then((m) => m.TeamDetailPage),
  },

  // Calendario e classifiche
  {
    path: 'calendar',
    title: 'Calendario',
    loadComponent: () => import('./features/calendar/calendar').then((m) => m.CalendarPage),
  },
  {
    path: 'standings',
    title: 'Classifica',
    loadComponent: () => import('./features/standings/standings').then((m) => m.StandingsPage),
  },

  // Autenticazione
  {
    path: 'login',
    title: 'Accesso amministratore',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'account/password',
    title: 'Cambia password',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/auth/change-password').then((m) => m.ChangePasswordPage),
  },

  // URL sconosciuti: ritorno alla classifica
  { path: '**', redirectTo: 'standings' },
];
