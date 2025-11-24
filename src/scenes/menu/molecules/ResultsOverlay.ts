import { GameObject } from "../../../atoms/Object";
import { Rhythia } from "../../../atoms/Rhythia";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { FinalResultsPayload } from "../../../utils/results";
import {
  AccentColor,
  getBlurredImageWithColor,
} from "../../../utils/imageBlur";
import {
  IsKeyPressed,
  KEY_ENTER,
  KEY_ESCAPE,
  rlTranslatef,
  rlPushMatrix,
  rlPopMatrix,
  rlScalef,
  Vector2,
  GetFrameTime,
  DrawLine,
} from "raylib";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";
import { ModeManager } from "../../game/modes";
import { PlayButton } from "./musicplayer/PlayButton";
import { logger } from "../../../utils/logger";
import { loadReplay } from "../../../utils/replays";
import type { ReplayNoteHit } from "../../../utils/replays";
import { setLastResults } from "../../../utils/results";
import { ReplayPlayer } from "../../game/ReplayPlayer";
import { GameScene } from "../../game";
import { toastManager } from "../../../utils/toastManager";
import * as fs from "fs";
import { getLocalScoresPath } from "../../../utils/storage/localScores";
import { exec } from "child_process";
import * as path from "path";

export class ResultsOverlay {
  private go: GameObject;
  private visible = false;
  private data: FinalResultsPayload | null = null;
  private accentColor: AccentColor | null = null;
  private blurredPath: string | null = null;
  private viewReplayButton: PlayButton;
  private removeReplayButton: PlayButton;
  private viewInExplorerButton: PlayButton;
  private playButton: PlayButton;
  private backButton: PlayButton;
  private replayNoteHits: ReplayNoteHit[] | null = null;
  private healthGraphProgress: number = 0;

