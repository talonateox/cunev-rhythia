export type MascotEmote = "happy" | "satisfied" | "sleepy" | "celebrate";

export interface ITutorialStep {
  readonly id: string;
  readonly text: string;
  readonly mascotEmote: MascotEmote;
  readonly waitForUser: boolean;

  onEnter(): Promise<void>;
  onExit(): void;
  update(): void;
  render(): void;

  isCompleted(): boolean;
  canContinue(): boolean;

  handleKeyPress(key: number): boolean;
  handleMouseMove(x: number, y: number): void;
}

export interface TutorialStepConfig {
  id: string;
  text: string;
  mascotEmote: MascotEmote;
  waitForUser?: boolean;
}
