import {
  GetFrameTime,
  Vector3,
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  MeasureTextEx,
  GuiGetFont,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
  BeginScissorMode,
  EndScissorMode,
} from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite, drawSpriteCropped } from "../../../utils/sprite";
import { WHITE } from "raylib";
import { lerp, lerpDelta } from "../../../utils/lerp";
import { Rhythia } from "../../../atoms/Rhythia";
import { getScrollY, setScrollY } from "../../../utils/scroll";
import { drawText } from "../../../utils/text";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { BeatmapData } from "../../../utils/types";
import { rgb, rgba } from "../../../utils/colors";
import { Maps } from "../../../utils/maps";
import { Popup, createPopup } from "../atoms/Popup";
import { playFx, playMusic, getVolumes } from "../../../utils/soundManager";
import { logger } from "../../../utils/logger";
import { MenuScene } from "..";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";

export class MapButton {
  private gameObject: GameObject;
  private hoverProgress: number = 0;
  private isHovered: boolean = false;
  private baseY: number;
  private index: number;
  private mapData: BeatmapData;
  private static waveCenterY: number = 0;
  private static smoothScrollY: number = 0;
  private static lastScrollY: number = 0;
  private static selectedButton: MapButton | null = null;
  private expandProgress: number = 0;
  private static allButtons: MapButton[] = [];
  private entryProgress: number = 0;
  private entryDelay: number = 0;
  private downloadPopup: Popup | null = null;
  private isPressed: boolean = false;
  private pressStartPos: { x: number; y: number } | null = null;
  private hasDraggedBeyondThreshold: boolean = false;
  private isMapLoaded: boolean = false;
  private titleScroll: number = 0;
  private resolvedMapperText: string | null = null;
  private mapperResolved: boolean = false;
  public onSelectionComplete?: (result: {
    success: boolean;
    mapId: string;
    mapData: BeatmapData;
    error?: unknown;
  }) => void;

  constructor(mapData: BeatmapData, y: number, index: number) {
    this.mapData = mapData;
    this.baseY = y;
    this.index = index;

    const inGameScene = Rhythia.currentScene?.sceneName === "Game";
    if (inGameScene) {
      this.gameObject = new GameObject();
      return;
    }

    this.gameObject = new GameObject();

    this.initialize();

    MapButton.allButtons.push(this);

    const currentScrollY = getScrollY();
    const buttonY = this.baseY - currentScrollY;
    const isVisibleOnScreen = buttonY >= -130 && buttonY <= Rhythia.gameHeight;

    if (isVisibleOnScreen) {
      const visibleIndex = Math.floor(buttonY / 136); 
      this.entryDelay = Math.max(0, visibleIndex * 50); 
      this.entryProgress = 0;
    } else {
      this.entryDelay = 0;
      this.entryProgress = 1; 
    }
  }

