import { Vector2, GetMasterVolume } from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { VolumeKnob } from "../../menu/atoms/VolumeKnob";
import { Rhythia } from "../../../atoms/Rhythia";

export class VolumeStep extends BaseTutorialStep {
  private volumeKnobs: VolumeKnob[] = [];
  private initialVolume: number = 0;

  constructor() {
    super({
      id: "volume",
      text: "First, let's adjust the volume to your preference. Hold ALT and scroll your mouse wheel to change the volume!",
      mascotEmote: "satisfied",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    const rightX = Rhythia.gameWidth - 150;
    const startY = 150;
    const spacing = 120;

    this.volumeKnobs = [
      new VolumeKnob(Vector2(rightX, startY), "master", "small", "right"),
      new VolumeKnob(
        Vector2(rightX, startY + spacing),
        "music",
        "small",
        "right"
      ),
      new VolumeKnob(
        Vector2(rightX, startY + spacing * 2),
        "fx",
        "small",
        "right"
      ),
    ];

    this.initialVolume = GetMasterVolume();
    this.markCompleted();
  }

  protected onStepExit(): void {
    this.volumeKnobs.forEach((knob) => knob.destroy());
    this.volumeKnobs = [];
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
}
