import {
  Vector2,
  IsMouseButtonDown,
  IsMouseButtonPressed,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
} from "raylib";
import { drawText } from "../../../utils/text";
import { drawRect } from "../../../ui/draw";
import { inRect } from "../../../utils/geometry";
import { tintWithAccent } from "../../../utils/colors";

export interface GameSliderConfig {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  x: number;
  y: number;
  width: number;
  onChange?: (value: number) => void;
}

export interface GameSliderState {
  isDragging: boolean;
  isHovered: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

export class GameSlider {
  private config: GameSliderConfig;
  private state: GameSliderState;
  private accentColor = { r: 100, g: 200, b: 255 };
  private static activeSlider: GameSlider | null = null;

  constructor(config: GameSliderConfig) {
    this.config = { ...config };
    this.state = {
      isDragging: false,
      isHovered: false,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    };
  }

  public update(mousePos: Vector2 | null): void {
    const mouseDown = IsMouseButtonDown(MOUSE_BUTTON_LEFT);
    const mousePressed = IsMouseButtonPressed(MOUSE_BUTTON_LEFT);
    const mouseReleased = IsMouseButtonReleased(MOUSE_BUTTON_LEFT);

    if (GameSlider.activeSlider === this && (!mouseDown || mouseReleased)) {
      this.state.isDragging = false;
      GameSlider.activeSlider = null;
    }

    if (!mousePos) {
      this.state.isHovered = false;
      return;
    }

    this.state.isHovered = this.isPointInSlider(mousePos);

    const hasControl =
      GameSlider.activeSlider === null || GameSlider.activeSlider === this;

    if (!hasControl) {
      this.state.isDragging = false;
      return;
    }

    if (GameSlider.activeSlider === this && mouseDown) {
      this.state.isDragging = true;
      this.updateValue(mousePos);
      return;
    }

    if (
      mousePressed &&
      this.state.isHovered &&
      GameSlider.activeSlider === null
    ) {
      this.state.isDragging = true;
      GameSlider.activeSlider = this;
      this.updateValue(mousePos);
      return;
    }

    this.state.isDragging = false;
    if (!mouseDown && GameSlider.activeSlider === this) {
      GameSlider.activeSlider = null;
    }
  }

  public render(opacity: number = 1): void {
    const sliderHeight = 8;
    const knobSize = 18;

    drawText(
      this.config.label,
      Vector2(this.config.x, this.config.y - 30),
      20,
      { r: 200, g: 200, b: 200, a: opacity * 255 },
      "left"
    );

    drawRect(
      this.config.x,
      this.config.y - sliderHeight / 2,
      this.config.width,
      sliderHeight,
      { r: 60, g: 60, b: 60, a: Math.round(opacity * 255) }
    );

    const normalizedValue =
      (this.config.value - this.config.min) /
      (this.config.max - this.config.min);
    const filledWidth = this.config.width * normalizedValue;

    if (filledWidth > 0) {
      const fillColor = tintWithAccent(
        { r: 100, g: 200, b: 255 },
        this.accentColor,
        0.8
      );

      drawRect(
        this.config.x,
        this.config.y - sliderHeight / 2,
        filledWidth,
        sliderHeight,
        { ...fillColor, a: Math.round(opacity * 255) }
      );
    }

    const knobX = this.config.x + this.config.width * normalizedValue;
    const knobColor =
      this.state.isHovered || this.state.isDragging
        ? { r: 255, g: 255, b: 255, a: opacity * 255 }
        : { r: 200, g: 200, b: 200, a: opacity * 255 };

    drawRect(
      knobX - knobSize / 2,
      this.config.y - knobSize / 2,
      knobSize,
      knobSize,
      knobColor
    );

    const valueText = this.config.value.toFixed(this.config.step < 1 ? 2 : 0);
    drawText(
      valueText,
      Vector2(this.config.x + this.config.width + 20, this.config.y - 10),
      18,
      { r: 180, g: 180, b: 180, a: opacity * 255 },
      "left"
    );

    const HIT_PAD_X = 12;
    const HIT_PAD_Y = 10;
    this.state.bounds = {
      x: this.config.x - knobSize / 2 - HIT_PAD_X,
      y: this.config.y - knobSize / 2 - HIT_PAD_Y,
      width: this.config.width + knobSize + HIT_PAD_X * 2,
      height: knobSize + HIT_PAD_Y * 2,
    };
  }

  public setAccentColor(color: { r: number; g: number; b: number }): void {
    this.accentColor = color;
  }

  public getValue(): number {
    return this.config.value;
  }

  public setValue(value: number): void {
    this.config.value = Math.max(
      this.config.min,
      Math.min(this.config.max, value)
    );
  }

  public getConfig(): GameSliderConfig {
    return { ...this.config };
  }

  private isPointInSlider(mousePos: Vector2): boolean {
    const b = this.state.bounds;
    return inRect(mousePos.x, mousePos.y, b.x, b.y, b.width, b.height);
  }

  public isHovered(): boolean {
    return this.state.isHovered;
  }

  public isDragging(): boolean {
    return this.state.isDragging || GameSlider.activeSlider === this;
  }

  public isHoveredForTooltip(mousePos: Vector2 | null): boolean {
    if (this.isDragging()) return true;
    if (!mousePos) return false;
    const b = this.state.bounds;
    const expandX = 10;
    const expandUp = 22; 
    const expandDown = 8;
    return inRect(
      mousePos.x,
      mousePos.y,
      b.x - expandX,
      b.y - expandUp,
      b.width + expandX * 2,
      b.height + expandUp + expandDown
    );
  }

  private updateValue(mousePos: Vector2): void {
    
    const trackStart = this.config.x;
    const trackWidth = Math.max(1, this.config.width);
    const relativeX = mousePos.x - trackStart;
    const normalizedValue = Math.max(
      0,
      Math.min(1, relativeX / trackWidth)
    );

    const rawValue =
      this.config.min + (this.config.max - this.config.min) * normalizedValue;

    const stepped = Math.round(rawValue / this.config.step) * this.config.step;
    const clampedValue = Math.max(
      this.config.min,
      Math.min(this.config.max, stepped)
    );

    if (clampedValue !== this.config.value) {
      this.config.value = clampedValue;
      this.config.onChange?.(this.config.value);
    }
  }
}
