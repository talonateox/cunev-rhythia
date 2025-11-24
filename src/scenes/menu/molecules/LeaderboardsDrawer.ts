import { Vector2, GuiGetFont, MeasureTextEx } from "raylib";
import { drawText } from "../../../utils/text";
import { drawSprite } from "../../../utils/sprite";
import { BaseDrawer } from "../atoms/BaseDrawer";
import { getLeaderboard } from "rhythia-api";
import { ProfileManager } from "../../../utils/profileManager";
import { GameObject } from "../../../atoms/Object";
import { playFx } from "../../../utils/soundManager";
import { logger } from "../../../utils/logger";

interface LeaderboardEntry {
  flag: string | null;
  id: number;
  username: string | null;
  play_count: number | null;
  skill_points: number | null;
  spin_skill_points: number | null;
  total_score: number | null;
  verified: boolean | null;
  clans?: {
    id: number;
    acronym: string;
  } | null;
}

interface LeaderboardData {
  total: number;
  viewPerPage: number;
  currentPage: number;
  userPosition: number;
  error?: string;
  leaderboard?: LeaderboardEntry[];
}

interface LeaderboardCache {
  normal: Map<number, LeaderboardEntry[]>; 
  spin: Map<number, LeaderboardEntry[]>;
}

type LeaderboardTab = "normal" | "spin";

interface TabButton {
  gameObject: GameObject;
  tab: LeaderboardTab;
  isActive: boolean;
}

interface NavigationButton {
  gameObject: GameObject;
  type: "prev" | "next";
}

interface LeaderboardRowButton {
  gameObject: GameObject;
  userId: number;
}
export class LeaderboardsDrawer extends BaseDrawer {
  private leaderboardData: LeaderboardData | null = null;
  private loadingLeaderboard: boolean = false;
  private selectedTab: LeaderboardTab = "normal";
  private tabButtons: TabButton[] = [];
  private navigationButtons: NavigationButton[] = [];
  private rowButtons: LeaderboardRowButton[] = [];
  private currentVirtualPage: number = 1; 
  private leaderboardCache: LeaderboardCache = {
    normal: new Map(),
    spin: new Map(),
  };
  private totalEntries: number = 0;
  private readonly virtualEntriesPerPage = 10;
  private readonly apiEntriesPerPage = 50; 
  private readonly virtualPagesPerApiCall = 5; 

  onUserClick = (userId: number) => {};

  constructor() {
    super(1000); 
  }

  protected onInitialize(): void {
    this.loadLeaderboard();
  }

  protected getHeaderText(): string {
    return "Leaderboards";
  }

  protected drawContent(): void {
    const xOffset =
      -this.drawerWidth + this.drawerWidth * this.animationProgress;
    const leftMargin = 40;
    const headerY = 120;

    drawText(
      "Global Leaderboards",
      Vector2(xOffset + leftMargin, headerY),
      42,
      { r: 220, g: 220, b: 220, a: 255 * this.animationProgress },
      "left"
    );

    const tabY = headerY + 60;
    this.drawTabs(xOffset + leftMargin, tabY);

    const contentY = tabY + 80;
    this.drawLeaderboard(xOffset + leftMargin, contentY);

    this.updateRowButtonPositions(xOffset + leftMargin, contentY);

    const paginationY = contentY + 50 + this.virtualEntriesPerPage * 60 + 20;
    const rightMargin = xOffset + this.drawerWidth - 62; 
    const buttonAreaWidth = 220; 
    this.drawNavigationButtons(rightMargin - buttonAreaWidth, paginationY - 10);
  }

  private updateNavigationButtonPositions(x: number, y: number): void {
    const totalVirtualPages = Math.ceil(
      this.totalEntries / this.virtualEntriesPerPage
    );
    const canGoPrev = this.currentVirtualPage > 1;
    const canGoNext = this.currentVirtualPage < totalVirtualPages;

    this.navigationButtons.forEach((button, index) => {
      const buttonX = x + index * 120;
      const isEnabled = button.type === "prev" ? canGoPrev : canGoNext;

      if (button.gameObject.rectArea) {
        button.gameObject.rectArea.pos.x = buttonX;
        button.gameObject.rectArea.pos.y = isEnabled ? y : -1000; 
      }
    });
  }

