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

interface StarParticle {
  position: Vector2;
  origin: Vector2;
  velocity: { x: number; y: number };
  age: number;
  lifetime: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  hueOffset: number;
}

const EPSILON = 0.0001;

registerCustomization(
  "StarTrailEffect",
  {
    id: "item-star-trail",
    name: "Star Trail",
    rarity: "Uncommon",
    description: "",
    settingsCategory: "starTrail",
    iconPath: "/item-star.png",
  } as const,
  [
    {
      key: "starTrailEnabled",
      label: "Enabled",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "starTrail",
    },
    {
      key: "starTrailDensity",
      label: "Star Density",
      defaultValue: 19.5,
      min: 1.0,
      max: 20.0,
      step: 0.5,
      category: "Cursor",
      itemCategory: "starTrail",
    },
    {
      key: "starTrailSize",
      label: "Star Size",
      defaultValue: 2.05,
      min: 0.5,
      max: 2.5,
      step: 0.05,
      category: "Cursor",
      itemCategory: "starTrail",
    },
    {
      key: "starTrailLifetime",
      label: "Star Lifetime",
      defaultValue: 1.45,
      min: 0.2,
      max: 1.5,
      step: 0.05,
      category: "Cursor",
      itemCategory: "starTrail",
    },
    {
      key: "starTrailDisperseDistance",
      label: "Disperse Distance",
      defaultValue: 125,
      min: 0.0,
      max: 300.0,
      step: 5.0,
      category: "Cursor",
      itemCategory: "starTrail",
    },
    {
      key: "starTrailRainbowIntensity",
      label: "Rainbow Intensity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: "starTrail",
    },
    {
      key: "starTrailMaxOpacity",
      label: "Max Opacity",
      defaultValue: 1.0,
      min: 0.1,
      max: 1.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: "starTrail",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);

export class StarTrailEffect implements CursorEffect {
  private particles: StarParticle[] = [];
  private spawnAccumulator = 0;
  private lastCursorPosition: Vector2 | null = null;

  update(context: CursorEffectContext): void {
    const config = context.config;
    const enabled = (config.starTrailEnabled ?? 1) >= 0.5;
    const deltaTime = Math.max(context.deltaTime, EPSILON);

    if (!enabled) {
      this.particles.length = 0;
      this.spawnAccumulator = 0;
      this.lastCursorPosition = null;
      return;
    }

    const spawnRate = Math.max(0, config.starTrailDensity ?? 8);
    const lifetime = Math.max(EPSILON, config.starTrailLifetime ?? 0.8);
    const size = Math.max(EPSILON, config.starTrailSize ?? 1.0);
    const maxDistance = Math.max(10, config.starTrailDisperseDistance ?? 160);

    this.spawnAccumulator += deltaTime * spawnRate;

    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawnStar(context, deltaTime, lifetime, size, maxDistance);
    }

    this.updateParticles(deltaTime);
    this.lastCursorPosition = Vector2(
      context.cursorPosition.x,
      context.cursorPosition.y
    );
  }

  render(context: CursorEffectContext): void {
    const config = context.config;
    const opacity = config.cursorOpacity ?? 1.0;
    const cursorScale = config.cursorScale ?? 1.0;
    const rainbowIntensity = this.clamp(
      config.starTrailRainbowIntensity ?? 1.0,
      0,
      1
    );
    const maxTrailOpacity = this.clamp(
      config.starTrailMaxOpacity ?? 1.0,
      0,
      1
    );

    const maxAlpha = Math.round(255 * opacity * maxTrailOpacity);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const progress = particle.age / particle.lifetime;
      const fade = Math.max(0, 1 - progress);
      const scale = cursorScale * particle.scale * (0.7 + 0.3 * fade);

      const alpha = Math.round(maxAlpha * fade);
      let color = {
        r: 255,
        g: 255,
        b: 255,
        a: alpha,
      };

      if (rainbowIntensity > 0) {
        const hue = this.computeParticleHue(particle, context);
        const rgb = this.hslToRgb(hue, 1.0, 0.5);
        color = {
          r: Math.round(
            color.r + (rgb.r - color.r) * rainbowIntensity
          ),
          g: Math.round(
            color.g + (rgb.g - color.g) * rainbowIntensity
          ),
          b: Math.round(
            color.b + (rgb.b - color.b) * rainbowIntensity
          ),
          a: alpha,
        };
      }

      rlPushMatrix();
      rlTranslatef(particle.position.x, particle.position.y, 0);
      rlRotatef(particle.rotation, 0, 0, 1);
      const spriteSize = 12 * scale;
      drawSprite(
        "/star.png",
        Vector2(-spriteSize / 2, -spriteSize / 2),
        Vector2(spriteSize, spriteSize),
        color
      );
      rlPopMatrix();
    }
  }

  updateConfig(config: Partial<CursorRendererConfig>): void {
    if (config.starTrailEnabled !== undefined && config.starTrailEnabled < 0.5) {
      this.particles.length = 0;
      this.spawnAccumulator = 0;
    }
  }

  private spawnStar(
    context: CursorEffectContext,
    deltaTime: number,
    lifetime: number,
    size: number,
    maxDistance: number
  ): void {
    const currentPos = context.cursorPosition;
    const cursorPos = Vector2(currentPos.x, currentPos.y);

    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = Math.sqrt(Math.random()) * maxDistance;
    const offsetX = Math.cos(randomAngle) * randomRadius;
    const offsetY = Math.sin(randomAngle) * randomRadius;
    const spawnPos = Vector2(cursorPos.x + offsetX, cursorPos.y + offsetY);

    let velocity = { x: 0, y: 0 };
    if (this.lastCursorPosition) {
      const dx = cursorPos.x - this.lastCursorPosition.x;
      const dy = cursorPos.y - this.lastCursorPosition.y;
      const invDt = 1 / deltaTime;
      const speedX = dx * invDt;
      const speedY = dy * invDt;
      velocity = {
        x: -speedX * 0.25,
        y: -speedY * 0.25,
      };
    }

    const randomDriftAngle = Math.random() * Math.PI * 2;
    const randomSpeed = 20 + Math.random() * 40;
    velocity.x += Math.cos(randomDriftAngle) * randomSpeed;
    velocity.y += Math.sin(randomDriftAngle) * randomSpeed;

    const scaleJitter = 0.8 + Math.random() * 0.4;
    const particle: StarParticle = {
      position: spawnPos,
      origin: Vector2(cursorPos.x, cursorPos.y),
      velocity,
      age: 0,
      lifetime,
      scale: size * scaleJitter,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() * 120 - 60) * (0.5 + Math.random()),
      hueOffset: Math.random() * 360,
    };

    this.particles.push(particle);
  }

  private updateParticles(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.age += deltaTime;

      if (particle.age >= particle.lifetime) {
        this.particles.splice(i, 1);
        continue;
      }

      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.velocity.x *= 0.94;
      particle.velocity.y *= 0.94;
      particle.rotation += particle.rotationSpeed * deltaTime;

    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private computeParticleHue(
    particle: StarParticle,
    context: CursorEffectContext
  ): number {
    const rainbowRate = context.config.rainbowRate ?? 0;
    const rainbowOffset = context.config.rainbowOffset ?? 0;
    const ageContribution = rainbowRate * particle.age * 360;
    const timeContribution = ((context.currentTime ?? 0) * 0.15) % 360;
    return (
      particle.hueOffset +
      rainbowOffset +
      ageContribution +
      timeContribution
    ) % 360;
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
