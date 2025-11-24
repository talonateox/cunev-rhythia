import * as fs from "fs";
import * as path from "path";
import { ConfigManager } from "./configManager";
import { noteColorManager, type NoteColorPalette } from "./noteColorPalette";
import type { Color } from "raylib";

export interface ColorsetInfo {
  name: string;
  colors: Color[];
  filePath: string;
}

function ensureColorsetsDir(): string {
  const dir = path.join(ConfigManager.getAppDataDir(), "colorsets");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function isValidHex(code: string): boolean {
  return /^[0-9a-fA-F]{6}$/.test(code);
}

function parseHexColor(line: string): Color | null {
  const trimmed = (line || "").trim();
  if (!trimmed) return null;
  let hex = trimmed.replace(/^#/, "");
  
  hex = hex.replace(/^0x/i, "");
  if (!isValidHex(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b, a: 255 } as Color;
}

function parseColorsetFile(filePath: string): Color[] | null {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const colors = content
      .split(/\r?\n/)
      .map(parseHexColor)
      .filter((c): c is Color => !!c);
    return colors.length > 0 ? colors : null;
  } catch {
    return null;
  }
}

function baseNameWithoutExt(p: string): string {
  const name = path.basename(p);
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

export function getColorsetsDir(): string {
  return ensureColorsetsDir();
}

export function listCustomColorsets(): ColorsetInfo[] {
  const dir = ensureColorsetsDir();
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => path.join(dir, e.name));
    const infos: ColorsetInfo[] = [];
    files.forEach((fp) => {
      const colors = parseColorsetFile(fp);
      if (colors && colors.length > 0) {
        infos.push({ name: baseNameWithoutExt(fp), colors, filePath: fp });
      }
    });
    return infos;
  } catch {
    return [];
  }
}

export function importColorset(pickedPath: string): ColorsetInfo | null {
  try {
    const dir = ensureColorsetsDir();
    const ext = path.extname(pickedPath) || ".txt";
    const base = baseNameWithoutExt(pickedPath).trim() || "colors";
    let candidate = path.join(dir, `${base}${ext}`);
    let i = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(dir, `${base}-${i++}${ext}`);
    }

    fs.copyFileSync(pickedPath, candidate);

    const colors = parseColorsetFile(candidate);
    if (!colors || colors.length === 0) {
      try {
        fs.unlinkSync(candidate);
      } catch {}
      return null;
    }

    const info: ColorsetInfo = {
      name: baseNameWithoutExt(candidate),
      colors,
      filePath: candidate,
    };

    
    try {
      noteColorManager.removeCustomPalette(info.name);
      noteColorManager.addCustomPalette({
        name: info.name,
        colors,
      } as NoteColorPalette);
    } catch {}

    return info;
  } catch {
    return null;
  }
}

export function removeColorsetByName(name: string): boolean {
  const dir = ensureColorsetsDir();
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const fp = path.join(dir, e.name);
      if (baseNameWithoutExt(fp) === name) {
        try {
          fs.unlinkSync(fp);
        } catch {}
        try {
          noteColorManager.removeCustomPalette(name);
        } catch {}
        return true;
      }
    }
  } catch {}
  return false;
}

export function initializeColorPalettesFromDisk(): void {
  function applyPaletteByNameOrDefault(name?: string): void {
    const all = noteColorManager.getAllPalettes();
    const match = name ? all.find((p) => p.name === name) : undefined;
    const target = match || all[0];
    if (target) noteColorManager.setCurrentPalette(target);
  }

  const infos = listCustomColorsets();
  infos.forEach((i) => {
    try {
      noteColorManager.removeCustomPalette(i.name);
      noteColorManager.addCustomPalette({ name: i.name, colors: i.colors });
    } catch {}
  });

  try {
    const saved = ConfigManager.getActiveProfilePaletteName();
    applyPaletteByNameOrDefault(saved);
  } catch {}

  try {
    ConfigManager.onUpdate((updates: any) => {
      if (
        Object.prototype.hasOwnProperty.call(updates, "activeColorPaletteName")
      ) {
        const name = (updates.activeColorPaletteName as string) || "";
        applyPaletteByNameOrDefault(name);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "activeProfileId")) {
        const name = ConfigManager.getActiveProfilePaletteName();
        applyPaletteByNameOrDefault(name);
      }
    });
  } catch {}
}
