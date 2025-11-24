import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { CursorEffect, CursorEffectContext } from "./CursorEffect";
import { CursorRendererConfig } from "./types";

interface CursorTrailPoint {
  pos: Vector2;
  age: number;
}

registerCustomization(
  "TrailEffect",
  {
    id: "item-cursor-rainbow",
    name: "Cursor Rainbow",
    rarity: "Common",
    description: "",
    settingsCategory: "cursorRainbow",
    iconPath: "/item-cursor.png",
  } as const,
  [
    {
      key: "cursorRainbowEnabled",
      label: "Enabled",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "cursorRainbow",
    },
    {
      key: "rainbowRate",
      label: "Rainbow Rate",
      defaultValue: 1.9,
      min: 0.0,
      max: 10.0,
      step: 0.1,
      category: "Cursor",
      itemCategory: "cursorRainbow",
    },
    {
      key: "rainbowOffset",
      label: "Rainbow Offset",
      defaultValue: 86,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      category: "Cursor",
      itemCategory: "cursorRainbow",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 15 }
);

export class TrailEffect implements CursorEffect {
  private points: CursorTrailPoint[] = [];
  private trailTimer = 0;

  update(context: CursorEffectContext): void {
    if ((context.config.customCursorTrailEnabled ?? 0) >= 0.5) {
      this.points.length = 0;
      return;
    }
    this.updateTrail(
      context.cursorPosition.x,
      context.cursorPosition.y,
      context.deltaTime,
      context.config
    );
  }

  render(context: CursorEffectContext): void {
    if ((context.config.customCursorTrailEnabled ?? 0) >= 0.5) {
      return;
    }
    this.drawTrail(context.config);
  }

  updateConfig(config: Partial<CursorRendererConfig>): void {
    if (config.fadeRate && config.fadeRate > 30) {
      this.points.length = 0;
    }
    if (config.customCursorTrailEnabled !== undefined && config.customCursorTrailEnabled >= 0.5) {
      this.points.length = 0;
    }
  }

  private updateTrail(
    cursorX: number,
    cursorY: number,
    deltaTime: number,
    config: CursorRendererConfig
  ): void {
    if (config.fadeRate > 30) {
      this.points.length = 0;
      return;
    }

    const currentPos = Vector2(cursorX, cursorY);
    this.trailTimer += deltaTime;
    const createInterval = config.trailCreateRate * 2;

    if (this.trailTimer >= createInterval || this.points.length === 0) {
      this.points.unshift({ pos: currentPos, age: 0 });
      this.trailTimer = 0;
    }

    const maxAge = 1.0 / config.fadeRate;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const point = this.points[i];
      point.age += deltaTime;
      if (point.age > maxAge) {
        this.points.splice(i, 1);
      }
    }

    const maxTrailLength = config.trailLength * 10;
    if (this.points.length > maxTrailLength) {
      this.points.length = maxTrailLength;
    }
  }

  private drawTrail(config: CursorRendererConfig): void {
    const maxAge = 1.0 / config.fadeRate;

    for (let i = 0; i < this.points.length - 1; i++) {
      const point1 = this.points[i];
      const point2 = this.points[i + 1];
      const pos1 = point1.pos;
      const pos2 = point2.pos;

      const ageFactor = point1.age / maxAge;
      const widthScale = 1.0 - ageFactor;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 0.5 || widthScale <= 0) {
        continue;
      }

      const midX = (pos1.x + pos2.x) / 2;
      const midY = (pos1.y + pos2.y) / 2;
      const angle = Math.atan2(dy, dx);

      const opacity = config.cursorOpacity ?? 1.0;
      const rainbowRate = config.rainbowRate ?? 0;
      const rainbowOffset = config.rainbowOffset ?? 0;
      const rainbowEnabled = (config.cursorRainbowEnabled ?? 1) >= 0.5;
      let color = { r: 255, g: 255, b: 255, a: Math.round(255 * opacity) };

      if (rainbowEnabled && rainbowRate > 0) {
        const hue = (point1.age * rainbowRate * 360 + rainbowOffset) % 360;
        const rgbColor = this.hslToRgb(hue, 1.0, 0.5);
        color = { ...rgbColor, a: Math.round(255 * opacity) };
      }

      rlPushMatrix();
      rlTranslatef(midX, midY, 0);
      rlRotatef((angle * 180) / Math.PI, 0, 0, 1);
      drawSprite(
        "/solid.png",
        Vector2(-(distance + 4) / 2, -4 * config.cursorScale * widthScale),
        Vector2(distance + 4, 8 * config.cursorScale * widthScale),
        color
      );
      rlPopMatrix();
    }
  }

  private hslToRgb(
    h: number,
    s: number,
    l: number
  ): { r: number; g: number; b: number; a: number } {
    h = h / 360;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hueToRgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h + 1 / 3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a: 255,
    };
  }
}
