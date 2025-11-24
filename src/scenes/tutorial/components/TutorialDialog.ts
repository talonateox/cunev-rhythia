import { Vector2, Color, IsKeyPressed, KEY_SPACE } from "raylib";
import { drawText } from "../../../utils/text";
import { drawSprite } from "../../../utils/sprite";
import { createTween, easings } from "../../../utils/tween";
import { Rhythia } from "../../../atoms/Rhythia";
import { MascotEmote } from "../types";
import { playFx } from "../../../utils/soundManager";
import { GameObject } from "../../../atoms/Object";

export class TutorialDialog {
  private gameObject: GameObject;
  private opacity: number = 0;
  private dialogHeight: number = 200;
  private mascotScale: number = 0;
  private textOpacity: number = 0;
  private isVisible: boolean = false;

  private displayedText: string = "";
  private fullText: string = "";
  private textIndex: number = 0;
  private lastCharTime: number = 0;
  private charDelay: number = 20;

  private currentMascot: MascotEmote = "happy";
  private showContinuePrompt: boolean = false;

  constructor() {
    this.gameObject = new GameObject({ zBase: 15, sceneOwner: "Tutorial" });
    this.gameObject.onDraw = () => this.renderDialog();
    this.gameObject.onUpdate = () => this.updateTextAnimation();
  }

  public async show(): Promise<void> {
    this.isVisible = true;

    createTween(
      "tutorialFadeIn",
      0,
      1,
      0.5,
      (value) => {
        this.opacity = value;
      },
      easings.easeOutQuad
    );

    createTween(
      "tutorialMascotScale",
      0,
      1,
      0.6,
      (value) => {
        this.mascotScale = value;
      },
      easings.easeOutBack
    );

    return new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
  }

  public hide(onComplete?: () => void): void {
    createTween(
      "tutorialFadeOut",
      1,
      0,
      0.5,
      (value) => {
        this.opacity = value;
        this.textOpacity = value;
        this.mascotScale = value;
      },
      easings.easeInQuad
    ).onEnd(() => {
      this.isVisible = false;
      onComplete?.();
    });
  }

  public updateContent(
    text: string,
    mascotEmote: MascotEmote,
    showPrompt: boolean = true
  ): void {
    this.fullText = text;
    this.currentMascot = mascotEmote;
    this.showContinuePrompt = showPrompt;
    this.displayedText = "";
    this.textIndex = 0;
    this.lastCharTime = Date.now() - this.charDelay;
    this.textOpacity = 1;
  }

  public render(): void {}

  private updateTextAnimation(): void {
    if (!this.isVisible || this.opacity <= 0) return;

    const currentTime = Date.now();

    if (
      this.textIndex < this.fullText.length &&
      currentTime - this.lastCharTime > this.charDelay
    ) {
      const nextChar = this.fullText[this.textIndex];
      this.displayedText += nextChar;

      if (nextChar !== " " && nextChar !== "\n" && this.textIndex % 2 === 0) {
        playFx("/type.wav", 0.1); 
      }

      this.textIndex++;
      this.lastCharTime = currentTime;
    }
  }

  private renderDialog(): void {
    if (!this.isVisible || this.opacity <= 0) return;

    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;

    const dialogY = screenHeight - this.dialogHeight - 50;
    const dialogX = 50;
    const dialogWidth = screenWidth - 100;

    const bgColor: Color = { r: 20, g: 20, b: 20, a: 220 * this.opacity };
    drawSprite(
      "/solid.png",
      Vector2(dialogX, dialogY),
      Vector2(dialogWidth, this.dialogHeight),
      bgColor
    );

    this.drawBorder(dialogX, dialogY, dialogWidth);

    this.renderMascot(dialogX, dialogY);

    this.renderText(dialogX, dialogY, dialogWidth);

    this.renderContinuePrompt(dialogX, dialogY, dialogWidth);
  }

  private drawBorder(
    dialogX: number,
    dialogY: number,
    dialogWidth: number
  ): void {
    const borderColor: Color = {
      r: 100,
      g: 100,
      b: 100,
      a: 255 * this.opacity,
    };
    const borderThickness = 2;

    drawSprite(
      "/solid.png",
      Vector2(dialogX, dialogY),
      Vector2(dialogWidth, borderThickness),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(dialogX, dialogY + this.dialogHeight - borderThickness),
      Vector2(dialogWidth, borderThickness),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(dialogX, dialogY),
      Vector2(borderThickness, this.dialogHeight),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(dialogX + dialogWidth - borderThickness, dialogY),
      Vector2(borderThickness, this.dialogHeight),
      borderColor
    );
  }

  private renderMascot(dialogX: number, dialogY: number): void {
    const mascotSize = 150 * this.mascotScale;
    const mascotX = dialogX + 20;
    const mascotY = dialogY + (this.dialogHeight - mascotSize) / 2;

    drawSprite(
      `/mascot-${this.currentMascot}.png`,
      Vector2(mascotX, mascotY),
      Vector2(mascotSize, mascotSize),
      { r: 255, g: 255, b: 255, a: 255 * this.opacity }
    );
  }

  private renderText(
    dialogX: number,
    dialogY: number,
    dialogWidth: number
  ): void {
    const mascotSize = 150 * this.mascotScale;
    const textX = dialogX + 20 + mascotSize + 30;
    const textY = dialogY + 30;
    const maxTextWidth = dialogWidth - mascotSize - 80;

    this.drawWrappedText(this.displayedText, textX, textY, maxTextWidth, 36, {
      r: 255,
      g: 255,
      b: 255,
      a: 255 * this.textOpacity * this.opacity,
    });
  }

  private renderContinuePrompt(
    dialogX: number,
    dialogY: number,
    dialogWidth: number
  ): void {
    if (this.textIndex >= this.fullText.length && this.showContinuePrompt) {
      const promptOpacity = Math.abs(Math.sin(Date.now() * 0.003)) * 255;
      drawText(
        "Click or SPACE to continue",
        Vector2(dialogX + dialogWidth - 250, dialogY + this.dialogHeight - 35),
        22,
        { r: 200, g: 200, b: 200, a: promptOpacity * this.opacity },
        "center"
      );
    }
  }

  private drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    color: Color
  ): void {
    const words = text.split(" ");
    let currentLine = "";
    let currentY = y;
    const lineHeight = fontSize + 10;
    const charWidth = fontSize * 0.6;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = testLine.length * charWidth;

      if (testWidth > maxWidth && currentLine) {
        drawText(currentLine, Vector2(x, currentY), fontSize, color, "left");
        currentLine = word;
        currentY += lineHeight;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      drawText(currentLine, Vector2(x, currentY), fontSize, color, "left");
    }
  }

  public isTextComplete(): boolean {
    return this.textIndex >= this.fullText.length;
  }

  public destroy(): void {
    this.gameObject.destroy();
  }
}
