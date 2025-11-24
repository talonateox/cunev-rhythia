import { Vector2, Color, GetMousePosition } from "raylib";
import { drawSprite } from "../../utils/sprite";
import { Rhythia } from "../../atoms/Rhythia";
import { createTween, easings } from "../../utils/tween";
import { screenToGame } from "../../atoms/sysutils/rendering";

interface PracticeNote {
  x: number;
  y: number;
  time: number;
  hit: boolean;
}

export class TutorialPractice {
  private notes: PracticeNote[] = [];
  private currentTime: number = 0;
  private score: number = 0;
  private totalNotes: number = 5;
  private noteSize: number = 50;
  private trackWidth: number = 400;
  private trackHeight: number = 300;
  private isActive: boolean = false;
  private opacity: number = 0;
  private mouseTrail: { x: number; y: number; time: number }[] = [];

  public start(): void {
    this.isActive = true;
    this.currentTime = 0;
    this.score = 0;
    this.notes = [];
    this.mouseTrail = [];

    for (let i = 0; i < this.totalNotes; i++) {
      this.notes.push({
        x: Math.random() * (this.trackWidth - this.noteSize),
        y: Math.random() * (this.trackHeight - this.noteSize),
        time: (i + 1) * 2000, 
        hit: false,
      });
    }

    createTween(
      "practiceOpacity",
      0,
      0.8,
      0.5,
      (value) => {
        this.opacity = value;
      },
      easings.easeOutQuad
    );
  }

  public update(deltaTime: number): void {
    if (!this.isActive) return;

    this.currentTime += deltaTime;

    const screenMouse = GetMousePosition();
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;
    const trackX = centerX - this.trackWidth / 2;
    const trackY = centerY - this.trackHeight / 2;

    const mapped = screenToGame(screenMouse.x, screenMouse.y);
    const gameMouseX = mapped ? mapped.x : -Infinity;
    const gameMouseY = mapped ? mapped.y : -Infinity;

    const relativeX = gameMouseX - trackX;
    const relativeY = gameMouseY - trackY;

    this.mouseTrail.push({
      x: relativeX,
      y: relativeY,
      time: this.currentTime,
    });

    this.mouseTrail = this.mouseTrail.filter(
      (point) => this.currentTime - point.time < 500
    );

    for (const note of this.notes) {
      if (!note.hit && Math.abs(note.time - this.currentTime) < 1000) {
        const distance = Math.sqrt(
          Math.pow(relativeX - note.x - this.noteSize / 2, 2) +
            Math.pow(relativeY - note.y - this.noteSize / 2, 2)
        );

        if (distance < this.noteSize) {
          note.hit = true;
          this.score++;
        }
      }
    }
  }

  public render(): void {
    if (!this.isActive || this.opacity <= 0) return;

    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;
    const trackX = centerX - this.trackWidth / 2;
    const trackY = centerY - this.trackHeight / 2;

    drawSprite(
      "/solid.png",
      Vector2(trackX, trackY),
      Vector2(this.trackWidth, this.trackHeight),
      { r: 30, g: 30, b: 40, a: 200 * this.opacity }
    );

    const borderThickness = 2;
    const borderColor: Color = {
      r: 100,
      g: 100,
      b: 150,
      a: 255 * this.opacity,
    };

    drawSprite(
      "/solid.png",
      Vector2(trackX, trackY),
      Vector2(this.trackWidth, borderThickness),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(trackX, trackY + this.trackHeight - borderThickness),
      Vector2(this.trackWidth, borderThickness),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(trackX, trackY),
      Vector2(borderThickness, this.trackHeight),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(trackX + this.trackWidth - borderThickness, trackY),
      Vector2(borderThickness, this.trackHeight),
      borderColor
    );

    for (let i = 0; i < this.mouseTrail.length - 1; i++) {
      const point = this.mouseTrail[i];
      const age = this.currentTime - point.time;
      const trailOpacity = (1 - age / 500) * this.opacity;

      drawSprite(
        "/solid.png",
        Vector2(trackX + point.x - 2, trackY + point.y - 2),
        Vector2(4, 4),
        { r: 100, g: 200, b: 255, a: 100 * trailOpacity }
      );
    }

    for (const note of this.notes) {
      const timeDiff = note.time - this.currentTime;

      if (timeDiff > -500 && timeDiff < 2000) {
        let noteOpacity = 1;
        let noteScale = 1;

        if (timeDiff > 0) {
          noteOpacity = Math.max(0, 1 - timeDiff / 2000);
          noteScale = 0.5 + 0.5 * (1 - timeDiff / 2000);
        } else if (note.hit) {
          noteOpacity = Math.max(0, 1 + timeDiff / 500);
          noteScale = 1 + Math.abs(timeDiff) / 1000;
        } else {
          noteOpacity = Math.max(0, 1 + timeDiff / 500);
        }

        const noteColor: Color = note.hit
          ? { r: 100, g: 255, b: 100, a: 255 * noteOpacity * this.opacity }
          : { r: 255, g: 100, b: 100, a: 255 * noteOpacity * this.opacity };

        const scaledSize = this.noteSize * noteScale;
        const offsetX = (this.noteSize - scaledSize) / 2;
        const offsetY = (this.noteSize - scaledSize) / 2;

        drawSprite(
          "/note.png",
          Vector2(trackX + note.x + offsetX, trackY + note.y + offsetY),
          Vector2(scaledSize, scaledSize),
          noteColor
        );
      }
    }
  }

  public isComplete(): boolean {
    const lastNote = this.notes[this.notes.length - 1];
    return this.currentTime > lastNote.time + 1000;
  }

  public getScore(): number {
    return this.score;
  }

  public getTotalNotes(): number {
    return this.totalNotes;
  }

  public stop(): void {
    this.isActive = false;

    createTween(
      "practiceOpacityOut",
      this.opacity,
      0,
      0.3,
      (value) => {
        this.opacity = value;
      },
      easings.easeInQuad
    );
  }
}
