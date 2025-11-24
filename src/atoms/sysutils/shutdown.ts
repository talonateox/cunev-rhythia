import { CloseAudioDevice, CloseWindow } from "raylib";

import { clearTextureCache } from "../../utils/sprite";
import { GameObject } from "../Object";
import { state } from "./state";
import { stopFrameTimer } from "./gameLoop";

export function shutdown(): void {
  if (state.isClosing) {
    return;
  }
  state.isClosing = true;

  stopFrameTimer();

  if (state.currentScene) {
    try {
      state.currentScene.destroy?.();
    } catch {}

    if (state.currentScene.sceneId) {
      GameObject.destroyObjectsByScene(state.currentScene.sceneId);
    } else {
      GameObject.destroyAll();
    }
  }

  try {
    clearTextureCache();
  } catch {}

  state.renderTexture = undefined;

  try {
    CloseAudioDevice();
  } catch {}

  try {
    CloseWindow();
  } catch {}
  process.exit(0);
}
