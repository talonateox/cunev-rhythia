import * as fs from "fs";
import * as fsp from "fs/promises";
import { addSSPMMap } from "./storage/add";
import type { SoundSpaceMemoryMap } from "./storage/ssmm";
import type { BeatmapData } from "./types";
import * as path from "path";

function unlinkOrTrash(target: string, trashName: string): boolean {
  if (!fs.existsSync(target)) return false;
  try {
    fs.unlinkSync(target);
    return true;
  } catch {}
  const trashDir = path.join("./cache", trashName);
  try { fs.mkdirSync(trashDir, { recursive: true }); } catch {}
  try {
    const to = path.join(trashDir, `${path.basename(target)}_${Date.now()}`);
    fs.renameSync(target, to);
    return true;
  } catch {}
  return false;
}

export class Maps {
  static async ensure(): Promise<void> {
    await fsp.mkdir("./cache/audio", { recursive: true });
    await fsp.mkdir("./cache/parsed", { recursive: true });
  }

  static getParsed(id: string): SoundSpaceMemoryMap | null {
    try {
      const p = `./cache/parsed/${id}`;
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, "utf-8")) as SoundSpaceMemoryMap;
    } catch {
      return null;
    }
  }

  static audioPath(id: string, map?: SoundSpaceMemoryMap | null): string | null {
    const fname = map?.audioFileName || `${id}.mp3`;
    return `./cache/audio/${fname}`;
  }

  static listDownloadedBeatmaps(): BeatmapData[] {
    const dir = "./cache/parsed";
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    const out: BeatmapData[] = [];
    for (const f of files) {
      try {
        const m = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf-8")) as SoundSpaceMemoryMap;
        out.push({
          id: f as any,
          title: m.title,
          ownerUsername: m.mappers.join(", "),
          difficulty: m.difficulty,
          status: m.onlineStatus,
          length: Math.floor((m.duration || 0) / 1000),
          noteCount: m.noteCount,
          starRating: m.starRating,
          image: m.onlineImage,
          beatmapFile: null,
        });
      } catch {}
    }
    return out;
  }

  static deleteLocalMap(map: SoundSpaceMemoryMap): boolean {
    let removed = false;
    const id = String(map.id || "").trim();
    if (id) {
      const direct = path.join("./cache/parsed", id);
      removed = unlinkOrTrash(direct, "parsed_deleted") || removed;
      if (!removed && fs.existsSync("./cache/parsed")) {
        for (const f of fs.readdirSync("./cache/parsed")) {
          const full = path.join("./cache/parsed", f);
          try {
            const parsed = JSON.parse(fs.readFileSync(full, "utf-8")) as any;
            const match = String(parsed?.id || "") === id || (map.audioFileName && parsed?.audioFileName === map.audioFileName);
            if (match) removed = unlinkOrTrash(full, "parsed_deleted") || removed;
          } catch {}
        }
      }
    }

    const audioDir = "./cache/audio";
    const candidates: string[] = [];
    if (map.audioFileName && map.audioFileName.trim()) candidates.push(path.join(audioDir, map.audioFileName.trim()));
    if (!map.audioFileName && map.id != null) {
      const base = String(map.id).trim();
      for (const ext of [".mp3", ".wav", ".ogg", ".flac", ".m4a"]) candidates.push(path.join(audioDir, base + ext));
    }
    for (const p of candidates) removed = unlinkOrTrash(p, "audio_deleted") || removed;

    const img = map.onlineImage || "";
    if (img && img.startsWith("./cache/sspm_covers/")) removed = unlinkOrTrash(img, "sspm_covers_deleted") || removed;
    return removed;
  }

  static async fetchAndAdd(
    url: string,
    onlineData: { starRating: number; status: string; onlineId: string; onlineImage: string }
  ): Promise<SoundSpaceMemoryMap | null> {
    await Maps.ensure();
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const res = await addSSPMMap(buf, onlineData);
    return res || null;
  }

  static async importBuffer(buf: Buffer, onlineData?: { starRating: number; status: string; onlineId: string; onlineImage: string }): Promise<SoundSpaceMemoryMap | null> {
    await Maps.ensure();
    const res = await addSSPMMap(buf, onlineData as any);
    return res || null;
  }
}
