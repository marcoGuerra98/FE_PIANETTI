import { Pipe, PipeTransform } from '@angular/core';

/**
 * Numero seguito dalla forma singolare o plurale (es. `plural(1, 'squadra', 'squadre')` → "1 squadra").
 * In italiano il singolare si usa solo per 1; lo zero vuole il plurale ("0 squadre").
 */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Versione per i template di `plural`: `{{ n | plural: 'squadra' : 'squadre' }}`. */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(n: number, singular: string, pluralForm: string): string {
    return plural(n, singular, pluralForm);
  }
}
