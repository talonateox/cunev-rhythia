export const SETTING_DESCRIPTIONS: Record<string, string> = {
  
  globalOffset:
    "Shift all note timings globally (ms). Negative = earlier, positive = later.",

  
  approachRate:
    "Controls how quickly notes approach the hit window (higher = faster).",
  approachDistance:
    "How far notes travel before reaching the hit target.",
  fadeIn:
    "How early notes fade in, as a percent of approach time.",
  fadeOut:
    "Fade-out behavior after a note is hit (0 = off, 1 = on).",
  noteMaxOpacity:
    "Clamp the maximum opacity of notes (0.0–1.0).",
  pushback:
    "Apply a small recoil/pushback effect on hit (0 = off, 1 = on).",
  squareScale:
    "Base size scaling for notes and targets.",
  tiltAmount:
    "Amount of playfield tilt for 3D perspective.",
  playfieldDistance:
    "Camera distance to the playfield plane.",
  playfieldScale:
    "Scales the playfield size (0.5–5.0). UI stays unscaled; hitboxes do not scale.",
  mouseBoundRate:
    "How tightly the cursor is bounded to the window edges.",
  backgroundTiltRate:
    "Strength of background tilt reacting to cursor movement.",
  borderTargetOpacity:
    "Playfield border opacity while aiming/active.",
  borderStaleOpacity:
    "Playfield border opacity when idle.",

  
  mouseSensitivity:
    "Multiplier for mouse sensitivity inside the game.",
  cursorScale: "Scale of the in-game cursor.",
  cursorOpacity: "Opacity of the in-game cursor.",
  cursorTrailFadeRate:
    "How quickly the default cursor trail fades (higher = faster).",

  
  coverOpacity:
    "Opacity of the background image overlay (uses selected image).",
  screenClearRed: "Background clear color – red channel (0–255).",
  screenClearGreen: "Background clear color – green channel (0–255).",
  screenClearBlue: "Background clear color – blue channel (0–255).",

  
  uiTiltRate: "Strength of UI tilt/parallax.",
  uiOpacity: "Overall opacity of UI elements.",
  uiScale: "Scale multiplier for in-game UI panels.",
  healthBarWidth: "Width of the health bar.",
  healthBarHeight: "Height of the health bar.",
  healthBarOpacity: "Opacity of the health bar.",

  
  cursorRainbowEnabled: "Enable rainbow coloring on the default cursor trail.",
  rainbowRate: "Rate of rainbow hue cycling for the trail.",
  rainbowOffset: "Hue offset applied to the rainbow trail.",

  
  customCursorEnabled: "Enable the custom cursor image.",
  customCursorOpacity: "Opacity multiplier for the custom cursor image.",
  customCursorRotationSpeed: "Rotation speed of the custom cursor image.",
  customCursorTrailEnabled: "Spawn a rotating trail of the custom image.",

  
  starTrailEnabled: "Enable the star trail effect.",
  starTrailDensity: "How many stars spawn along the trail.",
  starTrailSize: "Size of individual trail stars.",
  starTrailLifetime: "How long each star lives before fading.",
  starTrailDisperseDistance:
    "How far stars drift away from the cursor trail.",
  starTrailRainbowIntensity: "How colorful the star trail appears.",
  starTrailMaxOpacity: "Maximum opacity for the star trail.",

  
  spaceCursorEnabled: "Enable the Space Cursor effect.",
  spaceStarDensity: "Stars spawned per second around the trail.",
  spaceStarLifetime: "Lifetime of space cursor stars.",
  spaceStarSize: "Size of space cursor stars.",
  spaceStarMaxOpacity: "Maximum opacity of space stars.",
  spaceRainbowRate: "Rate of rainbow hue cycling for stars.",
  spaceRainbowOffset: "Hue offset applied to space star colors.",

  
  tunnelEnabled: "Enable the tunnel background effect.",
  backgroundOpacity: "Opacity multiplier for the tunnel background.",

  
  raysEnabled: "Enable the background light rays.",
  rayOpacity: "Opacity multiplier for light rays.",
  rayIntensity: "How many rays spawn over time.",
  rayWidth: "Ray beam width.",

  
  gridEnabled: "Enable the scrolling grid background.",
  gridOpacity: "Grid opacity (0–100).",
  gridSpeedMultiplier: "Scroll speed multiplier for the grid.",
  gridUnitsPerSecond: "How many grid units move per second.",
  gridDepth: "Number of grid strips drawn in depth.",
  gridFadeFalloff: "Opacity falloff per grid strip (higher = faster fade).",

  
  chevronEnabled: "Enable the chevron background effect.",
  chevronOpacity: "Opacity of the chevron shapes.",
  chevronWidth: "Stroke width of chevrons.",
  chevronGap: "Gap between left and right chevrons at center.",
  chevronSpeedMultiplier: "Chevron animation speed multiplier.",
  chevronSmallSize: "Size of the small chevrons.",
  chevronLargeSize: "Size of the large chevrons.",

  
  videoEnabled: "Enable the background video.",
  videoOpacity: "Opacity of the background video.",

  
  bongoCatEnabled: "Show Bongo Cat on the HUD.",
  bongoCatOpacity: "Opacity of Bongo Cat.",

  
  burstParticleEnabled: "Enable burst particles on hit.",
  burstParticleIntensity: "Intensity/amount of burst particles on hit.",
  hitParticleOpacity: "Opacity of hit particle effects.",
  missParticleOpacity: "Opacity of miss particle effects.",
};

export function getSettingDescription(key: string): string | undefined {
  return SETTING_DESCRIPTIONS[key];
}
