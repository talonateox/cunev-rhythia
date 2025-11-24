import {
  Vector2,
  Vector3,
  GetMousePosition,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlScalef,
  ClearBackground,
  GetFrameTime,
  GetScreenWidth,
  GetScreenHeight,
} from "raylib";
import type { GameSettings } from "../../utils/gameSettingsSchema";
import { GameLogic, GameState } from "./GameLogic";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import { CursorRenderer } from "./atoms/CursorRenderer";
import { NoteRenderer } from "./atoms/NoteRenderer";
import { BackgroundRenderer } from "./atoms/BackgroundRenderer";
import { GameUI } from "./atoms/GameUI";
import { BongoCatDecoration } from "./panel-decorations/BongoCatDecoration";
import { WinXpTopBarDecoration } from "./panel-decorations/WinXpTopBarDecoration";
import { HitParticleSystem } from "./atoms/HitParticleSystem";
import { MissParticleSystem } from "./atoms/MissParticleSystem";
import { drawSprite } from "../../utils/sprite";
import { drawText } from "../../utils/text";
import { noteColorManager } from "../../utils/noteColorPalette";
import { Rhythia } from "../../atoms/Rhythia";
import { lerpDelta, clamp } from "../../utils/lerp";
import { UIDecoration } from "./panel-decorations/UIDecoration";
import { ModeManager } from "./modes";
import { SpriteNoteRenderer } from "./noteRenderers/spriteNoteRenderer";

export interface RenderContext {
  gameState: GameState;
  settings: Partial<GameSettings>;
  mousePos?: Vector2;
  forcedCursorGamePos?: Vector2;
  seedCursorGamePos?: Vector2;
  mapData: SoundSpaceMemoryMap | null;
  cursorTiltX?: number;
  cursorTiltY?: number;
  mouseDelta?: Vector2;
  health: number;
  maxHealth: number;
}

export class GameRenderer {
  private cursorRenderer: CursorRenderer;
  private noteRenderer: NoteRenderer;
  private backgroundRenderer: BackgroundRenderer;
  private gameUI: GameUI;
  private hitParticleSystem: HitParticleSystem;
  private missParticleSystem: MissParticleSystem;
  private onNoteHitCallback?: (args: {
    timeMs: number;
    note: [number, number, number];
    noteIndex: number;
    cursorX: number;
    cursorY: number;
  }) => void;
  private lastCursorPos: Vector2 = Vector2(
    Rhythia.gameWidth / 2,
    Rhythia.gameHeight / 2
  );
  private currentContext: RenderContext | null = null;

  
  private shakeTimeLeftMs: number = 0;
  private shakeTotalDurationMs: number = 0;
  private shakeMagnitudePx: number = 0; 
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;

  
  private lastHealthEnded: boolean = false;

  private borderVisualState = {
    currentOpacity: 0,
    currentColor: { r: 255, g: 255, b: 255 },
    lastHitTime: -1,
    lastHitColor: { r: 255, g: 255, b: 255 },
    initialized: false,
  };

  private readonly borderOpacityHoldDuration = 200; 

  constructor() {
    this.cursorRenderer = new CursorRenderer({
      cursorScale: 1.0,
      fadeRate: 0.5,
      trailLength: 50,
      trailCreateRate: 0.002,
      mouseSensitivity: 1.0,
      starTrailEnabled: 1.0,
      starTrailDensity: 8.0,
      starTrailLifetime: 0.8,
      starTrailSize: 1.0,
      starTrailDisperseDistance: 160.0,
      starTrailRainbowIntensity: 1.0,
      starTrailMaxOpacity: 1.0,
      customCursorEnabled: 0.0,
      customCursorOpacity: 1.0,
      customCursorRotationSpeed: 180.0,
      customCursorTrailEnabled: 0.0,
      spaceCursorEnabled: 0.0,
      spaceStarDensity: 16,
      spaceStarLifetime: 0.6,
      spaceStarSize: 0.6,
      spaceStarMaxOpacity: 0.9,
      spaceRainbowRate: 4.4,
      spaceRainbowOffset: 200,
    });

    const defaultNoteRenderer = new SpriteNoteRenderer({
      squareScale: 1.0,
      noteMaxOpacity: 1.0,
    });
    this.noteRenderer = ModeManager.getNoteRenderer(defaultNoteRenderer);

    this.backgroundRenderer = new BackgroundRenderer();

    this.gameUI = new GameUI();

    const bongoCat = new BongoCatDecoration();
    this.gameUI.addDecoration(bongoCat as UIDecoration);

    
    const xpTopBar = new WinXpTopBarDecoration();
    this.gameUI.addDecoration(xpTopBar as UIDecoration);

    this.hitParticleSystem = new HitParticleSystem();
    this.missParticleSystem = new MissParticleSystem();
  }

