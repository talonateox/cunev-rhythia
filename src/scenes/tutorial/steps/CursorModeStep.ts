import { Vector2, GetFrameTime, IsKeyPressed, KEY_L } from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";

export class CursorModeStep extends BaseTutorialStep {
  private pulse: number = 0;
  private modeToggle: number = 0;
  private isPressed: boolean = false;

  constructor() {
    super({
      id: "cursorMode",
      text: "Press L to toggle between Absolute (centered) and Relative (follows mouse) cursor modes. Give it a try now to continue!",
      mascotEmote: "happy",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.pulse = 0;
    this.modeToggle = 0;
    this.isPressed = false;
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {
    const dt = GetFrameTime();
    this.pulse += dt * 2.5;
    this.modeToggle += dt * 1.3;

    if (!this.isPressed && IsKeyPressed(KEY_L)) {
      this.isPressed = true;
      this.markCompleted();
    }
  }

  protected onStepRender(): void {
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2 - 20;

    const keyWidth = 140;
    const keyHeight = 80;
    const pulseStrength = this.isPressed ? 1 : (Math.sin(this.pulse) + 1) * 0.5;
    const baseColor = this.isPressed
      ? { r: 78, g: 78, b: 78, a: 230 }
      : {
          r: Math.round(55 + pulseStrength * 12),
          g: Math.round(55 + pulseStrength * 12),
          b: Math.round(60 + pulseStrength * 14),
          a: 220,
        };

    drawSprite(
      "/solid.png",
      Vector2(centerX - keyWidth / 2, centerY - keyHeight / 2),
      Vector2(keyWidth, keyHeight),
      baseColor
    );

    drawText(
      "L",
      Vector2(centerX, centerY - 18),
      48,
      { r: 235, g: 235, b: 235, a: 255 },
      "center"
    );

    drawText(
      this.isPressed ? "Got it!" : "Toggle Mode",
      Vector2(centerX, centerY + 16),
      22,
      { r: 210, g: 210, b: 210, a: 255 },
      "center"
    );
  }

  protected checkCanContinue(): boolean {
    return this.isPressed;
  }

  protected onKeyPress(_key: number): boolean {
    return false;
  }

  protected onMouseMove(_x: number, _y: number): void {}
}
