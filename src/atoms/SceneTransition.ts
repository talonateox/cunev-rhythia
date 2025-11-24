import { BLACK, GetTime, DrawRectangle } from "raylib";
import { Rhythia } from "./Rhythia";
import { GameObject } from "./Object";
import { getPresentationInfo } from "./sysutils/rendering";

type TransitionPhase =
  | "fadeIn"
  | "preHold"
  | "switching"
  | "postHold"
  | "fadeOut"
  | "complete";

export class SceneTransition {
  private static isTransitioning = false;
  private static fadeInDuration = 0.35;
  private static preSwitchHoldDuration = 0.1;
  private static postSwitchHoldDuration = 0.1;
  private static fadeOutDuration = 0.35;
  private static pendingScene: any = null;
  private static pauseCurrentScene: boolean = false;
  private static isResuming: boolean = false;
  private static currentPhase: TransitionPhase = "complete";
  private static phaseStartTime = 0;
  private static sceneSwitchPromise: Promise<void> | null = null;
  private static overlayObject: GameObject | null = null;
  private static overlayAlpha = 0;

  static async startTransition(
    targetScene: any,
    pauseCurrent: boolean = false,
    isResuming: boolean = false,
  ): Promise<void> {
    if (this.isTransitioning) return;

    this.ensureOverlayObject();

    this.isTransitioning = true;
    this.pendingScene = targetScene;
    this.pauseCurrentScene = pauseCurrent;
    this.isResuming = isResuming;
    this.currentPhase = "fadeIn";
    this.phaseStartTime = GetTime();
    this.sceneSwitchPromise = null;
    this.overlayAlpha = 0;
    this.updateOverlayAlpha();
  }

  private static updateOverlayAlpha(): void {
    if (!this.isTransitioning) {
      this.overlayAlpha = 0;
      return;
    }

    const currentTime = GetTime();
    let alpha = 0;

    switch (this.currentPhase) {
      case "fadeIn": {
        const progress = this.getClampedProgress(
          currentTime - this.phaseStartTime,
          this.fadeInDuration,
        );
        alpha = progress;

        if (progress >= 1) {
          this.advancePhase("preHold");
          alpha = 1;
        }
        break;
      }
      case "preHold": {
        alpha = 1;
        const holdElapsed = currentTime - this.phaseStartTime;
        if (holdElapsed >= this.preSwitchHoldDuration) {
          this.advancePhase("switching");
        }
        break;
      }
      case "switching": {
        alpha = 1;
        break;
      }
      case "postHold": {
        alpha = 1;
        const holdElapsed = currentTime - this.phaseStartTime;
        if (holdElapsed >= this.postSwitchHoldDuration) {
          this.advancePhase("fadeOut");
        }
        break;
      }
      case "fadeOut": {
        const progress = this.getClampedProgress(
          currentTime - this.phaseStartTime,
          this.fadeOutDuration,
        );
        alpha = 1 - progress;

        if (progress >= 1) {
          this.completeTransition();
        }
        break;
      }
      case "complete":
      default:
        alpha = 0;
    }

    this.overlayAlpha = Math.max(0, Math.min(1, alpha));
  }

  private static drawOverlay(): void {
    if (!this.isTransitioning && this.overlayAlpha <= 0) {
      return;
    }

    let displayW = Rhythia.gameWidth;
    let displayH = Rhythia.gameHeight;
    let viewportX = 0;
    let viewportY = 0;
    let viewportW = Rhythia.gameWidth;
    let viewportH = Rhythia.gameHeight;
    try {
      const info = getPresentationInfo();
      displayW = Math.max(1, Math.round(info.displayWidth));
      displayH = Math.max(1, Math.round(info.displayHeight));
      viewportX = Math.round(info.viewport.x);
      viewportY = Math.round(info.viewport.y);
      viewportW = Math.max(1, Math.round(info.viewport.width));
      viewportH = Math.max(1, Math.round(info.viewport.height));
    } catch {}

    const scaleX = viewportW / Math.max(1, Rhythia.gameWidth);
    const scaleY = viewportH / Math.max(1, Rhythia.gameHeight);
    const worldLeftX = -viewportX / Math.max(0.0001, scaleX);
    const worldTopY = -viewportY / Math.max(0.0001, scaleY);
    const worldWidth = displayW / Math.max(0.0001, scaleX);
    const worldHeight = displayH / Math.max(0.0001, scaleY);

    DrawRectangle(
      Math.floor(worldLeftX),
      Math.floor(worldTopY),
      Math.ceil(worldWidth),
      Math.ceil(worldHeight),
      {
        ...BLACK,
        a: Math.floor(this.overlayAlpha * 255),
      },
    );
  }

  private static advancePhase(nextPhase: TransitionPhase): void {
    this.currentPhase = nextPhase;
    this.phaseStartTime = GetTime();

    if (nextPhase === "switching" && !this.sceneSwitchPromise) {
      this.sceneSwitchPromise = this.switchScene().finally(() => {
        this.sceneSwitchPromise = null;
        if (this.currentPhase === "switching") {
          this.advancePhase("postHold");
        }
      });
    }
  }

