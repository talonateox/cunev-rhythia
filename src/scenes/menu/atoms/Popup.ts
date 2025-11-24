import { GameObject } from "../../../atoms/Object";
import { drawText } from "../../../utils/text";
import {
  WHITE,
  BLACK,
  Color,
  Vector2,
  Vector3,
  GetFrameTime,
  rlPushMatrix,
  rlPopMatrix,
} from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { lerpDelta } from "../../../utils/lerp";
import { rgb, tintWithAccent } from "../../../utils/colors";
import { AccentColor } from "../../../utils/imageBlur";
import { logger } from "../../../utils/logger";
import { OverlayBase } from "../../../ui/OverlayBase";
import { drawPanel, drawRect } from "../../../ui/draw";
import { drawSprite } from "../../../utils/sprite";
import { createInputBox, InputBox } from "./InputBox";

export type PopupType =
  | "loading"
  | "download"
  | "error"
  | "info"
  | "confirm"
  | "prompt";

export class Popup extends OverlayBase {
  private static activePopups: Popup[] = [];
  private type: PopupType;
  private label: string = "Loading...";
  private pulseScale: number = 1;
  private pulseDirection: number = 1;
  private dotCount: number = 0;
  private dotTimer: number = 0;
  private accentColor: AccentColor | null = null;
  
  private confirmMessage: string = "Are you sure?";
  private confirmYesLabel: string = "Confirm";
  private confirmNoLabel: string = "Cancel";
  private onConfirm: (() => void) | null = null;
  private onCancel: (() => void) | null = null;
  private hoverConfirm: number = 0;
  private hoverCancel: number = 0;

  
  private promptMessage: string = "";
  private promptPlaceholder: string = "";
  private promptInitialValue: string = "";
  private promptYesLabel: string = "Confirm";
  private promptNoLabel: string = "Cancel";
  private onPromptConfirm: ((value: string) => void) | null = null;
  private onPromptCancel: (() => void) | null = null;
  private inputBox: InputBox | null = null;

  constructor(type: PopupType = "loading") {
    super({ backdropAlpha: 170, consumeOutsideClick: true });
    this.type = type;
    
    try {
      this.getGameObject().zBase = 30;
    } catch {}
    this.getGameObject().onUpdate = () => {
      this.updateAnimation();
      this.update();
    };
    this.getGameObject().onDraw = () => {
      this.drawBackdrop();
      this.draw();
    };
    
    this.getGameObject().rectArea!.onClick = () => this.handleClick();
    Popup.activePopups.push(this);
    logger(
      `[Popup] Created ${type} popup with GameObject ID:`,
      this.getGameObject().id
    );
  }

  public show(label: string = "Loading"): void {
    this.label = label;
    this.open();
    logger(`[Popup] ${this.type} popup shown:`, {
      label,
      active: this.isActive(),
    });
  }

  public hide(): void {
    this.close();
    this.destroyPromptInput();
    logger(`[Popup] ${this.type} popup hidden`);
  }

  public isActive(): boolean {
    return super.isActive();
  }

  public startLoading(label: string = "Loading"): void {
    this.show(label);
  }

  public endLoading(): void {
    this.hide();
  }

  public isLoading(): boolean {
    return this.isActive();
  }

