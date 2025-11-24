import { Vector2 } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { tintWithAccent } from "../../../utils/colors";
import { BaseDrawer } from "../atoms/BaseDrawer";
import { getUserScores, getProfile } from "rhythia-api";
import { ProfileManager } from "../../../utils/profileManager";
import { GameObject } from "../../../atoms/Object";
import { playFx } from "../../../utils/soundManager";
import { logger } from "../../../utils/logger";
import { lerpDelta } from "../../../utils/lerp";

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

interface ScoreData {
  id: number;
  awarded_sp: number | null;
  beatmapHash: string | null;
  created_at: string;
  misses: number | null;
  passed: boolean | null;
  songId: string | null;
  userId: number | null;
  beatmapDifficulty?: number | null | undefined;
  beatmapNotes?: number | null | undefined;
  beatmapTitle?: string | null | undefined;
  speed?: number | null | undefined;
  spin?: boolean | null | undefined;
}

interface UserScoresData {
  lastDay?: ScoreData[];
  reign?: ScoreData[];
  top?: ScoreData[];
  stats?: {
    totalScore?: number;
    playCount?: number;
    skillPoints?: number;
  };
}

interface TabButton {
  gameObject: GameObject;
  key: "top" | "reign" | "lastDay";
  label: string;
}

export class ProfileDrawer extends BaseDrawer {
  private profileData: ProfileData | null = null;
  private userScores: UserScoresData | null = null;
  private loadingScores: boolean = false;
  private loadingProfile: boolean = false;
  private selectedScoreTab: "top" | "reign" | "lastDay" = "top";
  private tabButtons: TabButton[] = [];
  private scoreHoverProgress: Map<number, number> = new Map();

  constructor(profileData: ProfileData | null = null) {
    super(1000); 
    this.profileData = profileData;
  }

  protected onInitialize(): void {}

