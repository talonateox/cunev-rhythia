import { Color, Vector2 } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import {
  HitParticleEffect,
  SpawnParticlesContext,
} from "./HitParticleEffect";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: Color;
}

export class BurstParticleEffect implements HitParticleEffect {
  private particles: Particle[] = [];

  spawn(context: SpawnParticlesContext): void {
    const baseCount = 6;
    const particleCount = Math.round(baseCount * context.intensity);

    if (particleCount <= 0) {
      return;
    }

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 820 * context.intensity;

      this.particles.push({
        x: context.x,
        y: context.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 16 + Math.random() * 16 * context.intensity,
        life: 1.0,
        maxLife: 500 + Math.random() * 300,
        color: { ...context.noteColor },
      });
    }
  }

  update(deltaTimeMs: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.x += particle.vx * (deltaTimeMs / 1000);
      particle.y += particle.vy * (deltaTimeMs / 1000);
      particle.life -= deltaTimeMs / particle.maxLife;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }
  }

  render(opacityMultiplier: number): void {
    for (const particle of this.particles) {
      const opacity = particle.life * 0.4 * opacityMultiplier;

      drawSprite(
        "/circle.png",
        Vector2(particle.x - particle.size / 2, particle.y - particle.size / 2),
        Vector2(particle.size, particle.size),
        {
          r: particle.color.r,
          g: particle.color.g,
          b: particle.color.b,
          a: Math.round(255 * opacity),
        }
      );
    }
  }

  clear(): void {
    this.particles.length = 0;
  }
}

registerCustomization(
  "BurstParticleEffect",
  {
    id: "item-burst-particles",
    name: "Hit Particles",
    rarity: "Common",
    description: "",
    settingsCategory: "burstParticle",
    iconPath: "/item-burst.png",
  } as const,
  [
    {
      key: "burstParticleEnabled",
      label: "Enabled",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "burstParticle",
    },
    {
      key: "burstParticleIntensity",
      label: "Burst Particle Effect",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.1,
      itemCategory: "burstParticle",
    },
    {
      key: "hitParticleOpacity",
      label: "Hit Particle Opacity",
      defaultValue: 0.4,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      itemCategory: "burstParticle",
    },
    {
      key: "missParticleOpacity",
      label: "Miss Particle Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      itemCategory: "burstParticle",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);
