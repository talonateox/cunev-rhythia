import { Vector2 } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { playFx } from "../../../utils/soundManager";
import { ModeManager } from "../modes";

export interface NoteHitResult {
  hit: boolean;
  missed: boolean;
  opacity: number;
  newlyHit?: boolean; 
  newlyMissed?: boolean; 
}

export class NoteHitDetector {
  private hitNotes: Set<number> = new Set();
  private missedNotes: Map<number, number> = new Map();
  private scheduledHitSounds: Map<number, number> = new Map(); 
  private baseHitWindowMs: number = 55;
  private fadeOutDuration: number = 400; 
  private lastDebugInfo: string = "";
  private combo: number = 0;
  public cursorHitBox = 15;

  public checkNoteHit(
    note: [number, number, number],
    noteIndex: number,
    msTime: number,
    cursorGameX: number,
    cursorGameY: number,
    _squareScale: number = 1.0,
    hitboxScale: number = 1.0,
    playfieldUserScale: number = 1.0
  ): NoteHitResult {
    if (this.hitNotes.has(noteIndex)) {
      return { hit: true, missed: false, opacity: 0.3, newlyHit: false };
    }

    const timeDiff = msTime - note[0];
    const pitch = Math.max(0.001, ModeManager.getMode().musicPitch ?? 1.0);
    const hitThreshold = this.baseHitWindowMs * pitch;

    if (timeDiff >= 0 && timeDiff <= hitThreshold) {
      const noteX = Rhythia.gameWidth / 2 + (note[1] - 1) * 100;
      const noteY = Rhythia.gameHeight / 2 + (note[2] - 1) * 100;

      const noteHalfSize = 50 * (hitboxScale ?? 1.0); 

      const isHit =
        cursorGameX + this.cursorHitBox >= noteX - noteHalfSize &&
        cursorGameX - this.cursorHitBox <= noteX + noteHalfSize &&
        cursorGameY + this.cursorHitBox >= noteY - noteHalfSize &&
        cursorGameY - this.cursorHitBox <= noteY + noteHalfSize;

      this.lastDebugInfo = `Note ${noteIndex}: timeDiff=${timeDiff.toFixed(
        1
      )}ms, hit=${isHit}`;

      if (isHit) {
        this.hitNotes.add(noteIndex);
        this.combo++;

        this.scheduledHitSounds.set(noteIndex, note[0]);
        return { hit: true, missed: false, opacity: 0.3, newlyHit: true };
      }
    }

    if (timeDiff > hitThreshold) {
      const wasAlreadyMissed = this.missedNotes.has(noteIndex);
      if (!wasAlreadyMissed) {
        this.missedNotes.set(noteIndex, msTime);
        this.combo = 0; 
      }

      const missedStartTime = this.missedNotes.get(noteIndex)!;
      const timeSinceMissed = msTime - missedStartTime;
      const missProgress = timeSinceMissed / this.fadeOutDuration;

      if (missProgress >= 1) {
        return {
          hit: false,
          missed: true,
          opacity: 0,
          newlyHit: false,
          newlyMissed: false,
        };
      }

      return {
        hit: false,
        missed: true,
        opacity: 1 - missProgress,
        newlyHit: false,
        newlyMissed: !wasAlreadyMissed, 
      };
    }

    return {
      hit: false,
      missed: false,
      opacity: 1,
      newlyHit: false,
      newlyMissed: false,
    };
  }

  public reset(): void {
    this.hitNotes.clear();
    this.missedNotes.clear();
    this.scheduledHitSounds.clear();
    this.combo = 0;
  }

  public getHitCount(): number {
    return this.hitNotes.size;
  }

  public getMissedCount(): number {
    return this.missedNotes.size;
  }

  public getDebugInfo(): string {
    return this.lastDebugInfo;
  }

  public isNoteHit(noteIndex: number): boolean {
    return this.hitNotes.has(noteIndex);
  }

  public getHitThreshold(): number {
    const pitch = Math.max(0.001, ModeManager.getMode().musicPitch ?? 1.0);
    return this.baseHitWindowMs * pitch;
  }

  public getCombo(): number {
    return this.combo;
  }

  public checkAndPlayScheduledSounds(currentTime: number): void {
    for (const [noteIndex, noteTime] of this.scheduledHitSounds.entries()) {
      if (currentTime >= noteTime) {
        playFx("/hit.wav");
        this.scheduledHitSounds.delete(noteIndex);
      }
    }
  }
}
