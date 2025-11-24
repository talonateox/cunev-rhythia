import {
  Vector2,
  IsMouseButtonDown,
  IsMouseButtonReleased,
  IsMouseButtonPressed,
  MOUSE_BUTTON_LEFT,
} from "raylib";
import { drawSprite } from "../../../../utils/sprite";
import { drawText } from "../../../../utils/text";
import { SoundSpaceMemoryMap } from "../../../../utils/storage/ssmm";
import { tintWithAccent } from "../../../../utils/colors";
import { AccentColor } from "../../../../utils/imageBlur";
import { seek } from "../../../../utils/soundManager";
import { logger } from "../../../../utils/logger";

export class TimeSlider {
  
  private static draggingInstances = 0;
  private static lastSliderBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;

  private currentMap: SoundSpaceMemoryMap | null = null;
  private fadeProgress: number = 0;
  private sliderValue: number = 0;
  private isDraggingSlider: boolean = false;
  private sliderHovered: boolean = false;
  private accentColor: AccentColor | null = null;
  private sliderBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } = { x: 0, y: 0, width: 0, height: 0 };

  public setCurrentMap(map: SoundSpaceMemoryMap | null): void {
    if (map !== this.currentMap) {
      this.currentMap = map;
      this.sliderValue = 0;
      this.isDraggingSlider = false;
      this.sliderHovered = false;
    }
  }

  public setFadeProgress(progress: number): void {
    this.fadeProgress = progress;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public update(mousePos: Vector2 | null): void {
    if (!mousePos || !this.currentMap) return;

    this.sliderHovered = this.isPointInSlider(mousePos);

    
    if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
      if (this.isPointInSlider(mousePos)) {
        this.isDraggingSlider = true;
        TimeSlider.draggingInstances++;
        this.updateSliderValue(mousePos);
      }
    }

    if (this.isDraggingSlider) {
      if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
        this.updateSliderValue(mousePos);
      } else {
        this.isDraggingSlider = false;
        if (TimeSlider.draggingInstances > 0) {
          TimeSlider.draggingInstances--;
        }
        const seekTimeMs = this.getStartTimeMs();
        const seekTimeSeconds = seekTimeMs / 1000;
        seek(seekTimeSeconds);
        logger(`Seeking to ${seekTimeSeconds.toFixed(1)}s`);
      }
    }
  }

  public draw(centerX: number, y: number): void {
    if (!this.currentMap) return;

    const sliderWidth = 300;
    const sliderHeight = 6;
    const knobSize = 20;
    const labelWidth = 100;
    const timeWidth = 80;
    const totalWidth = labelWidth + sliderWidth + timeWidth + 40;

    const startX = centerX - totalWidth / 2;
    const sliderX = startX + labelWidth + 20;
    const sliderY = y;

    drawText(
      "Start from",
      Vector2(startX, sliderY - 13),
      24,
      { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
      "left"
    );

    drawSprite(
      "/solid.png",
      Vector2(sliderX, sliderY - sliderHeight / 2),
      Vector2(sliderWidth, sliderHeight),
      { r: 60, g: 60, b: 60, a: this.fadeProgress * 255 }
    );

    const filledWidth = sliderWidth * this.sliderValue;
    if (filledWidth > 0) {
      const fillColor = tintWithAccent(
        { r: 100, g: 200, b: 255 },
        this.accentColor,
        0.8
      );

      drawSprite(
        "/solid.png",
        Vector2(sliderX, sliderY - sliderHeight / 2),
        Vector2(filledWidth, sliderHeight),
        { ...fillColor, a: this.fadeProgress * 255 }
      );
    }

    const knobX = sliderX + sliderWidth * this.sliderValue;
    const knobColor =
      this.sliderHovered || this.isDraggingSlider
        ? { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 }
        : { r: 200, g: 200, b: 200, a: this.fadeProgress * 255 };

    drawSprite(
      "/solid.png",
      Vector2(knobX - knobSize / 2, sliderY - knobSize / 2),
      Vector2(knobSize, knobSize),
      knobColor
    );

    const durationMs = this.currentMap.duration || 0;
    const currentMs = durationMs * this.sliderValue;
    const minutes = Math.floor(currentMs / 60000);
    const seconds = Math.floor((currentMs % 60000) / 1000);
    const timeText = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    drawText(
      timeText,
      Vector2(sliderX + sliderWidth + 20, sliderY - 13),
      24,
      { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
      "left"
    );

    this.sliderBounds = {
      x: sliderX - knobSize / 2,
      y: sliderY - knobSize / 2,
      width: sliderWidth + knobSize,
      height: knobSize,
    };

    
    TimeSlider.lastSliderBounds = { ...this.sliderBounds };
  }

  private isPointInSlider(mousePos: Vector2): boolean {
    return (
      mousePos.x >= this.sliderBounds.x &&
      mousePos.x <= this.sliderBounds.x + this.sliderBounds.width &&
      mousePos.y >= this.sliderBounds.y &&
      mousePos.y <= this.sliderBounds.y + this.sliderBounds.height
    );
  }

  private updateSliderValue(mousePos: Vector2): void {
    const relativeX = mousePos.x - this.sliderBounds.x;
    const normalizedValue = Math.max(
      0,
      Math.min(1, relativeX / this.sliderBounds.width)
    );
    this.sliderValue = normalizedValue;
  }

  public getStartTimeMs(): number {
    if (!this.currentMap) return 0;
    return Math.floor((this.currentMap.duration || 0) * this.sliderValue);
  }

  
  public static isAnyDragging(): boolean {
    return TimeSlider.draggingInstances > 0;
  }

  public static isMouseOverAny(boundsCheckPos: {
    x: number;
    y: number;
  }): boolean {
    const b = TimeSlider.lastSliderBounds;
    if (!b) return false;
    const x = boundsCheckPos.x;
    const y = boundsCheckPos.y;
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }
}
