import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protegge le pagine riservate all'amministratore.
 * Se non c'è una sessione valida reindirizza a `/login`, passando l'URL richiesto
 * in `returnUrl` per tornarci dopo l'accesso.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
