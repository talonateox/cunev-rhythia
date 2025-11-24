import {
  Vector2,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
  Color,
} from "raylib";
import { drawText } from "../../../utils/text";
import { drawPanel, drawHLine, drawVLine } from "../../../ui/draw";
import { inRect } from "../../../utils/geometry";

interface GameButtonThemeSection {
  default: Color;
  hovered: Color;
  disabled: Color;
}

interface GameButtonThemeText {
  default: Color;
  disabled: Color;
}

export interface GameButtonTheme {
  background: GameButtonThemeSection;
  border: GameButtonThemeSection;
  text: GameButtonThemeText;
}

export type GameButtonThemeOverrides = {
  background?: Partial<GameButtonThemeSection>;
  border?: Partial<GameButtonThemeSection>;
  text?: Partial<GameButtonThemeText>;
};

const DEFAULT_THEME: GameButtonTheme = {
  background: {
    default: { r: 60, g: 60, b: 70, a: 255 },
    hovered: { r: 80, g: 150, b: 200, a: 255 },
    disabled: { r: 40, g: 40, b: 45, a: 255 },
  },
  border: {
    default: { r: 100, g: 100, b: 110, a: 255 },
    hovered: { r: 120, g: 180, b: 220, a: 255 },
    disabled: { r: 70, g: 70, b: 75, a: 255 },
  },
  text: {
    default: { r: 255, g: 255, b: 255, a: 255 },
    disabled: { r: 120, g: 120, b: 125, a: 255 },
  },
};

function mergeTheme(overrides?: GameButtonThemeOverrides): GameButtonTheme {
  return {
    background: {
      default:
        overrides?.background?.default ?? DEFAULT_THEME.background.default,
      hovered:
        overrides?.background?.hovered ?? DEFAULT_THEME.background.hovered,
      disabled:
        overrides?.background?.disabled ?? DEFAULT_THEME.background.disabled,
    },
    border: {
      default: overrides?.border?.default ?? DEFAULT_THEME.border.default,
      hovered: overrides?.border?.hovered ?? DEFAULT_THEME.border.hovered,
      disabled: overrides?.border?.disabled ?? DEFAULT_THEME.border.disabled,
    },
    text: {
      default: overrides?.text?.default ?? DEFAULT_THEME.text.default,
      disabled: overrides?.text?.disabled ?? DEFAULT_THEME.text.disabled,
    },
  };
}

function applyOpacity(color: Color, opacity: number): Color {
  const alpha = color.a ?? 255;
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: Math.round(Math.max(0, Math.min(1, opacity)) * alpha),
  };
}

export interface GameButtonConfig {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDisabled?: boolean;
  onClick: () => void;
  theme?: GameButtonThemeOverrides;
}

export interface GameButtonState {
  isHovered: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

export class GameButton {
  private config: GameButtonConfig;
  private state: GameButtonState;
  private theme: GameButtonTheme;

  constructor(config: GameButtonConfig) {
    this.config = { ...config };
    this.state = {
      isHovered: false,
      bounds: {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
      },
    };
    this.theme = mergeTheme(config.theme);
  }

  public update(mousePos: Vector2 | null): void {
    if (!mousePos) return;

    this.state.isHovered =
      !this.config.isDisabled && this.isPointInButton(mousePos);

    if (
      IsMouseButtonReleased(MOUSE_BUTTON_LEFT) &&
      this.state.isHovered &&
      !this.config.isDisabled
    ) {
      this.config.onClick();
    }
  }

  public render(opacity: number = 1): void {
    this.state.bounds = {
      x: this.config.x,
      y: this.config.y,
      width: this.config.width,
      height: this.config.height,
    };

    let bgColor: Color;
    if (this.config.isDisabled) {
      bgColor = applyOpacity(this.theme.background.disabled, opacity);
    } else if (this.state.isHovered) {
      bgColor = applyOpacity(this.theme.background.hovered, opacity);
    } else {
      bgColor = applyOpacity(this.theme.background.default, opacity);
    }

    drawPanel(
      this.config.x,
      this.config.y,
      this.config.width,
      this.config.height,
      bgColor,
      
      { r: 0, g: 0, b: 0, a: 0 },
      0
    );

    let borderColor: Color;
    if (this.config.isDisabled) {
      borderColor = applyOpacity(this.theme.border.disabled, opacity);
    } else if (this.state.isHovered) {
      borderColor = applyOpacity(this.theme.border.hovered, opacity);
    } else {
      borderColor = applyOpacity(this.theme.border.default, opacity);
    }

    drawHLine(this.config.x, this.config.y, this.config.width, borderColor, 2);
    drawHLine(
      this.config.x,
      this.config.y + this.config.height - 2,
      this.config.width,
      borderColor,
      2
    );
    
    
    
    drawVLine(this.config.x, this.config.y, this.config.height, borderColor, 2);
    
    drawVLine(
      this.config.x + this.config.width - 2,
      this.config.y,
      this.config.height,
      borderColor,
      2
    );

    const textColor = this.config.isDisabled
      ? applyOpacity(this.theme.text.disabled, opacity)
      : applyOpacity(this.theme.text.default, opacity);

    const fontSize = 20;
    const textY = Math.round(this.config.y + (this.config.height - fontSize) / 2);

    drawText(
      this.config.label,
      Vector2(this.config.x + this.config.width / 2, textY),
      fontSize,
      textColor,
      "center"
    );
  }

  public setDisabled(disabled: boolean): void {
    this.config.isDisabled = disabled;
  }

  public isDisabled(): boolean {
    return !!this.config.isDisabled;
  }

  public getConfig(): GameButtonConfig {
    return { ...this.config };
  }

  public isHovered(): boolean {
    return this.state.isHovered;
  }

  private isPointInButton(mousePos: Vector2): boolean {
    const b = this.state.bounds;
    return inRect(mousePos.x, mousePos.y, b.x, b.y, b.width, b.height);
  }
}
