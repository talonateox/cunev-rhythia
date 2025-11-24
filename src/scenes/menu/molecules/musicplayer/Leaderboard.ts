import { Vector2, IsMouseButtonReleased, MOUSE_BUTTON_LEFT } from "raylib";
import { SoundSpaceMemoryMap } from "../../../../utils/storage/ssmm";
import { drawText, measureText } from "../../../../utils/text";
import { drawSprite } from "../../../../utils/sprite";
import { lerpDelta } from "../../../../utils/lerp";
import { getBeatmapPageById, getBeatmapPage } from "rhythia-api";
import { ProfileManager } from "../../../../utils/profileManager";
import { AccentColor } from "../../../../utils/imageBlur";
import { tintWithAccent } from "../../../../utils/colors";
import { getLocalScores } from "../../../../utils/storage/localScores";
import type { LocalScoreEntry } from "../../../../utils/storage/localScores";
import type { FinalResultsPayload } from "../../../../utils/results";
import { ModeManager } from "../../../game/modes";

interface Score {
  id: number;
  username: string | null;
  awarded_sp: number | null;
  misses: number | null;
  speed: number | null;
  spin: boolean;
  mods: Record<string, unknown>;
  passed: boolean | null;
  avatar_url: string | null;
  
  localHits?: number;
  localRaw?: LocalScoreEntry;
}

type LeaderboardViewMode = "online" | "local";
type ButtonBounds = { x: number; y: number; width: number; height: number };

export class Leaderboard {
  private currentMap: SoundSpaceMemoryMap | null = null;
  private fadeProgress: number = 0;
  private scores: Score[] = [];
  private loading: boolean = false;
  private error: string | null = null;
  private accentColor: AccentColor | null = null;
  private cardAnimations: number[] = [];
  private requestToken: number = 0;
  private viewMode: LeaderboardViewMode = "online";
  private toggleButtonHovered: boolean = false;
  private toggleButtonBounds: ButtonBounds = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  private readonly enabled: boolean = true;
  private readonly scoreWidth = 340;
  private readonly scoreHeight = 60;
  private readonly scoreGap = 5;
  private readonly overlap = 24; 
  private hasLocalScores: boolean = false;
  private hasOnlineScores: boolean = false;
  private localScoresCache: Score[] | null = null;
  private onlineScoresCache: Score[] | null = null;
  private onlineScoresCacheRaw: Score[] | null = null;
  private freshLoad: boolean = false;
  private hoverAnimations: number[] = [];
  private suppressScoreClickFrames: number = 0;
  private onScoreClick?: (payload: FinalResultsPayload) => void;

  public setOnScoreClick(cb: (payload: FinalResultsPayload) => void): void {
    this.onScoreClick = cb;
  }

  public setCurrentMap(map: SoundSpaceMemoryMap | null): void {
    this.currentMap = map;

    this.scores = [];
    this.error = null;
    this.cardAnimations = [];
    this.loading = false;
    this.hasLocalScores = false;
    this.hasOnlineScores = false;
    this.localScoresCache = null;
    this.onlineScoresCache = null;
    this.onlineScoresCacheRaw = null;
    this.freshLoad = true;
    this.hoverAnimations = [];
    this.suppressScoreClickFrames = 0;

    if (!this.enabled) {
      return;
    }

    const requestId = ++this.requestToken;

    if (!map) return;

    
    this.viewMode = "local";
    this.loadLocalScores(map.id);
    if (this.hasLocalScores && this.localScoresCache) {
      this.applyScores(this.localScoresCache);
      this.freshLoad = false;
    }
    if (map.onlineStatus === "RANKED") {
      this.fetchLeaderboard(map.id, requestId);
    }
  }

  
  public refresh(): void {
    if (!this.currentMap) return;
    const mapId = this.currentMap.id;
    
    this.loadLocalScores(mapId);

    
    if (this.viewMode === "local" && this.localScoresCache) {
      this.applyScores(this.localScoresCache);
    }

    
    if (
      this.scores.length === 0 &&
      this.hasLocalScores &&
      this.localScoresCache
    ) {
      this.applyScores(this.localScoresCache);
      this.viewMode = "local";
    }
    
    if (this.onlineScoresCacheRaw) {
      this.onlineScoresCache = this.onlineScoresCacheRaw;
      this.hasOnlineScores = this.onlineScoresCacheRaw.length > 0;
      if (this.viewMode === "online") {
        this.applyScores(this.onlineScoresCacheRaw);
      }
    }
    
  }

