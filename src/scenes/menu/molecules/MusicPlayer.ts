import { Vector2, IsMouseButtonReleased, MOUSE_BUTTON_LEFT } from "raylib";
import { GameObject } from "../../../atoms/Object";
import { Rhythia } from "../../../atoms/Rhythia";
import { lerpDelta } from "../../../utils/lerp";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { AccentColor } from "../../../utils/imageBlur";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";

import { AlbumArt } from "./musicplayer/AlbumArt";
import { SongInfo } from "./musicplayer/SongInfo";
import { MapStats } from "./musicplayer/MapStats";
import { TimeSlider } from "./musicplayer/TimeSlider";
import { PlayButton } from "./musicplayer/PlayButton";
import { Leaderboard } from "./musicplayer/Leaderboard";
import { logger } from "../../../utils/logger";
import type { FinalResultsPayload } from "../../../utils/results";
import { FavoriteButton } from "./musicplayer/FavoriteButton";
import { isFavorite, toggleFavorite } from "../../../utils/storage/favorites";
import { VisualizeButton } from "./musicplayer/VisualizeButton";
import { ModeButtons } from "./musicplayer/ModeButtons";
import { SpeedContextMenu } from "./musicplayer/SpeedContextMenu";
import { GameScene } from "../../game";
import { createPopup } from "../atoms/Popup";
import { searchUsers } from "rhythia-api";
import { inRect } from "../../../utils/geometry";
import { MenuScene } from "..";
import { playFx } from "../../../utils/soundManager";

export class MusicPlayer {
  private gameObject: GameObject;
  private overlayGameObject: GameObject;
  private currentMap: SoundSpaceMemoryMap | null = null;
  private fadeProgress: number = 0;
  private slideProgress: number = 0;

  private albumArt: AlbumArt;
  private songInfo: SongInfo;
  private mapStats: MapStats;
  private timeSlider: TimeSlider;
  private playButton: PlayButton;
  private leaderboard: Leaderboard;
  private favoriteButton: FavoriteButton;
  private visualizeButton: VisualizeButton;
  private modeButtons: ModeButtons;
  private isCurrentFavorite: boolean = false;
  private currentOnlineId: string | null = null;
  private favoriteButtonPosition = { x: 0, y: 0 };
  private visualizeButtonPosition = { x: 0, y: 0 };
  private albumShiftProgress: number = 0;
  private authorRect: { x: number; y: number; w: number; h: number } = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
  private authorHovered: boolean = false;
  private openProfileHandler:
    | ((userId: number) => Promise<void> | void)
    | null = null;
  private openResultsHandler: ((payload: FinalResultsPayload) => void) | null =
    null;
  private mapperMenu: SpeedContextMenu | null = null;

  constructor() {
    this.gameObject = new GameObject({ zBase: 3 });
    this.overlayGameObject = new GameObject({ zBase: 20 });

    this.albumArt = new AlbumArt();
    this.songInfo = new SongInfo();
    this.mapStats = new MapStats();
    this.timeSlider = new TimeSlider();
    this.playButton = new PlayButton();
    this.leaderboard = new Leaderboard();
    this.leaderboard.setOnScoreClick((payload) => {
      this.openResultsHandler?.(payload);
    });
    this.favoriteButton = new FavoriteButton();
    this.visualizeButton = new VisualizeButton();
    this.modeButtons = new ModeButtons();

    this.initialize();
  }

