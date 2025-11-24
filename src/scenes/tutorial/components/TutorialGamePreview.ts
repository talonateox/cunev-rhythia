import { Vector2, rlPushMatrix, rlPopMatrix } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { GameScene } from "../../game";
import { SoundSpaceMemoryMap } from "../../../utils/storageUtils.ts/ssmm";
import { getMusicTime } from "../../../utils/soundManager";
import { lerpDelta, lerp } from "../../../utils/lerp";
import type { GameSettings } from "../../../utils/gameSettingsSchema";
import { state as runtimeState } from "../../../atoms/sysutils/state";

export interface TutorialGamePreviewConfig {
  mapData: SoundSpaceMemoryMap | null;
  settings?: GameSettings;
}

export class TutorialGamePreview {
  private config: TutorialGamePreviewConfig;
  private tempGameScene: GameScene | null = null;
  private currentTime: number = 0;
  private previewStartTime: number = 0;
  private tutorialCursorX: number = 0.5; 
  private tutorialCursorY: number = 0.5; 
  private lastMusicTimestamp: number | null = null;

  constructor(config: TutorialGamePreviewConfig) {
    this.config = { ...config };
    if (config.mapData) {
      this.tempGameScene = new GameScene(config.mapData, false);
      this.tempGameScene.enablePreviewMode();
      this.tempGameScene.init();
      this.previewStartTime = Date.now();
    }
  }

  public updateSettings(settings: GameSettings): void {
    this.config.settings = settings;
  }

  public render(): void {
    if (!this.config.mapData || !this.tempGameScene) return;

    rlPushMatrix();

    this.currentTime = getMusicTime() * 1000; 

    this.handleMusicLoop(this.currentTime);

    this.updateTutorialCursor();

    const transformedX = this.tutorialCursorX - 1; 
    const transformedY = this.tutorialCursorY - 1; 

    const gameX = Rhythia.gameWidth / 2 + transformedX * 100;
    const gameY = Rhythia.gameHeight / 2 + transformedY * 100;

    const vp = runtimeState.presentationViewport;
    const screenX = vp.x + (gameX / Rhythia.gameWidth) * vp.width;
    const screenY = vp.y + (gameY / Rhythia.gameHeight) * vp.height;

    this.tempGameScene.renderGameAt(
      this.currentTime,
      Vector2(screenX, screenY),
      this.config.settings
    );

    rlPopMatrix();
  }

  private updateTutorialCursor(): void {
    if (!this.config.mapData || !this.config.mapData.notes) return;

    const originalNotes = this.config.mapData.notes;
    const currentTime = this.currentTime;

    const virtualCenterNote: [number, number, number] = [
      originalNotes[0][0] - 2000, 
      0.5, 
      0.5, 
    ];
    const notes = [virtualCenterNote, ...originalNotes];

    let currentNoteIndex = 0;
    let nextNoteIndex = 1;

    for (let i = 0; i < notes.length - 1; i++) {
      if (currentTime >= notes[i][0] && currentTime < notes[i + 1][0]) {
        currentNoteIndex = i;
        nextNoteIndex = i + 1;
        break;
      }
    }

    if (currentTime < notes[0][0]) {
      this.tutorialCursorX = 0.5;
      this.tutorialCursorY = 0.5;
      return;
    }

    if (currentTime >= notes[notes.length - 1][0]) {
      const lastNote = notes[notes.length - 1];
      this.tutorialCursorX = lastNote[1];
      this.tutorialCursorY = lastNote[2];
      return;
    }

    const currentNote = notes[currentNoteIndex];
    const nextNote = notes[nextNoteIndex];

    const timeBetween = nextNote[0] - currentNote[0];
    const timeProgress = (currentTime - currentNote[0]) / timeBetween;

    const progress = Math.max(0, Math.min(1, timeProgress));

    const splinePos = this.catmullRomSpline(notes, currentNoteIndex, progress);
    this.tutorialCursorX = splinePos.x;
    this.tutorialCursorY = splinePos.y;
  }

  public destroy(): void {
    if (this.tempGameScene) {
      this.tempGameScene.destroy();
      this.tempGameScene = null;
    }
    this.lastMusicTimestamp = null;
  }

  public restart(): void {
    this.previewStartTime = Date.now();
    this.currentTime = 0;
    this.tutorialCursorX = 0.5;
    this.tutorialCursorY = 0.5;
  }

  private handleMusicLoop(currentMsTime: number): void {
    if (!this.tempGameScene) {
      this.lastMusicTimestamp = currentMsTime;
      return;
    }

    if (
      this.lastMusicTimestamp !== null &&
      currentMsTime + 5 < this.lastMusicTimestamp &&
      this.lastMusicTimestamp - currentMsTime > 100 &&
      this.lastMusicTimestamp > 500
    ) {
      this.tempGameScene.resetPreviewLoop();
      this.previewStartTime = Date.now();
    }

    this.lastMusicTimestamp = currentMsTime;
  }

  private catmullRomSpline(
    notes: [number, number, number][],
    currentIndex: number,
    t: number
  ): { x: number; y: number } {
    const getPoint = (index: number) => {
      if (index < 0) return { x: notes[0][1], y: notes[0][2] };
      if (index >= notes.length)
        return { x: notes[notes.length - 1][1], y: notes[notes.length - 1][2] };
      return { x: notes[index][1], y: notes[index][2] };
    };

    const p0 = getPoint(currentIndex - 1);
    const p1 = getPoint(currentIndex);
    const p2 = getPoint(currentIndex + 1);
    const p3 = getPoint(currentIndex + 2);

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
