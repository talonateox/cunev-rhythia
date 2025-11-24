import {
  Vector2,
  GetFrameTime,
  BeginScissorMode,
  EndScissorMode,
} from "raylib";
import { drawText, measureText } from "../../../../utils/text";
import { Rhythia } from "../../../../atoms/Rhythia";
import { getPresentationInfo } from "../../../../atoms/sysutils/rendering";
import { SoundSpaceMemoryMap } from "../../../../utils/storage/ssmm";

export class SongInfo {
  private currentMap: SoundSpaceMemoryMap | null = null;
  private fadeProgress: number = 0;
  private titleScroll: number = 0;
  private scrollDelay: number = 0;
  private wasOverflowing: boolean = false;

  public setCurrentMap(map: SoundSpaceMemoryMap | null): void {
    this.currentMap = map;
    this.titleScroll = 0;
    this.scrollDelay = 0;
    this.wasOverflowing = false;
  }

  public setFadeProgress(progress: number): void {
    this.fadeProgress = progress;
  }

  public draw(
    centerX: number,
    titleY: number,
    align: "left" | "center" | "right" = "center",
  ): void {
    if (!this.currentMap) return;

    const textX = align === "left" ? centerX + 66 : centerX;

    const title = this.currentMap.title.trim() || "Unknown Map";
    const titleSize = 50;

    const measured = measureText(title, titleSize, 1);
    const textWidth = measured.width;

    const maxClip = 700;
    const availableWidth = Math.max(
      1,
      Math.min(maxClip, Math.floor(Rhythia.gameWidth * 0.45)),
    );
    const overflow = textWidth > availableWidth + 1;
    const dt = GetFrameTime();
    if (overflow && !this.wasOverflowing) {
      this.scrollDelay = 0;
      this.titleScroll = 0;
    }

    let scissorPushed = false;
    if (overflow) {
      const worldLeft = centerX - availableWidth / 2;
      const worldTop = titleY;
      try {
        const { viewport } = getPresentationInfo();
        const scaleX = viewport.width / Math.max(1, Rhythia.gameWidth);
        const scaleY = viewport.height / Math.max(1, Rhythia.gameHeight);
        const scissorX = Math.round(viewport.x + worldLeft * scaleX);
        const scissorY = Math.round(viewport.y + worldTop * scaleY);
        const scissorW = Math.max(1, Math.round(availableWidth * scaleX));
        const scissorH = Math.max(1, Math.round(measured.height * scaleY));
        BeginScissorMode(scissorX, scissorY, scissorW, scissorH);
        scissorPushed = true;
      } catch {}
    }

    if (overflow) {
      const speed = 60;
      const gap = 40;
      const loopLen = Math.max(1, textWidth + gap);
      if (this.scrollDelay < 1.0) {
        this.scrollDelay = Math.min(1.0, this.scrollDelay + dt);
      } else {
        this.titleScroll = (this.titleScroll + speed * dt) % loopLen;
      }

      const clipLeft = centerX - availableWidth / 2;
      const baseX = clipLeft - this.titleScroll;
      const color = { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 };
      drawText(title, Vector2(baseX, titleY), titleSize, color, "left");
      drawText(
        title,
        Vector2(baseX + textWidth + gap, titleY),
        titleSize,
        color,
        "left",
      );
    } else {
      this.titleScroll = this.titleScroll * 0.8;
      this.scrollDelay = 0;
      drawText(
        title,
        Vector2(textX, titleY),
        titleSize,
        { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 },
        align,
      );
    }

    if (scissorPushed) {
      EndScissorMode();
    }

    this.wasOverflowing = overflow;

    const author = this.currentMap.mappers?.join(", ") || "Unknown Author";
    const maxAuthorLength = 40;
    const authorText = `mapped by ${author}`;
    const displayAuthor =
      authorText.length > maxAuthorLength
        ? authorText.substring(0, maxAuthorLength - 3) + "..."
        : authorText;

    drawText(
      displayAuthor,
      Vector2(textX, titleY + 48),
      28,
      { r: 200, g: 200, b: 200, a: this.fadeProgress * 255 },
      align,
    );

    const diffName = (this.currentMap as any).customDifficultyName || "";
    if (diffName && diffName.trim()) {
      drawText(
        `< ${diffName.trim()} >`,
        Vector2(textX, titleY + 84),
        34,
        { r: 230, g: 230, b: 230, a: this.fadeProgress * 255 },
        align,
      );
    }
  }
}
