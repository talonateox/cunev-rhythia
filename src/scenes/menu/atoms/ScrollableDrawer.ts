import {
  Vector2,
  GetMouseWheelMove,
  IsMouseButtonDown,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
} from "raylib";
import { BaseDrawer } from "./BaseDrawer";
import { clamp, lerpDelta } from "../../../utils/lerp";
import { drawSprite } from "../../../utils/sprite";

export abstract class ScrollableDrawer extends BaseDrawer {
  protected scrollOffset: number = 0;
  protected targetScrollOffset: number = 0;
  protected maxScrollOffset: number = 0;
  protected isDraggingScrollbar: boolean = false;
  protected scrollbarThumbGrabOffset: number = 0;
  protected suppressButtonReleaseClickFrames: number = 0;

  protected abstract getScrollAreaTop(): number;

  protected getScrollAreaBottomPadding(): number {
    return 0;
  }

  protected getScrollWheelStep(): number {
    return 80;
  }

  protected getScrollTrackX(): number {
    return this.drawerWidth - 14;
  }

  protected isScrollInteractionSuspended(): boolean {
    return false;
  }

  protected getScrollAreaHeight(): number {
    const top = this.getScrollAreaTop();
    return Math.max(
      0,
      this.drawerHeight - top - this.getScrollAreaBottomPadding()
    );
  }

  protected resetScrollState(): void {
    this.scrollOffset = 0;
    this.targetScrollOffset = 0;
    this.isDraggingScrollbar = false;
    this.scrollbarThumbGrabOffset = 0;
    this.suppressButtonReleaseClickFrames = 0;
  }

  protected updateScroll(mousePos: Vector2 | null): void {
    if (this.isScrollInteractionSuspended()) {
      this.targetScrollOffset = this.scrollOffset;
      return;
    }

    const areaTop = this.getScrollAreaTop();
    const areaHeight = this.getScrollAreaHeight();

    if (areaHeight <= 0) {
      this.maxScrollOffset = 0;
      this.targetScrollOffset = 0;
      this.scrollOffset = lerpDelta(this.scrollOffset, 0, 0.3);
      if (Math.abs(this.scrollOffset) < 0.1) this.scrollOffset = 0;
      return;
    }

    const wheelMove = GetMouseWheelMove();
    if (wheelMove !== 0 && this.isMouseInScrollArea(mousePos)) {
      const next =
        this.targetScrollOffset - wheelMove * this.getScrollWheelStep();
      this.targetScrollOffset = clamp(next, 0, this.maxScrollOffset);
    }

    const mouseDown = IsMouseButtonDown(MOUSE_BUTTON_LEFT);
    const mouseReleased = IsMouseButtonReleased(MOUSE_BUTTON_LEFT);

    const trackX = this.getScrollTrackX();
    const trackWidth = 6;
    const areaLeft = this.gameObject.rectArea?.pos.x ?? 0;
    const contentTotalHeight = areaHeight + this.maxScrollOffset;
    const minThumbHeight = 30;
    const thumbHeight = Math.max(
      minThumbHeight,
      (areaHeight * areaHeight) / Math.max(1, contentTotalHeight)
    );
    const scrollRatio =
      this.maxScrollOffset === 0
        ? 0
        : this.scrollOffset / Math.max(1, this.maxScrollOffset);
    const thumbTravel = Math.max(0, areaHeight - thumbHeight);
    const thumbY = areaTop + scrollRatio * thumbTravel;

    const hitPadX = 10;
    const hitPadY = 4;
    const isMouseOverThumb = !!(
      mousePos &&
      mousePos.x >= areaLeft + trackX - hitPadX &&
      mousePos.x <= areaLeft + trackX + trackWidth + hitPadX &&
      mousePos.y >= thumbY - hitPadY &&
      mousePos.y <= thumbY + thumbHeight + hitPadY
    );

    if (!this.isDraggingScrollbar && mouseDown && isMouseOverThumb) {
      this.isDraggingScrollbar = true;
      this.scrollbarThumbGrabOffset = mousePos
        ? Math.max(0, Math.min(thumbHeight, mousePos.y - thumbY))
        : 0;
    }

    if (this.isDraggingScrollbar) {
      if (!mouseDown || mouseReleased) {
        this.isDraggingScrollbar = false;
        this.scrollbarThumbGrabOffset = 0;
        this.suppressButtonReleaseClickFrames = 1;
      } else if (mousePos) {
        const desiredThumbTop = mousePos.y - this.scrollbarThumbGrabOffset;
        const clampedThumbTop = clamp(
          desiredThumbTop,
          areaTop,
          areaTop + thumbTravel
        );
        const newRatio =
          thumbTravel > 0 ? (clampedThumbTop - areaTop) / thumbTravel : 0;
        const newTarget = newRatio * this.maxScrollOffset;
        this.targetScrollOffset = clamp(newTarget, 0, this.maxScrollOffset);
      }
    }

    this.scrollOffset = lerpDelta(
      this.scrollOffset,
      this.targetScrollOffset,
      0.25
    );
    if (Math.abs(this.scrollOffset - this.targetScrollOffset) < 0.1) {
      this.scrollOffset = this.targetScrollOffset;
    }

    this.updateScrollBounds();
  }

