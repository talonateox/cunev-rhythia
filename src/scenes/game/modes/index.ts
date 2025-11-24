import type { GameSettings } from "../../../utils/gameSettingsSchema";
import { HealthModel } from "../health/HealthModel";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { GameState } from "../GameLogic";
import { NoteRenderer } from "../atoms/NoteRenderer";
import { GameRenderer, RenderContext } from "../GameRenderer";
import { GameLogic } from "../GameLogic";
import { setMusicPitch } from "../../../utils/soundManager";

import DefaultMode from "./DefaultMode";
import NoFailMode from "./NoFailMode";
import MirrorMode from "./MirrorMode";
import OverlayDemoMode from "./OverlayDemoMode";
import HardrockMode from "./HardrockMode";


export interface GameMode {
  id: string;
  name: string;

  musicPitch?: number;

  hitboxScale?: number;

  settingsOverride?: Partial<GameSettings>;

  resolveSettings?(base: Partial<GameSettings>): Partial<GameSettings>;

  createHealthModel?(base?: HealthModel): HealthModel;

  transformTime?(currentMsTime: number, state: Readonly<GameState>): number;

  getNotes?(map: SoundSpaceMemoryMap): [number, number, number][];

  provideNoteRenderer?(defaultRenderer: NoteRenderer): NoteRenderer;

  renderExtras?(
    stage: "preNotes" | "postNotes" | "uiOverlay",
    ctx: RenderContext,
    renderer: GameRenderer,
    logic: GameLogic
  ): void;
}

const Speed075Mode: GameMode = {
  id: "speed075",
  name: "x0.75",
  musicPitch: 0.75,
};
const Speed080Mode: GameMode = {
  id: "speed080",
  name: "x0.80",
  musicPitch: 0.8,
};
const Speed087Mode: GameMode = {
  id: "speed087",
  name: "x0.87",
  musicPitch: 0.87,
};
const Speed115Mode: GameMode = {
  id: "speed115",
  name: "x1.15",
  musicPitch: 1.15,
};
const Speed125Mode: GameMode = {
  id: "speed125",
  name: "x1.25",
  musicPitch: 1.25,
};
const Speed135Mode: GameMode = {
  id: "speed135",
  name: "x1.35",
  musicPitch: 1.35,
};
const Speed145Mode: GameMode = {
  id: "speed145",
  name: "x1.45",
  musicPitch: 1.45,
};

const _registry = new Map<string, GameMode>();

function registerMode(mode: GameMode): void {
  _registry.set(mode.id, mode);
}

function getModeById(id: string): GameMode | undefined {
  return _registry.get(id);
}

function listModes(): GameMode[] {
  return Array.from(_registry.values());
}


type Conflict =
  | "musicPitch"
  | "hitboxScale"
  | "settingsOverride"
  | "resolveSettings"
  | "createHealthModel"
  | "transformTime"
  | "getNotes"
  | "provideNoteRenderer";

function detectConflict(
  a: GameMode[],
  b: GameMode
): { ok: boolean; reason?: string; field?: Conflict; withIds?: string[] } {
  const singleHooks: { field: Conflict; key: keyof GameMode }[] = [
    { field: "musicPitch", key: "musicPitch" },
    { field: "hitboxScale", key: "hitboxScale" },
    { field: "resolveSettings", key: "resolveSettings" },
    { field: "createHealthModel", key: "createHealthModel" },
    { field: "transformTime", key: "transformTime" },
    { field: "getNotes", key: "getNotes" },
    { field: "provideNoteRenderer", key: "provideNoteRenderer" },
  ];

  for (const { field, key } of singleHooks) {
    if (b[key]) {
      const conflicting = a.filter((m) => !!m[key]);
      if (conflicting.length > 0) {
        return {
          ok: false,
          reason: `Conflict on ${field}`,
          field,
          withIds: conflicting.map((m) => m.id),
        };
      }
    }
  }

  if (b.settingsOverride) {
    const bKeys = new Set(Object.keys(b.settingsOverride));
    if (bKeys.size > 0) {
      for (const m of a) {
        if (m.settingsOverride) {
          for (const k of Object.keys(m.settingsOverride)) {
            if (bKeys.has(k)) {
              return {
                ok: false,
                reason: `Conflict on settingsOverride key "${k}"`,
                field: "settingsOverride",
                withIds: [m.id],
              };
            }
          }
        }
      }
    }
  }

  return { ok: true };
}


