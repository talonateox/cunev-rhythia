import { Vector2 } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { CursorEffect, CursorEffectContext } from "./CursorEffect";
import { CursorRendererConfig } from "./types";

interface ImageTrailParticle {
  position: Vector2;
  age: number;
  angle: number;
  scale: number;
  texturePath: string;
}

const EPSILON = 0.0001;

registerCustomization(
  "CustomCursorTrailEffect",
  {
    id: "item-custom-cursor",
    name: "Custom Cursor",
    rarity: "Common",
    description: "",
    settingsCategory: "customCursor",
    iconPath: "/icon-custom-cursor.png",
  } as const,
  [
    {
      key: "customCursorEnabled",
      label: "Enabled",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "customCursor",
    },
    {
      key: "customCursorOpacity",
      label: "Cursor Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: "customCursor",
    },
    {
      key: "customCursorRotationSpeed",
      label: "Rotation Speed",
      defaultValue: 380.0,
      min: 0.0,
      max: 720.0,
      step: 5.0,
      category: "Cursor",
      itemCategory: "customCursor",
    },
    {
      key: "customCursorTrailEnabled",
      label: "Image Trail",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "customCursor",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);

export class CustomCursorTrailEffect implements CursorEffect {
  private particles: ImageTrailParticle[] = [];
  private spawnTimer = 0;
  private lastTexturePath: string | null = null;

  update(context: CursorEffectContext): void {
    const config = context.config;
    const enabled = (config.customCursorTrailEnabled ?? 0) >= 0.5;
    const texturePath = config.customCursorTexturePath;
    const fadeRate = config.fadeRate ?? 0.5;

    if (!enabled || !texturePath || fadeRate > 30) {
      this.clearParticles();
      if (!texturePath) {
        this.lastTexturePath = null;
      }
      return;
    }

    const deltaTime = Math.max(context.deltaTime, EPSILON);
    const createInterval = (config.trailCreateRate ?? 0.002) * 2;
    this.spawnTimer += deltaTime;

    if (texturePath !== this.lastTexturePath) {
      this.clearParticles();
      this.lastTexturePath = texturePath;
    }

    if (this.spawnTimer >= createInterval || this.particles.length === 0) {
      this.spawnParticle(context, texturePath);
      this.spawnTimer = 0;
    }

    this.updateParticles(deltaTime, config);
  }

  render(context: CursorEffectContext): void {
    if (this.particles.length === 0) {
      return;
    }

    const config = context.config;
    const fadeRate = config.fadeRate ?? 0.5;
    const maxAge = 1.0 / Math.max(fadeRate, EPSILON);
    const cursorScale = config.cursorScale ?? 1.0;
    const baseOpacity = config.cursorOpacity ?? 1.0;
    const customOpacity = this.clamp(config.customCursorOpacity ?? 1.0, 0, 1);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const ageFactor = this.clamp(particle.age / maxAge, 0, 1);
      const fade = 1 - ageFactor;
      const totalScale = cursorScale * particle.scale * (0.6 + 0.4 * fade);
      const spriteSize = 8 * totalScale;
      const alpha = Math.round(255 * baseOpacity * customOpacity * fade);
      if (alpha <= 0) {
        continue;
      }

      drawSprite(
        particle.texturePath,
        Vector2(particle.position.x, particle.position.y),
        Vector2(spriteSize, spriteSize),
        { r: 255, g: 255, b: 255, a: alpha },
        `${particle.texturePath}-custom-cursor-image`,
        true,
        true,
        particle.angle,
        Vector2(spriteSize / 2, spriteSize / 2)
      );
    }
  }

  updateConfig(config: Partial<CursorRendererConfig>): void {
    if (
      config.customCursorTrailEnabled !== undefined &&
      config.customCursorTrailEnabled < 0.5
    ) {
      this.clearParticles();
    }

    if (config.fadeRate !== undefined && config.fadeRate > 30) {
      this.clearParticles();
    }
  }

  private spawnParticle(
    context: CursorEffectContext,
    texturePath: string
  ): void {
    const config = context.config;
    const angle = config.customCursorCurrentAngle ?? 0;

    this.particles.unshift({
      position: Vector2(context.cursorPosition.x, context.cursorPosition.y),
      age: 0,
      angle,
      scale: 1,
      texturePath,
    });

    const maxTrailLength = Math.max(1, (config.trailLength ?? 50) * 10);
    if (this.particles.length > maxTrailLength) {
      this.particles.length = maxTrailLength;
    }
  }

  private updateParticles(deltaTime: number, config: CursorRendererConfig): void {
    const fadeRate = config.fadeRate ?? 0.5;
    const maxAge = 1.0 / Math.max(fadeRate, EPSILON);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.age += deltaTime;
      if (particle.age > maxAge) {
        this.particles.splice(i, 1);
      }
    }
  }

  private clearParticles(): void {
    this.particles.length = 0;
    this.spawnTimer = 0;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
