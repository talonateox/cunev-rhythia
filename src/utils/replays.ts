import * as fs from "fs";
import * as path from "path";
import { ConfigManager } from "./configManager";

import * as r from "restructure";

export type ReplayCursorSample = { t: number; x: number; y: number };
export interface ReplayFileMeta {
  mapId: string | null;
  title: string | null;
  createdAt: number;
  startFromMs?: number;
  mode?: string;
}

export type ReplayNoteHit = { t: number; hit: boolean; health: number };

export interface ReplayFile {
  version: number;
  meta: ReplayFileMeta;
  samples: ReplayCursorSample[];
  noteHits?: ReplayNoteHit[];
}

export function getReplaysDir(): string {
  const dir = path.join(ConfigManager.getAppDataDir(), "replays");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

const RREv1Header = new r.Struct({
  magic: new r.String(4, "ascii"),
  version: r.uint16le,
  mapIdLen: r.uint16le,
  mapId: new r.String("mapIdLen", "utf8"),
  titleLen: r.uint16le,
  title: new r.String("titleLen", "utf8"),
  createdAtMs: r.doublele,
  startFromMs: r.uint32le,
  modeLen: r.uint16le,
  mode: new r.String("modeLen", "utf8"),
  sampleCount: r.uint32le,
  samples: new r.Array(
    new r.Struct({ t: r.uint32le, x: r.floatle, y: r.floatle }),
    "sampleCount"
  ),
});

const RREv2Header = new r.Struct({
  magic: new r.String(4, "ascii"),
  version: r.uint16le,
  mapIdLen: r.uint16le,
  mapId: new r.String("mapIdLen", "utf8"),
  titleLen: r.uint16le,
  title: new r.String("titleLen", "utf8"),
  createdAtMs: r.doublele,
  startFromMs: r.uint32le,
  modeLen: r.uint16le,
  mode: new r.String("modeLen", "utf8"),
  sampleCount: r.uint32le,
  samples: new r.Array(
    new r.Struct({ t: r.uint32le, x: r.floatle, y: r.floatle }),
    "sampleCount"
  ),
  noteCount: r.uint32le,
  noteHits: new r.Array(
    new r.Struct({ t: r.uint32le, h: r.uint8, hp: r.floatle }),
    "noteCount"
  ),
});

const RREv2HeaderOld = new r.Struct({
  magic: new r.String(4, "ascii"),
  version: r.uint16le,
  mapIdLen: r.uint16le,
  mapId: new r.String("mapIdLen", "utf8"),
  titleLen: r.uint16le,
  title: new r.String("titleLen", "utf8"),
  createdAtMs: r.doublele,
  startFromMs: r.uint32le,
  modeLen: r.uint16le,
  mode: new r.String("modeLen", "utf8"),
  sampleCount: r.uint32le,
  samples: new r.Array(
    new r.Struct({ t: r.uint32le, x: r.floatle, y: r.floatle }),
    "sampleCount"
  ),
  noteCount: r.uint32le,
  noteHits: new r.Array(new r.Struct({ t: r.uint32le, h: r.uint8 }), "noteCount"),
});

export function decodeRRE(buffer: Buffer): ReplayFile | null {
  try {
    const magic = buffer.toString("ascii", 0, 4);
    if (magic !== "RRE1") return null;
    const version = buffer.readUInt16LE(4);
    if (version >= 2) {
      try {
        const parsed = RREv2Header.fromBuffer(buffer) as any;
        const rf: ReplayFile = {
          version: parsed.version,
          meta: {
            mapId: parsed.mapId || null,
            title: parsed.title || null,
            createdAt: Math.floor(parsed.createdAtMs),
            startFromMs: parsed.startFromMs,
            mode: parsed.mode || undefined,
          },
          samples: parsed.samples ?? [],
          noteHits: parsed.noteHits
            ? parsed.noteHits.map((n: any) => ({ t: n.t | 0, hit: !!n.h, health: Number(n.hp ?? 0) }))
            : undefined,
        };
        return rf;
      } catch {
        const parsed = RREv2HeaderOld.fromBuffer(buffer) as any;
        const rf: ReplayFile = {
          version: parsed.version,
          meta: {
            mapId: parsed.mapId || null,
            title: parsed.title || null,
            createdAt: Math.floor(parsed.createdAtMs),
            startFromMs: parsed.startFromMs,
            mode: parsed.mode || undefined,
          },
          samples: parsed.samples ?? [],
          noteHits: parsed.noteHits
            ? parsed.noteHits.map((n: any) => ({ t: n.t | 0, hit: !!n.h, health: -1 }))
            : undefined,
        };
        return rf;
      }
    } else {
      const parsed = RREv1Header.fromBuffer(buffer) as any;
      const rf: ReplayFile = {
        version: parsed.version,
        meta: {
          mapId: parsed.mapId || null,
          title: parsed.title || null,
          createdAt: Math.floor(parsed.createdAtMs),
          startFromMs: parsed.startFromMs,
          mode: parsed.mode || undefined,
        },
        samples: parsed.samples ?? [],
      };
      return rf;
    }
  } catch {
    return null;
  }
}

export function encodeRRE(data: ReplayFile): Buffer {
  const base = {
    magic: "RRE1",
    mapIdLen: Buffer.byteLength(data.meta.mapId ?? "", "utf8"),
    mapId: data.meta.mapId ?? "",
    titleLen: Buffer.byteLength(data.meta.title ?? "", "utf8"),
    title: data.meta.title ?? "",
    createdAtMs: (data.meta.createdAt ?? Date.now()) as number,
    startFromMs: (data.meta.startFromMs ?? 0) | 0,
    modeLen: Buffer.byteLength(data.meta.mode ?? "", "utf8"),
    mode: data.meta.mode ?? "",
    sampleCount: (data.samples?.length ?? 0) | 0,
    samples: (data.samples ?? []).map((s) => ({
      t: (s.t ?? 0) | 0,
      x: Number(s.x ?? 0),
      y: Number(s.y ?? 0),
    })),
  } as any;
  const v = data.version | 0;
  if (v >= 2) {
    const payload = {
      ...base,
      version: v,
      noteCount: (data.noteHits?.length ?? 0) | 0,
      noteHits: (data.noteHits ?? []).map((n) => ({
        t: (n.t ?? 0) | 0,
        h: n.hit ? 1 : 0,
        hp: Number(n.health ?? 0),
      })),
    } as any;
    return RREv2Header.toBuffer(payload);
  } else {
    const payload = { ...base, version: v } as any;
    return RREv1Header.toBuffer(payload);
  }
}

export function loadReplay(filePath: string): ReplayFile | null {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".rre") return null; 
    const raw = fs.readFileSync(filePath);
    return decodeRRE(raw);
  } catch {
    return null;
  }
}
