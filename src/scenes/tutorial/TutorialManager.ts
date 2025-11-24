import { IsKeyPressed, KEY_SPACE, IsMouseButtonPressed, MOUSE_BUTTON_LEFT } from "raylib";
import { ITutorialStep } from "./types";
import { TutorialDialog } from "./components/TutorialDialog";
import { WelcomeStep } from "./steps/WelcomeStep";
import { PCSpecsStep } from "./steps/PCSpecsStep";
import { DiscordLoginStep } from "./steps/DiscordLoginStep";
import { VolumeStep } from "./steps/VolumeStep";
import { ExitStep } from "./steps/ExitStep";
import { RestartStep } from "./steps/RestartStep";
import { GameFieldStep } from "./steps/GameFieldStep";
import { MapSelectionStep } from "./steps/MapSelectionStep";
import { DownloadStep } from "./steps/DownloadStep";
import { GameLaunchStep } from "./steps/GameLaunchStep";
import { CompletionStep } from "./steps/CompletionStep";
import { CursorModeStep } from "./steps/CursorModeStep";
import { MouseSensitivityStep } from "./steps/MouseSensitivityStep";
import { TopBarOverviewStep } from "./steps/TopBarOverviewStep";
import { ModOverviewStep } from "./steps/ModOverviewStep";
import { logger } from "../../utils/logger";

export class TutorialManager {
  private steps: ITutorialStep[] = [];
  private currentStepIndex: number = 0;
  private dialog: TutorialDialog;
  private isVisible: boolean = false;
  private onComplete: () => void;
  private stepEnterAtMs: number = 0;
  private readonly skipCooldownMs: number = 2000; 

  constructor(onComplete: () => void) {
    this.onComplete = onComplete;
    this.dialog = new TutorialDialog();
    this.initializeSteps();
  }

  private initializeSteps(): void {
    this.steps = [
      new WelcomeStep(),
      new VolumeStep(),
      new DiscordLoginStep(),
      new PCSpecsStep(),
      new ExitStep(),
      new RestartStep(),
      new MapSelectionStep(),
      new GameFieldStep(),
      new CompletionStep(),
    ];
  }

  public async start(): Promise<void> {
    this.isVisible = true;
    this.currentStepIndex = 0;

    await this.dialog.show();
    await this.startCurrentStep();
  }

  private async startCurrentStep(): Promise<void> {
    if (this.currentStepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.getCurrentStep()!;
    const hidePromptForIds = new Set(["exit", "restart", "mapSelection"]);
    const showPrompt = !hidePromptForIds.has(step.id);
    this.dialog.updateContent(step.text, step.mascotEmote, showPrompt);

    this.passDataBetweenSteps();

    try {
      await step.onEnter();
      this.stepEnterAtMs = Date.now();
      logger(`Started tutorial step: ${step.id}`);
    } catch (error) {
      logger(`Error starting step ${step.id}:`, error);
    }
  }

  private passDataBetweenSteps(): void {
    const currentStep = this.getCurrentStep();

    if (currentStep?.id === "gameField") {
      const mapSelectionStep = this.steps.find(
        (s) => s.id === "mapSelection"
      ) as any;
      const gameFieldStep = currentStep as any;

      if (mapSelectionStep && gameFieldStep && gameFieldStep.setSelectedMap) {
        const selectedMap = mapSelectionStep.getSelectedMap();
        gameFieldStep.setSelectedMap(selectedMap);

        const mapButtonInstances = mapSelectionStep.getMapButtonInstances();
        if (mapButtonInstances) {
          mapButtonInstances.forEach((button: any) => button.destroy());
          mapSelectionStep.clearMapButtons();
        }
      }
    }

    if (currentStep?.id === "download") {
      const mapSelectionStep = this.steps.find(
        (s) => s.id === "mapSelection"
      ) as any;
      const downloadStep = currentStep as any;

      if (mapSelectionStep && downloadStep && downloadStep.setSelectedMap) {
        const selectedMap = mapSelectionStep.getSelectedMap();
        downloadStep.setSelectedMap(selectedMap);
      }
    }

    if (currentStep?.id === "gameLaunch") {
      const downloadStep = this.steps.find((s) => s.id === "download") as any;
      const gameLaunchStep = currentStep as any;

      if (
        downloadStep &&
        gameLaunchStep &&
        gameLaunchStep.setDownloadedMapData
      ) {
        const mapData = downloadStep.getDownloadedMapData();
        if (mapData) {
          gameLaunchStep.setDownloadedMapData(mapData);
        }
      }
    }

    if (currentStep?.id === "completion") {
      const mapSelectionStep = this.steps.find(
        (s) => s.id === "mapSelection"
      ) as any;
      const completionStep = currentStep as any;

      if (
        mapSelectionStep &&
        completionStep &&
        completionStep.setMapButtonInstances
      ) {
        const mapButtonInstances = mapSelectionStep.getMapButtonInstances();

        if (mapButtonInstances && mapButtonInstances.length > 0) {
          completionStep.setMapButtonInstances(mapButtonInstances);
        }
      }
    }
  }

  public update(): void {
    if (!this.isVisible) return;

    const step = this.getCurrentStep();
    if (!step) return;

    step.update();

    if (step.isCompleted() && step.canContinue()) {
      const readyToSkip = Date.now() - this.stepEnterAtMs >= this.skipCooldownMs;
      const userRequestedAdvance =
        IsKeyPressed(KEY_SPACE) || IsMouseButtonPressed(MOUSE_BUTTON_LEFT);

      if (!step.waitForUser || (readyToSkip && userRequestedAdvance)) {
        this.nextStep();
      }
    }
  }

  public render(): void {
    if (!this.isVisible) return;

    const step = this.getCurrentStep();
    if (step) {
      step.render();
    }

    this.dialog.render();
  }

  private async nextStep(): Promise<void> {
    const currentStep = this.getCurrentStep();
    if (currentStep) {
      currentStep.onExit();
    }

    this.currentStepIndex++;
    await this.startCurrentStep();
  }

  private getCurrentStep(): ITutorialStep | null {
    return this.steps[this.currentStepIndex] || null;
  }

  public handleKeyPress(key: number): boolean {
    if (!this.isVisible) return false;

    const step = this.getCurrentStep();
    return step?.handleKeyPress(key) || false;
  }

  public handleMouseMove(x: number, y: number): void {
    if (!this.isVisible) return;

    const step = this.getCurrentStep();
    step?.handleMouseMove(x, y);
  }

  public showGameCompletionMessage(): void {
    this.currentStepIndex = this.steps.length - 1;
    this.startCurrentStep();
  }

  private complete(): void {
    this.isVisible = false;
    this.dialog.hide(() => {
      this.dialog.destroy();
      this.onComplete();
    });
  }
}
