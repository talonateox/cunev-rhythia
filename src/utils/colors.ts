import { AccentColor } from "./imageBlur";
import { Color } from "raylib";

export function rgb(r: number, g: number, b: number, a: number = 1) {
  return { r: r * 255, g: g * 255, b: b * 255, a: a * 255 };
}

export function rgba(r: number, g: number, b: number, a: number) {
  if (r > 1 || g > 1 || b > 1) {
    return { r: r, g: g, b: b, a: a * 255 };
  }

  return { r: r * 255, g: g * 255, b: b * 255, a: a * 255 };
}

export function tintWithAccent(
  baseColor: { r: number; g: number; b: number },
  accentColor: AccentColor | null,
  strength: number = 0.3
): Color {
  if (!accentColor) {
    return { r: baseColor.r, g: baseColor.g, b: baseColor.b, a: 255 };
  }

  const r = Math.round(baseColor.r * (1 - strength) + accentColor.r * strength);
  const g = Math.round(baseColor.g * (1 - strength) + accentColor.g * strength);
  const b = Math.round(baseColor.b * (1 - strength) + accentColor.b * strength);

  return { r, g, b, a: 255 };
}

export function accentBackground(
  accentColor: AccentColor | null,
  strength: number = 0.2
): { r: number; g: number; b: number } {
  if (!accentColor) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Math.round(accentColor.r * strength),
    g: Math.round(accentColor.g * strength),
    b: Math.round(accentColor.b * strength),
  };
}

export function brightenColor(
  baseColor: { r: number; g: number; b: number },
  hoverProgress: number,
  maxBrightness: number = 75
): Color {
  const additionalBrightness = Math.round(maxBrightness * hoverProgress);
  return {
    r: Math.min(255, baseColor.r + additionalBrightness),
    g: Math.min(255, baseColor.g + additionalBrightness),
    b: Math.min(255, baseColor.b + additionalBrightness),
    a: 255,
  };
}

export function accentWithHover(
  baseColor: { r: number; g: number; b: number },
  accentColor: AccentColor | null,
  baseStrength: number,
  hoverProgress: number,
  hoverStrengthBoost: number = 0.4
): Color {
  const totalStrength = baseStrength + hoverStrengthBoost * hoverProgress;

  if (!accentColor) {
    return brightenColor(baseColor, hoverProgress);
  }

  const r = Math.round(
    baseColor.r * (1 - totalStrength) + accentColor.r * totalStrength
  );
  const g = Math.round(
    baseColor.g * (1 - totalStrength) + accentColor.g * totalStrength
  );
  const b = Math.round(
    baseColor.b * (1 - totalStrength) + accentColor.b * totalStrength
  );

  return { r, g, b, a: 255 };
}

export function accentUIColor(
  accentColor: AccentColor | null,
  baseIntensity: number = 0.6,
  whitenFactor: number = 0.3
): Color {
  if (!accentColor) {
    const gray = Math.round((baseIntensity + whitenFactor) * 255);
    return { r: gray, g: gray, b: gray, a: 255 };
  }

  return {
    r: Math.min(
      255,
      (accentColor.r / 255) * baseIntensity * 255 + whitenFactor * 255
    ),
    g: Math.min(
      255,
      (accentColor.g / 255) * baseIntensity * 255 + whitenFactor * 255
    ),
    b: Math.min(
      255,
      (accentColor.b / 255) * baseIntensity * 255 + whitenFactor * 255
    ),
    a: 255,
  };
}