  private renderBackgroundThread(context: RenderContext): void {
    const { gameState, settings } = context;

    const clearRed = Math.round(settings.screenClearRed ?? 0);
    const clearGreen = Math.round(settings.screenClearGreen ?? 0);
    const clearBlue = Math.round(settings.screenClearBlue ?? 0);
    ClearBackground({ r: clearRed, g: clearGreen, b: clearBlue, a: 255 });

    const backgroundOpacity = settings.backgroundOpacity ?? 1.0;

    const rayOpacity = settings.rayOpacity ?? 1.0;
    const chevronOpacity = settings.chevronOpacity ?? 0.8;
    if (backgroundOpacity === 0 && rayOpacity === 0 && chevronOpacity === 0)
      return;

    const approachDistance = settings.approachDistance ?? 20;
    const farDistance = approachDistance * 100;
    const backgroundTiltRate = settings.backgroundTiltRate ?? 1.0;

    const cursorGameX = this.lastCursorPos.x;
    const cursorGameY = this.lastCursorPos.y;
    const rawNormalizedMouseX = cursorGameX / Rhythia.gameWidth - 0.5;
    const rawNormalizedMouseY = cursorGameY / Rhythia.gameHeight - 0.5;
    const tiltAmount = settings.tiltAmount ?? 2;
    const cameraTiltX = rawNormalizedMouseX * tiltAmount;
    const cameraTiltY = rawNormalizedMouseY * tiltAmount;

    this.backgroundRenderer.renderBackground(
      gameState.currentMsTime,
      farDistance,
      settings,
      backgroundOpacity,
      cameraTiltX * backgroundTiltRate,
      cameraTiltY * backgroundTiltRate
    );
  }

  public render(context: RenderContext, gameLogic: GameLogic): Vector2 {
    const { gameState, settings, mousePos, mapData } = context;

    if (!mapData?.notes) {
      return Vector2(0, 0);
    }

    this.currentContext = context;
    this.renderBackgroundThread(this.currentContext!);

    const mouse = mousePos || GetMousePosition();
    const {
      cameraTiltX,
      cameraTiltY,
      playfieldScale,
      gameCenterX,
      gameCenterY,
      playfieldDistance,
    } = this.calculateTransforms(mouse, settings);

    
    if (!this.lastHealthEnded && gameState.healthEnded) {
      this.triggerShake(24, 900);
    }
    this.lastHealthEnded = gameState.healthEnded;

    
    const deltaShakeMs = GetFrameTime() * 1000;
    this.updateShake(deltaShakeMs);

    
    rlPushMatrix();
    if (this.shakeTimeLeftMs > 0) {
      rlTranslatef(this.shakeOffsetX, this.shakeOffsetY, 0);
    }
    this.applySceneTransforms(
      cameraTiltX,
      cameraTiltY,
      playfieldScale,
      gameCenterX,
      gameCenterY
    );

    this.renderBorder(gameState, settings, gameCenterX, gameCenterY);
    this.updateRendererConfigs(settings);

    const cursorPos = this.prepareCursor(
      gameState,
      cameraTiltX,
      cameraTiltY,
      mouse,
      playfieldScale,
      gameCenterX,
      gameCenterY,
      settings,
      context.mouseDelta,
      context.forcedCursorGamePos,
      context.seedCursorGamePos
    );

    this.lastCursorPos = cursorPos;

    const modeForPre = ModeManager.getMode();
    const modeForPost = ModeManager.getMode();

    modeForPre.renderExtras?.("preNotes", context, this, gameLogic);

    this.renderNotes(context, cursorPos, settings, gameLogic);
    this.drawCursor();
    this.updateAndRenderParticles(settings);
    this.updateAndRenderMissParticles(settings);

    modeForPost.renderExtras?.("postNotes", context, this, gameLogic);
    rlPopMatrix();

    
    rlPushMatrix();
    if (this.shakeTimeLeftMs > 0) {
      rlTranslatef(this.shakeOffsetX, this.shakeOffsetY, 0);
    }
    
    const distanceScaleOnly = 300 / (playfieldDistance || 300);
    this.applySceneTransforms(
      cameraTiltX,
      cameraTiltY,
      distanceScaleOnly,
      gameCenterX,
      gameCenterY
    );
    this.renderUI(
      context,
      cameraTiltX,
      cameraTiltY,
      playfieldDistance,
      gameLogic
    );
    const modeForUi = ModeManager.getMode();
    modeForUi.renderExtras?.("uiOverlay", context, this, gameLogic);
    rlPopMatrix();

    return cursorPos;
  }

  

