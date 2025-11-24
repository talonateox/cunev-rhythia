import {
  Vector2,
  IsKeyPressed,
  KEY_F3,
  KEY_ESCAPE,
  KEY_SPACE,
  KEY_GRAVE,
  KEY_Q,
  DisableCursor,
  EnableCursor,
  GetMouseDelta,
  GetScreenWidth,
  GetScreenHeight,
  GetFrameTime,
  GetMousePosition,
  GetMouseWheelMove,
  IsKeyDown,
  KEY_LEFT_ALT,
  KEY_RIGHT_ALT,
  IsMouseButtonPressed,
  MOUSE_BUTTON_LEFT,
} from "raylib";
import { Scene } from "../../atoms/Scene";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import { Rhythia } from "../../atoms/Rhythia";
import type {
  GameSettingKey,
  GameSettings,
} from "../../utils/gameSettingsSchema";
import { keybinds } from "../../utils/keybinds";
import { GameObject } from "../../atoms/Object";
import { Cooldown } from "../../atoms/Cooldown";
import { ConfigManager } from "../../utils/configManager";
import {
  GAME_SETTINGS_SCHEMA,
  getGameSettingByKey,
  toGameConfigKey,
} from "../../utils/gameSettingsSchema";
import { GameLogic } from "./GameLogic";
import { GameRenderer, RenderContext } from "./GameRenderer";
import { drawSprite } from "../../utils/sprite";
import { drawText, measureText } from "../../utils/text";
import { logger } from "../../utils/logger";
import { PauseOverlay, PauseButtonId } from "./ui/PauseOverlay";
import { QuickRestart } from "./ui/QuickRestart";
import { toastManager } from "../../utils/toastManager";
import { AutoPlayController } from "./AutoPlayController";
import { HealthModel } from "./health/HealthModel";
import { SoundSpaceHealthModel } from "./health/SoundSpaceHealthModel";
import { ModeManager } from "./modes";
import { screenToGame } from "../../atoms/sysutils/rendering";
import { state as runtimeState } from "../../atoms/sysutils/state";
import { VolumeKnob } from "../menu/atoms/VolumeKnob";
import {
  getVolumes,
  setMasterVolume,
  stopMusic,
  playFx,
} from "../../utils/soundManager";
import { CustomizationDrawer } from "../customization/molecules/CustomizationDrawer";
import { ItemCustomizationDrawer } from "../customization/molecules/ItemCustomizationDrawer";
import { PaletteDrawer } from "../customization/molecules/PaletteDrawer";
import type { CustomizationInventoryItem } from "../../utils/gameSettingsSchema";
import { ReplayObserver } from "./ReplayObserver";
import { ReplayPlayer } from "./ReplayPlayer";

export class GameScene extends Scene {
  sceneName: string = "Game";

  private gameLogic: GameLogic;
  private gameRenderer: GameRenderer;
  private backInstructionObject: GameObject | null = null;
  private exitCooldown: Cooldown;
  private shouldLockCursor: boolean;
  private cursorLocked: boolean = false;
  private lastCursorPos: Vector2 = Vector2(400, 300);
  private quickRestart: QuickRestart = new QuickRestart(0.12);
  private readonly autoPlayEnabled: boolean;
  private autoPlayController: AutoPlayController | null = null;
  private readonly healthModel: HealthModel;
  private isPreviewMode: boolean = false;
  private pauseOverlay: PauseOverlay = new PauseOverlay();
  private wasCursorLockedBeforePause: boolean = false;
  private suppressMouseDeltaFrames: number = 0;
  private resumeFreezeActive: boolean = false;
  private resumeFreezeScreenPos: Vector2 | null = null;
  private resumeSeedCursorGamePos: Vector2 | null = null;
  private relativeAwaitingUserDelta: boolean = false;
  private masterVolumeKnob: VolumeKnob | null = null;
  private customizationDrawer: CustomizationDrawer | null = null;
  private itemCustomizationDrawer: ItemCustomizationDrawer | null = null;
  private paletteDrawer: PaletteDrawer | null = null;
  private replayObserver: ReplayObserver | null = null;
  private replayPlayer: ReplayPlayer | null = null;
  private replayEnded: boolean = false;

  private getDisplayDestRect(): {
    destX: number;
    destY: number;
    destWidth: number;
    destHeight: number;
  } {
    const vp = runtimeState.presentationViewport;
    return {
      destX: vp.x,
      destY: vp.y,
      destWidth: vp.width,
      destHeight: vp.height,
    };
  }

