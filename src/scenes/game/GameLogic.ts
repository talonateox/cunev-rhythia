import { GetFrameTime } from "raylib";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import type { GameSettings } from "../../utils/gameSettingsSchema";
import { NoteHitDetector, NoteHitResult } from "./atoms/NoteHitDetector";
import { PerformanceTracker } from "./atoms/PerformanceTracker";
import {
  getMusicTime,
  isMusicPlaying,
  playMusic,
  playMusicFromStart,
  stopMusic,
  seek,
  pause as pauseMusic,
  play as resumeMusic,
  setMusicPitch,
  getMusicPitch,
  playFx,
} from "../../utils/soundManager";
import { logger } from "../../utils/logger";
import { Rhythia } from "../../atoms/Rhythia";
import { SceneTransition } from "../../atoms/SceneTransition";
import { setLastResults } from "../../utils/results";
import type { ReplayObserver } from "./ReplayObserver";
import { addLocalScore } from "../../utils/storage/localScores";
import { HealthModel } from "./health/HealthModel";
import { SoundSpaceHealthModel } from "./health/SoundSpaceHealthModel";
import { ModeManager } from "./modes";

export interface GameState {
  currentMsTime: number;
  virtualMsTime: number;
  adjustedMsTime: number;
  hasStartedMusic: boolean;
  gameStartTime: number;
  isStandaloneGame: boolean;
  debugMode: boolean;
  musicEnded: boolean;
  healthEnded: boolean;
  canSkip: boolean;
  nextNoteTime: number | null;
}

export interface GameStats {
  hits: number;
  misses: number;
  combo: number;
  accuracy: number;
  score: number;
  maxCombo: number;
}


export class GameLogic {
  private mapData: SoundSpaceMemoryMap | null = null;

  public noteHitDetector: NoteHitDetector;
  private performanceTracker: PerformanceTracker;

  
  private readonly musicStartOffset: number = 3000;

  
  private readonly skipGapMs: number = 5000;

  
  private readonly skipPrerollMs: number = 2000;

  
  private readonly lastNoteEndBufferMs: number = 0;

  
  private readonly defaultPitch: number = 1.0;

  private score: number = 0;
  private maxCombo: number = 0;

  private enableIntroDelay: boolean = false;
  private pendingSceneReturn: boolean = false;

  private healthModel: HealthModel;
  private failTriggeredAt: number | null = null;
  private readonly failReturnDelayMs: number = 1000; 

  private previewMode: boolean = false;
  private previewTimeOverride: number | null = null;

  private pauseStartTime: number | null = null;
  private pausedMusicTime: number | null = null;
  private wasMusicPlayingBeforePause: boolean = false;
  private pausedMusicPitch: number | null = null;
  private resumePitchTarget: number | null = null;
  private resumePitchElapsed: number = 0;
  private readonly resumePitchDuration: number = 3.0;
  private readonly resumePitchMin: number = 0.001;
  private failSlowActive: boolean = false;
  private failSlowElapsed: number = 0;
  private readonly failSlowDuration: number = 1.4;
  private failInitialPitch: number = 1.0;

  private state: GameState = {
    currentMsTime: 0,
    virtualMsTime: -3000,
    adjustedMsTime: 0,
    hasStartedMusic: false,
    gameStartTime: 0,
    isStandaloneGame: true,
    debugMode: false,
    musicEnded: false,
    healthEnded: false,
    canSkip: false,
    nextNoteTime: null,
  };

  constructor(
    mapData?: SoundSpaceMemoryMap,
    isStandalone: boolean = true,
    enableIntroDelay: boolean = false,
    healthModel?: HealthModel,
    private readonly startFromMs: number = 0,
    private readonly replayObserver?: ReplayObserver | null,
    private readonly replayPlayback: boolean = false
  ) {
    this.mapData = mapData ?? null;
    this.state.isStandaloneGame = isStandalone;
    this.enableIntroDelay = enableIntroDelay;
    this.noteHitDetector = new NoteHitDetector();
    this.performanceTracker = new PerformanceTracker();
    this.healthModel = healthModel ?? new SoundSpaceHealthModel();
  }

