import {
  Vector2,
  Vector3,
  IsKeyPressed,
  IsKeyDown,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_UP,
  KEY_DOWN,
  KEY_F2,
  GetScreenWidth,
  GetScreenHeight,
  GetCharPressed,
  GetKeyPressed,
  KEY_LEFT_SHIFT,
  KEY_RIGHT_SHIFT,
} from "raylib";
import { GameObject } from "../../atoms/Object";
import { Scene } from "../../atoms/Scene";
import { createMapButton, MapButton } from "./molecules/MapButton";
import { createSquareCard, SquareCard } from "./molecules/SquareCard";
import { createTopBar, TopBar } from "./molecules/TopBar";
import { createPopup, Popup } from "./atoms/Popup";
import { createModal, Modal } from "./atoms/Modal";
import {
  createDrawerFilters,
  DrawerFilters,
  SortOption,
  SortDirection,
} from "./molecules/DrawerFilters";
import { createProfileDrawer, ProfileDrawer } from "./molecules/ProfileDrawer";
import {
  createLeaderboardsDrawer,
  LeaderboardsDrawer,
} from "./molecules/LeaderboardsDrawer";
import { createVolumeKnob, VolumeKnob } from "./atoms/VolumeKnob";
import { createMusicPlayer, MusicPlayer } from "./molecules/MusicPlayer";
import {
  createBlurredBackground,
  BlurredBackground,
} from "./molecules/BlurredBackground";
import { drawSprite } from "../../utils/sprite";
import { drawText } from "../../utils/text";
import { WHITE } from "raylib";
import {
  updateScrollInput,
  updateScrollRender,
  setScrollBounds,
  getScrollY,
  addScrollOffset,
  setScrollY,
  setScrollYImmediate,
  updateScrollbarInteraction,
} from "../../utils/scroll";
import { Rhythia } from "../../atoms/Rhythia";
import { ProfileManager } from "../../utils/profileManager";
import { getBeatmaps, getBeatmapPage } from "rhythia-api";
import { BeatmapData } from "../../utils/types";
import * as fs from "fs";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import { CustomizationScene } from "../customization";
import { logger } from "../../utils/logger";
import { ConfigManager } from "../../utils/configManager";
import { consumeLastResults } from "../../utils/results";
import { ModeManager } from "../game/modes";
import {
  getVolumes,
  isMusicPlaying,
  playMusicFromStart,
  stopMusic,
  setMusicPitch,
  clearCache,
} from "../../utils/soundManager";
import {
  createResultsOverlay,
  ResultsOverlay,
} from "./molecules/ResultsOverlay";
import { shutdown } from "../../atoms/sysutils/shutdown";
import { exec } from "child_process";
import { importFromDialog, importFolder } from "./utils/importSSPM";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { openDialog } from "nativefiledialog";
import { loginWithDiscord } from "../../utils/auth/supabase";
import { loadFavoriteIds } from "../../utils/storage/favorites";
import { Maps } from "../../utils/maps";
import { applyShiftModifiers as kbApplyShift } from "../../utils/keyboard";

export class MenuScene extends Scene {
  sceneName: string = "Menu";
  private isInitialized: boolean = false;

  constructor() {
    super();
  }
  private topBar!: TopBar;
  private popup!: Popup;
  private modal!: Modal;
  private drawerFilters!: DrawerFilters;
  private profileDrawer!: ProfileDrawer;
  private leaderboardsDrawer!: LeaderboardsDrawer;
  private musicPlayer!: MusicPlayer;
  private blurredBackground!: BlurredBackground;
  private resultsOverlay!: ResultsOverlay;
  private masterVolumeKnob!: VolumeKnob;
  private musicVolumeKnob!: VolumeKnob;
  private fxVolumeKnob!: VolumeKnob;
  private navController: GameObject | null = null;
  private mapButtons: GameObject[] = [];
  private squareCards: GameObject[] = [];
  private allBeatmaps: BeatmapData[] = [];
  private allDownloadedBeatmaps: BeatmapData[] = [];
  private allFavoriteBeatmaps: BeatmapData[] = [];
  private currentMaps: BeatmapData[] = [];
  private currentPage: number = 1;
  private isLoadingMore: boolean = false;
  private hasMorePages: boolean = true;
  private readonly buttonHeight: number = 136;
  private readonly cardSize: number = 136;
  private readonly cardsPerRow: number = 6;
  private readonly cardSpacing: number = 20;
  private readonly topBarPadding: number = 40;
  private readonly loadThreshold: number = 500;
  private currentTab: string = ConfigManager.get().selectedTab || "Downloaded";
  private currentSearchTerm: string = "";
  private selectedMap: SoundSpaceMemoryMap | null = null;
  private selectedMapAudioPath: string | null = null;
  private lastSelectedOnlineId: string | null = null;
  private searchDebounceTimer: any;
  private alternativeViewMode: boolean =
    ConfigManager.get().alternativeViewMode || false;

