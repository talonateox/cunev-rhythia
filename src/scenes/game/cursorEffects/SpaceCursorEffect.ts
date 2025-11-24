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

interface TrailPoint {
  pos: Vector2;
  age: number;
}

interface SpaceStar {
  pos: Vector2;
  age: number;
  lifetime: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  twinklePhase: number;
}

registerCustomization(
  "SpaceCursorEffect",
  {
    id: "item-space-cursor",
    name: "Space Cursor",
    rarity: "Legendary",
    description: "",
    settingsCategory: "spaceCursor",
    iconPath: "/item-space-cursor.png",
  } as const,
  [
    {
      key: "spaceCursorEnabled",
      label: "Enabled",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "spaceCursor",
    },
    {
      key: "spaceStarDensity",
      label: "Star Density",
      defaultValue: 25,
      min: 0,
      max: 40,
      step: 1,
      category: "Cursor",
      itemCategory: "spaceCursor",
    },
    {
      key: "spaceStarLifetime",
      label: "Star Lifetime",
      defaultValue: 0.6,
      min: 0.2,
      max: 2.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: "spaceCursor",
    },
    {
      key: "spaceStarSize",
      label: "Star Size",
      defaultValue: 0.6,
      min: 0.2,
      max: 2.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: "spaceCursor",
    },
    {
      key: "spaceStarMaxOpacity",
      label: "Star Opacity",
      defaultValue: 0.9,
      min: 0.1,
      max: 1.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: "spaceCursor",
    },
    {
      key: "spaceRainbowRate",
      label: "Rainbow Rate",
      defaultValue: 0.7,
      min: 0.0,
      max: 10.0,
      step: 0.1,
      category: "Cursor",
      itemCategory: "spaceCursor",
    },
    {
      key: "spaceRainbowOffset",
      label: "Rainbow Offset",
      defaultValue: 41,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      category: "Cursor",
      itemCategory: "spaceCursor",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 25 }
);

export class SpaceCursorEffect implements CursorEffect {
  private points: TrailPoint[] = [];
  private stars: SpaceStar[] = [];
  private trailTimer = 0;
  private starSpawnAcc = 0;

  update(context: CursorEffectContext): void {
    const cfg = context.config;
    const enabled = (cfg.spaceCursorEnabled ?? 0) >= 0.5;
    if (!enabled) {
      this.points.length = 0;
      this.stars.length = 0;
      this.trailTimer = 0;
      this.starSpawnAcc = 0;
      return;
    }

    const fadeRate = Math.max(1e-3, cfg.fadeRate);
    const createRate = Math.max(1e-3, cfg.trailCreateRate);
    const deltaTime = Math.max(1e-4, context.deltaTime);

    const currentPos = Vector2(
      context.cursorPosition.x,
      context.cursorPosition.y
    );
    this.trailTimer += deltaTime;
    const createInterval = createRate * 2;

    if (this.trailTimer >= createInterval || this.points.length === 0) {
      this.points.unshift({ pos: currentPos, age: 0 });
      this.trailTimer = 0;
    }

    const maxAge = 1.0 / fadeRate;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      p.age += deltaTime;
      if (p.age > maxAge) {
        this.points.splice(i, 1);
      }
    }

    const maxTrailLength = Math.max(5, Math.floor(cfg.trailLength * 10));
    if (this.points.length > maxTrailLength) {
      this.points.length = maxTrailLength;
    }

    const density = Math.max(0, cfg.spaceStarDensity ?? 16); 
    this.starSpawnAcc += deltaTime * density;

    while (this.starSpawnAcc >= 1) {
      this.starSpawnAcc -= 1;

      if (this.points.length >= 2) {
        const headIdx = Math.floor(
          Math.random() * Math.min(4, this.points.length - 1)
        );
        const p1 = this.points[headIdx].pos;
        const p2 = this.points[headIdx + 1].pos;

        const t = Math.random();
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        const px = -dy / len;
        const py = dx / len;
        const jitter =
          (cfg.spaceStarTrailJitter ?? 4) * (Math.random() * 2 - 1);
        const pos = Vector2(x + px * jitter, y + py * jitter);

        const lifetime =
          (cfg.spaceStarLifetime ?? 0.6) * (0.8 + Math.random() * 0.4);
        const scale = (cfg.spaceStarSize ?? 0.6) * (0.8 + Math.random() * 0.6);
        const rotation = Math.random() * 360;
        const rotationSpeed =
          (Math.random() * 40 + 10) * (Math.random() < 0.5 ? -1 : 1);
        const twinklePhase = Math.random() * Math.PI * 2;

        this.stars.push({
          pos,
          age: 0,
          lifetime,
          scale,
          rotation,
          rotationSpeed,
          twinklePhase,
        });
      }
    }

    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.age += deltaTime;
      s.rotation += s.rotationSpeed * deltaTime;
      if (s.age >= s.lifetime) {
        this.stars.splice(i, 1);
      }
    }

    const maxStars = Math.max(32, cfg.spaceStarMaxCount ?? 128);
    if (this.stars.length > maxStars) {
      this.stars.splice(0, this.stars.length - maxStars);
    }
  }

  render(context: CursorEffectContext): void {
    const cfg = context.config;
    const enabled = (cfg.spaceCursorEnabled ?? 0) >= 0.5;
    if (!enabled) return;

    const cursorScale = cfg.cursorScale ?? 1.0;
    const opacity = cfg.cursorOpacity ?? 1.0;
    const rainbowRate = Math.max(0, cfg.spaceRainbowRate ?? 4.4);
    const rainbowOffset = this.normalizeHue(cfg.spaceRainbowOffset ?? 200);
    const baseAlpha = Math.round(255 * opacity);

    const maxAge = 1.0 / Math.max(1e-3, cfg.fadeRate);
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const pos1 = p1.pos;
      const pos2 = p2.pos;

      const ageFactor = p1.age / maxAge;
      const widthScale = Math.max(0, 1.0 - ageFactor);

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= 0.5 || widthScale <= 0) continue;

      const midX = (pos1.x + pos2.x) / 2;
      const midY = (pos1.y + pos2.y) / 2;
      const angle = Math.atan2(dy, dx);

      const alpha = baseAlpha;
      const hueBase =
        rainbowRate > 0
          ? this.normalizeHue(p1.age * rainbowRate * 360 + rainbowOffset)
          : rainbowOffset;
      const colorRgb = this.hslToRgb(hueBase, 1.0, 0.5);
      const color = {
        r: colorRgb.r,
        g: colorRgb.g,
        b: colorRgb.b,
        a: alpha,
      };

      rlPushMatrix();
      rlTranslatef(midX, midY, 0);
      rlRotatef((angle * 180) / Math.PI, 0, 0, 1);
      const width = 4 * cursorScale * widthScale;
      drawSprite(
        "/solid.png",
        Vector2(-(distance + 4) / 2, -width / 2),
        Vector2(distance + 4, width),
        color
      );
      rlPopMatrix();
    }

    const starMaxOpacity = Math.round(
      255 * this.clamp(cfg.spaceStarMaxOpacity ?? 0.9, 0, 1)
    );
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const t = this.clamp(s.age / s.lifetime, 0, 1);

      const twinkle = 0.75 + 0.25 * Math.sin(t * Math.PI * 2 + s.twinklePhase);
      const scale = s.scale * cursorScale * (0.85 + 0.15 * (1 - t)) * twinkle;

      const alpha = Math.round(starMaxOpacity * (1 - t));

      rlPushMatrix();
      rlTranslatef(s.pos.x, s.pos.y, 0);
      rlRotatef(s.rotation, 0, 0, 1);
      const spriteSize = 10 * scale;
      const starHue = this.normalizeHue(
        s.age * rainbowRate * 360 + rainbowOffset
      );
      const starRgb = this.hslToRgb(starHue, 0.65, 0.7);
      drawSprite(
        "/star.png",
        Vector2(-spriteSize / 2, -spriteSize / 2),
        Vector2(spriteSize, spriteSize),
        { r: starRgb.r, g: starRgb.g, b: starRgb.b, a: alpha }
      );
      rlPopMatrix();
    }
  }

  updateConfig(config: Partial<CursorRendererConfig>): void {
    if (
      config.spaceCursorEnabled !== undefined &&
      config.spaceCursorEnabled < 0.5
    ) {
      this.points.length = 0;
      this.stars.length = 0;
      this.trailTimer = 0;
      this.starSpawnAcc = 0;
    }
  }

  private clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  private normalizeHue(value: number): number {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  private hslToRgb(
    h: number,
    s: number,
    l: number
  ): { r: number; g: number; b: number } {
    const saturation = this.clamp(s, 0, 1);
    const lightness = this.clamp(l, 0, 1);
    const hue = this.normalizeHue(h) / 360;

    if (saturation === 0) {
      const gray = Math.round(lightness * 255);
      return { r: gray, g: gray, b: gray };
    }

    const q =
      lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;

    const hueToRgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const rOut = Math.round(this.clamp(hueToRgb(hue + 1 / 3), 0, 1) * 255);
    const gOut = Math.round(this.clamp(hueToRgb(hue), 0, 1) * 255);
    const bOut = Math.round(this.clamp(hueToRgb(hue - 1 / 3), 0, 1) * 255);

    return { r: rOut, g: gOut, b: bOut };
  }
}
