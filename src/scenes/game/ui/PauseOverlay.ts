import { Vector2, IsMouseButtonPressed, MOUSE_BUTTON_LEFT } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { GameSlider } from "../../customization/atoms/GameSlider";
import { ToggleSwitch } from "../../customization/atoms/ToggleSwitch";
import { ConfigManager } from "../../../utils/configManager";
import {
  getGameSettingByKey,
  toGameConfigKey,
} from "../../../utils/gameSettingsSchema";

export type PauseButtonId = "resume" | "retry" | "settings" | "menu";

interface PauseButtonState {
  id: PauseButtonId;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  hovered: boolean;
}

export class PauseOverlay {
  private active = false;
  private resumeCountdownSeconds: number | null = null;
  private readonly resumeCountdownDuration = 3;
  private buttons: PauseButtonState[] = [];
  private readonly fontSize = 32;
  private quickToggle: ToggleSwitch | null = null;
  private quickSlider: GameSlider | null = null;

  public reset(): void {
    this.active = false;
    this.resumeCountdownSeconds = null;
    this.buttons = [];
    this.quickToggle = null;
    this.quickSlider = null;
  }

  public open(): void {
    this.active = true;
    this.resumeCountdownSeconds = null;
    this.ensureQuickControls();
  }

  public close(): void {
    this.reset();
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get isCountdownActive(): boolean {
    return this.resumeCountdownSeconds !== null;
  }

  public startResumeCountdown(): void {
    if (!this.active || this.resumeCountdownSeconds !== null) return;
    this.resumeCountdownSeconds = this.resumeCountdownDuration;
  }

  public cancelResumeCountdown(): void {
    if (!this.active) return;
    this.resumeCountdownSeconds = null;
  }

  public update(deltaSeconds: number, onCountdownFinished: () => void): void {
    if (!this.active || this.resumeCountdownSeconds === null) return;

    this.resumeCountdownSeconds = Math.max(
      0,
      this.resumeCountdownSeconds - deltaSeconds
    );

    if (this.resumeCountdownSeconds <= 0) {
      this.resumeCountdownSeconds = null;
      onCountdownFinished();
    }
  }

  public handleInput(
    mousePos: Vector2 | null,
    onAction: (id: PauseButtonId) => void
  ): void {
    const disableInteraction = this.resumeCountdownSeconds !== null;
    this.updateButtons(mousePos, disableInteraction);
    this.updateQuickControls(mousePos, disableInteraction);

    if (disableInteraction || !mousePos) return;
    if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
      const hoveredButton = this.buttons.find((b) => b.hovered);
      if (hoveredButton) {
        onAction(hoveredButton.id);
      }
    }
  }

  public draw(): void {
    if (!this.active) return;

    
    const overlayColor = { r: 12, g: 12, b: 12, a: 200 };
    drawSprite(
      "/solid.png",
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      overlayColor
    );

    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2 - 40;

    
    const titleColor = { r: 235, g: 235, b: 235, a: 255 };
    drawText(
      "Paused",
      Vector2(centerX, centerY - 120),
      64,
      titleColor,
      "center"
    );

    if (this.resumeCountdownSeconds !== null) {
      const remainingSeconds = Math.ceil(
        Math.max(0, this.resumeCountdownSeconds)
      );
      
      const countdownColor = { r: 220, g: 220, b: 220, a: 255 };
      drawText(
        `Resuming in ${remainingSeconds}`,
        Vector2(centerX, centerY - 28),
        34,
        countdownColor,
        "center"
      );
      drawText(
        "Press ESC to cancel",
        Vector2(centerX, centerY + 14),
        24,
        
        { r: 190, g: 190, b: 190, a: 255 },
        "center"
      );
      return; 
    }

    this.drawButtons(1);
    this.drawQuickControls(1);
  }

  private updateButtons(mousePos: Vector2 | null, disableHover: boolean): void {
    const fontSize = this.fontSize;
    const buttonWidth = 320;
    const verticalSpacing = 16;
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2 + 36;

    const buttonsConfig: Array<{ id: PauseButtonId; label: string }> = [
      { id: "resume", label: "Resume" },
      { id: "retry", label: "Retry" },
      { id: "settings", label: "Settings" },
      { id: "menu", label: "Back to Menu" },
    ];

    const measuredButtons = buttonsConfig.map((config) => {
      const { width, height } = measureText(config.label, fontSize);
      const rectHeight = Math.round(height + 18);
      const rectWidth = Math.round(Math.max(width + 36, buttonWidth * 0.65));
      return { ...config, rectWidth, rectHeight };
    });

    const totalHeight = measuredButtons.reduce((acc, btn, index) => {
      return acc + btn.rectHeight + (index > 0 ? 16 : 0);
    }, 0);
    let currentY = Math.round(centerY - totalHeight / 2);

    this.buttons = measuredButtons.map((config) => {
      const width = config.rectWidth;
      const height = config.rectHeight;
      const x = Math.round(centerX - width / 2);
      const y = currentY;
      currentY += height + verticalSpacing;

      const rect = { x, y, width, height };
      const hovered =
        !disableHover && mousePos ? this.isPointInRect(mousePos, rect) : false;
      return { id: config.id, label: config.label, rect, hovered };
    });
  }

