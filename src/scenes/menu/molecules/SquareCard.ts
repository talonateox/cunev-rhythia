import { Vector2, Color } from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { BeatmapData } from "../../../utils/types";
import { lerpDelta } from "../../../utils/lerp";
import { playFx, playMusic, getVolumes } from "../../../utils/soundManager";
import { logger } from "../../../utils/logger";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { getScrollY, setScrollY } from "../../../utils/scroll";

import { Rhythia } from "../../../atoms/Rhythia";
import { Maps } from "../../../utils/maps";
import { createPopup, Popup } from "../atoms/Popup";
import { MenuScene } from "..";

interface DifficultyColors {
  color: [number, number, number, number];
  dimmedColor: [number, number, number, number];
}

function getDifficultyColors(difficulty: number): DifficultyColors {
  const colorMap: Record<number, [number, number, number, number]> = {
    1: [0, 1, 0, 1], 
    2: [1, 0.73, 0, 1], 
    3: [1, 0, 0, 1], 
    4: [0.84, 0.42, 1, 1], 
    5: [0.21, 0.19, 0.31, 1], 
  };

  const color = colorMap[difficulty] || [0, 1, 0, 1];
  const dimmedColor = color.map((c) => c * 0.3) as [
    number,
    number,
    number,
    number
  ];

  return { color, dimmedColor };
}

export class SquareCard {
  gameObject: GameObject;
  private mapData: BeatmapData;
  private baseX: number; 
  private baseY: number; 
  private size: number; 
  private index: number;
  private hoverProgress: number = 0;
  private isHovered: boolean = false;
  private isSelected: boolean = false;
  private borderWidth: number = 3;
  private imageUrl: string | null = null;

  private entryProgress: number = 0;
  private isVisible: boolean = false;
  private animationStartTime: number = 0;

  private static allCards: SquareCard[] = [];
  private static selectedCard: SquareCard | null = null;
  private static imageUrlCache: Map<string, string | null> = new Map();

  constructor(
    mapData: BeatmapData,
    position: Vector2,
    size: number,
    index: number
  ) {
    this.mapData = mapData;
    this.baseX = position.x;
    this.baseY = position.y;
    this.size = size;
    this.index = index;

    this.imageUrl = this.mapData.image || null;

    const inGameScene = Rhythia.currentScene?.sceneName === "Game";
    if (inGameScene) {
      this.gameObject = new GameObject({ zBase: 1 });
      return;
    }

    this.gameObject = new GameObject({ zBase: 1 });
    this.gameObject.attachRect({
      pos: position,
      size: { x: size, y: size },
    });

    this.setupEventHandlers();

    SquareCard.allCards.push(this);
  }

  private async resolveImageUrlIfNeeded(): Promise<void> {
    const cacheKey = String(this.mapData.id);
    if (SquareCard.imageUrlCache.has(cacheKey)) {
      const cached = SquareCard.imageUrlCache.get(cacheKey)!;
      if (cached && cached !== this.imageUrl) this.imageUrl = cached;
      return;
    }

    try {
      const parsedData = Maps.getParsed(cacheKey);
      const resolved = parsedData?.onlineImage || this.mapData.image || null;
      SquareCard.imageUrlCache.set(cacheKey, resolved);
      if (resolved && resolved !== this.imageUrl) {
        this.imageUrl = resolved;
      }
    } catch {
      const resolved = this.mapData.image || null;
      SquareCard.imageUrlCache.set(cacheKey, resolved);
      if (resolved !== this.imageUrl) {
        this.imageUrl = resolved;
      }
    }
  }

  private setupEventHandlers(): void {
    this.gameObject.onOffscreenUpdate = () => {
      this.handleScroll();
      this.updateInteraction();
    };

    this.gameObject.onDraw = () => this.draw();

    this.gameObject.onUpdate = () => this.updateInteraction();

    this.gameObject.rectArea!.onClick = () => {
      if (MenuScene.isAnyOverlayOpen()) return true;
      this.handleClick();
      return true;
    };

    this.gameObject.rectArea!.onHoverStart = () => this.onHoverStart();
    this.gameObject.rectArea!.onHoverEnd = () => this.onHoverEnd();
  }

  private handleScroll(): void {
    const scrollY = getScrollY();
    this.gameObject.rectArea!.pos.y = this.baseY - scrollY;
  }

