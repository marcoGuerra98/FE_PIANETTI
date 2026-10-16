import { Player } from '../core/models';
import { matchesPlayer, normalizeText } from './player-search';

const player = (nome: string, cognome: string): Player => ({
  id: '1',
  nome,
  cognome,
  ruolo: 'ATT',
  squadra_id: null,
  squadra_nome: null,
  overall: 70,
  fascia: null,
  descrizione: '',
  goal: 0,
  foto: null,
});

describe('matchesPlayer', () => {
  const mario = player('Mario', 'Rossi');
  const match = (q: string, p = mario) => matchesPlayer(p, normalizeText(q));

  it('trova per nome e cognome parziale, senza distinzione di maiuscole', () => {
    expect(match('mario ross')).toBe(true);
    expect(match('  MARIO   Rossi ')).toBe(true);
  });

  it('trova per solo cognome o cognome e nome', () => {
    expect(match('rossi')).toBe(true);
    expect(match('rossi mar')).toBe(true);
  });

  it('ignora gli accenti', () => {
    expect(match('nicolo', player('Nicolò', 'Bianchi'))).toBe(true);
  });

  it('esclude chi non corrisponde; la ricerca vuota include tutti', () => {
    expect(match('verdi')).toBe(false);
    expect(match('')).toBe(true);
  });
});
