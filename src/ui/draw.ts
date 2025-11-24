import { Color, Vector2 } from "raylib";
import { drawSprite } from "../utils/sprite";
import { Rhythia } from "../atoms/Rhythia";
import { getPresentationInfo } from "../atoms/sysutils/rendering";

export function drawRect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color,
): void {
  drawSprite("/solid.png", Vector2(x, y), Vector2(width, height), color);
}

export function drawHLine(
  x: number,
  y: number,
  width: number,
  color: Color,
  thickness: number = 2,
): void {
  drawRect(x, y, width, thickness, color);
}

export function drawVLine(
  x: number,
  y: number,
  height: number,
  color: Color,
  thickness: number = 2,
): void {
  drawRect(x, y, thickness, height, color);
}

export function drawBorderRect(
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  color: Color,
): void {
  if (thickness <= 0) return;
  drawHLine(x, y, width, color, thickness);
  drawHLine(x, y + height - thickness, width, color, thickness);
  drawVLine(x, y, height, color, thickness);
  drawVLine(x + width - thickness, y, height, color, thickness);
}

export function drawPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  bgColor: Color,
  borderColor: Color,
  borderThickness: number = 2,
): void {
  drawRect(x, y, width, height, bgColor);
  drawBorderRect(x, y, width, height, borderThickness, borderColor);
}

export function drawOverlay(color: Color): void {
  let displayW = Rhythia.gameWidth;
  let displayH = Rhythia.gameHeight;
  let viewportX = 0;
  let viewportY = 0;
  let viewportW = Rhythia.gameWidth;
  let viewportH = Rhythia.gameHeight;
  try {
    const info = getPresentationInfo();
    displayW = Math.max(1, Math.round(info.displayWidth));
    displayH = Math.max(1, Math.round(info.displayHeight));
    viewportX = Math.round(info.viewport.x);
    viewportY = Math.round(info.viewport.y);
    viewportW = Math.max(1, Math.round(info.viewport.width));
    viewportH = Math.max(1, Math.round(info.viewport.height));
  } catch {}

  const scaleX = viewportW / Math.max(1, Rhythia.gameWidth);
  const scaleY = viewportH / Math.max(1, Rhythia.gameHeight);
  const worldLeftX = -viewportX / Math.max(0.0001, scaleX);
  const worldTopY = -viewportY / Math.max(0.0001, scaleY);
  const worldWidth = displayW / Math.max(0.0001, scaleX);
  const worldHeight = displayH / Math.max(0.0001, scaleY);

  drawSprite(
    "/solid.png",
    Vector2(worldLeftX, worldTopY),
    Vector2(worldWidth, worldHeight),
    color,
  );
}
