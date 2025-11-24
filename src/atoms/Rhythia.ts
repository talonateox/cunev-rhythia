import type { Camera3D, RenderTexture } from "raylib";

import type { Scene } from "./Scene";
import type { RenderScaleMode } from "./sysutils/constants";
import { state } from "./sysutils/state";
import { gameInit, gameRender } from "./sysutils/gameLoop";
import { RhythiaScenes } from "./sysutils/scenes";
import { shutdown as runtimeShutdown } from "./sysutils/shutdown";

export class Rhythia {
  static get state() {
    return state;
  }
  static get gameWidth(): number {
    return state.gameWidth;
  }

  static set gameWidth(value: number) {
    state.gameWidth = value;
  }

  static get gameHeight(): number {
    return state.gameHeight;
  }

  static set gameHeight(value: number) {
    state.gameHeight = value;
  }

  static get renderScale(): number {
    return state.renderScale;
  }

  static set renderScale(value: number) {
    state.renderScale = value;
  }

  static get renderScaleMode(): RenderScaleMode {
    return state.renderScaleMode;
  }

  static set renderScaleMode(mode: RenderScaleMode) {
    state.renderScaleMode = mode;
  }

  static get renderWidth(): number {
    return state.renderWidth;
  }

  static set renderWidth(value: number) {
    state.renderWidth = value;
  }

  static get renderHeight(): number {
    return state.renderHeight;
  }

  static set renderHeight(value: number) {
    state.renderHeight = value;
  }

  static get renderTexture(): RenderTexture | undefined {
    return state.renderTexture;
  }

  static set renderTexture(texture: RenderTexture | undefined) {
    state.renderTexture = texture;
  }

  static get camera(): Camera3D {
    return state.camera;
  }

  static set camera(value: Camera3D) {
    state.camera = value;
  }

  static get currentScene(): Scene | undefined {
    return state.currentScene;
  }

  static set currentScene(scene: Scene | undefined) {
    state.currentScene = scene;
  }

  static get sceneStack(): Scene[] {
    return state.sceneStack;
  }

  static get isClosing(): boolean {
    return state.isClosing;
  }

  static set isClosing(value: boolean) {
    state.isClosing = value;
  }

  static get maxFps(): number {
    return state.maxFps;
  }

  static set maxFps(value: number) {
    state.maxFps = value;
  }

  static get targetMonitor(): number {
    return state.targetMonitor;
  }

  static set targetMonitor(value: number) {
    state.targetMonitor = value;
  }

  static goToScene(
    scene: Scene,
    withTransition = true,
    pauseCurrent = false
  ): Promise<void> {
    return RhythiaScenes.goToScene(scene, withTransition, pauseCurrent);
  }

  static goToPreviousScene(withTransition = true): Promise<void> {
    return RhythiaScenes.goToPreviousScene(withTransition);
  }

  static gameInit(): void {
    gameInit();
  }

  static gameRender(): void {
    gameRender();
  }

  static shutdown(): void {
    runtimeShutdown();
  }
}