  private initialize(): void {
    this.gameObject.attachRect({
      pos: { x: Rhythia.gameWidth - 920, y: this.baseY },
      size: { x: 1100, y: 130 },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.gameObject.onOffscreenUpdate = () => {
      this.handleScroll();

      this.updateInteraction();
    };

    this.gameObject.onDraw = () => this.draw();

    this.gameObject.onUpdate = () => this.updateInteraction();

    this.gameObject.rectArea!.onHoverStart = () => this.onHoverStart();
    this.gameObject.rectArea!.onHoverEnd = () => this.onHoverEnd();

    this.gameObject.rectArea!.onClick = () => this.onPress() as any;
  }

  private handleScroll(): void {
    const scrollY = getScrollY();

    let yOffset = 0;
    if (MapButton.selectedButton) {
      const selectedIndex = MapButton.selectedButton.index;
      const expandedHeight = 50; 

      if (this === MapButton.selectedButton) {
        yOffset = 0;
      } else if (this.index < selectedIndex) {
        yOffset =
          -MapButton.selectedButton.expandProgress * expandedHeight * 0.5;
      } else if (this.index > selectedIndex) {
        yOffset =
          MapButton.selectedButton.expandProgress * expandedHeight * 0.5;
      }
    }

    this.gameObject.rectArea!.pos.y = this.baseY - scrollY + yOffset;
  }

  private draw(): void {
    this.updateHoverAnimation();

    if (this === MapButton.selectedButton) {
      this.expandProgress = lerpDelta(this.expandProgress, 1, 0.15);
    } else {
      this.expandProgress = lerpDelta(this.expandProgress, 0, 0.15);
    }

    if (this.entryDelay > 0) {
      this.entryDelay -= GetFrameTime() * 1000; 
    } else {
      this.entryProgress = lerpDelta(this.entryProgress, 1, 0.12);
    }

    if (MapButton.waveCenterY === 0) {
      MapButton.waveCenterY = Rhythia.gameHeight / 2;
      MapButton.smoothScrollY = getScrollY();
    }

    const currentScrollY = getScrollY();

    MapButton.smoothScrollY = lerpDelta(
      MapButton.smoothScrollY,
      currentScrollY,
      0.08
    );

    const scrollLag = currentScrollY - MapButton.smoothScrollY;

    let waveOffset = -scrollLag * 2.5;

    MapButton.waveCenterY = Rhythia.gameHeight / 2 + waveOffset;

    const distanceFromCenter = Math.abs(
      this.gameObject.rectArea!.pos.y - MapButton.waveCenterY
    );
    const maxDistance = Rhythia.gameHeight / 2;
    const normalizedDistance = distanceFromCenter / maxDistance;

    waveOffset = (1 - normalizedDistance) * 35; 

    const selectedOffset = this.expandProgress * 60; 

    const entryOffset = (1 - this.entryProgress) * 300; 
    const entryOpacity = this.entryProgress;

    rlPushMatrix();
    rlTranslatef(
      this.gameObject.rectArea!.pos.x -
        this.hoverProgress -
        waveOffset -
        selectedOffset +
        entryOffset,
      this.gameObject.rectArea!.pos.y - this.expandProgress * 25, 
      0
    );

    this.drawBackground();

    if (this.expandProgress > 0) {
      const expandedHeight = 130 + this.expandProgress * 50;
      drawSprite(
        "/solid.png",
        Vector3(0, 0, -0.05),
        Vector2(this.gameObject.rectArea!.size.x, expandedHeight),
        rgba(255, 255, 255, this.expandProgress * 0.1 * this.entryProgress) 
      );
    }

    this.drawBeatmapImage();

    const textOffset = 120 + this.expandProgress * 50;
    rlTranslatef(textOffset, 0, 0);
    this.drawTextContent();

    this.drawStarRating();

    rlPopMatrix();
  }

  private updateInteraction(): void {
    if (MenuScene.isAnyOverlayOpen()) return;
    if (this.isPressed) {
      const mousePos = this.gameObject.getMousePosition();
      if (mousePos && this.pressStartPos) {
        const dx = mousePos.x - this.pressStartPos.x;
        const dy = mousePos.y - this.pressStartPos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 36) {
          this.hasDraggedBeyondThreshold = true;
        }
      }

      if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        const shouldSelect = !this.hasDraggedBeyondThreshold;
        this.isPressed = false;
        this.pressStartPos = null;
        this.hasDraggedBeyondThreshold = false;

        if (shouldSelect) {
          this.selectAndCenterThenLoad();
        }
      }
    }
  }

  private updateHoverAnimation(): void {
    if (this.isHovered) {
      this.hoverProgress = lerpDelta(this.hoverProgress, 40, 0.17); 
    } else {
      this.hoverProgress = lerpDelta(this.hoverProgress, 0, 0.17);
    }
  }

  private notifySelectionComplete(
    success: boolean,
    mapId: string,
    error?: unknown
  ): void {
    if (this.onSelectionComplete) {
      this.onSelectionComplete({
        success,
        mapId,
        mapData: this.mapData,
        error,
      });
    }
  }

  private drawBackground(): void {
    const difficultyColor = getDifficultyColors(this.mapData.difficulty!);
    const expandedHeight = 130 + this.expandProgress * 50; 

    const color = difficultyColor.color;
    
    drawSpriteCropped(
      "/mapcontainer.png",
      Vector3(0, 0, 0.1),
      Vector2(this.gameObject.rectArea!.size.x, expandedHeight),
      rgba(color[0] * 255, color[1] * 255, color[2] * 255, this.entryProgress),
      { right: 2 }
    );
  }

