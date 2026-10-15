import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';

/** Definizione di una colonna di `DataTable`. */
export interface TableColumn<T> {
  /** identificativo della colonna, usato anche per associare il template `appCell` */
  key: string;
  /** testo dell'intestazione */
  header: string;
  /** valore della cella se non è definito un template `appCell` */
  value?: (row: T) => string | number | null | undefined;
  align?: 'start' | 'center' | 'end';
  /** nasconde la colonna sotto i 640px */
  hideOnMobile?: boolean;
  /** tooltip sull'intestazione (es. "Gol fatti" per GF) */
  title?: string;
  /** larghezza CSS fissa (es. "60px") */
  width?: string;
  /** evidenzia la colonna (es. punti) */
  strong?: boolean;
}

/**
 * Template personalizzato per una cella: `<ng-template appCell="nome" let-row>…</ng-template>`.
 * La direttiva non renderizza nulla: espone il proprio `TemplateRef`, che `DataTable`
 * raccoglie con `contentChildren` e indicizza per chiave di colonna. Nel template sono
 * disponibili `$implicit` (la riga) e `index`.
 */
@Directive({ selector: 'ng-template[appCell]' })
export class CellDef {
  /** chiave della colonna (`TableColumn.key`) a cui si applica il template */
  readonly appCell = input.required<string>();
  /** template della cella, iniettato dall'`ng-template` su cui è applicata la direttiva */
  readonly template = inject(TemplateRef);
}

/**
 * Tabella generica basata su mat-table, in stile classifica sportiva.
 * Le colonne si descrivono con `TableColumn`; le celle senza template `appCell`
 * mostrano `value(row)` o, in mancanza, `row[key]`.
 */
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, NgTemplateOutlet],
  template: `
    <div class="wrap">
      <table mat-table [dataSource]="data()" [trackBy]="trackBy">
        @for (col of columns(); track col.key) {
          <ng-container [matColumnDef]="col.key">
            <th
              mat-header-cell
              *matHeaderCellDef
              [class]="cellClass(col)"
              [style.width]="col.width"
              [attr.title]="col.title"
            >
              {{ col.header }}
            </th>
            <td mat-cell *matCellDef="let row; let i = index" [class]="cellClass(col)">
              @if (templates()[col.key]; as tpl) {
                <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: i }" />
              } @else {
                {{ cellValue(col, row) }}
              }
            </td>
          </ng-container>
        }
        <tr mat-header-row *matHeaderRowDef="columnKeys()"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: columnKeys()"
          [class]="rowClass()(row)"
          [class.clickable]="clickable()"
          [attr.tabindex]="clickable() ? 0 : null"
          (click)="clickable() && rowClick.emit(row)"
          (keydown)="onRowKeydown($event, row)"
        ></tr>
      </table>
    </div>
  `,
  styles: `
    .wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      background: transparent;
    }
    th.mat-mdc-header-cell {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      background: #f6f8fb;
      border-bottom: 1px solid var(--border);
    }
    td.mat-mdc-cell {
      font-variant-numeric: tabular-nums;
      border-bottom-color: var(--border);
    }
    th,
    td {
      padding: 0 10px !important;
    }
    th:first-child,
    td:first-child {
      padding-left: 16px !important;
    }
    th:last-child,
    td:last-child {
      padding-right: 16px !important;
    }
    .align-center {
      text-align: center;
    }
    .align-end {
      text-align: right;
    }
    .strong {
      font-weight: 800;
      color: var(--brand-navy);
    }
    tr.clickable {
      cursor: pointer;
    }
    tr.clickable:focus-visible {
      outline: 2px solid var(--brand-accent-dark);
      outline-offset: -2px;
      background: var(--row-hover);
    }
    tr.mat-mdc-row:hover {
      background: var(--row-hover);
    }
    @media (max-width: 639px) {
      .hide-mobile {
        display: none;
      }
      th,
      td {
        padding: 0 6px !important;
      }
    }
  `,
})
export class DataTable<T> {
  /** colonne da mostrare, nell'ordine */
  readonly columns = input.required<TableColumn<T>[]>();
  /** righe */
  readonly data = input.required<T[]>();
  /** chiave usata per il tracking delle righe */
  readonly idKey = input<keyof T | null>(null);
  /** funzione che restituisce classi CSS aggiuntive per riga (es. zona fase finale) */
  readonly rowClass = input<(row: T) => string>(() => '');
  /** righe cliccabili: cursore a mano ed emissione di `rowClick` */
  readonly clickable = input(false);
  /** riga cliccata (solo se `clickable`) */
  readonly rowClick = output<T>();

  private readonly cellDefs = contentChildren(CellDef);
  /** mappa chiave colonna → template personalizzato */
  protected readonly templates = computed(() =>
    Object.fromEntries(this.cellDefs().map((d) => [d.appCell(), d.template])),
  );
  protected readonly columnKeys = computed(() => this.columns().map((c) => c.key));

  // arrow function: mat-table la invoca senza contesto, serve `this` legato al componente
  protected trackBy = (index: number, row: T) => {
    const key = this.idKey();
    return key ? row[key] : index;
  };

  /**
   * Attivazione da tastiera delle righe cliccabili: Invio e Spazio emettono `rowClick`.
   * La riga mantiene la semantica di tabella (nessun `role` sovrascritto) ed è raggiungibile con Tab.
   * Si ignorano i tasti premuti su elementi interni (es. il link della squadra), che fanno
   * risalire l'evento fino alla riga ma devono attivare solo sé stessi.
   */
  protected onRowKeydown(event: KeyboardEvent, row: T): void {
    if (!this.clickable() || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); // evita lo scroll della pagina con lo Spazio
      this.rowClick.emit(row);
    }
  }

  protected cellValue(col: TableColumn<T>, row: T): unknown {
    return col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
  }

  protected cellClass(col: TableColumn<T>): string {
    return [
      col.align ? `align-${col.align}` : '',
      col.hideOnMobile ? 'hide-mobile' : '',
      col.strong ? 'strong' : '',
    ].join(' ');
  }
}