  protected updateScrollBounds(): void {
    const areaHeight = this.getScrollAreaHeight();
    if (areaHeight <= 0) {
      this.maxScrollOffset = 0;
      this.resetScrollState();
    }
    this.targetScrollOffset = clamp(
      this.targetScrollOffset,
      0,
      this.maxScrollOffset
    );
    this.scrollOffset = clamp(this.scrollOffset, 0, this.maxScrollOffset);
  }

  protected isMouseInScrollArea(mousePos: Vector2 | null): boolean {
    if (!mousePos) return false;
    const areaTop = this.getScrollAreaTop();
    const areaBottom = areaTop + this.getScrollAreaHeight();
    const areaLeft = this.gameObject.rectArea?.pos.x ?? 0;
    const areaRight = areaLeft + this.drawerWidth;
    return (
      mousePos.x >= areaLeft &&
      mousePos.x <= areaRight &&
      mousePos.y >= areaTop &&
      mousePos.y <= areaBottom
    );
  }

  protected getScrollAdjustedMousePos(
    mousePos: Vector2 | null
  ): Vector2 | null {
    if (!mousePos || !this.isMouseInScrollArea(mousePos)) return null;
    return Vector2(mousePos.x, mousePos.y + this.scrollOffset);
  }

  protected renderScrollbar(): void {
    if (this.maxScrollOffset <= 0) return;
    const areaTop = this.getScrollAreaTop();
    const areaHeight = this.getScrollAreaHeight();
    if (areaHeight <= 0) return;

    const trackX = this.getScrollTrackX();
    const trackWidth = 6;
    drawSprite(
      "/solid.png",
      Vector2(trackX, areaTop),
      Vector2(trackWidth, areaHeight),
      { r: 40, g: 40, b: 45, a: 120 }
    );

    const contentTotalHeight = areaHeight + this.maxScrollOffset;
    const minThumbHeight = 30;
    const thumbHeight = Math.max(
      minThumbHeight,
      (areaHeight * areaHeight) / Math.max(1, contentTotalHeight)
    );
    const scrollRatio =
      this.maxScrollOffset === 0
        ? 0
        : this.scrollOffset / Math.max(1, this.maxScrollOffset);
    const thumbTravel = Math.max(0, areaHeight - thumbHeight);
    const thumbY = areaTop + scrollRatio * thumbTravel;

    const mousePos = this.gameObject.getMousePosition();
    const areaLeft = this.gameObject.rectArea?.pos.x ?? 0;
    const hitPadX = 10;
    const hitPadY = 4;
    const isMouseOverThumb = !!(
      mousePos &&
      mousePos.x >= areaLeft + trackX - hitPadX &&
      mousePos.x <= areaLeft + trackX + trackWidth + hitPadX &&
      mousePos.y >= thumbY - hitPadY &&
      mousePos.y <= thumbY + thumbHeight + hitPadY
    );

    const baseThumbColor = { r: 120, g: 150, b: 200, a: 200 };
    const thumbColor =
      isMouseOverThumb || this.isDraggingScrollbar
        ? this.lightenColor(baseThumbColor, 0.12)
        : baseThumbColor;
    drawSprite(
      "/solid.png",
      Vector2(trackX, thumbY),
      Vector2(trackWidth, thumbHeight),
      thumbColor
    );
  }

  protected lightenColor(
    color: { r: number; g: number; b: number; a: number },
    amount: number
  ) {
    const factor = clamp(amount, 0, 1);
    const lightenChannel = (value: number) =>
      Math.round(value + (255 - value) * factor);
    return {
      r: lightenChannel(color.r),
      g: lightenChannel(color.g),
      b: lightenChannel(color.b),
      a: color.a,
    };
  }

  public suppressNextClick(frames: number = 1): void {
    this.suppressButtonReleaseClickFrames = Math.max(
      this.suppressButtonReleaseClickFrames,
      Math.max(0, Math.floor(frames))
    );
  }
}
