import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { mediaUrl } from '../core/api';
import { colorFor, initials } from './avatar';

/** Stemma squadra con scudo segnaposto se manca l'immagine. */
@Component({
  selector: 'app-team-crest',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url() && !failed()) {
      <img [src]="url()" [alt]="'Stemma ' + name()" (error)="failed.set(true)" loading="lazy" />
    } @else {
      <svg viewBox="0 0 40 46" aria-hidden="true">
        <path d="M20 1 L38 7 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V7 Z" [attr.fill]="color()" />
        <path d="M20 1 L38 7 V22 C38 34 30 41 20 45 Z" fill="rgba(0,0,0,.12)" />
        <text x="20" y="27" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">
          {{ letters() }}
        </text>
      </svg>
    }
  `,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    role: 'img',
    '[attr.aria-label]': '"Stemma " + name()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
    }
    img,
    svg {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    text {
      font-family: Inter, Roboto, sans-serif;
    }
  `,
})
export class TeamCrest {
  /** path dello stemma */
  readonly src = input<string | null | undefined>(null);
  /** nome della squadra: testo alternativo, iniziali e colore dello scudo */
  readonly name = input<string | null | undefined>('');
  /** lato in pixel */
  readonly size = input(32);

  protected readonly url = computed(() => mediaUrl(this.src()));
  // come in Avatar: l'errore di caricamento si azzera quando cambia `src`
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly letters = computed(() => initials(this.name() || '?'));
  protected readonly color = computed(() => colorFor(this.name() || '?'));
}
