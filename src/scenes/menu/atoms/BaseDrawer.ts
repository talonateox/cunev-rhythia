import { Vector2, rlPushMatrix, rlPopMatrix, rlTranslatef } from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";
import { lerpDelta } from "../../../utils/lerp";
import { playFx } from "../../../utils/soundManager";
import { AccentColor } from "../../../utils/imageBlur";
import { tintWithAccent, accentBackground } from "../../../utils/colors";
import { drawRect, drawHLine, drawOverlay } from "../../../ui/draw";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";

export abstract class BaseDrawer {
  protected gameObject: GameObject;
  protected overlayObject: GameObject;
  protected isOpen: boolean = false;
  protected animationProgress: number = 0;
  protected readonly drawerWidth: number;
  protected readonly drawerHeight: number = Rhythia.gameHeight;
  protected accentColor: AccentColor | null = null;
  protected overlayOpacity: number = 0.6;
  protected backgroundOpacity: number = 1.0;

  constructor(drawerWidth: number = 500) {
    this.drawerWidth = drawerWidth;
    this.gameObject = new GameObject({ zBase: 10 }); 
    this.overlayObject = new GameObject({ zBase: 9 }); 
    this.initialize();
  }

  private initialize(): void {
    this.gameObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: this.drawerWidth, y: this.drawerHeight },
    });

    this.overlayObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: Rhythia.gameHeight },
    });

    this.setupEventHandlers();
  }

  protected abstract drawContent(): void;

  protected abstract getHeaderText(): string;

  private setupEventHandlers(): void {
    this.gameObject.onDraw = () => this.draw();

    this.overlayObject.onDraw = () => this.drawOverlay();

    this.gameObject.onUpdate = () => this.update();
    this.overlayObject.onUpdate = () => this.updateOverlay();

    this.overlayObject.rectArea!.onClick = () => {
      if (this.isOpen && this.animationProgress > 0.5) {
        const shouldClose = this.onOverlayClick();
        if (shouldClose) {
          this.close();
          playFx("/hover.wav");
        }
        return true; 
      }
      return false;
    };

    this.gameObject.rectArea!.onClick = () => {
      if (this.isOpen && this.animationProgress > 0.5) {
        const mousePos = this.gameObject.getMousePosition();
        if (mousePos && this.shouldShowCloseButton()) {
          const closeButtonX = this.drawerWidth - 50;
          const closeButtonY = 15;
          const closeButtonSize = 30;

          if (
            mousePos.x >= closeButtonX &&
            mousePos.x <= closeButtonX + closeButtonSize &&
            mousePos.y >= closeButtonY &&
            mousePos.y <= closeButtonY + closeButtonSize
          ) {
            this.close();
            playFx("/hover.wav");
            return true;
          }
        }

        return this.onDrawerClick(mousePos);
      }
      return false;
    };
  }

  protected onDrawerClick(mousePos: Vector2 | null): boolean {
    return true; 
  }

  protected onOverlayClick(): boolean {
    return true;
  }

  private update(): void {
    if (this.isOpen) {
      this.animationProgress = lerpDelta(this.animationProgress, 1, 0.2);
    } else {
      this.animationProgress = lerpDelta(this.animationProgress, 0, 0.2);
    }

    const xOffset =
      -this.drawerWidth + this.drawerWidth * this.animationProgress;
    this.gameObject.rectArea!.pos.x = xOffset;

    this.onUpdate();
  }

  protected onUpdate(): void {}

  private updateOverlay(): void {}

  private drawOverlay(): void {
    if (this.animationProgress <= 0.01 || this.overlayOpacity <= 0) return;

    const overlayAlpha = this.overlayOpacity * this.animationProgress;
    drawOverlay({
      r: 0,
      g: 0,
      b: 0,
      a: Math.round(overlayAlpha * 255),
    });
  }

  private draw(): void {
    if (this.animationProgress <= 0.01) return;

    rlPushMatrix();

    
    
    try {
      let viewportX = 0;
      let viewportW = Rhythia.gameWidth;
      let viewportH = Rhythia.gameHeight;
      try {
        const info = getPresentationInfo();
        viewportX = Math.round(info.viewport.x);
        viewportW = Math.max(1, Math.round(info.viewport.width));
        viewportH = Math.max(1, Math.round(info.viewport.height));
      } catch {}

      const scaleX = viewportW / Math.max(1, Rhythia.gameWidth);
      const worldLeftX = -viewportX / Math.max(0.0001, scaleX);
      const gutterWidth = Math.max(0, -worldLeftX);
      if (gutterWidth > 0) {
        const bgBase = { r: 20, g: 20, b: 25 };
        const bgTint = this.accentColor
          ? accentBackground(this.accentColor, 0.15)
          : bgBase;
        const bg = {
          r: bgBase.r + bgTint.r,
          g: bgBase.g + bgTint.g,
          b: bgBase.b + bgTint.b,
          a: Math.round(this.backgroundOpacity * 255),
        } as any;
        drawRect(worldLeftX, 0, gutterWidth, this.drawerHeight, bg);
      }
    } catch {}

    const xOffset =
      -this.drawerWidth + this.drawerWidth * this.animationProgress;
    rlTranslatef(xOffset, 0, 0);

    this.drawBackground();

    this.drawHeader();

    this.drawCloseButton();

    this.drawContent();

    rlPopMatrix();
  }

  private drawBackground(): void {
    const shadowWidth = 20;
    for (let i = 0; i < shadowWidth; i++) {
      const alpha = (1 - i / shadowWidth) * 0.3 * this.animationProgress;
      drawRect(this.drawerWidth + i, 0, 1, this.drawerHeight, {
        r: 0,
        g: 0,
        b: 0,
        a: Math.round(alpha * 255),
      });
    }

    const bgBase = { r: 20, g: 20, b: 25 };
    const bgTint = this.accentColor
      ? accentBackground(this.accentColor, 0.15)
      : bgBase;
    const bg = {
      r: bgBase.r + bgTint.r,
      g: bgBase.g + bgTint.g,
      b: bgBase.b + bgTint.b,
      a: Math.round(this.backgroundOpacity * 255),
    };

    drawRect(0, 0, this.drawerWidth, this.drawerHeight, bg);

    const borderColor = tintWithAccent(
      { r: 80, g: 80, b: 90 },
      this.accentColor,
      0.3
    );
    drawRect(this.drawerWidth - 2, 0, 2, this.drawerHeight, borderColor);
  }

  private drawHeader(): void {
    drawText(
      this.getHeaderText(),
      Vector2(40, 30),
      42,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    const lineColor = tintWithAccent(
      { r: 60, g: 60, b: 70 },
      this.accentColor,
      0.3
    );

    drawHLine(40, 70, this.drawerWidth - 80, lineColor, 2);
  }

  private drawCloseButton(): void {
    if (!this.shouldShowCloseButton()) {
      return;
    }

    const closeX = this.drawerWidth - 50;
    const closeY = 15;
    const closeSize = 30;

    const mousePos = this.gameObject.getMousePosition();
    let isHovered = false;
    if (mousePos) {
      isHovered =
        mousePos.x >= closeX &&
        mousePos.x <= closeX + closeSize &&
        mousePos.y >= closeY &&
        mousePos.y <= closeY + closeSize;
    }

    const color = isHovered
      ? { r: 255, g: 255, b: 255, a: 255 }
      : { r: 180, g: 180, b: 180, a: 255 };

    drawText(
      "x",
      Vector2(closeX + closeSize / 2 - 8, closeY),
      48,
      color,
      "center"
    );
  }

  protected shouldShowCloseButton(): boolean {
    return true;
  }

  public open(): void {
    this.isOpen = true;
  }

  public close(): void {
    this.isOpen = false;
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;
    playFx("/hover.wav");
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public setOverlayOpacity(opacity: number): void {
    this.overlayOpacity = opacity;
  }

  public setBackgroundOpacity(opacity: number): void {
    this.backgroundOpacity = opacity;
  }

  public isDrawerOpen(): boolean {
    return this.isOpen;
  }

  public destroy(): void {
    this.isOpen = false;
    this.animationProgress = 0;
  }
}