  private lastReplayPath: string | null = null;

  private finalizeReplayIfNeeded(): void {
    if (this.lastReplayPath) return;
    try {
      const p = this.replayObserver?.saveToDisk?.();
      if (p && typeof p === "string") this.lastReplayPath = p;
    } catch {}
  }

  private stopMusicSafely(): void {
    try {
      stopMusic();
    } catch {
      
    }
  }

  private resetPitchResumeState(): void {
    this.resumePitchTarget = null;
    this.resumePitchElapsed = 0;
    this.pausedMusicPitch = null;
  }

  private resetScoreAndCaches(): void {
    this.noteHitDetector.reset();
    this.performanceTracker.resetCurrentNoteIndex();
    this.score = 0;
    this.maxCombo = 0;
  }

  private resetEndFlags(): void {
    this.state.musicEnded = false;
    this.state.healthEnded = false;
    this.state.canSkip = false;
    this.state.nextNoteTime = null;
    this.failTriggeredAt = null;
    this.failSlowActive = false;
    this.failSlowElapsed = 0;
  }

  private initStandaloneTiming(): void {
    if (this.state.isStandaloneGame) {
      this.state.gameStartTime = Date.now();
    }
    this.state.hasStartedMusic = false;
    this.state.currentMsTime = -this.musicStartOffset;
    this.state.virtualMsTime = -this.musicStartOffset;
    this.state.adjustedMsTime = -this.musicStartOffset;
  }

  private initPreviewTiming(): void {
    this.state.hasStartedMusic = true;
    this.state.currentMsTime = 0;
    this.state.virtualMsTime = 0;
    this.state.adjustedMsTime = 0;
  }

  public init(): void {
    this.healthModel.reset();
    this.resetPauseState();
    this.pendingSceneReturn = false;
    this.resumePitchTarget = null;
    this.resumePitchElapsed = 0;

    logger(
      `GameLogic.init: standalone=${this.state.isStandaloneGame} introDelay=${
        this.enableIntroDelay
      } map=${this.mapData?.title || "<none>"}`
    );

    this.setPitchSafely(ModeManager.getMode().musicPitch ?? this.defaultPitch);

    if (this.state.isStandaloneGame || this.enableIntroDelay) {
      this.stopMusicSafely();
      const prefix = this.state.isStandaloneGame
        ? "Starting game"
        : "Starting visualization";
      logger(`${prefix}: ${this.mapData?.title || "No map loaded"}`);

      this.state.gameStartTime = Date.now();
      this.state.hasStartedMusic = false;
      this.state.virtualMsTime = -this.musicStartOffset;
      this.state.currentMsTime = this.state.virtualMsTime;
      this.state.adjustedMsTime = this.state.virtualMsTime;
      logger(
        `Init timing: vMs=${this.state.virtualMsTime} started=${this.state.hasStartedMusic}`
      );
    } else {
      this.state.hasStartedMusic = true;
      this.state.virtualMsTime = 0;
      this.state.currentMsTime = 0;
      this.state.adjustedMsTime = 0;
    }

    this.resetEndFlags();
    this.resetScoreAndCaches();
  }

  public update(settings?: Partial<GameSettings>): void {
    const deltaSeconds = GetFrameTime();
    this.updateResumePitch(deltaSeconds);
    this.updateFailSlowStop(deltaSeconds);

    if (this.pauseStartTime !== null) {
      return;
    }

    this.updateTiming();
    this.updateMusic();

    this.updateAdjustedTime(settings);

    this.checkMusicEnd();
    this.checkHealthEnd();
    this.checkFailReturnDelay();

    this.checkScheduledHitSounds();
    this.updateSkipState();
    this.tryReturnToPreviousScene();
  }

