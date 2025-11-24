import {
  BeginMode3D,
  BLACK,
  ClearBackground,
  EndMode3D,
  GetScreenToWorldRayEx,
  IsWindowFullscreen,
  Vector2,
  rlDisableDepthTest,
  rlPopMatrix,
  rlPushMatrix,
  rlScalef,
  rlTranslatef,
} from "raylib";

import {
  MAX_RENDER_SCALE,
  MIN_RENDER_SCALE,
  RenderViewport,
  TextureSlice,
} from "./constants";
import { state } from "./state";
import { getDisplaySize } from "./window";

export function computePresentationViewport(
  screenWidth: number,
  screenHeight: number,
  renderWidth: number,
  renderHeight: number
): RenderViewport {
  const safeWidth = Math.max(1, screenWidth);
  const safeHeight = Math.max(1, screenHeight);
  const safeRenderWidth = Math.max(1, renderWidth);
  const safeRenderHeight = Math.max(1, renderHeight);

  const scaleX = safeWidth / safeRenderWidth;
  const scaleY = safeHeight / safeRenderHeight;

  if (state.renderScaleMode === "fit") {
    const scale = Math.min(scaleX, scaleY);
    const width = safeRenderWidth * scale;
    const height = safeRenderHeight * scale;
    return {
      x: (safeWidth - width) / 2,
      y: (safeHeight - height) / 2,
      width,
      height,
    };
  }

  return {
    x: 0,
    y: 0,
    width: safeWidth,
    height: safeHeight,
  };
}

export function computeTextureSlice(
  screenWidth: number,
  screenHeight: number,
  renderWidth: number,
  renderHeight: number
): TextureSlice {
  const safeWidth = Math.max(1, screenWidth);
  const safeHeight = Math.max(1, screenHeight);
  const safeRenderWidth = Math.max(1, renderWidth);
  const safeRenderHeight = Math.max(1, renderHeight);

  const scaleX = safeWidth / safeRenderWidth;
  const scaleY = safeHeight / safeRenderHeight;

  if (state.renderScaleMode === "cover") {
    const scale = Math.max(scaleX, scaleY);
    const viewWidth = safeWidth / scale;
    const viewHeight = safeHeight / scale;
    return {
      x: (safeRenderWidth - viewWidth) / 2,
      y: (safeRenderHeight - viewHeight) / 2,
      width: viewWidth,
      height: viewHeight,
    };
  }

  return {
    x: 0,
    y: 0,
    width: safeRenderWidth,
    height: safeRenderHeight,
  };
}


export function getRenderTargetSize(): {
  renderWidth: number;
  renderHeight: number;
} {
  const renderWidth = Math.max(
    1,
    state.renderWidth || Math.floor(state.gameWidth * state.renderScale)
  );
  const renderHeight = Math.max(
    1,
    state.renderHeight || Math.floor(state.gameHeight * state.renderScale)
  );
  return { renderWidth, renderHeight };
}


export function screenToRender(
  screenX: number,
  screenY: number,
  clampInside: boolean = false
): { x: number; y: number } {
  const display = getDisplaySize();
  const { renderWidth, renderHeight } = getRenderTargetSize();

  const viewport =
    state.presentationViewport.width && state.presentationViewport.height
      ? state.presentationViewport
      : computePresentationViewport(
          display.width,
          display.height,
          renderWidth,
          renderHeight
        );

  const sourceSlice = computeTextureSlice(
    display.width,
    display.height,
    renderWidth,
    renderHeight
  );

  const u = (screenX - viewport.x) / Math.max(1, viewport.width);
  const v = (screenY - viewport.y) / Math.max(1, viewport.height);

  let rx = sourceSlice.x + u * sourceSlice.width;
  let ry = sourceSlice.y + v * sourceSlice.height;

  if (clampInside) {
    rx = Math.max(0, Math.min(renderWidth, rx));
    ry = Math.max(0, Math.min(renderHeight, ry));
  }

  return { x: rx, y: ry };
}


export function screenToGame(
  screenX: number,
  screenY: number
): { x: number; y: number } | null {
  const display = getDisplaySize();
  const { renderWidth, renderHeight } = getRenderTargetSize();

  const viewport =
    state.presentationViewport.width && state.presentationViewport.height
      ? state.presentationViewport
      : computePresentationViewport(
          display.width,
          display.height,
          renderWidth,
          renderHeight
        );

  const u = (screenX - viewport.x) / Math.max(1, viewport.width);
  const v = (screenY - viewport.y) / Math.max(1, viewport.height);

  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  const sourceSlice = computeTextureSlice(
    display.width,
    display.height,
    renderWidth,
    renderHeight
  );

  const renderX = sourceSlice.x + u * sourceSlice.width;
  const renderY = sourceSlice.y + v * sourceSlice.height;

  const scale = state.renderScale || 1;
  const gameX = renderX / scale;
  const gameY = renderY / scale;

  return { x: gameX, y: gameY };
}

export function calculateRenderScale(): number {
  const { width: rawWidth, height: rawHeight } = getDisplaySize();
  const screenWidth = Math.max(1, rawWidth);
  const screenHeight = Math.max(1, rawHeight);
  const widthScale = screenWidth / state.gameWidth;
  const heightScale = screenHeight / state.gameHeight;

  let scale: number;
  if (state.renderScaleMode === "cover") {
    scale = Math.max(widthScale, heightScale);
  } else if (state.renderScaleMode === "stretch") {
    scale = Math.max(widthScale, heightScale);
  } else {
    scale = Math.min(widthScale, heightScale);
  }

  if (!Number.isFinite(scale) || scale <= 0) {
    scale = 1;
  }

  scale = Math.max(MIN_RENDER_SCALE, Math.min(MAX_RENDER_SCALE, scale));
  return Math.round(scale * 1000) / 1000;
}