  private async fetchLeaderboard(
    mapId: string,
    requestId: number
  ): Promise<void> {
    const sessionToken = ProfileManager.get().token;

    this.loading = true;
    this.error = null;

    try {
      
      let scores: Score[] | null = null;
      const r1 = await getBeatmapPageById({
        session: sessionToken || "",
        mapId: mapId as any,
      });

      if (requestId !== this.requestToken) return;

      if (!r1.error && Array.isArray(r1.scores)) {
        scores = r1.scores.slice(0, 5) as any;
      }

      
      if ((!scores || scores.length === 0) && /^\d+$/.test(mapId)) {
        const numericId = Number(mapId);
        const r2 = await getBeatmapPage({
          session: sessionToken || "",
          id: numericId as any,
        });
        if (requestId !== this.requestToken) return;
        if (!r2.error && Array.isArray(r2.scores)) {
          scores = r2.scores.slice(0, 5) as any;
        }
      }

      if (scores && scores.length > 0) {
        this.onlineScoresCacheRaw = scores;
        this.onlineScoresCache = scores;
        this.hasOnlineScores = true;
        if (this.currentMap && this.currentMap.id === mapId) {
          if (this.scores.length === 0 && this.viewMode !== "local") {
            this.applyScores(scores);
            this.viewMode = "online";
            this.freshLoad = false;
          } else if (this.scores.length === 0 && !this.hasLocalScores) {
            this.applyScores(scores);
            this.viewMode = "online";
            this.freshLoad = false;
          }
        }
      } else {
        this.onlineScoresCacheRaw = [];
        this.onlineScoresCache = [];
        this.hasOnlineScores = false;
      }
    } catch (err) {
      if (requestId === this.requestToken) {
        console.error("Failed to fetch leaderboard:", err);
        this.error = "Failed to load leaderboard";
      }
    } finally {
      if (requestId === this.requestToken) {
        this.loading = false;
        
        if (
          this.scores.length === 0 &&
          this.hasLocalScores &&
          this.localScoresCache
        ) {
          this.applyScores(this.localScoresCache);
          this.viewMode = "local";
          this.freshLoad = false;
        }
      }
    }
  }

  public setFadeProgress(progress: number): void {
    if (!this.enabled) {
      return;
    }
    this.fadeProgress = progress;
  }

  public setAccentColor(color: AccentColor | null): void {
    if (!this.enabled) {
      return;
    }
    this.accentColor = color;
  }

  public hasScores(): boolean {
    return this.enabled && this.scores != null && this.scores.length > 0;
  }

  public update(
    mousePos: Vector2,
    albumCenterX: number,
    centerY: number,
    albumSize: number
  ): void {
    if (!this.enabled) {
      this.toggleButtonHovered = false;
      return;
    }
    if (!this.currentMap || this.fadeProgress < 0.01) {
      this.toggleButtonHovered = false;
      return;
    }
    if (this.scores.length === 0) {
      
      this.toggleButtonHovered = false;
      return;
    }
    const showToggle =
      (this.viewMode === "online" && this.hasLocalScores) ||
      (this.viewMode === "local" && this.hasOnlineScores);
    if (!showToggle) {
      this.toggleButtonHovered = false;
      
    }
    
    const albumRight = albumCenterX + albumSize / 2;
    const leaderboardX = albumRight - this.overlap;

    
    const visibleCount = Math.max(1, this.scores.length);
    const blockHeight = this.scores.length
      ? visibleCount * this.scoreHeight + (visibleCount - 1) * this.scoreGap
      : measureText("A", 20, 1).height;
    const scoresListY = centerY - blockHeight / 2;
    const bottomY = scoresListY + blockHeight;

    const label =
      this.viewMode === "online" ? "View local scores" : "View online scores";
    const labelSize = measureText(label, 18, 1);
    const labelX = leaderboardX + this.scoreWidth / 2 - labelSize.width / 2;
    const labelY = bottomY + 10; 

    this.toggleButtonBounds = {
      x: labelX - 6,
      y: labelY - 3,
      width: labelSize.width + 12,
      height: labelSize.height + 6,
    };

    const hovered =
      mousePos.x >= this.toggleButtonBounds.x &&
      mousePos.x <= this.toggleButtonBounds.x + this.toggleButtonBounds.width &&
      mousePos.y >= this.toggleButtonBounds.y &&
      mousePos.y <= this.toggleButtonBounds.y + this.toggleButtonBounds.height;
    this.toggleButtonHovered = hovered;

    if (hovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
      const nextMode: LeaderboardViewMode =
        this.viewMode === "online" ? "local" : "online";
      this.setViewMode(nextMode);
      this.suppressScoreClickFrames = 2;
    }

    this.handleScoreClicks(mousePos, albumCenterX, centerY, albumSize);
    this.updateHoverAnimations(mousePos, albumCenterX, centerY, albumSize);

    if (this.suppressScoreClickFrames > 0) this.suppressScoreClickFrames--;
  }

