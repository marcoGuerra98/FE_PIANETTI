import { Player } from '../core/models';

/** Minuscolo, senza accenti e con spazi singoli: "  Niccolò  " → "niccolo". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // segni diacritici separati da NFD
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ricerca locale per nome e cognome, case-insensitive e senza accenti.
 * Trova sia "mario ross" (nome cognome) sia "rossi mario" (cognome nome) sia "rossi".
 * @param query testo già normalizzato con `normalizeText`; vuoto = tutti i giocatori
 */
export function matchesPlayer(p: Player, query: string): boolean {
  if (!query) return true;
  const nome = normalizeText(p.nome);
  const cognome = normalizeText(p.cognome);
  return `${nome} ${cognome}`.includes(query) || `${cognome} ${nome}`.includes(query);
}