  constructor(
    mapData?: SoundSpaceMemoryMap,
    isStandalone: boolean = true,
    enableAutoPlay: boolean = false,
    healthModel?: HealthModel,
    startFromMs: number = 0,
    replayPlayer?: ReplayPlayer,
  ) {
    super();
    const resolvedHealthModel = healthModel ?? new SoundSpaceHealthModel();
    const mode = ModeManager.getMode();

    const finalHealthModel = mode.createHealthModel
      ? mode.createHealthModel(resolvedHealthModel)
      : resolvedHealthModel;

    const finalMapDataRaw =
      mapData && mode.getNotes
        ? { ...mapData, notes: mode.getNotes(mapData) }
        : mapData;

    let finalMapData: SoundSpaceMemoryMap | undefined = finalMapDataRaw;
    if (finalMapDataRaw && Array.isArray(finalMapDataRaw.notes)) {
      const trimAt = Math.max(0, startFromMs | 0);
      const trimmedNotes = finalMapDataRaw.notes.filter((n) => n[0] >= trimAt);
      finalMapData = {
        ...finalMapDataRaw,
        notes: trimmedNotes,
        noteCount: trimmedNotes.length,
      } as SoundSpaceMemoryMap;
    }

    this.healthModel = finalHealthModel;
    this.replayPlayer = replayPlayer ?? null;
    if (isStandalone && !this.replayPlayer) {
      this.replayObserver = new ReplayObserver(
        finalMapData ?? null,
        startFromMs,
      );
    }
    this.gameLogic = new GameLogic(
      finalMapData,
      isStandalone,
      enableAutoPlay,
      finalHealthModel,
      startFromMs,
      this.replayObserver ?? undefined,
      this.replayPlayer ? true : false,
    );
    this.gameRenderer = new GameRenderer();
    if (this.replayObserver) {
      this.gameRenderer.setNoteHitCallback((args) => {
        this.replayObserver?.recordNoteHit(
          args.noteIndex,
          args.timeMs,
          args.cursorX,
          args.cursorY,
          this.healthModel.getCurrentHealth(),
        );
      });
    }
    this.exitCooldown = new Cooldown(0.4);
    this.shouldLockCursor = isStandalone && !this.replayPlayer;
    this.autoPlayEnabled = enableAutoPlay;
    if (this.autoPlayEnabled) {
      this.autoPlayController = new AutoPlayController(finalMapData ?? null);
    }
  }

  public enablePreviewMode(): void {
    this.isPreviewMode = true;
    this.shouldLockCursor = false;
    this.cursorLocked = false;
    this.pauseOverlay.reset();
    this.gameLogic.setPreviewMode(true);
    this.quickRestart.reset();
  }

  public resetPreviewLoop(): void {
    if (!this.isPreviewMode) {
      return;
    }

    this.performRestart();
    this.quickRestart.reset();
  }

  async init(): Promise<void> {
    this.gameLogic.init();

    const preferRelativeCursor = ConfigManager.get().useRelativeCursor ?? true;
    this.cursorLocked = this.shouldLockCursor && preferRelativeCursor;

    if (!this.isPreviewMode) {
      if (this.cursorLocked) {
        DisableCursor();
      } else {
        this.cursorLocked = false;
        EnableCursor();
      }
    } else {
      this.cursorLocked = false;
    }

    this.backInstructionObject = new GameObject({ zBase: 100 });
    this.backInstructionObject.onDraw = () => {};
    this.backInstructionObject.onUpdate = () => {
      if (this.handlePauseToggle()) {
        return;
      }

      if (this.pauseOverlay.isActive) {
        this.handlePauseMenuInput();
        return;
      }

      if (IsKeyPressed(KEY_F3)) {
        this.gameLogic.toggleDebugMode();
      }

      const gameState = this.gameLogic.getGameState();

      if (!this.replayPlayer && IsKeyPressed(KEY_SPACE) && gameState.canSkip) {
        this.gameLogic.skipToNextNote();
      }

      if (
        !this.autoPlayEnabled &&
        (IsKeyPressed(KEY_GRAVE) || IsKeyPressed(KEY_Q))
      ) {
        this.startQuickRestart();
      }

      if (keybinds.isDown("back")) {
        if (!this.exitCooldown.isRunning()) {
          this.exitCooldown.start(() => {
            this.gameLogic.restoreSelectedMusicPitch();
            try {
              stopMusic();
            } catch {}
            try {
              playFx("/menuback.wav");
            } catch {}
            Rhythia.goToPreviousScene();
          });
        }
      } else {
        this.exitCooldown.reset();
      }

      if (keybinds.isPressed("increaseMouseSensitivity")) {
        this.adjustMouseSensitivity(1);
      }

      if (keybinds.isPressed("decreaseMouseSensitivity")) {
        this.adjustMouseSensitivity(-1);
      }

      if (keybinds.isPressed("toggleMouseMode")) {
        this.toggleCursorMode();
      }

      this.exitCooldown.update();
    };

    const leftX = 100;
    const fxRadius = 50;
    const bottomMargin = 60;
    const centerY = Rhythia.gameHeight - fxRadius - bottomMargin;
    this.masterVolumeKnob = new VolumeKnob(
      Vector2(leftX, centerY),
      "master",
      "small",
      "left",
    );
  }