  public showConfirm(opts: {
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    this.type = "confirm";
    this.confirmMessage = opts.message;
    this.confirmYesLabel = opts.confirmText ?? "Confirm";
    this.confirmNoLabel = opts.cancelText ?? "Cancel";
    this.onConfirm = opts.onConfirm;
    this.onCancel = opts.onCancel ?? null;
    this.open();
  }

  public showPrompt(opts: {
    message: string;
    placeholder?: string;
    initialValue?: string;
    confirmText?: string;
    cancelText?: string;
    maxLength?: number;
    onConfirm: (value: string) => void;
    onCancel?: () => void;
  }): void {
    this.type = "prompt";
    this.promptMessage = opts.message;
    this.promptPlaceholder = opts.placeholder ?? "";
    this.promptInitialValue = opts.initialValue ?? "";
    this.promptYesLabel = opts.confirmText ?? "Confirm";
    this.promptNoLabel = opts.cancelText ?? "Cancel";
    this.onPromptConfirm = opts.onConfirm;
    this.onPromptCancel = opts.onCancel ?? null;

    
    const rect = this.getPanelRect();
    const marginX = 40;
    const inputWidth = Math.max(120, rect.w - marginX * 2);
    const inputCenterY = rect.y + rect.h / 2 + 4;
    this.inputBox = createInputBox({
      position: Vector2(rect.x + marginX, inputCenterY),
      width: inputWidth,
      height: 40,
      placeholder: this.promptPlaceholder,
      initialValue: this.promptInitialValue,
      maxLength: opts.maxLength ?? 64,
      fontSize: 22,
      onEnter: (value: string) => {
        try {
          this.onPromptConfirm?.(value);
        } catch {}
        this.hide();
      },
      onBlur: () => {},
    });
    try {
      this.inputBox.getGameObject().zBase = 36;
      this.inputBox.setAccentColor(this.accentColor ?? null);
    } catch {}
    this.open();
    try {
      this.inputBox.focus();
    } catch {}
  }

  private update(): void {
    
    
    if (this.type === "loading") {
      this.pulseScale += this.pulseDirection * GetFrameTime() * 0.05;
      if (this.pulseScale > 1.02) {
        this.pulseScale = 1.02;
        this.pulseDirection = -1;
      } else if (this.pulseScale < 1) {
        this.pulseScale = 1;
        this.pulseDirection = 1;
      }
    } else {
      this.pulseScale = 1;
      this.pulseDirection = 1;
    }

    this.dotTimer += GetFrameTime();
    if (this.dotTimer >= 0.5) {
      this.dotTimer = 0;
      this.dotCount = (this.dotCount + 1) % 4;
    }

    
    if ((this.type === "confirm" || this.type === "prompt") && this.isActive() && this.opacity > 0.01) {
      const rect = this.getPanelRect();
      const btns = this.computeConfirmButtons(rect.x, rect.y, rect.w, rect.h);
      const mouse = this.getGameObject().getMousePosition();
      const inRect = (r: { x: number; y: number; w: number; h: number }) =>
        !!(
          mouse &&
          mouse.x >= r.x &&
          mouse.x <= r.x + r.w &&
          mouse.y >= r.y &&
          mouse.y <= r.y + r.h
        );
      this.hoverConfirm = lerpDelta(this.hoverConfirm, inRect(btns.confirm) ? 1 : 0, 0.25);
      this.hoverCancel = lerpDelta(this.hoverCancel, inRect(btns.cancel) ? 1 : 0, 0.25);
    } else {
      this.hoverConfirm = lerpDelta(this.hoverConfirm, 0, 0.25);
      this.hoverCancel = lerpDelta(this.hoverCancel, 0, 0.25);
    }

    
    if (this.type === "prompt" && this.inputBox && this.isActive() && this.opacity > 0.01) {
      try {
        const rect = this.getPanelRect();
        const marginX = 40;
        const inputWidth = Math.max(120, rect.w - marginX * 2);
        const inputCenterY = rect.y + rect.h / 2 + 4;
        this.inputBox.setGeometry(Vector2(rect.x + marginX, inputCenterY), inputWidth, 40);
      } catch {}
    }
  }

  private draw(): void {
    if (!this.isActive()) {
      return;
    }
    if (this.opacity < 0.01) {
      return;
    }

    const rect = this.getPanelRect();
    const popupX = rect.x;
    const popupY = rect.y;
    const popupWidth = rect.w;
    const popupHeight = rect.h;

    const baseBgColor = { r: 20, g: 20, b: 20 };
    const tintedBgColor = tintWithAccent(baseBgColor, this.accentColor, 0.2); 
    const bgColor = { ...tintedBgColor, a: Math.round(this.opacity * 255) };

    const baseBorderColor = { r: 255, g: 255, b: 255 };
    const tintedBorderColor = tintWithAccent(
      baseBorderColor,
      this.accentColor,
      0.6
    );
    const borderColor = {
      ...tintedBorderColor,
      a: Math.round(this.opacity * 0.4 * 255),
    };
    drawPanel(popupX, popupY, popupWidth, popupHeight, bgColor, borderColor, 4);

    if (this.type === "confirm") {
      this.drawConfirm(popupX, popupY, popupWidth, popupHeight);
    } else if (this.type === "prompt") {
      this.drawPrompt(popupX, popupY, popupWidth, popupHeight);
    } else {
      this.drawLoadingLike(popupX, popupY, popupWidth, popupHeight);
    }
  }

  private getPanelRect(): { x: number; y: number; w: number; h: number } {
    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;
    const baseWidth = 420;
    const baseHeight = 210;
    const animatedScale = this.getAnimatedScale();
    const popupWidth = baseWidth * animatedScale;
    const popupHeight = baseHeight * animatedScale;
    const popupX = (screenWidth - popupWidth) / 2;
    const popupY = (screenHeight - popupHeight) / 2;
    return { x: popupX, y: popupY, w: popupWidth, h: popupHeight };
  }

  private getAnimatedScale(): number {
    
    return this.scale * (this.type === "loading" ? this.pulseScale : 1);
  }

  private drawLoadingLike(
    popupX: number,
    popupY: number,
    popupWidth: number,
    popupHeight: number
  ): void {
    const labelText = `${this.label}`;
    const textColor = rgb(1, 1, 1, this.opacity);

    const animatedScale = this.getAnimatedScale();
    const fontSize = 28 * animatedScale;
    const textX = Rhythia.gameWidth / 2;
    const textY = popupY + popupHeight / 2 - 36;
    drawText(labelText, Vector2(textX, textY), fontSize, textColor, "center");

    const spinnerSize = 40 * animatedScale;
    const spinnerX = Rhythia.gameWidth / 2;
    const spinnerY = popupY + popupHeight - 60 * animatedScale;
    const spinnerRadius = spinnerSize / 2;
    const segments = 8;
    const time = Date.now() / 1000;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2 + time * 2;
      const x = spinnerX + Math.cos(angle) * spinnerRadius;
      const y = spinnerY + Math.sin(angle) * spinnerRadius;
      const segmentOpacity = ((i / segments) * 0.7 + 0.3) * this.opacity;
      const baseSegmentColor = { r: 255, g: 255, b: 255 };
      const tintedSegmentColor = tintWithAccent(
        baseSegmentColor,
        this.accentColor,
        0.8
      );
      const segmentColor = {
        ...tintedSegmentColor,
        a: segmentOpacity * 255,
      } as any;
      const segmentSize = 4 * animatedScale * (0.5 + (i / segments) * 0.5);
      drawRect(
        x - segmentSize / 2,
        y - segmentSize / 2,
        segmentSize,
        segmentSize,
        segmentColor
      );
    }
  }

