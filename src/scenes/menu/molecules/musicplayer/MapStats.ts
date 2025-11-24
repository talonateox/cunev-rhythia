import { Vector2 } from "raylib";
import { drawSprite } from "../../../../utils/sprite";
import { drawText } from "../../../../utils/text";
import { SoundSpaceMemoryMap } from "../../../../utils/storage/ssmm";

export class MapStats {
  private currentMap: SoundSpaceMemoryMap | null = null;
  private fadeProgress: number = 0;

  public setCurrentMap(map: SoundSpaceMemoryMap | null): void {
    this.currentMap = map;
  }

  public setFadeProgress(progress: number): void {
    this.fadeProgress = progress;
  }

  public draw(centerX: number, startY: number): void {
    if (!this.currentMap) return;

    const iconSize = 32;
    const fontSize = 30;
    const lineHeight = 45;
    const iconTextGap = 12;
    const totalWidth = 400;

    const startX = centerX - totalWidth / 2;
    const columnGap = totalWidth / 2 + 60;

    const leftColumnX = startX;
    const rightColumnX = startX + columnGap;

    const statusY = startY;
    const statusRaw = this.currentMap.onlineStatus || "Unknown";
    const statusText = statusRaw.toUpperCase();

    const isRanked = statusText === "RANKED";
    const iconColor = isRanked
      ? { r: 90, g: 180, b: 110, a: this.fadeProgress * 255 } 
      : { r: 200, g: 200, b: 200, a: this.fadeProgress * 255 }; 

    drawSprite(
      "/status.png",
      Vector2(leftColumnX, statusY - iconSize / 2),
      Vector2(iconSize, iconSize),
      iconColor
    );

    const statusColor =
      statusText === "RANKED"
        ? { r: 90, g: 180, b: 110, a: this.fadeProgress * 255 } 
        : { r: 150, g: 150, b: 150, a: this.fadeProgress * 255 }; 

    drawText(
      `${statusText}`,
      Vector2(leftColumnX + iconSize + iconTextGap, statusY - fontSize / 2),
      fontSize,
      statusColor,
      "left"
    );

    const notesY = startY + lineHeight;
    drawSprite(
      "/stat.png",
      Vector2(leftColumnX, notesY - iconSize / 2),
      Vector2(iconSize, iconSize),
      { r: 200, g: 200, b: 200, a: this.fadeProgress * 255 }
    );

    drawText(
      `${this.currentMap.noteCount || 0} notes`,
      Vector2(leftColumnX + iconSize + iconTextGap, notesY - fontSize / 2),
      fontSize,
      { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
      "left"
    );

    const durationSeconds = Math.floor((this.currentMap.duration || 0) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const durationText = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    drawSprite(
      "/time.png",
      Vector2(rightColumnX, statusY - iconSize / 2),
      Vector2(iconSize, iconSize),
      { r: 200, g: 200, b: 200, a: this.fadeProgress * 255 }
    );

    drawText(
      `${durationText}`,
      Vector2(rightColumnX + iconSize + iconTextGap, statusY - fontSize / 2),
      fontSize,
      { r: 180, g: 180, b: 180, a: this.fadeProgress * 255 },
      "left"
    );

    const starRating = this.currentMap.starRating || 0;

    drawSprite(
      "/star.png",
      Vector2(rightColumnX, notesY - iconSize / 2),
      Vector2(iconSize, iconSize),
      {
        r: 200,
        g: 200,
        b: 200,
        a: this.fadeProgress * 255,
      }
    );

    drawText(
      `${starRating.toFixed(1)} stars`,
      Vector2(rightColumnX + iconSize + iconTextGap, notesY - fontSize / 2),
      fontSize,
      {
        r: 180,
        g: 180,
        b: 180,
        a: this.fadeProgress * 255,
      },
      "left"
    );
  }
}