  private updateTiming(): void {
    if (this.previewMode && this.previewTimeOverride !== null) {
      const forcedTime = Math.max(
        -this.musicStartOffset,
        this.previewTimeOverride
      );
      this.state.currentMsTime = forcedTime;
      this.state.virtualMsTime = forcedTime;
      this.previewTimeOverride = null;
      this.state.hasStartedMusic = true;
      return;
    }

    const standaloneFlow = this.state.isStandaloneGame || this.enableIntroDelay;

    if (standaloneFlow) {
      const elapsed = Date.now() - this.state.gameStartTime;

      if (!this.state.hasStartedMusic) {
        const pitch = Math.max(0.001, ModeManager.getMode().musicPitch ?? 1.0);
        this.state.virtualMsTime = -this.musicStartOffset + elapsed * pitch;
      } else {
        const playing = isMusicPlaying();
        this.state.virtualMsTime = playing
          ? getMusicTime() * 1000
          : this.state.virtualMsTime;
      }

      this.state.currentMsTime = this.state.virtualMsTime;
    } else {
      const msTime = getMusicTime() * 1000;
      this.state.currentMsTime = msTime;
      this.state.virtualMsTime = msTime;
    }
  }

  private updateMusic(): void {
    if (this.previewMode) return;

    const standaloneFlow = this.state.isStandaloneGame || this.enableIntroDelay;

    if (
      standaloneFlow &&
      !this.state.hasStartedMusic &&
      this.state.virtualMsTime >= 0
    ) {
      const file = this.mapData?.audioFileName;

      if (file) {
        try {
          logger(
            `updateMusic: starting playback for ${file} at vMs=${this.state.virtualMsTime}`
          );
          playMusicFromStart(`./cache/audio/${file}`);
          this.state.hasStartedMusic = true;
          
        } catch (e) {
          logger(`Failed to start music: ${(e as Error).message}`);
        }
      } else {
        this.state.hasStartedMusic = false;
      }
    }
  }

  private checkMusicEnd(): void {
    if (this.previewMode) return;
    if (this.state.musicEnded) return;

    const standaloneFlow = this.state.isStandaloneGame || this.enableIntroDelay;

    if (standaloneFlow && this.mapData?.notes) {
      const notes = this.mapData.notes;
      if (notes.length === 0) {
        this.state.musicEnded = true;
        logger("Game ended: map has no notes.");
        if (
          this.state.isStandaloneGame &&
          this.mapData &&
          !this.replayPlayback
        ) {
          try {
            const stats = this.getStats();
            this.finalizeReplayIfNeeded();
            setLastResults(
              this.mapData,
              { ...(stats as any), failed: false } as any,
              { replayPath: this.lastReplayPath ?? undefined }
            );
            try {
              if (this.startFromMs <= 0) {
                const modeIds = ModeManager.getActiveModeIds();
                addLocalScore(this.mapData.id, {
                  score: stats.score,
                  hits: stats.hits,
                  misses: stats.misses,
                  combo: stats.combo,
                  maxCombo: stats.maxCombo,
                  accuracy: stats.accuracy,
                  createdAt: Date.now(),
                  modeIds,
                  replayPath: this.lastReplayPath ?? undefined,
                });
              }
            } catch {}
          } catch {}
        }
        this.scheduleSceneReturn();
        return;
      }

      const lastNoteTime = notes[notes.length - 1][0];
      const endAfter = lastNoteTime + this.lastNoteEndBufferMs;

      if (this.state.adjustedMsTime >= endAfter) {
        this.state.musicEnded = true;
        logger(
          `Game ended after last note (${lastNoteTime}ms) + buffer (${this.lastNoteEndBufferMs}ms).`
        );
        if (
          this.state.isStandaloneGame &&
          this.mapData &&
          !this.replayPlayback
        ) {
          try {
            const stats = this.getStats();
            this.finalizeReplayIfNeeded();
            setLastResults(
              this.mapData,
              { ...(stats as any), failed: false } as any,
              { replayPath: this.lastReplayPath ?? undefined }
            );
            try {
              if (this.startFromMs <= 0) {
                const modeIds = ModeManager.getActiveModeIds();
                addLocalScore(this.mapData.id, {
                  score: stats.score,
                  hits: stats.hits,
                  misses: stats.misses,
                  combo: stats.combo,
                  maxCombo: stats.maxCombo,
                  accuracy: stats.accuracy,
                  createdAt: Date.now(),
                  modeIds,
                  replayPath: this.lastReplayPath ?? undefined,
                });
              }
            } catch {}
          } catch {}
        }
        this.scheduleSceneReturn();
      }
    }
  }

