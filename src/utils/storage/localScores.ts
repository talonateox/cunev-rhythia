import * as fs from "fs";

export interface LocalScoreEntry {
  score: number;
  hits: number;
  misses: number;
  combo: number;
  maxCombo: number;
  accuracy: number; 
  createdAt: number; 
  modeIds?: string[]; 
  replayPath?: string; 
}

type LocalScoresDB = Record<string, LocalScoreEntry[]>; 

const LOCAL_SCORES_PATH = "./cache/localScores.json";

function ensureLocalScoresFile(): void {
  try {
    if (!fs.existsSync("./cache")) {
      fs.mkdirSync("./cache", { recursive: true });
    }
    if (!fs.existsSync(LOCAL_SCORES_PATH)) {
      fs.writeFileSync(LOCAL_SCORES_PATH, JSON.stringify({}, null, 2), "utf-8");
    }
  } catch {}
}

function loadDB(): LocalScoresDB {
  ensureLocalScoresFile();
  try {
    const raw = fs.readFileSync(LOCAL_SCORES_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as LocalScoresDB;
  } catch {}
  return {};
}

function saveDB(db: LocalScoresDB): void {
  try {
    fs.writeFileSync(LOCAL_SCORES_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch {}
}

export function addLocalScore(mapId: string, entry: LocalScoreEntry): void {
  if (!mapId) return;
  const id = String(mapId);
  const db = loadDB();
  const list = Array.isArray(db[id]) ? db[id] : [];
  list.push(entry);
  
  list.sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.score !== a.score) return b.score - a.score;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  db[id] = list.slice(0, 50);
  saveDB(db);
}

export function getLocalScores(mapId: string, filterModeIds?: string[]): LocalScoreEntry[] {
  if (!mapId) return [];
  const id = String(mapId);
  const db = loadDB();
  const list = Array.isArray(db[id]) ? db[id] : [];

  const norm = (ids?: string[]) => (Array.isArray(ids) ? [...ids].sort() : []);
  const eq = (a?: string[], b?: string[]) => {
    const aa = norm(a);
    const bb = norm(b);
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
    return true;
  };

  const filtered = filterModeIds
    ? list.filter((e) => eq(e.modeIds, filterModeIds))
    : list;

  return [...filtered].sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.score !== a.score) return b.score - a.score;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function hasAnyLocalScores(mapId: string): boolean {
  const list = getLocalScores(mapId);
  return list.length > 0;
}

export function getLocalScoresPath(): string {
  return LOCAL_SCORES_PATH;
}
