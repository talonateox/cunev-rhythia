import * as fs from "fs";
import * as path from "path";
import { ConfigManager } from "../../utils/configManager";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import { ModeManager } from "./modes";
import { encodeRRE, ReplayCursorSample, ReplayNoteHit } from "../../utils/replays";

type CursorSample = ReplayCursorSample;

export class ReplayObserver {
  private readonly mapId: string | null;
  private readonly mapTitle: string | null;
  private readonly createdAt: number;
  private readonly startFromMs: number;

  private samples: CursorSample[] = [];
  private lastSampleTime: number = Number.NEGATIVE_INFINITY;
  private readonly sampleIntervalMs: number = 16; 

  private hasAnyData: boolean = false;
  private noteHits: ReplayNoteHit[] = [];

  constructor(
    mapData: SoundSpaceMemoryMap | null | undefined,
    startFromMs: number = 0
  ) {
    this.mapId = mapData?.id ?? null;
    this.mapTitle = mapData?.title ?? null;
    this.startFromMs = Math.max(0, startFromMs | 0);
    this.createdAt = Date.now();
    const notes = Array.isArray(mapData?.notes) ? mapData!.notes : [];
    this.noteHits = notes.map((n) => ({ t: (n?.[0] ?? 0) | 0, hit: false, health: -1 }));
  }

  public recordCursor(timeMs: number, x: number, y: number): void {
    if (!isFinite(timeMs)) return;
    if (timeMs - this.lastSampleTime >= this.sampleIntervalMs) {
      this.samples.push({ t: Math.floor(timeMs), x, y });
      this.lastSampleTime = timeMs;
      this.hasAnyData = true;
    }
  }

  
  public recordNoteHit(
    _noteIndex: number,
    timeMs: number,
    x: number,
    y: number,
    health: number
  ): void {
    if (!isFinite(timeMs)) return;
    if (_noteIndex >= 0 && _noteIndex < this.noteHits.length) {
      this.noteHits[_noteIndex].hit = true;
      this.noteHits[_noteIndex].health = Number(health ?? 0);
    }
    
    const last =
      this.samples.length > 0 ? this.samples[this.samples.length - 1] : undefined;
    if (!last || Math.abs(last.t - timeMs) > this.sampleIntervalMs) {
      this.samples.push({ t: Math.floor(timeMs), x, y });
      this.lastSampleTime = timeMs;
      this.hasAnyData = true;
    }
  }

  public resetForRestart(currentTimeMs: number = 0): void {
    this.samples = [];
    this.lastSampleTime = currentTimeMs;
    this.hasAnyData = false;
    for (let i = 0; i < this.noteHits.length; i++) {
      this.noteHits[i].hit = false;
      this.noteHits[i].health = -1;
    }
  }

  public recordNoteMiss(index: number, health: number): void {
    if (index >= 0 && index < this.noteHits.length) this.noteHits[index].health = Number(health ?? 0);
  }

  public saveToDisk(): string | null {
    try {
      if (!this.hasAnyData) return null;

      const appDataDir = ConfigManager.getAppDataDir();
      const replaysDir = path.join(appDataDir, "replays");
      try {
        if (!fs.existsSync(replaysDir))
          fs.mkdirSync(replaysDir, { recursive: true });
      } catch {}

      const idPart = (this.mapId || "unknown").replace(/[^a-z0-9-_]+/gi, "_");
      const ts = new Date(this.createdAt)
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .split("Z")[0];
      const fileName = `${idPart}_${ts}.rre`;
      const filePath = path.join(replaysDir, fileName);
      const modeStr = (ModeManager.getActiveModeIds() || []).join("+");
      const payload = {
        version: 2,
        meta: {
          mapId: this.mapId,
          title: this.mapTitle,
          createdAt: this.createdAt,
          startFromMs: this.startFromMs,
          mode: modeStr,
        },
        samples: this.samples,
        noteHits: this.noteHits,
      };
      const buf = encodeRRE(payload);
      fs.writeFileSync(filePath, buf);
      return filePath;
    } catch {
      return null;
    }
  }
}
