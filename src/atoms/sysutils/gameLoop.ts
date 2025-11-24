import {
  BeginDrawing,
  BLACK,
  ClearBackground,
  EndDrawing,
  GetFPS,
  RED,
  Vector2,
  WindowShouldClose,
  IsWindowFullscreen,
  GetFrameTime,
} from "raylib";

import { ConfigManager } from "../../utils/configManager";
import { updateAudio } from "../../utils/soundManager";
import { drawText, resetTextCount, textCount } from "../../utils/text";
import { resetSpriteCount, spriteCount } from "../../utils/sprite";
import { updateTweens } from "../../utils/tween";
import { state } from "./state";
import {
  handleWindowEvents,
  setupRenderTargets,
  updateRenderTexture,
  renderOnScreen,
} from "./rendering";
import {
  configureRenderingAssets,
  handleGlobalHotkeys,
  initializeWindow,
} from "./window";
import { IntroScene } from "../../scenes/intro";
import { RhythiaScenes } from "./scenes";
import type { Scene } from "../Scene";
import { GameObject } from "../Object";
import { shutdown } from "./shutdown";
import { toastManager } from "../../utils/toastManager";
import { setImmediate } from "timers/promises";
function logInitialWindow(): void {
  console.log(
    `Initial window: ${state.lastWindowWidth}x${state.lastWindowHeight}, Scale: ${state.renderScale}`
  );
}

export function gameDrawFunction(): void {
  if (state.currentScene) {
    state.currentScene.render();
  }

  if (state.currentScene?.sceneName !== "Game") {
    try {
      const dt = GetFrameTime();
      toastManager.update(dt);
      toastManager.draw();
    } catch {}
  }

  updateTweens();
  updateAudio();

  if (state.debugMode) {
    drawText(
      `${state.currentScene?.sceneName || "?"} | R:${spriteCount} A:${
        GameObject.objects.length
      } T:${textCount} | ${GetFPS()}fps | ${state.gameWidth}x${
        state.gameHeight
      }@${state.renderScale.toFixed(2)} (${state.renderWidth}x${
        state.renderHeight
      })`,
      Vector2(10, state.gameHeight - 30),
      20,
      RED
    );
  }

  resetTextCount();
  resetSpriteCount();
}

export async function gameRender() {
  if (state.isClosing) {
    return;
  }

  if (WindowShouldClose()) {
    shutdown();
    return;
  }

  const wasFullscreen = IsWindowFullscreen();
  handleWindowEvents();
  handleGlobalHotkeys(wasFullscreen);
  BeginDrawing();
  ClearBackground(BLACK);

  renderOnScreen(gameDrawFunction);

  EndDrawing();
}

export async function gameInit() {
  const config = ConfigManager.get();
  const configScaleMode = (config as any).renderViewportMode;
  if (
    configScaleMode === "fit" ||
    configScaleMode === "cover" ||
    configScaleMode === "stretch"
  ) {
    state.renderScaleMode = configScaleMode;
  }

  initializeWindow(config);
  configureRenderingAssets();
  setupRenderTargets();

  logInitialWindow();

  RhythiaScenes.goToScene(new IntroScene(), false);

  if (state.frameTimer) {
    clearInterval(state.frameTimer);
  }

  while (true) {
    gameRender();
    await setImmediate();
  }
}

export function stopFrameTimer(): void {
  if (state.frameTimer) {
    clearInterval(state.frameTimer);
    state.frameTimer = null;
  }
}

export function refreshRenderTargets(): void {
  updateRenderTexture();
}

export function setScene(scene: Scene | undefined): void {
  state.currentScene = scene;
}
