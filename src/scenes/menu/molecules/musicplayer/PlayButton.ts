import {
  Vector2,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
  GetFrameTime,
} from "raylib";
import { drawText } from "../../../../utils/text";
import { createTween, cancelTween, easings } from "../../../../utils/tween";
import { lerpDelta } from "../../../../utils/lerp";
import { drawRect } from "../../../../ui/draw";
import { updateLerpArray, waveSequence } from "../../../../ui/anim";

export interface PlayButtonOptions {
  text?: string;
  width?: number;
  height?: number;
  animateLetters?: boolean;
}

export class PlayButton {
  private hovered: boolean = false;
  private fadeProgress: number = 1;
  private borderFillProgress: number = 0;
  private letterWaveAnimation: number[] = []; 
  private wasHovered: boolean = false;

  private buttonWidth: number = 280;
  private buttonHeight: number = 65;
  private text: string = "PLAY";
  private animateLetters: boolean = true;
  private static idCounter = 0;
  private tweenKey: string;

  constructor(options?: PlayButtonOptions) {
    if (options?.width) this.buttonWidth = options.width;
    if (options?.height) this.buttonHeight = options.height;
    if (options?.text) this.text = options.text;
    if (options?.animateLetters !== undefined)
      this.animateLetters = options.animateLetters;
    this.letterWaveAnimation = new Array(this.text.length).fill(0);
    this.tweenKey = `playButtonBorder-${PlayButton.idCounter++}`;
  }

  public update(mousePos: Vector2, centerX: number, y: number): boolean {
    const buttonX = centerX - this.buttonWidth / 2;
    const buttonY = y;

    this.hovered =
      mousePos.x >= buttonX &&
      mousePos.x <= buttonX + this.buttonWidth &&
      mousePos.y >= buttonY &&
      mousePos.y <= buttonY + this.buttonHeight;

    if (this.hovered && !this.wasHovered) {
      this.startHoverAnimation();
      if (this.animateLetters) this.startLetterWaveAnimation();
    } else if (!this.hovered && this.wasHovered) {
      this.startUnhoverAnimation();
    }

    this.wasHovered = this.hovered;

    this.updateLetterWaveAnimation();

    if (this.hovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
      return true; 
    }

    return false;
  }

  private startHoverAnimation(): void {
    cancelTween(this.tweenKey);

    createTween(
      this.tweenKey,
      this.borderFillProgress,
      1,
      0.3,
      (value) => {
        this.borderFillProgress = value;
      },
      easings.easeOutQuad
    );
  }

  private startUnhoverAnimation(): void {
    cancelTween(this.tweenKey);

    createTween(
      this.tweenKey,
      this.borderFillProgress,
      0,
      0.2,
      (value) => {
        this.borderFillProgress = value;
      },
      easings.easeInQuad
    );
  }

  private startLetterWaveAnimation(): void {
    this.letterWaveAnimation = new Array(this.text.length).fill(0);
    waveSequence(this.text.length, (i) => {
      if (this.letterWaveAnimation[i] !== undefined) {
        this.letterWaveAnimation[i] = 1;
      }
    }, 50);
  }

  private updateLetterWaveAnimation(): void {
    if (!this.animateLetters) return;
    updateLerpArray(this.letterWaveAnimation, 0.1, 0.01);
  }

  public draw(centerX: number, y: number): void {
    const opacity = Math.round(255 * this.fadeProgress);
    if (opacity < 5) return;

    const buttonX = centerX - this.buttonWidth / 2;
    const buttonY = y;

    drawRect(buttonX, buttonY, this.buttonWidth, this.buttonHeight, {
      r: 255,
      g: 255,
      b: 255,
      a: Math.round(opacity * 0.05),
    });

    if (this.borderFillProgress > 0) {
      const fillHeight = this.buttonHeight * this.borderFillProgress;
      const fillY = buttonY + this.buttonHeight - fillHeight;

      drawRect(buttonX, fillY, this.buttonWidth, fillHeight, {
        r: 255,
        g: 255,
        b: 255,
        a: Math.round(opacity * 0.08 * this.borderFillProgress),
      });
    }

    const borderThickness = 2;
    drawRect(
      buttonX,
      buttonY + this.buttonHeight - borderThickness,
      this.buttonWidth,
      borderThickness,
      { r: 255, g: 255, b: 255, a: Math.round(opacity * 0.5) }
    );

    const fontSize = 32; 
    const letterSpacing = 20; 

    if (!this.animateLetters) {
      const textY = buttonY + this.buttonHeight / 2 - fontSize / 2.2;
      const letterOpacity = this.hovered ? 0.95 : 0.8;
      drawText(
        this.text,
        Vector2(centerX, textY),
        fontSize,
        { r: 255, g: 255, b: 255, a: Math.round(opacity * letterOpacity) },
        "center"
      );
    } else {
      const textWidth = this.text.length * letterSpacing - 5; 
      const startX = centerX - textWidth / 2 + letterSpacing / 2; 

      for (let i = 0; i < this.text.length; i++) {
        const letter = this.text[i];
        const letterX = startX + i * letterSpacing;

        let animScale = 1;
        let animOffsetY = 0;
        if (
          this.animateLetters &&
          this.letterWaveAnimation[i] &&
          this.letterWaveAnimation[i] > 0
        ) {
          const waveProgress = this.letterWaveAnimation[i];
          animScale = 1 + Math.sin(waveProgress * Math.PI * 2) * 0.2; 
          animOffsetY = Math.sin(waveProgress * Math.PI) * -8; 
        }

        const letterY =
          buttonY +
          this.buttonHeight / 2 -
          (fontSize * animScale) / 2.2 +
          animOffsetY;

        const letterOpacity = this.hovered ? 0.95 : 0.8;

        drawText(
          letter,
          Vector2(letterX, letterY),
          fontSize * animScale, 
          { r: 255, g: 255, b: 255, a: Math.round(opacity * letterOpacity) },
          "center"
        );
      }
    }
  }

  public setFadeProgress(progress: number): void {
    this.fadeProgress = progress;
  }

  public isHovered(): boolean {
    return this.hovered;
  }

  public getWidth(): number {
    return this.buttonWidth;
  }

  public getHeight(): number {
    return this.buttonHeight;
  }
}
