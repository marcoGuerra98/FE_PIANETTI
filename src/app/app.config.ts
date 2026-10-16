import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  provideRouter,
  RouteReuseStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { ReloadableRouteReuseStrategy } from './core/route-reload';

// Dati di localizzazione italiani per DatePipe e affini (nomi di giorni e mesi).
registerLocaleData(localeIt);

/**
 * Configurazione dell'applicazione.
 * L'app è zoneless (nessun `zone.js`): il rendering è guidato dai signal e dagli
 * eventi del template, con change detection OnPush su tutti i componenti.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // parametri di route e query string arrivano ai componenti come `input()`
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    // permette di ricaricare la pagina corrente ricreandone i componenti (RouteReloader)
    { provide: RouteReuseStrategy, useExisting: ReloadableRouteReuseStrategy },
    // interceptor funzionale: Bearer token e gestione centralizzata dei 401
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'it-IT' },
    // icone Material Symbols (font caricato in index.html)
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
  ],
};
