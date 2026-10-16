import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, Router } from '@angular/router';

/**
 * Strategia di riuso delle route con la possibilità di forzare, una tantum, la ricreazione
 * dei componenti della pagina corrente. Di default si comporta come quella di Angular.
 */
@Injectable({ providedIn: 'root' })
export class ReloadableRouteReuseStrategy extends BaseRouteReuseStrategy {
  /** true solo durante una navigazione di ricarica avviata da `RouteReloader` */
  forceReload = false;

  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    // la radice (senza routeConfig) resta riusata: si ricreano solo le pagine
    if (this.forceReload && future.routeConfig) return false;
    return super.shouldReuseRoute(future, curr);
  }
}

/**
 * Ricarica la pagina corrente senza ricaricare l'app (né perdere sessione e stato globale):
 * rinaviga alla stessa URL ricreando i componenti, che così rileggono i dati dal backend.
 * Utile dopo operazioni globali (es. reset del torneo) che cambiano i dati di qualsiasi pagina.
 */
@Injectable({ providedIn: 'root' })
export class RouteReloader {
  private router = inject(Router);
  private strategy = inject(ReloadableRouteReuseStrategy);

  reload(): Promise<boolean> {
    this.strategy.forceReload = true;
    return this.router
      .navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' })
      .finally(() => (this.strategy.forceReload = false));
  }
}