  render(): void {
    GameObject.updateAll();

    const mapData = this.gameLogic.getMapData();
    if (!mapData?.notes) {
      GameObject.drawAll();
      return;
    }

    const settings = this.getGameSettingsFromConfig();
    const deltaSeconds = GetFrameTime();
    toastManager.update(deltaSeconds);
    this.updatePauseState(deltaSeconds);
    this.quickRestart.update(deltaSeconds, () => this.performRestart());

    const altPressed = IsKeyDown(KEY_LEFT_ALT) || IsKeyDown(KEY_RIGHT_ALT);
    const wheelMove = GetMouseWheelMove();
    if (altPressed && wheelMove !== 0) {
      const adjustingOverKnob = VolumeKnob.isActive?.() ?? false;
      if (!adjustingOverKnob) {
        const vols = getVolumes();
        const step = 0.05;
        const newMaster = Math.max(
          0,
          Math.min(1, vols.master + wheelMove * step),
        );
        if (Math.abs(newMaster - vols.master) > 1e-6) {
          setMasterVolume(newMaster);
          ConfigManager.setMasterVolume(newMaster);
        }
      }
    }

    const isFadingOut = this.quickRestart.isFadingOut();
    const isDrawerActive =
      (this.customizationDrawer?.isDrawerOpen() ?? false) ||
      (this.itemCustomizationDrawer?.isDrawerOpen() ?? false);
    const isPauseActive =
      this.pauseOverlay.isActive ||
      this.pauseOverlay.isCountdownActive ||
      isDrawerActive;

    if (!isFadingOut && !isPauseActive) {
      this.gameLogic.update(settings);
    }

    let rawMouseDelta: Vector2 | undefined;
    if (!this.autoPlayEnabled && this.cursorLocked) {
      rawMouseDelta = GetMouseDelta();
    }

    let mouseDelta: Vector2 | undefined = undefined;
    const isFreezeActive =
      isPauseActive ||
      this.resumeFreezeActive ||
      this.suppressMouseDeltaFrames > 0 ||
      this.relativeAwaitingUserDelta;
    if (!this.autoPlayEnabled && this.cursorLocked && !isFreezeActive) {
      mouseDelta = rawMouseDelta;
    }

    if (!isPauseActive && this.cursorLocked && this.relativeAwaitingUserDelta) {
      const dx = rawMouseDelta?.x ?? 0;
      const dy = rawMouseDelta?.y ?? 0;
      const dist2 = dx * dx + dy * dy;
      const threshold = 1.0;
      if (dist2 > threshold * threshold) {
        this.relativeAwaitingUserDelta = false;
      }
    }

    if (!isPauseActive && !this.cursorLocked && this.resumeFreezeActive) {
      const os = GetMousePosition();

      const ref = this.resumeFreezeScreenPos;
      if (ref) {
        const dx = os.x - ref.x;
        const dy = os.y - ref.y;
        const dist2 = dx * dx + dy * dy;
        const threshold = 3;
        if (dist2 > threshold * threshold) {
          this.resumeFreezeActive = false;
          this.resumeFreezeScreenPos = null;
        }
      } else {
        this.resumeFreezeActive = false;
      }
    }

    let mousePos: Vector2 | undefined;
    if (
      this.autoPlayEnabled &&
      this.autoPlayController &&
      !isPauseActive &&
      !this.resumeFreezeActive
    ) {
      const autoPos = this.autoPlayController.getCursorScreenPosition(
        this.gameLogic.getGameState().adjustedMsTime,
        settings,
      );
      mousePos = autoPos ?? undefined;
    } else if (
      this.cursorLocked ||
      isPauseActive ||
      this.resumeFreezeActive ||
      this.relativeAwaitingUserDelta ||
      this.suppressMouseDeltaFrames > 0
    ) {
      const { destX, destY, destWidth, destHeight } = this.getDisplayDestRect();
      const screenX =
        destX + (this.lastCursorPos.x / Rhythia.gameWidth) * destWidth;
      const screenY =
        destY + (this.lastCursorPos.y / Rhythia.gameHeight) * destHeight;
      mousePos = Vector2(screenX, screenY);
    }

    const gameState = this.gameLogic.getGameState();

    if (this.replayPlayer && !this.replayEnded) {
      try {
        const lastMs = this.replayPlayer.getLastSampleTimeMs();
        if (lastMs > 0 && gameState.adjustedMsTime >= lastMs) {
          this.replayEnded = true;
          try {
            this.gameLogic.restoreSelectedMusicPitch();
          } catch {}
          try {
            stopMusic();
          } catch {}
          try {
            playFx("/menuback.wav");
          } catch {}
          void Rhythia.goToPreviousScene();
          return;
        }
      } catch {}
    }

    const context: RenderContext = {
      gameState,
      settings,
      mapData,
      mouseDelta,
      mousePos,
      forcedCursorGamePos:
        isPauseActive ||
        this.resumeFreezeActive ||
        this.suppressMouseDeltaFrames > 0 ||
        this.relativeAwaitingUserDelta
          ? this.lastCursorPos
          : undefined,
      seedCursorGamePos: this.resumeSeedCursorGamePos ?? undefined,
      health: this.healthModel.getCurrentHealth(),
      maxHealth: this.healthModel.getMaxHealth(),
    };

    if (this.replayPlayer) {
      const rp = this.replayPlayer.getCursorGamePosition(
        gameState.adjustedMsTime,
      );
      if (rp) {
        context.forcedCursorGamePos = rp;
      }
    }

    const cursorPos = this.gameRenderer.render(context, this.gameLogic);

    if (cursorPos) {
      this.lastCursorPos = cursorPos;
    }
    if (this.replayObserver) {
      this.replayObserver.recordCursor(
        gameState.adjustedMsTime,
        this.lastCursorPos.x,
        this.lastCursorPos.y,
      );
      if (gameState.musicEnded || gameState.healthEnded) {
        try {
          this.replayObserver.saveToDisk();
        } catch {}
      }
    }
    if (this.resumeSeedCursorGamePos) {
      this.resumeSeedCursorGamePos = null;
    }

    GameObject.drawAll();
    this.exitCooldown.draw();
    this.quickRestart.draw();

    this.drawModeOverlay();
    toastManager.draw();
    this.pauseOverlay.draw();
    if (this.replayPlayer) {
      this.drawReplayBadge();
    }
  }