  private checkHealthEnd(): void {
    if (this.previewMode) return;
    if (this.state.healthEnded || this.state.musicEnded) return;

    const standaloneFlow = this.state.isStandaloneGame || this.enableIntroDelay;
    if (standaloneFlow && this.state.hasStartedMusic) {
      if (this.healthModel.getCurrentHealth() <= 0) {
        this.state.healthEnded = true;
        this.failTriggeredAt = Date.now();
        try {
          playFx("/fail.ogg");
        } catch {}
        logger(
          `Game ended due to low health (${this.healthModel.getCurrentHealth()}). Triggering slow-stop.`
        );

        this.startFailSlowStop();

        if (
          this.state.isStandaloneGame &&
          this.mapData &&
          !this.replayPlayback
        ) {
          try {
            const stats = this.getStats();
            this.finalizeReplayIfNeeded();
            setLastResults(
              this.mapData,
              { ...(stats as any), failed: true } as any,
              { replayPath: this.lastReplayPath ?? undefined }
            );
            try {
              if (this.startFromMs <= 0) {
                const modeIds = ModeManager.getActiveModeIds();
                addLocalScore(this.mapData.id, {
                  score: stats.score,
                  hits: stats.hits,
                  misses: stats.misses,
                  combo: stats.combo,
                  maxCombo: stats.maxCombo,
                  accuracy: stats.accuracy,
                  createdAt: Date.now(),
                  modeIds,
                  replayPath: this.lastReplayPath ?? undefined,
                });
              }
            } catch {}
          } catch {}
        }
      }
    }
  }

  private checkFailReturnDelay(): void {
    if (!this.state.healthEnded) return;
    if (this.failTriggeredAt === null) return;
    if (this.pendingSceneReturn) return;

    const elapsed = Date.now() - this.failTriggeredAt;
    if (elapsed >= this.failReturnDelayMs) {
      this.scheduleSceneReturn();
    }
  }

  private startFailSlowStop(): void {
    try {
      const currentPitch = getMusicPitch();
      this.failInitialPitch = Math.max(
        0.001,
        currentPitch ?? this.defaultPitch
      );
    } catch {
      this.failInitialPitch = this.defaultPitch;
    }
    this.failSlowActive = true;
    this.failSlowElapsed = 0;
  }

  private updateFailSlowStop(deltaSeconds: number): void {
    if (!this.failSlowActive) return;
    this.failSlowElapsed += deltaSeconds;
    const t = Math.min(
      1,
      this.failSlowElapsed / Math.max(0.001, this.failSlowDuration)
    );
    const easeOut = 1 - Math.pow(1 - t, 3);
    const pitch = Math.max(
      this.resumePitchMin,
      this.failInitialPitch * (1 - easeOut)
    );
    this.setPitchSafely(pitch);

    if (t >= 1) {
      this.stopMusicSafely();
      this.failSlowActive = false;
    }
  }

  private updateAdjustedTime(settings?: Partial<GameSettings>): void {
    const globalOffset = settings?.globalOffset ?? 0;
    const mode = ModeManager.getMode();

    const baseTime = this.state.currentMsTime;
    const transformed =
      typeof mode.transformTime === "function"
        ? mode.transformTime(baseTime, this.state)
        : baseTime;

    this.state.adjustedMsTime = transformed + globalOffset;
  }

  private checkScheduledHitSounds(): void {
    this.noteHitDetector.checkAndPlayScheduledSounds(this.state.adjustedMsTime);
  }

  private scheduleSceneReturn(): void {
    this.pendingSceneReturn = true;
  }

  private tryReturnToPreviousScene(): void {
    if (!this.pendingSceneReturn) return;
    if (SceneTransition.isActive) return;

    this.pendingSceneReturn = false;
    this.restoreSelectedMusicPitch();
    if (this.replayPlayback) {
      this.stopMusicSafely();
    }
    try {
      playFx("/menuback.wav");
    } catch {}
    void Rhythia.goToPreviousScene();
  }

