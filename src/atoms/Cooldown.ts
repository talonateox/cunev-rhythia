import { GetFrameTime, DrawRing, Fade } from "raylib";
import { drawText } from "../utils/text";
import { Vector2 } from "raylib";
import { Rhythia } from "./Rhythia";
import { rgb } from "../utils/colors";

export class Cooldown {
  private duration: number;
  private currentTime: number = 0;
  private isActive: boolean = false;
  private onComplete: (() => void) | null = null;
  private hasCompleted: boolean = false;

  constructor(duration: number = 1.0) {
    this.duration = duration;
  }

  public start(onComplete?: () => void): void {
    if (this.hasCompleted) return;

    this.isActive = true;
    this.currentTime = this.duration;
    this.onComplete = onComplete || null;
  }

  public stop(): void {
    this.isActive = false;
    this.currentTime = 0;
    this.onComplete = null;
  }

  public reset(): void {
    this.isActive = false;
    this.currentTime = 0;
    this.onComplete = null;
    this.hasCompleted = false;
  }

  public update(): void {
    if (!this.isActive) return;

    this.currentTime -= GetFrameTime();

    if (this.currentTime <= 0) {
      this.currentTime = 0;
      this.isActive = false;
      this.hasCompleted = true;
      if (this.onComplete) {
        this.onComplete();
        this.onComplete = null;
      }
    }
  }

  public draw(): void {
    if (!this.isActive) return;

    const clampedTime = Math.max(this.currentTime, 0);
    const progress = 1 - clampedTime / this.duration;

    const timeLabel =
      clampedTime >= 1
        ? Math.ceil(clampedTime).toString()
        : clampedTime.toFixed(2);

    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;

    const baseTextSize = clampedTime >= 1 ? 130 : 105;
    const textSize = baseTextSize + Math.sin(clampedTime * 10) * 6;
    const red = Math.round(255 * (0.5 + progress * 0.5));
    const green = Math.round(255 * (1 - progress * 0.5));
    const blue = Math.round(255 * (1 - progress * 0.5));

    drawText(
      timeLabel,
      Vector2(centerX, centerY - textSize / 2),
      textSize,
      { r: red, g: green, b: blue, a: 255 },
      "center"
    );

    const innerRadius = 118;
    const outerRadius = 142;

    DrawRing(
      Vector2(centerX, centerY),
      innerRadius,
      outerRadius,
      0,
      360,
      36,
      Fade(rgb(0.2, 0.2, 0.2, 1), 0.3)
    );

    if (progress > 0) {
      const startAngle = -90; 
      const endAngle = startAngle + progress * 360;

      const progressColor = rgb(
        0.5 + progress * 0.5, 
        1 - progress * 0.5, 
        1 - progress * 0.5, 
        1
      );

      DrawRing(
        Vector2(centerX, centerY),
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        36,
        Fade(progressColor, 0.9)
      );
    }
  }

  public isRunning(): boolean {
    return this.isActive;
  }

  public getProgress(): number {
    if (!this.isActive) return 0;
    return 1 - this.currentTime / this.duration;
  }

  public getRemainingTime(): number {
    return this.currentTime;
  }
}