  private drawBeatmapImage(): void {
    if (this.mapData.image) {
      const baseSize = 113;
      const expandedSize = baseSize + this.expandProgress * 50;

      const isLocal = this.mapData.image.startsWith("./");
      drawSprite(
        this.mapData.image,
        Vector3(8.8, 8.8, 0),
        Vector2(expandedSize, expandedSize),
        rgba(255, 255, 255, this.entryProgress),
        undefined,
        isLocal
      );
    }
  }

  private drawTextContent(): void {
    const titleSize = 45 + this.expandProgress * 10;
    const subtitleSize = 30 + this.expandProgress * 5;

    const titleY = 8 + this.expandProgress * 10;
    const subtitleY = 48 + this.expandProgress * 15;

    
    const titleText = this.mapData.title!.trim();
    const leftPadding = 20;
    const rightPadding = 20;
    const textOffset = 120 + this.expandProgress * 50; 

    const font = GuiGetFont();
    const measured = MeasureTextEx(font, titleText, titleSize, 1);
    const textWidth = measured.x;

    
    const availableWidth = Math.max(
      1,
      this.gameObject.rectArea!.size.x - textOffset - leftPadding - rightPadding
    );

    const overflow = textWidth > availableWidth + 1;
    const isSelected = MapButton.selectedButton === this;

    
    let scissorPushed = false;
    try {
      
      
      const distanceFromCenter = Math.abs(
        this.gameObject.rectArea!.pos.y - MapButton.waveCenterY
      );
      const maxDistance = Rhythia.gameHeight / 2;
      const normalizedDistance =
        distanceFromCenter / Math.max(0.0001, maxDistance);
      const waveOffset = (1 - normalizedDistance) * 35;
      const selectedOffset = this.expandProgress * 60;
      const entryOffset = (1 - this.entryProgress) * 300;

      const worldLeft =
        this.gameObject.rectArea!.pos.x -
        this.hoverProgress -
        waveOffset -
        selectedOffset +
        entryOffset +
        textOffset +
        leftPadding;
      const worldTop =
        this.gameObject.rectArea!.pos.y - this.expandProgress * 25 + titleY;

      
      try {
        const { viewport } = getPresentationInfo();
        const scaleX = viewport.width / Math.max(1, Rhythia.gameWidth);
        const scaleY = viewport.height / Math.max(1, Rhythia.gameHeight);
        const scissorX = Math.round(viewport.x + worldLeft * scaleX);
        const scissorY = Math.round(viewport.y + worldTop * scaleY);
        const scissorW = Math.max(1, Math.round(availableWidth * scaleX));
        const scissorH = Math.max(
          1,
          Math.round(Math.max(titleSize, measured.y) * scaleY)
        );
        BeginScissorMode(scissorX, scissorY, scissorW, scissorH);
        scissorPushed = true;
      } catch {
        const scale = Rhythia.renderScale || 1;
        const scissorX = Math.round(worldLeft * scale);
        const scissorY = Math.round(worldTop * scale);
        const scissorW = Math.max(1, Math.round(availableWidth * scale));
        const scissorH = Math.max(
          1,
          Math.round(Math.max(titleSize, measured.y) * scale)
        );
        BeginScissorMode(scissorX, scissorY, scissorW, scissorH);
        scissorPushed = true;
      }
    } catch {}

    
    const dt = GetFrameTime();
    if (isSelected && overflow) {
      const speed = 60 + this.expandProgress * 40; 
      const gap = 40; 
      const loopLen = textWidth + gap;
      this.titleScroll = (this.titleScroll + speed * dt) % Math.max(1, loopLen);

      
      const baseX = leftPadding - this.titleScroll;
      const color = rgba(255, 255, 255, this.entryProgress);
      drawText(titleText, Vector2(baseX, titleY), titleSize, color);
      drawText(
        titleText,
        Vector2(baseX + textWidth + gap, titleY),
        titleSize,
        color
      );
    } else {
      
      this.titleScroll = lerpDelta(this.titleScroll, 0, 0.2);
      drawText(
        titleText,
        Vector2(leftPadding, titleY),
        titleSize,
        rgba(255, 255, 255, this.entryProgress)
      );
    }

    if (scissorPushed) {
      EndScissorMode();
    }

    this.drawMapperLineWithInfo(subtitleY, subtitleSize);
  }

