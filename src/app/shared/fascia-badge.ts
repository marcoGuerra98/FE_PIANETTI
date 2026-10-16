import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Fascia } from '../core/models';

/** Descrizione accessibile della fascia. */
export function fasciaLabel(fascia: Fascia | null | undefined): string {
  if (!fascia) return 'Fascia non assegnata';
  const note = fascia === 1 ? ' (la migliore)' : fascia === 4 ? ' (la più bassa)' : '';
  return `Fascia ${fascia}${note}`;
}

/**
 * Badge della fascia del giocatore ("F1"…"F4"), nello stile di role-badge.
 * Le fasce più alte sono più scure (blu notte → grigio); senza fascia il badge è tratteggiato.
 * Il valore è sempre scritto nel testo: il colore è solo un rinforzo.
 */
@Component({
  selector: 'app-fascia-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ text() }}`,
  host: {
    '[class]': '"fascia fascia-" + (fascia() ?? "none")',
    '[class.full]': 'full()',
    '[attr.title]': 'label()',
    '[attr.aria-label]': 'label()',
    role: 'img',
  },
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      min-width: 26px;
      height: 22px;
      padding: 0 6px;
      box-sizing: border-box;
      border-radius: 6px;
      border: 1px solid transparent;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      line-height: 1;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    :host(.fascia-1) {
      background: var(--brand-navy);
      color: #fff;
    }
    :host(.fascia-2) {
      background: #2b5a8f;
      color: #fff;
    }
    :host(.fascia-3) {
      background: #dbe6f3;
      border-color: #b9cbe0;
      color: var(--brand-navy);
    }
    :host(.fascia-4) {
      background: #eef1f5;
      border-color: var(--border);
      color: #4a5668;
    }
    :host(.fascia-none) {
      background: transparent;
      border: 1px dashed #b4bfcd;
      color: var(--muted);
    }
  `,
})
export class FasciaBadge {
  /** fascia 1-4; null/undefined = non assegnata */
  readonly fascia = input<Fascia | null | undefined>(null);
  /** true = "Fascia 1", false = "F1" */
  readonly full = input(false);

  protected readonly label = computed(() => fasciaLabel(this.fascia()));
  protected readonly text = computed(() => {
    const f = this.fascia();
    if (this.full()) return f ? `Fascia ${f}` : 'Senza fascia';
    return f ? `F${f}` : 'F–';
  });
}
