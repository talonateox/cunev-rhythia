import { Vector2, IsMouseButtonDown, MOUSE_BUTTON_LEFT } from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { lerpDelta } from "../../../utils/lerp";
import { AccentColor } from "../../../utils/imageBlur";

export interface DualSliderProps {
  position: Vector2;
  width: number;
  height?: number;
  minValue: number;
  maxValue: number;
  initialMinValue?: number;
  initialMaxValue?: number;
  label?: string;
  showValues?: boolean;
  precision?: number;
  valueFormatter?: (value: number) => string;
  onValueChange?: (minValue: number, maxValue: number) => void;
}

export class DualSlider {
  private gameObject: GameObject;
  private props: DualSliderProps;
  private minThumbValue: number; 
  private maxThumbValue: number; 
  private isDraggingMin: boolean = false;
  private isDraggingMax: boolean = false;
  private minThumbHovered: boolean = false;
  private maxThumbHovered: boolean = false;
  private fadeProgress: number = 0;
  private accentColor: AccentColor | null = null;

  private readonly thumbSize: number = 12;
  private readonly trackHeight: number;

  constructor(props: DualSliderProps) {
    this.props = { height: 6, precision: 1, showValues: true, ...props };
    this.trackHeight = this.props.height!;

    const minVal = props.initialMinValue ?? props.minValue;
    const maxVal = props.initialMaxValue ?? props.maxValue;
    this.minThumbValue =
      (minVal - props.minValue) / (props.maxValue - props.minValue);
    this.maxThumbValue =
      (maxVal - props.minValue) / (props.maxValue - props.minValue);

    this.gameObject = new GameObject({ zBase: 4 }); 
    this.initialize();
  }