  private drawConfirm(
    popupX: number,
    popupY: number,
    popupWidth: number,
    popupHeight: number
  ): void {
    const message = this.confirmMessage;
    const textColor = rgb(1, 1, 1, this.opacity);
    const fontSize = 24 * this.getAnimatedScale();
    const textX = popupX + popupWidth / 2;
    const textY = popupY + 36;
    drawText(message, Vector2(textX, textY), fontSize, textColor, "center");

    const btns = this.computeConfirmButtons(
      popupX,
      popupY,
      popupWidth,
      popupHeight
    );

    
    drawSprite(
      "/solid.png",
      Vector2(btns.cancel.x, btns.cancel.y),
      Vector2(btns.cancel.w, btns.cancel.h),
      { r: 35, g: 35, b: 40, a: Math.round(255 * this.opacity) }
    );
    if (this.hoverCancel > 0.01) {
      drawSprite(
        "/solid.png",
        Vector2(btns.cancel.x, btns.cancel.y),
        Vector2(btns.cancel.w, btns.cancel.h),
        { r: 255, g: 255, b: 255, a: Math.round(40 * this.hoverCancel * this.opacity) }
      );
    }
    drawSprite(
      "/solid.png",
      Vector2(btns.cancel.x, btns.cancel.y + btns.cancel.h - 2),
      Vector2(btns.cancel.w, 2),
      { r: 180, g: 180, b: 180, a: Math.round(255 * this.opacity) }
    );
    drawText(
      this.confirmNoLabel,
      Vector2(
        btns.cancel.x + btns.cancel.w / 2,
        btns.cancel.y + (btns.cancel.h - 22) / 2
      ),
      22,
      { r: 255, g: 255, b: 255, a: Math.round(255 * this.opacity) },
      "center"
    );

    
    drawSprite(
      "/solid.png",
      Vector2(btns.confirm.x, btns.confirm.y),
      Vector2(btns.confirm.w, btns.confirm.h),
      { r: 60, g: 40, b: 40, a: Math.round(255 * this.opacity) }
    );
    if (this.hoverConfirm > 0.01) {
      drawSprite(
        "/solid.png",
        Vector2(btns.confirm.x, btns.confirm.y),
        Vector2(btns.confirm.w, btns.confirm.h),
        { r: 255, g: 150, b: 150, a: Math.round(35 * this.hoverConfirm * this.opacity) }
      );
    }
    drawSprite(
      "/solid.png",
      Vector2(btns.confirm.x, btns.confirm.y + btns.confirm.h - 2),
      Vector2(btns.confirm.w, 2),
      { r: 220, g: 120, b: 120, a: Math.round(255 * this.opacity) }
    );
    drawText(
      this.confirmYesLabel,
      Vector2(
        btns.confirm.x + btns.confirm.w / 2,
        btns.confirm.y + (btns.confirm.h - 22) / 2
      ),
      22,
      { r: 255, g: 230, b: 230, a: Math.round(255 * this.opacity) },
      "center"
    );
  }

