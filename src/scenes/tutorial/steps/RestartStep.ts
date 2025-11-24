import { IsKeyDown, KEY_GRAVE, KEY_Q } from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { Cooldown } from "../../../atoms/Cooldown";

export class RestartStep extends BaseTutorialStep {
  private restartCooldown: Cooldown | null = null;
  private restartKeyPressed: boolean = false;
  private stepCompleted: boolean = false;

  constructor() {
    super({
      id: "restart",
      text: "Sometimes you might want to restart a map! Hold the ~ (tilde) key or Q to restart the current song.",
      mascotEmote: "satisfied",
      waitForUser: false,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.restartCooldown = new Cooldown(0.66);
    this.stepCompleted = false;
    this.restartKeyPressed = false;
  }

  protected onStepExit(): void {
    this.restartCooldown = null;
    this.restartKeyPressed = false;
    this.stepCompleted = false;
  }

  protected onStepUpdate(): void {
    if (!this.restartCooldown) return;

    this.restartCooldown.update();

    const isRestartKeyHeld = IsKeyDown(KEY_GRAVE) || IsKeyDown(KEY_Q);

    if (isRestartKeyHeld) {
      if (!this.restartKeyPressed) {
        this.restartKeyPressed = true;
        this.restartCooldown.start(() => {
          this.stepCompleted = true;
          this.markCompleted();
        });
      }
    } else {
      if (this.restartKeyPressed) {
        this.restartKeyPressed = false;
        if (this.restartCooldown.isRunning()) {
          this.restartCooldown.stop();
        }
        this.restartCooldown.reset();
      }
    }
  }

  protected onStepRender(): void {
    if (this.restartCooldown && this.restartCooldown.isRunning()) {
      this.restartCooldown.draw();
    }
  }

  protected checkCanContinue(): boolean {
    return this.stepCompleted;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  public isCompleted(): boolean {
    return this.stepCompleted;
  }

  public canContinue(): boolean {
    return this.stepCompleted;
  }
}
