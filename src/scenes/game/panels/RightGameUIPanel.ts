import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
  GetFrameTime,
  rlScalef,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";
import { GameUIPanel, GameUIPanelCommonArgs } from "./GameUIPanel";

export interface RightPanelArgs extends GameUIPanelCommonArgs {
  totalNotes: number;
  hits: number;
  misses: number;
  score: number;
}

export class RightGameUIPanel extends GameUIPanel<RightPanelArgs> {
  constructor(private readonly formatScore: (score: number) => string) {
    super();
  }

  
  private currentRank: "SS" | "S" | "A" | "B" | "C" | "D" | null = null;
  private prevRank: "SS" | "S" | "A" | "B" | "C" | "D" | null = null;
  private rankProgress: number = 1; 
  private rankDirection: 1 | -1 = 1; 
  private readonly rankDuration: number = 0.5; 

  private static rankOrder: ("D" | "C" | "B" | "A" | "S" | "SS")[] = [
    "D",
    "C",
    "B",
    "A",
    "S",
    "SS",
  ];

  private getRankIndex(r: "SS" | "S" | "A" | "B" | "C" | "D"): number {
    return RightGameUIPanel.rankOrder.indexOf(r as any);
  }

  private computeLetterRank(
    accuracy: number
  ): "SS" | "S" | "A" | "B" | "C" | "D" | null {
    if (Math.abs(accuracy - 100) < 1e-6) return "SS";
    if (accuracy >= 98) return "S";
    if (accuracy >= 95) return "A";
    if (accuracy >= 90) return "B";
    if (accuracy >= 85) return "C";
    if (accuracy >= 80) return "D";
    return null;
  }

  private updateRankTransition(
    next: "SS" | "S" | "A" | "B" | "C" | "D" | null
  ): void {
    const dt = GetFrameTime();

    
    if (this.currentRank === null) {
      this.currentRank = next;
      this.prevRank = null;
      this.rankProgress = 1;
      return;
    }

    
    if (next === this.currentRank) {
      if (this.rankProgress < 1) {
        this.rankProgress = Math.min(
          1,
          this.rankProgress + dt / this.rankDuration
        );
      }
      return;
    }

    
    if (next === null || this.currentRank === null) {
      this.prevRank = null;
      this.currentRank = next;
      this.rankProgress = 1;
      return;
    }

    
    this.prevRank = this.currentRank;
    this.currentRank = next;
    this.rankProgress = 0;
    const prevIdx = this.getRankIndex(this.prevRank);
    const nextIdx = this.getRankIndex(next);
    this.rankDirection = nextIdx > prevIdx ? 1 : -1;
  }

  public render(args: RightPanelArgs): void {
    rlPushMatrix();

    const uiOpacity = args.settings?.uiOpacity ?? 0.15;
    const uiTiltRate = args.settings?.uiTiltRate ?? 1.0;
    const playfieldScale = args.settings?.playfieldScale ?? 1.0;
    const uiScale = args.settings?.uiScale ?? 1.0;

    const planeWidth = 150;
    const planeHeight = 350;

    const effectiveBorderHalf = (320 * playfieldScale) / 2;
    const baseMargin = Math.min(Rhythia.gameWidth, Rhythia.gameHeight) * 0.2 * playfieldScale;
    const marginScalePush = 1 + (uiScale - 1) * 0.25;
    const normalizedMargin = Math.round(baseMargin * marginScalePush);
    const planeX =
      Rhythia.gameWidth / 2 +
      effectiveBorderHalf +
      (planeWidth / 2) * uiScale +
      normalizedMargin;
    const planeY = Rhythia.gameHeight / 2;

    const depth = args.closeDistance;
    rlTranslatef(planeX, planeY, depth);
    const tiltCompensation = 1 - uiTiltRate;
    rlTranslatef(
      args.cameraTiltX * 100 * tiltCompensation,
      args.cameraTiltY * 100 * tiltCompensation,
      0
    );
    rlRotatef(10, 0, 1, 0);
    rlScalef(uiScale, uiScale, 1.0);
    drawSprite(
      "/solid.png",
      Vector2(-planeWidth / 2, -planeHeight / 2),
      Vector2(planeWidth, planeHeight),
      { r: 0, g: 0, b: 0, a: Math.round(255 * uiOpacity * 3) }
    );

    const startY = -40;
    const textOpacity = Math.round(255 * (uiOpacity * 5));

    const total = args.hits + args.misses;
    const accuracy = total > 0 ? (args.hits / total) * 100 : 100;

    const letterRank = this.computeLetterRank(accuracy);
    this.updateRankTransition(letterRank);

    drawText(
      `SCORE`,
      Vector2(0, startY - 70),
      18,
      { r: 180, g: 180, b: 180, a: textOpacity },
      "center"
    );
    const scoreText = `${this.formatScore(args.score)}`;
    const scoreY = startY - 45;
    const scoreFontSize = 36;
    drawText(
      scoreText,
      Vector2(0, scoreY),
      scoreFontSize,
      { r: 255, g: 255, b: 255, a: textOpacity },
      "center"
    );

    let notesLeftY = startY + 120;
    const metrics = measureText(scoreText, scoreFontSize);
    const badgeSize = 90;
    const badgeTop = scoreY + metrics.height + 8; 

    
    if (this.currentRank || this.prevRank) {
      const t = Math.min(1, this.rankProgress);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
      const offset = 60; 

      if (this.prevRank && t < 1) {
        const prevAlpha = Math.round(textOpacity * (1 - ease));
        const prevCenterX = this.rankDirection * offset * ease; 
        drawSprite(
          `/score_${this.prevRank}.png`,
          Vector2(-badgeSize / 2 + prevCenterX, badgeTop),
          Vector2(badgeSize, badgeSize),
          { r: 255, g: 255, b: 255, a: prevAlpha }
        );
      }

      if (this.currentRank) {
        const currAlpha = Math.round(textOpacity * (this.prevRank ? ease : 1));
        const currCenterX =
          this.prevRank && t < 1
            ? -this.rankDirection * offset * (1 - ease)
            : 0; 
        drawSprite(
          `/score_${this.currentRank}.png`,
          Vector2(-badgeSize / 2 + currCenterX, badgeTop),
          Vector2(badgeSize, badgeSize),
          { r: 255, g: 255, b: 255, a: currAlpha }
        );
      }

      notesLeftY = badgeTop + badgeSize + 10;
    }

    const notesPlayed = total;
    const notesRemaining = Math.max(0, args.totalNotes - notesPlayed);
    drawText(
      `${notesRemaining} notes left`,
      Vector2(0, notesLeftY),
      16,
      { r: 140, g: 140, b: 140, a: textOpacity },
      "center"
    );

    
    args.decorations.forEach((decoration) => {
      decoration.renderRightOverlay(
        planeX,
        planeY,
        planeWidth,
        planeHeight,
        depth,
        args.decorationContext
      );
    });

    rlPopMatrix();
  }
}