  async init(): Promise<void> {
    Modal.hide();

    MapButton.clearAllButtons();

    (global as any).currentMenuScene = this;

    MenuScene.activeInstance = this;

    this.topBar = createTopBar();
    this.popup = createPopup();
    this.resultsOverlay = createResultsOverlay();
    this.modal = createModal();
    this.drawerFilters = createDrawerFilters();
    this.profileDrawer = createProfileDrawer();
    this.leaderboardsDrawer = createLeaderboardsDrawer();
    this.musicPlayer = createMusicPlayer();
    this.musicPlayer.setOpenProfileHandler(async (userId: number) => {
      await this.openProfileById(userId);
    });
    this.musicPlayer.setOpenResultsHandler((payload) => {
      this.resultsOverlay.show(payload);
    });
    this.blurredBackground = createBlurredBackground();
    this.blurredBackground.setBackgroundDrawnExternally(true);

    const leftX = 100;
    const verticalSpacing = 150;
    const fxRadius = 50;
    const bottomMargin = 60;
    const fxCenterY = Rhythia.gameHeight - fxRadius - bottomMargin;
    const centerY = fxCenterY - verticalSpacing;

    this.masterVolumeKnob = new VolumeKnob(
      Vector2(leftX, centerY),
      "master",
      "large",
    );

    this.musicVolumeKnob = new VolumeKnob(
      Vector2(leftX, centerY - verticalSpacing),
      "music",
      "small",
    );

    this.fxVolumeKnob = new VolumeKnob(
      Vector2(leftX, centerY + verticalSpacing),
      "fx",
      "small",
    );

    this.navController = new GameObject({ zBase: 2 });
    this.navController.onUpdate = () => {
      if (MenuScene.isAnyOverlayOpen()) return;
      if ((this.topBar as any)?.isSearchFocused?.()) return;

      let consumedChar = false;
      let typedSeed = "";
      let cp = GetCharPressed();
      while (cp > 0) {
        const ch = String.fromCodePoint(cp);
        if (/^[0-9a-zA-Z]$/.test(ch)) {
          typedSeed += ch;
          consumedChar = true;
        }
        cp = GetCharPressed();
      }

      if (!consumedChar) {
        const k = GetKeyPressed();
        if (k > 0) {
          let ch = String.fromCharCode(k);
          const shiftDown =
            IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT);
          if (shiftDown) ch = kbApplyShift(ch);
          else if (ch >= "A" && ch <= "Z") ch = ch.toLowerCase();
          if (/^[0-9a-zA-Z]$/.test(ch)) {
            typedSeed = ch;
            consumedChar = true;
          }
        }
      }

      if (consumedChar && typedSeed) {
        (this.topBar as any)?.focusSearch?.();
        (this.topBar as any)?.appendToSearch?.(typedSeed);
        return;
      }

      if (IsKeyPressed(KEY_F2)) {
        if (this.alternativeViewMode) {
          SquareCard.selectRandom();
        } else {
          MapButton.selectRandom();
        }
        return;
      }

      const nextPressed = IsKeyPressed(KEY_RIGHT) || IsKeyPressed(KEY_DOWN);
      const prevPressed = IsKeyPressed(KEY_LEFT) || IsKeyPressed(KEY_UP);
      if (!nextPressed && !prevPressed) return;

      const delta = nextPressed ? 1 : -1;
      if (this.alternativeViewMode) {
        SquareCard.selectRelative(delta);
      } else {
        MapButton.selectRelative(delta);
      }
    };

    this.blurredBackground.onAccentColorChange = (accentColor) => {
      this.topBar.setAccentColor(accentColor);
      this.drawerFilters.setAccentColor(accentColor);
      this.profileDrawer.setAccentColor(accentColor);
      this.leaderboardsDrawer.setAccentColor(accentColor);
      this.musicPlayer.setAccentColor(accentColor);
      this.masterVolumeKnob.setAccentColor(accentColor);
      this.musicVolumeKnob.setAccentColor(accentColor);
      this.fxVolumeKnob.setAccentColor(accentColor);
      this.popup.setAccentColor(accentColor);
      this.resultsOverlay.setAccentColor(accentColor);
    };

    const initialAccentColor = { r: 100, g: 100, b: 100 };
    this.topBar.setAccentColor(initialAccentColor);
    this.drawerFilters.setAccentColor(initialAccentColor);
    this.profileDrawer.setAccentColor(initialAccentColor);
    this.leaderboardsDrawer.setAccentColor(initialAccentColor);
    this.musicPlayer.setAccentColor(initialAccentColor);
    this.masterVolumeKnob.setAccentColor(initialAccentColor);
    this.musicVolumeKnob.setAccentColor(initialAccentColor);
    this.fxVolumeKnob.setAccentColor(initialAccentColor);
    this.popup.setAccentColor(initialAccentColor);
    this.resultsOverlay.setAccentColor(initialAccentColor);

    this.topBar.onTabChange = (title) => {
      this.handleTabChange(title);
    };

    this.topBar.onProfileClick = () => {
      const profileData = this.topBar.getProfileData();
      this.profileDrawer.setProfileData(profileData);
      this.profileDrawer.toggle();
    };

    this.topBar.onFilterClick = () => {
      this.drawerFilters.toggle();
    };

    this.topBar.onCustomizeClick = () => {
      Rhythia.goToScene(new CustomizationScene(this.selectedMap));
    };

    this.topBar.onToggleClick = (state: boolean) => {
      this.alternativeViewMode = state;
      ConfigManager.setAlternativeViewMode(state);
      if (state) {
        this.clearMapButtons();
        this.createSquareCards();
        logger("Alternative view mode enabled - showing square cards");
      } else {
        this.clearSquareCards();
        this.recreateMapButtons();
      }
    };

    this.topBar.onLeaderboardsClick = () => {
      this.leaderboardsDrawer.toggle();
    };

    this.topBar.onImportFolderClick = () => {
      void this.handleImportFolder();
    };

    this.topBar.onImportFromSSPM = () => {
      void this.handleImportSSPM();
    };
    this.topBar.onExportCurrentMap = () => {};
    this.topBar.onDeleteCurrentMap = () => {
      void this.handleDeleteCurrentMap();
    };
    this.topBar.onOpenGameFolder = () => {
      try {
        const targetPath = process.cwd();
        const command =
          process.platform === "win32"
            ? `explorer "${targetPath}"`
            : process.platform === "darwin"
              ? `open "${targetPath}"`
              : `xdg-open "${targetPath}"`;
        exec(command);
      } catch (e) {
        console.error("Failed to open game folder:", e);
      }
    };
    this.topBar.onExitGame = () => {
      try {
        shutdown();
      } catch (e) {
        console.error("Failed to exit game:", e);
      }
    };
    this.topBar.onRedownloadMap = () => {
      void this.handleRedownloadMap();
    };
    this.topBar.onReplaceCurrentAudio = () => {
      void this.handleReplaceCurrentAudio();
    };

    this.leaderboardsDrawer.onUserClick = (userId) => {
      this.leaderboardsDrawer.toggle();

      setTimeout(async () => {
        this.profileDrawer.toggle();
        await this.profileDrawer.loadProfileById(userId);
      }, 300);
    };

    this.drawerFilters.onStarFilterChange = (minStars, maxStars) => {
      this.handleStarFilterChange(minStars, maxStars);
    };

    this.topBar.onSearchChange = (searchTerm) => {
      this.handleSearchChangeDebounced(searchTerm);
    };

    this.drawerFilters.onDurationFilterChange = (minDuration, maxDuration) => {
      this.handleDurationFilterChange(minDuration, maxDuration);
    };

    this.drawerFilters.onSortChange = (option, direction) => {
      this.handleSortChange(option, direction);
    };

    const savedTab = ConfigManager.get().selectedTab || "Downloaded";

    if (savedTab === "Downloaded" || savedTab === "Favorites") {
      this.drawerFilters.setSortingEnabled(true);
    } else {
      this.drawerFilters.setSortingEnabled(false);
    }

    if (savedTab !== this.currentTab) {
      this.currentTab = savedTab;
    }

    logger(
      `MenuScene init: alternativeViewMode = ${this.alternativeViewMode}, currentTab = ${this.currentTab}`,
    );
    if (this.alternativeViewMode) {
      logger("Loading with alternative view mode enabled");
    }

