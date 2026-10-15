import { ChangeDetectionStrategy, Component, computed, input, OnDestroy, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { mediaUrl } from '../core/api';

/** Dimensione massima accettata, allineata al limite di upload del backend (2 MB). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Tipi MIME ammessi. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Selezione immagine con anteprima. Valida tipo e dimensione lato client
 * (il backend ripete comunque la validazione).
 *
 * Emette `changed` con:  File = nuova immagine,  null = rimuovi,  undefined = nessuna modifica.
 */
@Component({
  selector: 'app-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="preview" [class.round]="shape() === 'circle'">
      @if (previewUrl()) {
        <img [src]="previewUrl()" alt="Anteprima" />
      } @else {
        <mat-icon>{{ placeholderIcon() }}</mat-icon>
      }
    </div>
    <div class="side">
      <span class="label">{{ label() }}</span>
      <div class="buttons">
        <button mat-stroked-button type="button" (click)="input.click()">
          <mat-icon>upload</mat-icon> {{ previewUrl() ? 'Cambia' : 'Carica' }}
        </button>
        @if (previewUrl()) {
          <button mat-button type="button" class="btn-danger" (click)="clear()">
            <mat-icon>close</mat-icon> Rimuovi
          </button>
        }
      </div>
      <span class="hint" [class.error]="error()">{{ error() ?? 'JPEG, PNG o WebP, massimo 2 MB' }}</span>
    </div>
    <input #input type="file" hidden [accept]="accept" (change)="onFile(input)" />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 0 16px;
    }
    .preview {
      width: 96px;
      height: 96px;
      border-radius: 14px;
      background: #eef2f6;
      border: 2px dashed #c9d3df;
      display: grid;
      place-items: center;
      overflow: hidden;
      flex: none;
    }
    .preview.round {
      border-radius: 50%;
    }
    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .preview mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #a3b0c0;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .label {
      font-weight: 600;
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .hint {
      font-size: 0.78rem;
      color: var(--muted);
    }
    .hint.error {
      color: var(--danger);
    }
  `,
})
export class ImagePicker implements OnDestroy {
  /** path dell'immagine già salvata */
  readonly current = input<string | null | undefined>(null);
  /** etichetta mostrata accanto all'anteprima */
  readonly label = input('Immagine');
  /** forma dell'anteprima */
  readonly shape = input<'circle' | 'square'>('square');
  /** icona mostrata quando non c'è immagine */
  readonly placeholderIcon = input('image');
  /** File = nuova immagine, null = rimuovi, undefined = nessuna modifica */
  readonly changed = output<File | null | undefined>();

  protected readonly accept = ACCEPTED.join(',');
  protected readonly error = signal<string | null>(null);
  /** undefined = invariata, null = rimossa, string = blob URL del nuovo file */
  private readonly localUrl = signal<string | null | undefined>(undefined);

  protected readonly previewUrl = computed(() => {
    const local = this.localUrl();
    return local === undefined ? mediaUrl(this.current()) : local;
  });

  /** Valida il file scelto e ne mostra l'anteprima tramite blob URL. */
  protected onFile(el: HTMLInputElement): void {
    const file = el.files?.[0];
    // azzera l'input così riselezionare lo stesso file fa scattare di nuovo `change`
    el.value = '';
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      this.error.set('Formato non supportato: usa JPEG, PNG o WebP');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.error.set('File troppo grande (massimo 2 MB)');
      return;
    }
    this.error.set(null);
    this.revoke();
    this.localUrl.set(URL.createObjectURL(file));
    this.changed.emit(file);
  }

  /** Rimuove l'immagine dall'anteprima. */
  protected clear(): void {
    this.revoke();
    this.error.set(null);
    this.localUrl.set(null);
    // se non c'era un'immagine salvata non c'è nulla da cancellare sul server
    this.changed.emit(this.current() ? null : undefined);
  }

  /** Libera il blob URL dell'anteprima precedente per evitare memory leak. */
  private revoke(): void {
    const url = this.localUrl();
    if (url) URL.revokeObjectURL(url);
  }

  ngOnDestroy(): void {
    this.revoke();
  }
}
