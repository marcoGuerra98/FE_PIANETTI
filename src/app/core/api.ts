import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiErrorBody } from './models';

/** URL base delle API, senza slash finale (da `environment.apiUrl`). */
export const API_URL = environment.apiUrl.replace(/\/$/, '');

/**
 * Converte il path di un'immagine in URL assoluto.
 * I path restituiti dal backend sono relativi ("/uploads/..."); gli URL già assoluti restano invariati.
 * @returns `null` se il path è vuoto, così i componenti possono mostrare il fallback.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

/**
 * Estrae un messaggio leggibile da un errore HTTP del backend.
 * Gestisce: server irraggiungibile (status 0), `detail` testuale degli errori di dominio
 * ed elenco di errori di validazione Pydantic (422).
 * @param fallback messaggio usato quando l'errore non contiene informazioni utili
 */
export function apiErrorMessage(err: unknown, fallback = 'Si è verificato un errore'): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return 'Impossibile contattare il server. Verifica che il backend sia avviato.';
  const body = err.error as ApiErrorBody | null;
  if (body && typeof body.detail === 'string') return body.detail;
  if (body && Array.isArray(body.detail) && body.detail.length) {
    // Errori di validazione Pydantic: "campo: messaggio", senza il prefisso "body" della loc
    return body.detail
      .map((d) => {
        const field = d.loc.filter((l) => l !== 'body').join('.');
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('; ');
  }
  return fallback;
}
