import {
  Vector2,
  Vector3,
  Color,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  GetScreenWidth,
} from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";
import {
  rgba,
  rgb,
  tintWithAccent,
  accentBackground,
  accentWithHover,
} from "../../../utils/colors";
import { lerpDelta } from "../../../utils/lerp";
import { playFx } from "../../../utils/soundManager";
import { getProfile } from "rhythia-api";
import { ProfileManager } from "../../../utils/profileManager";
import { AccentColor } from "../../../utils/imageBlur";
import { createInputBox, InputBox } from "../atoms/InputBox";
import { Popup } from "../atoms/Popup";
import { logger } from "../../../utils/logger";
import { ConfigManager } from "../../../utils/configManager";
import { loginWithDiscord } from "../../../utils/auth/supabase";
import { createTopContextMenu, TopContextMenu } from "./TopContextMenu";
import { MenuScene } from "..";

interface TabButton {
  label: string;
  x: number;
  width: number;
  isActive: boolean;
  isHovered: boolean;
  hoverProgress: number;
}

interface ProfileData {
  id?: number;
  created_at?: number | null;
  position?: number | null;
  about_me?: string | null;
  avatar_url?: string | null;
  profile_image?: string | null;
  flag?: string | null;
  uid?: string | null;
  ban?: string | null;
  username?: string | null;
  verified?: boolean | null;
  verificationDeadline?: number | null;
  play_count?: number | null;
  skill_points?: number | null;
  squares_hit?: number | null;
  total_score?: number | null;
  is_online?: boolean;
  badges?: any;
}

export class TopBar {
  private gameObject: GameObject;
  private tabs: TabButton[] = [];
  private activeTabIndex: number = 4; 
  private readonly barHeight: number = 70;
  private readonly tabStartX: number = 15;
  private readonly tabSpacing: number = 8;
  private readonly tabPadding: number = 20;
  private profileData: ProfileData | null = null;
  private accentColor: AccentColor | null = null;
  private searchInput: InputBox | null = null;
  private searchInputX: number = 0;
  private menuButtonX: number = 0;
  private filterButtonX: number = 0;
  private filterButtonHover: number = 0;
  private isFilterHovered: boolean = false;
  private customizeButtonX: number = 0;
  private customizeButtonHover: number = 0;
  private isCustomizeHovered: boolean = false;
  private leaderboardsButtonX: number = 0;
  private leaderboardsButtonHover: number = 0;
  private isLeaderboardsHovered: boolean = false;
  
  private toggleButtonX: number = 0;
  private toggleButtonHover: number = 0;
  private isToggleHovered: boolean = false;
  private toggleState: boolean =
    ConfigManager.get().alternativeViewMode || false;
  private toggleAnimationProgress: number = ConfigManager.get()
    .alternativeViewMode
    ? 1
    : 0;
  private profileStatus: "loading" | "ready" | "unauthenticated" | "error" =
    "loading";

  
  private topMenu!: TopContextMenu;

  onTabChange = (tabTitle: string) => {};
  onProfileClick = () => {}; 
  onFilterClick = () => {}; 
  onCustomizeClick = () => {}; 
  onLeaderboardsClick = () => {}; 
  onImportFolderClick = () => {};
  onToggleClick = (state: boolean) => {}; 
  onSearchChange = (searchTerm: string) => {}; 
  
  onImportFromSSPM = () => {};
  onExportCurrentMap = () => {};
  onReplaceCurrentAudio = () => {};
  onRedownloadMap = () => {};
  onDeleteCurrentMap = () => {};
  onOpenGameFolder = () => {};
  onExitGame = () => {};
  constructor() {
    this.gameObject = new GameObject({ zBase: 4 }); 
    this.initialize();
    this.loadProfile();
  }

  

