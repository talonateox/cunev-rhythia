import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "./logger";
import {
  GAME_SETTINGS_SCHEMA,
  GameConfigKey,
  GameSettingKey,
  GameSettings,
  toGameConfigKey,
} from "./gameSettingsSchema";
import { cloudReadConfig, cloudWriteConfig } from "./steam";
import { writeFile } from "fs/promises";
import EventEmitter from "events";

type GameSettingsConfigFields = {
  [K in GameSettingKey as GameConfigKey<K>]: number;
};

export type ProfileId = string;

export interface GameSettingsProfile {
  id: ProfileId;
  name: string;
  settings: Partial<GameSettingsConfigFields>;
  coverImagePath?: string;
  cursorImagePath?: string;
  activeColorPaletteName?: string;
}

type BaseGameConfig = {
  passedInit?: boolean;
  targetMonitor: number;
  maxFps: number;
  masterVolume: number;
  musicVolume: number;
  fxVolume: number;
  starFilterMin: number;
  starFilterMax: number;
  durationFilterMin: number;
  durationFilterMax: number;
  alternativeViewMode?: boolean;
  selectedTab?: string;
  renderScale: number;
  renderViewportMode?: "fit" | "cover" | "stretch";
  gameWindow: number;
  gameFarDistance: number;
  gameCloseDistance: number;
  gameRotationWindow: number;
  gameOpacityWindow: number;
  gameTargetOpacity: number;
  gameRoadOpacity: number;
  gameRoadFillOpacity: number;
  gameRoadBorderThickness: number;
  customColorPalettes?: any[];
  useRelativeCursor: boolean;
  activeModeId?: string;
  activeModeIds?: string[];
  videoPath: string;
  activeProfileId: ProfileId;
  coverImagePath?: string;
  cursorImagePath?: string;
};

export type GameConfig = BaseGameConfig & GameSettingsConfigFields;

export class ConfigManager {
  public static events: EventEmitter = new EventEmitter();
  private static readonly APP_NAME = "Rhythia";
  private static LEGACY_CONFIG_FILE: string;
  private static CONFIG_DIR: string;
  private static CONFIG_FILE: string;
  private static PROFILES_DIR: string;

  private static readonly GAME_SETTING_KEYS: Array<GameConfigKey> =
    GAME_SETTINGS_SCHEMA.map((s) =>
      toGameConfigKey(s.key as GameSettingKey)
    ) as unknown as Array<GameConfigKey>;

  private static readonly DEFAULT_GAME_SETTINGS_CONFIG: GameSettingsConfigFields =
    GAME_SETTINGS_SCHEMA.reduce((acc, setting) => {
      const configKey = toGameConfigKey(setting.key as GameSettingKey);
      (acc as any)[configKey] = setting.defaultValue;
      return acc;
    }, {} as GameSettingsConfigFields);

  private static readonly DEFAULT_CONFIG: GameConfig = {
    targetMonitor: 0,
    maxFps: 900,
    masterVolume: 0.2,
    musicVolume: 1,
    fxVolume: 0.8000000000000002,
    starFilterMin: 0,
    starFilterMax: 10,
    durationFilterMin: 0,
    durationFilterMax: 300,
    alternativeViewMode: false,
    selectedTab: "Online Maps",
    renderScale: 1.0,
    renderViewportMode: "fit",
    gameWindow: 800,
    gameFarDistance: 2000,
    gameCloseDistance: -100,
    gameRotationWindow: 0.2,
    gameOpacityWindow: 0.2,
    gameTargetOpacity: 0.8,
    gameRoadOpacity: 1.0,
    gameRoadFillOpacity: 0.3,
    gameRoadBorderThickness: 2.0,
    customColorPalettes: [],
    useRelativeCursor: true,
    activeModeId: "default",
    activeModeIds: [],
    videoPath: "",
    activeProfileId: "default",
    coverImagePath: "",
    cursorImagePath: "",
    ...ConfigManager.DEFAULT_GAME_SETTINGS_CONFIG,
  } as GameConfig;

  private static config: GameConfig = { ...ConfigManager.DEFAULT_CONFIG };
  private static saveTimer: ReturnType<typeof setTimeout> | null = null;
  private static pendingSave: Promise<void> | null = null;
  private static lastSerializedConfig = "";
  private static readonly SAVE_DEBOUNCE_MS = 200;

  static {
    this.LEGACY_CONFIG_FILE = path.join(process.cwd(), "config.json");
    this.CONFIG_DIR = this.getAppDataConfigDir();
    this.ensureDir(this.CONFIG_DIR);
    this.CONFIG_FILE = path.join(this.CONFIG_DIR, "config.json");
    this.PROFILES_DIR = path.join(this.CONFIG_DIR, "profiles");
    this.ensureDir(this.PROFILES_DIR);
  }

