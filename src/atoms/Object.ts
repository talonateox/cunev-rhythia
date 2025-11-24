import { GetMousePosition, IsMouseButtonPressed, Vector2 } from "raylib";
import { Rhythia } from "./Rhythia";
import { Popup } from "../scenes/menu/atoms/Popup";
import { logger } from "../utils/logger";
import { screenToGame } from "./sysutils/rendering";

export interface ObjectOptions {
  onUpdate?: () => void;
  onDraw?: () => void;
  onOffscreenUpdate?: () => void;
  onShow?: () => void;
  onHide?: () => void;
  zBase?: number;
  sceneOwner?: string;
}

export interface RectAreaOptions {
  pos: Vector2;
  size: Vector2;
  onClick?: () => boolean | void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export class GameObject {
  static objects: GameObject[] = [];
  private static nextId = 0;
  private static pausedScenes: Set<string> = new Set();

  public id: number;
  public onUpdate?: () => void;
  public onDraw?: () => void;
  public onOffscreenUpdate?: () => void;
  public onShow?: () => void;
  public onHide?: () => void;
  public rectArea?: RectAreaOptions;
  public zBase: number = 0;
  public sceneOwner?: string;
  private wasHovering = false;
  private wasVisible = true;

  constructor(options: ObjectOptions = {}) {
    this.id = GameObject.nextId++;
    this.onUpdate = options.onUpdate;
    this.onDraw = options.onDraw;
    this.onOffscreenUpdate = options.onOffscreenUpdate;
    this.onShow = options.onShow;
    this.onHide = options.onHide;
    this.zBase = options.zBase ?? 0;

    this.sceneOwner = options.sceneOwner ?? GameObject.getCurrentSceneId();
    if (!this.sceneOwner && !options.sceneOwner) {
      console.warn(
        `⚠️  GameObject created without scene context (timing issue?)`,
      );
    }

    GameObject.addObject(this);
  }

  public attachRect(options: RectAreaOptions): void {
    this.rectArea = options;
  }

  public isPaused(): boolean {
    const paused = this.sceneOwner
      ? GameObject.pausedScenes.has(this.sceneOwner)
      : false;
    return paused;
  }

  public isPointInRect(point: Vector2): boolean {
    if (!this.rectArea) {
      return false;
    }

    const { pos, size } = this.rectArea;

    return (
      point.x >= pos.x &&
      point.x <= pos.x + size.x &&
      point.y >= pos.y &&
      point.y <= pos.y + size.y
    );
  }

  public getMousePosition(): Vector2 | null {
    const screenMouse = GetMousePosition();
    const mapped = screenToGame(screenMouse.x, screenMouse.y);
    if (!mapped) return null;
    return Vector2(mapped.x, mapped.y);
  }

  public isOnScreen(): boolean {
    if (!this.rectArea) {
      return true;
    }

    const { pos, size } = this.rectArea;

    return !(
      pos.x + size.x < 0 ||
      pos.x > Rhythia.gameWidth ||
      pos.y + size.y < 0 ||
      pos.y > Rhythia.gameHeight
    );
  }

  private shouldProcessFrame(): boolean {
    if (this.isPaused()) {
      return false;
    }

    const isCurrentlyVisible = this.isOnScreen();

    if (isCurrentlyVisible && !this.wasVisible) {
      this.onShow?.();
    } else if (!isCurrentlyVisible && this.wasVisible) {
      this.onHide?.();
    }

    this.wasVisible = isCurrentlyVisible;

    this.onOffscreenUpdate?.();

    return isCurrentlyVisible;
  }

  private handleRectInteraction(allowClicks: boolean): boolean {
    const rectArea = this.rectArea;

    if (!rectArea) {
      return false;
    }

    const mousePosition = this.getMousePosition();
    const isHovering = mousePosition
      ? this.isPointInRect(mousePosition)
      : false;

    if (isHovering && !this.wasHovering) {
      rectArea.onHoverStart?.();
    } else if (!isHovering && this.wasHovering) {
      rectArea.onHoverEnd?.();
    }

    this.wasHovering = isHovering;

    if (!allowClicks || !isHovering) {
      return false;
    }

    if (!IsMouseButtonPressed(0)) {
      return false;
    }

    const consumed = rectArea.onClick?.();
    return consumed === true;
  }

  public update(): boolean {
    if (!this.shouldProcessFrame()) {
      return false;
    }

    if (this.handleRectInteraction(true)) {
      return true;
    }

    this.onUpdate?.();

    return false;
  }

  public updateWithoutClicks(): void {
    if (!this.shouldProcessFrame()) {
      return;
    }

    this.handleRectInteraction(false);

    this.onUpdate?.();
  }

  public updateWithoutInput(): void {
    if (!this.shouldProcessFrame()) {
      return;
    }

    this.onUpdate?.();
  }

  public draw(): void {
    if (this.isPaused()) {
      return;
    }

    if (!this.isOnScreen()) {
      return;
    }

    this.onDraw?.();
  }

  public destroy(): void {
    const index = GameObject.objects.indexOf(this);
    if (index !== -1) {
      GameObject.objects.splice(index, 1);
    }
  }

  public static updateAll(): void {
    const activeObjects = GameObject.objects.filter((obj) => {
      return !(obj.sceneOwner && GameObject.pausedScenes.has(obj.sceneOwner));
    });

    const sortedObjects = [...activeObjects].sort((a, b) => b.zBase - a.zBase);

    const isPopupActive = Popup.isAnyPopupLoading();

    if (isPopupActive) {
      for (const obj of sortedObjects) {
        if (obj.zBase >= 5) {
          const clickConsumed = obj.update();
          if (clickConsumed) {
            const remainingObjects = sortedObjects.slice(
              sortedObjects.indexOf(obj) + 1,
            );
            for (const remainingObj of remainingObjects) {
              remainingObj.updateWithoutInput();
            }
            return;
          }
        } else {
          obj.updateWithoutInput();
        }
      }
      return;
    }

    for (const obj of sortedObjects) {
      const clickConsumed = obj.update();
      if (clickConsumed) {
        const remainingObjects = sortedObjects.slice(
          sortedObjects.indexOf(obj) + 1,
        );
        for (const remainingObj of remainingObjects) {
          remainingObj.updateWithoutClicks();
        }
        break;
      }
    }
  }

  public static drawAll(): void {
    const activeObjects = GameObject.objects.filter((obj) => {
      return !(obj.sceneOwner && GameObject.pausedScenes.has(obj.sceneOwner));
    });

    const sortedObjects = [...activeObjects].sort((a, b) => a.zBase - b.zBase);

    for (const obj of sortedObjects) {
      obj.draw();
    }
  }

  public static destroyAll(): void {
    GameObject.objects.length = 0;
  }

  public static getAll(): GameObject[] {
    return [...GameObject.objects];
  }

  public static getById(id: number): GameObject | undefined {
    return GameObject.objects.find((obj) => obj.id === id);
  }

  public static addObject(obj: GameObject): void {
    GameObject.objects.push(obj);
  }

  public static pauseScene(sceneId: string): void {
    if (GameObject.pausedScenes.has(sceneId)) {
      console.warn(`⚠️  Scene already paused: ${sceneId.split("_")[0]}`);
      return;
    }
    GameObject.pausedScenes.add(sceneId);
    const pausedCount = GameObject.objects.filter(
      (obj) => obj.sceneOwner === sceneId,
    ).length;
    logger(
      `⏸️  Scene paused: ${
        sceneId.split("_")[0]
      } (${pausedCount} objects preserved)`,
    );
  }

  public static resumeScene(sceneId: string): void {
    if (!GameObject.pausedScenes.has(sceneId)) {
      console.warn(`⚠️  Scene not paused: ${sceneId.split("_")[0]}`);
      return;
    }
    GameObject.pausedScenes.delete(sceneId);
    const resumedCount = GameObject.objects.filter(
      (obj) => obj.sceneOwner === sceneId,
    ).length;
    logger(
      `▶️  Scene resumed: ${
        sceneId.split("_")[0]
      } (${resumedCount} objects restored)`,
    );
  }

  public static isScenePaused(sceneId: string): boolean {
    return GameObject.pausedScenes.has(sceneId);
  }

  public static getObjectsByScene(sceneId: string): GameObject[] {
    return GameObject.objects.filter((obj) => obj.sceneOwner === sceneId);
  }

  public static destroyObjectsByScene(sceneId: string): void {
    const beforeCount = GameObject.objects.length;
    GameObject.objects = GameObject.objects.filter(
      (obj) => obj.sceneOwner !== sceneId,
    );
    const destroyedCount = beforeCount - GameObject.objects.length;
    if (destroyedCount > 0) {
      logger(
        `🗑️  Scene cleanup: ${
          sceneId.split("_")[0]
        } (${destroyedCount} objects destroyed)`,
      );
    }
  }

  public static getCurrentSceneId(): string | undefined {
    return Rhythia.currentScene?.sceneId;
  }
}

export function add(): GameObject {
  const obj = new GameObject();
  GameObject.addObject(obj);
  return obj;
}
