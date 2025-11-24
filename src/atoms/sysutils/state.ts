import type { Scene } from "../Scene";
import type { Camera3D, RenderTexture, Shader } from "raylib";
import { CAMERA_PERSPECTIVE } from "raylib";

import { RenderScaleMode, RenderViewport, DEFAULT_GAME_WIDTH, DEFAULT_GAME_HEIGHT } from "./constants";

export interface RhythiaState {
  currentScene?: Scene;
  sceneStack: Scene[];
  renderTexture?: RenderTexture;
  gameWidth: number;
  gameHeight: number;
  targetMonitor: number;
  renderScale: number;
  renderWidth: number;
  renderHeight: number;
  renderScaleMode: RenderScaleMode;
  maxFps: number;
  debugMode: boolean;
  targetAspectRatio: number;
  isResizing: boolean;
  lastWindowWidth: number;
  lastWindowHeight: number;
  wasFullscreen: boolean;
  presentationViewport: RenderViewport;
  frameTimer: ReturnType<typeof setInterval> | null;
  bloomShader: Shader | null;
  bloomIntensityLocation: number;
  camera: Camera3D;
  isClosing: boolean;
}

export const state: RhythiaState = {
  sceneStack: [],
  gameWidth: DEFAULT_GAME_WIDTH,
  gameHeight: DEFAULT_GAME_HEIGHT,
  targetMonitor: 0,
  renderScale: 1.0,
  renderWidth: 0,
  renderHeight: 0,
  renderScaleMode: "fit",
  maxFps: 1000,
  debugMode: false,
  targetAspectRatio: DEFAULT_GAME_WIDTH / DEFAULT_GAME_HEIGHT,
  isResizing: false,
  lastWindowWidth: 0,
  lastWindowHeight: 0,
  wasFullscreen: false,
  presentationViewport: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  frameTimer: null,
  bloomShader: null,
  bloomIntensityLocation: -1,
  camera: {
    position: { x: 0, y: 0, z: -300 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: -1, z: 0 },
    fovy: 60,
    projection: CAMERA_PERSPECTIVE,
  } as Camera3D,
  isClosing: false,
};
