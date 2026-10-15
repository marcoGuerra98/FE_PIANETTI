import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RUOLO_LABEL, Ruolo } from '../core/models';

/** Lettera singola per la variante compatta. */
const SHORT: Record<Ruolo, string> = { POR: 'P', DIF: 'D', CEN: 'C', ATT: 'A' };

/** Badge colorato del ruolo, come le lettere P/D/C/A del fantacalcio. */
@Component({
  selector: 'app-role-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ full() ? ruolo() : short() }}`,
  host: {
    '[class]': '"role role-" + ruolo().toLowerCase()',
    '[class.full]': 'full()',
    '[attr.title]': 'label()',
    '[attr.aria-label]': 'label()',
  },
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      box-sizing: border-box;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.03em;
      line-height: 1;
    }
    :host(.full) {
      min-width: 38px;
    }
    :host(.role-por) {
      background: var(--role-por);
    }
    :host(.role-dif) {
      background: var(--role-dif);
    }
    :host(.role-cen) {
      background: var(--role-cen);
    }
    :host(.role-att) {
      background: var(--role-att);
    }
  `,
})
export class RoleBadge {
  /** ruolo da mostrare; determina anche il colore (token `--role-*`) */
  readonly ruolo = input.required<Ruolo>();
  /** true = "ATT", false = "A" */
  readonly full = input(true);

  protected readonly short = computed(() => SHORT[this.ruolo()]);
  protected readonly label = computed(() => RUOLO_LABEL[this.ruolo()]);
}