class _ModeManager {
  private _activeIds: string[] = [];
  private _compositeCache: GameMode | null = null;

  public getMode(): GameMode {
    if (!this._compositeCache) {
      this._compositeCache = this.buildComposite();
    }
    return this._compositeCache!;
  }

  public setMode(mode: GameMode): void {
    this.setActiveModesByIds(mode.id === "default" ? [] : [mode.id]);
  }

  public getActiveModeIds(): string[] {
    return [...this._activeIds];
  }

  public canEnableWithCurrent(mode: GameMode): {
    ok: boolean;
    reason?: string;
  } {
    const curr = this._activeIds
      .map((id) => _registry.get(id))
      .filter(Boolean) as GameMode[];
    const res = detectConflict(curr, mode);
    if (!res.ok) {
      if (res.field === "musicPitch") {
        return { ok: true };
      }
      return { ok: false, reason: res.reason };
    }
    return { ok: true };
  }

  public toggleModeById(id: string): { ok: boolean; reason?: string } {
    if (id === "default") {
      this.setActiveModesByIds([]);
      return { ok: true };
    }
    const mode = _registry.get(id);
    if (!mode) return { ok: false, reason: "Unknown mode id" };

    const exists = this._activeIds.includes(id);
    if (exists) {
      const next = this._activeIds.filter((x) => x !== id);
      this.setActiveModesByIds(next);
      return { ok: true };
    }

    const curr = this._activeIds
      .map((mid) => _registry.get(mid))
      .filter(Boolean) as GameMode[];
    const res = detectConflict(curr, mode);
    if (!res.ok) {
      if (res.field === "musicPitch") {
        const conflictingIds =
          res.withIds && res.withIds.length > 0
            ? res.withIds
            : curr.filter((m) => m.musicPitch !== undefined).map((m) => m.id);
        const next = [
          ...this._activeIds.filter((mid) => !conflictingIds.includes(mid)),
          id,
        ];
        this.setActiveModesByIds(next);
        return { ok: true };
      }
      return { ok: false, reason: res.reason };
    }

    const next = [...this._activeIds, id];
    this.setActiveModesByIds(next);
    return { ok: true };
  }

  public setActiveModesByIds(ids: string[]): void {
    const filtered = ids.filter((id) => id !== "default" && _registry.has(id));
    this._activeIds = filtered;
    this._compositeCache = null;
    this.applyAudioPitch();
  }

  
  public applySettings(base: Partial<GameSettings>): Partial<GameSettings> {
    const active = this._activeIds
      .map((id) => _registry.get(id))
      .filter(Boolean) as GameMode[];
    if (active.length === 0) {
      const mode = DefaultMode;
      const withStatic = { ...base, ...(mode.settingsOverride ?? {}) };
      const dynamic = mode.resolveSettings
        ? mode.resolveSettings(base)
        : undefined;
      return dynamic ? { ...withStatic, ...dynamic } : withStatic;
    }

    const mergedStatic: Partial<GameSettings> = {};
    for (const m of active) {
      if (m.settingsOverride) {
        Object.assign(mergedStatic, m.settingsOverride);
      }
    }
    const withStatic = { ...base, ...mergedStatic };

    const resolver = active.find((m) => !!m.resolveSettings)?.resolveSettings;
    const dynamic = resolver ? resolver(base) : undefined;
    return dynamic ? { ...withStatic, ...dynamic } : withStatic;
  }

  
  public getNoteRenderer(defaultRenderer: NoteRenderer): NoteRenderer {
    const active = this._activeIds
      .map((id) => _registry.get(id))
      .filter(Boolean) as GameMode[];
    const provider = active.find(
      (m) => !!m.provideNoteRenderer
    )?.provideNoteRenderer;
    return provider ? provider(defaultRenderer) : defaultRenderer;
  }