  constructor() {
    this.go = new GameObject({ zBase: 50 });
    this.go.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: Rhythia.gameHeight },
    });
    this.go.onUpdate = () => this.update();
    this.go.onDraw = () => this.draw();

    if (this.go.rectArea) {
      this.go.rectArea.onClick = () => this.isBlocking();
    }

    this.viewReplayButton = new PlayButton({
      text: "VIEW REPLAY",
      animateLetters: false,
    });
    this.removeReplayButton = new PlayButton({
      text: "REMOVE REPLAY",
      animateLetters: false,
    });
    this.viewInExplorerButton = new PlayButton({
      text: "VIEW IN EXPLORER",
      animateLetters: false,
    });
    this.playButton = new PlayButton({ text: "PLAY", animateLetters: false });
    this.backButton = new PlayButton({ text: "BACK", animateLetters: false });
  }

  public show(data: FinalResultsPayload): void {
    this.data = data;
    this.visible = true;
    this.replayNoteHits = null;
    this.healthGraphProgress = 0;

    try {
      const p = data?.replayPath;
      if (p && p.toLowerCase().endsWith(".rre")) {
        const r = loadReplay(p as string);
        if (r?.noteHits && Array.isArray(r.noteHits))
          this.replayNoteHits = r.noteHits as ReplayNoteHit[];
      }
    } catch {}

    void this.prepareBlurCover();
  }

  private async prepareBlurCover(): Promise<void> {
    try {
      const img = this.data?.map?.onlineImage;
      if (!img) {
        this.blurredPath = null;
        return;
      }
      const res = await getBlurredImageWithColor(img, 25);
      this.blurredPath = res.path;
      this.accentColor = res.accentColor;
    } catch {
      this.blurredPath = null;
    }
  }

  public hide(): void {
    this.visible = false;
  }

  private update(): void {
    if (!this.visible) return;
    try {
      this.healthGraphProgress = Math.min(
        1,
        this.healthGraphProgress + Math.max(0, GetFrameTime()) * 0.9
      );
    } catch {}
    if (IsKeyPressed(KEY_ENTER) || IsKeyPressed(KEY_ESCAPE)) {
      this.hide();
    }

    const mouse = this.go.getMousePosition();
    if (!mouse) return;

    const leftMargin = 20;
    const rightMargin = 20;
    const bottomMargin = 20;
    const gap = 12;

    const allowVR = !!(
      this.data?.replayPath &&
      this.data.replayPath.toLowerCase().endsWith(".rre")
    );
    const vrWidth = allowVR ? this.viewReplayButton.getWidth() : 0;
    const vrHeight = allowVR ? this.viewReplayButton.getHeight() : 0;
    const rrWidth = allowVR ? this.removeReplayButton.getWidth() : 0;
    const rrHeight = allowVR ? this.removeReplayButton.getHeight() : 0;
    const veWidth = allowVR ? this.viewInExplorerButton.getWidth() : 0;
    const veHeight = allowVR ? this.viewInExplorerButton.getHeight() : 0;
    const pWidth = this.playButton.getWidth();
    const pHeight = this.playButton.getHeight();
    const backWidth = this.backButton.getWidth();
    const backHeight = this.backButton.getHeight();

    const rowY =
      Rhythia.gameHeight - bottomMargin - Math.max(vrHeight, pHeight);

    const playCenterX = Rhythia.gameWidth - rightMargin - pWidth / 2;
    const vrCenterX = playCenterX - (pWidth / 2 + gap + vrWidth / 2);
    const rrCenterX = vrCenterX - (vrWidth / 2 + gap + rrWidth / 2);
    const veCenterX = rrCenterX - (rrWidth / 2 + gap + veWidth / 2);

    const tVR = this.transformPoint(vrCenterX, rowY);
    const tRR = this.transformPoint(rrCenterX, rowY);
    const tVE = this.transformPoint(veCenterX, rowY);
    const tPlay = this.transformPoint(playCenterX, rowY);
    const vrClicked = allowVR
      ? this.viewReplayButton.update(mouse, tVR.x, tVR.y)
      : false;
    const rrClicked = allowVR
      ? this.removeReplayButton.update(mouse, tRR.x, tRR.y)
      : false;
    const veClicked = allowVR
      ? this.viewInExplorerButton.update(mouse, tVE.x, tVE.y)
      : false;
    const playClicked = this.playButton.update(mouse, tPlay.x, tPlay.y);

    const backCenterX = leftMargin + backWidth / 2;
    const backY = Rhythia.gameHeight - bottomMargin - backHeight;
    const tBack = this.transformPoint(backCenterX, backY);
    const backClicked = this.backButton.update(mouse, tBack.x, tBack.y);

    if (allowVR && vrClicked) {
      const path = this.data?.replayPath;
      if (!path) {
        toastManager.show("Replay not available for this score");
      } else {
        const replay = loadReplay(path);
        if (!replay) {
          toastManager.show("Invalid replay file format");
        } else {
          try {
            if (this.data) {
              setLastResults(this.data.map as any, this.data.stats as any, {
                replayPath: this.data.replayPath,
              });
            }
          } catch {}
          const player = new ReplayPlayer(replay);
          void Rhythia.goToScene(
            new GameScene(
              this.data!.map as any,
              true,
              false,
              undefined,
              0,
              player,
            ),
            true,
            true,
          );
        }
      }
    }
    if (allowVR && rrClicked) {
      const rp = this.data?.replayPath;
      if (rp) {
        try { fs.unlinkSync(rp); } catch {}
        try {
          const dbPath = getLocalScoresPath();
          if (fs.existsSync(dbPath)) {
            const raw = fs.readFileSync(dbPath, "utf-8");
            const parsed = JSON.parse(raw);
            let changed = false;
            for (const k of Object.keys(parsed || {})) {
              const arr = Array.isArray(parsed[k]) ? parsed[k] : [];
              for (let i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].replayPath === rp) {
                  delete arr[i].replayPath;
                  changed = true;
                }
              }
              parsed[k] = arr;
            }
            if (changed) fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2), "utf-8");
          }
        } catch {}
        try { (global as any)?.currentMenuScene?.refreshLeaderboard?.(); } catch {}
        this.hide();
        toastManager.show("Replay removed");
      } else {
        toastManager.show("Replay not available for this score");
      }
    }
    if (allowVR && veClicked) {
      const rp = this.data?.replayPath;
      if (rp) {
        try {
          if (process.platform === "win32") {
            const p = rp.replace(/\//g, "\\");
            const command = `explorer.exe /select,"${p}"`;
            exec(command);
          } else if (process.platform === "darwin") {
            const command = `open -R "${rp}"`;
            exec(command);
          } else {
            const dir = path.dirname(rp);
            const command = `xdg-open "${dir}"`;
            exec(command);
          }
        } catch {}
      } else {
        toastManager.show("Replay not available for this score");
      }
    }
    if (playClicked) {
      void Rhythia.goToScene(
        new GameScene(this.data!.map as any, true, false, undefined, 0),
        true,
        true,
      );
    }
    if (backClicked) this.hide();
  }

  private draw(): void {
    if (!this.visible || !this.data) return;

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
    const worldTopY = -viewportY / Math.max(0.0001, scaleY);
    const worldWidth = displayW / Math.max(0.0001, scaleX);
    const worldHeight = displayH / Math.max(0.0001, scaleY);

    if (this.blurredPath) {
      drawSprite(
        this.blurredPath,
        Vector2(worldLeftX, worldTopY),
        Vector2(worldWidth, worldHeight),
        { r: 255, g: 255, b: 255, a: 255 },
        undefined,
        true,
        true,
      );

      drawSprite(
        "/solid.png",
        Vector2(worldLeftX, worldTopY),
        Vector2(worldWidth, worldHeight),
        { r: 0, g: 0, b: 0, a: 180 },
      );
    } else {
      drawSprite(
        "/solid.png",
        Vector2(worldLeftX, worldTopY),
        Vector2(worldWidth, worldHeight),
        { r: 0, g: 0, b: 0, a: 255 },
      );
    }

    let overlayR = 0,
      overlayG = 0,
      overlayB = 0;
    if (this.accentColor) {
      const overlayTintStrength = 0.3;
      overlayR = Math.round(this.accentColor.r * overlayTintStrength);
      overlayG = Math.round(this.accentColor.g * overlayTintStrength);
      overlayB = Math.round(this.accentColor.b * overlayTintStrength);
    }
    drawSprite(
      "/solid.png",
      Vector2(worldLeftX, worldTopY),
      Vector2(worldWidth, worldHeight),
      { r: overlayR, g: overlayG, b: overlayB, a: Math.round(0.5 * 255) },
    );

    let bgTintR = 255,
      bgTintG = 255,
      bgTintB = 255;
    if (this.accentColor) {
      const tintStrength = 0.5;
      bgTintR = Math.round(
        255 * (1 - tintStrength) + this.accentColor.r * tintStrength,
      );
      bgTintG = Math.round(
        255 * (1 - tintStrength) + this.accentColor.g * tintStrength,
      );
      bgTintB = Math.round(
        255 * (1 - tintStrength) + this.accentColor.b * tintStrength,
      );
    }

    const bigFontSize = 72;

    drawSprite(
      "/bg.png",
      Vector2(worldLeftX, worldTopY),
      Vector2(worldWidth, worldHeight),
      { r: bgTintR, g: bgTintG, b: bgTintB, a: Math.round(0.8 * 255) },
    );

    const pivotX = Rhythia.gameWidth / 2;
    const pivotY = Rhythia.gameHeight / 2;
    const parallaxX = 0;
    const parallaxY = 0;

    rlPushMatrix();
    rlTranslatef(pivotX, pivotY, 0);
    rlScalef(0.95, 0.95, 1.0);
    rlTranslatef(-pivotX, -pivotY, 0);
    rlTranslatef(-parallaxX, -parallaxY, 0);

    const title = this.data.map?.title ?? "";
    drawText(
      title,
      Vector2(20, 20),
      bigFontSize,
      { r: 255, g: 255, b: 255, a: 255 },
      "left",
    );

    const customName = (
      (this.data.map as any)?.customDifficultyName || ""
    ).trim();
    const difficulty = this.data.map?.difficulty;
    let difficultyText = customName || "N/A";
    if (!customName) {
      switch (difficulty) {
        case 1:
          difficultyText = "Easy";
          break;
        case 2:
          difficultyText = "Medium";
          break;
        case 3:
          difficultyText = "Hard";
          break;
        case 4:
          difficultyText = "Logic";
          break;
        case 5:
          difficultyText = "Tasukete";
          break;
        default:
          break;
      }
    }
    drawText(
      difficultyText,
      Vector2(20, 80),
      48,
      { r: 255, g: 255, b: 255, a: 190 },
      "left",
    );
    drawText(
      `mapped by ${this.data.map?.mappers.join(", ")}`,
      Vector2(20, 120),
      48,
      { r: 255, g: 255, b: 255, a: 190 },
      "left",
    );

    rlPushMatrix();
    rlTranslatef(0, 100, 0);

    const separatorY = 180;
    drawSprite(
      "/solid.png",
      Vector2(0, separatorY),
      Vector2(Rhythia.gameWidth, 3),
      { r: 255, g: 255, b: 255, a: 255 },
    );

    const speedVal = Math.max(
      0.001,
      (this.data as any)?.speed ?? ModeManager.getMode().musicPitch ?? 1,
    );
    const speedRoundedUp = Math.ceil(speedVal * 100) / 100;
    const speedLabel = `${speedRoundedUp.toFixed(2)}x`;
    drawText(
      speedLabel,
      Vector2(20, separatorY - 20 - 36),
      48,
      { r: 255, g: 255, b: 255, a: 255 },
      "left",
    );

    try {
      const coverSrc = (this.data.map as any)?.onlineImage as
        | string
        | undefined;
      const hasCover = !!coverSrc && coverSrc.length > 0;
      const translateY = 100;
      const sectionTop = -translateY;
      const sectionBottom = separatorY;
      const margin = 24;
      const available = Math.max(0, sectionBottom - sectionTop - margin * 2);
      if (available > 0) {
        const coverSize = Math.max(0, available);
        const coverX = Rhythia.gameWidth - 20 - coverSize;
        const centerY = (sectionTop + sectionBottom) / 2;
        const coverY = Math.round(centerY - coverSize / 2);

        drawSprite(
          "/solid.png",
          Vector2(coverX + 6, coverY + 6),
          Vector2(coverSize, coverSize),
          { r: 0, g: 0, b: 0, a: 120 },
        );

        if (hasCover) {
          const isHttp =
            coverSrc!.startsWith("http://") || coverSrc!.startsWith("https://");
          const isCachePath =
            coverSrc!.startsWith("./cache") || coverSrc!.startsWith("cache/");
          drawSprite(
            coverSrc!,
            Vector2(coverX, coverY),
            Vector2(coverSize, coverSize),
            { r: 255, g: 255, b: 255, a: 255 },
            `results-cover-${this.data.map?.id || coverSrc}`,
            isHttp ? false : isCachePath,
          );
        } else {
          drawSprite(
            "/square.png",
            Vector2(coverX, coverY),
            Vector2(coverSize, coverSize),
            { r: 255, g: 255, b: 255, a: 200 },
          );
        }
      }
    } catch {}

    const accuracyPct =
      Math.max(0, Math.min(1, this.data.stats.accuracy ?? 0)) * 100;
    const accuracyLabel = `${accuracyPct.toFixed(2)}%`;
    const belowY = separatorY + 18;
    drawText(
      accuracyLabel,
      Vector2(20, belowY),
      bigFontSize,
      { r: 255, g: 255, b: 255, a: 255 },
      "left",
    );

    const failed = this.data.stats.failed === true;
    const statusLabel = failed ? "Failed" : "Passed";
    drawText(
      statusLabel,
      Vector2(Rhythia.gameWidth - 20, belowY),
      bigFontSize,
      { r: 255, g: 255, b: 255, a: 255 },
      "right",
    );

    try {
      const nh = this.replayNoteHits ?? [];
      if (nh.length > 1) {
        const pts = nh
          .filter((p) => typeof (p as any).health === "number" && (p as any).health >= 0)
          .sort((a, b) => (a.t | 0) - (b.t | 0));
        if (pts.length > 1) {
          const colLeftX = Math.floor(Rhythia.gameWidth * 0.55);
          const graphLeft = 20;
          const graphTop = belowY + bigFontSize + 20;
          const graphWidth = Math.max(50, colLeftX - 80);
          const graphHeight = 200;

          drawSprite(
            "/solid.png",
            Vector2(graphLeft, graphTop),
            Vector2(graphWidth, graphHeight),
            { r: 255, g: 255, b: 255, a: 16 },
          );

          let maxH = 0;
          for (let i = 0; i < pts.length; i++) {
            if (pts[i].hit) {
              const h = Number(pts[i].health ?? 0);
              if (h > maxH) maxH = h;
            }
          }
          if (!(maxH > 0)) {
            for (let i = 0; i < pts.length; i++) {
              const h = Number(pts[i].health ?? 0);
              if (h > maxH) maxH = h;
            }
          }
          if (!(maxH > 0)) maxH = 1;

          const minT = pts[0].t | 0;
          const maxT = Math.max(minT + 1, pts[pts.length - 1].t | 0);
          const toX = (t: number) => graphLeft + ((t - minT) / (maxT - minT)) * graphWidth;
          const toY = (h: number) => graphTop + graphHeight - (Math.max(0, h) / maxH) * graphHeight;
          const cutoffX = graphLeft + graphWidth * Math.max(0, Math.min(1, this.healthGraphProgress));

          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const t0 = p0.t | 0;
            const t1 = p1.t | 0;
            const h0 = Number(p0.health ?? 0);
            const h1 = Number(p1.health ?? 0);
            const x0 = toX(t0);
            const x1 = toX(t1);
            if (x0 >= cutoffX) break;
            let xa = x0;
            let ya = toY(h0);
            let xb = x1;
            let yb = toY(h1);
            let hb = h1;
            if (x1 > cutoffX) {
              const r = (cutoffX - x0) / Math.max(0.0001, x1 - x0);
              xb = cutoffX;
              hb = h0 + (h1 - h0) * r;
              yb = toY(hb);
            }
            const hf = Math.max(0, Math.min(1, (h0 + hb) / 2 / maxH));
            let cr = 0, cg = 0, cb = 0;
            if (hf >= 0.5) {
              const tt = (hf - 0.5) / 0.5;
              cr = 255 * (1 - tt) + 60 * tt;
              cg = 210 * (1 - tt) + 220 * tt;
              cb = 80 * (1 - tt) + 120 * tt;
            } else {
              const tt = hf / 0.5;
              cr = 240 * (1 - tt) + 255 * tt;
              cg = 80 * (1 - tt) + 210 * tt;
              cb = 80 * (1 - tt) + 80 * tt;
            }
            DrawLine(Math.round(xa), Math.round(ya), Math.round(xb), Math.round(yb), {
              r: Math.round(cr),
              g: Math.round(cg),
              b: Math.round(cb),
              a: 230,
            });
          }
        }
      }
    } catch {}

    const rowValueFont = 56;
    const rowLabelFont = 36;
    const rowSpacing = 28;
    const lineThickness = 2;
    const gutter = 18;
    const rightMargin = 20;
    const colLeftX = Math.floor(Rhythia.gameWidth * 0.55);

    let rowY = belowY + bigFontSize + 36;

    let rank = "";
    if (Math.abs(accuracyPct - 100) < 1e-6) rank = "SS";
    else if (accuracyPct >= 98) rank = "S";
    else if (accuracyPct >= 95) rank = "A";
    else if (accuracyPct >= 90) rank = "B";
    else if (accuracyPct >= 85) rank = "C";
    else if (accuracyPct >= 80) rank = "D";

    const rows: Array<{ value: string; label: string }> = [
      {
        value: String(Math.max(0, this.data.stats.misses ?? 0)),
        label: "Misses",
      },
      { value: String(Math.max(0, this.data.stats.hits ?? 0)), label: "Hits" },
      {
        value: String(
          Math.max(
            0,
            (this.data.stats.maxCombo ?? this.data.stats.combo ?? 0) as number,
          ),
        ),
        label: "Max Combo",
      },
      { value: rank || "-", label: "Rank" },
      { value: "0", label: "Skill Points" },
    ];

    const colRightX = Rhythia.gameWidth - rightMargin;
    for (const row of rows) {
      const labelY = rowY + (rowValueFont - rowLabelFont) / 2;
      drawText(
        row.label,
        Vector2(colLeftX, labelY),
        rowLabelFont,
        { r: 255, g: 255, b: 255, a: 210 },
        "left",
      );

      drawText(
        row.value,
        Vector2(colRightX, rowY),
        rowValueFont,
        { r: 255, g: 255, b: 255, a: 255 },
        "right",
      );

      const labelSize = measureText(row.label, rowLabelFont, 1);
      const valueSize = measureText(row.value, rowValueFont, 1);
      const lineLeftX = Math.max(
        colLeftX + labelSize.width + gutter,
        colLeftX + 80,
      );
      const lineRightX = Math.min(
        colRightX - valueSize.width - gutter,
        colRightX - 80,
      );
      if (lineRightX > lineLeftX) {
        const lineY = rowY + rowValueFont / 2 - lineThickness / 2;
        drawSprite(
          "/solid.png",
          Vector2(lineLeftX, lineY),
          Vector2(lineRightX - lineLeftX, lineThickness),
          { r: 255, g: 255, b: 255, a: 25 },
        );
      }

      rowY += rowValueFont + rowSpacing;
    }
    rlPopMatrix();
    {
      const leftMargin = 20;
      const rightMargin = 20;
      const bottomMargin = 20;
      const gap = 12;

      const allowVR = !!(
        this.data?.replayPath &&
        this.data.replayPath.toLowerCase().endsWith(".rre")
      );
      const vrWidth = allowVR ? this.viewReplayButton.getWidth() : 0;
      const vrHeight = allowVR ? this.viewReplayButton.getHeight() : 0;
      const rrWidth = allowVR ? this.removeReplayButton.getWidth() : 0;
      const rrHeight = allowVR ? this.removeReplayButton.getHeight() : 0;
      const veWidth = allowVR ? this.viewInExplorerButton.getWidth() : 0;
      const veHeight = allowVR ? this.viewInExplorerButton.getHeight() : 0;
      const pWidth = this.playButton.getWidth();
      const pHeight = this.playButton.getHeight();
      const backWidth = this.backButton.getWidth();
      const backHeight = this.backButton.getHeight();

      const actionRowY =
        Rhythia.gameHeight - bottomMargin - Math.max(vrHeight, pHeight);
      const playCenterX = Rhythia.gameWidth - rightMargin - pWidth / 2;
      const vrCenterX = playCenterX - (pWidth / 2 + gap + vrWidth / 2);
      const rrCenterX = vrCenterX - (vrWidth / 2 + gap + rrWidth / 2);
      const veCenterX = rrCenterX - (rrWidth / 2 + gap + veWidth / 2);

      if (allowVR) {
        this.viewReplayButton.draw(vrCenterX, actionRowY);
        this.removeReplayButton.draw(rrCenterX, actionRowY);
        this.viewInExplorerButton.draw(veCenterX, actionRowY);
      }
      this.playButton.draw(playCenterX, actionRowY);

      const backCenterX = leftMargin + backWidth / 2;
      const backY = Rhythia.gameHeight - bottomMargin - backHeight;
      this.backButton.draw(backCenterX, backY);
    }

    rlPopMatrix();
  }

  private getTransformParams(): {
    pivotX: number;
    pivotY: number;
    scale: number;
    parallaxX: number;
    parallaxY: number;
  } {
    const pivotX = Rhythia.gameWidth / 2;
    const pivotY = Rhythia.gameHeight / 2;
    const scale = 0.95;
    const parallaxX = 0;
    const parallaxY = 0;
    return { pivotX, pivotY, scale, parallaxX, parallaxY };
  }

  private transformPoint(x: number, y: number): { x: number; y: number } {
    const { pivotX, pivotY, scale, parallaxX, parallaxY } =
      this.getTransformParams();
    const tx = (x - pivotX) * scale + pivotX - parallaxX;
    const ty = (y - pivotY) * scale + pivotY - parallaxY;
    return { x: tx, y: ty };
  }

  public isBlocking(): boolean {
    return this.visible;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public destroy(): void {
    this.go.destroy();
  }
}

export function createResultsOverlay(): ResultsOverlay {
  return new ResultsOverlay();
}