  private drawPrompt(
    popupX: number,
    popupY: number,
    popupWidth: number,
    popupHeight: number
  ): void {
    const message = this.promptMessage;
    const textColor = rgb(1, 1, 1, this.opacity);
    const fontSize = 24 * this.getAnimatedScale();
    const textX = popupX + popupWidth / 2;
    const textY = popupY + 32;
    drawText(message, Vector2(textX, textY), fontSize, textColor, "center");

    const btns = this.computeConfirmButtons(popupX, popupY, popupWidth, popupHeight);

    
    drawSprite(
      "/solid.png",
      Vector2(btns.cancel.x, btns.cancel.y),
      Vector2(btns.cancel.w, btns.cancel.h),
      { r: 35, g: 35, b: 40, a: Math.round(255 * this.opacity) }
    );
    if (this.hoverCancel > 0.01) {
      drawSprite(
        "/solid.png",
        Vector2(btns.cancel.x, btns.cancel.y),
        Vector2(btns.cancel.w, btns.cancel.h),
        { r: 255, g: 255, b: 255, a: Math.round(40 * this.hoverCancel * this.opacity) }
      );
    }
    drawSprite(
      "/solid.png",
      Vector2(btns.cancel.x, btns.cancel.y + btns.cancel.h - 2),
      Vector2(btns.cancel.w, 2),
      { r: 180, g: 180, b: 180, a: Math.round(255 * this.opacity) }
    );
    drawText(
      this.promptNoLabel,
      Vector2(
        btns.cancel.x + btns.cancel.w / 2,
        btns.cancel.y + (btns.cancel.h - 22) / 2
      ),
      22,
      { r: 255, g: 255, b: 255, a: Math.round(255 * this.opacity) },
      "center"
    );

    
    drawSprite(
      "/solid.png",
      Vector2(btns.confirm.x, btns.confirm.y),
      Vector2(btns.confirm.w, btns.confirm.h),
      { r: 60, g: 40, b: 40, a: Math.round(255 * this.opacity) }
    );
    if (this.hoverConfirm > 0.01) {
      drawSprite(
        "/solid.png",
        Vector2(btns.confirm.x, btns.confirm.y),
        Vector2(btns.confirm.w, btns.confirm.h),
        { r: 255, g: 150, b: 150, a: Math.round(35 * this.hoverConfirm * this.opacity) }
      );
    }
    drawSprite(
      "/solid.png",
      Vector2(btns.confirm.x, btns.confirm.y + btns.confirm.h - 2),
      Vector2(btns.confirm.w, 2),
      { r: 220, g: 120, b: 120, a: Math.round(255 * this.opacity) }
    );
    drawText(
      this.promptYesLabel,
      Vector2(
        btns.confirm.x + btns.confirm.w / 2,
        btns.confirm.y + (btns.confirm.h - 22) / 2
      ),
      22,
      { r: 255, g: 230, b: 230, a: Math.round(255 * this.opacity) },
      "center"
    );
  }

