import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Stato di caricamento: spinner con etichetta opzionale. */
@Component({
  selector: 'app-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  template: `
    <mat-spinner diameter="36" />
    @if (label()) {
      <span>{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      color: var(--muted);
    }
  `,
})
export class Loading {
  /** testo sotto lo spinner; stringa vuota per nasconderlo */
  readonly label = input('Caricamento…');
}

/** Stato di errore con messaggio e pulsante "Riprova". */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <mat-icon>error</mat-icon>
    <p>{{ message() }}</p>
    <button mat-stroked-button (click)="retry.emit()"><mat-icon>refresh</mat-icon> Riprova</button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 16px;
      text-align: center;
      color: var(--muted);
    }
    mat-icon {
      color: var(--danger);
      font-size: 40px;
      width: 40px;
      height: 40px;
    }
  `,
})
export class ErrorState {
  /** messaggio mostrato all'utente */
  readonly message = input('Impossibile caricare i dati');
  /** clic su "Riprova": la pagina ripete il caricamento */
  readonly retry = output<void>();
}

/** Stato vuoto: icona, titolo e contenuto proiettato (es. una call to action). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <mat-icon>{{ icon() }}</mat-icon>
    <p class="title">{{ title() }}</p>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 40px 16px;
      text-align: center;
      color: var(--muted);
    }
    mat-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      opacity: 0.6;
    }
    .title {
      font-weight: 600;
      color: var(--text);
      margin: 4px 0;
    }
  `,
})
export class EmptyState {
  /** icona Material Symbols */
  readonly icon = input('inbox');
  /** messaggio principale */
  readonly title = input.required<string>();
}
