import {
  Color,
  DrawTextEx,
  GuiGetFont,
  LoadFontEx,
  MeasureTextEx,
  rlPopMatrix,
  rlPushMatrix,
  rlTranslatef,
  Vector2,
  Font,
  SetTextureFilter,
  TEXTURE_FILTER_TRILINEAR,
} from "raylib";
import { state } from "../atoms/sysutils/state";

export type TextAlign = "left" | "center" | "right";

export let textCount = 0;

export function resetTextCount() {
  textCount = 0;
}

let baseFont: Font | null = null;
let fontSourcePath: string | null = null;
const fontCache = new Map<number, Font>();

export function setDefaultFont(font: Font, sourcePath?: string): void {
  baseFont = font;
  fontSourcePath = sourcePath ?? null;
  fontCache.clear();
}

function getFont(fontSize: number): Font {
  const targetSize = Math.max(2, Math.round(fontSize));
  const cached = fontCache.get(targetSize);
  if (cached) return cached;

  const fallback = baseFont ?? GuiGetFont();
  if (!fontSourcePath) return fallback as Font;

  const loaded = LoadFontEx(fontSourcePath, targetSize + 10, 0, 0) as Font;
  try {
    SetTextureFilter(loaded.texture, TEXTURE_FILTER_TRILINEAR);
  } catch {}
  fontCache.set(targetSize, loaded);
  return loaded;
}

export function measureText(
  text: string,
  fontSize: number,
  spacing: number = 1
): { width: number; height: number } {
  const font = getFont(fontSize);
  const v = MeasureTextEx(font, text, fontSize, spacing);
  return { width: v.x, height: v.y };
}

export function drawText(
  text: string,
  position: Vector2,
  fontSize: number,
  color: Color,
  align: TextAlign = "left"
) {
  textCount++;
  rlPushMatrix();
  rlTranslatef(0, 0, -0.5);

  let finalPosition = position;
  const font = getFont(fontSize * state.renderScale);

  if (align !== "left") {
    const textSizeV = MeasureTextEx(font, text, fontSize, 1);
    const textSize = { w: textSizeV.x, h: textSizeV.y };

    if (align === "center") {
      finalPosition = Vector2(position.x - textSize.w / 2, position.y);
    } else if (align === "right") {
      finalPosition = Vector2(position.x - textSize.w, position.y);
    }
  }

  DrawTextEx(font, text, finalPosition, fontSize, 1, color);
  rlPopMatrix();
}
