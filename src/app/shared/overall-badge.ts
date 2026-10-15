import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Valore overall con colore per fascia (stile carta giocatore). */
@Component({
  selector: 'app-overall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ value() }}`,
  host: {
    '[class]': 'tier()',
    '[style.--size.px]': 'size()',
    '[attr.title]': '"Overall " + value()',
  },
  styles: `
    :host {
      --size: 40px;
      display: inline-grid;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 10px;
      font-weight: 800;
      font-size: calc(var(--size) * 0.42);
      font-variant-numeric: tabular-nums;
      color: #fff;
      flex: none;
    }
    :host(.gold) {
      background: linear-gradient(135deg, #f5c400, #d99a00);
      color: #3a2a00;
    }
    :host(.silver) {
      background: linear-gradient(135deg, #1fb767, #128a4b);
    }
    :host(.bronze) {
      background: linear-gradient(135deg, #2b74d8, #1a4f9c);
    }
    :host(.base) {
      background: #8a96a8;
    }
  `,
})
export class OverallBadge {
  /** valore overall (1-99) */
  readonly value = input.required<number>();
  /** lato del badge in pixel */
  readonly size = input(40);

  /** fascia: ≥85 oro, ≥75 verde, ≥65 blu, altrimenti grigio */
  protected readonly tier = computed(() => {
    const v = this.value();
    return v >= 85 ? 'gold' : v >= 75 ? 'silver' : v >= 65 ? 'bronze' : 'base';
  });
}
