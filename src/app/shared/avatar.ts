import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { mediaUrl } from '../core/api';

/** Colori di sfondo per i segnaposto con le iniziali. */
const PALETTE = ['#1f6fd6', '#20a35a', '#dc3545', '#f39c12', '#7b4fd6', '#0f8f8f', '#c2410c', '#153a66'];

/**
 * Colore deterministico ricavato da un testo (hash semplice): lo stesso nome
 * ha sempre lo stesso colore, tra un caricamento e l'altro.
 */
export function colorFor(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Iniziali delle prime due parole, in maiuscolo (es. "Mario Rossi" → "MR"). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Foto giocatore con fallback alle iniziali se manca o non si carica. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url() && !failed()) {
      <img [src]="url()" [alt]="name()" (error)="failed.set(true)" loading="lazy" />
    } @else {
      <span class="fallback" [style.background]="color()" aria-hidden="true">{{ letters() }}</span>
    }
  `,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.38',
    '[class.square]': 'shape() === "square"',
    role: 'img',
    '[attr.aria-label]': 'name()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      border-radius: 50%;
      overflow: hidden;
      background: #dde4ec;
    }
    :host(.square) {
      border-radius: 12px;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }
    .fallback {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
  `,
})
export class Avatar {
  /** path dell'immagine (relativo o assoluto) */
  readonly src = input<string | null | undefined>(null);
  /** nome completo: testo alternativo, iniziali e colore del fallback */
  readonly name = input.required<string>();
  /** lato in pixel */
  readonly size = input(40);
  readonly shape = input<'circle' | 'square'>('circle');

  protected readonly url = computed(() => mediaUrl(this.src()));
  // true dopo un errore di caricamento; linkedSignal lo azzera quando cambia `src`
  // così una nuova immagine viene ritentata invece di restare sul fallback
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly letters = computed(() => initials(this.name()));
  protected readonly color = computed(() => colorFor(this.name()));
}
