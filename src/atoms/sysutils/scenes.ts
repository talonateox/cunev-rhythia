import { GameObject } from "../Object";
import type { Scene } from "../Scene";
import { clearTextureCache } from "../../utils/sprite";
import { logger } from "../../utils/logger";
import { state } from "./state";
import { SceneTransition } from "../SceneTransition";
import { toastManager } from "../../utils/toastManager";
import { DEV_MODE } from "./constants";
import { IntroScene } from "../../scenes/intro";
import {
  stopMusic,
  clearCache as clearAudioCache,
} from "../../utils/soundManager";
import { resetTweens } from "../../utils/tween";
import { ModeManager } from "../../scenes/game/modes";

async function performTransition(
  scene: Scene,
  pauseCurrent: boolean,
  resumePrevious: boolean = false
) {
  if (resumePrevious) {
    await SceneTransition.startTransition(scene, false, true);
  } else {
    await SceneTransition.startTransition(scene, pauseCurrent);
  }
}

async function destroyCurrentScene(keepForResume: boolean): Promise<void> {
  if (!state.currentScene) return;

  if (keepForResume) {
    state.sceneStack.push(state.currentScene);
  } else {
    if (state.currentScene.destroy) {
      state.currentScene.destroy();
    }
    if (state.currentScene.sceneId) {
      GameObject.destroyObjectsByScene(state.currentScene.sceneId);
    } else {
      GameObject.destroyAll();
    }
    try {
      clearTextureCache();
    } catch {}
  }
}

export const RhythiaScenes = {
  async goToScene(
    scene: Scene,
    withTransition: boolean = true,
    pauseCurrent: boolean = false
  ): Promise<void> {
    
    try {
      const name = scene.sceneName;
      const restricted = name === "Game";
      if (DEV_MODE && restricted) {
        toastManager.show(`${name} is unavailable in dev mode`);
        logger(`Blocked scene '${name}' due to dev mode`);
        return;
      }
    } catch {}

    const fromScene = state.currentScene?.sceneName || "None";
    const toScene = scene.sceneName;
    const action = pauseCurrent ? "pause" : "replace";

    logger(
      `🚀 Scene transition: ${fromScene} -> ${toScene} (${action}, ${
        withTransition ? "animated" : "instant"
      })`
    );

    if (withTransition) {
      await performTransition(scene, pauseCurrent);
      return;
    }

    if (pauseCurrent && state.currentScene) {
      GameObject.pauseScene(state.currentScene.sceneId);
      state.currentScene.isPaused = true;
      state.currentScene.pause?.();
    }

    if (state.currentScene) {
      await destroyCurrentScene(pauseCurrent);
    }

    state.currentScene = scene;
    await scene.init();
  },

  async goToPreviousScene(withTransition: boolean = true): Promise<void> {
    if (SceneTransition.isActive) {
      return;
    }
    if (state.sceneStack.length === 0) {
      console.warn("⚠️  No previous scene to return to");
      return;
    }

    const previousScene = state.sceneStack.pop()!;
    const currentSceneName = state.currentScene?.sceneName || "None";

    logger(
      `🔙 Returning: ${currentSceneName} -> ${previousScene.sceneName} (${
        withTransition ? "animated" : "instant"
      })`
    );

    if (withTransition) {
      await performTransition(previousScene, false, true);
      return;
    }

    if (state.currentScene) {
      if (state.currentScene.destroy) {
        state.currentScene.destroy();
      }
      if (state.currentScene.sceneId) {
        GameObject.destroyObjectsByScene(state.currentScene.sceneId);
      } else {
        GameObject.destroyAll();
      }
      try {
        clearTextureCache();
      } catch {}
    }

    previousScene.isPaused = false;
    GameObject.resumeScene(previousScene.sceneId);
    state.currentScene = previousScene;
    if (previousScene.resume) {
      await previousScene.resume();
    }
  },
};

export async function restartAppInPlace(): Promise<void> {
  try {
    logger("↻ Restart requested: flushing runtime state (keeping window)");
  } catch {}

  try {
    stopMusic();
  } catch {}
  try {
    clearAudioCache();
  } catch {}

  try {
    if (state.currentScene) {
      try {
        state.currentScene.destroy?.();
      } catch {}
      if (state.currentScene.sceneId) {
        GameObject.destroyObjectsByScene(state.currentScene.sceneId);
      } else {
        GameObject.destroyAll();
      }
    } else {
      GameObject.destroyAll();
    }
  } catch {}

  try {
    clearTextureCache();
  } catch {}
  try {
    resetTweens();
  } catch {}

  try {
    toastManager.clear();
  } catch {}

  try {
    state.sceneStack = [];
    state.debugMode = false;
  } catch {}

  try {
    ModeManager.setActiveModesByIds([]);
  } catch {}

  try {
    delete (global as any).preloadedDownloadedMaps;
  } catch {}
  try {
    delete (global as any).currentMenuScene;
  } catch {}

  try {
    await RhythiaScenes.goToScene(new IntroScene(), false);
  } catch (err) {
    try {
      logger(`Restart failed to boot Intro: ${(err as Error).message}`);
    } catch {}
  }
}
