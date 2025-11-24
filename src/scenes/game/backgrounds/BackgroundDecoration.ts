import { Color } from "raylib";
import { BackgroundRenderContext } from "./types";

export interface BackgroundDecoration {
  init?(): void;
  destroy?(): void;
  setAccentColor(color: Color): void;
  render(context: BackgroundRenderContext): void;
}
