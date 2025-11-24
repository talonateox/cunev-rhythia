import { ITutorialStep, TutorialStepConfig, MascotEmote } from "../types";

export abstract class BaseTutorialStep implements ITutorialStep {
  public readonly id: string;
  public readonly text: string;
  public readonly mascotEmote: MascotEmote;
  public readonly waitForUser: boolean;

  protected completed: boolean = false;
  protected active: boolean = false;

  constructor(config: TutorialStepConfig) {
    this.id = config.id;
    this.text = config.text;
    this.mascotEmote = config.mascotEmote;
    this.waitForUser = config.waitForUser ?? false;
  }

  public async onEnter(): Promise<void> {
    this.active = true;
    this.completed = false;
    await this.onStepEnter();
  }

  public onExit(): void {
    this.active = false;
    this.onStepExit();
  }

  public update(): void {
    if (!this.active) return;
    this.onStepUpdate();
  }

  public render(): void {
    if (!this.active) return;
    this.onStepRender();
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public canContinue(): boolean {
    if (this.waitForUser) {
      return this.completed;
    }
    return this.checkCanContinue();
  }

  public handleKeyPress(key: number): boolean {
    if (!this.active) return false;
    return this.onKeyPress(key);
  }

  public handleMouseMove(x: number, y: number): void {
    if (!this.active) return;
    this.onMouseMove(x, y);
  }

  protected markCompleted(): void {
    this.completed = true;
  }

  protected abstract onStepEnter(): Promise<void>;
  protected abstract onStepExit(): void;
  protected abstract onStepUpdate(): void;
  protected abstract onStepRender(): void;
  protected abstract checkCanContinue(): boolean;
  protected abstract onKeyPress(key: number): boolean;
  protected abstract onMouseMove(x: number, y: number): void;
}
