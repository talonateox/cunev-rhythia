import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { steamClient } from "../../../utils/steam";

export class WelcomeStep extends BaseTutorialStep {
  constructor() {
    const username = steamClient?.localplayer?.getName() || "Player";
    super({
      id: "welcome",
      text: `Hello ${username}! Welcome to Rhythia! I'm here to help you get started!`,
      mascotEmote: "happy",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.markCompleted();
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {}

  protected onStepRender(): void {}

  protected checkCanContinue(): boolean {
    return true;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}
}