  private updateSkipState(): void {
    if (!this.mapData?.notes || !this.state.isStandaloneGame) {
      this.state.canSkip = false;
      this.state.nextNoteTime = null;
      return;
    }

    const notes = this.mapData.notes;
    const now = this.state.adjustedMsTime;

    let nextNoteTime: number | null = null;

    for (let i = 0; i < notes.length; i++) {
      const t = notes[i][0];
      if (t > now && !this.noteHitDetector.isNoteHit(i)) {
        nextNoteTime = t;
        break;
      }
    }

    if (nextNoteTime !== null) {
      this.state.nextNoteTime = nextNoteTime;
      this.state.canSkip = nextNoteTime - now > this.skipGapMs;
    } else {
      this.state.nextNoteTime = null;
      this.state.canSkip = false;
    }
  }

  public skipToNextNote(): void {
    if (
      !this.state.canSkip ||
      !this.state.nextNoteTime ||
      !this.state.isStandaloneGame
    ) {
      return;
    }

    const targetTime = Math.max(
      0,
      this.state.nextNoteTime - this.skipPrerollMs
    );
    logger(
      `Skipping to ${targetTime}ms (${this.skipPrerollMs}ms before next note at ${this.state.nextNoteTime}ms).`
    );

    if (this.state.hasStartedMusic) {
      try {
        seek(targetTime / 1000);
      } catch (e) {
        logger(`Failed to seek during skip: ${(e as Error).message}`);
      }
    } else {
      const file = this.mapData?.audioFileName;
      if (file) {
        try {
          playMusic(`./cache/audio/${file}`);
          this.state.hasStartedMusic = true;
          seek(targetTime / 1000);
          logger(`Started music and seeked to ${targetTime}ms`);
        } catch (e) {
          logger(`Failed to start/seek music on skip: ${(e as Error).message}`);
        }
      } else {
        const currentTime = Date.now();
        this.state.gameStartTime =
          currentTime - (targetTime + this.musicStartOffset);
      }
    }
  }

  public checkNoteHit(
    note: [number, number, number],
    noteIndex: number,
    cursorX: number,
    cursorY: number,
    squareScale: number,
    playfieldUserScale: number = 1.0
  ): NoteHitResult {
    if (this.state.healthEnded) {
      if (this.noteHitDetector.isNoteHit(noteIndex)) {
        return { hit: true, missed: false, opacity: 0.3, newlyHit: false };
      }

      let fade: number;
      if (this.failSlowActive) {
        const t = Math.min(
          1,
          Math.max(
            0,
            this.failSlowElapsed / Math.max(0.001, this.failSlowDuration)
          )
        );
        fade = Math.max(0, 1 - t);
      } else {
        fade = 0;
      }
      return {
        hit: false,
        missed: true,
        opacity: fade,
        newlyHit: false,
        newlyMissed: false,
      };
    }

    const result = this.noteHitDetector.checkNoteHit(
      note,
      noteIndex,
      this.state.adjustedMsTime,
      cursorX,
      cursorY,
      squareScale,
      ModeManager.getMode().hitboxScale ?? 1.0,
      playfieldUserScale
    );

    if (result.newlyHit) {
      const combo = this.noteHitDetector.getCombo();
      const multiplier = Math.min(combo, 1000);
      this.score += 100 * multiplier;
      if (combo > this.maxCombo) this.maxCombo = combo;
      this.healthModel.onNoteHit();
    }

    if (result.newlyMissed) {
      if (!this.replayPlayback) this.healthModel.onNoteMiss();
      try {
        this.replayObserver?.recordNoteMiss?.(
          noteIndex,
          this.healthModel.getCurrentHealth()
        );
      } catch {}
    }

    return result;
  }

  public findVisibleNotesRange(visibilityWindow: number): {
    startIndex: number;
    endIndex: number;
  } {
    if (!this.mapData?.notes) return { startIndex: 0, endIndex: 0 };

    return this.performanceTracker.findVisibleNotesRange(
      this.mapData.notes,
      this.state.adjustedMsTime,
      visibilityWindow
    );
  }