  private initialize(): void {
    this.gameObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: 2000, y: 2000 }, 
    });

    this.gameObject.onDraw = () => this.draw();
    this.gameObject.onUpdate = () => this.update();
  }

  private update(): void {
    const mousePos = this.gameObject.getMousePosition();
    if (!mousePos) return;

    this.minThumbHovered = this.isPointInMinThumb(mousePos);
    this.maxThumbHovered = this.isPointInMaxThumb(mousePos);

    if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
      if (this.minThumbHovered && !this.isDraggingMax) {
        this.isDraggingMin = true;
      }
      if (this.maxThumbHovered && !this.isDraggingMin) {
        this.isDraggingMax = true;
      }

      if (this.isDraggingMin) {
        this.updateMinThumb(mousePos);
      }
      if (this.isDraggingMax) {
        this.updateMaxThumb(mousePos);
      }
    } else {
      if (this.isDraggingMin || this.isDraggingMax) {
        this.triggerValueChange();
      }
      this.isDraggingMin = false;
      this.isDraggingMax = false;
    }

    this.fadeProgress = lerpDelta(this.fadeProgress, 1, 0.1);
  }

  private draw(): void {
    if (this.fadeProgress < 0.01) return;

    const { position, width, label, showValues } = this.props;
    const trackY = position.y;

    if (label) {
      drawText(
        label,
        Vector2(position.x, trackY - 30),
        24,
        { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
        "left"
      );
    }

    drawSprite(
      "/solid.png",
      Vector2(position.x, trackY - this.trackHeight / 2),
      Vector2(width, this.trackHeight),
      { r: 60, g: 60, b: 60, a: this.fadeProgress * 255 }
    );

    const minX = position.x + width * this.minThumbValue;
    const maxX = position.x + width * this.maxThumbValue;
    const filledWidth = maxX - minX;

    if (filledWidth > 0) {
      let fillR = 100,
        fillG = 200,
        fillB = 255;
      if (this.accentColor) {
        const tintStrength = 0.8;
        fillR = Math.round(
          fillR * (1 - tintStrength) + this.accentColor.r * tintStrength
        );
        fillG = Math.round(
          fillG * (1 - tintStrength) + this.accentColor.g * tintStrength
        );
        fillB = Math.round(
          fillB * (1 - tintStrength) + this.accentColor.b * tintStrength
        );
      }

      drawSprite(
        "/solid.png",
        Vector2(minX, trackY - this.trackHeight / 2),
        Vector2(filledWidth, this.trackHeight),
        { r: fillR, g: fillG, b: fillB, a: this.fadeProgress * 255 }
      );
    }

    this.drawThumb(minX, trackY, this.minThumbHovered || this.isDraggingMin);
    this.drawThumb(maxX, trackY, this.maxThumbHovered || this.isDraggingMax);

    if (showValues) {
      const minValue = this.getMinValue();
      const maxValue = this.getMaxValue();
      const precision = this.props.precision!;
      const formatter = this.props.valueFormatter;

      const minValueText = formatter
        ? formatter(minValue)
        : minValue.toFixed(precision);
      drawText(
        minValueText,
        Vector2(position.x, trackY + 5),
        22,
        { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
        "left"
      );

      let maxValueText: string;
      if (maxValue >= this.props.maxValue) {
        maxValueText = "∞";
      } else {
        maxValueText = formatter
          ? formatter(maxValue)
          : maxValue.toFixed(precision);
      }
      drawText(
        maxValueText,
        Vector2(position.x + width, trackY + 5),
        22,
        { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
        "right"
      );
    }
  }

  private drawThumb(x: number, y: number, isHighlighted: boolean): void {
    const color = isHighlighted
      ? { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 }
      : { r: 200, g: 200, b: 200, a: this.fadeProgress * 255 };

    drawSprite(
      "/circle.png",
      Vector2(x - this.thumbSize / 2, y - this.thumbSize / 2),
      Vector2(this.thumbSize, this.thumbSize),
      color
    );
  }

  private isPointInMinThumb(mousePos: Vector2): boolean {
    const thumbX =
      this.props.position.x + this.props.width * this.minThumbValue;
    const thumbY = this.props.position.y;

    return (
      mousePos.x >= thumbX - this.thumbSize / 2 &&
      mousePos.x <= thumbX + this.thumbSize / 2 &&
      mousePos.y >= thumbY - this.thumbSize / 2 &&
      mousePos.y <= thumbY + this.thumbSize / 2
    );
  }

  private isPointInMaxThumb(mousePos: Vector2): boolean {
    const thumbX =
      this.props.position.x + this.props.width * this.maxThumbValue;
    const thumbY = this.props.position.y;

    return (
      mousePos.x >= thumbX - this.thumbSize / 2 &&
      mousePos.x <= thumbX + this.thumbSize / 2 &&
      mousePos.y >= thumbY - this.thumbSize / 2 &&
      mousePos.y <= thumbY + this.thumbSize / 2
    );
  }

  private updateMinThumb(mousePos: Vector2): void {
    const relativeX = mousePos.x - this.props.position.x;
    let normalizedValue = Math.max(
      0,
      Math.min(1, relativeX / this.props.width)
    );

    normalizedValue = Math.min(normalizedValue, this.maxThumbValue);

    this.minThumbValue = normalizedValue;
  }

  private updateMaxThumb(mousePos: Vector2): void {
    const relativeX = mousePos.x - this.props.position.x;
    let normalizedValue = Math.max(
      0,
      Math.min(1, relativeX / this.props.width)
    );

    normalizedValue = Math.max(normalizedValue, this.minThumbValue);

    this.maxThumbValue = normalizedValue;
  }

  private triggerValueChange(): void {
    if (this.props.onValueChange) {
      this.props.onValueChange(this.getMinValue(), this.getMaxValue());
    }
  }

  public getMinValue(): number {
    const { minValue, maxValue } = this.props;
    return minValue + (maxValue - minValue) * this.minThumbValue;
  }

  public getMaxValue(): number {
    const { minValue, maxValue } = this.props;
    return minValue + (maxValue - minValue) * this.maxThumbValue;
  }

  public setValues(minValue: number, maxValue: number): void {
    const { minValue: propMin, maxValue: propMax } = this.props;
    this.minThumbValue = (minValue - propMin) / (propMax - propMin);
    this.maxThumbValue = (maxValue - propMin) / (propMax - propMin);
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public setPosition(position: Vector2): void {
    this.props.position = position;
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public destroy(): void {
    this.gameObject.destroy();
  }
}

export function createDualSlider(props: DualSliderProps): DualSlider {
  return new DualSlider(props);
}
