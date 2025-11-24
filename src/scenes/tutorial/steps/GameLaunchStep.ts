import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { SoundSpaceMemoryMap } from "../../../utils/storageUtils.ts/ssmm";
import { GameScene } from "../../game";
import { Rhythia } from "../../../atoms/Rhythia";
import { logger } from "../../../utils/logger";
import { playFx } from "../../../utils/soundManager";

export class GameLaunchStep extends BaseTutorialStep {
  private downloadedMapData: SoundSpaceMemoryMap | null = null;
  private launched: boolean = false;

  constructor() {
    super({
      id: "gameLaunch",
      text: "Get ready! I'm about to launch you into the game to play your selected map. Are you ready for the challenge?",
      mascotEmote: "happy",
      waitForUser: false,
    });
  }

  protected async onStepEnter(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await this.launchGame();
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {}

  protected onStepRender(): void {}

  protected checkCanContinue(): boolean {
    return this.launched;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  public setDownloadedMapData(mapData: SoundSpaceMemoryMap): void {
    this.downloadedMapData = mapData;
  }

  private async launchGame(): Promise<void> {
    logger("Launching game with selected map");

    if (this.downloadedMapData) {
      try {
        playFx("/match-start.wav");
      } catch {}
      const gameScene = new GameScene(this.downloadedMapData);
      Rhythia.goToScene(gameScene, true, true);
      this.launched = true;
      this.markCompleted();
    } else {
      logger("No downloaded map data, skipping game launch");
      this.launched = true;
      this.markCompleted();
    }
  }

  public isCompleted(): boolean {
    return this.launched;
  }

  public canContinue(): boolean {
    return this.launched;
  }
}