  private updateInteraction(): void {
    if (MenuScene.isAnyOverlayOpen()) return;

    const scrollY = getScrollY();
    const cardY = this.baseY - scrollY;
    const isOnScreen = cardY + this.size > 0 && cardY < Rhythia.gameHeight;

    if (isOnScreen && !this.isVisible) {
      this.isVisible = true;

      if (this.index < 42) {
        const staggerDelay = this.index * 15; 
        this.animationStartTime = performance.now() + staggerDelay;
      } else {
        this.entryProgress = 1;
        this.animationStartTime = 0;
      }

      this.resolveImageUrlIfNeeded();
    }

    if (this.isVisible && this.index < 42) {
      const currentTime = performance.now();
      const timeSinceStart = Math.max(0, currentTime - this.animationStartTime);
      const animationDuration = 400; 

      if (timeSinceStart >= 0) {
        const progress = Math.min(1, timeSinceStart / animationDuration);

        this.entryProgress = 1 - Math.pow(1 - progress, 3);
      } else {
        this.entryProgress = 0; 
      }
    }

    this.hoverProgress = lerpDelta(
      this.hoverProgress,
      this.isHovered ? 1 : 0,
      0.15
    );
  }

  private onHoverStart(): void {
    playFx("/hover2.wav");
    this.isHovered = true;
  }

  private onHoverEnd(): void {
    this.isHovered = false;
  }

  private draw(): void {
    const difficulty = this.mapData.difficulty;
    const difficultyColor = getDifficultyColors(Math.round(difficulty!));

    const currentPosition = Vector2(
      this.baseX,
      this.gameObject.rectArea!.pos.y
    );

    let targetScale = 1;
    if (this.isSelected) {
      targetScale = 1.05; 
    } else {
      targetScale = 1 + this.hoverProgress * 0.02; 
    }

    const scaledSize = this.size * targetScale;
    const scaleOffset = (scaledSize - this.size) / 2;
    const scaledPosition = Vector2(
      currentPosition.x - scaleOffset,
      currentPosition.y - scaleOffset
    );

    let borderAlpha, borderSize;
    if (this.isSelected) {
      borderAlpha = 255; 
      borderSize = this.borderWidth + 4; 
    } else {
      borderAlpha = 180 + this.hoverProgress * 75;
      borderSize = this.borderWidth + this.hoverProgress * 2;
    }

    drawSprite(
      "/solid.png",
      Vector2(scaledPosition.x - borderSize, scaledPosition.y - borderSize),
      Vector2(scaledSize + borderSize * 2, scaledSize + borderSize * 2),
      {
        r: difficultyColor.color[0] * 255,
        g: difficultyColor.color[1] * 255,
        b: difficultyColor.color[2] * 255,
        a: borderAlpha * this.entryProgress,
      }
    );

    drawSprite("/solid.png", scaledPosition, Vector2(scaledSize, scaledSize), {
      r: 20,
      g: 20,
      b: 20,
      a: 255 * this.entryProgress,
    });

    if (this.imageUrl && this.imageUrl.trim() !== "") {
      const isLocal = this.imageUrl.startsWith("./");
      drawSprite(
        this.imageUrl,
        scaledPosition,
        Vector2(scaledSize, scaledSize),
        { r: 255, g: 255, b: 255, a: 255 * this.entryProgress },
        undefined,
        isLocal
      );
    } else {
      const dimmedColor = {
        r: difficultyColor.dimmedColor[0] * 255,
        g: difficultyColor.dimmedColor[1] * 255,
        b: difficultyColor.dimmedColor[2] * 255,
        a: 255 * this.entryProgress,
      };
      drawSprite(
        "/solid.png",
        scaledPosition,
        Vector2(scaledSize, scaledSize),
        dimmedColor
      );
    }

    if (this.hoverProgress > 0) {
      drawSprite(
        "/solid.png",
        scaledPosition,
        Vector2(scaledSize, scaledSize),
        {
          r: 0,
          g: 0,
          b: 0,
          a: this.hoverProgress * 180 * this.entryProgress,
        }
      );
    }

    this.drawBottomInfoStrip(scaledPosition, scaledSize);

    if (this.isHovered || !this.imageUrl || this.imageUrl.trim() === "") {
      this.drawTitleText(scaledPosition, scaledSize);
    }
  }

