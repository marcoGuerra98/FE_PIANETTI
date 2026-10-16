// Interfacce allineate ai modelli Pydantic del backend (BE_PIANETTI/app/models).

/** Ruolo in campo (enum `Ruolo` del backend). */
export type Ruolo = 'POR' | 'DIF' | 'CEN' | 'ATT';
/** Ruoli nell'ordine di visualizzazione (porta → attacco). */
export const RUOLI: Ruolo[] = ['POR', 'DIF', 'CEN', 'ATT'];
/** Etichette estese dei ruoli. */
export const RUOLO_LABEL: Record<Ruolo, string> = {
  POR: 'Portiere',
  DIF: 'Difensore',
  CEN: 'Centrocampista',
  ATT: 'Attaccante',
};
/** Titoli plurali dei ruoli, per le sezioni raggruppate. */
export const RUOLO_PLURAL: Record<Ruolo, string> = {
  POR: 'Portieri',
  DIF: 'Difensori',
  CEN: 'Centrocampisti',
  ATT: 'Attaccanti',
};

/** Fascia di valore del giocatore: 1 = migliore, 4 = peggiore. */
export type Fascia = 1 | 2 | 3 | 4;
/** Fasce nell'ordine di visualizzazione (dalla migliore alla peggiore). */
export const FASCE: Fascia[] = [1, 2, 3, 4];

/** Giocatore come restituito dalle API (`PlayerOut`). */
export interface Player {
  id: string;
  nome: string;
  cognome: string;
  ruolo: Ruolo;
  squadra_id: string | null;
  /** nome della squadra, aggiunto dal backend per la visualizzazione */
  squadra_nome: string | null;
  overall: number;
  /** fascia 1-4 (1 = migliore); null se non assegnata */
  fascia: Fascia | null;
  descrizione: string;
  /** derivato dai marcatori delle partite giocate: non è modificabile dal client */
  goal: number;
  /** path relativo dell'immagine, da passare a `mediaUrl` */
  foto: string | null;
}

/** Corpo di creazione/modifica giocatore (`PlayerCreate`/`PlayerUpdate`). */
export interface PlayerInput {
  nome: string;
  cognome: string;
  ruolo: Ruolo;
  squadra_id: string | null;
  overall: number;
  /** opzionale: null = non assegnata */
  fascia?: Fascia | null;
  descrizione: string;
}

/** Ordinamenti supportati dal parametro `sort` di `GET /players`. */
export type PlayerSort = 'overall_desc' | 'overall_asc' | 'nome' | 'ruolo';

/** Stato di tesseramento per il filtro `stato` di `GET /players`. */
export type PlayerStato = 'svincolato' | 'assegnato';

/** Filtri di `GET /players`, inviati come query string. */
export interface PlayerFilters {
  ruolo?: Ruolo | null;
  squadra_id?: string | null;
  svincolati?: boolean;
  fascia?: Fascia | null;
  stato?: PlayerStato | null;
  q?: string | null;
  sort?: PlayerSort;
}

/** Esito di `POST /tournament/reset`. */
export interface TournamentResetResult {
  giocatori_aggiornati: number;
  partite_rimosse: number;
}

/** Squadra (`Team`). */
export interface Team {
  id: string;
  nome: string;
  stemma: string | null;
}

/** Squadra con la rosa completa (`GET /teams/{id}`). */
export interface TeamDetail extends Team {
  giocatori: Player[];
}

/** Corpo di creazione/modifica squadra. */
export interface TeamInput {
  nome: string;
}

/** Esito dell'eliminazione di una squadra. */
export interface TeamDeleteResult {
  giocatori_svincolati: number;
  partite_rimosse: number;
}

