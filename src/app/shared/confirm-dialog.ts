import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { map, Observable } from 'rxjs';

/** Contenuto del dialog di conferma. */
export interface ConfirmData {
  title: string;
  message: string;
  /** righe aggiuntive mostrate come elenco (es. partite coinvolte) */
  items?: string[];
  /** testo del pulsante di conferma (default "Conferma") */
  confirmText?: string;
  /** testo del pulsante di annullamento (default "Annulla") */
  cancelText?: string;
  /** azione distruttiva: icona e pulsante in rosso */
  danger?: boolean;
  /** icona Material Symbols del titolo (default `warning` o `help`) */
  icon?: string;
}

/** Dialog di conferma generico; si apre tramite `ConfirmService`. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class.danger]="data.danger">{{ data.icon ?? (data.danger ? 'warning' : 'help') }}</mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.items?.length) {
        <ul>
          @for (item of data.items; track $index) {
            <li>{{ item }}</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ data.cancelText ?? 'Annulla' }}</button>
      <button mat-flat-button [class.btn-danger]="data.danger" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmText ?? 'Conferma' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    mat-icon {
      color: var(--brand-accent-dark);
    }
    mat-icon.danger {
      color: var(--danger);
    }
    p {
      margin-top: 0;
      line-height: 1.5;
    }
    ul {
      margin: 0;
      padding-left: 20px;
      max-height: 200px;
      overflow: auto;
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

/** Richiesta di conferma per le azioni importanti o distruttive. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  /**
   * Apre il dialog e alla chiusura emette `true` se l'utente conferma, `false` altrimenti
   * (anche con Esc o clic fuori). Tipicamente seguito da `filter(Boolean)`.
   */
  ask(data: ConfirmData): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' })
      .afterClosed()
      .pipe(map((r) => r === true));
  }
}
