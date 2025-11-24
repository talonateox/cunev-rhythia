import { createTween } from "./tween";
import { lerp, lerpDelta } from "./lerp";
import {
  GetMousePosition,
  IsMouseButtonDown,
  GetMouseWheelMove,
  GetFrameTime,
} from "raylib";
import { Rhythia } from "../atoms/Rhythia";
import { Popup } from "../scenes/menu/atoms/Popup";
import { VolumeKnob } from "../scenes/menu/atoms/VolumeKnob";
import { MenuScene } from "../scenes/menu";
import { screenToGame } from "../atoms/sysutils/rendering";
import { TimeSlider } from "../scenes/menu/molecules/musicplayer/TimeSlider";

let targetScrollY = 0;
let currentScrollY = 0;
let scrollCallbacks: Array<(deltaY: number) => void> = [];

let isDragging = false;
let lastInputY = 0;
let velocity = 0;
let lastDragTime = 0;

let dragTargetY = 0;

let minScrollY = -Infinity;
let maxScrollY = Infinity;

let scrollTween: ReturnType<typeof createTween> | null = null;

let wasBlocked = false;

let isDraggingScrollbar = false;
let scrollbarThumbGrabOffset = 0;

function isInteractionBlocked(): boolean {
  return (
    Popup.isAnyPopupLoading() ||
    VolumeKnob.isActive() ||
    MenuScene.isAnyOverlayOpen() ||
    TimeSlider.isAnyDragging()
  );
}

export function getScrollY(): number {
  return currentScrollY;
}

export function getIsDragging(): boolean {
  return isDragging;
}

export function addScrollOffset(offset: number): void {
  const newValue = targetScrollY + offset;
  targetScrollY = Math.max(minScrollY, Math.min(maxScrollY, newValue));
}

export function setScrollY(value: number): void {
  const clampedValue = Math.max(minScrollY, Math.min(maxScrollY, value));
  velocity = 0; 

  if (scrollTween) {
    scrollTween.cancel();
  }

  const startValue = currentScrollY;
  scrollTween = createTween(
    "scrollY", 
    startValue, 
    clampedValue, 
    0.2, 
    (value) => {
      currentScrollY = value;
      targetScrollY = value; 
    },

    (t) => 1 - Math.pow(1 - t, 3)
  );

  scrollTween.onEnd(() => {
    scrollTween = null;
  });
}

export function setScrollYImmediate(value: number): void {
  const clampedValue = Math.max(minScrollY, Math.min(maxScrollY, value));

  velocity = 0;
  if (scrollTween) {
    scrollTween.cancel();
    scrollTween = null;
  }

  currentScrollY = clampedValue;
  targetScrollY = clampedValue;

  dragTargetY = clampedValue;
}

export function setScrollBounds(min: number, max: number): void {
  minScrollY = min;
  maxScrollY = max;

  targetScrollY = Math.max(minScrollY, Math.min(maxScrollY, targetScrollY));
  currentScrollY = Math.max(minScrollY, Math.min(maxScrollY, currentScrollY));
}

export function getScrollBounds(): { min: number; max: number } {
  return { min: minScrollY, max: maxScrollY };
}

function getGameMousePosition(): { x: number; y: number } {
  const screenMouse = GetMousePosition();
  const mapped = screenToGame(screenMouse.x, screenMouse.y);
  if (mapped) return mapped;
  
  return { x: -Infinity, y: -Infinity };
}

export function updateScrollInput(): void {
  const isBlocked = isInteractionBlocked();

  if (wasBlocked && !isBlocked) {
    resetScrollState();
  }
  wasBlocked = isBlocked;

  if (isBlocked) {
    return;
  }

  const currentTime = performance.now();

  const gameMouse = getGameMousePosition();

  
  if (TimeSlider.isAnyDragging()) {
    if (!wasBlocked) {
      
      resetScrollState();
    }
    wasBlocked = true;
    return;
  }
  const currentMouseY = gameMouse.y;
  const isMouseInsideViewport = Number.isFinite(currentMouseY);

  const wheelMove = GetMouseWheelMove();
  if (wheelMove !== 0) {
    isDragging = false;
    velocity = 0;

    addScrollOffset(-wheelMove * 100);
  }

  if (
    !isDragging &&
    !isDraggingScrollbar &&
    isMouseInsideViewport &&
    IsMouseButtonDown(0)
  ) {
    isDragging = true;
    velocity = 0;
    lastInputY = currentMouseY;
    lastDragTime = currentTime;
    dragTargetY = currentScrollY;
  }

  
  if (isDragging && !isMouseInsideViewport) {
    isDragging = false;
    velocity = 0;
    dragTargetY = currentScrollY;

    if (targetScrollY < minScrollY || targetScrollY > maxScrollY) {
      targetScrollY = Math.max(minScrollY, Math.min(maxScrollY, targetScrollY));
    }
  } else if (isDragging && IsMouseButtonDown(0)) {
    const deltaY = currentMouseY - lastInputY;
    const timeDelta = currentTime - lastDragTime;

    if (timeDelta > 0) {
      velocity = (-deltaY / timeDelta) * 30;
    }

    dragTargetY = dragTargetY - deltaY;

    const overscrollResistance = 0.3;
    if (dragTargetY < minScrollY) {
      dragTargetY =
        minScrollY + (dragTargetY - minScrollY) * overscrollResistance;
    } else if (dragTargetY > maxScrollY) {
      dragTargetY =
        maxScrollY + (dragTargetY - maxScrollY) * overscrollResistance;
    }

    targetScrollY = dragTargetY;

    lastInputY = currentMouseY;
    lastDragTime = currentTime;
  } else if (isDragging && !IsMouseButtonDown(0)) {
    isDragging = false;

    if (targetScrollY < minScrollY || targetScrollY > maxScrollY) {
      targetScrollY = Math.max(minScrollY, Math.min(maxScrollY, targetScrollY));
      velocity = 0; 
    }
  }

  if (!isDragging) {
    if (targetScrollY < minScrollY) {
      targetScrollY = lerpDelta(targetScrollY, minScrollY, 0.2);
      velocity = 0;
    } else if (targetScrollY > maxScrollY) {
      targetScrollY = lerpDelta(targetScrollY, maxScrollY, 0.2);
      velocity = 0;
    } else if (Math.abs(velocity) > 1) {
      const frameTime = GetFrameTime();
      targetScrollY += velocity * frameTime * 60; 

      const friction = Math.pow(0.92, frameTime * 60); 
      velocity *= friction;

      targetScrollY = Math.max(minScrollY, Math.min(maxScrollY, targetScrollY));
    } else {
      velocity = 0;
    }
  }
}

