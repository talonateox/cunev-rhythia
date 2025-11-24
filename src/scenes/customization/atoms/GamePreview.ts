import { rlPushMatrix, rlPopMatrix } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { GameScene } from "../../game";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { getMusicTime } from "../../../utils/soundManager";
import type { GameSettings } from "../../../utils/gameSettingsSchema";

export interface GamePreviewConfig {
  mapData: SoundSpaceMemoryMap | null;
  drawerWidth: number;
  settings?: GameSettings;
}

export class GamePreview {
  private config: GamePreviewConfig;
  private tempGameScene: GameScene | null = null;
  private lastMusicTimestamp: number | null = null;

  constructor(config: GamePreviewConfig) {
    this.config = { ...config };
    if (config.mapData) {
      this.tempGameScene = new GameScene(
        config.mapData,
        false,
        true 
      );
      this.tempGameScene.enablePreviewMode();
      this.tempGameScene.init();
    }
  }

  public updateMapData(mapData: SoundSpaceMemoryMap | null): void {
    if (this.tempGameScene) {
      this.tempGameScene.destroy();
    }

    this.config.mapData = mapData;
    if (mapData) {
      this.tempGameScene = new GameScene(mapData, false, true);
      this.tempGameScene.enablePreviewMode();
      this.tempGameScene.init();
    } else {
      this.tempGameScene = null;
    }
    this.lastMusicTimestamp = null;
  }

  public updateSettings(settings: GameSettings): void {
    this.config.settings = settings;
  }

  public render(_isDrawerOpen: boolean): void {
    if (!this.config.mapData || !this.tempGameScene) return;

    rlPushMatrix();
    const msTime = getMusicTime() * 1000;

    this.handleMusicLoop(msTime);

    this.tempGameScene.renderGameAt(msTime, undefined, this.config.settings);
    rlPopMatrix();
  }

  public destroy(): void {
    if (this.tempGameScene) {
      this.tempGameScene.destroy();
      this.tempGameScene = null;
    }
    this.lastMusicTimestamp = null;
  }

  private handleMusicLoop(currentMsTime: number): void {
    if (!this.tempGameScene) {
      this.lastMusicTimestamp = currentMsTime;
      return;
    }

    if (
      this.lastMusicTimestamp !== null &&
      currentMsTime + 5 < this.lastMusicTimestamp &&
      this.lastMusicTimestamp - currentMsTime > 100 &&
      this.lastMusicTimestamp > 500
    ) {
      this.tempGameScene.resetPreviewLoop();
    }

    this.lastMusicTimestamp = currentMsTime;
  }
}
