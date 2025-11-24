import { Vector2, IsMouseButtonReleased, MOUSE_BUTTON_LEFT } from "raylib";
import { drawSprite } from "../../../../utils/sprite";

export class VisualizeButton {
  private hovered: boolean = false;
  private readonly size: number = 65;

  public update(mousePos: Vector2, x: number, y: number): boolean {
    this.hovered =
      mousePos.x >= x &&
      mousePos.x <= x + this.size &&
      mousePos.y >= y &&
      mousePos.y <= y + this.size;

    return this.hovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT);
  }

  public draw(x: number, y: number): void {
    const halfSize = this.size / 2;
    const centerX = x + this.size / 2;
    const centerY = y + this.size / 2;

    const bgAlpha = this.hovered ? 30 : 15;
    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY - halfSize),
      Vector2(this.size, this.size),
      {
        r: 255,
        g: 255,
        b: 255,
        a: bgAlpha,
      }
    );

    const padding = 14;
    const iconSize = this.size - padding * 2;
    const iconColor = this.hovered
      ? { r: 255, g: 255, b: 255, a: 255 }
      : { r: 230, g: 230, b: 230, a: 255 };
    drawSprite(
      "/eye.png",
      Vector2(centerX - iconSize / 2, centerY - iconSize / 2),
      Vector2(iconSize, iconSize),
      iconColor
    );

    drawSprite(
      "/solid.png",
      Vector2(centerX - halfSize, centerY + halfSize - 2),
      Vector2(this.size, 2),
      { r: 255, g: 255, b: 255, a: this.hovered ? 120 : 60 }
    );
  }

  public getSize(): number {
    return this.size;
  }

  public isHovered(): boolean {
    return this.hovered;
  }
}
