import { Color } from "raylib";

export interface SpawnParticlesContext {
  x: number;
  y: number;
  noteColor: Color;
  intensity: number;
}

export interface HitParticleEffect {
  spawn(context: SpawnParticlesContext): void;
  update(deltaTimeMs: number): void;
  render(opacityMultiplier: number): void;
  clear(): void;
}