  private calculateTransforms(
    mouse: Vector2,
    settings: Partial<GameSettings>
  ): {
    cameraTiltX: number;
    cameraTiltY: number;
    playfieldScale: number;
    gameCenterX: number;
    gameCenterY: number;
    playfieldDistance: number;
  } {
    const playfieldDistance = settings.playfieldDistance ?? 300;
    const userScale = settings.playfieldScale ?? 1.0;
    const playfieldScale = (300 / playfieldDistance) * userScale;
    const gameCenterX = Rhythia.gameWidth / 2;
    const gameCenterY = Rhythia.gameHeight / 2;

    
    
    const rawNormalizedMouseX = this.lastCursorPos.x / Rhythia.gameWidth - 0.5;
    const rawNormalizedMouseY = this.lastCursorPos.y / Rhythia.gameHeight - 0.5;
    const tiltAmount = settings.tiltAmount ?? 2;
    const cameraTiltX = rawNormalizedMouseX * tiltAmount;
    const cameraTiltY = rawNormalizedMouseY * tiltAmount;

    return {
      cameraTiltX,
      cameraTiltY,
      playfieldScale,
      gameCenterX,
      gameCenterY,
      playfieldDistance,
    };
  }

  private applySceneTransforms(
    cameraTiltX: number,
    cameraTiltY: number,
    playfieldScale: number,
    gameCenterX: number,
    gameCenterY: number
  ): void {
    rlTranslatef(-cameraTiltX * 100, -cameraTiltY * 100, 0);
    rlTranslatef(gameCenterX, gameCenterY, 0);
    rlScalef(playfieldScale, playfieldScale, playfieldScale);
    rlTranslatef(-gameCenterX, -gameCenterY, 0);
  }

  private renderBorder(
    gameState: GameState,
    settings: Partial<GameSettings>,
    gameCenterX: number,
    gameCenterY: number
  ): void {
    const borderAppearance = this.getBorderAppearance(
      settings,
      gameState.adjustedMsTime
    );
    const borderOpacity = borderAppearance.opacity;
    const borderColor = borderAppearance.color;

    rlPushMatrix();
    const borderSize = 320 * 1.0;
    const borderOffset = borderSize / 2;
    rlTranslatef(gameCenterX - borderOffset, gameCenterY - borderOffset, 0);

    drawSprite(
      "/border.png",
      Vector3(0, 0, 0),
      Vector2(borderSize, borderSize),
      {
        r: Math.round(borderColor.r),
        g: Math.round(borderColor.g),
        b: Math.round(borderColor.b),
        a: Math.round(255 * borderOpacity),
      }
    );

    rlPopMatrix();
  }