  private drawButtons(opacityMultiplier: number): void {
    if (this.buttons.length === 0)
      this.updateButtons(null, opacityMultiplier < 1);
    const disabled = opacityMultiplier < 0.99;

    
    const baseText = { r: 240, g: 240, b: 240, a: 255 };
    const hoverText = { r: 255, g: 255, b: 255, a: 255 };
    const disabledText = { r: 190, g: 190, b: 190, a: 220 };

    for (const button of this.buttons) {
      const isHovered = button.hovered && !disabled;
      const targetColor = disabled
        ? disabledText
        : isHovered
        ? hoverText
        : baseText;

      const fontSize = this.fontSize;
      const textY = Math.round(
        button.rect.y + (button.rect.height - fontSize) / 2
      );
      const textColor = this.scaleColor(targetColor, opacityMultiplier);

      drawText(
        button.label,
        Vector2(button.rect.x + button.rect.width / 2, textY),
        fontSize,
        textColor,
        "center"
      );

      if (isHovered) {
        const underlineY = textY + fontSize + 4;
        const underlineWidth = Math.round(button.rect.width * 0.6);
        const underlineX = Math.round(
          button.rect.x + button.rect.width / 2 - underlineWidth / 2
        );

        drawSprite(
          "/solid.png",
          Vector2(underlineX, underlineY),
          Vector2(underlineWidth, 2),
          this.scaleColor({ r: 210, g: 210, b: 210, a: 255 }, opacityMultiplier)
        );
      }
    }
  }

  private ensureQuickControls(): void {
    
    if (!this.quickToggle) {
      const preferRelative = ConfigManager.get().useRelativeCursor ?? true;
      const toggleX = Rhythia.gameWidth - 120; 
      const toggleY = Rhythia.gameHeight - 160; 
      this.quickToggle = new ToggleSwitch({
        x: toggleX,
        y: toggleY,
        initialValue: preferRelative,
        onToggle: (value) => {
          ConfigManager.setUseRelativeCursor(value);
        },
      });
    }

    if (!this.quickSlider) {
      const setting = getGameSettingByKey("mouseSensitivity");
      const config = ConfigManager.get();
      const key = toGameConfigKey("mouseSensitivity");
      const currentValue = (config as any)[key] ?? setting?.defaultValue ?? 1.0;
      const sliderX = Rhythia.gameWidth - 370;
      const sliderY = Rhythia.gameHeight - 85;
      const sliderWidth = 260;
      this.quickSlider = new GameSlider({
        label: "Mouse Sensitivity",
        value: currentValue,
        min: setting?.min ?? 0.1,
        max: setting?.max ?? 5,
        step: setting?.step ?? 0.01,
        x: sliderX,
        y: sliderY,
        width: sliderWidth,
        onChange: (v) => {
          ConfigManager.setGameSettings({ mouseSensitivity: v });
        },
      });
    }

    
  }

  private updateQuickControls(
    mousePos: Vector2 | null,
    disableInteraction: boolean
  ): void {
    this.ensureQuickControls();
    if (this.quickToggle) {
      this.quickToggle.update(disableInteraction ? null : mousePos);
    }
    if (this.quickSlider) {
      this.quickSlider.update(disableInteraction ? null : mousePos);
    }

    
  }

  private drawQuickControls(opacity: number): void {
    this.ensureQuickControls();
    const textColor = { r: 220, g: 220, b: 220, a: Math.round(255 * opacity) };

    if (this.quickToggle) {
      
      const toggleX = Rhythia.gameWidth - 120;
      const toggleY = Rhythia.gameHeight - 160;
      drawText(
        (this.quickToggle.getValue() ? "Relative" : "Absolute") + " Mode",
        Vector2(toggleX - 12, toggleY + 4),
        22,
        textColor,
        "right"
      );
      this.quickToggle.render(opacity);
    }

    if (this.quickSlider) {
      this.quickSlider.render(opacity);
    }

    
  }

  private scaleColor(
    color: { r: number; g: number; b: number; a: number },
    opacity: number
  ): { r: number; g: number; b: number; a: number } {
    const clamped = Math.max(0, Math.min(1, opacity));
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: Math.round(color.a * clamped),
    };
  }

  private isPointInRect(
    point: Vector2,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }
}
