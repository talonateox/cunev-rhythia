import type { GameSettings } from "../../../utils/gameSettingsSchema";

export interface UIDecorationContext {
  msTime: number;
  cameraTiltX: number;
  cameraTiltY: number;
  settings: Partial<GameSettings>;
  combo: number;
  hits: number;
  misses: number;
  score: number;
  health: number;
}

export abstract class UIDecoration {
  protected enabled: boolean = true;
  protected opacity: number = 1.0;
  protected size: number = 1.0;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public setOpacity(opacity: number): void {
    this.opacity = opacity;
  }

  public setSize(size: number): void {
    this.size = size;
  }

  public renderLeftOverlay(
    planeX: number,
    planeY: number,
    planeWidth: number,
    planeHeight: number,
    depth: number,
    context: UIDecorationContext
  ): void {}

  public renderRightOverlay(
    planeX: number,
    planeY: number,
    planeWidth: number,
    planeHeight: number,
    depth: number,
    context: UIDecorationContext
  ): void {}

  public update(deltaTime: number, context: UIDecorationContext): void {}
}

