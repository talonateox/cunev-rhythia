import { Color } from "raylib";
import {
  HitParticleEffect,
  SpawnParticlesContext,
} from "../hitParticles/HitParticleEffect";
import { BurstParticleEffect } from "../hitParticles/BurstParticleEffect";

export class HitParticleSystem {
  private readonly effects: HitParticleEffect[];
  private intensity: number = 1.0;

  constructor(effects?: HitParticleEffect[], intensity: number = 1.0) {
    this.effects = effects && effects.length > 0 ? effects : [new BurstParticleEffect()];
    this.intensity = intensity;
  }

  public setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  public spawnParticles(x: number, y: number, noteColor: Color): void {
    if (this.intensity <= 0) {
      return;
    }

    const context: SpawnParticlesContext = {
      x,
      y,
      noteColor,
      intensity: this.intensity,
    };
    this.effects.forEach((effect) => effect.spawn(context));
  }

  public update(deltaTimeMs: number): void {
    this.effects.forEach((effect) => effect.update(deltaTimeMs));
  }

  public render(opacityMultiplier: number = 1.0): void {
    this.effects.forEach((effect) => effect.render(opacityMultiplier));
  }

  public clear(): void {
    this.effects.forEach((effect) => effect.clear());
  }
}
