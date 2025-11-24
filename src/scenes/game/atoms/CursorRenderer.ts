import {
  Vector2,
  GetMousePosition,
  GetScreenWidth,
  GetScreenHeight,
  GetFrameTime,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  GetScreenToWorldRayEx,
  Camera3D,
} from "raylib";
import * as fs from "fs";
import * as path from "path";
import { Rhythia } from "../../../atoms/Rhythia";
import { drawSprite, removeTextureFromCache } from "../../../utils/sprite";
import { CursorRendererConfig } from "../cursorEffects/types";
import {
  CursorEffect,
  CursorEffectContext,
} from "../cursorEffects/CursorEffect";
import { TrailEffect } from "../cursorEffects/TrailEffect";
import { StarTrailEffect } from "../cursorEffects/StarTrailEffect";
import { SpaceCursorEffect } from "../cursorEffects/SpaceCursorEffect";
import { CustomCursorTrailEffect } from "../cursorEffects/CustomCursorTrailEffect";
import { screenToRender, getRenderTargetSize } from "../../../atoms/sysutils/rendering";

type PreparedCursorState = {
  planeZ: number;
  cursorPosition: Vector2;
  effectContext: CursorEffectContext;
  opacity: number;
  totalScale: number;
  customCursorEnabled: boolean;
  customCursorOpacity: number;
};

export class CursorRenderer {
  private config: CursorRendererConfig;
  private lastCursorPosition: Vector2 = Vector2(0, 0);
  private virtualCursorX: number | null = null;
  private virtualCursorY: number | null = null;
  private effects: CursorEffect[];
  private customCursorAngle = 0;
  private customCursorPath: string | null = null;
  private customCursorPathMtime = 0;
  private lastCustomCursorCheck = 0;
  private readonly customCursorCacheKey = "custom-cursor-texture";
  private preparedState: PreparedCursorState | null = null;

  private scaleAnimation = {
    startTime: -1,
    duration: 50, 
    baseScale: 1.0,
    maxScale: 1.02, 
  };

  constructor(config: CursorRendererConfig) {
    this.config = { ...config };
    this.effects = [
      new TrailEffect(),
      new SpaceCursorEffect(),
      new StarTrailEffect(),
      new CustomCursorTrailEffect(),
    ];
    this.effects.forEach((effect) => effect.updateConfig?.(this.config));
  }

  public triggerHitAnimation(currentTime: number): void {
    this.scaleAnimation.startTime = currentTime;
  }

  private getCurrentScale(currentTime: number): number {
    if (this.scaleAnimation.startTime < 0) {
      return this.scaleAnimation.baseScale;
    }

    const elapsed = currentTime - this.scaleAnimation.startTime;
    if (elapsed >= this.scaleAnimation.duration) {
      return this.scaleAnimation.baseScale;
    }

    const progress = elapsed / this.scaleAnimation.duration;
    const easeProgress = Math.sin(progress * Math.PI); 
    const scale =
      this.scaleAnimation.baseScale +
      (this.scaleAnimation.maxScale - this.scaleAnimation.baseScale) *
        easeProgress;

    return scale;
  }

  public render(
    planeZ: number,
    cameraTiltX: number = 0,
    cameraTiltY: number = 0,
    screenMousePos?: Vector2,
    currentTime?: number,
    playfieldScale: number = 1.0,
    gameCenterX: number = 0,
    gameCenterY: number = 0,
    mouseDelta?: Vector2
  ): void {
    this.prepareForRender(
      planeZ,
      cameraTiltX,
      cameraTiltY,
      screenMousePos,
      currentTime,
      playfieldScale,
      gameCenterX,
      gameCenterY,
      mouseDelta
    );
    this.drawPreparedCursor();
  }

