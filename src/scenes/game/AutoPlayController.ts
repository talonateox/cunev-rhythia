import { Vector2 } from "raylib";
import { Rhythia } from "../../atoms/Rhythia";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import type { GameSettings } from "../../utils/gameSettingsSchema";
import { state as runtimeState } from "../../atoms/sysutils/state";

export class AutoPlayController {
  private notes: [number, number, number][] = [];
  private smoothedCursorX: number = 0.5;
  private smoothedCursorY: number = 0.5;
  private lastUpdateTime: number = 0;
  private lastIndex: number = 0;

  constructor(mapData?: SoundSpaceMemoryMap | null) {
    if (mapData) {
      this.setMapData(mapData);
    }
  }

  public setMapData(mapData: SoundSpaceMemoryMap | null): void {
    if (!mapData?.notes || mapData.notes.length === 0) {
      this.notes = [];
      this.reset();
      return;
    }

    const firstNoteTime = mapData.notes[0][0];
    const virtualCenterNote: [number, number, number] = [
      firstNoteTime - 2000,
      0.5,
      0.5,
    ];

    this.notes = [virtualCenterNote, ...mapData.notes];
    this.reset();
  }

  public reset(): void {
    this.smoothedCursorX = 0.5;
    this.smoothedCursorY = 0.5;
    this.lastUpdateTime = 0;
    this.lastIndex = 0;
  }

  public getCursorScreenPosition(
    currentTime: number,
    settings: Partial<GameSettings>
  ): Vector2 | null {
    if (this.notes.length === 0) {
      return null;
    }

    this.updateCursor(currentTime);

    const playfieldDistance = settings.playfieldDistance ?? 300;
    const userScale = settings.playfieldScale ?? 1.0;
    const playfieldScale = (300 / playfieldDistance) * userScale;
    const scaledOffset = 100 * playfieldScale;

    const gameX = Rhythia.gameWidth / 2 + (this.smoothedCursorX - 1) * scaledOffset;
    const gameY = Rhythia.gameHeight / 2 + (this.smoothedCursorY - 1) * scaledOffset;

    const vp = runtimeState.presentationViewport;
    const screenX = vp.x + (gameX / Rhythia.gameWidth) * vp.width;
    const screenY = vp.y + (gameY / Rhythia.gameHeight) * vp.height;

    return Vector2(screenX, screenY);
  }

  private updateCursor(currentTime: number): void {
    const notes = this.notes;
    const lastIndex = notes.length - 1;

    if (currentTime <= notes[0][0]) {
      this.smoothedCursorX = 0.5;
      this.smoothedCursorY = 0.5;
      this.lastIndex = 0;
      this.lastUpdateTime = currentTime;
      return;
    }

    if (currentTime >= notes[lastIndex][0]) {
      const lastNote = notes[lastIndex];
      this.smoothedCursorX = lastNote[1];
      this.smoothedCursorY = lastNote[2];
      this.lastIndex = lastIndex - 1;
      this.lastUpdateTime = currentTime;
      return;
    }

    let currentIndex = this.lastIndex;
    if (currentTime >= notes[currentIndex + 1][0]) {
      while (
        currentIndex < notes.length - 2 &&
        currentTime >= notes[currentIndex + 1][0]
      ) {
        currentIndex++;
      }
    } else {
      while (currentIndex > 0 && currentTime < notes[currentIndex][0]) {
        currentIndex--;
      }
    }

    this.lastIndex = currentIndex;

    const nextIndex = Math.min(currentIndex + 1, notes.length - 1);
    const currentNote = notes[currentIndex];
    const nextNote = notes[nextIndex];

    const timeBetween = Math.max(1, nextNote[0] - currentNote[0]);
    const timeProgress = (currentTime - currentNote[0]) / timeBetween;
    const clampedProgress = Math.max(0, Math.min(1, timeProgress));

    const splinePos = this.catmullRomSpline(notes, currentIndex, clampedProgress);

    const deltaTime =
      this.lastUpdateTime > 0
        ? Math.min(currentTime - this.lastUpdateTime, 100)
        : 16;
    this.lastUpdateTime = currentTime;

    const baseSmoothingFactor = 0.82;
    const distance = Math.hypot(
      splinePos.x - this.smoothedCursorX,
      splinePos.y - this.smoothedCursorY
    );
    const adaptiveSmoothing =
      distance > 0.35 ? baseSmoothingFactor * 0.6 : baseSmoothingFactor;
    const frameBlend = 1 - Math.pow(adaptiveSmoothing, deltaTime / 16);

    this.smoothedCursorX += (splinePos.x - this.smoothedCursorX) * frameBlend;
    this.smoothedCursorY += (splinePos.y - this.smoothedCursorY) * frameBlend;
  }

  private catmullRomSpline(
    notes: [number, number, number][],
    index: number,
    t: number
  ): { x: number; y: number } {
    const getPoint = (i: number) => {
      if (i < 0) return { x: notes[0][1], y: notes[0][2] };
      if (i >= notes.length)
        return { x: notes[notes.length - 1][1], y: notes[notes.length - 1][2] };
      return { x: notes[i][1], y: notes[i][2] };
    };

    const p0 = getPoint(index - 1);
    const p1 = getPoint(index);
    const p2 = getPoint(index + 1);
    const p3 = getPoint(index + 2);

    const t2 = t * t;
    const t3 = t2 * t;

    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    return { x, y };
  }
}
