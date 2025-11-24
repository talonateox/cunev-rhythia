import {
  Vector2,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
  GetFrameTime,
} from "raylib";
import { drawSprite } from "../../../../utils/sprite";
import { HeartBurst } from "../../../../utils/particles/HeartBurst";

export class FavoriteButton {
  private hovered: boolean = false;
  private active: boolean = false;

  private readonly size: number = 65;
  private animationTime: number = 0;
  private isAnimating: boolean = false;
  private heartBurst: HeartBurst | null = null;
  private animationMode: "favorite" | "unfavorite" | null = null;

  public update(
    mousePos: Vector2,
    x: number,
    y: number,
    isActive: boolean
  ): boolean {
    this.active = isActive;
    this.hovered =
      mousePos.x >= x &&
      mousePos.x <= x + this.size &&
      mousePos.y >= y &&
      mousePos.y <= y + this.size;
    if (this.isAnimating) {
      const dt = GetFrameTime();
      this.animationTime += dt;
      if (this.heartBurst) {
        this.heartBurst.update(dt);
      }
      const duration = this.animationMode === "unfavorite" ? 0.25 : 0.4;
      if (this.animationTime >= duration) {
        this.isAnimating = false;
        this.animationTime = 0;
        this.heartBurst = null;
        this.animationMode = null;
      }
    }

    const clicked = this.hovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT);
    if (clicked) {
      if (!this.active) {
        this.triggerFavoriteAnimation(x, y);
      } else {
        this.triggerUnfavoriteAnimation();
      }
      return true;
    }
    return false;
  }

  public draw(x: number, y: number): void {
    const isFavAnim = this.isAnimating && this.animationMode === "favorite";
    const animationScale = isFavAnim ? this.getScale(0.4) : 1;
    const animationStretch = isFavAnim ? this.getStretch(0.4) : 1;

    const halfSize = (this.size * animationScale) / 2;
    const centerX = x + this.size / 2;
    const centerY = y + this.size / 2;

    const bgAlpha = this.hovered ? 30 : 15;
    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY - halfSize),
      Vector2(this.size * animationScale, this.size * animationScale),
      {
        r: 255,
        g: 255,
        b: 255,
        a: bgAlpha,
      }
    );

    const padding = 16 * animationScale;
    const baseIconWidth = this.size - padding * 2;
    let iconWidth = baseIconWidth;
    let iconHeight = baseIconWidth * animationStretch;
    let iconOffsetY = 0;

    if (this.isAnimating && this.animationMode === "unfavorite") {
      const s = Math.sin(Math.PI * Math.min(this.animationTime / 0.15, 1));
      
      const xScale = 1 + 0.15 * s;
      const yScale = 1 - 0.25 * s;
      iconWidth = baseIconWidth * xScale;
      iconHeight = baseIconWidth * yScale;
    }
    const iconPath = this.active ? "/heart-fill.png" : "/heart.png";
    const iconColor = this.active
      ? { r: 255, g: 80, b: 120, a: 255 }
      : { r: 200, g: 200, b: 200, a: 220 };
    drawSprite(
      iconPath,
      Vector2(centerX - iconWidth / 2, centerY - iconHeight / 2 + iconOffsetY),
      Vector2(iconWidth, iconHeight),
      iconColor
    );

    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY + halfSize - 2),
      Vector2(this.size * animationScale, 2),
      { r: 255, g: 255, b: 255, a: this.hovered ? 120 : 60 }
    );

    if (this.heartBurst) {
      this.heartBurst.draw();
    }
  }

  private triggerFavoriteAnimation(x: number, y: number): void {
    this.isAnimating = true;
    this.animationMode = "favorite";
    this.animationTime = 0;
    this.heartBurst = new HeartBurst(x + this.size / 2, y + this.size / 2);
  }

  private triggerUnfavoriteAnimation(): void {
    this.isAnimating = true;
    this.animationMode = "unfavorite";
    this.animationTime = 0;
    this.heartBurst = null;
  }

  private stopAnimation(): void {
    this.isAnimating = false;
    this.animationTime = 0;
    this.heartBurst = null;
    this.animationMode = null;
  }

  private getScale(duration: number): number {
    const progress = Math.min(this.animationTime / duration, 1);
    const phase1 = Math.min(progress / 0.5, 1);
    const phase2 = Math.max((progress - 0.5) / 0.5, 0);
    const jump = Math.sin(Math.PI * phase1) * 0.35;
    const settle = Math.sin(Math.PI * phase2) * 0.15;
    return 1 + jump - settle;
  }

  private getStretch(duration: number): number {
    const progress = Math.min(this.animationTime / duration, 1);
    const phase1 = Math.min(progress / 0.5, 1);
    const phase2 = Math.max((progress - 0.5) / 0.5, 0);
    const stretchUp = Math.sin(Math.PI * phase1) * 0.3;
    const squashDown = Math.sin(Math.PI * phase2) * 0.2;
    return 1 + stretchUp - squashDown;
  }

  public isHovered(): boolean {
    return this.hovered;
  }

  public getSize(): number {
    return this.size;
  }
}
