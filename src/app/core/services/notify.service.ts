import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { apiErrorMessage } from '../api';

/**
 * Notifiche toast (snackbar Material).
 * Le classi `toast-success` e `toast-error` sono definite in `styles.scss`;
 * gli errori restano visibili più a lungo dei messaggi di successo.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private snack = inject(MatSnackBar);

  /** Conferma di un'operazione riuscita (3 secondi). */
  success(message: string): void {
    this.snack.open(message, 'OK', { duration: 3000, panelClass: 'toast-success' });
  }

  /** Messaggio di errore (6 secondi). */
  error(message: string): void {
    this.snack.open(message, 'Chiudi', { duration: 6000, panelClass: 'toast-error' });
  }

  /** Mostra il messaggio di errore restituito dal backend. */
  apiError(err: unknown, fallback?: string): void {
    this.error(apiErrorMessage(err, fallback));
  }
}
