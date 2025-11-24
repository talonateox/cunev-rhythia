import {
  Color,
  Vector2,
  Vector3,
  rlPopMatrix,
  rlPushMatrix,
  rlRotatef,
  rlTranslatef,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { clamp } from "../../../utils/lerp";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { BackgroundDecoration } from "./BackgroundDecoration";
import { BackgroundRenderContext } from "./types";

export class GridDecoration implements BackgroundDecoration {
  private accentColor: Color = { r: 255, g: 255, b: 255, a: 255 };

  private readonly stripSpacing = 230;
  private readonly defaultStripCount = 10;
  private readonly baseZ = 700;
  private readonly baseY = 2600;
  private readonly defaultOpacity = 50;
  private readonly defaultUnitsPerSecond = 60;
  private readonly defaultFadeFalloff = 1.6;

  private movementOffset = 0;
  private lastRenderTimeMs: number | null = null;

  setAccentColor(color: Color): void {
    this.accentColor = color;
  }

  render(context: BackgroundRenderContext): void {
    const currentTime = context.msTime;

    if (this.lastRenderTimeMs === null) {
      this.lastRenderTimeMs = currentTime;
    }

    const gridEnabled = (context.settings.gridEnabled ?? 1) >= 0.5;
    const gridOpacitySetting = clamp(
      context.settings.gridOpacity ?? this.defaultOpacity,
      0,
      100
    );
    const effectiveOpacityScale =
      (gridOpacitySetting / 100) * (context.backgroundOpacity ?? 1);

    if (!gridEnabled || effectiveOpacityScale <= 0) {
      this.lastRenderTimeMs = currentTime;
      return;
    }

    const gridSpeedMultiplier = clamp(
      context.settings.gridSpeedMultiplier ?? 1,
      0.2,
      2.5
    );

    const unitsPerSecond = clamp(
      context.settings.gridUnitsPerSecond ?? this.defaultUnitsPerSecond,
      5,
      400
    );

    this.updateMovementOffset(currentTime, gridSpeedMultiplier, unitsPerSecond);

    const maxAlpha = clamp(Math.round(255 * effectiveOpacityScale), 0, 255);

    if (maxAlpha <= 0) {
      return;
    }

    const fadeFalloff = clamp(
      context.settings.gridFadeFalloff ?? this.defaultFadeFalloff,
      1.05,
      4.0
    );

    const gridDepthInput = context.settings.gridDepth;
    const gridDepthBase =
      typeof gridDepthInput === "number" && Number.isFinite(gridDepthInput)
        ? gridDepthInput
        : this.defaultStripCount;
    const gridDepth = clamp(Math.round(gridDepthBase), 1, 20);

    const baseZ = this.baseZ - this.movementOffset;

    rlPushMatrix();
    rlTranslatef(0, this.baseY, baseZ);
    rlRotatef(-90, 1, 0, 0);
    this.renderStripStack(maxAlpha, fadeFalloff, gridDepth);
    rlPopMatrix();

    rlPushMatrix();
    rlRotatef(180, 0, 0, 1);
    rlTranslatef(0, this.baseY - 700, baseZ);
    rlRotatef(-90, 1, 0, 0);
    this.renderStripStack(maxAlpha, fadeFalloff, gridDepth);
    rlPopMatrix();
  }

  private updateMovementOffset(
    currentMs: number,
    speedMultiplier: number,
    unitsPerSecond: number
  ): void {
    if (this.lastRenderTimeMs === null) {
      this.lastRenderTimeMs = currentMs;
      return;
    }

    let delta = currentMs - this.lastRenderTimeMs;
    this.lastRenderTimeMs = currentMs;

    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }

    delta = clamp(delta, 0, 1000);

    const movementDelta = (delta * unitsPerSecond * speedMultiplier) / 1000;
    this.movementOffset =
      (this.movementOffset + movementDelta) % this.stripSpacing;

    if (this.movementOffset < 0) {
      this.movementOffset += this.stripSpacing;
    }
  }

  private renderStripStack(
    maxAlpha: number,
    fadeFalloff: number,
    stripCount: number
  ): void {
    for (let i = 0; i < stripCount; i++) {
      if (i > 0) {
        rlTranslatef(0, -this.stripSpacing, 0);
      }

      const alpha = this.computeStripAlpha(maxAlpha, i, fadeFalloff);

      if (alpha <= 0) {
        continue;
      }

      drawSprite(
        "/grid.png",
        Vector3(10000, 0, 0),
        Vector2(20000, this.stripSpacing),
        { ...this.accentColor, a: alpha },
        "te",
        undefined,
        undefined,
        180
      );
    }
  }

  private computeStripAlpha(
    maxAlpha: number,
    index: number,
    fadeFalloff: number
  ): number {
    const distance = Math.max(
      0,
      index * this.stripSpacing - this.movementOffset
    );
    const effectiveIndex = distance / this.stripSpacing;
    const alpha = maxAlpha / Math.pow(fadeFalloff, effectiveIndex);
    return clamp(Math.round(alpha), 0, 255);
  }
}

registerCustomization(
  "GridDecoration",
  {
    id: "item-grid",
    name: "Grid",
    rarity: "Common",
    description: "",
    settingsCategory: "grid",
    iconPath: "/item-grid.png",
  } as const,
  [
    {
      key: "gridEnabled",
      label: "Enabled",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "grid",
    },
    {
      key: "gridOpacity",
      label: "Grid Opacity",
      defaultValue: 12,
      min: 0,
      max: 100,
      step: 1,
      category: "Background",
      itemCategory: "grid",
    },
    {
      key: "gridSpeedMultiplier",
      label: "Scroll Speed Multiplier",
      defaultValue: 2.05,
      min: 0.2,
      max: 2.5,
      step: 0.05,
      category: "Background",
      itemCategory: "grid",
    },
    {
      key: "gridUnitsPerSecond",
      label: "Units Per Second",
      defaultValue: 130,
      min: 5,
      max: 400,
      step: 5,
      category: "Background",
      itemCategory: "grid",
    },
    {
      key: "gridDepth",
      label: "Grid Depth",
      defaultValue: 20,
      min: 1,
      max: 20,
      step: 1,
      category: "Background",
      itemCategory: "grid",
    },
    {
      key: "gridFadeFalloff",
      label: "Fade Falloff",
      defaultValue: 1.3,
      min: 1.05,
      max: 4.0,
      step: 0.05,
      category: "Background",
      itemCategory: "grid",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 5 }
);