  private getBorderAppearance(
    settings: Partial<GameSettings>,
    currentTime: number
  ): { opacity: number; color: { r: number; g: number; b: number } } {
    const targetOpacity = settings.borderTargetOpacity ?? 1.0;
    const staleOpacity = settings.borderStaleOpacity ?? 0.35;

    if (!this.borderVisualState.initialized) {
      this.borderVisualState.currentOpacity = staleOpacity;
      this.borderVisualState.currentColor = { r: 255, g: 255, b: 255 };
      this.borderVisualState.initialized = true;
    }

    const timeSinceHit =
      this.borderVisualState.lastHitTime >= 0
        ? currentTime - this.borderVisualState.lastHitTime
        : Infinity;

    const desiredOpacity =
      timeSinceHit <= this.borderOpacityHoldDuration
        ? targetOpacity
        : staleOpacity;

    const baseHighlightColor = this.mixColor(
      this.borderVisualState.lastHitColor,
      { r: 255, g: 255, b: 255 },
      0.6
    );

    const desiredColor =
      timeSinceHit <= this.borderOpacityHoldDuration
        ? baseHighlightColor
        : { r: 255, g: 255, b: 255 };

    const opacityLerpRate =
      desiredOpacity > this.borderVisualState.currentOpacity ? 0.25 : 0.08;
    const colorLerpRate =
      timeSinceHit <= this.borderOpacityHoldDuration ? 0.35 : 0.15;

    this.borderVisualState.currentOpacity = lerpDelta(
      this.borderVisualState.currentOpacity,
      desiredOpacity,
      opacityLerpRate
    );

    this.borderVisualState.currentColor = this.lerpColorDelta(
      this.borderVisualState.currentColor,
      desiredColor,
      colorLerpRate
    );

    return {
      opacity: clamp(this.borderVisualState.currentOpacity, 0, 1),
      color: {
        r: clamp(this.borderVisualState.currentColor.r, 0, 255),
        g: clamp(this.borderVisualState.currentColor.g, 0, 255),
        b: clamp(this.borderVisualState.currentColor.b, 0, 255),
      },
    };
  }

  private lerpColorDelta(
    current: { r: number; g: number; b: number },
    target: { r: number; g: number; b: number },
    rate: number
  ): { r: number; g: number; b: number } {
    return {
      r: lerpDelta(current.r, target.r, rate),
      g: lerpDelta(current.g, target.g, rate),
      b: lerpDelta(current.b, target.b, rate),
    };
  }

  private mixColor(
    source: { r: number; g: number; b: number },
    target: { r: number; g: number; b: number },
    t: number
  ): { r: number; g: number; b: number } {
    return {
      r: source.r + (target.r - source.r) * t,
      g: source.g + (target.g - source.g) * t,
      b: source.b + (target.b - source.b) * t,
    };
  }

