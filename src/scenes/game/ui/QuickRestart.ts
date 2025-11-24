import { Vector2 } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { drawSprite } from "../../../utils/sprite";

type Phase = "idle" | "fadeOut" | "fadeIn";

export class QuickRestart {
  private phase: Phase = "idle";
  private opacity = 0;
  private readonly fadeDuration: number;

  constructor(fadeDuration = 0.12) {
    this.fadeDuration = Math.max(0.001, fadeDuration);
  }

  public isIdle(): boolean {
    return this.phase === "idle";
  }

  public isFadingOut(): boolean {
    return this.phase === "fadeOut";
  }

  public start(): boolean {
    if (this.phase !== "idle") return false;
    this.phase = "fadeOut";
    this.opacity = 0;
    return true;
  }

  public reset(): void {
    this.phase = "idle";
    this.opacity = 0;
  }

  public update(deltaSeconds: number, onPerform: () => void): void {
    switch (this.phase) {
      case "idle":
        return;
      case "fadeOut": {
        this.opacity = Math.min(
          1,
          this.opacity + deltaSeconds / this.fadeDuration
        );
        if (this.opacity >= 1) {
          onPerform();
          this.phase = "fadeIn";
          this.opacity = 1;
        }
        break;
      }
      case "fadeIn": {
        this.opacity = Math.max(
          0,
          this.opacity - deltaSeconds / this.fadeDuration
        );
        if (this.opacity <= 0) {
          this.phase = "idle";
          this.opacity = 0;
        }
        break;
      }
    }
  }

  public draw(): void {
    if (this.phase === "idle" || this.opacity <= 0) return;
    drawSprite(
      "/solid.png",
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      { r: 0, g: 0, b: 0, a: Math.round(255 * Math.min(1, this.opacity)) }
    );
  }
}
