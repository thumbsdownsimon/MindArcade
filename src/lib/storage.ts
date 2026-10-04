import type { GameId, GameResult } from './types';

const KEY = 'mindarcade.history.v1';

export interface HistoryEntry {
  gameId: GameId;
  score: number;
  profile?: string;
  date: string;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveResult(gameId: GameId, result: GameResult) {
  const entry: HistoryEntry = {
    gameId,
    score: result.score,
    profile: result.profile?.name,
    date: new Date().toISOString(),
  };
  try {
    const all = [...loadHistory(), entry].slice(-300);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable (private mode etc.) – results simply aren't remembered.
  }
}

export function gameHistory(gameId: GameId) {
  return loadHistory().filter((h) => h.gameId === gameId);
}

export function bestScore(gameId: GameId): number | null {
  const h = gameHistory(gameId);
  return h.length ? Math.max(...h.map((e) => e.score)) : null;
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