  private drawReplayBadge(): void {
    const iconSize = 24;
    const iconX = 20;
    const iconY = 20;
    const irisColor = { r: 180, g: 215, b: 255, a: 220 };
    const pupilColor = { r: 60, g: 80, b: 120, a: 255 };

    drawSprite(
      "/circle.png",
      Vector2(iconX, iconY),
      Vector2(iconSize, iconSize),
      irisColor,
    );
    drawSprite(
      "/solid.png",
      Vector2(iconX + iconSize * 0.3, iconY + iconSize * 0.3),
      Vector2(iconSize * 0.4, iconSize * 0.4),
      pupilColor,
    );

    drawText(
      "Replaying",
      Vector2(iconX + iconSize + 12, iconY - 2),
      22,
      { r: 220, g: 230, b: 255, a: 255 },
      "left",
    );
  }

  public renderGameAt(
    msTime: number,
    mousePos?: Vector2,
    settings?: Partial<GameSettings>,
  ): void {
    const deltaSeconds = GetFrameTime();
    this.quickRestart.update(deltaSeconds, () => this.performRestart());

    if (this.isPreviewMode) {
      this.gameLogic.setPreviewTime(msTime);
    }

    const mapData = this.gameLogic.getMapData();
    if (!mapData?.notes) return;

    const isFadingOut = this.quickRestart.isFadingOut();
    if (!isFadingOut) {
      this.gameLogic.update(settings);
    }

    const gameState = this.gameLogic.getGameState();

    if (this.isPreviewMode) {
      const lastNote = mapData.notes[mapData.notes.length - 1];
      const lastNoteTime = lastNote[0];
      if (gameState.adjustedMsTime > lastNoteTime + 300) {
        this.resetPreviewLoop();
      }
    } else if (!gameState.isStandaloneGame) {
      const lastNote = mapData.notes[mapData.notes.length - 1];
      const lastNoteTime = lastNote[0];
      if (
        this.quickRestart.isIdle() &&
        gameState.adjustedMsTime > lastNoteTime + 300
      ) {
        this.restartPreviewScene();
      }
    }

    let effectiveMousePos = mousePos;
    const effectiveSettings = settings || {};

    if (this.autoPlayEnabled && this.autoPlayController) {
      const autoPos = this.autoPlayController.getCursorScreenPosition(
        gameState.adjustedMsTime,
        effectiveSettings,
      );
      if (autoPos) {
        effectiveMousePos = autoPos;
      }
    }

    const context: RenderContext = {
      gameState,
      settings: effectiveSettings,
      mousePos: effectiveMousePos,
      mapData,
      health: this.healthModel.getCurrentHealth(),
      maxHealth: this.healthModel.getMaxHealth(),
    };

    this.gameRenderer.render(context, this.gameLogic);
    this.quickRestart.draw();
  }

