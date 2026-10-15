import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header';

/** Componente radice: header, area principale con il router outlet e footer. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header],
  template: `
    <app-header />
    <main>
      <router-outlet />
    </main>
    <footer>Torneo Pianetti · gestione torneo di calcio</footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    main {
      flex: 1;
    }
    footer {
      text-align: center;
      padding: 20px 16px;
      font-size: 0.8rem;
      color: var(--muted);
    }
  `,
})
export class App {}