  private updateRendererConfigs(settings: Partial<GameSettings>): void {
    this.cursorRenderer.updateConfig({
      cursorScale: settings.cursorScale ?? 1.0,
      cursorOpacity: settings.cursorOpacity ?? 1.0,
      fadeRate: settings.cursorTrailFadeRate ?? 0.5,
      mouseBoundRate: settings.mouseBoundRate ?? 1.0,
      mouseSensitivity: settings.mouseSensitivity ?? 1.0,
      rainbowRate: settings.rainbowRate ?? 0.0,
      rainbowOffset: settings.rainbowOffset ?? 0.0,
      cursorRainbowEnabled: settings.cursorRainbowEnabled ?? 1.0,

      starTrailEnabled: settings.starTrailEnabled ?? 1.0,
      starTrailDensity: settings.starTrailDensity ?? 8.0,
      starTrailLifetime: settings.starTrailLifetime ?? 0.8,
      starTrailSize: settings.starTrailSize ?? 1.0,
      starTrailDisperseDistance: settings.starTrailDisperseDistance ?? 160.0,
      starTrailRainbowIntensity: settings.starTrailRainbowIntensity ?? 1.0,
      starTrailMaxOpacity: settings.starTrailMaxOpacity ?? 1.0,

      customCursorEnabled: settings.customCursorEnabled ?? 0.0,
      customCursorOpacity: settings.customCursorOpacity ?? 1.0,
      customCursorRotationSpeed: settings.customCursorRotationSpeed ?? 180.0,
      customCursorTrailEnabled: settings.customCursorTrailEnabled ?? 0.0,

      spaceCursorEnabled: settings.spaceCursorEnabled ?? 0.0,
      spaceStarDensity: settings.spaceStarDensity ?? 16,
      spaceStarLifetime: settings.spaceStarLifetime ?? 0.6,
      spaceStarSize: settings.spaceStarSize ?? 0.6,
      spaceStarMaxOpacity: settings.spaceStarMaxOpacity ?? 0.9,
      spaceRainbowRate: settings.spaceRainbowRate ?? 4.4,
      spaceRainbowOffset: settings.spaceRainbowOffset ?? 200,
    });

    this.noteRenderer.updateConfig({
      squareScale: settings.squareScale ?? 1.0,
      noteMaxOpacity: settings.noteMaxOpacity ?? 1.0,
    });
  }

  private prepareCursor(
    gameState: GameState,
    cameraTiltX: number,
    cameraTiltY: number,
    mouse: Vector2,
    playfieldScale: number,
    gameCenterX: number,
    gameCenterY: number,
    settings: Partial<GameSettings>,
    mouseDelta?: Vector2,
    forcedCursorGamePos?: Vector2,
    seedCursorGamePos?: Vector2
  ): Vector2 {
    this.cursorRenderer.prepareForRender(
      0,
      cameraTiltX,
      cameraTiltY,
      mouse,
      gameState.adjustedMsTime,
      playfieldScale,
      gameCenterX,
      gameCenterY,
      mouseDelta,
      forcedCursorGamePos,
      seedCursorGamePos
    );

    return this.cursorRenderer.getCursorPosition();
  }

  private drawCursor(): void {
    this.cursorRenderer.drawPreparedCursor();
  }

  private renderNotes(
    context: RenderContext,
    cursorPos: Vector2,
    settings: Partial<GameSettings>,
    gameLogic: GameLogic
  ): void {
    const { gameState, mapData } = context;
    if (!mapData?.notes) return;

    const approachRate = settings.approachRate ?? 10;
    const approachDistance = settings.approachDistance ?? 20;
    const approachTime = approachDistance / approachRate;
    
    const speed = ModeManager.getMode().musicPitch ?? 1;
    const visibilityWindow = approachTime * 1000 * speed;

    const notes = mapData.notes;
    const visibleRange = gameLogic
      ? gameLogic.findVisibleNotesRange(visibilityWindow)
      : this.findVisibleNotesRange(
          notes,
          gameState.adjustedMsTime,
          visibilityWindow
        );

    for (let i = visibleRange.endIndex - 1; i >= visibleRange.startIndex; i--) {
      const note = notes[i];

      const hitResult = gameLogic.checkNoteHit(
        note,
        i,
        cursorPos.x,
        cursorPos.y,
        settings.squareScale ?? 1.0,
        settings.playfieldScale ?? 1.0
      );

      if (hitResult.newlyHit) {
        this.handleNoteHit(note, i, gameState.adjustedMsTime);
      }

      if (hitResult.newlyMissed) {
        this.handleNoteMiss(note);
      }

      if (hitResult.hit && gameState.adjustedMsTime >= note[0]) {
        continue;
      }

      if (context.gameState.debugMode) {
        const noteX = Rhythia.gameWidth / 2 + (note[1] - 1) * 100;
        const noteY = Rhythia.gameHeight / 2 + (note[2] - 1) * 100;
        const hitboxScale = ModeManager.getMode().hitboxScale ?? 1.0;
        const noteHalfSize = 50 * hitboxScale; 
        const cursorHalfSize = gameLogic.noteHitDetector.cursorHitBox;

        this.drawRectOutline(
          noteX,
          noteY,
          noteHalfSize,
          { r: 255, g: 60, b: 60, a: 200 },
          2
        );

        this.drawRectOutline(
          cursorPos.x,
          cursorPos.y,
          cursorHalfSize,
          { r: 60, g: 255, b: 120, a: 200 },
          2
        );
      }

      this.noteRenderer.renderNote(
        note,
        gameState.adjustedMsTime,
        approachRate,
        approachDistance,
        settings.fadeIn ?? 20,
        (settings.fadeOut ?? 1) === 1,
        (settings.pushback ?? 1) === 1,
        speed,
        hitResult,
        i
      );
    }
  }