  private createTabButtons(tabs: any[], baseX: number, baseY: number): void {
    tabs.forEach((tab, index) => {
      const tabX = baseX + index * 120; 
      const tabWidth = 110; 
      const tabHeight = 40; 

      const gameObject = new GameObject({ zBase: 16 });
      gameObject.attachRect({
        pos: { x: tabX, y: baseY },
        size: { x: tabWidth, y: tabHeight },
      });

      const button: TabButton = {
        gameObject,
        key: tab.key,
        label: tab.label,
      };

      gameObject.rectArea!.onClick = () => {
        playFx("/click.wav", 0.3);
        this.selectedScoreTab = button.key;
        return true; 
      };

      gameObject.rectArea!.onHoverStart = () => {
        playFx("/click.wav", 0.1);
      };

      this.tabButtons.push(button);
    });
  }

  
  private fitTextToWidth(
    text: string,
    fontSize: number,
    maxWidth: number
  ): string {
    if (maxWidth <= 0) return "";
    const full = measureText(text, fontSize, 1);
    if (full.width <= maxWidth) return text;

    const ellipsis = "...";
    const ellW = measureText(ellipsis, fontSize, 1).width;
    if (ellW > maxWidth) return ""; 

    let lo = 0;
    let hi = text.length;
    let best = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const sub = text.slice(0, mid);
      const w = measureText(sub, fontSize, 1).width + ellW;
      if (w <= maxWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const fitted = text.slice(0, Math.max(0, best));
    return fitted + ellipsis;
  }

  private updateTabButtonPositions(baseX: number, baseY: number): void {
    this.tabButtons.forEach((button, index) => {
      if (button.gameObject.rectArea) {
        button.gameObject.rectArea.pos.x = baseX + index * 120; 
        button.gameObject.rectArea.pos.y = baseY;
      }
    });
  }

  protected getHeaderText(): string {
    return "Profile";
  }

  protected drawContent(): void {
    if (this.loadingProfile) {
      drawText(
        "Loading profile...",
        Vector2(40, 150),
        32,
        { r: 180, g: 180, b: 180, a: 255 },
        "left"
      );
      return;
    }

    if (!this.profileData) {
      drawText(
        "No profile data",
        Vector2(40, 150),
        32,
        { r: 180, g: 180, b: 180, a: 255 },
        "left"
      );
      return;
    }

    const contentStartY = 120;
    const leftMargin = 40;
    const avatarSize = 120; 

    const avatarY = contentStartY;

    const borderWidth = 3;
    const avatarBorder = tintWithAccent(
      { r: 120, g: 120, b: 140 },
      this.accentColor,
      0.4
    );

    drawSprite(
      "/solid.png",
      Vector2(leftMargin - borderWidth, avatarY - borderWidth),
      Vector2(avatarSize + borderWidth * 2, avatarSize + borderWidth * 2),
      avatarBorder
    );

    const avatarUrl =
      this.profileData?.avatar_url || this.profileData?.profile_image;
    if (avatarUrl && avatarUrl.length > 0) {
      drawSprite(
        avatarUrl,
        Vector2(leftMargin, avatarY),
        Vector2(avatarSize, avatarSize),
        { r: 255, g: 255, b: 255, a: 255 }
      );
    } else {
      drawSprite(
        "/solid.png",
        Vector2(leftMargin, avatarY),
        Vector2(avatarSize, avatarSize),
        { r: 60, g: 60, b: 80, a: 255 }
      );

      drawSprite(
        "/solid.png",
        Vector2(leftMargin + avatarSize / 4, avatarY + avatarSize / 4),
        Vector2(avatarSize / 2, avatarSize / 2),
        { r: 180, g: 180, b: 200, a: 255 }
      );
    }

    const textX = leftMargin + avatarSize + 25;
    const username = this.profileData?.username || "Unknown User";
    drawText(
      username,
      Vector2(textX, avatarY + 10),
      48,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    const position = this.profileData?.position;
    if (position) {
      const rankText = `#${position.toLocaleString()}`;
      drawText(
        rankText,
        Vector2(textX, avatarY + 65),
        36,
        { r: 220, g: 220, b: 220, a: 255 },
        "left"
      );
    }

    const statsY = avatarY + avatarSize + 40;

    const skillPoints = this.profileData?.skill_points || 0;
    const formattedSP = skillPoints.toLocaleString();
    drawText(
      "Skill Points",
      Vector2(leftMargin, statsY),
      28,
      { r: 180, g: 180, b: 180, a: 255 },
      "left"
    );
    drawText(
      formattedSP,
      Vector2(leftMargin, statsY + 35),
      36,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    const playCount = this.profileData?.play_count || 0;
    drawText(
      "Play Count",
      Vector2(leftMargin + 200, statsY),
      28,
      { r: 180, g: 180, b: 180, a: 255 },
      "left"
    );
    drawText(
      playCount.toLocaleString(),
      Vector2(leftMargin + 200, statsY + 35),
      36,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    const totalScore = this.profileData?.total_score || 0;
    drawText(
      "Total Score",
      Vector2(leftMargin, statsY + 100),
      28,
      { r: 180, g: 180, b: 180, a: 255 },
      "left"
    );
    drawText(
      totalScore.toLocaleString(),
      Vector2(leftMargin, statsY + 135),
      36,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    const squaresHit = this.profileData?.squares_hit || 0;
    drawText(
      "Squares Hit",
      Vector2(leftMargin + 200, statsY + 100),
      28,
      { r: 180, g: 180, b: 180, a: 255 },
      "left"
    );
    drawText(
      squaresHit.toLocaleString(),
      Vector2(leftMargin + 200, statsY + 135),
      36,
      { r: 255, g: 255, b: 255, a: 255 },
      "left"
    );

    if (this.profileData?.badges && this.profileData.badges.length > 0) {
      const badgesY = statsY + 200;
      drawText(
        "Badges",
        Vector2(leftMargin, badgesY),
        32,
        { r: 200, g: 200, b: 200, a: 255 },
        "left"
      );

      this.drawBadges(
        this.profileData.badges,
        leftMargin,
        badgesY + 40,
        400 
      );
    }

    this.drawScores();
  }

  private drawScores(): void {
    const scoresX = 500; 
    const scoresY = 120;
    const xOffset =
      -this.drawerWidth + this.drawerWidth * this.animationProgress;

    drawSprite(
      "/solid.png",
      Vector2(xOffset + scoresX - 30, scoresY),
      Vector2(3, 500),
      {
        r: 60,
        g: 60,
        b: 60,
        a: 100 * this.animationProgress,
      }
    );

    drawText(
      "Recent Scores",
      Vector2(xOffset + scoresX, scoresY),
      42,
      { r: 220, g: 220, b: 220, a: 255 * this.animationProgress },
      "left"
    );

    const tabY = scoresY + 50;
    const tabs = [
      { key: "top" as const, label: "Top" },
      { key: "reign" as const, label: "Reign" },
      { key: "lastDay" as const, label: "24h" },
    ];

    if (this.tabButtons.length === 0) {
      this.createTabButtons(tabs, xOffset + scoresX, tabY);
    } else {
      this.updateTabButtonPositions(xOffset + scoresX, tabY);
    }

    tabs.forEach((tab, index) => {
      const tabX = xOffset + scoresX + index * 120; 
      const tabWidth = 110; 
      const tabHeight = 40; 
      const isActive = this.selectedScoreTab === tab.key;

      if (isActive) {
        drawSprite(
          "/solid.png",
          Vector2(tabX, tabY),
          Vector2(tabWidth, tabHeight),
          { r: 80, g: 80, b: 100, a: 180 * this.animationProgress }
        );
      }

      drawText(
        tab.label,
        Vector2(tabX + tabWidth / 2, tabY + 10),
        28,
        isActive
          ? { r: 255, g: 255, b: 255, a: 255 * this.animationProgress }
          : { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "center"
      );
    });

    const scoresListY = tabY + 60;

    if (this.loadingScores) {
      drawText(
        "Loading scores...",
        Vector2(xOffset + scoresX, scoresListY),
        24,
        { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "left"
      );
      return;
    }

    if (!this.userScores) {
      drawText(
        "No scores available",
        Vector2(xOffset + scoresX, scoresListY),
        24,
        { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "left"
      );
      return;
    }

    const scores = this.userScores[this.selectedScoreTab] || [];

    if (scores.length === 0) {
      drawText(
        "No scores in this category",
        Vector2(xOffset + scoresX, scoresListY),
        24,
        { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "left"
      );
      return;
    }

    scores.slice(0, 8).forEach((score, index) => {
      const scoreHeight = 90; 
      const scoreWidth = 450; 
      const scoreY = scoresListY + index * scoreHeight;

      if (index % 2 === 0) {
        drawSprite(
          "/solid.png",
          Vector2(xOffset + scoresX, scoreY),
          Vector2(scoreWidth, scoreHeight - 8),
          {
            r: 60,
            g: 60,
            b: 70,
            a: 120 * this.animationProgress,
          }
        );
      }

      drawText(
        `#${index + 1}`,
        Vector2(xOffset + scoresX + 20, scoreY + 18),
        32,
        { r: 150, g: 150, b: 150, a: 255 * this.animationProgress },
        "left"
      );

      const title = score.beatmapTitle || "Unknown Map";
      const titleX = xOffset + scoresX + 75;
      const titleY = scoreY + 12;
      const titleFont = 28;
      const rightEdge = xOffset + scoresX + scoreWidth - 20;

      
      let reservedRight = 0;
      if (score.awarded_sp) {
        const spLabel = `+${score.awarded_sp} SP`;
        const spSize = measureText(spLabel, 26, 1);
        reservedRight = spSize.width + 16;
      }
      const maxTitleWidth = Math.max(0, rightEdge - reservedRight - titleX);
      const fittedTitle = this.fitTextToWidth(title, titleFont, maxTitleWidth);

      drawText(
        fittedTitle,
        Vector2(titleX, titleY),
        titleFont,
        { r: 220, g: 220, b: 220, a: 255 * this.animationProgress },
        "left"
      );

      const detailsY = scoreY + 50;
      const fontSize = 24;
      let cursorX = xOffset + scoresX + 75;
      const gap = 8;

      const neutral = (a: number) => ({ r: 200, g: 200, b: 200, a });
      const redMatte = (a: number) => ({ r: 190, g: 80, b: 80, a });
      const greenMatte = (a: number) => ({ r: 90, g: 180, b: 110, a });
      const blueMatte = (a: number) => ({ r: 110, g: 160, b: 220, a });

      const drawSeg = (
        text: string,
        color: { r: number; g: number; b: number; a: number }
      ) => {
        if (!text) return;
        drawText(text, Vector2(cursorX, detailsY), fontSize, color, "left");
        const size = measureText(text, fontSize, 1);
        cursorX += size.width + gap;
      };

      
      if (score.spin) {
        drawSeg("SPIN", neutral(255 * this.animationProgress));
      }

      const misses = Math.max(0, score.misses ?? 0);
      const totalNotes = score.beatmapNotes ?? null;
      const hits = totalNotes != null ? Math.max(0, totalNotes - misses) : null;
      const accNumber =
        totalNotes && totalNotes > 0 && hits != null
          ? ((hits / totalNotes) * 100).toFixed(1)
          : "";

      drawSeg(String(misses), neutral(255 * this.animationProgress));
      drawSeg("X", redMatte(255 * this.animationProgress));
      if (hits !== null) {
        drawSeg(String(hits), neutral(255 * this.animationProgress));
        drawSeg("O", greenMatte(255 * this.animationProgress));
      }
      if (accNumber) {
        drawSeg(accNumber, neutral(255 * this.animationProgress));
        drawSeg("%", blueMatte(255 * this.animationProgress));
      }

      const rightX = xOffset + scoresX + scoreWidth - 20;
      const spY = scoreY + 18;
      if (score.awarded_sp) {
        drawText(
          `+${score.awarded_sp} SP`,
          Vector2(rightX, spY),
          26,
          { r: 100, g: 200, b: 100, a: 255 * this.animationProgress },
          "right"
        );
      }
      if (score.speed && score.speed !== 1) {
        const speedVal = typeof score.speed === "number" ? score.speed : 1;
        const speedRoundedUp = Math.ceil(speedVal * 100) / 100;
        const speedLabel = `${speedRoundedUp.toFixed(2)}x`;
        drawText(
          speedLabel,
          Vector2(rightX, detailsY),
          22,
          { r: 200, g: 200, b: 200, a: 220 * this.animationProgress },
          "right"
        );
      }
    });
  }

  private getBadgeConfig(badgeName: string): {
    color: { r: number; g: number; b: number };
    text: string;
  } {
    const badgeConfigs: Record<
      string,
      { color: { r: number; g: number; b: number }; text: string }
    > = {
      "Global Moderator": {
        color: { r: 255, g: 255, b: 255 },
        text: "Global Moderator",
      },
      Developer: { color: { r: 168, g: 85, b: 247 }, text: "Developer" }, 
      "Early Bird": { color: { r: 34, g: 197, b: 94 }, text: "Early Bird" }, 
      Tester: { color: { r: 37, g: 99, b: 235 }, text: "Tester" }, 
      Donator: { color: { r: 245, g: 158, b: 11 }, text: "Donator" }, 
      "Content Creator": {
        color: { r: 236, g: 72, b: 153 },
        text: "Content Creator",
      }, 
      "Community Manager": {
        color: { r: 16, g: 185, b: 129 },
        text: "Community Manager",
      }, 
      MMT: { color: { r: 168, g: 85, b: 247 }, text: "MMT" }, 
      $$$: { color: { r: 101, g: 163, b: 13 }, text: "$$$ Supporter" }, 
    };

    return (
      badgeConfigs[badgeName] || {
        color: { r: 255, g: 255, b: 255 },
        text: badgeName,
      }
    );
  }

  private drawBadges(
    badges: string[],
    x: number,
    y: number,
    maxWidth: number
  ): void {
    const badgeHeight = 35;
    const badgeSpacing = 12;
    const rowSpacing = 15;

    let currentX = x;
    let currentY = y;

    for (const badgeName of badges) {
      const config = this.getBadgeConfig(badgeName);
      const badgeWidth = Math.max(config.text.length * 12 + 20, 80); 

      if (currentX + badgeWidth > x + maxWidth && currentX > x) {
        currentX = x;
        currentY += badgeHeight + rowSpacing;
      }

      const badgeBg = tintWithAccent(
        { r: 38, g: 38, b: 38 },
        this.accentColor,
        0.3
      );

      drawSprite(
        "/solid.png",
        Vector2(currentX, currentY),
        Vector2(badgeWidth, badgeHeight),
        badgeBg
      );

      drawText(
        config.text,
        Vector2(currentX + badgeWidth / 2, currentY + badgeHeight / 2 - 12),
        22,
        {
          r: config.color.r,
          g: config.color.g,
          b: config.color.b,
          a: 255,
        },
        "center"
      );

      currentX += badgeWidth + badgeSpacing;
    }
  }

  public async setProfileData(profileData: ProfileData | null): Promise<void> {
    console.log(this.profileData);
    this.profileData = profileData;

    if (profileData?.id !== undefined) {
      await this.loadUserScores(profileData.id);
    }
  }

  public async loadProfileById(userId: number): Promise<void> {
    try {
      this.loadingProfile = true;
      const token = ProfileManager.get().token;

      logger(`🌐 Making getProfile API request for user ID: ${userId}`);

      const response = await getProfile({ id: userId, session: token || "" });

      if (response.user) {
        this.profileData = response.user;
        logger(`✅ Profile loaded for user ID: ${userId}`, response.user);

        this.loadUserScores(userId); 
      } else {
        console.error("No user data in profile response");
        this.profileData = null;
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      this.profileData = null;
    } finally {
      this.loadingProfile = false;
    }
  }

  private async loadUserScores(userId: number): Promise<void> {
    try {
      this.loadingScores = true;
      const token = ProfileManager.get().token;

      const result = await getUserScores({
        session: token || "",
        id: userId,
        limit: 10, 
      });
      logger(result);
      if (!result.error) {
        this.userScores = {
          lastDay: result.lastDay,
          reign: result.reign as any,
          top: result.top,
        };
      } else {
        console.error("Failed to load user scores:", result.error);
      }
    } catch (error) {
      console.error("Error loading user scores:", error);
    } finally {
      this.loadingScores = false;
    }
  }

  public getProfileData(): ProfileData | null {
    return this.profileData;
  }

  public destroy(): void {
    this.tabButtons.forEach((button) => {
      button.gameObject.destroy();
    });
    this.tabButtons = [];
  }
}

export function createProfileDrawer(
  profileData: ProfileData | null = null
): ProfileDrawer {
  return new ProfileDrawer(profileData);
}