  public prepareForRender(
    planeZ: number,
    cameraTiltX: number = 0,
    cameraTiltY: number = 0,
    screenMousePos?: Vector2,
    currentTime?: number,
    playfieldScale: number = 1.0,
    gameCenterX: number = 0,
    gameCenterY: number = 0,
    mouseDelta?: Vector2,
    overrideGameCursor?: Vector2,
    seedCursorGamePos?: Vector2
  ): Vector2 {
    const deltaTime = GetFrameTime();
    this.updateCustomCursorState();

    const mousePos = screenMousePos || GetMousePosition();
    const { renderWidth, renderHeight } = getRenderTargetSize();
    const mappedToRender = screenToRender(mousePos.x, mousePos.y, true);
    const renderMouseX = mappedToRender.x;
    const renderMouseY = mappedToRender.y;

    const mouseRay = GetScreenToWorldRayEx(
      Vector2(renderMouseX, renderMouseY),
      Rhythia.camera as Camera3D,
      renderWidth,
      renderHeight
    );

    const t = (planeZ - mouseRay.position.z) / mouseRay.direction.z;
    const rayWorldX = mouseRay.position.x + t * mouseRay.direction.x;
    const rayWorldY = mouseRay.position.y + t * mouseRay.direction.y;

    const topLeft = GetScreenToWorldRayEx(
      Vector2(0, 0),
      Rhythia.camera as Camera3D,
      renderWidth,
      renderHeight
    );
    const topRight = GetScreenToWorldRayEx(
      Vector2(renderWidth, 0),
      Rhythia.camera as Camera3D,
      renderWidth,
      renderHeight
    );
    const bottomLeft = GetScreenToWorldRayEx(
      Vector2(0, renderHeight),
      Rhythia.camera as Camera3D,
      renderWidth,
      renderHeight
    );

    const t0 = -topLeft.position.z / topLeft.direction.z;
    const t1 = -topRight.position.z / topRight.direction.z;
    const t2 = -bottomLeft.position.z / bottomLeft.direction.z;

    const worldX0 = topLeft.position.x + t0 * topLeft.direction.x;
    const worldY0 = topLeft.position.y + t0 * topLeft.direction.y;
    const worldX1 = topRight.position.x + t1 * topRight.direction.x;
    const worldY2 = bottomLeft.position.y + t2 * bottomLeft.direction.y;

    const scaleX = (worldX1 - worldX0) / Rhythia.gameWidth;
    const scaleY = (worldY2 - worldY0) / Rhythia.gameHeight;

    let cursorGameX = (rayWorldX - worldX0) / scaleX + cameraTiltX * 100;
    let cursorGameY = (rayWorldY - worldY0) / scaleY + cameraTiltY * 100;

    if (playfieldScale !== 1.0) {
      cursorGameX = (cursorGameX - gameCenterX) / playfieldScale + gameCenterX;
      cursorGameY = (cursorGameY - gameCenterY) / playfieldScale + gameCenterY;
    }

    if (!overrideGameCursor && mouseDelta) {
      if (this.virtualCursorX === null || this.virtualCursorY === null) {
        if (seedCursorGamePos) {
          this.virtualCursorX = seedCursorGamePos.x;
          this.virtualCursorY = seedCursorGamePos.y;
        } else {
          this.virtualCursorX = cursorGameX;
          this.virtualCursorY = cursorGameY;
        }
      }

      const screenWidth = GetScreenWidth();
      const screenHeight = GetScreenHeight();
      const gameAspect = Rhythia.gameWidth / Rhythia.gameHeight;
      const screenAspect = screenWidth / screenHeight;

      let deltaScaleX: number;
      let deltaScaleY: number;

      if (screenAspect > gameAspect) {
        deltaScaleY = Rhythia.gameHeight / screenHeight;
        deltaScaleX = deltaScaleY;
      } else {
        deltaScaleX = Rhythia.gameWidth / screenWidth;
        deltaScaleY = deltaScaleX;
      }

      const sensitivity = this.config.mouseSensitivity ?? 1.0;
      const scaledDeltaX = mouseDelta.x * deltaScaleX * sensitivity;
      const scaledDeltaY = mouseDelta.y * deltaScaleY * sensitivity;

      const mouseBoundRate = this.config.mouseBoundRate ?? 1.0;
      const gameFieldSize = 300; 
      const centerX = Rhythia.gameWidth / 2;
      const centerY = Rhythia.gameHeight / 2;
      const boundSize = (gameFieldSize / 2) * mouseBoundRate;

      this.virtualCursorX = Math.max(
        centerX - boundSize,
        Math.min(centerX + boundSize, this.virtualCursorX + scaledDeltaX)
      );
      this.virtualCursorY = Math.max(
        centerY - boundSize,
        Math.min(centerY + boundSize, this.virtualCursorY + scaledDeltaY)
      );

      cursorGameX = this.virtualCursorX;
      cursorGameY = this.virtualCursorY;
    } else {
      this.virtualCursorX = null;
      this.virtualCursorY = null;
    }

    if (!mouseDelta) {
      const mouseBoundRate = this.config.mouseBoundRate ?? 1.0;
      const gameFieldSize = 300; 
      const centerX = Rhythia.gameWidth / 2;
      const centerY = Rhythia.gameHeight / 2;
      const boundSize = (gameFieldSize / 2) * mouseBoundRate;

      cursorGameX = Math.max(
        centerX - boundSize,
        Math.min(centerX + boundSize, cursorGameX)
      );
      cursorGameY = Math.max(
        centerY - boundSize,
        Math.min(centerY + boundSize, cursorGameY)
      );
    }

    if (overrideGameCursor) {
      cursorGameX = overrideGameCursor.x;
      cursorGameY = overrideGameCursor.y;
    }

    const cursorPosition = Vector2(cursorGameX, cursorGameY);
    this.lastCursorPosition = cursorPosition;

    this.config.customCursorTexturePath = this.customCursorPath ?? undefined;
    this.config.customCursorCurrentAngle = this.customCursorAngle;

    const effectContext: CursorEffectContext = {
      deltaTime,
      cursorPosition,
      config: this.config,
      currentTime: currentTime ?? 0,
    };

    this.effects.forEach((effect) => effect.update(effectContext));

    const opacity = this.config.cursorOpacity ?? 1.0;
    const customCursorEnabled = (this.config.customCursorEnabled ?? 0) >= 0.5;
    const customCursorOpacity = this.clamp(
      this.config.customCursorOpacity ?? 1.0,
      0,
      1
    );
    const rotationSpeed = this.config.customCursorRotationSpeed ?? 0;
    if (!customCursorEnabled || rotationSpeed === 0) {
      this.customCursorAngle = 0;
    } else {
      this.customCursorAngle =
        (this.customCursorAngle + rotationSpeed * deltaTime) % 360;
    }
    const animationScale = currentTime
      ? this.getCurrentScale(currentTime)
      : 1.0;
    const totalScale = this.config.cursorScale * animationScale;

    this.preparedState = {
      planeZ,
      cursorPosition,
      effectContext,
      opacity,
      totalScale,
      customCursorEnabled,
      customCursorOpacity,
    };

    return this.lastCursorPosition;
  }