  destroy(): void {
    this.gameRenderer.cleanup();

    if (this.cursorLocked) {
      EnableCursor();
      this.cursorLocked = false;
    }

    if (this.masterVolumeKnob) {
      this.masterVolumeKnob.destroy();
      this.masterVolumeKnob = null;
    }

    if (this.customizationDrawer) {
      this.customizationDrawer.destroy();
      this.customizationDrawer = null;
    }

    if (this.itemCustomizationDrawer) {
      this.itemCustomizationDrawer.destroy();
      this.itemCustomizationDrawer = null;
    }
  }

  private getGameSettingsFromConfig(): Partial<GameSettings> {
    const settings: any = {};
    const config = ConfigManager.get();

    GAME_SETTINGS_SCHEMA.forEach((setting) => {
      const configKey = toGameConfigKey(setting.key as GameSettingKey);
      settings[setting.key] = config[configKey] ?? setting.defaultValue;
    });

    const base = settings as Partial<GameSettings>;
    return ModeManager.applySettings(base);
  }

  private adjustMouseSensitivity(direction: 1 | -1): void {
    const setting = getGameSettingByKey("mouseSensitivity");
    if (!setting) {
      return;
    }

    const currentSettings = this.getGameSettingsFromConfig();
    const currentValue =
      currentSettings.mouseSensitivity ?? setting.defaultValue;
    const step = setting.step ?? 0.01;
    const newValueRaw = currentValue + direction * step;
    const newValue = this.clampValue(newValueRaw, setting.min, setting.max);

    if (Math.abs(newValue - currentValue) < 1e-6) {
      const limitWord = direction > 0 ? "maximum" : "minimum";
      toastManager.show(
        `Mouse sensitivity already at ${limitWord} (${this.formatSettingValue(
          newValue,
          step,
        )})`,
      );
      return;
    }

    ConfigManager.setGameSettings({ mouseSensitivity: newValue });

    const actionWord = direction > 0 ? "increased" : "decreased";
    toastManager.show(
      `Mouse sensitivity ${actionWord} to ${this.formatSettingValue(
        newValue,
        step,
      )}`,
    );
  }

  private toggleCursorMode(): void {
    if (!this.shouldLockCursor) {
      toastManager.show("Cursor mode toggle is disabled in this preview");
      return;
    }

    this.cursorLocked = !this.cursorLocked;

    if (this.cursorLocked) {
      DisableCursor();
      const centerX = Rhythia.gameWidth / 2;
      const centerY = Rhythia.gameHeight / 2;
      this.lastCursorPos = Vector2(centerX, centerY);
      toastManager.show("Mouse mode set to Locked (relative)");
    } else {
      EnableCursor();
      toastManager.show("Mouse mode set to Absolute");
    }

    ConfigManager.setUseRelativeCursor(this.cursorLocked);
  }

