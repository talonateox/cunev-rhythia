import * as fs from "fs";

const FAVORITES_PATH = "./cache/favoriteMapIds.json";

function ensureFavoritesFile(): void {
  try {
    if (!fs.existsSync("./cache")) {
      fs.mkdirSync("./cache", { recursive: true });
    }
    if (!fs.existsSync(FAVORITES_PATH)) {
      fs.writeFileSync(FAVORITES_PATH, JSON.stringify([]), "utf-8");
    }
  } catch (e) {}
}

export function loadFavoriteIds(): string[] {
  ensureFavoritesFile();
  try {
    const raw = fs.readFileSync(FAVORITES_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.map((x) => String(x));
    return [];
  } catch {
    return [];
  }
}

export function isFavorite(mapId: string): boolean {
  const list = loadFavoriteIds();
  return list.includes(String(mapId));
}

export function toggleFavorite(mapId: string): boolean {
  ensureFavoritesFile();
  const id = String(mapId);
  const list = loadFavoriteIds();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(id);
  }
  try {
    fs.writeFileSync(FAVORITES_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch {}
  return list.includes(id);
}

export function addFavorite(mapId: string): void {
  ensureFavoritesFile();
  const id = String(mapId);
  const list = loadFavoriteIds();
  if (!list.includes(id)) {
    list.push(id);
    try {
      fs.writeFileSync(FAVORITES_PATH, JSON.stringify(list, null, 2), "utf-8");
    } catch {}
  }
}

export function removeFavorite(mapId: string): void {
  ensureFavoritesFile();
  const id = String(mapId);
  const list = loadFavoriteIds();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
    try {
      fs.writeFileSync(FAVORITES_PATH, JSON.stringify(list, null, 2), "utf-8");
    } catch {}
  }
}

export function getFavoritesPath(): string {
  return FAVORITES_PATH;
}
