import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlScalef,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { GameUIPanel, GameUIPanelCommonArgs } from "./GameUIPanel";

export interface TopPanelArgs extends GameUIPanelCommonArgs {
  mapData: SoundSpaceMemoryMap | null;
  currentTime: number;
}

export class TopGameUIPanel extends GameUIPanel<TopPanelArgs> {
  public render(args: TopPanelArgs): void {
    rlPushMatrix();

    const uiOpacity = args.settings?.uiOpacity ?? 0.15;
    const uiTiltRate = args.settings?.uiTiltRate ?? 1.0;
    const playfieldScale = args.settings?.playfieldScale ?? 1.0;
    const uiScale = args.settings?.uiScale ?? 1.0;

    const planeX = Rhythia.gameWidth / 2;
    const effectiveBorderHalf = (340 * playfieldScale) / 2;
    const baseMargin = Math.min(Rhythia.gameWidth, Rhythia.gameHeight) * 0.2 * playfieldScale;
    const marginScalePush = 1 + (uiScale - 1) * 0.25;
    const normalizedMargin = Math.round(baseMargin * marginScalePush);
    const planeY =
      Rhythia.gameHeight / 2 - effectiveBorderHalf - normalizedMargin;

    const depth = args.closeDistance;
    rlTranslatef(planeX, planeY, depth);

    const tiltCompensation = 1 - uiTiltRate;
    rlTranslatef(
      args.cameraTiltX * 100 * tiltCompensation,
      args.cameraTiltY * 100 * tiltCompensation,
      0
    );
    rlScalef(uiScale, uiScale, 1.0);

    const textOpacity = Math.round(255 * (uiOpacity * 5));

    const mapName = args.mapData?.title || "Unknown Map";
    drawText(
      mapName,
      Vector2(0, -35),
      28,
      { r: 255, g: 255, b: 255, a: textOpacity },
      "center"
    );

    const timeInSeconds = Math.max(0, args.currentTime / 1000);
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const currentTimeString = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    let durationString = "";
    if (args.mapData?.duration) {
      const durationInSeconds = args.mapData.duration / 1000;
      const durationMinutes = Math.floor(durationInSeconds / 60);
      const durationSeconds = Math.floor(durationInSeconds % 60);
      durationString = `${durationMinutes
        .toString()
        .padStart(2, "0")}:${durationSeconds.toString().padStart(2, "0")}`;
    }

    const timeDisplay = durationString
      ? `${currentTimeString} / ${durationString}`
      : currentTimeString;
    drawText(
      timeDisplay,
      Vector2(0, -10),
      22,
      { r: 200, g: 200, b: 200, a: textOpacity },
      "center"
    );

    if (args.mapData?.duration) {
      this.render3DProgressBar(
        0,
        20,
        args.currentTime,
        args.mapData.duration,
        uiOpacity
      );
    }

    rlPopMatrix();
  }

  private render3DProgressBar(
    centerX: number,
    y: number,
    currentTime: number,
    duration: number,
    uiOpacity: number
  ): void {
    const barWidth = 300;
    const barHeight = 12;

    const progress = Math.min(1, Math.max(0, currentTime / duration));
    const fillWidth = barWidth * progress;

    drawSprite(
      "/solid.png",
      Vector2(centerX - barWidth / 2, y - barHeight / 2),
      Vector2(barWidth, barHeight),
      { r: 60, g: 60, b: 60, a: Math.round(255 * uiOpacity * 2) }
    );

    if (fillWidth > 0) {
      drawSprite(
        "/solid.png",
        Vector2(centerX - barWidth / 2, y - barHeight / 2),
        Vector2(fillWidth, barHeight),
        { r: 255, g: 255, b: 255, a: Math.round(255 * uiOpacity * 4) }
      );
    }
  }
}