  private drawMapperLineWithInfo(y: number, fontSize: number): void {
    const starRating = this.mapData.starRating || 0;
    const starText = `${starRating.toFixed(1)} stars`;

    const duration = this.mapData.length || 0;
    let lengthText = "0:00";
    if (duration > 0) {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      lengthText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const mapperText = `Mapped by ${this.getMapperText()}`;
    const font = GuiGetFont();

    drawText(
      mapperText,
      Vector2(20, y),
      fontSize,
      rgba(255, 255, 255, this.entryProgress),
      "left"
    );

    const rawStarCount = Math.ceil(this.mapData.starRating || 0);
    const starCount = Math.min(rawStarCount, 12); 
    const starSpacing = 30 + this.expandProgress * 10;
    const starStartX = 20;
    const starIconsEndX = starStartX + starCount * starSpacing + 20; 

    const infoY = y + fontSize + 6 + this.expandProgress * 12; 
    const infoFontSize = fontSize * 0.9 + this.expandProgress * 3; 

    drawText(
      starText,
      Vector2(starIconsEndX, infoY),
      infoFontSize,
      rgba(230, 230, 230, this.entryProgress),
      "left"
    );

    const starTextSize = MeasureTextEx(font, starText, infoFontSize, 1);
    const durationX = starIconsEndX + starTextSize.x + 15; 

    drawText(
      lengthText,
      Vector2(durationX, infoY),
      infoFontSize,
      rgba(200, 200, 200, this.entryProgress),
      "left"
    );
  }

  private drawStarRating(): void {
    const rawStarCount = Math.ceil(this.mapData.starRating || 0);
    const starCount = Math.min(rawStarCount, 12); 
    const starSize = 24 + this.expandProgress * 8;
    const starSpacing = 30 + this.expandProgress * 10;
    const starY = 85 + this.expandProgress * 30;
    const starStartX = 20; 

    for (let i = 0; i < starCount; i++) {
      const starX = starStartX + starSpacing * i;

      drawSprite(
        "/star.png",
        Vector3(starX, starY, 0),
        Vector2(starSize, starSize),
        rgba(255, 255, 255, this.entryProgress)
      );
    }
  }

  private onHoverStart(): void {
    playFx("/click.wav", 0.2);
    this.isHovered = true;
  }

  private onHoverEnd(): void {
    this.isHovered = false;
  }

  private onPress(): boolean {
    if (MenuScene.isAnyOverlayOpen()) return true; 

    const mousePos = this.gameObject.getMousePosition();
    if (mousePos) {
      this.isPressed = true;
      this.pressStartPos = { x: mousePos.x, y: mousePos.y };
      this.hasDraggedBeyondThreshold = false;
    }

    return true;
  }

  private async selectAndCenterThenLoad(): Promise<void> {
    const wasAlreadySelected = MapButton.selectedButton === this;

    logger(
      `Map button ${this.index} ${
        wasAlreadySelected ? "reselected" : "selected"
      }: ${this.mapData.title}`
    );

    MapButton.selectedButton = this;

    const targetScrollY = this.baseY - (Rhythia.gameHeight / 2 - 65); 
    setScrollY(targetScrollY);

    if (wasAlreadySelected) {
      if (this.isMapLoaded) {
        this.startMapFromMenu();
      } else {
        logger(
          `⏳ Map "${this.mapData.title}" is still loading, play action deferred.`
        );
      }
      return;
    }

    this.isMapLoaded = false;

    setTimeout(() => {
      this.downloadBeatmap().catch((error) => {
        console.error("Failed to load beatmap:", error);
      });
    }, 50);
  }

  private startMapFromMenu(): void {
    try {
      const menuInstance = MenuScene.getInstance();
      if (menuInstance) {
        const started = menuInstance.playSelectedMap();
        if (!started) {
          logger(
            `⚠️  Play request ignored: Selected map data not ready for "${this.mapData.title}".`
          );
        }
      }
    } catch (error) {
      console.error("Failed to start selected map:", error);
    }
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
        this.isMapLoaded = true;
        this.notifySelectionComplete(true, mapId);
        return;
      }

      if (!this.mapData.beatmapFile) {
        console.warn(`No beatmap file URL for map ${mapId}`);
        this.isMapLoaded = false;
        this.notifySelectionComplete(
          false,
          mapId,
          new Error("Beatmap file URL is missing")
        );
        return;
      }

      this.downloadPopup = createPopup("download");
      this.downloadPopup.show("Downloading...");

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
        logger(`Successfully downloaded and processed`);

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
        this.isMapLoaded = true;
        this.downloadPopup?.hide();
        this.downloadPopup?.destroy();
        this.downloadPopup = null;
        this.notifySelectionComplete(true, mapId);
      } else {
        throw new Error("Failed to process beatmap file");
      }
    } catch (error) {
      console.error("Error downloading beatmap:", error);

      this.isMapLoaded = false;

      this.downloadPopup?.hide();
      this.downloadPopup?.destroy();
      this.downloadPopup = null;

      const errorPopup = createPopup("error");
      errorPopup.show("Failed to download");

      setTimeout(() => {
        errorPopup.hide();
        errorPopup.destroy();
      }, 2000);

      const mapId = this.mapData.id.toString();
      this.notifySelectionComplete(false, mapId, error);
    }
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public destroy(): void {
    const index = MapButton.allButtons.indexOf(this);
    if (index !== -1) {
      MapButton.allButtons.splice(index, 1);
    }

    if (MapButton.selectedButton === this) {
      MapButton.selectedButton = null;
    }

    this.gameObject.destroy();
  }

  public static clearAllButtons(): void {
    MapButton.allButtons = [];
    MapButton.selectedButton = null;
  }

  public static selectRelative(delta: number): void {
    if (this.allButtons.length === 0) return;

    let currentIndex = 0;
    if (this.selectedButton) {
      currentIndex = this.selectedButton.index;
    }
    const nextIndex = Math.max(
      0,
      Math.min(this.allButtons.length - 1, currentIndex + delta)
    );
    const target = this.allButtons[nextIndex];
    (target as any).selectAndCenterThenLoad?.();
  }

  public static selectFirstIfNone(): void {
    if (this.allButtons.length === 0) return;
    if (!this.selectedButton) {
      const target = this.allButtons[0];
      (target as any).selectAndCenterThenLoad?.();
    }
  }

  private getMapperText(): string {
    if (this.resolvedMapperText !== null) return this.resolvedMapperText;
    if (this.mapperResolved) return (this.mapData.ownerUsername || "Unknown").trim();
    this.mapperResolved = true;
    const owner = (this.mapData.ownerUsername || "").trim();
    try {
      const parsed = Maps.getParsed(String(this.mapData.id));
      const joined = parsed?.mappers && parsed.mappers.length > 0 ? parsed.mappers.join(", ") : owner;
      this.resolvedMapperText = (joined || "Unknown").trim();
      return this.resolvedMapperText;
    } catch {
      this.resolvedMapperText = owner || "Unknown";
      return this.resolvedMapperText;
    }
  }

  public static selectRandom(): void {
    if (this.allButtons.length === 0) return;
    const idx = Math.floor(Math.random() * this.allButtons.length);
    const target = this.allButtons[idx];
    (target as any).selectAndCenterThenLoad?.();
  }
}

export function createMapButton({
  mapContents,
  y,
  index,
}: {
  mapContents: BeatmapData;
  y: number;
  index: number;
}): GameObject {
  
  if (Rhythia.currentScene?.sceneName === "Game") {
    logger(
      `⛔ createMapButton blocked during Game scene for: ${
        mapContents.title || mapContents.id
      }`
    );
    return new GameObject();
  }

  const mapButton = new MapButton(mapContents, y, index);
  return mapButton.getGameObject();
}

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