  private updateHoverAnimations(
    mousePos: Vector2,
    albumCenterX: number,
    centerY: number,
    albumSize: number
  ): void {
    if (!this.currentMap || this.scores.length === 0) return;
    const albumRight = albumCenterX + albumSize / 2;
    const leaderboardX = albumRight - this.overlap;
    const scoreWidth = this.scoreWidth;
    const scoreHeight = this.scoreHeight;
    const scoreGap = this.scoreGap;
    const visibleCount = Math.max(1, this.scores.length);
    const blockHeight = this.scores.length
      ? visibleCount * scoreHeight + (visibleCount - 1) * scoreGap
      : measureText("A", 20, 1).height;
    const scoresListY = centerY - blockHeight / 2;

    for (let i = 0; i < this.scores.length; i++) {
      const scoreY = scoresListY + i * (scoreHeight + scoreGap);
      const startX = albumRight - scoreWidth;
      const finalX = leaderboardX;
      const cardAnim = this.cardAnimations[i] || 0;
      const animatedX = startX + (finalX - startX) * cardAnim;
      const hover = this.hoverAnimations[i] || 0;
      const hoverScale = 1 + 0.03 * hover;
      const cardW = scoreWidth * hoverScale;
      const cardH = scoreHeight * hoverScale;
      const cardX = animatedX + (scoreWidth - cardW) / 2;
      const cardY = scoreY + (scoreHeight - cardH) / 2;

      const within =
        mousePos.x >= cardX &&
        mousePos.x <= cardX + cardW &&
        mousePos.y >= cardY &&
        mousePos.y <= cardY + cardH;

      const target = within ? 1 : 0;
      const current = this.hoverAnimations[i] || 0;
      this.hoverAnimations[i] = lerpDelta(current, target, 0.22);
    }
  }

  private handleScoreClicks(
    mousePos: Vector2,
    albumCenterX: number,
    centerY: number,
    albumSize: number
  ): void {
    if (this.suppressScoreClickFrames > 0) return;
    if (!this.currentMap || this.scores.length === 0) return;
    const albumRight = albumCenterX + albumSize / 2;
    const leaderboardX = albumRight - this.overlap;
    const scoreWidth = this.scoreWidth;
    const scoreHeight = this.scoreHeight;
    const scoreGap = this.scoreGap;
    const visibleCount = Math.max(1, this.scores.length);
    const blockHeight = this.scores.length
      ? visibleCount * scoreHeight + (visibleCount - 1) * scoreGap
      : measureText("A", 20, 1).height;
    const scoresListY = centerY - blockHeight / 2;

    for (let i = 0; i < this.scores.length; i++) {
      const y = scoresListY + i * (scoreHeight + scoreGap);
      const startX = albumRight - scoreWidth;
      const finalX = leaderboardX;
      const cardAnim = this.cardAnimations[i] || 0;
      const animatedX = startX + (finalX - startX) * cardAnim;
      const hover = this.hoverAnimations[i] || 0;
      const hoverScale = 1 + 0.03 * hover;
      const cardW = scoreWidth * hoverScale;
      const cardH = scoreHeight * hoverScale;
      const x = animatedX + (scoreWidth - cardW) / 2;
      const within =
        mousePos.x >= x &&
        mousePos.x <= x + cardW &&
        mousePos.y >= y + (scoreHeight - cardH) / 2 &&
        mousePos.y <= y + (scoreHeight - cardH) / 2 + cardH;
      if (within && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        const score = this.scores[i];
        const payload = this.buildResultsPayload(score);
        if (payload && this.onScoreClick) this.onScoreClick(payload);
        break;
      }
    }
  }