  private initialize(): void {
    this.tabs = [
      {
        label: "Ranked",
        x: this.tabStartX,
        width: 0,
        isActive: false,
        isHovered: false,
        hoverProgress: 0,
      },
      {
        label: "Legacy",
        x: 0,
        width: 0,
        isActive: false,
        isHovered: false,
        hoverProgress: 0,
      },
      {
        label: "Online Maps",
        x: 0,
        width: 0,
        isActive: false,
        isHovered: false,
        hoverProgress: 0,
      },
      {
        label: "Favorites",
        x: 0,
        width: 0,
        isActive: false,
        isHovered: false,
        hoverProgress: 0,
      },
      {
        label: "Downloaded",
        x: 0,
        width: 0,
        isActive: false,
        isHovered: false,
        hoverProgress: 0,
      },
    ];

    const savedTab = ConfigManager.get().selectedTab;
    if (savedTab) {
      const tabIndex = this.tabs.findIndex((tab) => tab.label === savedTab);
      if (tabIndex !== -1) {
        this.activeTabIndex = tabIndex;
        this.tabs[tabIndex].isActive = true;
      } else {
        this.activeTabIndex = 4;
        this.tabs[4].isActive = true;
      }
    } else {
      this.tabs[4].isActive = true;
    }

    this.calculateTabDimensions();

    this.createSearchInput();

    this.gameObject.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: this.barHeight },
    });

    this.setupEventHandlers();
    this.topMenu = createTopContextMenu({
      onImportFromSSPM: () => this.onImportFromSSPM(),
      onImportFolder: () => this.onImportFolderClick(),
      onExportCurrentMap: () => this.onExportCurrentMap(),
      onReplaceCurrentAudio: () => this.onReplaceCurrentAudio(),
      onRedownloadMap: () => this.onRedownloadMap(),
      onDeleteCurrentMap: () => this.onDeleteCurrentMap(),
      onOpenGameFolder: () => this.onOpenGameFolder(),
      onExitGame: () => this.onExitGame(),
    });
    this.topMenu.setBarHeight(this.barHeight);
    
    try {
      this.topMenu.setButtonX(this.menuButtonX);
    } catch {}

    loginWithDiscord(true).then((e) => {
      this.loadProfile();
    });
  }

  private async loadProfile(): Promise<void> {
    try {
      this.profileStatus = "loading";
      const token = ProfileManager.get().token;
      if (!token) {
        console.warn("No token available for profile loading");
        this.profileStatus = "unauthenticated";
        this.profileData = null;
        return;
      }

      const profile = await getProfile({ session: token || "" });
      if (profile?.user) {
        this.profileData = profile.user;
        this.profileStatus = "ready";
        logger("Profile loaded:", this.profileData);
      } else {
        this.profileData = null;
        this.profileStatus = "unauthenticated";
        logger("Profile unavailable for current session");
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      this.profileData = null;
      this.profileStatus = "error";
    }
  }

  private calculateTabDimensions(): void {
    for (const tab of this.tabs) {
      tab.width = tab.label.length * 10 + this.tabPadding * 2;
    }

    const inputWidth = 280;
    const buttonWidth = 32; 
    const toggleWidth = 56; 
    const spacing = 20;

    let totalTabsWidth = 0;
    for (const tab of this.tabs) {
      totalTabsWidth += tab.width;
    }
    totalTabsWidth += (this.tabs.length - 1) * this.tabSpacing;

    const totalWidth =
      toggleWidth +
      spacing +
      buttonWidth +
      spacing +
      buttonWidth +
      spacing +
      buttonWidth +
      spacing +
      totalTabsWidth +
      spacing +
      inputWidth +
      spacing +
      buttonWidth; 

    const rightMargin = 20;
    let currentX = Rhythia.gameWidth - totalWidth - rightMargin;

    this.toggleButtonX = currentX;
    currentX += toggleWidth + spacing;

    this.customizeButtonX = currentX;
    currentX += buttonWidth + spacing;

    this.leaderboardsButtonX = currentX;
    currentX += buttonWidth + spacing;

    this.filterButtonX = currentX;
    currentX += buttonWidth + spacing;

    for (const tab of this.tabs) {
      tab.x = currentX;
      currentX += tab.width + this.tabSpacing;
    }

    this.searchInputX = currentX - this.tabSpacing + spacing;
    
    this.menuButtonX = this.searchInputX + inputWidth + spacing;
    if (this.topMenu) {
      this.topMenu.setButtonX(this.menuButtonX);
    }
  }

  private setupEventHandlers(): void {
    this.gameObject.onDraw = () => this.draw();

    this.gameObject.onUpdate = () => this.updateHover();

    this.gameObject.rectArea!.onClick = () => {
      return this.handleClick(); 
    };
  }

  private updateHover(): void {
    const overlayBlocked = (() => {
      try {
        return MenuScene.isAnyOverlayOpen();
      } catch {
        return false;
      }
    })();
    if (Popup.isAnyPopupLoading() || overlayBlocked) {
      for (const tab of this.tabs) {
        tab.isHovered = false;
        tab.hoverProgress = lerpDelta(tab.hoverProgress, 0, 0.15);
      }
      this.filterButtonHover = lerpDelta(this.filterButtonHover, 0, 0.15);
      this.customizeButtonHover = lerpDelta(this.customizeButtonHover, 0, 0.15);
      this.toggleButtonHover = lerpDelta(this.toggleButtonHover, 0, 0.15);
      this.leaderboardsButtonHover = lerpDelta(
        this.leaderboardsButtonHover,
        0,
        0.15
      );
      this.isFilterHovered = false;
      this.isCustomizeHovered = false;
      this.isToggleHovered = false;
      this.isLeaderboardsHovered = false;
      

      return;
    }

    const mousePos = this.gameObject.getMousePosition();

    if (mousePos && mousePos.y >= 0 && mousePos.y <= this.barHeight) {
      const buttonWidth = 32;
      const isFilterHovered =
        mousePos.x >= this.filterButtonX &&
        mousePos.x <= this.filterButtonX + buttonWidth;
      this.filterButtonHover = lerpDelta(
        this.filterButtonHover,
        isFilterHovered ? 1 : 0,
        0.2
      );
      this.isFilterHovered = isFilterHovered;

      const isCustomizeHovered =
        mousePos.x >= this.customizeButtonX &&
        mousePos.x <= this.customizeButtonX + buttonWidth;
      this.customizeButtonHover = lerpDelta(
        this.customizeButtonHover,
        isCustomizeHovered ? 1 : 0,
        0.2
      );
      this.isCustomizeHovered = isCustomizeHovered;

      const toggleWidth = 56;
      const isToggleHovered =
        mousePos.x >= this.toggleButtonX &&
        mousePos.x <= this.toggleButtonX + toggleWidth;
      this.toggleButtonHover = lerpDelta(
        this.toggleButtonHover,
        isToggleHovered ? 1 : 0,
        0.2
      );
      this.isToggleHovered = isToggleHovered;

      const isLeaderboardsHovered =
        mousePos.x >= this.leaderboardsButtonX &&
        mousePos.x <= this.leaderboardsButtonX + buttonWidth;
      this.leaderboardsButtonHover = lerpDelta(
        this.leaderboardsButtonHover,
        isLeaderboardsHovered ? 1 : 0,
        0.2
      );
      this.isLeaderboardsHovered = isLeaderboardsHovered;

      
      this.topMenu.updateHover(mousePos);

      for (const tab of this.tabs) {
        const wasHovered = tab.isHovered;
        tab.isHovered = mousePos.x >= tab.x && mousePos.x <= tab.x + tab.width;

        if (tab.isHovered) {
          tab.hoverProgress = lerpDelta(tab.hoverProgress, 1, 0.2);
        } else {
          tab.hoverProgress = lerpDelta(tab.hoverProgress, 0, 0.15);
        }
      }
    } else {
      for (const tab of this.tabs) {
        tab.isHovered = false;
        tab.hoverProgress = lerpDelta(tab.hoverProgress, 0, 0.15);
      }
      this.filterButtonHover = lerpDelta(this.filterButtonHover, 0, 0.15);
      this.customizeButtonHover = lerpDelta(this.customizeButtonHover, 0, 0.15);
      this.toggleButtonHover = lerpDelta(this.toggleButtonHover, 0, 0.15);
      this.leaderboardsButtonHover = lerpDelta(
        this.leaderboardsButtonHover,
        0,
        0.15
      );
      this.isFilterHovered = false;
      this.isCustomizeHovered = false;
      this.isToggleHovered = false;
      this.isLeaderboardsHovered = false;
      
      this.topMenu.updateHover(null);
    }

    this.toggleAnimationProgress = lerpDelta(
      this.toggleAnimationProgress,
      this.toggleState ? 1 : 0,
      0.15
    );
  }

  private handleClick(): boolean {
    try {
      if (MenuScene.isAnyOverlayOpen()) return true;
    } catch {}
    const mousePos = this.gameObject.getMousePosition();

    if (mousePos && mousePos.y <= this.barHeight) {
      const avatarSize = 50;
      const avatarX = 18;
      const textX = avatarX + avatarSize + 15;
      const profileEndX = textX + 200;

      if (mousePos.x >= avatarX && mousePos.x <= profileEndX) {
        this.handleProfileClick();
        return true; 
      }

      for (let i = 0; i < this.tabs.length; i++) {
        const tab = this.tabs[i];
        if (mousePos.x >= tab.x && mousePos.x <= tab.x + tab.width) {
          this.setActiveTab(i);
          playFx("/hover.wav");
          return true; 
        }
      }

      const buttonWidth = 32;
      if (
        mousePos.x >= this.filterButtonX &&
        mousePos.x <= this.filterButtonX + buttonWidth
      ) {
        this.onFilterClick();
        playFx("/hover.wav");
        return true; 
      }

      if (
        mousePos.x >= this.customizeButtonX &&
        mousePos.x <= this.customizeButtonX + buttonWidth
      ) {
        this.onCustomizeClick();
        playFx("/hover.wav");
        return true; 
      }

      const toggleWidth = 56;
      if (
        mousePos.x >= this.toggleButtonX &&
        mousePos.x <= this.toggleButtonX + toggleWidth
      ) {
        this.toggleState = !this.toggleState;
        this.onToggleClick(this.toggleState);
        playFx("/hover.wav");
        return true; 
      }

      if (
        mousePos.x >= this.leaderboardsButtonX &&
        mousePos.x <= this.leaderboardsButtonX + buttonWidth
      ) {
        this.onLeaderboardsClick();
        playFx("/hover.wav");
        return true; 
      }

      
      if (this.topMenu.handleTopBarClick(mousePos)) {
        playFx("/hover.wav");
        return true; 
      }

      if (this.searchInput) {
        const inputWidth = 280;

        if (
          mousePos.x >= this.searchInputX &&
          mousePos.x <= this.searchInputX + inputWidth
        ) {
          return false; 
        }
      }

      return true; 
    }

    return false; 
  }

  private setActiveTab(index: number): void {
    if (index >= 0 && index < this.tabs.length) {
      for (const tab of this.tabs) {
        tab.isActive = false;
      }

      this.tabs[index].isActive = true;
      this.activeTabIndex = index;

      this.onTabChange(this.tabs[index].label);
    }
  }

  private draw(): void {
    rlPushMatrix();
    this.drawBackground();

    this.drawProfile();

    this.drawToggleButton();

    this.drawCustomizeButton();

    this.drawLeaderboardsButton();
    this.drawFilterButton();

    this.drawTabs();
    this.topMenu.drawTopBarButton();

    rlPopMatrix();
  }

  private handleProfileClick(): void {
    if (this.profileStatus === "ready") {
      this.onProfileClick();
      playFx("/hover.wav");
      return;
    }

    if (this.profileStatus === "loading") {
      playFx("/hover.wav");
      return;
    }

    void (async () => {
      try {
        playFx("/hover.wav");

        const user = await loginWithDiscord();
        if (user) {
          await this.loadProfile();
        }
      } catch (error) {
        console.error("Discord login failed from TopBar", error);
      }
    })();
  }

  private drawBackground(): void {
    const bgTint = accentBackground(this.accentColor, 0.2);
    const borderTint = tintWithAccent(
      { r: 120, g: 120, b: 120 },
      this.accentColor,
      0.3
    );

    
    
    
    let displayW = Rhythia.gameWidth;
    let displayH = Rhythia.gameHeight;
    let viewportX = 0;
    let viewportY = 0;
    let viewportW = Rhythia.gameWidth;
    let viewportH = Rhythia.gameHeight;
    try {
      const info = getPresentationInfo();
      displayW = Math.max(1, Math.round(info.displayWidth));
      displayH = Math.max(1, Math.round(info.displayHeight));
      viewportX = Math.round(info.viewport.x);
      viewportY = Math.round(info.viewport.y);
      viewportW = Math.max(1, Math.round(info.viewport.width));
      viewportH = Math.max(1, Math.round(info.viewport.height));
    } catch {}

    const scaleX = viewportW / Math.max(1, Rhythia.gameWidth);
    const scaleY = viewportH / Math.max(1, Rhythia.gameHeight);
    const worldLeftX = -viewportX / Math.max(0.0001, scaleX);
    const worldWidth = displayW / Math.max(0.0001, scaleX);
    const worldBarH = this.barHeight; 
    const worldHalfH = worldBarH / 2;
    const borderWorldH = 2 / Math.max(0.0001, scaleY); 

    
    
    const isVerticalLetterbox = viewportY > 0;
    const worldTopY = isVerticalLetterbox
      ? -viewportY / Math.max(0.0001, scaleY)
      : 0;

    
    
    
    
    const extraTopH = Math.max(0, -worldTopY);
    const baseFillH = worldBarH + extraTopH;
    drawSprite(
      "/solid.png",
      Vector2(worldLeftX, worldTopY),
      Vector2(worldWidth, baseFillH),
      { r: bgTint.r, g: bgTint.g, b: bgTint.b, a: 0.7 * 255 }
    );

    
    drawSprite(
      "/solid.png",
      Vector2(worldLeftX, 0),
      Vector2(worldWidth, worldHalfH),
      { r: bgTint.r, g: bgTint.g, b: bgTint.b, a: 0.15 * 255 }
    );

    
    drawSprite(
      "/solid.png",
      Vector2(worldLeftX, worldBarH - borderWorldH),
      Vector2(worldWidth, borderWorldH),
      { ...borderTint, a: 0.3 * 255 }
    );
  }

  

  private drawProfile(): void {
    const hasProfile = this.profileStatus === "ready";
    const avatarSize = 50; 
    const avatarX = 18; 

    const avatarY = (this.barHeight - avatarSize) / 2;

    if (hasProfile) {
      const borderWidth = 2;
      const avatarBorder = tintWithAccent(
        { r: 120, g: 120, b: 140 },
        this.accentColor,
        0.4
      );
      drawSprite(
        "/solid.png",
        Vector2(avatarX - borderWidth, avatarY - borderWidth),
        Vector2(avatarSize + borderWidth * 2, avatarSize + borderWidth * 2),
        avatarBorder
      );

      const avatarUrl =
        this.profileData?.avatar_url || this.profileData?.profile_image;
      if (avatarUrl && avatarUrl.length > 0) {
        drawSprite(
          avatarUrl,
          Vector2(avatarX, avatarY),
          Vector2(avatarSize, avatarSize),
          { r: 255, g: 255, b: 255, a: 255 }
        );
      } else {
        drawSprite(
          "/solid.png",
          Vector2(avatarX, avatarY),
          Vector2(avatarSize, avatarSize),
          { r: 60, g: 60, b: 80, a: 255 }
        );

        drawSprite(
          "/solid.png",
          Vector2(avatarX + avatarSize / 4, avatarY + avatarSize / 4),
          Vector2(avatarSize / 2, avatarSize / 2),
          { r: 180, g: 180, b: 200, a: 255 }
        );
      }
    }

    const textX = hasProfile ? avatarX + avatarSize + 15 : avatarX;
    const usernameLabel = (() => {
      switch (this.profileStatus) {
        case "ready":
          return this.profileData?.username || "Player";
        case "unauthenticated":
        case "error":
          return "Log in";
        default:
          return "Loading...";
      }
    })();
    const usernameY = this.barHeight / 2 - 30 + (hasProfile ? 0 : 2);
    drawText(
      usernameLabel,
      Vector2(textX, usernameY),
      36,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    if (hasProfile) {
      const skillPoints = this.profileData?.skill_points ?? 0;
      const formattedSP = skillPoints.toLocaleString(); 
      drawText(
        `SP: ${formattedSP}`,
        Vector2(textX, this.barHeight / 2),
        26,
        { r: 200, g: 200, b: 200, a: 255 },
        "left"
      );
    } else if (
      this.profileStatus === "unauthenticated" ||
      this.profileStatus === "error"
    ) {
      const detailY = this.barHeight / 2 + 2;
      drawText(
        "with Discord account",
        Vector2(textX, detailY),
        22,
        { r: 200, g: 200, b: 200, a: 255 },
        "left"
      );
    }

    const position = hasProfile ? this.profileData?.position : null;
    if (position) {
      const rankText = `#${position.toLocaleString()}`;
      drawText(
        rankText,
        Vector2(textX + 150, this.barHeight / 2 - 40), 
        80, 
        { r: 255, g: 255, b: 255, a: 60 }, 
        "left"
      );
    }
  }

  private drawTabs(): void {
    for (const tab of this.tabs) {
      rlPushMatrix();
      rlTranslatef(tab.x, 0, 0);

      let bgAlpha = 0;
      let textColor = { r: 200, g: 200, b: 200, a: 255 };

      if (tab.isActive) {
        bgAlpha = 0.3;
        textColor = { r: 255, g: 255, b: 255, a: 255 };
      } else if (tab.hoverProgress > 0) {
        bgAlpha = 0.15 * tab.hoverProgress;
        const brightness = 200 + 55 * tab.hoverProgress;
        textColor = { r: brightness, g: brightness, b: brightness, a: 255 };
      }

      if (bgAlpha > 0) {
        drawSprite(
          "/solid.png",
          Vector2(0, 10),
          Vector2(tab.width, this.barHeight - 20),
          { r: 255, g: 255, b: 255, a: bgAlpha * 255 }
        );
      }

      if (tab.isActive) {
        const indicator = tintWithAccent(
          { r: 180, g: 180, b: 180 },
          this.accentColor,
          0.6
        );
        drawSprite(
          "/solid.png",
          Vector2(0, this.barHeight - 4),
          Vector2(tab.width, 4),
          { ...indicator, a: 0.7 * 255 }
        );
      }

      drawText(
        tab.label,
        Vector2(tab.width / 2, this.barHeight / 2 - 12),
        28,
        textColor,
        "center"
      );

      rlPopMatrix();
    }
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public getActiveTab(): string {
    return this.tabs[this.activeTabIndex].label;
  }

  public goToTab(label: string): void {
    const index = this.tabs.findIndex((t) => t.label === label);
    if (index !== -1) {
      this.setActiveTab(index);
    }
  }

  public getHeight(): number {
    return this.barHeight;
  }

  public getProfileData(): ProfileData | null {
    return this.profileData;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
    if (this.searchInput) {
      this.searchInput.setAccentColor(color);
    }
    try {
      (this.topMenu as any)?.setAccentColor?.(color);
    } catch {}
  }

  private drawTooltip(
    label: string,
    centerX: number,
    elementTop: number,
    elementHeight: number
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
      "center"
    );
  }

  private drawFilterButton(): void {
    const iconSize = 32;
    const buttonY = (this.barHeight - iconSize) / 2;

    rlPushMatrix();
    rlTranslatef(this.filterButtonX, buttonY, 0);

    const iconColor = accentWithHover(
      { r: 180, g: 180, b: 180 },
      this.accentColor,
      0.3,
      this.filterButtonHover
    );

    drawSprite(
      "/filter.png",
      Vector2(0, 0),
      Vector2(iconSize, iconSize),
      iconColor
    );

    rlPopMatrix();

    if (this.isFilterHovered) {
      this.drawTooltip(
        "Filter maps",
        this.filterButtonX + iconSize / 2,
        buttonY,
        iconSize
      );
    }
  }

  private drawCustomizeButton(): void {
    const iconSize = 32;
    const buttonY = (this.barHeight - iconSize) / 2;

    rlPushMatrix();
    rlTranslatef(this.customizeButtonX, buttonY, 0);

    const iconColor = accentWithHover(
      { r: 180, g: 180, b: 180 },
      this.accentColor,
      0.3,
      this.customizeButtonHover
    );

    drawSprite(
      "/customize.png",
      Vector2(0, 0),
      Vector2(iconSize, iconSize),
      iconColor
    );

    rlPopMatrix();

    if (this.isCustomizeHovered) {
      this.drawTooltip(
        "Open customization",
        this.customizeButtonX + iconSize / 2,
        buttonY,
        iconSize
      );
    }
  }

  private drawToggleButton(): void {
    const toggleWidth = 56;
    const toggleHeight = 28;
    const toggleY = (this.barHeight - toggleHeight) / 2;
    const knobSize = 22;
    const knobPadding = 3;

    rlPushMatrix();
    rlTranslatef(this.toggleButtonX, toggleY, 0);

    const baseTrackColor = this.toggleState
      ? tintWithAccent({ r: 100, g: 200, b: 100 }, this.accentColor, 0.4)
      : { r: 60, g: 60, b: 60 };

    const trackColor = {
      r: baseTrackColor.r + this.toggleButtonHover * 20,
      g: baseTrackColor.g + this.toggleButtonHover * 20,
      b: baseTrackColor.b + this.toggleButtonHover * 20,
      a: 200 + this.toggleButtonHover * 55,
    };

    drawSprite(
      "/solid.png",
      Vector2(0, 0),
      Vector2(toggleWidth, toggleHeight),
      trackColor
    );

    const knobX =
      knobPadding +
      (toggleWidth - knobSize - knobPadding * 2) * this.toggleAnimationProgress;
    const knobColor = {
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    };

    drawSprite(
      "/solid.png",
      Vector2(knobX, knobPadding),
      Vector2(knobSize, knobSize),
      knobColor
    );

    rlPopMatrix();

    if (this.isToggleHovered) {
      this.drawTooltip(
        this.toggleState ? "Show list view" : "Show card view",
        this.toggleButtonX + toggleWidth / 2,
        toggleY,
        toggleHeight
      );
    }
  }

  private drawLeaderboardsButton(): void {
    const iconSize = 32;
    const buttonY = (this.barHeight - iconSize) / 2;

    rlPushMatrix();
    rlTranslatef(this.leaderboardsButtonX, buttonY, 0);

    const iconColor = accentWithHover(
      { r: 180, g: 180, b: 180 },
      this.accentColor,
      0.3,
      this.leaderboardsButtonHover
    );

    drawSprite(
      "/leads.png",
      Vector2(0, 0),
      Vector2(iconSize, iconSize),
      iconColor
    );

    rlPopMatrix();

    if (this.isLeaderboardsHovered) {
      this.drawTooltip(
        "Toggle leaderboards",
        this.leaderboardsButtonX + iconSize / 2,
        buttonY,
        iconSize
      );
    }
  }

  

  public isMenuOpen(): boolean {
    return (this.topMenu as any)?.isOpenOrAnimating?.() || false;
  }

  

  

  

  private createSearchInput(): void {
    const inputWidth = 280;
    const inputHeight = 42;
    const inputY = this.barHeight / 2;

    this.searchInput = createInputBox({
      position: Vector2(this.searchInputX, inputY),
      width: inputWidth,
      height: inputHeight,
      placeholder: "Search maps...",
      fontSize: 24,
      maxLength: 100,
      onValueChange: (searchTerm) => {
        this.onSearchChange(searchTerm);
      },
      onEnter: (searchTerm) => {
        logger("Search entered:", searchTerm);
      },
    });

    if (this.accentColor) {
      this.searchInput.setAccentColor(this.accentColor);
    }
  }

  public isSearchFocused(): boolean {
    return this.searchInput?.isFocusedNow?.() || false;
  }

  public focusSearch(): void {
    try {
      this.searchInput?.focus();
    } catch {}
  }

  public appendToSearch(text: string): void {
    try {
      if (!this.searchInput) return;
      const current = this.searchInput.getValue();
      this.searchInput.setValueAndMoveCursorToEnd(current + text);
    } catch {}
  }
}

export function createTopBar(): TopBar {
  return new TopBar();
}