  public getGameState(): Readonly<GameState> {
    return { ...this.state };
  }

  public getStats(): GameStats {
    const hits = this.noteHitDetector.getHitCount();
    const misses = this.noteHitDetector.getMissedCount();
    const combo = this.noteHitDetector.getCombo();
    const total = hits + misses;
    const accuracy = total > 0 ? hits / total : 1.0;

    return {
      hits,
      misses,
      combo,
      accuracy,
      score: this.score,
      maxCombo: this.maxCombo,
    };
  }

  public getCurrentHealth(): number {
    return this.healthModel.getCurrentHealth();
  }

  public getHealthModel(): HealthModel {
    return this.healthModel;
  }

  public getMapData(): SoundSpaceMemoryMap | null {
    return this.mapData;
  }

  public toggleDebugMode(): void {
    this.state.debugMode = !this.state.debugMode;
    logger(`Debug mode: ${this.state.debugMode ? "ON" : "OFF"}`);
  }

  public getDebugInfo(): string {
    return this.noteHitDetector.getDebugInfo();
  }

  private updateResumePitch(deltaSeconds: number): void {
    if (this.resumePitchTarget === null) return;

    this.resumePitchElapsed += deltaSeconds;
    const duration = Math.max(0.001, this.resumePitchDuration);
    const progress = Math.min(1, this.resumePitchElapsed / duration);

    const easedProgress =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const startPitch = this.resumePitchMin;
    const targetPitch = this.resumePitchTarget;
    const interpolatedPitch =
      startPitch + (targetPitch - startPitch) * easedProgress;

    this.setPitchSafely(interpolatedPitch);

    if (progress >= 1) {
      this.setPitchSafely(targetPitch);
      this.resumePitchTarget = null;
      this.resumePitchElapsed = 0;
    }
  }

  public pauseGame(): void {
    if (this.pauseStartTime !== null) return;

    const currentPitch =
      this.resumePitchTarget ?? getMusicPitch() ?? this.defaultPitch;

    this.pauseStartTime = Date.now();
    this.resumePitchTarget = null;
    this.resumePitchElapsed = 0;
    this.pausedMusicPitch = currentPitch;

    if (this.state.hasStartedMusic) {
      this.pausedMusicTime = getMusicTime(); 
      this.wasMusicPlayingBeforePause = isMusicPlaying();
      if (this.wasMusicPlayingBeforePause) {
        try {
          pauseMusic();
        } catch (e) {
          logger(`Failed to pause music: ${(e as Error).message}`);
        }
      }
    } else {
      this.pausedMusicTime = null;
      this.wasMusicPlayingBeforePause = false;
    }
  }

  public resumeGame(options?: { resumeAudio?: boolean }): void {
    if (this.pauseStartTime === null) return;

    const pauseDuration = Date.now() - this.pauseStartTime;
    const shouldResumeAudio = options?.resumeAudio ?? true;
    logger(
      `resumeGame: resumeAudio=${shouldResumeAudio} pauseDuration=${pauseDuration} hadStarted=${this.state.hasStartedMusic} pausedTime=${this.pausedMusicTime}`
    );

    if (this.state.isStandaloneGame || this.enableIntroDelay) {
      this.state.gameStartTime += pauseDuration;
    }

    const hadMusicStarted = this.state.hasStartedMusic;

    if (shouldResumeAudio) {
      if (hadMusicStarted && this.pausedMusicTime !== null) {
        try {
          seek(this.pausedMusicTime);
          logger(`resumeGame: seek(${this.pausedMusicTime}) before resume`);
        } catch (e) {
          logger(`Failed to seek music on resume: ${(e as Error).message}`);
        }
      }
    } else if (hadMusicStarted) {
      try {
        stopMusic();
        logger("resumeGame: stopped music due to resumeAudio=false");
      } catch {}
    }

    if (
      shouldResumeAudio &&
      hadMusicStarted &&
      this.wasMusicPlayingBeforePause
    ) {
      const targetPitch = Math.max(
        this.resumePitchMin,
        this.pausedMusicPitch ?? getMusicPitch() ?? this.defaultPitch
      );

      if (targetPitch <= this.resumePitchMin + 1e-4) {
        this.resumePitchTarget = null;
        this.resumePitchElapsed = 0;
        this.setPitchSafely(targetPitch);
      } else {
        this.resumePitchTarget = targetPitch;
        this.resumePitchElapsed = 0;
        this.setPitchSafely(this.resumePitchMin);
      }

      try {
        resumeMusic();
        logger("resumeGame: resumed music with easing");
      } catch (e) {
        logger(`Failed to resume music: ${(e as Error).message}`);
      }
    } else if (this.pausedMusicPitch !== null) {
      this.resumePitchTarget = null;
      this.resumePitchElapsed = 0;
      this.setPitchSafely(this.pausedMusicPitch);
    } else {
      this.resumePitchTarget = null;
      this.resumePitchElapsed = 0;
    }

    if (!shouldResumeAudio) {
      this.resumePitchTarget = null;
      this.resumePitchElapsed = 0;
    }

    this.resetPauseState();
  }

