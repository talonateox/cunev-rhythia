import { Scene } from "../../atoms/Scene";
import { GameObject } from "../../atoms/Object";
import { TutorialManager } from "./TutorialManager";
import { ConfigManager } from "../../utils/configManager";
import { MenuScene } from "../menu";
import { Rhythia } from "../../atoms/Rhythia";

export class TutorialScene extends Scene {
  public sceneName: string = "Tutorial";
  private tutorialManager: TutorialManager;
  private startTime: number = 0;
  private hasStarted: boolean = false;

  constructor() {
    super();
    this.tutorialManager = new TutorialManager(() => this.completeTutorial());
  }

  public async init(): Promise<void> {
    this.startTime = Date.now();
    this.hasStarted = false;
  }

  public render(): void {
    if (!this.hasStarted && Date.now() - this.startTime >= 1500) {
      this.hasStarted = true;

      this.tutorialManager.start().catch(console.error);
    }

    if (this.hasStarted) {
      this.tutorialManager.update();

      this.tutorialManager.render();
    }

    GameObject.updateAll();
    GameObject.drawAll();
  }

  public handleKeyPress(key: number): boolean {
    if (this.hasStarted) {
      return this.tutorialManager.handleKeyPress(key);
    }
    return false;
  }

  public handleMouseMove(x: number, y: number): void {
    if (this.hasStarted) {
      this.tutorialManager.handleMouseMove(x, y);
    }
  }

  private completeTutorial(): void {
    ConfigManager.setTutorialCompleted();

    Rhythia.goToScene(new MenuScene());
  }

  public resume(): void {
    if (this.hasStarted) {
      this.tutorialManager.showGameCompletionMessage();
    }
  }
}