  private buildResultsPayload(score: Score): FinalResultsPayload | null {
    if (!this.currentMap) return null;
    if (this.viewMode === "local" && score.localRaw) {
      const e = score.localRaw;
      return {
        map: this.currentMap,
        stats: {
          score: e.score,
          hits: e.hits,
          misses: e.misses,
          combo: e.combo,
          maxCombo: e.maxCombo,
          accuracy: e.accuracy,
          failed: false,
        },
        createdAt: e.createdAt,
        replayPath: e.replayPath,
        speed: ModeManager.getMode().musicPitch ?? 1,
      };
    }
    const totalNotes =
      (this.currentMap as any)?.noteCount ??
      ((this.currentMap as any)?.notes?.length ?? 0);
    const misses = Math.max(0, score.misses || 0);
    const hits = Math.max(0, totalNotes > 0 ? totalNotes - misses : 0);
    const accuracy = totalNotes > 0 ? hits / totalNotes : 0;
    const raw: any = score as any;
    let numericScore = 0;
    if (typeof raw.score === "number") numericScore = raw.score;
    else if (typeof raw.total_score === "number") numericScore = raw.total_score;
    else if (typeof raw.value === "number") numericScore = raw.value;
    return {
      map: this.currentMap,
      stats: {
        score: numericScore,
        hits,
        misses,
        combo: 0,
        maxCombo: 0,
        accuracy,
        failed: score.passed === false,
      },
      createdAt: Date.now(),
      speed: typeof score.speed === "number" ? score.speed : 1,
    };
  }

