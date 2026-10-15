import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { NotifyService } from '../core/services/notify.service';

/** Voce di navigazione principale. */
interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Header fisso con brand, navigazione e area utente.
 * Sopra gli 800px la navigazione è in linea; sotto diventa un menu a tendina.
 * Il pulsante a destra mostra "Area admin" agli anonimi e il menu account all'amministratore.
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule],
  template: `
    <header>
      <div class="bar">
        <button
          mat-icon-button
          class="menu-btn"
          [matMenuTriggerFor]="navMenu"
          aria-label="Apri menu di navigazione"
        >
          <mat-icon>menu</mat-icon>
        </button>

        <a routerLink="/" class="brand" aria-label="Home">
          <span class="ball"><mat-icon>sports_soccer</mat-icon></span>
          <span class="brand-text">Torneo<strong>Pianetti</strong></span>
        </a>

        <nav class="desktop-nav" aria-label="Navigazione principale">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
          }
        </nav>

        <span class="spacer"></span>

        @if (auth.isAdmin()) {
          <button mat-button class="user-btn" [matMenuTriggerFor]="userMenu">
            <mat-icon>admin_panel_settings</mat-icon>
            <span class="hide-mobile">{{ auth.username() }}</span>
          </button>
          <mat-menu #userMenu="matMenu" xPosition="before">
            <a mat-menu-item routerLink="/account/password">
              <mat-icon>key</mat-icon> Cambia password
            </a>
            <mat-divider />
            <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon> Esci</button>
          </mat-menu>
        } @else {
          <a mat-stroked-button class="login-btn" routerLink="/login">
            <mat-icon>login</mat-icon> <span class="hide-mobile">Area admin</span>
          </a>
        }
      </div>
    </header>

    <mat-menu #navMenu="matMenu">
      @for (item of nav; track item.path) {
        <a mat-menu-item [routerLink]="item.path" routerLinkActive="active-item">
          <mat-icon>{{ item.icon }}</mat-icon> {{ item.label }}
        </a>
      }
    </mat-menu>
  `,
  styles: `
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: linear-gradient(90deg, var(--brand-navy), var(--brand-navy-2));
      color: #fff;
      box-shadow: 0 2px 10px rgb(0 0 0 / 18%);
      border-bottom: 3px solid var(--brand-accent);
    }
    .bar {
      max-width: 1200px;
      margin: 0 auto;
      height: 60px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 var(--page-gutter);
      box-sizing: border-box;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #fff;
      margin-right: 20px;
    }
    .ball {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--brand-accent);
      display: grid;
      place-items: center;
    }
    .brand-text {
      font-size: 1.15rem;
      letter-spacing: -0.01em;
    }
    .brand-text strong {
      color: var(--brand-accent);
      font-weight: 800;
      margin-left: 2px;
    }
    .desktop-nav {
      display: flex;
      height: 100%;
    }
    .desktop-nav a {
      display: flex;
      align-items: center;
      padding: 0 14px;
      color: rgb(255 255 255 / 78%);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
      border-bottom: 3px solid transparent;
      margin-bottom: -3px;
      transition: color 0.15s;
    }
    .desktop-nav a:hover {
      color: #fff;
    }
    .desktop-nav a.active {
      color: #fff;
      border-bottom-color: #fff;
    }
    .menu-btn {
      display: none;
      color: #fff;
    }
    .user-btn,
    .login-btn {
      --mat-button-text-label-text-color: #fff;
      --mat-button-outlined-label-text-color: #fff;
      --mat-button-outlined-outline-color: rgb(255 255 255 / 45%);
    }
    @media (max-width: 799px) {
      .desktop-nav {
        display: none;
      }
      .menu-btn {
        display: inline-flex;
        margin-left: -8px;
      }
    }
    :host ::ng-deep .active-item {
      background: rgb(25 184 102 / 12%);
    }
  `,
})
export class Header {
  protected readonly auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  /** voci condivise tra navigazione desktop e menu mobile */
  protected readonly nav: NavItem[] = [
    { path: '/standings', label: 'Classifica', icon: 'leaderboard' },
    { path: '/calendar', label: 'Calendario', icon: 'calendar_month' },
    { path: '/players', label: 'Giocatori', icon: 'person' },
    { path: '/teams', label: 'Squadre', icon: 'shield' },
  ];

  /** Logout volontario: a differenza di quello per 401, torna alla classifica pubblica. */
  protected logout(): void {
    this.auth.logout();
    this.notify.success('Logout effettuato');
    this.router.navigateByUrl('/standings');
  }
}
