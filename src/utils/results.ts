import { SoundSpaceMemoryMap } from "./storage/ssmm";

export interface FinalStats {
  score: number;
  hits: number;
  misses: number;
  combo: number;
  maxCombo: number;
  accuracy: number; 
  failed?: boolean; 
}

export interface FinalResultsPayload {
  map: SoundSpaceMemoryMap;
  stats: FinalStats;
  createdAt: number;
  replayPath?: string; 
  speed?: number;
}

let lastResults: FinalResultsPayload | null = null;

export function setLastResults(
  map: SoundSpaceMemoryMap,
  stats: FinalStats,
  extras?: { replayPath?: string }
) {
  lastResults = {
    map,
    stats,
    createdAt: Date.now(),
    replayPath: extras?.replayPath,
  };
}

export function consumeLastResults(): FinalResultsPayload | null {
  const out = lastResults;
  lastResults = null;
  return out;
}

export function peekLastResults(): FinalResultsPayload | null {
  return lastResults;
}