  private findVisibleNotesRange(
    notes: [number, number, number][],
    adjustedMsTime: number,
    visibilityWindow: number
  ): { startIndex: number; endIndex: number } {
    let startIndex = 0;
    let endIndex = notes.length;

    for (let i = 0; i < notes.length; i++) {
      if (notes[i][0] >= adjustedMsTime - visibilityWindow) {
        startIndex = i;
        break;
      }
    }

    for (let i = startIndex; i < notes.length; i++) {
      if (notes[i][0] > adjustedMsTime + visibilityWindow) {
        endIndex = i;
        break;
      }
    }

    return { startIndex, endIndex };
  }

  private handleNoteHit(
    note: [number, number, number],
    noteIndex: number,
    adjustedMsTime: number
  ): void {
    const noteColor = noteColorManager.getColorForNoteIndex(noteIndex);
    this.backgroundRenderer.setAccentColor(noteColor);
    this.cursorRenderer.triggerHitAnimation(adjustedMsTime);
    this.borderVisualState.lastHitTime = adjustedMsTime;
    this.borderVisualState.lastHitColor = {
      r: noteColor.r,
      g: noteColor.g,
      b: noteColor.b,
    };

    const noteX = Rhythia.gameWidth / 2 + (note[1] - 1) * 100;
    const noteY = Rhythia.gameHeight / 2 + (note[2] - 1) * 100;
    const burstEnabled =
      this.currentContext?.settings?.burstParticleEnabled ?? 1.0;
    const burstIntensity =
      (this.currentContext?.settings?.burstParticleIntensity ?? 1.0) *
      burstEnabled;
    this.hitParticleSystem.setIntensity(burstIntensity);
    this.hitParticleSystem.spawnParticles(noteX, noteY, noteColor);

    try {
      const cx = this.lastCursorPos.x;
      const cy = this.lastCursorPos.y;
      this.onNoteHitCallback?.({
        timeMs: adjustedMsTime,
        note,
        noteIndex,
        cursorX: cx,
        cursorY: cy,
      });
    } catch {}
  }

  private handleNoteMiss(note: [number, number, number]): void {
    const noteX = Rhythia.gameWidth / 2 + (note[1] - 1) * 100;
    const noteY = Rhythia.gameHeight / 2 + (note[2] - 1) * 100;
    this.missParticleSystem.spawnMissParticle(noteX, noteY);
    
    this.triggerShake(6, 120);
  }

  private updateAndRenderParticles(settings: Partial<GameSettings>): void {
    const hitOpacity = settings.hitParticleOpacity ?? 0.4;

    if (hitOpacity) {
      const deltaTimeMs = GetFrameTime() * 1000;
      const burstEnabled = settings.burstParticleEnabled ?? 1.0;
      const burstIntensity =
        (settings.burstParticleIntensity ?? 1.0) * burstEnabled;

      this.hitParticleSystem.setIntensity(burstIntensity);
      this.hitParticleSystem.update(deltaTimeMs);
      this.hitParticleSystem.render(hitOpacity);
    }
  }

  private updateAndRenderMissParticles(settings: Partial<GameSettings>): void {
    const missOpacity = settings.missParticleOpacity ?? 0.8;
    if (missOpacity) {
      const deltaTimeMs = GetFrameTime() * 1000;
      this.missParticleSystem.update(deltaTimeMs);
      this.missParticleSystem.render(missOpacity);
    }
  }

