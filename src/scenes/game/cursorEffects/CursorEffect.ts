import { Vector2 } from "raylib";
import { CursorRendererConfig } from "./types";

export interface CursorEffectContext {
  deltaTime: number;
  cursorPosition: Vector2;
  config: CursorRendererConfig;
  currentTime: number;
}

export interface CursorEffect {
  update(context: CursorEffectContext): void;
  render(context: CursorEffectContext): void;
  updateConfig?(config: Partial<CursorRendererConfig>): void;
}