    switch (savedTab) {
      case "Online Maps":
      case "Ranked":
      case "Legacy":
        await this.loadBeatmaps(1);
        break;
      case "Favorites":
        await this.loadFavoriteMaps();
        break;
      case "Downloaded":
      default:
        await this.loadDownloadedMaps();
        break;
    }

    this.popup.endLoading();

    this.isInitialized = true;
    logger("MenuScene fully initialized");

    const returned = consumeLastResults();
    if (returned) {
      this.resultsOverlay.show(returned);
    }
  }

  public refreshLeaderboard(): void {
    try {
      this.musicPlayer?.refreshLeaderboard?.();
    } catch {}
  }

  public drawScreenBackground(): void {
    try {
      (this.blurredBackground as any)?.drawScreenCover?.();
    } catch {}
  }

  private async loadBeatmaps(page: number): Promise<void> {
    this.popup.startLoading("Loading beatmaps");

    const requestTab = this.currentTab;

    try {
      const requestParams: any = {
        page: page,
        session: ProfileManager.get().token || "",
      };

      if (this.currentTab === "Ranked") {
        requestParams.status = "RANKED";
      } else if (this.currentTab === "Legacy") {
        requestParams.status = "APPROVED";
      }

      const { minStars, maxStars } = this.drawerFilters.getStarFilterValues();
      if (minStars > 0) {
        requestParams.minStars = minStars;
      }
      if (maxStars < 10) {
        requestParams.maxStars = maxStars;
      }

      if (this.currentSearchTerm && this.currentSearchTerm.trim().length > 0) {
        requestParams.textFilter = this.currentSearchTerm.trim();
      }

      const { minDuration, maxDuration } =
        this.drawerFilters.getDurationFilterValues();
      if (minDuration > 0) {
        requestParams.minLength = minDuration * 1000;
      }
      if (maxDuration < 300) {
        requestParams.maxLength = maxDuration * 1000;
      }

      const mapsRequest = await getBeatmaps(requestParams);
      const beatmaps = mapsRequest.beatmaps || [];

      if (this.currentTab !== requestTab) {
        logger(`📋 Tab changed during load: discarding ${requestTab} results`);
        this.popup.endLoading();
        return;
      }

      if (beatmaps.length === 0) {
        this.hasMorePages = false;
        this.popup.endLoading();
        return;
      }

      const processedBeatmaps = beatmaps.map((beatmap: any) => ({
        ...beatmap,
        length: beatmap.length
          ? Math.floor(beatmap.length / 1000)
          : beatmap.length,
      }));

      const startIndex = this.allBeatmaps.length;
      this.allBeatmaps.push(...processedBeatmaps);
      this.currentMaps.push(...processedBeatmaps);

      if (this.alternativeViewMode) {
        this.addNewSquareCards(processedBeatmaps, startIndex);
      } else {
        const topBarHeight = this.topBar.getHeight();
        for (let i = 0; i < processedBeatmaps.length; i++) {
          const beatmap = processedBeatmaps[i];
          const globalIndex = startIndex + i;
          const button = createMapButton({
            mapContents: beatmap,
            y:
              topBarHeight +
              this.topBarPadding +
              globalIndex * this.buttonHeight,
            index: globalIndex,
          });
          this.mapButtons.push(button);
        }
      }

      this.updateScrollBounds();

      logger(
        `📦 Loaded ${this.currentTab} page ${page}: +${processedBeatmaps.length} maps (${this.allBeatmaps.length} total)`,
      );
      this.popup.endLoading();
    } catch (error) {
      console.error(`Failed to load beatmaps page ${page}:`, error);
      this.hasMorePages = false;
      this.popup.endLoading();
    }
  }

  private handleTabChange(tabTitle: string): void {
    if (!this.isInitialized) {
      logger(
        `Tab change to ${tabTitle} ignored - MenuScene not yet initialized`,
      );
      return;
    }

    if (this.currentTab === tabTitle) {
      return;
    }

    const previousTab = this.currentTab;
    this.currentTab = tabTitle;
    ConfigManager.setSelectedTab(tabTitle);

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    this.drawerFilters.setSortingEnabled(
      tabTitle === "Downloaded" || tabTitle === "Favorites",
    );

    this.clearAllMaps();

    MapButton.clearAllButtons();

    if (previousTab !== "Downloaded" && tabTitle === "Downloaded") {
      MapButton.clearAllButtons();
    }

    this.currentPage = 1;
    this.hasMorePages = tabTitle !== "Favorites";
    this.isLoadingMore = false;

    if (tabTitle === "Downloaded") {
      this.loadDownloadedMaps();
    } else if (tabTitle === "Favorites") {
      this.loadFavoriteMaps();
    } else {
      this.loadBeatmaps(1);
    }
  }

  private async loadFavoriteMaps(): Promise<void> {
    try {
      this.popup.startLoading("Loading favorites...");
      await new Promise((r) => setTimeout(r, 100));

      const favIds: string[] = loadFavoriteIds();
      let source: BeatmapData[] = [];

      if (this.allDownloadedBeatmaps.length > 0) {
        source = this.allDownloadedBeatmaps;
      } else {
        const pre = (global as any).preloadedDownloadedMaps as
          | BeatmapData[]
          | undefined;
        if (pre && pre.length > 0) source = pre;
      }

      if (source.length === 0) {
        const listed = Maps.listDownloadedBeatmaps();
        source = listed;
      }

      const chosen = source.filter((m) => favIds.includes(String(m.id)));
      this.allFavoriteBeatmaps = [...chosen];
      this.allBeatmaps = [...chosen];
      this.currentMaps = [...chosen];

      this.filterFavoriteMaps();

      this.popup.endLoading();
    } catch {
      try { this.popup.endLoading(); } catch {}
    }
  }

  private filterFavoriteMaps(): void {
    for (const button of this.mapButtons) {
      button.destroy();
    }
    this.mapButtons = [];

    MapButton.clearAllButtons();

    const { minStars, maxStars } = this.drawerFilters.getStarFilterValues();
    const { minDuration, maxDuration } =
      this.drawerFilters.getDurationFilterValues();

    const filteredMaps = this.allFavoriteBeatmaps.filter((map) => {
      const starRating = map.starRating || map.difficulty || 0;
      const passesStars =
        starRating >= minStars && (maxStars >= 10 || starRating <= maxStars);

      const duration = map.length || 0;
      const passesDuration =
        duration >= minDuration &&
        (maxDuration >= 300 || duration <= maxDuration);

      let passesText = true;
      if (this.currentSearchTerm && this.currentSearchTerm.trim().length > 0) {
        const searchTerm = this.currentSearchTerm.trim().toLowerCase();
        const title = (map.title || "").toLowerCase();
        passesText = title.includes(searchTerm);
      }

      return passesStars && passesDuration && passesText;
    });

    this.allBeatmaps = filteredMaps;
    this.currentMaps = [...filteredMaps];

    if (this.alternativeViewMode) {
      this.createSquareCards();
    } else {
      const topBarHeight = this.topBar.getHeight();
      for (let i = 0; i < this.allBeatmaps.length; i++) {
        const button = createMapButton({
          mapContents: this.allBeatmaps[i],
          y: topBarHeight + this.topBarPadding + i * this.buttonHeight,
          index: i,
        });
        this.mapButtons.push(button);
      }
    }

    this.updateScrollBounds();
  }

  private handleStarFilterChange(minStars: number, maxStars: number): void {
    if (
      this.currentTab === "Online Maps" ||
      this.currentTab === "Ranked" ||
      this.currentTab === "Legacy"
    ) {
      this.clearAllMaps();

      MapButton.clearAllButtons();

      this.updateScrollBounds();

      this.currentPage = 1;
      this.hasMorePages = true;
      this.isLoadingMore = false;

      this.loadBeatmaps(1);
    } else if (this.currentTab === "Downloaded") {
      this.filterDownloadedMaps(minStars, maxStars);
    } else if (this.currentTab === "Favorites") {
      this.filterFavoriteMaps();
    }
  }

  private handleSortChange(option: SortOption, direction: SortDirection): void {
    if (option === "none") {
      this.currentMaps = [...this.allBeatmaps];
    } else {
      this.sortMaps(option, direction);
    }

    this.recreateMapButtons();
  }

  private sortMaps(option: SortOption, direction: SortDirection): void {
    const multiplier = direction === "asc" ? 1 : -1;

    this.currentMaps.sort((a, b) => {
      let comparison = 0;

      switch (option) {
        case "length":
          const aLength = a.length || 0;
          const bLength = b.length || 0;
          comparison = aLength - bLength;
          break;

        case "starRating":
          const aRating = a.starRating || 0;
          const bRating = b.starRating || 0;
          comparison = aRating - bRating;
          break;

        case "difficulty":
          const aDiff = a.difficulty || 0;
          const bDiff = b.difficulty || 0;
          comparison = aDiff - bDiff;
          break;

        case "none":
          comparison = 0;
          break;
      }

      return comparison * multiplier;
    });
  }

  private clearMapButtons(): void {
    for (const button of this.mapButtons) {
      button.destroy();
    }
    this.mapButtons = [];
    MapButton.clearAllButtons();
  }

  private clearSquareCards(): void {
    for (const card of this.squareCards) {
      card.destroy();
    }
    this.squareCards = [];
    SquareCard.clearAllCards();
  }

  private createSquareCards(): void {
    if (!this.alternativeViewMode) {
      logger("createSquareCards: Not in alternative view mode, skipping");
      return;
    }

    logger(`createSquareCards: Creating ${this.currentMaps.length} cards`);

    this.clearSquareCards();

    setScrollYImmediate(0);

    const topBarHeight = this.topBar.getHeight();
    const rightMargin = 60;
    const leftMargin = 50;

    const availableWidth = Rhythia.gameWidth - leftMargin - rightMargin;
    const totalSpacing = this.cardSpacing * (this.cardsPerRow - 1);
    const cardWidth = Math.floor(
      (availableWidth - totalSpacing) / this.cardsPerRow,
    );
    const actualCardSize = Math.min(cardWidth, this.cardSize);

    const gridWidth = actualCardSize * this.cardsPerRow + totalSpacing;
    const startX = Rhythia.gameWidth - rightMargin - gridWidth;

    for (let i = 0; i < this.currentMaps.length; i++) {
      const row = Math.floor(i / this.cardsPerRow);
      const col = i % this.cardsPerRow;

      const x = startX + col * (actualCardSize + this.cardSpacing);
      const y =
        topBarHeight +
        this.topBarPadding +
        row * (actualCardSize + this.cardSpacing);

      const card = createSquareCard({
        mapData: this.currentMaps[i],
        position: Vector2(x, y),
        size: actualCardSize,
        index: i,
      });

      this.squareCards.push(card);
    }

    logger(
      `createSquareCards: Created ${this.squareCards.length} square cards`,
    );

    this.updateScrollBounds();
  }

  private addNewSquareCards(
    newBeatmaps: BeatmapData[],
    startIndex: number,
  ): void {
    if (!this.alternativeViewMode) {
      return;
    }

    const topBarHeight = this.topBar.getHeight();
    const rightMargin = 60;
    const leftMargin = 50;

    const availableWidth = Rhythia.gameWidth - leftMargin - rightMargin;
    const totalSpacing = this.cardSpacing * (this.cardsPerRow - 1);
    const cardWidth = Math.floor(
      (availableWidth - totalSpacing) / this.cardsPerRow,
    );
    const actualCardSize = Math.min(cardWidth, this.cardSize);

    const gridWidth = actualCardSize * this.cardsPerRow + totalSpacing;
    const startX = Rhythia.gameWidth - rightMargin - gridWidth;

    for (let i = 0; i < newBeatmaps.length; i++) {
      const globalIndex = startIndex + i;
      const row = Math.floor(globalIndex / this.cardsPerRow);
      const col = globalIndex % this.cardsPerRow;

      const x = startX + col * (actualCardSize + this.cardSpacing);
      const y =
        topBarHeight +
        this.topBarPadding +
        row * (actualCardSize + this.cardSpacing);

      const card = createSquareCard({
        mapData: newBeatmaps[i],
        position: Vector2(x, y),
        size: actualCardSize,
        index: globalIndex,
      });
      this.squareCards.push(card);
    }
  }

  private recreateMapButtons(): void {
    setScrollYImmediate(0);

    if (this.alternativeViewMode) {
      this.createSquareCards();
      return;
    }

    this.clearMapButtons();

    const topBarHeight = this.topBar.getHeight();
    this.currentMaps.forEach((map, index) => {
      const yPosition = topBarHeight + 50 + index * 136;
      const mapButton = createMapButton({
        mapContents: map,
        y: yPosition,
        index: index,
      });
      this.mapButtons.push(mapButton);
    });

    this.updateScrollBounds();
  }

  private handleDurationFilterChange(
    minDuration: number,
    maxDuration: number,
  ): void {
    if (
      this.currentTab === "Online Maps" ||
      this.currentTab === "Ranked" ||
      this.currentTab === "Legacy"
    ) {
      this.clearAllMaps();

      MapButton.clearAllButtons();

      this.updateScrollBounds();

      this.currentPage = 1;
      this.hasMorePages = true;
      this.isLoadingMore = false;

      this.loadBeatmaps(1);
    } else if (this.currentTab === "Downloaded") {
      this.filterDownloadedMaps();
    } else if (this.currentTab === "Favorites") {
      this.filterFavoriteMaps();
    }
  }

  private handleSearchChangeDebounced(searchTerm: string): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.currentSearchTerm = searchTerm;

    if (this.currentTab === "Downloaded") {
      this.filterDownloadedMaps();
      return;
    }
    if (this.currentTab === "Favorites") {
      this.filterFavoriteMaps();
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.handleSearchChange(searchTerm);
      this.searchDebounceTimer = null;
    }, 500);
  }

  private handleSearchChange(searchTerm: string): void {
    if (
      this.currentTab === "Online Maps" ||
      this.currentTab === "Ranked" ||
      this.currentTab === "Legacy"
    ) {
      this.clearAllMaps();

      MapButton.clearAllButtons();

      this.updateScrollBounds();

      this.currentPage = 1;
      this.hasMorePages = true;
      this.isLoadingMore = false;

      this.loadBeatmaps(1);
    } else if (this.currentTab === "Downloaded") {
      this.filterDownloadedMaps();
    } else if (this.currentTab === "Favorites") {
      this.filterFavoriteMaps();
    }
  }

  private filterDownloadedMaps(minStars?: number, maxStars?: number): void {
    for (const button of this.mapButtons) {
      button.destroy();
    }
    this.mapButtons = [];

    MapButton.clearAllButtons();

    const { minStars: currentMinStars, maxStars: currentMaxStars } =
      this.drawerFilters.getStarFilterValues();
    const { minDuration: currentMinDuration, maxDuration: currentMaxDuration } =
      this.drawerFilters.getDurationFilterValues();
    const finalMinStars = minStars !== undefined ? minStars : currentMinStars;
    const finalMaxStars = maxStars !== undefined ? maxStars : currentMaxStars;

    const filteredMaps = this.allDownloadedBeatmaps.filter((map) => {
      const starRating = map.starRating || map.difficulty || 0;
      const passesMinFilter = starRating >= finalMinStars;
      const passesMaxFilter =
        finalMaxStars >= 10 || starRating <= finalMaxStars;

      const duration = map.length || 0;
      const passesDurationMinFilter = duration >= currentMinDuration;
      const passesDurationMaxFilter =
        currentMaxDuration >= 300 || duration <= currentMaxDuration;

      let passesTextFilter = true;
      if (this.currentSearchTerm && this.currentSearchTerm.trim().length > 0) {
        const searchTerm = this.currentSearchTerm.trim().toLowerCase();
        const title = (map.title || "").toLowerCase();

        passesTextFilter = title.includes(searchTerm);
      }

      return (
        passesMinFilter &&
        passesMaxFilter &&
        passesDurationMinFilter &&
        passesDurationMaxFilter &&
        passesTextFilter
      );
    });

    this.allBeatmaps = filteredMaps;
    this.currentMaps = [...filteredMaps];

    if (this.alternativeViewMode) {
      this.createSquareCards();
    } else {
      const topBarHeight = this.topBar.getHeight();
      for (let i = 0; i < this.allBeatmaps.length; i++) {
        const button = createMapButton({
          mapContents: this.allBeatmaps[i],
          y: topBarHeight + this.topBarPadding + i * this.buttonHeight,
          index: i,
        });
        this.mapButtons.push(button);
      }
    }

    this.updateScrollBounds();

    logger(
      `🔍 Filtered: ${this.allBeatmaps.length}/${this.allDownloadedBeatmaps.length} downloaded maps`,
    );
  }

  private clearAllMaps(): void {
    for (const button of this.mapButtons) {
      button.destroy();
    }

    this.clearSquareCards();

    this.mapButtons = [];
    this.allBeatmaps = [];
    this.currentMaps = [];

    setScrollYImmediate(0);
    setScrollBounds(0, 0);
  }

  private async loadDownloadedMaps(): Promise<void> {
    try {
      if (this.allDownloadedBeatmaps.length > 0) {
        logger(
          `📂 Using cached: ${this.allDownloadedBeatmaps.length} downloaded maps`,
        );

        this.allBeatmaps = [...this.allDownloadedBeatmaps];
        this.currentMaps = [...this.allDownloadedBeatmaps];

        if (this.alternativeViewMode) {
          logger(
            `Downloaded maps (cached): Creating square cards for ${this.allBeatmaps.length} maps`,
          );
          this.createSquareCards();
        } else {
          logger(
            `Downloaded maps (cached): Creating map buttons for ${this.allBeatmaps.length} maps`,
          );
          const topBarHeight = this.topBar.getHeight();
          for (let i = 0; i < this.allBeatmaps.length; i++) {
            const button = createMapButton({
              mapContents: this.allBeatmaps[i],
              y: topBarHeight + this.topBarPadding + i * this.buttonHeight,
              index: i,
            });
            this.mapButtons.push(button);
          }
        }

        this.updateScrollBounds();
        return;
      }

      const preloadedMaps = (global as any).preloadedDownloadedMaps as
        | BeatmapData[]
        | undefined;

      if (preloadedMaps && preloadedMaps.length > 0) {
        logger(`⚡ Loading ${preloadedMaps.length} preloaded downloaded maps`);

        this.allDownloadedBeatmaps = [...preloadedMaps];
        this.allBeatmaps = [...preloadedMaps];
        this.currentMaps = [...preloadedMaps];

        if (this.alternativeViewMode) {
          logger(
            `Preloaded maps: Creating square cards for ${this.allBeatmaps.length} maps`,
          );
          this.createSquareCards();
        } else {
          logger(
            `Preloaded maps: Creating map buttons for ${this.allBeatmaps.length} maps`,
          );
          const topBarHeight = this.topBar.getHeight();
          for (let i = 0; i < this.allBeatmaps.length; i++) {
            const button = createMapButton({
              mapContents: this.allBeatmaps[i],
              y: topBarHeight + this.topBarPadding + i * this.buttonHeight,
              index: i,
            });
            this.mapButtons.push(button);
          }
        }

        this.updateScrollBounds();

        delete (global as any).preloadedDownloadedMaps;

        return;
      }

      this.popup.startLoading("Loading downloaded maps...");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const listed = Maps.listDownloadedBeatmaps();
      this.allBeatmaps = [...listed];
      this.allDownloadedBeatmaps = [...listed];
      this.currentMaps = [...listed];
      if (!this.alternativeViewMode) {
        const topBarHeight = this.topBar.getHeight();
        for (let i = 0; i < this.allBeatmaps.length; i++) {
          const button = createMapButton({
            mapContents: this.allBeatmaps[i],
            y: topBarHeight + this.topBarPadding + i * this.buttonHeight,
            index: i,
          });
          this.mapButtons.push(button);
        }
      }

      if (this.alternativeViewMode) {
        this.createSquareCards();
      }

      this.updateScrollBounds();

      logger(`✅ Loaded ${this.allBeatmaps.length} downloaded maps`);

      this.popup.endLoading();
    } catch (error) {
      console.error("Failed to load downloaded maps:", error);
      this.popup.endLoading();
    }
  }

  private updateScrollBounds(): void {
    const topBarHeight = this.topBar.getHeight();

    logger(
      `updateScrollBounds: alternativeViewMode=${this.alternativeViewMode}, maps=${this.currentMaps.length}, squareCards=${this.squareCards.length}`,
    );

    if (this.alternativeViewMode) {
      const totalRows = Math.ceil(this.currentMaps.length / this.cardsPerRow);

      if (totalRows === 0) {
        setScrollBounds(0, 0);
        return;
      }

      const cardHeight = this.cardSize;
      const totalGridHeight =
        totalRows * (cardHeight + this.cardSpacing) - this.cardSpacing;
      const contentHeight = totalGridHeight + this.topBarPadding * 2;
      const viewportHeight = Rhythia.gameHeight - topBarHeight;

      if (contentHeight > viewportHeight) {
        const maxScroll = contentHeight - viewportHeight;
        logger(
          `Setting card grid scroll bounds: 0 to ${maxScroll} (content: ${contentHeight}, viewport: ${viewportHeight})`,
        );
        setScrollBounds(0, Math.max(0, maxScroll));
      } else {
        logger(
          `No scrolling needed for cards (content: ${contentHeight}, viewport: ${viewportHeight})`,
        );
        setScrollBounds(0, 0);
      }
      return;
    }

    const firstButtonY = topBarHeight + this.topBarPadding;
    const lastButtonY =
      firstButtonY + (this.allBeatmaps.length - 1) * this.buttonHeight;

    const minScroll = firstButtonY - (Rhythia.gameHeight / 2 - 65);

    const maxScroll = lastButtonY - (Rhythia.gameHeight / 2 - 65);

    setScrollBounds(Math.min(0, minScroll), Math.max(0, maxScroll));
  }

  private checkAndLoadMore(): void {
    if (
      this.isLoadingMore ||
      !this.hasMorePages ||
      this.currentTab === "Downloaded" ||
      this.currentTab === "Favorites"
    ) {
      return;
    }

    if (this.allBeatmaps.length === 0) {
      return;
    }

    const scrollY = getScrollY();
    const viewportHeight = Rhythia.gameHeight;

    let totalHeight: number;
    if (this.alternativeViewMode) {
      const totalRows = Math.ceil(this.allBeatmaps.length / this.cardsPerRow);
      const cardHeight = this.cardSize;
      const topBarHeight = this.topBar.getHeight();
      totalHeight =
        topBarHeight +
        this.topBarPadding +
        totalRows * (cardHeight + this.cardSpacing) -
        this.cardSpacing +
        this.topBarPadding;
    } else {
      totalHeight = this.allBeatmaps.length * this.buttonHeight;
    }

    const distanceFromBottom = totalHeight - (scrollY + viewportHeight);

    if (distanceFromBottom < this.loadThreshold) {
      this.isLoadingMore = true;
      const nextPage = this.currentPage + 1;

      logger(`📦 Loading more ${this.currentTab} maps (page ${nextPage})...`);

      this.loadBeatmaps(nextPage)
        .then(() => {
          this.currentPage = nextPage;
          this.isLoadingMore = false;
        })
        .catch((error) => {
          console.error("Failed to load more beatmaps:", error);
          this.isLoadingMore = false;
          this.hasMorePages = false;
        });
    }
  }

  public setSelectedMap(
    mapData: SoundSpaceMemoryMap,
    mapImage?: string,
    difficulty?: number,
    onlineId?: string | null,
  ): void {
    this.selectedMap = mapData;
    this.selectedMapAudioPath = this.resolveSelectedAudioPath(mapData);
    this.lastSelectedOnlineId = onlineId || null;
    logger(
      `🎵 Selected: ${mapData.title}${difficulty ? ` (${difficulty}★)` : ""}`,
    );

    this.musicPlayer.setCurrentMap(mapData, mapImage, difficulty, onlineId);

    this.blurredBackground.setBackground(
      mapImage || null,
      (onlineId || mapData.id?.toString() || null) as any,
    );
  }

  public playSelectedMap(): boolean {
    if (!this.selectedMap) {
      logger("⚠️  Cannot start map: no map selected yet.");
      return false;
    }

    this.musicPlayer.playCurrentMap();
    return true;
  }

  private async handleImportSSPM(): Promise<void> {
    await importFromDialog({
      popup: this.popup,
      switchToDownloaded: async () => {
        ConfigManager.setSelectedTab("Downloaded");
        this.currentTab = "Downloaded";
        this.topBar.goToTab("Downloaded");
        this.clearAllMaps();
        this.allDownloadedBeatmaps = [];
        await this.loadDownloadedMaps();
      },
      selectMap: (result) => {
        this.setSelectedMap(
          result,
          result.onlineImage,
          (result as any).difficulty,
          result.id,
        );
      },
    });
  }

  private async handleImportFolder(): Promise<void> {
    await importFolder({
      popup: this.popup,
      onComplete: async (imported) => {
        ConfigManager.setSelectedTab("Downloaded");
        this.currentTab = "Downloaded";
        this.topBar.goToTab("Downloaded");
        this.clearAllMaps();
        if (imported > 0) this.allDownloadedBeatmaps = [];
        await this.loadDownloadedMaps();
      },
    });
  }

  private async handleDeleteCurrentMap(): Promise<void> {
    const map = this.selectedMap;
    if (!map) return;

    stopMusic();
    const removed = Maps.deleteLocalMap(map);

    const idStr = String(map.id || "");
    this.allDownloadedBeatmaps = this.allDownloadedBeatmaps.filter(
      (m) => String(m.id) !== idStr,
    );
    this.allFavoriteBeatmaps = this.allFavoriteBeatmaps.filter(
      (m) => String(m.id) !== idStr,
    );
    if (this.currentTab === "Downloaded" || this.currentTab === "Favorites") {
      this.allBeatmaps = this.allBeatmaps.filter((m) => String(m.id) !== idStr);
      this.currentMaps = this.currentMaps.filter((m) => String(m.id) !== idStr);
    }

    this.selectedMap = null;
    this.selectedMapAudioPath = null;
    this.musicPlayer.setCurrentMap(null);
    this.blurredBackground.setBackground(null, null);

    if (this.currentTab === "Downloaded") {
      this.clearAllMaps();
      MapButton.clearAllButtons();
      this.allDownloadedBeatmaps = [];
      await this.loadDownloadedMaps();
    } else if (this.currentTab === "Favorites") {
      this.clearAllMaps();
      MapButton.clearAllButtons();
      this.loadFavoriteMaps();
    }

    if (removed) {
      const ok = createPopup();
      ok.show("Map deleted");
      setTimeout(() => {
        ok.hide();
        ok.destroy();
      }, 1200);
    }
  }

  private async handleReplaceCurrentAudio(): Promise<void> {
    const map = this.selectedMap;
    if (!map) return;
    const popup = createPopup();
    try {
      popup.startLoading("Select an audio file");
      const picked: string = openDialog({ audio: "mp3,wav,ogg,flac,m4a" } as any);
      if (!picked) {
        popup.endLoading();
        return;
      }
      popup.startLoading("Replacing audio...");
      const prev = map;
      const oldPath = this.resolveSelectedAudioPath(prev);
      stopMusic();
      this.selectedMap = null;
      this.selectedMapAudioPath = null;
      try { this.musicPlayer.setCurrentMap(null); } catch {}
      try { this.blurredBackground.setBackground(null, null); } catch {}
      await Maps.ensure();
      clearCache();
      const ext = path.extname(picked).toLowerCase();
      const allowed = [".mp3", ".wav", ".ogg", ".flac", ".m4a"];
      const idStr = (prev.id || "").toString();
      let filename = (prev.audioFileName || "").trim();
      if (allowed.includes(ext)) {
        if (filename) {
          const base = filename.replace(/\.[^\.]+$/, "");
          filename = `${base}${ext}`;
        } else if (idStr) {
          filename = `${idStr}${ext}`;
        }
      } else {
        if (!filename && idStr) filename = `${idStr}.mp3`;
      }
      const dest = filename ? `./cache/audio/${filename}` : oldPath;
      if (!dest) {
        popup.endLoading();
        return;
      }
      try { await fsPromises.mkdir("./cache/audio", { recursive: true }); } catch {}
      const buf = await fsPromises.readFile(picked);
      try {
        await fsPromises.writeFile(dest, buf);
      } catch (e: any) {
        if (e && e.code === "EBUSY") {
          await new Promise((r) => setTimeout(r, 200));
          await fsPromises.writeFile(dest, buf);
        } else {
          throw e;
        }
      }
      if (oldPath && dest !== oldPath) {
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
      }
      if (prev.id != null && filename) {
        try {
          const parsedPath = `./cache/parsed/${prev.id}`;
          if (fs.existsSync(parsedPath)) {
            const parsed = JSON.parse(await fsPromises.readFile(parsedPath, "utf-8"));
            parsed.audioFileName = filename;
            await fsPromises.writeFile(parsedPath, JSON.stringify(parsed, null, 2));
          }
        } catch {}
        prev.audioFileName = filename as any;
      }
      clearCache();
      this.setSelectedMap(prev, prev.onlineImage, (prev as any).difficulty, (prev.id as any)?.toString?.() || null);
      try {
        const p = this.resolveSelectedAudioPath(prev);
        if (p) {
          const { music } = getVolumes();
          playMusicFromStart(p, music);
        }
      } catch {}
      popup.endLoading();
      const ok = createPopup("info");
      ok.show("Audio replaced");
      setTimeout(() => {
        ok.hide();
        ok.destroy();
      }, 1200);
    } catch (e) {
      try { console.error("Replace audio failed:", e); } catch {}
      try { popup.endLoading(); } catch {}
      const p = createPopup("error");
      p.show("Replace failed");
      setTimeout(() => {
        p.hide();
        p.destroy();
      }, 1500);
    }
  }

  private async handleRedownloadMap(): Promise<void> {
    const map = this.selectedMap;
    if (!map) return;
    const raw = (this.lastSelectedOnlineId ?? map.id ?? "").toString().trim();
    const m = raw.match(/\d+/);
    const numericId = m ? parseInt(m[0], 10) : NaN;
    if (!Number.isFinite(numericId)) {
      const p = createPopup("error");
      p.show("No online id for this map");
      setTimeout(() => { p.hide(); p.destroy(); }, 1400);
      return;
    }
    const popup = createPopup();
    try {
      popup.startLoading("Redownloading...");
      stopMusic();
      clearCache();
      try {
        const idStr = String(numericId);
        const candidates: string[] = [];
        const afn = (map.audioFileName || "").trim();
        if (afn) candidates.push(`./cache/audio/${afn}`);
        for (const ext of [".mp3", ".wav", ".ogg", ".flac", ".m4a"]) {
          candidates.push(`./cache/audio/${idStr}${ext}`);
        }
        for (const p of candidates) {
          try {
            if (fs.existsSync(p)) {
              try { fs.unlinkSync(p); }
              catch { try { fs.renameSync(p, `${p}.old_${Date.now()}`); } catch {} }
            }
          } catch {}
        }
      } catch {}
      const token = ProfileManager.get().token || "";
      const resp = await getBeatmapPage({ session: token as any, id: numericId as any });
      const bm = (resp as any)?.beatmap;
      const url: string | undefined = bm?.beatmapFile || undefined;
      if (!url) {
        popup.endLoading();
        const e = createPopup("error");
        e.show("No file for this map");
        setTimeout(() => { e.hide(); e.destroy(); }, 1400);
        return;
      }
      await Maps.ensure();
      const onlineData = {
        starRating: bm?.starRating || 0,
        status: bm?.status || "UNRANKED",
        onlineId: String(numericId),
        onlineImage: bm?.image || "",
      };
      const result = await Maps.fetchAndAdd(url, onlineData);
      if (!result) throw new Error("Download failed");
      this.setSelectedMap(result, bm?.image || "", bm?.difficulty || 0, String(numericId));
      try {
        const path = Maps.audioPath(String(numericId), result);
        if (path && fs.existsSync(path)) {
          const { music } = getVolumes();
          playMusicFromStart(path, music);
        }
      } catch {}
      popup.endLoading();
      const ok = createPopup("info");
      ok.show("Map redownloaded");
      setTimeout(() => { ok.hide(); ok.destroy(); }, 1200);
    } catch (err) {
      try { console.error("Redownload failed:", err); } catch {}
      try { popup.endLoading(); } catch {}
      const e = createPopup("error");
      e.show("Redownload failed");
      setTimeout(() => { e.hide(); e.destroy(); }, 1500);
    }
  }

  public async openProfileById(userId: number): Promise<void> {
    try {
      await new Promise((r) => setTimeout(r, 100));
      if (!this.profileDrawer.isDrawerOpen()) {
        this.profileDrawer.toggle();
      }
      await this.profileDrawer.loadProfileById(userId);
    } catch {}
  }

  public static getInstance(): MenuScene | null {
    return (global as any).currentMenuScene || null;
  }

  public static isAnyOverlayOpen(): boolean {
    return MenuScene.activeInstance?.isAnyOverlayActive() || false;
  }

  private static activeInstance: MenuScene | null = null;

  public isAnyOverlayActive(): boolean {
    const drawerOpen =
      this.drawerFilters.isDrawerOpen() ||
      this.profileDrawer.isDrawerOpen() ||
      this.leaderboardsDrawer.isDrawerOpen();
    const resultsBlocking = this.resultsOverlay?.isBlocking?.() || false;
    const menuOpen = (this.topBar as any)?.isMenuOpen?.() || false;
    return drawerOpen || resultsBlocking || menuOpen;
  }

  public refreshFavoritesIfActive(): void {
    if (this.currentTab === "Favorites") {
      this.clearAllMaps();
      this.loadFavoriteMaps();
    }
  }

  render(): void {
    updateScrollInput();
    const metrics = this.getScrollBarMetrics();
    if (metrics) {
      const {
        scrollBarX,
        scrollBarY,
        scrollBarWidth,
        scrollBarHeight,
        totalContentHeight,
        viewportHeight,
      } = metrics;
      updateScrollbarInteraction(
        {
          x: scrollBarX,
          y: scrollBarY,
          width: scrollBarWidth,
          height: scrollBarHeight,
        },
        totalContentHeight,
        viewportHeight,
      );
    }
    updateScrollRender();

    this.checkAndLoadMore();

    GameObject.updateAll();
    GameObject.drawAll();

    this.drawScrollThumb();
  }

  private drawScrollThumb(): void {
    const metrics = this.getScrollBarMetrics();
    if (!metrics) return;

    const {
      scrollBarX,
      scrollBarY,
      scrollBarWidth,
      scrollBarHeight,
      totalContentHeight,
      viewportHeight,
    } = metrics;
    if (totalContentHeight <= viewportHeight) return;

    const scrollRatio = viewportHeight / totalContentHeight;
    const thumbHeight = Math.max(20, scrollBarHeight * scrollRatio);
    const currentScrollY = getScrollY();
    const maxScroll = totalContentHeight - viewportHeight;
    const scrollProgress = Math.max(
      0,
      Math.min(1, currentScrollY / Math.max(1, maxScroll)),
    );
    const thumbY =
      scrollBarY + (scrollBarHeight - thumbHeight) * scrollProgress;

    drawSprite(
      "/solid.png",
      Vector2(scrollBarX, scrollBarY),
      Vector2(scrollBarWidth, scrollBarHeight),
      { r: 40, g: 40, b: 40, a: 100 },
    );

    drawSprite(
      "/solid.png",
      Vector2(scrollBarX, thumbY),
      Vector2(scrollBarWidth, thumbHeight),
      { r: 120, g: 120, b: 120, a: 180 },
    );
  }

  private getScrollBarMetrics(): {
    scrollBarX: number;
    scrollBarY: number;
    scrollBarWidth: number;
    scrollBarHeight: number;
    totalContentHeight: number;
    viewportHeight: number;
  } | null {
    if (this.currentMaps.length === 0) return null;

    const scrollBarWidth = 8;
    const scrollBarHeight = Rhythia.gameHeight - this.topBar.getHeight() - 40;
    const scrollBarX = Rhythia.gameWidth - scrollBarWidth - 15;
    const scrollBarY = this.topBar.getHeight() + 20;

    let totalContentHeight: number;
    const viewportHeight = Rhythia.gameHeight - this.topBar.getHeight();

    if (this.alternativeViewMode) {
      const totalRows = Math.ceil(this.currentMaps.length / this.cardsPerRow);
      totalContentHeight =
        totalRows * (this.cardSize + this.cardSpacing) -
        this.cardSpacing +
        this.topBarPadding * 2;
    } else {
      const totalMaps = this.currentMaps.length;
      totalContentHeight =
        totalMaps * this.buttonHeight + this.topBarPadding * 2;
    }

    return {
      scrollBarX,
      scrollBarY,
      scrollBarWidth,
      scrollBarHeight,
      totalContentHeight,
      viewportHeight,
    };
  }

  pause(): void {
    logger(
      `⏸️  Menu state preserved: ${this.currentMaps.length} maps, tab=${this.currentTab}`,
    );
  }

  resume(): void {
    logger(
      `▶️  Menu state restored: ${this.currentMaps.length} maps, tab=${this.currentTab}`,
    );

    const mode = ModeManager.getMode();
    setMusicPitch(mode.musicPitch ?? 1.0);

    const returned = consumeLastResults();
    if (returned) {
      this.resultsOverlay.show(returned);
    }
    this.restartSelectedPreview();

    try {
      this.musicPlayer.refreshLeaderboard();
    } catch {}
  }

  private restartSelectedPreview(): void {
    if (isMusicPlaying()) return;

    const resultsBlocking = this.resultsOverlay?.isBlocking?.() || false;
    if (resultsBlocking) return;
    if (!this.selectedMapAudioPath) return;

    try {
      const { music } = getVolumes();

      playMusicFromStart(this.selectedMapAudioPath, music);
    } catch (error) {
      logger(`Failed to restart menu preview: ${(error as Error).message}`);
    }
  }

  private resolveSelectedAudioPath(
    mapData: SoundSpaceMemoryMap,
  ): string | null {
    const explicitFile = mapData.audioFileName?.trim();
    if (explicitFile) {
      return `./cache/audio/${explicitFile}`;
    }

    const id = mapData.id?.toString().trim();
    if (id) {
      return `./cache/audio/${id}.mp3`;
    }

    return null;
  }

  destroy(): void {
    if (this.popup) {
      this.popup.destroy();
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }
}
