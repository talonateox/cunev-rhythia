import { Color, rlPopMatrix, rlPushMatrix, rlTranslatef } from "raylib";
import type { GameSettings } from "../../../utils/gameSettingsSchema";
import { BackgroundDecoration } from "../backgrounds/BackgroundDecoration";
import { BackgroundRenderContext } from "../backgrounds/types";
import { CoverImageDecoration } from "../backgrounds/CoverImageDecoration";
import { TunnelDecoration } from "../backgrounds/TunnelDecoration";
import { RayDecoration } from "../backgrounds/RayDecoration";
import { ChevronDecoration } from "../backgrounds/ChevronDecoration";
import { GridDecoration } from "../backgrounds/GridDecoration";
import { VideoBackgroundDecoration } from "../backgrounds/VideoBackgroundDecoration";

export class BackgroundRenderer {
  private accentColor: Color = { r: 255, g: 255, b: 255, a: 255 };

  private readonly coverDecoration = new CoverImageDecoration();
  private readonly videoDecoration = new VideoBackgroundDecoration();
  private readonly decorations: BackgroundDecoration[] = [
    new GridDecoration(),
    new TunnelDecoration(),
    new RayDecoration(),
    new ChevronDecoration(),
  ];

  constructor() {
    for (const decoration of this.decorations) {
      decoration.setAccentColor(this.accentColor);
      decoration.init?.();
    }

    this.videoDecoration.init?.();
    this.coverDecoration.setAccentColor(this.accentColor);
  }

  public setAccentColor(color: Color): void {
    const blendFactor = 0.4;
    this.accentColor = {
      r: Math.round(color.r * blendFactor + 255 * (1 - blendFactor)),
      g: Math.round(color.g * blendFactor + 255 * (1 - blendFactor)),
      b: Math.round(color.b * blendFactor + 255 * (1 - blendFactor)),
      a: 255,
    };

    for (const decoration of this.decorations) {
      decoration.setAccentColor(this.accentColor);
    }

    this.coverDecoration.setAccentColor(this.accentColor);
  }

  public renderCoverImage(settings: Partial<GameSettings> = {}): void {
    const context: BackgroundRenderContext = {
      msTime: 0,
      farDistance: 0,
      settings,
      backgroundOpacity: 1,
      cameraTiltX: 0,
      cameraTiltY: 0,
    };

    this.coverDecoration.render(context);
  }

  public destroy() {
    this.videoDecoration.destroy();
    for (const decoration of this.decorations) {
      decoration.destroy?.();
    }
  }

  public renderBackground(
    msTime: number,
    farDistance: number,
    settings?: Partial<GameSettings>,
    backgroundOpacity: number = 1.0,
    cameraTiltX: number = 0,
    cameraTiltY: number = 0
  ): void {
    const effectiveSettings = settings ?? {};
    const rayOpacity = effectiveSettings.rayOpacity ?? 0;
    const chevronOpacity = effectiveSettings.chevronOpacity ?? 0;
    const gridEnabled = (effectiveSettings.gridEnabled ?? 1) >= 0.5;
    const gridOpacitySetting = gridEnabled
      ? effectiveSettings.gridOpacity ?? 0
      : 0;

    if (
      backgroundOpacity <= 0 &&
      rayOpacity <= 0 &&
      chevronOpacity <= 0 &&
      gridOpacitySetting <= 0
    ) {
      return;
    }

    const context: BackgroundRenderContext = {
      msTime,
      farDistance,
      settings: effectiveSettings,
      backgroundOpacity,
      cameraTiltX,
      cameraTiltY,
    };

    this.coverDecoration.render(context);
    this.videoDecoration.render(context);

    rlPushMatrix();
    rlTranslatef(-cameraTiltX * 100, -cameraTiltY * 100, 0);

    for (const decoration of this.decorations) {
      decoration.render(context);
    }

    rlPopMatrix();
  }
}
