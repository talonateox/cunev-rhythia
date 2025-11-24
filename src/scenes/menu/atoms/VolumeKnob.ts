import {
  Vector2,
  Vector3,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  DrawCircleV,
  DrawRing,
  IsKeyDown,
  KEY_LEFT_SHIFT,
  KEY_RIGHT_SHIFT,
  GetMouseWheelMove,
  IsMouseButtonDown,
  IsMouseButtonPressed,
  MOUSE_BUTTON_LEFT,
  Fade,
  WHITE,
  RAYWHITE,
  KEY_LEFT_ALT,
  KEY_RIGHT_ALT,
  GetFrameTime,
} from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawText } from "../../../utils/text";
import { lerp, lerpDelta } from "../../../utils/lerp";
import { rgb, accentUIColor } from "../../../utils/colors";
import {
  setMasterVolume,
  setMusicVolume,
  setFxVolume,
  getVolumes,
} from "../../../utils/soundManager";
import { playFx } from "../../../utils/soundManager";
import { ConfigManager } from "../../../utils/configManager";
import { AccentColor } from "../../../utils/imageBlur";

type VolumeType = "master" | "music" | "fx";

export class VolumeKnob {
  private static instances: Map<VolumeType, VolumeKnob> = new Map();
  private gameObject: GameObject;
  private isShiftHeld: boolean = false;
  private arcOpacity: number = 0;
  private currentVolume: number = 1;
  private targetVolume: number = 1;
  private position: Vector2;
  private radius: number;
  private innerRadius: number;
  private hoverProgress: number = 0;
  private isHovered: boolean = false;
  private lastScrollSound: number = 0;
  private volumeType: VolumeType;
  private label: string;
  private accentColor: AccentColor | null = null;
  private entryProgress: number = 0;
  private entryTime: number = 0;
  private entryDelay: number = 0;
  private shouldAnimate: boolean = false;
  private isExiting: boolean = false;
  private exitProgress: number = 0;
  private exitStartPosition: number = 0;
  private slideDirection: "left" | "right" = "left";
  private isDragging: boolean = false;
  private lastMouseY: number = 0;

  constructor(
    position: Vector2,
    volumeType: VolumeType = "master",
    size: "large" | "small" = "large",
    slideDirection: "left" | "right" = "left"
  ) {
    this.position = position;
    this.volumeType = volumeType;
    this.slideDirection = slideDirection;
    this.gameObject = new GameObject();

    if (size === "large") {
      this.radius = 80;
      this.innerRadius = 60;
    } else {
      this.radius = 50;
      this.innerRadius = 35;
    }

    this.label =
      volumeType === "master"
        ? "Master"
        : volumeType === "music"
        ? "Music"
        : "FX";

    this.entryDelay = 0;

    VolumeKnob.instances.set(volumeType, this);
    this.initialize();
  }