export function setupRenderTargets(): void {
  const displaySize = getDisplaySize();
  state.renderScale = calculateRenderScale();
  state.renderWidth = Math.max(
    1,
    Math.floor(state.gameWidth * state.renderScale)
  );
  state.renderHeight = Math.max(
    1,
    Math.floor(state.gameHeight * state.renderScale)
  );

  state.presentationViewport = computePresentationViewport(
    displaySize.width,
    displaySize.height,
    state.renderWidth,
    state.renderHeight
  );
}

export function updateRenderTexture(): void {
  const displaySize = getDisplaySize();
  const newRenderScale = calculateRenderScale();
  const newRenderWidth = Math.max(
    1,
    Math.floor(state.gameWidth * newRenderScale)
  );
  const newRenderHeight = Math.max(
    1,
    Math.floor(state.gameHeight * newRenderScale)
  );

  const scaleChanged = Math.abs(newRenderScale - state.renderScale) > 0.01;
  const sizeChanged =
    newRenderWidth !== state.renderWidth ||
    newRenderHeight !== state.renderHeight;

  if (scaleChanged || sizeChanged) {
    state.renderScale = newRenderScale;
    state.renderWidth = newRenderWidth;
    state.renderHeight = newRenderHeight;
  }

  state.presentationViewport = computePresentationViewport(
    displaySize.width,
    displaySize.height,
    state.renderWidth,
    state.renderHeight
  );
}

export function handleWindowEvents(): boolean {
  const displaySize = getDisplaySize();
  const currentWidth = displaySize.width;
  const currentHeight = displaySize.height;
  const isFullscreen = IsWindowFullscreen();

  const sizeChanged =
    currentWidth !== state.lastWindowWidth ||
    currentHeight !== state.lastWindowHeight;
  const fullscreenChanged = isFullscreen !== state.wasFullscreen;

  if (sizeChanged || fullscreenChanged) {
    updateRenderTexture();
    state.lastWindowWidth = currentWidth;
    state.lastWindowHeight = currentHeight;
    state.wasFullscreen = isFullscreen;
  }

  return isFullscreen;
}

function computeCameraPlaneForScreenRect(
  screenX: number,
  screenY: number,
  rectWidth: number,
  rectHeight: number,
  screenWidth: number,
  screenHeight: number
): {
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
} {
  const camera = state.camera;
  const topLeft = GetScreenToWorldRayEx(
    Vector2(screenX, screenY),
    camera,
    screenWidth,
    screenHeight
  );
  const topRight = GetScreenToWorldRayEx(
    Vector2(screenX + rectWidth, screenY),
    camera,
    screenWidth,
    screenHeight
  );
  const bottomLeft = GetScreenToWorldRayEx(
    Vector2(screenX, screenY + rectHeight),
    camera,
    screenWidth,
    screenHeight
  );

  const t0 = -topLeft.position.z / topLeft.direction.z;
  const t1 = -topRight.position.z / topRight.direction.z;
  const t2 = -bottomLeft.position.z / bottomLeft.direction.z;

  const worldX0 = topLeft.position.x + t0 * topLeft.direction.x;
  const worldY0 = topLeft.position.y + t0 * topLeft.direction.y;
  const worldX1 = topRight.position.x + t1 * topRight.direction.x;
  const worldY2 = bottomLeft.position.y + t2 * bottomLeft.direction.y;

  return {
    originX: worldX0,
    originY: worldY0,
    scaleX: (worldX1 - worldX0) / state.gameWidth,
    scaleY: (worldY2 - worldY0) / state.gameHeight,
  };
}

export function renderOnScreen(drawFunction: () => void): void {
  const display = getDisplaySize();
  const { renderWidth, renderHeight } = getRenderTargetSize();

  const viewport = (state.presentationViewport = computePresentationViewport(
    display.width,
    display.height,
    renderWidth,
    renderHeight
  ));

  const destX = Math.round(viewport.x);
  const destY = Math.round(viewport.y);
  const destWidth = Math.max(1, Math.round(viewport.width || display.width));
  const destHeight = Math.max(1, Math.round(viewport.height || display.height));

  try {
    (state.currentScene as any)?.drawScreenBackground?.();
  } catch {}

  BeginMode3D(state.camera);
  rlDisableDepthTest();
  rlPushMatrix();

  const { originX, originY, scaleX, scaleY } = computeCameraPlaneForScreenRect(
    destX,
    destY,
    destWidth,
    destHeight,
    display.width,
    display.height
  );

  rlTranslatef(originX, originY, 0);
  rlScalef(scaleX, scaleY, 1);

  drawFunction();

  rlPopMatrix();
  rlDisableDepthTest();
  EndMode3D();
}

export function getPresentationInfo(): {
  displayWidth: number;
  displayHeight: number;
  viewport: RenderViewport;
} {
  const display = getDisplaySize();
  const { renderWidth, renderHeight } = getRenderTargetSize();
  const viewport = computePresentationViewport(
    display.width,
    display.height,
    renderWidth,
    renderHeight
  );
  return {
    displayWidth: display.width,
    displayHeight: display.height,
    viewport,
  };
}