  private drawTabs(x: number, y: number): void {
    const tabs = [
      { key: "normal" as const, label: "Normal" },
      { key: "spin" as const, label: "Spin" },
    ];

    if (this.tabButtons.length === 0) {
      this.createTabButtons(tabs, x, y);
    } else {
      this.updateTabButtonPositions(x, y);
    }

    tabs.forEach((tab, index) => {
      const tabX = x + index * 120;
      const tabWidth = 110;
      const tabHeight = 40;
      const isActive = this.selectedTab === tab.key;

      if (isActive) {
        drawSprite(
          "/solid.png",
          Vector2(tabX, y),
          Vector2(tabWidth, tabHeight),
          { r: 80, g: 80, b: 100, a: 180 * this.animationProgress }
        );
      }

      drawText(
        tab.label,
        Vector2(tabX + tabWidth / 2, y + 10),
        28,
        isActive
          ? { r: 255, g: 255, b: 255, a: 255 * this.animationProgress }
          : { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "center"
      );
    });
  }

  private drawLeaderboard(x: number, y: number): void {
    if (this.loadingLeaderboard) {
      drawText(
        "Loading leaderboard...",
        Vector2(x, y),
        24,
        { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "left"
      );
      return;
    }

    const currentEntries = this.getCurrentPageEntries();

    if (!currentEntries || currentEntries.length === 0) {
      drawText(
        "No leaderboard data available",
        Vector2(x, y),
        24,
        { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "left"
      );
      return;
    }

    const headerY = y;
    const rowHeight = 60;
    const tableWidth = 900;

    drawSprite("/solid.png", Vector2(x, headerY), Vector2(tableWidth, 50), {
      r: 40,
      g: 40,
      b: 50,
      a: 200 * this.animationProgress,
    });

    drawText(
      "Rank",
      Vector2(x + 20, headerY + 15),
      24,
      { r: 200, g: 200, b: 200, a: 255 * this.animationProgress },
      "left"
    );
    drawText(
      "Player",
      Vector2(x + 100, headerY + 15),
      24,
      { r: 200, g: 200, b: 200, a: 255 * this.animationProgress },
      "left"
    );
    drawText(
      "Skill Points",
      Vector2(x + 500, headerY + 15),
      24,
      { r: 200, g: 200, b: 200, a: 255 * this.animationProgress },
      "left"
    );
    drawText(
      "Play Count",
      Vector2(x + 680, headerY + 15),
      24,
      { r: 200, g: 200, b: 200, a: 255 * this.animationProgress },
      "left"
    );

    this.createRowClickAreas(
      currentEntries,
      x,
      headerY + 50,
      rowHeight,
      tableWidth
    );

    currentEntries.forEach((entry, index) => {
      const entryY = headerY + 50 + index * rowHeight;
      const globalRank =
        (this.currentVirtualPage - 1) * this.virtualEntriesPerPage + index + 1;

      if (index % 2 === 0) {
        drawSprite(
          "/solid.png",
          Vector2(x, entryY),
          Vector2(tableWidth, rowHeight - 5),
          { r: 60, g: 60, b: 70, a: 120 * this.animationProgress }
        );
      }

      drawText(
        `#${globalRank}`,
        Vector2(x + 20, entryY + 18),
        28,
        { r: 220, g: 220, b: 220, a: 255 * this.animationProgress },
        "left"
      );

      const username = entry.username || "Unknown";
      const usernameColor = entry.verified
        ? { r: 100, g: 200, b: 255, a: 255 * this.animationProgress }
        : { r: 220, g: 220, b: 220, a: 255 * this.animationProgress };

      const displayName = username;

      drawText(
        displayName,
        Vector2(x + 100, entryY + 18),
        28,
        usernameColor,
        "left"
      );

      if (entry.clans?.acronym) {
        const font = GuiGetFont();
        const usernameSize = MeasureTextEx(font, displayName, 28, 1);

        drawText(
          ` [${entry.clans.acronym}]`,
          Vector2(x + 100 + usernameSize.x, entryY + 18),
          28,
          { r: 255, g: 200, b: 100, a: 255 * this.animationProgress }, 
          "left"
        );
      }

      const skillPoints =
        this.selectedTab === "spin"
          ? Math.round(entry.spin_skill_points || 0)
          : Math.round(entry.skill_points || 0);

      drawText(
        skillPoints.toLocaleString(),
        Vector2(x + 500, entryY + 18),
        28,
        { r: 255, g: 255, b: 255, a: 255 * this.animationProgress },
        "left"
      );

      drawText(
        (entry.play_count || 0).toLocaleString(),
        Vector2(x + 680, entryY + 18),
        28,
        { r: 200, g: 200, b: 200, a: 255 * this.animationProgress },
        "left"
      );
    });

    const paginationY = headerY + 50 + currentEntries.length * rowHeight + 20;
    const totalVirtualPages = Math.ceil(
      this.totalEntries / this.virtualEntriesPerPage
    );

    drawText(
      `Page ${
        this.currentVirtualPage
      } of ${totalVirtualPages} (${this.totalEntries.toLocaleString()} total players)`,
      Vector2(x, paginationY),
      24,
      { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
      "left"
    );
  }

  private createTabButtons(
    tabs: { key: LeaderboardTab; label: string }[],
    x: number,
    y: number
  ): void {
    tabs.forEach((tab, index) => {
      const tabX = x + index * 120;
      const tabWidth = 110;
      const tabHeight = 40;

      const gameObject = new GameObject({ zBase: 16 });
      gameObject.attachRect({
        pos: { x: tabX, y },
        size: { x: tabWidth, y: tabHeight },
      });

      const button: TabButton = {
        gameObject,
        tab: tab.key,
        isActive: tab.key === this.selectedTab,
      };

      gameObject.rectArea!.onClick = () => {
        this.selectTab(tab.key);
        return true;
      };

      gameObject.rectArea!.onHoverStart = () => {
        playFx("/click.wav", 0.1);
      };

      this.tabButtons.push(button);
    });
  }

  private updateTabButtonPositions(x: number, y: number): void {
    this.tabButtons.forEach((button, index) => {
      const tabX = x + index * 120;
      if (button.gameObject.rectArea) {
        button.gameObject.rectArea.pos.x = tabX;
        button.gameObject.rectArea.pos.y = y;
      }
    });
  }

  private selectTab(tab: LeaderboardTab): void {
    if (this.selectedTab === tab) return;

    playFx("/click.wav", 0.3);
    this.selectedTab = tab;
    this.currentVirtualPage = 1; 

    this.tabButtons.forEach((button) => {
      button.isActive = button.tab === tab;
    });

    this.loadLeaderboard();
  }

  private getCurrentPageEntries(): LeaderboardEntry[] | null {
    const apiPage = this.getApiPageForVirtualPage(this.currentVirtualPage);
    const cache = this.leaderboardCache[this.selectedTab];
    const cachedData = cache.get(apiPage);

    if (!cachedData) {
      if (!this.loadingLeaderboard) {
        this.loadLeaderboard();
      }
      return null;
    }

    const startIndexInApiPage =
      ((this.currentVirtualPage - 1) % this.virtualPagesPerApiCall) *
      this.virtualEntriesPerPage;
    const endIndexInApiPage = startIndexInApiPage + this.virtualEntriesPerPage;

    return cachedData.slice(startIndexInApiPage, endIndexInApiPage);
  }

  private getApiPageForVirtualPage(virtualPage: number): number {
    return Math.ceil(virtualPage / this.virtualPagesPerApiCall);
  }

  private async loadLeaderboard(): Promise<void> {
    try {
      const token = ProfileManager.get().token || "";

      if (token === undefined) {
        this.totalEntries = 0;
        return;
      }

      const apiPage = this.getApiPageForVirtualPage(this.currentVirtualPage);
      const cache = this.leaderboardCache[this.selectedTab];

      if (cache.has(apiPage)) {
        logger(
          `💾 Cache hit - Page: ${apiPage}, Tab: ${this.selectedTab}, Virtual Page: ${this.currentVirtualPage}`
        );
        return;
      }

      if (this.loadingLeaderboard) {
        logger(
          `⏳ Request blocked (already loading) - Page: ${apiPage}, Tab: ${this.selectedTab}, Virtual Page: ${this.currentVirtualPage}`
        );
        return;
      }

      this.loadingLeaderboard = true;

      logger(
        `🌐 Making leaderboard API request - Page: ${apiPage}, Tab: ${this.selectedTab}, Virtual Page: ${this.currentVirtualPage}`
      );

      const response = await getLeaderboard({
        session: "",
        page: apiPage,
        spin: this.selectedTab === "spin",
      });
      console.log(response);

      if (response.error) {
        console.error("Leaderboard API error:", response.error);
        return;
      }

      if (response.leaderboard) {
        cache.set(apiPage, response.leaderboard);
      }

      this.totalEntries = response.total;
      this.leaderboardData = response;
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
    } finally {
      this.loadingLeaderboard = false;
    }
  }

  private createNavigationButtons(x: number, y: number): void {
    const buttons = [
      { type: "prev" as const, label: "Previous" },
      { type: "next" as const, label: "Next" },
    ];

    buttons.forEach((btn, index) => {
      const buttonX = x + index * 120;
      const buttonWidth = 100;
      const buttonHeight = 40;

      const gameObject = new GameObject({ zBase: 20 });
      gameObject.attachRect({
        pos: { x: buttonX, y },
        size: { x: buttonWidth, y: buttonHeight },
      });

      const button: NavigationButton = {
        gameObject,
        type: btn.type,
      };

      gameObject.rectArea!.onClick = () => {
        if (btn.type === "prev") {
          this.goToPreviousPage();
        } else {
          this.goToNextPage();
        }
        return true;
      };

      gameObject.rectArea!.onHoverStart = () => {
        playFx("/click.wav", 0.1);
      };

      this.navigationButtons.push(button);
    });
  }

  private drawNavigationButtons(x: number, y: number): void {
    const totalVirtualPages = Math.ceil(
      this.totalEntries / this.virtualEntriesPerPage
    );
    const canGoPrev = this.currentVirtualPage > 1;
    const canGoNext = this.currentVirtualPage < totalVirtualPages;

    if (this.navigationButtons.length === 0) {
      this.createNavigationButtons(x, y);
    } else {
      this.updateNavigationButtonPositions(x, y);
    }

    if (canGoPrev) {
      drawSprite("/solid.png", Vector2(x, y), Vector2(100, 40), {
        r: 80,
        g: 80,
        b: 100,
        a: 180 * this.animationProgress,
      });

      drawText(
        "Previous",
        Vector2(x + 50, y + 10),
        24,
        { r: 255, g: 255, b: 255, a: 255 * this.animationProgress },
        "center"
      );
    } else {
      drawSprite("/solid.png", Vector2(x, y), Vector2(100, 40), {
        r: 40,
        g: 40,
        b: 40,
        a: 100 * this.animationProgress,
      });

      drawText(
        "Previous",
        Vector2(x + 50, y + 10),
        24,
        { r: 100, g: 100, b: 100, a: 255 * this.animationProgress },
        "center"
      );
    }

    if (canGoNext) {
      drawSprite("/solid.png", Vector2(x + 120, y), Vector2(100, 40), {
        r: 80,
        g: 80,
        b: 100,
        a: 180 * this.animationProgress,
      });

      drawText(
        "Next",
        Vector2(x + 170, y + 10),
        24,
        { r: 255, g: 255, b: 255, a: 255 * this.animationProgress },
        "center"
      );
    } else {
      drawSprite("/solid.png", Vector2(x + 120, y), Vector2(100, 40), {
        r: 40,
        g: 40,
        b: 40,
        a: 100 * this.animationProgress,
      });

      drawText(
        "Next",
        Vector2(x + 170, y + 10),
        24,
        { r: 100, g: 100, b: 100, a: 255 * this.animationProgress },
        "center"
      );
    }
  }

  private goToPreviousPage(): void {
    if (this.currentVirtualPage > 1) {
      playFx("/click.wav", 0.3);
      this.currentVirtualPage--;
      this.loadLeaderboard(); 
    }
  }

  private goToNextPage(): void {
    const totalVirtualPages = Math.ceil(
      this.totalEntries / this.virtualEntriesPerPage
    );
    if (this.currentVirtualPage < totalVirtualPages) {
      playFx("/click.wav", 0.3);
      this.currentVirtualPage++;
      this.loadLeaderboard(); 
    }
  }

  private createRowClickAreas(
    entries: LeaderboardEntry[],
    x: number,
    startY: number,
    rowHeight: number,
    tableWidth: number
  ): void {
    if (this.rowButtons.length !== entries.length) {
      this.rowButtons.forEach((button) => {
        button.gameObject.destroy();
      });
      this.rowButtons = [];
    }

    if (this.rowButtons.length === 0) {
      entries.forEach((entry, index) => {
        const entryY = startY + index * rowHeight;

        const gameObject = new GameObject({ zBase: 18 }); 
        gameObject.attachRect({
          pos: { x, y: entryY },
          size: { x: tableWidth, y: rowHeight - 5 },
        });

        const rowButton: LeaderboardRowButton = {
          gameObject,
          userId: entry.id,
        };

        gameObject.rectArea!.onClick = () => {
          playFx("/click.wav", 0.3);
          this.onUserClick(rowButton.userId); 
          return true;
        };

        gameObject.rectArea!.onHoverStart = () => {
          playFx("/click.wav", 0.1);
        };

        this.rowButtons.push(rowButton);
      });
    }
  }

  private updateRowButtonPositions(x: number, contentY: number): void {
    const currentEntries = this.getCurrentPageEntries();
    if (!currentEntries) return;

    const headerY = contentY;
    const rowHeight = 60;
    const startY = headerY + 50;

    this.rowButtons.forEach((button, index) => {
      if (button.gameObject.rectArea && index < currentEntries.length) {
        button.gameObject.rectArea.pos.x = x;
        button.gameObject.rectArea.pos.y = startY + index * rowHeight;

        button.userId = currentEntries[index].id;
      }
    });
  }

  public destroy(): void {
    this.tabButtons.forEach((button) => {
      button.gameObject.destroy();
    });

    this.navigationButtons.forEach((button) => {
      button.gameObject.destroy();
    });

    this.rowButtons.forEach((button) => {
      button.gameObject.destroy();
    });
  }
}

export function createLeaderboardsDrawer(): LeaderboardsDrawer {
  return new LeaderboardsDrawer();
}