  private initialize(): void {
    const volumes = getVolumes();
    this.currentVolume =
      this.volumeType === "master"
        ? volumes.master
        : this.volumeType === "music"
        ? volumes.music
        : volumes.fx;
    this.targetVolume = this.currentVolume;

    this.gameObject.attachRect({
      pos: {
        x: this.position.x - this.radius,
        y: this.position.y - this.radius,
      },
      size: { x: this.radius * 2, y: this.radius * 2 },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.gameObject.onUpdate = () => this.update();

    this.gameObject.onDraw = () => this.draw();

    this.gameObject.rectArea!.onHoverStart = () => this.onHoverStart();
    this.gameObject.rectArea!.onHoverEnd = () => this.onHoverEnd();
  }

  private update(): void {
    const shiftPressed = IsKeyDown(KEY_LEFT_ALT) || IsKeyDown(KEY_RIGHT_ALT);

    if (shiftPressed !== this.isShiftHeld) {
      this.isShiftHeld = shiftPressed;

      if (shiftPressed) {
        this.shouldAnimate = true;
        this.isExiting = false;
        this.entryTime = 0; 
        this.entryProgress = 0; 
        this.exitProgress = 0; 

        if (this.isNearMouse()) {
          playFx("/click.wav", 0.1);
        }
      } else {
        if (this.shouldAnimate && !this.isExiting && this.entryProgress > 0) {
          this.isExiting = true;
          this.exitProgress = 0;

          const slideMultiplier = this.slideDirection === "left" ? -1 : 1;
          this.exitStartPosition =
            500 * slideMultiplier * (1 - this.entryProgress);
        }
      }
    }

    
    const vols = getVolumes();
    const externalVolume =
      this.volumeType === "master"
        ? vols.master
        : this.volumeType === "music"
        ? vols.music
        : vols.fx;

    const isAdjusting =
      this.isShiftHeld &&
      (this.volumeType === "master" ? true : this.isNearMouse());
    if (!isAdjusting) {
      this.targetVolume = externalVolume;
    }

    const anyNonMasterNear = VolumeKnob.anyNonMasterNearMouse();
    const canAdjustByWheel =
      this.isShiftHeld &&
      (this.volumeType === "master" ? !anyNonMasterNear : this.isNearMouse());
    if (canAdjustByWheel) {
      const wheelMove = GetMouseWheelMove();
      if (wheelMove !== 0) {
        this.targetVolume = Math.max(
          0,
          Math.min(1, this.targetVolume + wheelMove * 0.05)
        );

        if (this.volumeType === "master") {
          setMasterVolume(this.targetVolume);
          ConfigManager.setMasterVolume(this.targetVolume);
        } else if (this.volumeType === "music") {
          setMusicVolume(this.targetVolume);
          ConfigManager.setVolumes(undefined, this.targetVolume, undefined);
        } else {
          setFxVolume(this.targetVolume);
          ConfigManager.setVolumes(undefined, undefined, this.targetVolume);
        }

        const now = Date.now();
        if (now - this.lastScrollSound > 50) {
          playFx("/click.wav", 0.15);
          this.lastScrollSound = now;
        }
      }
    }

    
    const canStartDrag = this.isShiftHeld && this.isNearMouse();
    if (!this.isDragging && canStartDrag && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
      const mousePos = this.gameObject.getMousePosition();
      if (mousePos) {
        this.isDragging = true;
        this.lastMouseY = mousePos.y;
      }
    }

    if (this.isDragging) {
      if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
        const mousePos = this.gameObject.getMousePosition();
        if (mousePos) {
          const deltaY = this.lastMouseY - mousePos.y; 
          const dragSensitivity = 0.004; 
          if (Math.abs(deltaY) > 0) {
            this.targetVolume = Math.max(
              0,
              Math.min(1, this.targetVolume + deltaY * dragSensitivity)
            );

            if (this.volumeType === "master") {
              setMasterVolume(this.targetVolume);
              ConfigManager.setMasterVolume(this.targetVolume);
            } else if (this.volumeType === "music") {
              setMusicVolume(this.targetVolume);
              ConfigManager.setVolumes(undefined, this.targetVolume, undefined);
            } else {
              setFxVolume(this.targetVolume);
              ConfigManager.setVolumes(undefined, undefined, this.targetVolume);
            }

            const now = Date.now();
            if (now - this.lastScrollSound > 50) {
              playFx("/click.wav", 0.12);
              this.lastScrollSound = now;
            }
          }
          this.lastMouseY = mousePos.y;
        }
      } else {
        
        this.isDragging = false;
      }
    }

    this.currentVolume = lerpDelta(this.currentVolume, this.targetVolume, 0.2);

    if (this.isShiftHeld && this.isNearMouse()) {
      this.arcOpacity = lerpDelta(this.arcOpacity, 1, 0.25);
    } else {
      this.arcOpacity = lerpDelta(this.arcOpacity, 0, 0.15);
    }

    if (this.isHovered) {
      this.hoverProgress = lerpDelta(this.hoverProgress, 1, 0.2);
    } else {
      this.hoverProgress = lerpDelta(this.hoverProgress, 0, 0.2);
    }

    if (this.shouldAnimate) {
      if (this.isExiting) {
        const exitSpeed = 5.0; 
        this.exitProgress = Math.min(
          1,
          this.exitProgress + GetFrameTime() * exitSpeed
        );

        if (this.exitProgress >= 1) {
          this.shouldAnimate = false;
          this.isExiting = false;
          this.entryProgress = 0;
          this.exitProgress = 0;
        }
      } else {
        this.entryTime += GetFrameTime();

        if (this.entryTime >= this.entryDelay) {
          const animationSpeed = 4.0; 
          const targetProgress = Math.min(
            1,
            (this.entryTime - this.entryDelay) * animationSpeed
          );

          const easedProgress = 1 - Math.pow(1 - targetProgress, 3);
          this.entryProgress = easedProgress;
        }
      }
    }
  }

  private isNearMouse(): boolean {
    const mousePos = this.gameObject.getMousePosition();
    if (!mousePos) return false;

    const distance = Math.sqrt(
      Math.pow(mousePos.x - this.position.x, 2) +
        Math.pow(mousePos.y - this.position.y, 2)
    );

    return distance < this.radius;
  }

  private draw(): void {
    if (!this.shouldAnimate) {
      return;
    }

    if (
      !this.isExiting &&
      this.entryProgress === 0 &&
      this.entryTime < this.entryDelay
    ) {
      return;
    }

    rlPushMatrix();

    let positionOffset = 0;
    const slideDistance = 500;
    const slideMultiplier = this.slideDirection === "left" ? -1 : 1;

    if (this.isExiting) {
      const easedExitProgress = Math.pow(this.exitProgress, 3);
      const exitTarget = slideDistance * slideMultiplier;

      positionOffset =
        this.exitStartPosition +
        (exitTarget - this.exitStartPosition) * easedExitProgress;
    } else {
      positionOffset =
        slideDistance * slideMultiplier * (1 - this.entryProgress);
    }

    rlTranslatef(this.position.x + positionOffset, this.position.y, 0);

    this.drawVolumeArc();

    let baseOpacity = 1;
    if (this.isShiftHeld) {
      baseOpacity = 1; 
    } else if (this.shouldAnimate) {
      baseOpacity = 0.8; 
    } else {
      baseOpacity = this.arcOpacity; 
    }

    const opacity =
      baseOpacity *
      (this.isExiting ? 1 - this.exitProgress : this.entryProgress);
    const percentage = Math.round(this.currentVolume * 100);
    const textSize =
      this.radius > 60
        ? 32 + this.hoverProgress * 4
        : 24 + this.hoverProgress * 2;

    drawText(
      `${percentage}%`,
      Vector2(0, -textSize / 2),
      textSize,
      Fade(WHITE, opacity * 0.9),
      "center"
    );

    const labelSize = this.radius > 60 ? 16 : 12;
    const labelY = textSize / 2 + 6; 

    drawText(
      this.label,
      Vector2(0, labelY - labelSize / 2),
      labelSize,
      Fade(WHITE, opacity * 0.6),
      "center"
    );

    rlPopMatrix();
  }

  private drawVolumeArc(): void {
    const startAngle = -90; 
    const endAngle = startAngle + this.currentVolume * 360;

    let baseOpacity = 1;
    if (this.isShiftHeld) {
      baseOpacity = 1; 
    } else if (this.shouldAnimate) {
      baseOpacity = 0.8; 
    } else {
      baseOpacity = this.arcOpacity; 
    }

    const opacity =
      baseOpacity *
      (this.isExiting ? 1 - this.exitProgress : this.entryProgress);

    DrawRing(
      Vector2(0, 0),
      this.innerRadius,
      this.radius,
      0,
      360,
      36,
      Fade(rgb(0.2, 0.2, 0.2, 1), opacity * 0.3)
    );

    if (this.currentVolume > 0) {
      let color;
      if (this.accentColor) {
        const baseIntensity = 0.6 + this.currentVolume * 0.4; 
        color = accentUIColor(this.accentColor, baseIntensity, 0.3);
      } else {
        if (this.currentVolume > 0.8) {
          color = rgb(1, 0.3, 0.3, 1); 
        } else if (this.currentVolume > 0.5) {
          color = rgb(1, 0.8, 0.3, 1); 
        } else {
          color = rgb(0.3, 1, 0.5, 1); 
        }
      }

      DrawRing(
        Vector2(0, 0),
        this.innerRadius,
        this.radius,
        startAngle,
        endAngle,
        36,
        Fade(color, opacity * 0.9)
      );
    }
  }

  private onHoverStart(): void {
    this.isHovered = true;
  }

  private onHoverEnd(): void {
    this.isHovered = false;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public setPosition(position: Vector2): void {
    this.position = position;
    this.gameObject.rectArea!.pos = {
      x: position.x - this.radius,
      y: position.y - this.radius,
    };
  }

  public static isActive(): boolean {
    if (IsKeyDown(KEY_LEFT_ALT) || IsKeyDown(KEY_RIGHT_ALT)) {
      return true;
    }
    for (const [_, knob] of VolumeKnob.instances) {
      if (knob.isShiftHeld && knob.isNearMouse()) {
        return true;
      }
    }
    return false;
  }

  public isAdjusting(): boolean {
    return (
      this.isShiftHeld &&
      (this.volumeType === "master" ? true : this.isNearMouse())
    );
  }

  public destroy(): void {
    VolumeKnob.instances.delete(this.volumeType);
  }

  public static anyNonMasterNearMouse(): boolean {
    for (const [type, knob] of VolumeKnob.instances) {
      if (type !== "master" && knob.isNearMouse()) return true;
    }
    return false;
  }
}

export function createVolumeKnob(
  position: Vector2,
  volumeType: VolumeType = "master",
  size: "large" | "small" = "large",
  slideDirection: "left" | "right" = "left"
): GameObject {
  const volumeKnob = new VolumeKnob(position, volumeType, size, slideDirection);
  return volumeKnob.getGameObject();
}