  private clampValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private formatSettingValue(value: number, step: number): string {
    const decimals = this.countFractionDigits(step);
    return value.toFixed(decimals);
  }

  private countFractionDigits(step: number): number {
    const stepString = step.toString();
    const dotIndex = stepString.indexOf(".");
    return dotIndex === -1 ? 0 : stepString.length - dotIndex - 1;
  }

  private startQuickRestart(): void {
    if (this.isPreviewMode) return;
    const mapData = this.gameLogic.getMapData();
    if (!mapData?.notes) return;
    try {
      playFx("/restart.wav");
    } catch {}
    this.quickRestart.start();
  }

  private performRestart(): void {
    if (this.isPreviewMode) {
      this.gameLogic.resetForPreviewLoop();
    } else {
      this.gameLogic.quickRestart();
    }
    this.lastCursorPos = Vector2(Rhythia.gameWidth / 2, Rhythia.gameHeight / 2);
    this.gameRenderer.resetForRestart();
    this.autoPlayController?.reset();
    this.replayObserver?.resetForRestart(
      this.gameLogic.getGameState().adjustedMsTime,
    );
  }

  private restartPreviewScene(): void {
    if (!this.quickRestart.isIdle()) {
      return;
    }
    this.performRestart();
    this.quickRestart.reset();
  }

  private handlePauseToggle(): boolean {
    if (
      this.customizationDrawer?.isDrawerOpen() ||
      this.itemCustomizationDrawer?.isDrawerOpen()
    ) {
      return false;
    }

    if (this.isPreviewMode || !IsKeyPressed(KEY_ESCAPE)) {
      return false;
    }

    if (!this.pauseOverlay.isActive) {
      if (!this.quickRestart.isIdle()) {
        return false;
      }
      this.startPause();
      return true;
    }

    if (this.pauseOverlay.isCountdownActive)
      this.pauseOverlay.cancelResumeCountdown();
    else this.pauseOverlay.startResumeCountdown();

    return true;
  }

  private startPause(): void {
    if (this.pauseOverlay.isActive || this.isPreviewMode) {
      return;
    }

    this.pauseOverlay.open();
    this.gameLogic.pauseGame();
    this.wasCursorLockedBeforePause = this.cursorLocked;
    this.resumeFreezeActive = false;
    this.resumeFreezeScreenPos = null;
    this.exitCooldown.reset();
    try {
      logger(
        `startPause: overlayActive=${this.pauseOverlay.isActive} wasLocked=${this.wasCursorLockedBeforePause}`,
      );
    } catch {}

    if (this.cursorLocked) {
      EnableCursor();
      this.cursorLocked = false;
    }
  }

  private handlePauseMenuInput(): void {
    const mousePos = this.getMousePositionInGame();
    this.pauseOverlay.handleInput(mousePos, (id) =>
      this.handlePauseButtonAction(id),
    );
  }

  private handlePauseButtonAction(id: PauseButtonId): void {
    try {
      logger(`Pause menu action: ${id}`);
    } catch {}
    switch (id) {
      case "retry": {
        this.exitPauseState({ resumeAudio: true });
        if (this.quickRestart.isIdle()) this.startQuickRestart();
        break;
      }
      case "resume": {
        if (this.pauseOverlay.isCountdownActive) {
          this.pauseOverlay.cancelResumeCountdown();
        } else {
          this.pauseOverlay.startResumeCountdown();
        }
        break;
      }
      case "settings": {
        this.pauseOverlay.close();
        this.openCustomizationDrawer();
        break;
      }
      case "menu": {
        this.exitPauseState({ resumeAudio: false });
        this.gameLogic.restoreSelectedMusicPitch();
        try {
          stopMusic();
        } catch {}
        try {
          playFx("/menuback.wav");
        } catch {}
        Rhythia.goToPreviousScene();
        break;
      }
    }
  }

