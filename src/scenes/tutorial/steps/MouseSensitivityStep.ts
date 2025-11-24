import {
  Vector2,
  GetFrameTime,
  IsKeyPressed,
  KEY_LEFT_BRACKET,
  KEY_RIGHT_BRACKET,
} from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";

export class MouseSensitivityStep extends BaseTutorialStep {
  private animTime: number = 0;
  private pressedMinus: boolean = false;
  private pressedPlus: boolean = false;

  constructor() {
    super({
      id: "mouseSensitivity",
      text: "You can tweak sensitivity fast with [ and ]. Press either key now to continue!",
      mascotEmote: "satisfied",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.animTime = 0;
    this.pressedMinus = false;
    this.pressedPlus = false;
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {
    this.animTime += GetFrameTime() * 1.5;

    if (IsKeyPressed(KEY_LEFT_BRACKET)) {
      this.pressedMinus = true;
    }
    if (IsKeyPressed(KEY_RIGHT_BRACKET)) {
      this.pressedPlus = true;
    }

    if (!this.isCompleted() && (this.pressedMinus || this.pressedPlus)) {
      this.markCompleted();
    }
  }

  protected onStepRender(): void {
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2 - 40;

    const keyWidth = 110;
    const keyHeight = 70;
    const keySpacing = 50;
    const keyY = centerY;
    const totalKeyWidth = keyWidth * 2 + keySpacing;
    let keyX = centerX - totalKeyWidth / 2;

    const keys = [
      {
        label: "[",
        caption: "Decrease",
        pressed: this.pressedMinus,
      },
      {
        label: "]",
        caption: "Increase",
        pressed: this.pressedPlus,
      },
    ];

    keys.forEach((key, index) => {
      const pulse = Math.max(0, Math.sin(this.animTime + index * 0.8));
      const baseColor = key.pressed
        ? { r: 80, g: 80, b: 80, a: 230 }
        : {
            r: Math.round(58 + pulse * 10),
            g: Math.round(58 + pulse * 10),
            b: Math.round(64 + pulse * 12),
            a: 220,
          };

      drawSprite(
        "/solid.png",
        Vector2(keyX, keyY),
        Vector2(keyWidth, keyHeight),
        baseColor
      );

      drawText(
        key.label,
        Vector2(keyX + keyWidth / 2, keyY + 12),
        36,
        { r: 235, g: 235, b: 235, a: 255 },
        "center"
      );

      drawText(
        key.caption,
        Vector2(keyX + keyWidth / 2, keyY + keyHeight + 10),
        18,
        { r: 205, g: 205, b: 205, a: 255 },
        "center"
      );

      keyX += keyWidth + keySpacing;

      if (index === 0) {
        const arrowX = keyX - keySpacing + 12;
        drawSprite(
          "/solid.png",
          Vector2(arrowX, keyY + keyHeight / 2 - 6),
          Vector2(keySpacing - 24, 6),
          { r: 120, g: 120, b: 120, a: 170 }
        );
      }
    });
  }

  protected checkCanContinue(): boolean {
    return this.pressedMinus || this.pressedPlus;
  }

  protected onKeyPress(_key: number): boolean {
    return false;
  }

  protected onMouseMove(_x: number, _y: number): void {}
}
