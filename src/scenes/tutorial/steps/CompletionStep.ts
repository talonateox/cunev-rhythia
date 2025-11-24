import { BaseTutorialStep } from "../components/BaseTutorialStep";

export class CompletionStep extends BaseTutorialStep {
  private mapButtonInstances: any[] = [];

  constructor() {
    super({
      id: "completion",
      text: "Congratulations on completing the tutorial, you can now jump into the game!",
      mascotEmote: "celebrate",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.cleanupMapButtons();

    this.markCompleted();
  }

  protected onStepExit(): void {
    this.cleanupMapButtons();
  }

  protected onStepUpdate(): void {}

  protected onStepRender(): void {}

  protected checkCanContinue(): boolean {
    return true;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  public setMapButtonInstances(instances: any[]): void {
    this.mapButtonInstances = instances;
  }

  private cleanupMapButtons(): void {
    this.mapButtonInstances.forEach((button) => button.destroy());
    this.mapButtonInstances = [];
  }
}