  private computeConfirmButtons(
    popupX: number,
    popupY: number,
    popupWidth: number,
    popupHeight: number
  ): {
    cancel: { x: number; y: number; w: number; h: number };
    confirm: { x: number; y: number; w: number; h: number };
  } {
    const btnWidth = 160;
    const btnHeight = 44;
    const gap = 20;
    const centerX = popupX + popupWidth / 2;
    const btnY = popupY + popupHeight - 72;
    return {
      cancel: {
        x: centerX - gap / 2 - btnWidth,
        y: btnY,
        w: btnWidth,
        h: btnHeight,
      },
      confirm: { x: centerX + gap / 2, y: btnY, w: btnWidth, h: btnHeight },
    };
  }

  private handleClick(): boolean {
    if (!this.isActive()) return false;
    const mousePos = this.getGameObject().getMousePosition();
    if (!mousePos) return true; 
    const rect = this.getPanelRect();
    const inside =
      mousePos.x >= rect.x &&
      mousePos.x <= rect.x + rect.w &&
      mousePos.y >= rect.y &&
      mousePos.y <= rect.y + rect.h;
    if (inside) {
      if (this.type === "confirm") {
        const btns = this.computeConfirmButtons(rect.x, rect.y, rect.w, rect.h);
        const inCancel =
          mousePos.x >= btns.cancel.x &&
          mousePos.x <= btns.cancel.x + btns.cancel.w &&
          mousePos.y >= btns.cancel.y &&
          mousePos.y <= btns.cancel.y + btns.cancel.h;
        const inConfirm =
          mousePos.x >= btns.confirm.x &&
          mousePos.x <= btns.confirm.x + btns.confirm.w &&
          mousePos.y >= btns.confirm.y &&
          mousePos.y <= btns.confirm.y + btns.confirm.h;
        if (inCancel) {
          try {
            this.onCancel?.();
          } catch {}
          this.hide();
          return true;
        }
        if (inConfirm) {
          try {
            this.onConfirm?.();
          } catch {}
          this.hide();
          return true;
        }
        return true; 
      } else if (this.type === "prompt") {
        const btns = this.computeConfirmButtons(rect.x, rect.y, rect.w, rect.h);
        const inCancel =
          mousePos.x >= btns.cancel.x &&
          mousePos.x <= btns.cancel.x + btns.cancel.w &&
          mousePos.y >= btns.cancel.y &&
          mousePos.y <= btns.cancel.y + btns.cancel.h;
        const inConfirm =
          mousePos.x >= btns.confirm.x &&
          mousePos.x <= btns.confirm.x + btns.confirm.w &&
          mousePos.y >= btns.confirm.y &&
          mousePos.y <= btns.confirm.y + btns.confirm.h;
        if (inCancel) {
          try {
            this.onPromptCancel?.();
          } catch {}
          this.hide();
          return true;
        }
        if (inConfirm) {
          const value = (this.inputBox?.getValue?.() ?? "") as string;
          try {
            this.onPromptConfirm?.(value);
          } catch {}
          this.hide();
          return true;
        }
        return true; 
      }
      return true; 
    }
    
    if (this.type === "confirm") {
      try {
        this.onCancel?.();
      } catch {}
      this.hide();
    } else if (this.type === "prompt") {
      try {
        this.onPromptCancel?.();
      } catch {}
      this.hide();
    }
    return true;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public destroy(): void {
    this.getGameObject().destroy();

    const index = Popup.activePopups.indexOf(this);
    if (index !== -1) {
      Popup.activePopups.splice(index, 1);
    }
    this.destroyPromptInput();
    logger("[Popup] Destroyed GameObject and removed from registry");
  }

  public static isAnyPopupLoading(): boolean {
    return Popup.activePopups.some((popup) => popup.isActive());
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  private destroyPromptInput(): void {
    if (this.inputBox) {
      try {
        this.inputBox.destroy();
      } catch {}
      this.inputBox = null;
    }
  }
}

export function createPopup(type: PopupType = "loading"): Popup {
  return new Popup(type);
}
