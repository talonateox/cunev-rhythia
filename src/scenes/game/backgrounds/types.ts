import type { GameSettings } from "../../../utils/gameSettingsSchema";

export interface BackgroundRenderContext {
  msTime: number;
  farDistance: number;
  settings: Partial<GameSettings>;
  backgroundOpacity: number;
  cameraTiltX: number;
  cameraTiltY: number;
}
