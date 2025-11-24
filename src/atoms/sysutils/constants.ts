export const DEFAULT_GAME_WIDTH = 1920;
export const DEFAULT_GAME_HEIGHT = 1080;
export const DEFAULT_PIXEL_COUNT = DEFAULT_GAME_WIDTH * DEFAULT_GAME_HEIGHT;

export type RenderScaleMode = "fit" | "cover" | "stretch";

export interface RenderViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureSlice {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const MIN_RENDER_SCALE = 0.25;
export const MAX_RENDER_SCALE = 4.0;

export const DEV_MODE = false;