  public drawPreparedCursor(): void {
    if (!this.preparedState) {
      return;
    }

    const {
      planeZ,
      cursorPosition,
      effectContext,
      opacity,
      totalScale,
      customCursorEnabled,
      customCursorOpacity,
    } = this.preparedState;

    rlPushMatrix();
    rlTranslatef(0, 0, planeZ);

    this.effects.forEach((effect) => effect.render(effectContext));

    const drewCustomCursor =
      customCursorEnabled &&
      this.customCursorPath &&
      customCursorOpacity > 0.01;

    if (drewCustomCursor) {
      const cursorAlpha = Math.round(255 * opacity * customCursorOpacity);
      drawSprite(
        this.customCursorPath!,
        cursorPosition,
        Vector2(8 * totalScale, 8 * totalScale),
        { r: 255, g: 255, b: 255, a: cursorAlpha },
        this.customCursorCacheKey,
        true,
        true,
        this.customCursorAngle,
        Vector2(4 * totalScale, 4 * totalScale)
      );
    }

    if (!drewCustomCursor) {
      drawSprite(
        "/circle.png",
        Vector2(
          cursorPosition.x - 4 * totalScale,
          cursorPosition.y - 4 * totalScale
        ),
        Vector2(8 * totalScale, 8 * totalScale),
        { r: 255, g: 255, b: 255, a: Math.round(255 * opacity) }
      );
    }

    rlPopMatrix();
    this.preparedState = null;
  }

  public updateConfig(config: Partial<CursorRendererConfig>): void {
    this.config = { ...this.config, ...config };
    this.effects.forEach((effect) => effect.updateConfig?.(config));
  }

  public getCursorPosition(): Vector2 {
    return this.lastCursorPosition;
  }
  private updateCustomCursorState(): void {
    const now = Date.now();
    if (now - this.lastCustomCursorCheck < 1000) {
      return;
    }
    this.lastCustomCursorCheck = now;

    const previousPath = this.customCursorPath;
    const previousMtime = this.customCursorPathMtime;
    const resolved = this.findCustomCursorPath();

    if (!resolved && previousPath) {
      removeTextureFromCache(this.customCursorCacheKey);
      removeTextureFromCache(`${previousPath}-custom-cursor-image`);
      this.customCursorPath = null;
      this.customCursorPathMtime = 0;
      return;
    }

    if (resolved) {
      const { filePath, mtime } = resolved;
      const pathChanged = filePath !== previousPath;
      const mtimeChanged = Math.abs(mtime - previousMtime) > 0.1;
      if (pathChanged || mtimeChanged) {
        removeTextureFromCache(this.customCursorCacheKey);
        if (previousPath) {
          removeTextureFromCache(`${previousPath}-custom-cursor-image`);
        }
        this.customCursorPath = filePath;
        this.customCursorPathMtime = mtime;
      }
    }
  }

  private findCustomCursorPath(): { filePath: string; mtime: number } | null {
    const cfg = ConfigManager.get();
    const configured = (cfg.cursorImagePath || "").trim();
    const candidates = [
      configured,
      path.join(process.cwd(), "cache", "custom_cursor.png"),
      path.join(process.cwd(), "cache", "images", "custom_cursor.png"),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const stats = fs.statSync(candidate);
          return { filePath: candidate, mtime: stats.mtimeMs };
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
import { ConfigManager } from "../../../utils/configManager";
