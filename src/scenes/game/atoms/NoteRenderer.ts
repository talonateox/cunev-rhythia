import { rlTranslatef, rlPushMatrix, rlPopMatrix, Vector3 } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { noteColorManager } from "../../../utils/noteColorPalette";
import { NoteHitResult } from "./NoteHitDetector";

export interface NoteRenderConfig {
  squareScale: number;
  noteMaxOpacity: number;
}

export interface NoteRenderer {
  renderNote(
    note: [number, number, number],
    msTime: number,
    approachRate: number,
    approachDistance: number,
    fadeIn: number,
    fadeOut: boolean,
    pushback: boolean,
    speed: number,
    hitResult: NoteHitResult,
    noteIndex?: number
  ): void;

  updateConfig(config: Partial<NoteRenderConfig>): void;
}

export interface NoteRenderState {
  depth: number;
  alpha: number;
  size: number;
  position: Vector3;
  color: { r: number; g: number; b: number };
}

export abstract class BaseNoteRenderer implements NoteRenderer {
  protected config: NoteRenderConfig;

  protected constructor(config: NoteRenderConfig) {
    this.config = { ...config };
  }

  public renderNote(
    note: [number, number, number],
    msTime: number,
    approachRate: number,
    approachDistance: number,
    fadeIn: number,
    fadeOut: boolean,
    pushback: boolean,
    speed: number,
    hitResult: NoteHitResult,
    noteIndex: number = 0
  ): void {
    const state = this.getRenderState(
      note,
      msTime,
      approachRate,
      approachDistance,
      fadeIn,
      fadeOut,
      pushback,
      speed,
      hitResult,
      noteIndex
    );

    if (!state || state.alpha <= 0) {
      return;
    }

    this.drawNote(state);
  }

  public updateConfig(config: Partial<NoteRenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  protected abstract drawNote(state: NoteRenderState): void;

  protected getNoteSize(): number {
    return 100 * this.config.squareScale;
  }

  protected getNotePosition(note: [number, number, number], depth: number): Vector3 {
    const planeX = note[1] - 1;
    const planeY = note[2] - 1;
    const planeZ = depth * 100;

    return Vector3(
      Rhythia.gameWidth / 2 + planeX * 100,
      Rhythia.gameHeight / 2 + planeY * 100,
      planeZ
    );
  }

  protected applyTransform(position: Vector3): void {
    rlPushMatrix();
    rlTranslatef(position.x, position.y, position.z);
  }

  protected removeTransform(): void {
    rlPopMatrix();
  }

  private getRenderState(
    note: [number, number, number],
    msTime: number,
    approachRate: number,
    approachDistance: number,
    fadeIn: number,
    fadeOut: boolean,
    pushback: boolean,
    speed: number,
    hitResult: NoteHitResult,
    noteIndex: number
  ): NoteRenderState | null {
    const approachTime = approachDistance / approachRate;
    const depth =
      (((note[0] - msTime) / (1000 * approachTime)) * approachDistance) / speed;

    let alpha = Math.max(
      0,
      Math.min(1, (1 - depth / approachDistance) / (fadeIn / 100))
    );

    if (fadeOut) {
      if (depth <= 0) {
        const fadeProgress = Math.abs(depth) / (approachDistance * 0.05);
        alpha = alpha * Math.max(0, 1 - Math.pow(fadeProgress, 0.5));
      } else if (depth < approachDistance * 0.2) {
        const fadeProgress =
          (approachDistance * 0.2 - depth) / (approachDistance * 0.2);
        alpha = alpha * (1 - fadeProgress * 0.1);
      }
    }

    if (!pushback && note[0] - msTime <= 0) {
      alpha = 0;
    }

    alpha = Math.min(1, Math.max(0, alpha));

    if (hitResult.missed) {
      alpha = alpha * hitResult.opacity;
    }

    
    const maxOpacity = Math.min(1, Math.max(0, this.config.noteMaxOpacity ?? 1.0));
    alpha = Math.min(alpha, maxOpacity);

    if (alpha <= 0) {
      return null;
    }

    const size = this.getNoteSize();
    const position = this.getNotePosition(note, depth);
    const color = noteColorManager.getColorForNoteIndex(noteIndex);

    return {
      depth,
      alpha,
      size,
      position,
      color,
    };
  }
}