  private applyAudioPitch(): void {
    try {
      const active = this._activeIds
        .map((id) => _registry.get(id))
        .filter(Boolean) as GameMode[];
      const speedProvider = active.find((m) => m.musicPitch !== undefined);
      setMusicPitch(speedProvider?.musicPitch ?? 1.0);
    } catch {}
  }

  private buildComposite(): GameMode {
    const active = this._activeIds
      .map((id) => _registry.get(id))
      .filter(Boolean) as GameMode[];
    if (active.length === 0) {
      return DefaultMode;
    }

    const id = `multi:${active.map((m) => m.id).join("+")}`;
    const name = active.map((m) => m.name).join(" + ");

    const settingsOverride: Partial<GameSettings> = {};
    for (const m of active) {
      if (m.settingsOverride) {
        Object.assign(settingsOverride, m.settingsOverride);
      }
    }
    const hasStatic = Object.keys(settingsOverride).length > 0;

    const renderExtras: GameMode["renderExtras"] = (
      stage,
      ctx,
      renderer,
      logic
    ) => {
      for (const m of active) {
        m.renderExtras?.(stage, ctx, renderer, logic);
      }
    };

    const resolveSettings = active.find(
      (m) => !!m.resolveSettings
    )?.resolveSettings;
    const createHealthModel = active.find(
      (m) => !!m.createHealthModel
    )?.createHealthModel;
    const transformTime = active.find((m) => !!m.transformTime)?.transformTime;
    const getNotes = active.find((m) => !!m.getNotes)?.getNotes;
    const provideNoteRenderer = active.find(
      (m) => !!m.provideNoteRenderer
    )?.provideNoteRenderer;
    const speedProvider = active.find((m) => m.musicPitch !== undefined);
    const scaleProvider = active.find((m) => m.hitboxScale !== undefined);

    return {
      id,
      name,
      musicPitch: speedProvider?.musicPitch,
      hitboxScale: scaleProvider?.hitboxScale,
      settingsOverride: hasStatic ? settingsOverride : undefined,
      resolveSettings: resolveSettings
        ? (base: Partial<GameSettings>) => resolveSettings(base)
        : undefined,
      createHealthModel: createHealthModel
        ? (base?: HealthModel) => createHealthModel(base)
        : undefined,
      transformTime: transformTime
        ? (t: number, s: Readonly<GameState>) => transformTime(t, s)
        : undefined,
      getNotes: getNotes
        ? (map: SoundSpaceMemoryMap) => getNotes(map)
        : undefined,
      provideNoteRenderer: provideNoteRenderer
        ? (defaultRenderer: NoteRenderer) =>
            provideNoteRenderer(defaultRenderer)
        : undefined,
      renderExtras,
    };
  }
}

export const ModeManager = new _ModeManager();


function setModeById(id: string): boolean {
  const m = _registry.get(id);
  if (!m) return false;
  ModeManager.setMode(m);
  return true;
}

registerMode(DefaultMode);
registerMode(NoFailMode);
registerMode(MirrorMode);
registerMode(OverlayDemoMode);
registerMode(Speed075Mode);
registerMode(Speed080Mode);
registerMode(Speed087Mode);
registerMode(Speed115Mode);
registerMode(Speed125Mode);
registerMode(Speed135Mode);
registerMode(Speed145Mode);
registerMode(HardrockMode);

export const BuiltinModes = {
  DefaultMode,
  NoFailMode,
  MirrorMode,
  OverlayDemoMode,
  Speed075Mode,
  Speed080Mode,
  Speed087Mode,
  Speed115Mode,
  Speed125Mode,
  Speed135Mode,
  Speed145Mode,
  HardrockMode,
};
export const Modes = {
  registerMode,
  getModeById,
  listModes,
  setModeById,
};

export type { GameSettings as _GameSettingsForModes } from "../../../utils/gameSettingsSchema";
export type { HealthModel as _HealthModelForModes } from "../health/HealthModel";
