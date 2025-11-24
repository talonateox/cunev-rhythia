import {
  Vector2,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { lerpDelta } from "../../../utils/lerp";

interface ToggleSwitchOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  initialValue?: boolean;
  onToggle?: (value: boolean) => void;
}

export class ToggleSwitch {
  private readonly x: number;
  private readonly y: number;
  private readonly width: number;
  private readonly height: number;
  private state: boolean;
  private hoverProgress: number = 0;
  private animationProgress: number;
  private readonly onToggle?: (value: boolean) => void;
  private hovered: boolean = false;

  constructor(options: ToggleSwitchOptions) {
    this.x = options.x;
    this.y = options.y;
    this.width = options.width ?? 56;
    this.height = options.height ?? 28;
    this.state = options.initialValue ?? true;
    this.animationProgress = this.state ? 1 : 0;
    this.onToggle = options.onToggle;
  }

  public update(mousePos: Vector2 | null): void {
    const isHovered =
      !!mousePos &&
      mousePos.x >= this.x &&
      mousePos.x <= this.x + this.width &&
      mousePos.y >= this.y &&
      mousePos.y <= this.y + this.height;

    this.hovered = isHovered;
    this.hoverProgress = lerpDelta(this.hoverProgress, isHovered ? 1 : 0, 0.2);
    this.animationProgress = lerpDelta(
      this.animationProgress,
      this.state ? 1 : 0,
      0.2
    );

    if (isHovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
      this.state = !this.state;
      this.onToggle?.(this.state);
    }
  }

  public render(opacity: number = 1): void {
    const trackColorOn = { r: 100, g: 200, b: 100 };
    const trackColorOff = { r: 60, g: 60, b: 60 };

    const baseColor = this.state ? trackColorOn : trackColorOff;
    const hoverBoost = this.hoverProgress * 20;

    const trackColor = {
      r: Math.min(255, baseColor.r + hoverBoost),
      g: Math.min(255, baseColor.g + hoverBoost),
      b: Math.min(255, baseColor.b + hoverBoost),
      a: Math.round(255 * opacity),
    };

    drawSprite(
      "/solid.png",
      Vector2(this.x, this.y),
      Vector2(this.width, this.height),
      trackColor
    );

    const knobSize = this.height - 6;
    const knobPadding = 3;
    const knobX =
      this.x +
      knobPadding +
      (this.width - knobSize - knobPadding * 2) * this.animationProgress;

    drawSprite(
      "/solid.png",
      Vector2(knobX, this.y + knobPadding),
      Vector2(knobSize, knobSize),
      { r: 255, g: 255, b: 255, a: Math.round(255 * opacity) }
    );
  }

  public setValue(value: boolean): void {
    this.state = value;
    this.animationProgress = value ? 1 : 0;
  }

  public getValue(): boolean {
    return this.state;
  }

  public isHovered(): boolean {
    return this.hovered;
  }
}
