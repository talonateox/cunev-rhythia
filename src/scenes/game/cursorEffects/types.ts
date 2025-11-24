export interface CursorRendererConfig {
  cursorScale: number;
  fadeRate: number;
  trailLength: number;
  trailCreateRate: number;
  mouseBoundRate?: number;
  mouseSensitivity?: number;
  rainbowRate?: number;
  rainbowOffset?: number;
  cursorOpacity?: number;
  cursorRainbowEnabled?: number;
  starTrailEnabled?: number;
  starTrailDensity?: number;
  starTrailLifetime?: number;
  starTrailSize?: number;
  starTrailDisperseDistance?: number;
  starTrailRainbowIntensity?: number;
  starTrailMaxOpacity?: number;
  customCursorEnabled?: number;
  customCursorOpacity?: number;
  customCursorRotationSpeed?: number;
  customCursorTrailEnabled?: number;
  customCursorTexturePath?: string;
  customCursorCurrentAngle?: number;

  spaceCursorEnabled?: number;
  spaceTrailColorHex?: string;
  spaceStarDensity?: number;
  spaceStarLifetime?: number;
  spaceStarSize?: number;
  spaceStarMaxOpacity?: number;
  spaceStarTrailJitter?: number;
  spaceStarMaxCount?: number;
  spaceRainbowRate?: number;
  spaceRainbowOffset?: number;
}