/** Fase del torneo a cui appartiene una partita. */
export type Fase = 'GIRONE' | 'SEMIFINALE' | 'FINALE_3_4' | 'FINALE_1_2';
export const FASE_LABEL: Record<Fase, string> = {
  GIRONE: 'Girone',
  SEMIFINALE: 'Semifinale',
  FINALE_3_4: 'Finale 3°/4° posto',
  FINALE_1_2: 'Finale 1°/2° posto',
};

/** Marcatore registrato su una partita giocata. */
export interface Marcatore {
  /** null per gli autogol */
  giocatore_id: string | null;
  /** squadra a cui è assegnato il gol (per un autogol: quella che ne beneficia) */
  squadra_id: string;
  goal: number;
  autogol: boolean;
  giocatore_nome: string | null;
  giocatore_cognome: string | null;
}

/** Partita del calendario (`MatchOut`), arricchita con nomi e stemmi delle squadre. */
export interface Match {
  id: string;
  giornata: number;
  fase: Fase;
  squadra_casa_id: string;
  squadra_trasferta_id: string;
  squadra_casa_nome: string | null;
  squadra_casa_stemma: string | null;
  squadra_trasferta_nome: string | null;
  squadra_trasferta_stemma: string | null;
  /** ISO senza fuso, es. "2026-10-20T20:45:00" */
  data_ora: string | null;
  gol_casa: number | null;
  gol_trasferta: number | null;
  giocata: boolean;
  marcatori: Marcatore[];
  /** valorizzato solo per le partite della fase finale terminate in parità */
  vincitore_rigori_id: string | null;
}

/** Modifica parziale di una partita (`PATCH /matches/{id}`): si inviano solo i campi cambiati. */
export interface MatchUpdate {
  giornata?: number;
  squadra_casa_id?: string;
  squadra_trasferta_id?: string;
  data_ora?: string | null;
}

/** Gol normale: `giocatore_id`. Autogol: `autogol: true` + `squadra_id` della squadra che beneficia. */
export type MarcatoreInput =
  | { giocatore_id: string; goal: number }
  | { autogol: true; squadra_id: string; goal: number };

/** Corpo di `PUT /matches/{id}/result`. */
export interface ResultInput {
  gol_casa: number;
  gol_trasferta: number;
  marcatori: MarcatoreInput[];
  vincitore_rigori_id: string | null;
}

/** Riferimento sintetico a una squadra (es. squadre a riposo). */
export interface TeamRef {
  id: string;
  nome: string;
  stemma: string | null;
}

/** Giornata del calendario con le sue partite e le squadre che riposano. */
export interface Giornata {
  giornata: number;
  fase: Fase;
  partite: Match[];
  riposa: TeamRef[];
}

/** Calendario completo (`GET /schedule`). */
export interface Schedule {
  giornate: Giornata[];
  totale_partite: number;
  partite_giocate: number;
  girone_completato: boolean;
}

/** Riga della classifica squadre (`GET /standings`). */
export interface StandingRow {
  posizione: number;
  squadra_id: string;
  squadra_nome: string;
  stemma: string | null;
  giocate: number;
  vinte: number;
  pareggiate: number;
  perse: number;
  gol_fatti: number;
  gol_subiti: number;
  differenza_reti: number;
  punti: number;
}

/** Riga della classifica marcatori (`GET /standings/scorers`). */
export interface ScorerRow {
  posizione: number;
  giocatore_id: string;
  nome: string;
  cognome: string;
  ruolo: Ruolo;
  foto: string | null;
  squadra_id: string | null;
  squadra_nome: string | null;
  goal: number;
}

/** Risposta di login e cambio password. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  /** durata del token in secondi (usata se il JWT non contiene `exp`) */
  expires_in: number;
  username: string;
}

/** Corpo degli errori restituiti dal backend. */
export interface ApiErrorBody {
  /** messaggio di dominio oppure elenco di errori di validazione Pydantic (422) */
  detail: string | { msg: string; loc: (string | number)[] }[];
  /** informazioni strutturate aggiuntive (es. partite coinvolte in un 409) */
  details?: unknown;
}
