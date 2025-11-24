import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
  GetTime,
} from "raylib";
import { drawSprite } from "../../../../utils/sprite";
import { drawText } from "../../../../utils/text";
import { lerpDelta } from "../../../../utils/lerp";
import { SoundSpaceMemoryMap } from "../../../../utils/storage/ssmm";

export class AlbumArt {
  private currentMap: SoundSpaceMemoryMap | null = null;
  private currentMapImage: string | null = null;
  private albumArtScale: number = 0;
  private rotationAngle: number = 0;
  private readonly albumArtSize: number = 350;
  private albumArtHovered: boolean = false;
  private albumArtHoverScale: number = 1;
  private fadeProgress: number = 0;

  public setCurrentMap(map: SoundSpaceMemoryMap | null): void {
    if (map !== this.currentMap) {
      this.currentMap = map;
      if (map?.id) {
        this.currentMapImage = map.onlineImage;
      } else {
        this.currentMapImage = null;
      }
      this.albumArtScale = 0;
    }
  }

  public setHovered(hovered: boolean): void {
    this.albumArtHovered = hovered;
  }

  public setFadeProgress(progress: number): void {
    this.fadeProgress = progress;
  }

  public update(): void {
    if (this.currentMap) {
      this.albumArtScale = lerpDelta(this.albumArtScale, 1, 0.1);
      const targetHoverScale = this.albumArtHovered ? 1.05 : 1.0;
      this.albumArtHoverScale = lerpDelta(
        this.albumArtHoverScale,
        targetHoverScale,
        0.2
      );
      this.updateRotation();
    } else {
      this.albumArtScale = lerpDelta(this.albumArtScale, 0, 0.1);
      this.albumArtHoverScale = lerpDelta(this.albumArtHoverScale, 1.0, 0.2);
    }
  }

  private updateRotation(): void {
    const time = GetTime();
    const maxRotation = 2.75;
    const rotationSpeed = 0.5;
    this.rotationAngle = Math.sin(time * rotationSpeed) * maxRotation;
  }

  private getDifficultyColor(difficulty: number): [number, number, number] {
    const colorMap: Record<number, [number, number, number]> = {
      1: [0, 255, 0],
      2: [255, 185, 0],
      3: [255, 0, 0],
      4: [214, 107, 255],
      5: [54, 48, 79],
    };
    return colorMap[difficulty] || [100, 100, 100];
  }

  public draw(centerX: number, centerY: number): void {
    if (!this.currentMap) return;

    const scaledSize =
      this.albumArtSize * this.albumArtScale * this.albumArtHoverScale;
    const shadowOffsetX = 18;
    const shadowOffsetY = 18;

    const difficulty = this.currentMap?.difficulty || 0;
    const difficultyColor = this.getDifficultyColor(difficulty);

    rlPushMatrix();
    rlTranslatef(centerX, centerY, 0);

    rlPushMatrix();
    rlTranslatef(shadowOffsetX, shadowOffsetY, 0);
    const shadowRotation = this.rotationAngle * 0.3;
    rlRotatef(shadowRotation, 0, 0, 1);

    if (this.currentMapImage) {
      drawSprite(
        this.currentMapImage,
        Vector2((-scaledSize / 2) * 1.05, (-scaledSize / 2) * 1.05),
        Vector2(scaledSize * 1.05, scaledSize * 1.05),
        {
          r: difficultyColor[0] * 0.4,
          g: difficultyColor[1] * 0.4,
          b: difficultyColor[2] * 0.4,
          a: 0.3 * this.fadeProgress * 255,
        },
        undefined,
        true
      );
    } else {
      drawSprite(
        "/solid.png",
        Vector2((-scaledSize / 2) * 1.1, (-scaledSize / 2) * 1.1),
        Vector2(scaledSize * 1.1, scaledSize * 1.1),
        {
          r: difficultyColor[0] * 0.6,
          g: difficultyColor[1] * 0.6,
          b: difficultyColor[2] * 0.6,
          a: 0.3 * this.fadeProgress * 255,
        }
      );
    }
    rlPopMatrix();

    rlPushMatrix();
    rlRotatef(this.rotationAngle, 0, 0, 1);

    if (this.currentMapImage) {
      drawSprite(
        this.currentMapImage,
        Vector2(-scaledSize / 2, -scaledSize / 2),
        Vector2(scaledSize, scaledSize),
        { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 },
        undefined,
        true
      );
    } else {
      drawSprite(
        "/solid.png",
        Vector2(-scaledSize / 2, -scaledSize / 2),
        Vector2(scaledSize, scaledSize),
        { r: 40, g: 40, b: 40, a: this.fadeProgress * 255 }
      );
    }
    rlPopMatrix();

    if (!this.currentMapImage) {
      drawText(
        "No Image",
        Vector2(0, 0),
        18,
        { r: 150, g: 150, b: 150, a: this.fadeProgress * 255 },
        "center"
      );
    }

    rlPopMatrix();
  }

  public isPointInAlbumArt(
    mousePos: Vector2,
    centerX: number,
    centerY: number
  ): boolean {
    if (!this.currentMap) return false;
    const halfSize = (this.albumArtSize * this.albumArtScale) / 2;
    return (
      mousePos.x >= centerX - halfSize &&
      mousePos.x <= centerX + halfSize &&
      mousePos.y >= centerY - halfSize &&
      mousePos.y <= centerY + halfSize
    );
  }

  public getScaledSize(): number {
    return this.albumArtSize * this.albumArtScale;
  }
}
