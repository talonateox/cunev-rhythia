import { GameObject } from "../../../atoms/Object";
import { Vector2 } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { logger } from "../../../utils/logger";
import { OverlayBase } from "../../../ui/OverlayBase";
import { drawPanel } from "../../../ui/draw";

interface ModalContent {
  draw: (
    modalX: number,
    modalY: number,
    modalWidth: number,
    modalHeight: number,
    opacity: number
  ) => void;
  onClose?: () => void;
  onClick?: (mouseX: number, mouseY: number) => boolean; 
  onKeyPress?: (key: string) => boolean; 
}

export class Modal extends OverlayBase {
  private static instance: Modal | null = null;
  private content: ModalContent | null = null;
  private modalWidth: number = 600;
  private modalHeight: number = 400;

  constructor() {
    super({ backdropAlpha: 180, consumeOutsideClick: true });
    logger("[Modal] Created with GameObject ID:", this.getGameObject().id);

    
    const go = this.getGameObject();
    
    go.zBase = 30;
    go.rectArea!.onClick = () => this.handleClick();
    go.onDraw = () => {
      this.drawBackdrop();
      this.draw();
    };
  }

  static getInstance(): Modal {
    const current = Modal.instance;
    let needsNew = false;
    if (!current) {
      needsNew = true;
    } else {
      try {
        const go = current.getGameObject();
        const exists = GameObject.getAll().includes(go);
        const sameScene = go.sceneOwner === GameObject.getCurrentSceneId();
        needsNew = !exists || !sameScene;
      } catch {
        needsNew = true;
      }
    }

    if (needsNew) {
      logger("[Modal] Creating new instance");
      Modal.instance = new Modal();
    }
    return Modal.instance;
  }

  static show(
    content: ModalContent,
    width: number = 600,
    height: number = 400
  ): void {
    const instance = Modal.getInstance();
    instance.content = content;
    instance.modalWidth = width;
    instance.modalHeight = height;
    instance.open();
    logger("[Modal] show called:", {
      width,
      height,
      isVisible: instance.isActive(),
    });
  }

  static hide(): void {
    const instance = Modal.getInstance();
    instance.close();
    logger("[Modal] hide called, targetVisible = false");

    if (instance.content?.onClose) {
      instance.content.onClose();
    }
  }

  static isVisible(): boolean {
    const instance = Modal.getInstance();
    return instance.isVisible || instance.targetVisible;
  }

  private handleClick(): boolean {
    if (!this.isActive() || !this.content) return false; 

    const mousePos = this.gameObject.getMousePosition();
    if (!mousePos) return true;

    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;
    const modalX = (screenWidth - this.modalWidth * this.scale) / 2;
    const modalY = (screenHeight - this.modalHeight * this.scale) / 2;
    const scaledWidth = this.modalWidth * this.scale;
    const scaledHeight = this.modalHeight * this.scale;

    if (
      mousePos.x >= modalX &&
      mousePos.x <= modalX + scaledWidth &&
      mousePos.y >= modalY &&
      mousePos.y <= modalY + scaledHeight
    ) {
      if (this.content.onClick) {
        const relativeX = mousePos.x - modalX;
        const relativeY = mousePos.y - modalY;
        return this.content.onClick(relativeX, relativeY);
      }
      return true; 
    } else {
      Modal.hide();
      return true;
    }
  }

  private draw(): void {
    if (!this.isActive() || !this.content) {
      return;
    }
    if (this.opacity < 0.01) {
      return;
    }

    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;

    const scaledWidth = this.modalWidth * this.scale;
    const scaledHeight = this.modalHeight * this.scale;
    const modalX = (screenWidth - scaledWidth) / 2;
    const modalY = (screenHeight - scaledHeight) / 2;
    drawPanel(
      modalX,
      modalY,
      scaledWidth,
      scaledHeight,
      { r: 25, g: 25, b: 25, a: Math.round(this.opacity * 255) },
      { r: 120, g: 120, b: 120, a: Math.round(this.opacity * 255) },
      2
    );

    this.content.draw(modalX, modalY, scaledWidth, scaledHeight, this.opacity);
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }
}

export function createModal(): Modal {
  return Modal.getInstance();
}