  private exitPauseState(options?: { resumeAudio?: boolean }): void {
    const shouldResumeAudio = options?.resumeAudio ?? true;

    if (!this.pauseOverlay.isActive) {
      this.pauseOverlay.cancelResumeCountdown();
      return;
    }

    this.pauseOverlay.close();
    try {
      logger(`exitPauseState: resumeAudio=${shouldResumeAudio}`);
    } catch {}
    this.gameLogic.resumeGame({ resumeAudio: shouldResumeAudio });

    const preferRelative = ConfigManager.get().useRelativeCursor ?? true;
    const shouldRelockCursor = this.shouldLockCursor && preferRelative;

    if (shouldRelockCursor) {
      DisableCursor();
      this.cursorLocked = true;

      this.suppressMouseDeltaFrames = 0;
      this.relativeAwaitingUserDelta = true;
      this.resumeFreezeActive = false;
      this.resumeFreezeScreenPos = null;
      this.resumeSeedCursorGamePos = this.lastCursorPos;
    } else {
      this.cursorLocked = false;
      const { destX, destY, destWidth, destHeight } = this.getDisplayDestRect();
      const screenX =
        destX + (this.lastCursorPos.x / Rhythia.gameWidth) * destWidth;
      const screenY =
        destY + (this.lastCursorPos.y / Rhythia.gameHeight) * destHeight;
      this.resumeFreezeActive = true;
      this.resumeFreezeScreenPos = Vector2(screenX, screenY);
      this.resumeSeedCursorGamePos = null;
    }

    this.wasCursorLockedBeforePause = false;
  }

  private openCustomizationDrawer(): void {
    if (!this.customizationDrawer) {
      this.customizationDrawer = new CustomizationDrawer({
        onItemSelected: (item) => this.openItemCustomizationDrawer(item),
        onClose: () => this.handleCustomizationDrawerClosed(),
      });
    }
    this.customizationDrawer.open();
  }

  private handleCustomizationDrawerClosed(): void {
    this.pauseOverlay.open();
  }

  private openItemCustomizationDrawer(item: CustomizationInventoryItem): void {
    this.customizationDrawer?.hideForItemDrawer();

    if (item.settingsCategory === ("system-colors" as any)) {
      if (!this.paletteDrawer) {
        this.paletteDrawer = new PaletteDrawer({
          onClose: () => this.handlePaletteDrawerClosed(),
        });
      }
      this.paletteDrawer.open();
      return;
    }

    if (!this.itemCustomizationDrawer) {
      this.itemCustomizationDrawer = new ItemCustomizationDrawer({
        itemId: item.settingsCategory,
        title: item.name,
        iconPath: item.iconPath,
        onClose: () => this.handleItemDrawerClosed(),
      });
    } else {
      this.itemCustomizationDrawer.showItem(
        item.settingsCategory,
        item.name,
        item.iconPath,
      );
    }

    this.itemCustomizationDrawer.open();
  }

  private handleItemDrawerClosed(): void {
    if (this.customizationDrawer) {
      this.customizationDrawer.refreshActiveCategory();
      this.customizationDrawer.suppressNextClick(3);
      this.customizationDrawer.armUntilMouseRelease();
      this.customizationDrawer.open();
    }
  }

  private handlePaletteDrawerClosed(): void {
    if (this.customizationDrawer) {
      this.customizationDrawer.refreshActiveCategory();
      this.customizationDrawer.suppressNextClick(3);
      this.customizationDrawer.armUntilMouseRelease();
      this.customizationDrawer.open();
    }
  }

  private updatePauseState(deltaSeconds: number): void {
    this.pauseOverlay.update(deltaSeconds, () =>
      this.exitPauseState({ resumeAudio: true }),
    );
  }

  private getMousePositionInGame(): Vector2 | null {
    const screenMouse = GetMousePosition();
    const mapped = screenToGame(screenMouse.x, screenMouse.y);
    if (!mapped) return null;
    return Vector2(mapped.x, mapped.y);
  }

  private drawModeOverlay(): void {
    const iconSize = 28;
    const iconX = Rhythia.gameWidth - iconSize - 28;
    const iconY = 24;

    const iconColor = { r: 140, g: 210, b: 100, a: 255 };
    drawSprite(
      "/mods.png",
      Vector2(iconX, iconY),
      Vector2(iconSize, iconSize),
      iconColor,
    );

    const headerColor = { r: 180, g: 230, b: 170, a: 255 };
    const modeColor = { r: 110, g: 200, b: 110, a: 255 };

    const textRightX = iconX - 16;
    const modeName = ModeManager.getMode().name;

    drawText(
      "Current mode:",
      Vector2(textRightX, iconY - 4),
      24,
      headerColor,
      "right",
    );
    drawText(modeName, Vector2(textRightX, iconY + 24), 28, modeColor, "right");
  }
}
