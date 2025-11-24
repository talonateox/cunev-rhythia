import { IsKeyDown, KEY_R } from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { Cooldown } from "../../../atoms/Cooldown";

export class ExitStep extends BaseTutorialStep {
  private exitCooldown: Cooldown | null = null;
  private rKeyPressed: boolean = false;
  private stepCompleted: boolean = false;

  constructor() {
    super({
      id: "exit",
      text: "Before we dive into maps, let's learn how to exit a song if you need to. Hold the R key to activate the exit cooldown!",
      mascotEmote: "satisfied",
      waitForUser: false,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.exitCooldown = new Cooldown(1);
    this.stepCompleted = false;
    this.rKeyPressed = false;
  }

  protected onStepExit(): void {
    this.exitCooldown = null;
    this.rKeyPressed = false;
    this.stepCompleted = false;
  }

  protected onStepUpdate(): void {
    if (!this.exitCooldown) return;

    this.exitCooldown.update();

    if (IsKeyDown(KEY_R)) {
      if (!this.rKeyPressed) {
        this.rKeyPressed = true;
        this.exitCooldown.start(() => {
          this.stepCompleted = true;
          this.markCompleted();
        });
      }
    } else {
      if (this.rKeyPressed) {
        this.rKeyPressed = false;
        if (this.exitCooldown.isRunning()) {
          this.exitCooldown.stop();
        }
        this.exitCooldown.reset();
      }
    }
  }

  protected onStepRender(): void {
    if (this.exitCooldown && this.exitCooldown.isRunning()) {
      this.exitCooldown.draw();
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
