import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { TutorialGamePreview } from "../components/TutorialGamePreview";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { Maps } from "../../../utils/maps";
import { BeatmapData } from "../../../utils/types";
import {
  GAME_SETTINGS_SCHEMA,
  toGameConfigKey,
} from "../../../utils/gameSettingsSchema";
import type {
  GameSettingKey,
  GameSettings,
} from "../../../utils/gameSettingsSchema";
import { ConfigManager } from "../../../utils/configManager";
import { logger } from "../../../utils/logger";
import { drawSprite } from "../../../utils/sprite";
import { createTween, easings } from "../../../utils/tween";
import { GameObject } from "../../../atoms/Object";
import { Rhythia } from "../../../atoms/Rhythia";
import { Vector2, Color } from "raylib";

export class GameFieldStep extends BaseTutorialStep {
  private gamePreview: TutorialGamePreview | null = null;
  private testMapData: SoundSpaceMemoryMap | null = null;
  private selectedMap: BeatmapData | null = null;
  private overlayOpacity: number = 1;
  private overlayGameObject: GameObject | null = null;
  private isExiting: boolean = false;

  constructor() {
    super({
      id: "gameField",
      text: "Perfect! Watch as the cursor moves automatically to show where you'll need to be to catch the notes. In the real game, you'll control this cursor with your mouse!",
      mascotEmote: "happy",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    if (this.selectedMap) {
      await this.loadSelectedMapData();
    } else {
      await this.loadTestMapData();
    }

    if (this.testMapData) {
      this.gamePreview = new TutorialGamePreview({
        mapData: this.testMapData,
        settings: this.getCurrentGameSettings(),
      });
    }

    this.overlayGameObject = new GameObject({
      zBase: 10,
      sceneOwner: "Tutorial",
    });
    this.overlayGameObject.onDraw = () => this.renderOverlay();

    this.overlayOpacity = 1;
    this.isExiting = false;
    createTween(
      "gameFieldOverlayFadeOut",
      1,
      0,
      1.5,
      (value) => {
        this.overlayOpacity = value;
      },
      easings.easeInOutQuad
    );

    this.markCompleted();
  }

  protected onStepExit(): void {
    this.isExiting = true;
    createTween(
      "gameFieldOverlayFadeIn",
      this.overlayOpacity,
      1,
      0.8,
      (value) => {
        this.overlayOpacity = value;
      },
      easings.easeInOutQuad
    ).onEnd(() => {
      if (this.gamePreview) {
        this.gamePreview.destroy();
        this.gamePreview = null;
      }
      if (this.overlayGameObject) {
        this.overlayGameObject.destroy();
        this.overlayGameObject = null;
      }
    });
  }

  protected onStepUpdate(): void {}

  protected onStepRender(): void {
    if (this.gamePreview) {
      this.gamePreview.render();
    }
  }

  protected checkCanContinue(): boolean {
    return true;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  private getCurrentGameSettings(): GameSettings {
    const settings: any = {};
    const config = ConfigManager.get();

    GAME_SETTINGS_SCHEMA.forEach((setting) => {
      const configKey = toGameConfigKey(setting.key as GameSettingKey);
      settings[setting.key] = config[configKey] ?? setting.defaultValue;
    });

    return settings as GameSettings;
  }

  public setSelectedMap(map: BeatmapData): void {
    this.selectedMap = map;
  }

  private async loadSelectedMapData(): Promise<void> {
    if (!this.selectedMap) return;

    try {
      const mapId = this.selectedMap.id.toString();
      const m = Maps.getParsed(mapId);
      if (m) {
        this.testMapData = m;
        logger(`Loaded selected map for game field preview: ${this.selectedMap.title}`);
        return;
      }
    } catch (error) {
      logger("Error loading selected map data:", error);
    }

    await this.loadTestMapData();
  }

  private async loadTestMapData(): Promise<void> {
    try {
      const listed = Maps.listDownloadedBeatmaps();
      if (listed.length === 0) return;
      const m = Maps.getParsed(String(listed[0].id));
      if (m) this.testMapData = m;
    } catch (error) {
      logger("Error loading test map data for game field preview:", error);

      this.testMapData = {
        id: "tutorial-demo",
        mappers: ["Tutorial"],
        title: "Game Field Demo",
        duration: 30000,
        noteCount: 20,
        difficulty: 1,
        starRating: 1.0,
        onlineStatus: "UNRANKED",
        notes: [
          [1000, 0.5, 0.3],
          [2000, 0.7, 0.6],
          [3000, 0.2, 0.8],
          [4000, 0.9, 0.4],
          [5000, 0.6, 0.2],
        ],
        onlineImage: "",
        audioFileName: "",
      };
    }
  }

  private renderOverlay(): void {
    if (this.overlayOpacity <= 0) return;

    const color: Color = {
      r: 0,
      g: 0,
      b: 0,
      a: 255 * this.overlayOpacity,
    };

    drawSprite(
      "/solid.png",
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      color
    );
  }
}