  public draw(albumCenterX: number, centerY: number, albumSize: number): void {
    if (!this.enabled) {
      return;
    }
    if (!this.currentMap) {
      return;
    }

    if (this.fadeProgress < 0.01) return;

    this.cardAnimations = this.cardAnimations.map((anim, index) => {
      const targetDelay = index * 0.08;
      const animSpeed = 0.12;
      if (this.fadeProgress > targetDelay) {
        return lerpDelta(anim, 1, animSpeed);
      }
      return anim;
    });

    const albumRight = albumCenterX + albumSize / 2;
    const leaderboardX = albumRight - this.overlap;
    const scoreWidth = this.scoreWidth;
    const scoreHeight = this.scoreHeight;
    const scoreGap = this.scoreGap;

    const isRanked = this.currentMap.onlineStatus === "RANKED";

    
    const visibleCount = Math.max(1, this.scores.length);
    const blockHeight = this.scores.length
      ? visibleCount * scoreHeight + (visibleCount - 1) * scoreGap
      : measureText("A", 20, 1).height; 
    const scoresListY = centerY - blockHeight / 2;

    
    if (this.viewMode === "online" && !isRanked) {
      return;
    }

    
    if (this.loading && this.scores.length === 0) {
      return;
    }

    if (this.error && this.scores.length === 0) {
      return;
    }

    this.scores.forEach((score, index) => {
      const scoreY = scoresListY + index * (scoreHeight + scoreGap);
      const rank = index + 1;

      const cardAnim = this.cardAnimations[index] || 0;
      if (cardAnim < 0.01) return;

      const startX = albumRight - scoreWidth; 
      const finalX = leaderboardX; 
      const animatedX = startX + (finalX - startX) * cardAnim;

      const hover = this.hoverAnimations[index] || 0;
      const hoverScale = 1 + 0.03 * hover; 
      const cardW = scoreWidth * hoverScale;
      const cardH = scoreHeight * hoverScale;
      const cardX = animatedX + (scoreWidth - cardW) / 2;
      const cardY = scoreY + (scoreHeight - cardH) / 2;

      const baseColor = { r: 20, g: 20, b: 25 };
      const containerColor = tintWithAccent(
        baseColor,
        this.accentColor,
        0.15 + 0.2 * hover
      );
      const borderColor = tintWithAccent(
        { r: 40, g: 40, b: 45 },
        this.accentColor,
        0.2 + 0.25 * hover
      );
      drawSprite(
        "/solid.png",
        Vector2(cardX - 1, cardY - 1),
        Vector2(cardW + 2, cardH + 2),
        {
          ...borderColor,
          a: 180 * this.fadeProgress * cardAnim,
        }
      );

      drawSprite("/solid.png", Vector2(cardX, cardY), Vector2(cardW, cardH), {
        ...containerColor,
        a: 200 * this.fadeProgress * cardAnim,
      });

      const rankColor =
        rank === 1
          ? { r: 255, g: 215, b: 0 }
          : rank === 2
          ? { r: 192, g: 192, b: 192 }
          : rank === 3
          ? { r: 205, g: 127, b: 50 }
          : { r: 150, g: 150, b: 150 };
      const innerPad = 20;
      const contentPad = this.overlap + innerPad;
      const rankX = cardX + contentPad + 25;
      const nameFontSize = 20;
      const rankFontSize = 24;
      const detailsFontSize = 18;
      const lineGapY = 6; 
      const topLineH = Math.max(
        measureText("A", nameFontSize, 1).height,
        measureText("A", rankFontSize, 1).height
      );
      const detailsH = measureText("A", detailsFontSize, 1).height;
      const blockH = topLineH + lineGapY + detailsH;
      const firstLineY = cardY + Math.max(0, (cardH - blockH) / 2);

      drawText(
        `#${rank}`,
        Vector2(rankX, firstLineY + 5),
        rankFontSize,
        { ...rankColor, a: 255 * this.fadeProgress * cardAnim },
        "left"
      );

      
      const username = score.username || "Unknown";
      const nameX = rankX + 42;
      const rightEdge = cardX + cardW - 15;
      let reservedRight = 0;
      if (score.awarded_sp && score.awarded_sp > 0) {
        const spLabel = `+${score.awarded_sp} SP`;
        const spSize = measureText(spLabel, 20, 1);
        reservedRight += spSize.width + 12;
      }
      const maxTitleWidth = Math.max(0, rightEdge - reservedRight - nameX);
      const fitText = (text: string, size: number, maxW: number): string => {
        if (maxW <= 0) return "";
        if (measureText(text, size, 1).width <= maxW) return text;
        let low = 0,
          high = text.length,
          best = 0;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const t = text.slice(0, mid) + (mid < text.length ? "..." : "");
          const w = measureText(t, size, 1).width;
          if (w <= maxW) {
            best = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        return text.slice(0, best) + (best < text.length ? "..." : "");
      };
      const fittedName = fitText(username, 20, maxTitleWidth);
      
      drawText(
        fittedName,
        Vector2(nameX, firstLineY),
        nameFontSize,
        { r: 220, g: 220, b: 220, a: 255 * this.fadeProgress * cardAnim },
        "left"
      );

      
      
      const detailsY = firstLineY + topLineH + lineGapY;
      const fontSize = 18;
      const gap = 8;
      let cursorX = nameX;
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
        drawSeg("SPIN", neutral(255 * this.fadeProgress * cardAnim));
      }
      
      const totalNotes =
        this.currentMap?.noteCount ?? this.currentMap?.notes?.length ?? 0;
      const missesVal = Math.max(0, score.misses ?? 0);
      let hitsVal: number | null;
      let accStr = "";
      if (this.viewMode === "local" && typeof score.localHits === "number") {
        hitsVal = Math.max(0, score.localHits);
        const attempted = hitsVal + missesVal;
        if (attempted > 0) accStr = ((hitsVal / attempted) * 100).toFixed(1);
      } else {
        hitsVal = totalNotes > 0 ? Math.max(0, totalNotes - missesVal) : null;
        if (totalNotes > 0 && hitsVal !== null) {
          accStr = ((hitsVal / totalNotes) * 100).toFixed(1);
        }
      }

      
      drawSeg(String(missesVal), neutral(255 * this.fadeProgress * cardAnim));
      drawSeg("X", redMatte(255 * this.fadeProgress * cardAnim));
      if (hitsVal !== null) {
        drawSeg(String(hitsVal), neutral(255 * this.fadeProgress * cardAnim));
        drawSeg("O", greenMatte(255 * this.fadeProgress * cardAnim));
      }
      if (accStr) {
        drawSeg(accStr, neutral(255 * this.fadeProgress * cardAnim));
        drawSeg("%", blueMatte(255 * this.fadeProgress * cardAnim));
      }

      if (score.awarded_sp !== null && score.awarded_sp > 0) {
        drawText(
          `+${score.awarded_sp} SP`,
          Vector2(cardX + cardW - 15, firstLineY),
          nameFontSize,
          { r: 100, g: 200, b: 100, a: 255 * this.fadeProgress * cardAnim },
          "right"
        );
      }
      if (score.speed !== null && score.speed !== 1) {
        const speedVal = typeof score.speed === "number" ? score.speed : 1;
        const speedRoundedUp = Math.ceil(speedVal * 100) / 100;
        const speedLabel = `${speedRoundedUp.toFixed(2)}x`;
        drawText(
          speedLabel,
          Vector2(cardX + cardW - 15, detailsY),
          18,
          { r: 200, g: 200, b: 200, a: 220 * this.fadeProgress * cardAnim },
          "right"
        );
      }
    });

    

    
    const showToggle =
      this.scores.length > 0 &&
      ((this.viewMode === "online" && this.hasLocalScores) ||
        (this.viewMode === "local" && this.hasOnlineScores));
    if (showToggle) {
      this.drawToggleLabel(
        leaderboardX,
        centerY,
        scoreWidth,
        scoreHeight,
        scoreGap
      );
    }
  }