  private static getAppDataConfigDir(): string {
    const platform = process.platform;
    if (platform === "win32") {
      const base =
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
      return path.join(base, this.APP_NAME);
    }
    if (platform === "darwin") {
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        this.APP_NAME
      );
    }
    const xdg =
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    return path.join(xdg, this.APP_NAME.toLowerCase());
  }

  public static getAppDataDir(): string {
    return this.CONFIG_DIR;
  }

  private static ensureDir(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error("Failed to ensure config directory:", dir, e);
    }
  }

  private static applyLoadedConfig(saved: any): void {
    this.config = { ...this.DEFAULT_CONFIG, ...saved };
    this.config.activeModeId = "default";
    this.config.activeModeIds = [];
    this.ensureDefaultProfile();
    try {
      this.applyProfileInternal(this.config.activeProfileId || "default");
    } catch {}
    this.lastSerializedConfig = JSON.stringify(this.config, null, 2);
  }

  static onUpdate(handler: (updates: Partial<GameConfig>) => void): void {
    this.events.on("onUpdate", handler as any);
  }
  static offUpdate(handler: (updates: Partial<GameConfig>) => void): void {
    this.events.off("onUpdate", handler as any);
  }

  private static snapshotCurrentGameSettings(): GameSettingsConfigFields {
    return Object.fromEntries(
      this.GAME_SETTING_KEYS.map((k) => [k, (this.config as any)[k]])
    ) as GameSettingsConfigFields;
  }

  private static profileFilePath(id: ProfileId): string {
    return path.join(this.PROFILES_DIR, `${id}.json`);
  }

  private static listProfileIds(): string[] {
    try {
      const entries = fs.readdirSync(this.PROFILES_DIR, {
        withFileTypes: true,
      });
      return entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"))
        .map((e) => e.name.replace(/\.json$/i, ""));
    } catch {
      return [];
    }
  }

  private static readProfile(id: ProfileId): GameSettingsProfile | null {
    const fp = this.profileFilePath(id);
    try {
      if (!fs.existsSync(fp)) return null;
      const content = fs.readFileSync(fp, "utf8");
      const p = JSON.parse(content) as GameSettingsProfile;
      if (!p || p.id !== id) {
        p.id = id as ProfileId;
      }
      return p;
    } catch {
      return null;
    }
  }

  private static writeProfile(p: GameSettingsProfile): void {
    const fp = this.profileFilePath(p.id);
    try {
      fs.writeFileSync(fp, JSON.stringify(p, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to save profile:", p.id, e);
    }
  }

  private static ensureDefaultProfile(): void {
    
    const ids = this.listProfileIds();
    const hasAny = ids.length > 0;
    const defaultExists = ids.includes("default");
    if (!hasAny || !defaultExists) {
      const p: GameSettingsProfile = {
        id: "default",
        name: "Default",
        settings: this.snapshotCurrentGameSettings(),
        coverImagePath: this.config.coverImagePath || "",
        cursorImagePath: this.config.cursorImagePath || "",
      };
      this.writeProfile(p);
    }
    if (!this.config.activeProfileId) {
      this.config.activeProfileId = "default";
    }
  }

  private static applyProfileInternal(profileId: ProfileId): void {
    const p = this.readProfile(profileId);
    if (!p) return;

    const updates: Partial<GameConfig> = {};
    this.GAME_SETTING_KEYS.forEach((k) => {
      const v = (p.settings as any)[k];
      (updates as any)[k] =
        typeof v === "number" ? v : (this.DEFAULT_CONFIG as any)[k];
    });

    Object.assign(this.config as any, updates);
    (this.config as any).coverImagePath = p.coverImagePath || "";
    (this.config as any).cursorImagePath = p.cursorImagePath || "";
    this.config.activeProfileId = profileId;
    this.events.emit("onUpdate", {
      ...updates,
      activeProfileId: profileId,
    } as any);
  }

  private static updateActiveProfileSettings(
    updates: Partial<GameSettingsConfigFields>
  ): void {
    const activeId = this.config.activeProfileId || "default";
    const profile = this.readProfile(activeId);
    if (!profile) return;
    profile.settings = { ...profile.settings, ...(updates as any) };
    this.writeProfile(profile);
  }

  
  static load(): GameConfig {
    try {
      if (fs.existsSync(this.CONFIG_FILE)) {
        this.applyLoadedConfig(
          JSON.parse(fs.readFileSync(this.CONFIG_FILE, "utf8"))
        );
        logger(`Config loaded: ${this.CONFIG_FILE}`);
        try {
          const sanitized = { ...this.config } as any;
          delete sanitized.activeModeId;
          delete sanitized.activeModeIds;
          delete sanitized.activeColorPaletteName;
          cloudWriteConfig(JSON.stringify(sanitized));
        } catch {}
        return { ...this.config };
      }
      if (fs.existsSync(this.LEGACY_CONFIG_FILE)) {
        try {
          this.applyLoadedConfig(
            JSON.parse(fs.readFileSync(this.LEGACY_CONFIG_FILE, "utf8"))
          );
          try {
            this.ensureDir(this.CONFIG_DIR);
            const sanitized = { ...this.config } as any;
            delete sanitized.activeModeId;
            delete sanitized.activeModeIds;
            delete sanitized.activeColorPaletteName;
            fs.writeFileSync(
              this.CONFIG_FILE,
              JSON.stringify(sanitized, null, 2),
              "utf8"
            );
            logger(`Config migrated to ${this.CONFIG_FILE}`);
          } catch {}
          return { ...this.config };
        } catch (e) {
          console.warn("Failed to migrate legacy config.json:", e);
        }
      }
      try {
        const cloudJson = cloudReadConfig();
        if (cloudJson) {
          this.applyLoadedConfig(JSON.parse(cloudJson));
          const sanitized = { ...this.config } as any;
          delete sanitized.activeModeId;
          delete sanitized.activeModeIds;
          delete sanitized.activeColorPaletteName;
          writeFile(
            this.CONFIG_FILE,
            JSON.stringify(sanitized, null, 2),
            "utf8"
          );
          logger(
            `Config recovered from Steam Cloud and saved to ${this.CONFIG_FILE}`
          );
          return { ...this.config };
        }
      } catch {
        logger("Steam Cloud recovery failed, using defaults");
      }
    } catch (error) {
      console.error("Error loading config, using defaults:", error);
    }
    this.applyLoadedConfig({});
    return { ...this.config };
  }

  
  static save(): void {
    this.scheduleSave();
  }

  private static scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.pendingSave = this.performSave().finally(() => {
        this.pendingSave = null;
      });
    }, this.SAVE_DEBOUNCE_MS);
  }

  private static async performSave(): Promise<void> {
    
    const cfg: any = { ...this.config };
    delete cfg.activeModeId;
    delete cfg.activeModeIds;
    delete cfg.activeColorPaletteName;
    const configJson = JSON.stringify(cfg, null, 2);

    if (configJson === this.lastSerializedConfig) {
      return;
    }

    try {
      this.ensureDir(this.CONFIG_DIR);
      await writeFile(this.CONFIG_FILE, configJson, "utf8");
      this.lastSerializedConfig = configJson;
      logger(`Config saved: ${this.CONFIG_FILE}`);
    } catch (error) {
      console.error("Error saving config:", error);
      return;
    }

    try {
      await cloudWriteConfig(configJson);
    } catch {}
  }

  
  static get(): GameConfig {
    return { ...this.config };
  }

  
  static update(updates: Partial<GameConfig>): void {
    const updatesCopy: any = { ...updates };
    let paletteChanged = false;
    let paletteName: string | undefined = undefined;
    if (
      Object.prototype.hasOwnProperty.call(
        updatesCopy,
        "activeColorPaletteName"
      )
    ) {
      paletteName = updatesCopy.activeColorPaletteName ?? "";
      delete updatesCopy.activeColorPaletteName;
      paletteChanged = true;
    }

    Object.entries(updatesCopy).forEach(
      ([k, v]) => v !== undefined && ((this.config as any)[k] = v)
    );

    const gameKeys = new Set(this.GAME_SETTING_KEYS);
    const profileUpdates: Partial<GameSettingsConfigFields> = {} as any;
    Object.keys(updatesCopy).forEach((k) => {
      if (gameKeys.has(k as GameConfigKey))
        (profileUpdates as any)[k] = (updatesCopy as any)[k];
    });
    if (Object.keys(profileUpdates).length)
      this.updateActiveProfileSettings(profileUpdates);

    const activeId = this.config.activeProfileId || "default";
    const p = this.readProfile(activeId);
    if (p) {
      let changed = false;
      if (Object.prototype.hasOwnProperty.call(updatesCopy, "coverImagePath")) {
        p.coverImagePath = (updatesCopy as any).coverImagePath || "";
        changed = true;
      }
      if (
        Object.prototype.hasOwnProperty.call(updatesCopy, "cursorImagePath")
      ) {
        p.cursorImagePath = (updatesCopy as any).cursorImagePath || "";
        changed = true;
      }
      if (paletteChanged) {
        p.activeColorPaletteName = paletteName || "";
        changed = true;
      }
      if (changed) this.writeProfile(p);
    }

    const emitted: any = { ...updatesCopy };
    if (paletteChanged) emitted.activeColorPaletteName = paletteName;
    this.events.emit("onUpdate", emitted);
  }

  
  static setVolumes(
    masterVolume?: number,
    musicVolume?: number,
    fxVolume?: number
  ): void {
    this.update({
      masterVolume: masterVolume ?? this.config.masterVolume,
      musicVolume: musicVolume ?? this.config.musicVolume,
      fxVolume: fxVolume ?? this.config.fxVolume,
    });
    this.save();
  }

  
  static setMasterVolume(volume: number): void {
    this.update({ masterVolume: volume });
    this.save();
  }

  
  static setStarFilter(minStars: number, maxStars: number): void {
    this.update({ starFilterMin: minStars, starFilterMax: maxStars });
    this.save();
  }

  
  static setDurationFilter(minDuration: number, maxDuration: number): void {
    this.update({
      durationFilterMin: minDuration,
      durationFilterMax: maxDuration,
    });
    this.save();
  }

  
  static setCustomColorPalettes(palettes: any[]): void {
    this.update({ customColorPalettes: palettes });
    this.save();
  }

  
  static setGameSettings(settings: Partial<GameSettings>): void {
    const updates = Object.fromEntries(
      GAME_SETTINGS_SCHEMA.map((s) => [
        toGameConfigKey(s.key as GameSettingKey),
        settings[s.key as keyof GameSettings],
      ]).filter(([, v]) => v !== undefined)
    ) as Partial<GameConfig>;
    if (Object.keys(updates).length) this.update(updates);
    this.save();
  }

  
  static setTutorialCompleted(): void {
    this.update({ passedInit: true });
    this.save();
  }

  
  static hasPassedInit(): boolean {
    return this.config.passedInit === true;
  }

  
  static setAlternativeViewMode(enabled: boolean): void {
    this.update({ alternativeViewMode: enabled });
    this.save();
  }

  
  static setSelectedTab(tab: string): void {
    this.update({ selectedTab: tab });
    this.save();
  }

  
  static setUseRelativeCursor(useRelativeCursor: boolean): void {
    this.update({ useRelativeCursor });
    this.save();
  }

  static getProfiles(): Array<{ id: ProfileId; name: string }> {
    this.ensureDefaultProfile();
    const list = this.listProfileIds().map((id) => ({
      id: id as ProfileId,
      name: this.readProfile(id as ProfileId)?.name || id,
    }));
    list.sort((a, b) =>
      a.id === "default"
        ? -1
        : b.id === "default"
        ? 1
        : a.name.localeCompare(b.name)
    );
    return list;
  }

  static getActiveProfileId(): ProfileId {
    this.ensureDefaultProfile();
    return this.config.activeProfileId || "default";
  }

  
  static getActiveProfilePaletteName(): string {
    this.ensureDefaultProfile();
    const activeId = this.config.activeProfileId || "default";
    const p = this.readProfile(activeId);
    return (p?.activeColorPaletteName || "") as string;
  }

  static applyProfile(profileId: ProfileId): void {
    this.ensureDefaultProfile();
    const exists = fs.existsSync(this.profileFilePath(profileId));
    const target = exists ? profileId : "default";
    this.applyProfileInternal(target);
    this.save();
  }

  static createProfile(name: string): ProfileId {
    this.ensureDefaultProfile();
    const id = this.generateProfileId(name);
    const snapshot = this.snapshotCurrentGameSettings();
    const p: GameSettingsProfile = {
      id,
      name: name || id,
      settings: snapshot,
      coverImagePath: this.config.coverImagePath || "",
      cursorImagePath: this.config.cursorImagePath || "",
    };
    this.writeProfile(p);
    this.config.activeProfileId = id;
    this.save();
    return id;
  }

  static removeProfile(profileId: ProfileId): void {
    this.ensureDefaultProfile();
    if (profileId === "default") return;
    const fp = this.profileFilePath(profileId);
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
    if (this.config.activeProfileId === profileId) {
      this.applyProfileInternal("default");
    }
    this.save();
  }

  static renameProfile(profileId: ProfileId, name: string): void {
    this.ensureDefaultProfile();
    const p = this.readProfile(profileId);
    if (!p) return;
    p.name = (name || p.name).trim() || p.name;
    this.writeProfile(p);
    this.save();
  }

  private static generateProfileId(name: string): ProfileId {
    const base =
      (name || "profile")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "") || "profile";
    let candidate = base;
    let i = 1;
    const taken = new Set(this.listProfileIds());
    while (taken.has(candidate)) {
      candidate = `${base}-${i++}`;
    }
    return candidate as ProfileId;
  }
}