export function updateScrollRender(): void {
  const previousScrollY = currentScrollY;

  if (!scrollTween) {
    currentScrollY = lerpDelta(
      currentScrollY,
      targetScrollY,
      isDragging || isDraggingScrollbar ? 0.25 : 0.15 
    );
  }

  const delta = currentScrollY - previousScrollY;
  if (Math.abs(delta) > 0.01) {
    scrollCallbacks.forEach((callback) => callback(delta));
  }
}

export function updateScroll(): void {
  updateScrollRender();
}

export function onScroll(callback: (deltaY: number) => void): void {
  scrollCallbacks.push(callback);
}

export function removeScrollCallback(callback: (deltaY: number) => void): void {
  const index = scrollCallbacks.indexOf(callback);
  if (index !== -1) {
    scrollCallbacks.splice(index, 1);
  }
}

export function resetScrollState(): void {
  velocity = 0;
  isDragging = false;
  isDraggingScrollbar = false;
  scrollbarThumbGrabOffset = 0;

  if (scrollTween) {
    scrollTween.cancel();
    scrollTween = null;
  }

  targetScrollY = currentScrollY;
  dragTargetY = currentScrollY;
}

export function updateScrollbarInteraction(
  geom: { x: number; y: number; width: number; height: number },
  totalContentHeight: number,
  viewportHeight: number
): void {
  if (isInteractionBlocked()) return;

  if (totalContentHeight <= viewportHeight) {
    isDraggingScrollbar = false;
    scrollbarThumbGrabOffset = 0;
    return;
  }

  const trackX = geom.x;
  const trackWidth = geom.width;
  const areaTop = geom.y;
  const areaHeight = geom.height;

  const contentTotalHeight = totalContentHeight;
  const minThumbHeight = 20;
  const thumbHeight = Math.max(
    minThumbHeight,
    (areaHeight * viewportHeight) / Math.max(1, contentTotalHeight)
  );
  const maxScroll = Math.max(1, contentTotalHeight - viewportHeight);
  const scrollRatio = Math.max(0, Math.min(1, currentScrollY / maxScroll));
  const thumbTravel = Math.max(0, areaHeight - thumbHeight);
  const thumbY = areaTop + scrollRatio * thumbTravel;

  const mouse = getGameMousePosition();
  const mouseDown = IsMouseButtonDown(0);

  const hitPadX = 10;
  const hitPadY = 4;
  const isMouseOverThumb = !!(
    Number.isFinite(mouse.y) &&
    mouse.x >= trackX - hitPadX &&
    mouse.x <= trackX + trackWidth + hitPadX &&
    mouse.y >= thumbY - hitPadY &&
    mouse.y <= thumbY + thumbHeight + hitPadY
  );

  if (!isDraggingScrollbar && mouseDown && isMouseOverThumb) {
    isDraggingScrollbar = true;
    scrollbarThumbGrabOffset = Math.max(
      0,
      Math.min(thumbHeight, mouse.y - thumbY)
    );
    isDragging = false;
    velocity = 0;
  }

  if (isDraggingScrollbar) {
    if (!mouseDown) {
      isDraggingScrollbar = false;
      scrollbarThumbGrabOffset = 0;
      return;
    }
    const desiredThumbTop = mouse.y - scrollbarThumbGrabOffset;
    const clampedThumbTop = Math.max(
      areaTop,
      Math.min(areaTop + thumbTravel, desiredThumbTop)
    );
    const newRatio =
      thumbTravel > 0 ? (clampedThumbTop - areaTop) / thumbTravel : 0;
    const newTarget = newRatio * maxScroll;
    targetScrollY = Math.max(minScrollY, Math.min(maxScrollY, newTarget));
  }
}