  private drawTitleText(position: Vector2, size: number): void {
    const title = this.mapData.title?.trim() || "Unknown";
    const fontSize = 20;
    const padding = 4;
    const maxWidth = size - padding * 2;
    const maxHeight = size - padding * 2;

    const wrappedLines = this.wrapText(title, fontSize, maxWidth);

    const lineHeight = fontSize + 2;
    const totalTextHeight = wrappedLines.length * lineHeight;

    const maxLines = Math.floor(maxHeight / lineHeight);
    const displayLines = wrappedLines.slice(0, maxLines);

    if (wrappedLines.length > maxLines && maxLines > 0) {
      const lastLine = displayLines[maxLines - 1];
      displayLines[maxLines - 1] =
        lastLine.length > 3
          ? lastLine.substring(0, lastLine.length - 3) + "..."
          : "...";
    }

    const displayHeight = displayLines.length * lineHeight;
    const startY = position.y + (size - displayHeight) / 2;

    const hasImage = this.imageUrl && this.imageUrl.trim() !== "";
    let textAlpha;

    if (hasImage) {
      textAlpha = this.hoverProgress * 255 * this.entryProgress;
    } else {
      textAlpha = (200 + this.hoverProgress * 55) * this.entryProgress; 
    }

    displayLines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;

      if (
        lineY >= position.y + padding &&
        lineY + fontSize <= position.y + size - padding
      ) {
        drawText(
          line,
          Vector2(position.x + size / 2, lineY),
          fontSize,
          { r: 255, g: 255, b: 255, a: textAlpha },
          "center"
        );
      }
    });
  }

  private wrapText(text: string, fontSize: number, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      const estimatedWidth = testLine.length * (fontSize * 0.6);

      if (estimatedWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(
            word.substring(0, Math.floor(maxWidth / (fontSize * 0.6))) + "..."
          );
          currentLine = "";
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private drawBottomInfoStrip(position: Vector2, size: number): void {
    const stripHeight = 28;
    const stripY = position.y + size - stripHeight;

    drawSprite(
      "/solid.png",
      Vector2(position.x, stripY),
      Vector2(size, stripHeight),
      { r: 0, g: 0, b: 0, a: 180 * this.entryProgress }
    );

    const duration = this.mapData.length || 0;
    let lengthText = "0:00";
    if (duration > 0) {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      lengthText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const fontSize = 20;
    const padding = 6;
    const textY = stripY + (stripHeight - fontSize) / 2 + 1;
    const iconSize = Math.max(10, Math.floor(stripHeight * 0.6));
    const iconY = stripY + (stripHeight - iconSize) / 2;
    const starRating = this.mapData.starRating || 0;
    const starText = `${starRating.toFixed(2)}`;
    const starTextX = position.x + padding;
    drawText(
      starText,
      Vector2(starTextX, textY),
      fontSize,
      { r: 255, g: 255, b: 255, a: 255 * this.entryProgress },
      "left"
    );
    const starTextSize = measureText(starText, fontSize);
    const iconX = starTextX + starTextSize.width + 8;
    drawSprite(
      "/star.png",
      Vector2(iconX, iconY),
      Vector2(iconSize, iconSize),
      { r: 255, g: 255, b: 255, a: 255 * this.entryProgress }
    );

    drawText(
      lengthText,
      Vector2(position.x + size - padding, textY),
      fontSize,
      { r: 255, g: 255, b: 255, a: 255 * this.entryProgress },
      "right"
    );
  }

  private handleClick(): void {
    this.selectAndCenterThenLoad();
  }

  private async selectAndCenterThenLoad(): Promise<void> {
    logger(`Square card ${this.index} selected: ${this.mapData.title}`);

    if (SquareCard.selectedCard && SquareCard.selectedCard !== this) {
      SquareCard.selectedCard.isSelected = false;
    }
    this.isSelected = true;
    SquareCard.selectedCard = this;

    const targetScrollY = this.baseY - (Rhythia.gameHeight / 2 - 65);
    setScrollY(targetScrollY);

    setTimeout(() => {
      this.downloadBeatmap().catch((error) => {
        console.error("Failed to load beatmap:", error);
      });
    }, 50);
  }

  private async getAudioPath(mapId: string): Promise<string | null> {
    try {
      const m = Maps.getParsed(mapId);
      return Maps.audioPath(mapId, m);
    } catch {
      return `./cache/audio/${mapId}.mp3`;
    }
  }

  private async downloadBeatmap(): Promise<void> {
    try {
      const mapId = this.mapData.id.toString();
      logger(mapId);
      const existing = Maps.getParsed(mapId);
      if (existing) {
        const menuInstance = MenuScene.getInstance();
        if (menuInstance) {
          menuInstance.setSelectedMap(
            existing,
            this.mapData.image || "",
            this.mapData.difficulty || 0,
            mapId
          );
        }
        const audioPath = await this.getAudioPath(mapId);
        if (audioPath) {
          const volumes = getVolumes();
          playMusic(audioPath, volumes.music);
        }
        return;
      }

      if (!this.mapData.beatmapFile) {
        console.warn(`No beatmap file URL for map ${mapId}`);
        return;
      }

      const downloadPopup = createPopup("download");
      downloadPopup.show("Downloading...");

      try {
        const onlineData = {
          starRating: this.mapData.starRating || 0,
          status: this.mapData.status || "UNRANKED",
          onlineId: this.mapData.id.toString(),
          onlineImage: this.mapData.image || "",
        };

        const result = await Maps.fetchAndAdd(
          this.mapData.beatmapFile,
          onlineData
        );

        if (result) {
          const menuInstance = MenuScene.getInstance();
          if (menuInstance) {
            menuInstance.setSelectedMap(
              result,
              this.mapData.image || "",
              this.mapData.difficulty || 0,
              mapId
            );
          }
          const audioPath = await this.getAudioPath(mapId);
          if (audioPath) {
            const volumes = getVolumes();
            playMusic(audioPath, volumes.music);
          }
          downloadPopup.hide();
          downloadPopup.destroy();
        } else {
          throw new Error("Failed to process beatmap file");
        }
      } catch (downloadError) {
        console.error("Error downloading beatmap:", downloadError);
        downloadPopup.hide();
        downloadPopup.destroy();
        const errorPopup = createPopup("error");
        errorPopup.show("Failed to download");
        setTimeout(() => {
          errorPopup.hide();
          errorPopup.destroy();
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to download beatmap:", error);
    }
  }

  public destroy(): void {
    const index = SquareCard.allCards.indexOf(this);
    if (index >= 0) {
      SquareCard.allCards.splice(index, 1);
    }

    if (SquareCard.selectedCard === this) {
      SquareCard.selectedCard = null;
    }

    this.gameObject.destroy();
  }

  public static clearAllCards(): void {
    for (const card of this.allCards) {
      card.gameObject.destroy();
    }
    this.allCards = [];
    this.selectedCard = null;
  }

  public static getSelectedCard(): SquareCard | null {
    return this.selectedCard;
  }

  public static selectRelative(delta: number): void {
    if (this.allCards.length === 0) return;
    let currentIndex = 0;
    if (this.selectedCard) {
      currentIndex = this.allCards.indexOf(this.selectedCard);
      if (currentIndex < 0) currentIndex = 0;
    }
    const nextIndex = Math.max(
      0,
      Math.min(this.allCards.length - 1, currentIndex + delta)
    );
    const target = this.allCards[nextIndex];
    (target as any).selectAndCenterThenLoad?.();
  }
  public static selectFirstIfNone(): void {
    if (this.allCards.length === 0) return;
    if (!this.selectedCard) {
      const target = this.allCards[0];
      (target as any).selectAndCenterThenLoad?.();
    }
  }

  public static selectRandom(): void {
    if (this.allCards.length === 0) return;
    const idx = Math.floor(Math.random() * this.allCards.length);
    const target = this.allCards[idx];
    (target as any).selectAndCenterThenLoad?.();
  }
}

export function createSquareCard(options: {
  mapData: BeatmapData;
  position: Vector2;
  size: number;
  index: number;
}): GameObject {
  
  if (Rhythia.currentScene?.sceneName === "Game") {
    logger(
      `⛔ createSquareCard blocked during Game scene for: ${
        options.mapData.title || options.mapData.id
      }`
    );
    return new GameObject({ zBase: 1 });
  }

  const card = new SquareCard(
    options.mapData,
    options.position,
    options.size,
    options.index
  );
  return card.gameObject;
}