  private resetPauseState(): void {
    this.pauseStartTime = null;
    this.pausedMusicTime = null;
    this.wasMusicPlayingBeforePause = false;
    this.pausedMusicPitch = null;
  }

  private setPitchSafely(pitch: number): void {
    try {
      setMusicPitch(pitch);
    } catch {}
  }

  public restoreSelectedMusicPitch(): void {
    this.resumePitchTarget = null;
    this.resumePitchElapsed = 0;
    this.failSlowActive = false;

    const targetPitch = ModeManager.getMode().musicPitch ?? this.defaultPitch;
    this.setPitchSafely(targetPitch);
  }

  public isPaused(): boolean {
    return this.pauseStartTime !== null;
  }

  public quickRestart(): void {
    this.resetPauseState();

    if (this.previewMode) {
      this.resetForPreviewLoop();
      return;
    }

    if (!this.mapData) return;

    this.pendingSceneReturn = false;
    this.resetPitchResumeState();

    this.setPitchSafely(ModeManager.getMode().musicPitch ?? this.defaultPitch);

    if (this.state.hasStartedMusic) {
      this.stopMusicSafely();
    }

    this.healthModel.reset();
    this.resetScoreAndCaches();
    this.resetEndFlags();
    this.lastReplayPath = null;
    this.initStandaloneTiming();
  }

  public setPreviewMode(enabled: boolean): void {
    this.previewMode = enabled;
    if (enabled) {
      this.previewTimeOverride = null;
      this.state.hasStartedMusic = true;
    }
  }

  public isPreviewMode(): boolean {
    return this.previewMode;
  }

  public setPreviewTime(msTime: number): void {
    if (!this.previewMode) return;
    this.previewTimeOverride = msTime;
  }

  public resetForPreviewLoop(): void {
    this.pendingSceneReturn = false;
    this.healthModel.reset();
    this.resetScoreAndCaches();
    this.resetEndFlags();
    this.lastReplayPath = null;
    this.initPreviewTiming();
  }

  public seekToMs(targetMs: number): void {
    const ms = Math.max(0, Math.floor(targetMs));
    if (this.previewMode) {
      this.setPreviewTime(ms);
      return;
    }

    const standaloneFlow = this.state.isStandaloneGame || this.enableIntroDelay;
    if (!standaloneFlow) {
      try {
        seek(ms / 1000);
      } catch {}
      return;
    }

    if (this.state.hasStartedMusic) {
      try {
        seek(ms / 1000);
      } catch {}
      return;
    }

    const file = this.mapData?.audioFileName;
    if (file) {
      try {
        playMusic(`./cache/audio/${file}`);
        this.state.hasStartedMusic = true;
        seek(ms / 1000);
      } catch {}
    } else {
      const currentTime = Date.now();
      this.state.gameStartTime = currentTime - ms;
      this.state.virtualMsTime = ms;
      this.state.currentMsTime = ms;
      this.state.adjustedMsTime = ms;
    }
  }
}