  private static getClampedProgress(elapsed: number, duration: number): number {
    if (duration <= 0) {
      return 1;
    }
    if (elapsed <= 0) {
      return 0;
    }
    return Math.min(1, elapsed / duration);
  }

  private static async switchScene(): Promise<void> {
    if (this.pendingScene) {
      if (this.isResuming) {
        if (Rhythia.currentScene && Rhythia.currentScene.destroy) {
          Rhythia.currentScene.destroy();
        }

        if (Rhythia.currentScene!.sceneId) {
          GameObject.destroyObjectsByScene(Rhythia.currentScene!.sceneId);
        } else {
          GameObject.destroyAll();
        }

        this.pendingScene.isPaused = false;
        GameObject.resumeScene(this.pendingScene.sceneId);
        Rhythia.currentScene = this.pendingScene;
        if (this.pendingScene.resume) {
          await this.pendingScene.resume();
        }
      } else {
        if (Rhythia.currentScene) {
          if (this.pauseCurrentScene) {
            GameObject.pauseScene(Rhythia.currentScene.sceneId);
            Rhythia.currentScene.isPaused = true;
            if (Rhythia.currentScene.pause) {
              Rhythia.currentScene.pause();
            }

            Rhythia.sceneStack.push(Rhythia.currentScene);
          } else {
            if (Rhythia.currentScene.destroy) {
              Rhythia.currentScene.destroy();
            }
            if (Rhythia.currentScene.sceneId) {
              GameObject.destroyObjectsByScene(Rhythia.currentScene.sceneId);
            } else {
              GameObject.destroyAll();
            }
          }
        }

        Rhythia.currentScene = this.pendingScene;
        await this.pendingScene.init();
      }

      this.pendingScene = null;
    }

    this.ensureOverlayObject();
  }

  private static completeTransition(): void {
    this.isTransitioning = false;
    this.currentPhase = "complete";
    this.sceneSwitchPromise = null;
    this.overlayAlpha = 0;

    this.cleanupOverlayObject();
  }

  static get isActive(): boolean {
    return this.isTransitioning;
  }

  static get progress(): number {
    if (!this.isTransitioning) return 0;
    const now = GetTime();
    const totalDuration =
      this.fadeInDuration +
      this.preSwitchHoldDuration +
      this.postSwitchHoldDuration +
      this.fadeOutDuration;

    const timeInPhase = now - this.phaseStartTime;

    const completedBeforePhase = (phase: TransitionPhase): number => {
      switch (phase) {
        case "fadeIn":
          return 0;
        case "preHold":
        case "switching":
          return this.fadeInDuration;
        case "postHold":
          return this.fadeInDuration + this.preSwitchHoldDuration;
        case "fadeOut":
          return (
            this.fadeInDuration +
            this.preSwitchHoldDuration +
            this.postSwitchHoldDuration
          );
        default:
          return totalDuration;
      }
    };

    const clamp = (value: number) => Math.max(0, Math.min(1, value));

    switch (this.currentPhase) {
      case "fadeIn": {
        const phaseProgress = clamp(timeInPhase / this.fadeInDuration);
        return clamp(
          (completedBeforePhase("fadeIn") +
            phaseProgress * this.fadeInDuration) /
            totalDuration,
        );
      }
      case "preHold": {
        return clamp(
          (completedBeforePhase("preHold") +
            Math.min(timeInPhase, this.preSwitchHoldDuration)) /
            totalDuration,
        );
      }
      case "switching": {
        return clamp(
          (this.fadeInDuration + this.preSwitchHoldDuration) / totalDuration,
        );
      }
      case "postHold": {
        return clamp(
          (completedBeforePhase("postHold") +
            Math.min(timeInPhase, this.postSwitchHoldDuration)) /
            totalDuration,
        );
      }
      case "fadeOut": {
        const phaseProgress = clamp(timeInPhase / this.fadeOutDuration);
        return clamp(
          (completedBeforePhase("fadeOut") +
            phaseProgress * this.fadeOutDuration) /
            totalDuration,
        );
      }
      case "complete":
      default:
        return 1;
    }
  }

  private static ensureOverlayObject(): void {
    if (this.overlayObject && GameObject.getById(this.overlayObject.id)) {
      this.overlayObject.zBase = 1000;
      return;
    }

    const overlay = new GameObject({
      zBase: 1000,
      sceneOwner: "__transition__",
      onUpdate: () => {
        this.updateOverlayAlpha();
      },
      onDraw: () => {
        this.drawOverlay();
      },
    });

    this.overlayObject = overlay;
  }

  private static cleanupOverlayObject(): void {
    if (!this.overlayObject) {
      return;
    }

    const overlay = this.overlayObject;
    this.overlayObject = null;
    overlay.destroy();
  }
}