  private renderUI(
    context: RenderContext,
    cameraTiltX: number,
    cameraTiltY: number,
    playfieldDistance: number,
    gameLogic: GameLogic
  ): void {
    const { mapData, gameState, settings } = context;
    if (!mapData?.notes) return;

    const stats = gameLogic.getStats();
    this.gameUI.updateStats(stats.hits, stats.misses, stats.combo);
    this.gameUI.render(
      mapData,
      gameState.currentMsTime,
      mapData.notes.length,
      playfieldDistance,
      cameraTiltX,
      cameraTiltY,
      settings,
      context.health,
      context.maxHealth
    );

    if (gameState.canSkip && gameState.isStandaloneGame) {
      this.renderSkipPrompt();
    }
  }

  private renderSkipPrompt(): void {
    const centerX = Rhythia.gameWidth / 2;
    const bottomY = Rhythia.gameHeight / 2 + 200; 

    const text = "Press SPACE to skip";
    const fontSize = 20;
    const opacity = Math.abs(Math.sin(Date.now() * 0.003)) * 0.5 + 0.5; 

    drawText(
      text,
      Vector2(centerX, bottomY),
      fontSize,
      { r: 255, g: 255, b: 255, a: Math.round(255 * opacity) },
      "center"
    );
  }

  public resetForRestart(): void {
    this.borderVisualState.currentOpacity = 0;
    this.borderVisualState.currentColor = { r: 255, g: 255, b: 255 };
    this.borderVisualState.lastHitTime = -1;
    this.borderVisualState.lastHitColor = { r: 255, g: 255, b: 255 };
    this.borderVisualState.initialized = false;
    
    this.lastHealthEnded = false;
    this.shakeTimeLeftMs = 0;
    this.shakeTotalDurationMs = 0;
    this.shakeMagnitudePx = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  private drawRectOutline(
    centerX: number,
    centerY: number,
    halfSize: number,
    color: { r: number; g: number; b: number; a: number },
    thickness: number = 2
  ): void {
    const size = halfSize * 2;

    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY - halfSize),
      Vector2(size, thickness),
      color
    );

    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY + halfSize - thickness),
      Vector2(size, thickness),
      color
    );

    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY - halfSize),
      Vector2(thickness, size),
      color
    );

    drawSprite(
      "/solid.png",
      Vector2(centerX + halfSize - thickness, centerY - halfSize),
      Vector2(thickness, size),
      color
    );
  }

  public cleanup(): void {
    this.backgroundRenderer.destroy();
  }

  private triggerShake(magnitudePx: number, durationMs: number): void {
    
    this.shakeMagnitudePx = Math.max(this.shakeMagnitudePx, magnitudePx);
    this.shakeTotalDurationMs = Math.max(this.shakeTotalDurationMs, durationMs);
    this.shakeTimeLeftMs = Math.max(this.shakeTimeLeftMs, durationMs);
  }

  private updateShake(deltaMs: number): void {
    if (this.shakeTimeLeftMs <= 0) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      return;
    }
    this.shakeTimeLeftMs = Math.max(0, this.shakeTimeLeftMs - deltaMs);
    const t =
      this.shakeTotalDurationMs > 0
        ? this.shakeTimeLeftMs / this.shakeTotalDurationMs
        : 0;
    const intensity = Math.pow(Math.max(0, t), 0.7);
    const maxOffset = this.shakeMagnitudePx * intensity;
    this.shakeOffsetX = (Math.random() * 2 - 1) * maxOffset;
    this.shakeOffsetY = (Math.random() * 2 - 1) * maxOffset;
  }

  public setNoteHitCallback(
    cb:
      | ((args: {
          timeMs: number;
          note: [number, number, number];
          noteIndex: number;
          cursorX: number;
          cursorY: number;
        }) => void)
      | undefined
  ): void {
    this.onNoteHitCallback = cb;
  }
}
