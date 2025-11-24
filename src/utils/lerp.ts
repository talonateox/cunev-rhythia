import { GetFrameTime } from "raylib";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpDelta(a: number, b: number, rate: number): number {
  const normalizedDelta = (GetFrameTime() * 1000) / 16.67; 
  const lerpFactor = 1 - Math.pow(1 - rate, normalizedDelta);
  return lerp(a, b, lerpFactor);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
