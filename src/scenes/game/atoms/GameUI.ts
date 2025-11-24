import { GetFrameTime } from "raylib";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import type { GameSettings } from "../../../utils/gameSettingsSchema";
import {
  UIDecoration,
  UIDecorationContext,
} from "../panel-decorations/UIDecoration";
import { LeftGameUIPanel } from "../panels/LeftGameUIPanel";
import { RightGameUIPanel } from "../panels/RightGameUIPanel";
import { TopGameUIPanel } from "../panels/TopGameUIPanel";
import { HealthGameUIPanel } from "../panels/HealthGameUIPanel";
import { clamp } from "../../../utils/lerp";

export class GameUI {
  private combo: number = 0;
  private hits: number = 0;
  private misses: number = 0;
  private lastHits: number = 0;
  private comboScaleAnimation: number = 1.0;
  private animationTime: number = 0;
  private score: number = 0;
  private decorations: UIDecoration[] = [];
  private readonly leftPanel: LeftGameUIPanel;
  private readonly rightPanel: RightGameUIPanel;
  private readonly topPanel: TopGameUIPanel;
  private readonly healthPanel: HealthGameUIPanel;
  private displayedHealth: number = 100;
  private maxHealth: number = 100;
  private readonly healthLerpSpeed: number = 6;

  constructor() {
    this.leftPanel = new LeftGameUIPanel();
    this.rightPanel = new RightGameUIPanel((score) => this.formatScore(score));
    this.topPanel = new TopGameUIPanel();
    this.healthPanel = new HealthGameUIPanel();
  }

  private formatScore(score: number): string {
    if (score < 1000) return score.toString();
    if (score < 1000000) return (score / 1000).toFixed(1) + "k";
    if (score < 1000000000) return (score / 1000000).toFixed(1) + "mil";
    if (score < 1000000000000) return (score / 1000000000).toFixed(1) + "bil";
    if (score < 1000000000000000)
      return (score / 1000000000000).toFixed(1) + "tril";
    return (score / 1000000000000000).toFixed(1) + "quad";
  }

  public updateStats(hits: number, misses: number, combo?: number): void {
    if (hits > this.lastHits) {
      this.comboScaleAnimation = 1.06; 
      this.animationTime = 0;

      if (combo !== undefined) {
        const multiplier = Math.min(combo, 1000); 
        this.score += 100 * multiplier;
      }
    }

    this.lastHits = this.hits;
    this.hits = hits;
    this.misses = misses;
    if (combo !== undefined) {
      this.combo = combo;
    }

    if (this.comboScaleAnimation > 1.0) {
      this.animationTime += GetFrameTime();
      const animationDuration = 0.2; 
      const progress = Math.min(this.animationTime / animationDuration, 1.0);

      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.comboScaleAnimation = 1.06 - easedProgress * 0.06; 

      if (progress >= 1.0) {
        this.comboScaleAnimation = 1.0;
      }
    }
  }

  public render(
    mapData: SoundSpaceMemoryMap | null,
    currentTime: number,
    totalNotes: number,
    closeDistance: number,
    cameraTiltX: number = 0,
    cameraTiltY: number = 0,
    settings?: Partial<GameSettings>,
    health?: number,
    maxHealth?: number
  ): void {
    if (maxHealth !== undefined) {
      this.maxHealth = maxHealth;
    }
    const targetHealth = clamp(
      health ?? this.displayedHealth,
      0,
      this.maxHealth
    );
    const deltaTime = GetFrameTime();
    const difference = targetHealth - this.displayedHealth;
    const change = difference * Math.min(1, deltaTime * this.healthLerpSpeed);
    this.displayedHealth += change;

    const context: UIDecorationContext = {
      msTime: currentTime,
      cameraTiltX,
      cameraTiltY,
      settings: settings || {},
      combo: this.combo,
      hits: this.hits,
      misses: this.misses,
      score: this.score,
      health: this.displayedHealth,
    };

    this.decorations.forEach((decoration) => {
      decoration.update(deltaTime, context);
    });

    this.leftPanel.render({
      closeDistance,
      cameraTiltX,
      cameraTiltY,
      settings,
      decorations: this.decorations,
      decorationContext: context,
      combo: this.combo,
      hits: this.hits,
      misses: this.misses,
      comboScaleAnimation: this.comboScaleAnimation,
    });

    this.rightPanel.render({
      closeDistance,
      cameraTiltX,
      cameraTiltY,
      settings,
      decorations: this.decorations,
      decorationContext: context,
      totalNotes,
      hits: this.hits,
      misses: this.misses,
      score: this.score,
    });

    this.topPanel.render({
      closeDistance,
      cameraTiltX,
      cameraTiltY,
      settings,
      decorations: this.decorations,
      decorationContext: context,
      mapData,
      currentTime,
    });

    this.healthPanel.render({
      closeDistance,
      cameraTiltX,
      cameraTiltY,
      settings,
      decorations: this.decorations,
      decorationContext: context,
      health: this.displayedHealth,
      maxHealth: this.maxHealth,
    });
  }

  public addDecoration(decoration: UIDecoration): void {
    this.decorations.push(decoration);
  }

  public removeDecoration(decoration: UIDecoration): void {
    const index = this.decorations.indexOf(decoration);
    if (index > -1) {
      this.decorations.splice(index, 1);
    }
  }

  public clearDecorations(): void {
    this.decorations = [];
  }
}
