import { Vector2 } from "raylib";
import { GameObject } from "../atoms/Object";
import { lerpDelta } from "../utils/lerp";
import { drawOverlay } from "./draw";
import { Rhythia } from "../atoms/Rhythia";

export interface OverlayOptions {
  backdropAlpha?: number; 
  consumeOutsideClick?: boolean;
}

export class OverlayBase {
  protected gameObject: GameObject;
  protected isVisible = false;
  protected targetVisible = false;
  protected opacity = 0; 
  protected scale = 0.9;
  protected options: Required<OverlayOptions>;

  constructor(options?: OverlayOptions) {
    this.options = {
      backdropAlpha: options?.backdropAlpha ?? 180,
      consumeOutsideClick: options?.consumeOutsideClick ?? true,
    };
    this.gameObject = new GameObject({ zBase: 10 });
    this.setup();
  }

  protected setup(): void {
    this.gameObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: Rhythia.gameHeight },
    });
    this.gameObject.onDraw = () => this.drawBackdrop();
    this.gameObject.onUpdate = () => this.updateAnimation();
    this.gameObject.rectArea!.onClick = () => {
      if (!this.isActive()) return false;
      return this.options.consumeOutsideClick;
    };
  }

  protected updateAnimation(): void {
    if (this.targetVisible) {
      this.opacity = lerpDelta(this.opacity, 1, 0.3);
      this.scale = lerpDelta(this.scale, 1, 0.3);
    } else {
      this.opacity = lerpDelta(this.opacity, 0, 0.3);
      this.scale = lerpDelta(this.scale, 0.9, 0.3);
      if (this.opacity < 0.01) {
        this.isVisible = false;
      }
    }
  }

  protected drawBackdrop(): void {
    if (!this.isVisible || this.opacity < 0.01) return;
    drawOverlay({ r: 0, g: 0, b: 0, a: Math.round(this.options.backdropAlpha * this.opacity) });
  }

  public open(): void {
    this.targetVisible = true;
    this.isVisible = true;
  }

  public close(): void {
    this.targetVisible = false;
  }

  public toggle(): void {
    if (this.isActive()) this.close();
    else this.open();
  }

  public isActive(): boolean {
    return this.isVisible || this.targetVisible;
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }
}