  private setViewMode(mode: LeaderboardViewMode): void {
    if (!this.enabled) {
      return;
    }
    if (this.viewMode === mode) return;

    this.viewMode = mode;

    if (mode === "online") {
      if (this.currentMap && this.currentMap.onlineStatus === "RANKED") {
        if (this.onlineScoresCache) {
          this.applyScores(this.onlineScoresCache);
        } else {
          const requestId = ++this.requestToken;
          this.fetchLeaderboard(this.currentMap.id, requestId);
        }
      }
    } else {
      if (this.currentMap) {
        if (this.localScoresCache) {
          this.applyScores(this.localScoresCache);
        } else {
          this.loadLocalScores(this.currentMap.id);
          if (this.localScoresCache) this.applyScores(this.localScoresCache);
        }
      }
    }
  }

  private getToggleButtonBounds(
    albumCenterX: number,
    centerY: number,
    albumSize: number
  ): ButtonBounds {
    const albumRight = albumCenterX + albumSize / 2;
    const spacing = 24;
    const leaderboardX = albumRight + spacing;
    const startY = centerY - albumSize / 2;
    const scoreWidth = 300;
    const buttonWidth = 150;
    const buttonHeight = 32;
    const buttonX = leaderboardX + scoreWidth - buttonWidth;
    const buttonY = startY - 6;

    return { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
  }

  private loadLocalScores(mapId: string): void {
    try {
      const activeIds = ModeManager.getActiveModeIds();
      const entries = getLocalScores(mapId, activeIds);
      const scores: Score[] = entries.slice(0, 5).map((e, idx) => ({
        id: e.createdAt || idx,
        username: "You",
        awarded_sp: null,
        misses: e.misses,
        speed: null,
        spin: false,
        mods: {},
        passed: true,
        avatar_url: null,
        localHits: e.hits,
        localRaw: e,
      }));
      this.localScoresCache = scores;
      this.hasLocalScores = scores.length > 0;
    } catch (err) {
      console.error("Failed to load local scores:", err);
      this.localScoresCache = [];
      this.hasLocalScores = false;
    }
  }

  private applyScores(scores: Score[]): void {
    const prevAnims = this.cardAnimations ? this.cardAnimations.slice() : [];
    const prevHover = this.hoverAnimations ? this.hoverAnimations.slice() : [];
    this.scores = scores;
    if (this.freshLoad) {
      
      this.cardAnimations = new Array(scores.length).fill(0);
      this.hoverAnimations = new Array(scores.length).fill(0);
    } else {
      
      this.cardAnimations = scores.map((_, i) => prevAnims[i] ?? 1);
      this.hoverAnimations = scores.map((_, i) => prevHover[i] ?? 0);
    }
  }

  private filterOnlineByMode(scores: Score[]): Score[] {
    const mode = ModeManager.getMode();
    const pitch = mode.musicPitch ?? 1;
    const tol = 1e-3;
    return scores.filter((s) => {
      const sp = s.speed == null ? 1 : s.speed;
      return Math.abs(sp - pitch) <= tol;
    });
  }

  private drawToggleLabel(
    leaderboardX: number,
    centerY: number,
    scoreWidth: number,
    scoreHeight: number,
    scoreGap: number
  ): void {
    const visibleCount = Math.max(1, this.scores.length);
    const blockHeight = this.scores.length
      ? visibleCount * scoreHeight + (visibleCount - 1) * scoreGap
      : measureText("A", 20, 1).height;
    const scoresListY = centerY - blockHeight / 2;
    const bottomY = scoresListY + blockHeight;

    const label =
      this.viewMode === "online" ? "View local scores" : "View online scores";
    const fs = 18;
    const labelSize = measureText(label, fs, 1);
    const labelX = leaderboardX + scoreWidth / 2;
    const alpha = Math.max(0, Math.min(255, this.fadeProgress * 230));
    const baseColor = { r: 160, g: 170, b: 185 };
    const labelColor = tintWithAccent(
      baseColor,
      this.accentColor,
      this.toggleButtonHovered ? 0.35 : 0.2
    );

    drawText(
      label,
      Vector2(labelX, bottomY + 10),
      fs,
      { ...labelColor, a: alpha },
      "center"
    );
  }
}