  private initialize(): void {
    this.gameObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: Rhythia.gameHeight },
    });

    this.overlayGameObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: Rhythia.gameHeight },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.gameObject.onDraw = () => this.draw();

    this.overlayGameObject.onDraw = () => this.drawOverlay();

    this.gameObject.onUpdate = () => {
      try {
        if (MenuScene.isAnyOverlayOpen()) return;
      } catch {}
      try {
        if (this.modeButtons.isOverlayOpen()) return;
      } catch {}
      const mousePos = this.gameObject.getMousePosition();
      if (!mousePos) return;

      const scoreWidth = 300;
      const spacing = 24;
      const baseGroupCenterX = Rhythia.gameWidth / 4;
      const showLeaderboard = this.leaderboard.hasScores();
      const targetShift = showLeaderboard ? 1 : 0;
      this.albumShiftProgress = lerpDelta(
        this.albumShiftProgress,
        targetShift,
        0.15,
      );
      const shiftAmount = (spacing + scoreWidth) / 2;
      const albumCenterX =
        baseGroupCenterX - shiftAmount * this.albumShiftProgress;
      const topBarHeight = 60;
      const albumVerticalOffset = 30;
      const centerY =
        topBarHeight +
        50 +
        albumVerticalOffset +
        this.albumArt.getScaledSize() / 2;

      this.albumArt.setHovered(
        this.albumArt.isPointInAlbumArt(mousePos, albumCenterX, centerY),
      );
      this.albumArt.update();

      this.timeSlider.update(mousePos);

      const scaledSize = this.albumArt.getScaledSize();

      const leaderboardCenterY = centerY;
      const albumBottomY = topBarHeight + 50 + albumVerticalOffset + scaledSize;
      const titleY = albumBottomY + 50;

      this.leaderboard.update(
        mousePos,
        albumCenterX,
        leaderboardCenterY,
        scaledSize,
      );

      const playButtonY = titleY + 240 + 60;

      const contentCenterX = baseGroupCenterX;
      const playButtonClicked = this.playButton.update(
        mousePos,
        contentCenterX,
        playButtonY,
      );

      if (playButtonClicked) {
        this.onPlayButtonClicked();
      }

      const playButtonHalfWidth = 280 / 2;
      const visualizeX =
        contentCenterX -
        playButtonHalfWidth -
        this.visualizeButton.getSize() -
        20;
      this.visualizeButtonPosition = { x: visualizeX, y: playButtonY };
      const visualizeClicked = this.visualizeButton.update(
        mousePos,
        visualizeX,
        playButtonY,
      );

      if (visualizeClicked) {
        this.onVisualizeClicked();
      }

      const favX = contentCenterX + 280 / 2 + 20;
      const favY = playButtonY;
      this.favoriteButtonPosition = { x: favX, y: favY };
      const favClicked = this.favoriteButton.update(
        mousePos,
        favX,
        favY,
        this.isCurrentFavorite,
      );

      if (favClicked) {
        this.onFavoriteToggled();
      }

      const modeButtonsY = playButtonY + 65 + 16;
      const modeChange = this.modeButtons.update(
        mousePos,
        contentCenterX,
        modeButtonsY,
      );
      if (modeChange !== null) {
        try {
          this.leaderboard.refresh();
        } catch {}
      }

      this.updateAuthorHitbox();
      const r = this.authorRect;
      this.authorHovered = inRect(mousePos.x, mousePos.y, r.x, r.y, r.w, r.h);
      if (this.authorHovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        this.handleAuthorClick();
      }
    };
  }

  public refreshLeaderboard(): void {
    try {
      this.leaderboard.refresh();
    } catch {}
  }

  public setCurrentMap(
    map: SoundSpaceMemoryMap | null,
    mapImage?: string,
    difficulty?: number,
    onlineId?: string | null,
  ): void {
    if (map !== this.currentMap) {
      this.currentMap = map;

      if (map && difficulty !== undefined) {
        (map as any).difficulty = difficulty;
      }

      this.albumArt.setCurrentMap(map);
      this.songInfo.setCurrentMap(map);
      this.mapStats.setCurrentMap(map);
      this.timeSlider.setCurrentMap(map);
      this.leaderboard.setCurrentMap(map);

      this.slideProgress = 0;

      this.currentOnlineId = onlineId || null;
      if (map && this.currentOnlineId) {
        try {
          this.isCurrentFavorite = isFavorite(this.currentOnlineId);
        } catch {
          this.isCurrentFavorite = false;
        }
      } else {
        this.isCurrentFavorite = false;
      }
    }
  }

  private draw(): void {
    if (this.currentMap) {
      this.fadeProgress = lerpDelta(this.fadeProgress, 1, 0.15);
      this.slideProgress = lerpDelta(this.slideProgress, 1, 0.12);
    } else {
      this.fadeProgress = lerpDelta(this.fadeProgress, 0, 0.15);
      this.slideProgress = lerpDelta(this.slideProgress, 0, 0.12);
    }

    if (this.fadeProgress < 0.01) return;

    this.albumArt.setFadeProgress(this.fadeProgress);
    this.songInfo.setFadeProgress(this.fadeProgress);
    this.mapStats.setFadeProgress(this.fadeProgress);
    this.timeSlider.setFadeProgress(this.fadeProgress);
    this.playButton.setFadeProgress(this.fadeProgress);
    this.leaderboard.setFadeProgress(this.fadeProgress);

    if (this.currentMap) {
      const scoreWidth = 300;
      const spacing = 24;
      const baseGroupCenterX = Rhythia.gameWidth / 4;
      const shiftAmount = (spacing + scoreWidth) / 2;
      const albumCenterX =
        baseGroupCenterX - shiftAmount * this.albumShiftProgress;
      const topBarHeight = 60;
      const albumVerticalOffset = 30;
      const centerY =
        topBarHeight +
        50 +
        albumVerticalOffset +
        this.albumArt.getScaledSize() / 2;

      const leaderboardCenterY = centerY;

      const scaledSize = this.albumArt.getScaledSize();

      this.leaderboard.draw(albumCenterX, leaderboardCenterY, scaledSize);
      this.albumArt.draw(albumCenterX, centerY);
      const albumBottomY = topBarHeight + 50 + albumVerticalOffset + scaledSize;
      const titleY = albumBottomY + 50;

      const contentCenterX = baseGroupCenterX;
      this.songInfo.draw(contentCenterX, titleY);

      this.mapStats.draw(contentCenterX, titleY + 160);

      this.timeSlider.draw(contentCenterX, titleY + 240);

      this.playButton.draw(contentCenterX, titleY + 240 + 60);

      const favX = contentCenterX + 280 / 2 + 20;
      const favY = titleY + 240 + 60;
      const playButtonHalfWidth = 280 / 2;
      const visualizeX =
        contentCenterX -
        playButtonHalfWidth -
        this.visualizeButton.getSize() -
        20;
      this.visualizeButton.draw(visualizeX, favY);
      this.favoriteButton.draw(favX, favY);

      const modeButtonsY = favY + 65 + 16;
      this.modeButtons.draw(contentCenterX, modeButtonsY);
    }
  }

  private updateAuthorHitbox(): void {
    if (!this.currentMap || this.fadeProgress < 0.01) return;

    const baseGroupCenterX = Rhythia.gameWidth / 4;
    const centerX = baseGroupCenterX;
    const topBarHeight = 60;
    const albumVerticalOffset = 30;
    const scaledSize = this.albumArt.getScaledSize();
    const albumBottomY = topBarHeight + 50 + albumVerticalOffset + scaledSize;
    const titleY = albumBottomY + 50;

    const author = this.currentMap.mappers?.join(", ") || "Unknown Author";
    const maxAuthorLength = 40;
    const authorText = `mapped by ${author}`;
    const displayAuthor =
      authorText.length > maxAuthorLength
        ? authorText.substring(0, maxAuthorLength - 3) + "..."
        : authorText;

    const fontSize = 28;
    const size = measureText(displayAuthor, fontSize, 1);
    const x = centerX - size.width / 2;
    const y = titleY + 48;

    this.authorRect = { x, y, w: size.width, h: size.height };
  }

  private async handleAuthorClick(): Promise<void> {
    if (!this.currentMap) return;
    const mappers = this.currentMap.mappers || [];
    if (mappers.length > 1) {
      const items = mappers.map((m) => ({ id: m, label: m }));
      this.mapperMenu = new SpeedContextMenu({
        items,
        onSelect: (id: string) => {
          void this.openProfileForMapper(id);
        },
      });
      const r = this.authorRect;
      this.mapperMenu.openAtRect(r.x, r.y, r.w, r.h);
      return;
    }
    const mapper = (mappers && mappers[0]) || "";
    if (!mapper) return;
    await this.openProfileForMapper(mapper);
  }

  private async openProfileForMapper(mapper: string): Promise<void> {
    const popup = createPopup();
    popup.startLoading("Loading profile");
    try {
      const res: any = await searchUsers({ text: mapper });
      const users: any[] = res?.results || [];
      if (!users || users.length === 0) {
        popup.endLoading();
        return;
      }
      const found =
        users.find(
          (u: any) =>
            (u?.username || "").toLowerCase() === mapper.toLowerCase(),
        ) || users[0];
      const userId: number | undefined = found?.id;
      if (userId == null) {
        popup.endLoading();
        return;
      }
      const handler = this.openProfileHandler;
      if (handler) {
        await handler(userId);
      }
      popup.endLoading();
    } catch (e) {
      try {
        popup.endLoading();
      } catch {}
    }
  }

  public setOpenProfileHandler(
    handler: (userId: number) => Promise<void> | void,
  ): void {
    this.openProfileHandler = handler;
  }

  private drawOverlay(): void {
    if (!this.currentMap || this.fadeProgress <= 0) return;

    const visualizeSize = this.visualizeButton.getSize();
    if (this.visualizeButton.isHovered()) {
      this.drawTooltip(
        "Visualize map",
        this.visualizeButtonPosition.x + visualizeSize / 2,
        this.visualizeButtonPosition.y,
        visualizeSize,
      );
    }

    const favoriteSize = this.favoriteButton.getSize();
    if (this.favoriteButton.isHovered()) {
      const label = this.isCurrentFavorite
        ? "Remove from favorites"
        : "Add to favorites";
      this.drawTooltip(
        label,
        this.favoriteButtonPosition.x + favoriteSize / 2,
        this.favoriteButtonPosition.y,
        favoriteSize,
      );
    }

    if (this.authorHovered) {
      const r = this.authorRect;
      const mapper =
        (this.currentMap.mappers && this.currentMap.mappers[0]) || "";
      const label = mapper ? `View mappers` : "View mapper profile";
      this.drawTooltip(label, r.x + r.w / 2, r.y, r.h);
    }
  }

  private drawTooltip(
    label: string,
    centerX: number,
    elementTop: number,
    elementHeight: number,
  ): void {
    const fontSize = 18;
    const padX = 8;
    const padY = 6;

    const textSize = measureText(label, fontSize, 1);
    const boxW = textSize.width + padX * 2;
    const boxH = textSize.height + padY * 2;

    let boxX = centerX - boxW / 2;
    let boxY = elementTop - boxH - 8;

    if (boxY < 8) {
      boxY = elementTop + elementHeight + 8;
    }

    const horizontalPadding = 12;
    if (boxX < horizontalPadding) {
      boxX = horizontalPadding;
    }
    if (boxX + boxW > Rhythia.gameWidth - horizontalPadding) {
      boxX = Rhythia.gameWidth - horizontalPadding - boxW;
    }

    const textX = boxX + boxW / 2;

    drawSprite("/solid.png", Vector2(boxX, boxY), Vector2(boxW, boxH), {
      r: 0,
      g: 0,
      b: 0,
      a: 180,
    });

    drawSprite("/solid.png", Vector2(boxX, boxY + boxH - 2), Vector2(boxW, 2), {
      r: 255,
      g: 255,
      b: 255,
      a: 120,
    });

    drawText(
      label,
      Vector2(textX, boxY + padY),
      fontSize,
      { r: 255, g: 255, b: 255, a: 255 },
      "center",
    );
  }

  public playCurrentMap(): void {
    if (!this.currentMap) return;

    logger(`🚀 Starting game: ${this.currentMap.title}`);

    this.transitionToGame(true);
  }

  private onPlayButtonClicked(): void {
    this.playCurrentMap();
  }

  private onVisualizeClicked(): void {
    if (!this.currentMap) return;

    logger(`👁️  Visualizing map: ${this.currentMap?.title}`);

    this.transitionToGame(false);
  }

  private onFavoriteToggled(): void {
    if (!this.currentMap) return;
    if (!this.currentOnlineId) return;
    try {
      const nowFav = toggleFavorite(this.currentOnlineId);
      this.isCurrentFavorite = nowFav;
      logger(
        nowFav
          ? `⭐ Added to favorites: ${this.currentMap.title}`
          : `❌ Removed from favorites: ${this.currentMap.title}`,
      );

      try {
        const menuInstance = MenuScene.getInstance();
        if (menuInstance) {
          (menuInstance as any).refreshFavoritesIfActive?.();
        }
      } catch {}
    } catch (e) {}
  }

  private transitionToGame(isStandalone: boolean): void {
    try {
      const startMs = this.timeSlider.getStartTimeMs();
      logger(
        `transitionToGame: isStandalone=${isStandalone} startMs=${startMs} map=${
          this.currentMap?.title || "<none>"
        }`,
      );
    } catch {}

    if (isStandalone) {
      try {
        playFx("/match-start.wav");
      } catch {}
    }
    const gameScene = new GameScene(
      this.currentMap!,
      isStandalone,
      !isStandalone,
      undefined,
      this.timeSlider.getStartTimeMs(),
    );
    Rhythia.goToScene(gameScene, true, true);
  }

  public setOpenResultsHandler(
    handler: (payload: FinalResultsPayload) => void,
  ): void {
    this.openResultsHandler = handler;
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public getOverlayGameObject(): GameObject {
    return this.overlayGameObject;
  }

  public getCurrentMap(): SoundSpaceMemoryMap | null {
    return this.currentMap;
  }

  public getStartTimeMs(): number {
    return this.timeSlider.getStartTimeMs();
  }

  public setAccentColor(color: AccentColor | null): void {
    this.timeSlider.setAccentColor(color);
    this.leaderboard.setAccentColor(color);
    try {
      this.modeButtons.setAccentColor(color);
    } catch {}
    try {
      this.mapperMenu?.setAccentColor?.(color);
    } catch {}
  }

  public refreshLeaderboard(): void {
    this.leaderboard.refresh();
  }
}

export function createMusicPlayer(): MusicPlayer {
  return new MusicPlayer();
}
