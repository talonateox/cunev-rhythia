import { lerpDelta } from "../utils/lerp";

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t: number): number {
  return Math.pow(t, 3);
}

export function waveSequence(length: number, trigger: (i: number) => void, delayMs = 50): void {
  for (let i = 0; i < length; i++) {
    setTimeout(() => trigger(i), i * delayMs);
  }
}

export function updateLerpArray(values: number[], rate: number, floor = 0.01): void {
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0) {
      values[i] = lerpDelta(values[i], 0, rate);
      if (values[i] < floor) values[i] = 0;
    }
  }
}

