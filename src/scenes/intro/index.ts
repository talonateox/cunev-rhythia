import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlScalef,
  ClearBackground,
  BLACK,
  IsKeyPressed,
  KEY_SPACE,
  DrawCircleV,
  GetFrameTime,
} from "raylib";
import { Scene } from "../../atoms/Scene";
import { drawText } from "../../utils/text";
import { drawSprite } from "../../utils/sprite";
import { Rhythia } from "../../atoms/Rhythia";
import { MenuScene } from "../menu";
import { playFx, playMusic } from "../../utils/soundManager";
import { createTween, easings, cancelTween } from "../../utils/tween";
import * as fs from "fs";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import { BeatmapData } from "../../utils/types";
import { BackgroundRenderer } from "../game/atoms/BackgroundRenderer";
import type { GameSettings } from "../../utils/gameSettingsSchema";
import { logger } from "../../utils/logger";
import { ConfigManager } from "../../utils/configManager";
import { Maps } from "../../utils/maps";
import { TutorialScene } from "../tutorial";
import {
  GetMouseWheelMove,
  IsKeyDown,
  KEY_LEFT_ALT,
  KEY_RIGHT_ALT,
  SetMasterVolume,
  GetMasterVolume,
} from "raylib";
import { GameObject } from "../../atoms/Object";

const SNOWFLAKES = true;
const INTRO_MODE: "auto" | "christmas" | "halloween" = "auto";

type Snowflake = {
  x: number;
  y: number;
  size: number;
  speedY: number;
  driftX: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  alpha: number;
};

export class IntroScene extends Scene {
  sceneName: string = "Intro";

  constructor() {
    super();
  }

  private coinScaleX: number = 1;
  private coinScaleY: number = 1;
  private loadingFadeOpacity: number = 0;
  private logoOpacity: number = 0;
  private loadingTextOpacity: number = 0;
  private titleOpacity: number = 0;
  private subtitleOpacity: number = 0;
  private tunnelOpacity: number = 0;
  private skipRequested: boolean = false;
  private managedTimeouts: NodeJS.Timeout[] = [];
  private musicStarted: boolean = false;

  private currentPhase:
    | "logo"
    | "flip"
    | "settle"
    | "scale"
    | "title"
    | "done" = "logo";

  private backgroundRenderer!: BackgroundRenderer;
  private titleStartTime: number = 0;

  private tutorialScene: TutorialScene | null = null;
  private showTutorial: boolean = false;

  private snowflakes: Snowflake[] = [];
  private seasonMode: "default" | "christmas" | "halloween" = "default";

  private readonly staticFacts: string[] = [
    "Rhythia is based on a Roblox game called Sound Space, released back in 2018!",
    "First quantum map was created on 9th of September 2019!",
    "Sound Space, the game Rhythia was inspired by, was originally named Blox Saber!",
    "The camera mode 'Spin' originates from Sound Space, it was the only way to play the game up until 2021!",
    "Blox Saber The Game (BSTG) was the first ever standalone client for any Sound Space clone, dating all the way back to 2019!",
    "After a dispute between the Sound Space Plus and Sound Space team, SSP renamed to Rhythia, which was originally a cheat specifically for Sound Space! What a way to bite back...",
    "Rhythia Online was first introduced in 2024 as a small mod on top of Rhythia client!",
    "Sound Space Art covers exactly 386 pixels on 2022 r/place.",
    "For April Fools 2025 Rhythia was rebranded to Roundia, Wigglytufia, and bigweinerdogia all in one day! How strange...",
    "Somewhere out there Sound Space Minus exists...",
    "If it wasn't for a Roblox lawsuit, Rhythia would never exist!",
    "The mitochondria is the powerhouse of the cell.",
    "Hitting the notes makes it impossible to miss.",
    "The names Sonata, Flux, Syncora, Syncarta, and Rhythia were considered when rebranding!",
    "Your chances of being smashed by a vending are higher than being struck by lightning.",
    "Our Azer has no ties with the Azer from osu! Even if BTMC thought otherwise...",
    "We won't make you mash your keyboard... unless you really want to.",
    "Someone wrote about their highschool years when we asked for Rhythia fun facts... cool... I guess?",
    "Getting frustrated? Take a break!",
  ];

  private currentFact: string = "";

  private static preloadedMaps: BeatmapData[] = [];

  async init(): Promise<void> {
    logger("IntroScene initialized");

    this.showTutorial = !ConfigManager.hasPassedInit();
    logger("Tutorial needed:", this.showTutorial.toString());

    this.backgroundRenderer = new BackgroundRenderer();

    const allFacts = this.generateAllFacts();
    const randomIndex = Math.floor(Math.random() * allFacts.length);
    this.currentFact = allFacts[randomIndex];

    this.preloadDownloadedMaps();

    this.startLogoSequence();

    if (SNOWFLAKES) {
      if (INTRO_MODE === "halloween") this.seasonMode = "halloween";
      else if (INTRO_MODE === "christmas") this.seasonMode = "christmas";
      else {
        const hasHalloween =
          fs.existsSync("./public/halloween-theme.mp3") &&
          fs.existsSync("./public/halloween.png");
        const hasChristmas = fs.existsSync("./public/christmas.mp3");
        this.seasonMode = hasHalloween
          ? "halloween"
          : hasChristmas
            ? "christmas"
            : "default";
      }
      if (this.seasonMode === "halloween") {
        this.backgroundRenderer.setAccentColor({
          r: 255,
          g: 153,
          b: 0,
          a: 255,
        });
      }
      this.initSnowflakes();

      this.scheduleTimeout(() => {
        this.ensureMenuMusic();
      }, 500);
    }
  }

  private startLogoSequence(): void {
    this.currentPhase = "flip";
    this.logoOpacity = 0;

    createTween(
      "logoFadeIn",
      0,
      1,
      0.8,
      (v) => (this.logoOpacity = v),
      easings.easeOutQuad,
    ).onEnd(() => {
      if (this.skipRequested) return;

      this.scheduleTimeout(() => {
        if (this.skipRequested) return;
        createTween(
          "logoFadeOut",
          1,
          0,
          0.8,
          (v) => (this.logoOpacity = v),
          easings.easeInQuad,
        ).onEnd(() => {
          if (this.skipRequested) return;

          this.scheduleTimeout(() => {
            if (this.skipRequested) return;
            this.startAnimationSequence();
          }, 500);
        });
      }, 1000);
    });
  }

  private generateAllFacts(): string[] {
    const dynamicFacts: string[] = [];

    try {
      if (fs.existsSync("./cache/parsed")) {
        const files = fs.readdirSync("./cache/parsed");
        const mapCount = files.length;

        let mapMessage = "";
        if (mapCount === 0) {
          mapMessage = "You have no maps in your cache. Time to download some!";
        } else if (mapCount === 1) {
          mapMessage =
            "You have exactly 1 map in your songs cache. Just getting started!";
        } else if (mapCount < 10) {
          mapMessage = `You have ${mapCount} maps in your songs cache. Not so many, but it's a start!`;
        } else if (mapCount < 50) {
          mapMessage = `You have ${mapCount} maps in your songs cache. Making good progress!`;
        } else if (mapCount < 100) {
          mapMessage = `You have ${mapCount} maps in your songs cache. That's quite a collection!`;
        } else if (mapCount < 500) {
          mapMessage = `You have ${mapCount} maps in your songs cache. Impressive!`;
        } else if (mapCount < 1000) {
          mapMessage = `You have ${mapCount} maps in your songs cache. Damn!`;
        } else {
          mapMessage = `You have ${mapCount} maps in your songs cache. Might wanna clean up some old ones!`;
        }
        dynamicFacts.push(mapMessage);

        if (mapCount > 0) {
          let totalSize = 0;
          for (const file of files) {
            try {
              const stats = fs.statSync(`./cache/parsed/${file}`);
              totalSize += stats.size;
            } catch {}
          }

          const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
          if (totalSize > 0) {
            if (parseFloat(sizeMB) < 10) {
              dynamicFacts.push(
                `Your map cache is using ${sizeMB} MB. Lightweight!`,
              );
            } else if (parseFloat(sizeMB) < 100) {
              dynamicFacts.push(
                `Your map cache is using ${sizeMB} MB of disk space.`,
              );
            } else if (parseFloat(sizeMB) < 500) {
              dynamicFacts.push(
                `Your map cache is using ${sizeMB} MB. That's a lot of maps!`,
              );
            } else {
              dynamicFacts.push(
                `Your map cache is using ${sizeMB} MB. Consider cleaning up old maps!`,
              );
            }
          }
        }

        if (fs.existsSync("./cache/audio")) {
          const audioFiles = fs.readdirSync("./cache/audio");
          if (audioFiles.length > 0) {
            dynamicFacts.push(
              `You have ${audioFiles.length} audio files cached for instant playback!`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error generating dynamic facts:", error);
    }

    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) {
      dynamicFacts.push("Take a break, go to sleep..");
    } else if (hour >= 6 && hour < 12) {
      dynamicFacts.push("Morning!");
    } else if (hour >= 12 && hour < 18) {
      dynamicFacts.push("Afternoon session? Get some work!");
    } else if (hour >= 18) {
      dynamicFacts.push("Good evening!");
    }

    return [...this.staticFacts, ...dynamicFacts];
  }

  private startAnimationSequence(): void {
    if (this.skipRequested) return;
    this.currentPhase = "flip";

    this.loadingFadeOpacity = 0;
    this.loadingTextOpacity = 0;

    createTween(
      "coinFlip",
      0,
      6 * Math.PI,
      2,
      (value) => {
        this.coinScaleX = Math.cos(value);
        this.coinScaleY = 1;
      },
      easings.easeOutQuad,
    ).onEnd(() => {
      if (this.skipRequested) return;

      this.coinScaleX = 1;
      this.coinScaleY = 1;
      this.currentPhase = "settle";

      playFx("/wurly.wav");

      createTween(
        "loadingFade",
        0,
        1,
        0.4,
        (value) => {
          this.loadingTextOpacity = value;
        },
        easings.easeOutQuad,
      ).onEnd(() => {
        if (this.skipRequested) return;
        if (SNOWFLAKES) {
          this.ensureMenuMusic();
        } else {
          playMusic("./public/menu_loop.mp3");
        }
      });

      this.scheduleTimeout(() => {
        if (this.skipRequested) return;
        this.currentPhase = "scale";

        createTween(
          "coinScale",
          1,
          1.05,
          0.5,
          (value) => {
            this.coinScaleX = value;
            this.coinScaleY = value;
          },
          easings.easeInQuad,
        );

        createTween(
          "fadeOut",
          1,
          0,
          0.5,
          (value) => {
            this.loadingFadeOpacity = value;
            this.loadingTextOpacity = value;
          },
          easings.easeInQuad,
        ).onEnd(() => {
          if (this.skipRequested) return;
          this.currentPhase = "title";
          this.titleStartTime = Date.now();

          createTween(
            "titleFadeIn",
            0,
            1,
            1.0,
            (value) => {
              this.titleOpacity = value;
              this.subtitleOpacity = value * 0.78;
              this.tunnelOpacity = value * 0.3;
            },
            easings.easeOutQuad,
          ).onEnd(() => {
            if (this.skipRequested) return;

            this.scheduleTimeout(() => {
              if (this.skipRequested) return;

              createTween(
                "titleFadeOut",
                1,
                0,
                1.0,
                (value) => {
                  this.titleOpacity = value;
                  this.subtitleOpacity = value * 0.78;
                  this.tunnelOpacity = value * 0.3;
                },
                easings.easeInQuad,
              ).onEnd(() => {
                if (this.skipRequested) return;
                this.currentPhase = "done";

                if (this.showTutorial) {
                  this.scheduleTimeout(() => {
                    if (this.skipRequested) return;
                    this.startTutorial();
                  }, 200);
                } else {
                  this.scheduleTimeout(() => {
                    if (this.skipRequested) return;
                    logger("Intro completed, switching to MenuScene");
                    Rhythia.goToScene(new MenuScene());
                  }, 200);
                }
              });
            }, 5000);
          });
        });
      }, 2500);
    });

    createTween(
      "coinFadeIn",
      0,
      1,
      0.4,
      (value) => {
        this.loadingFadeOpacity = value;
      },
      easings.easeOutQuad,
    );
  }

  private startTutorial(): void {
    logger("Starting tutorial");
    this.tutorialScene = new TutorialScene();
    Rhythia.goToScene(this.tutorialScene, true, true);
  }

  private async preloadDownloadedMaps(): Promise<void> {
    try {
      const listed = Maps.listDownloadedBeatmaps();
      IntroScene.preloadedMaps = [...listed];
      (global as any).preloadedDownloadedMaps = IntroScene.preloadedMaps;
    } catch (error) {
      console.error("Failed to preload downloaded maps:", error);
    }
  }

  render(): void {
    ClearBackground(BLACK);

    this.handleSkipInput();

    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;

    if (this.currentPhase === "logo") {
      this.drawLogo(centerX, centerY);
    }

    if (
      this.currentPhase === "flip" ||
      this.currentPhase === "settle" ||
      this.currentPhase === "scale"
    ) {
      this.drawCoinAndLoadingText(centerX, centerY);
    }

    if (this.currentPhase === "title") {
      if (this.tunnelOpacity > 0) {
        this.drawTunnelBackground();
      }

      this.drawTitle(centerX, centerY);
    }

    if (SNOWFLAKES) {
      this.updateSnowflakes();
      this.drawSnowflakes();
    }

    GameObject.updateAll();
    GameObject.drawAll();
  }

  private handleSkipInput(): void {
    if (this.showTutorial || this.skipRequested) return;
    if (!IsKeyPressed(KEY_SPACE)) return;

    this.skipRequested = true;
    logger("Intro skipped by user");

    this.cancelAllTweens();
    this.clearManagedTimeouts();

    this.showTutorial = false;
    Rhythia.goToScene(new MenuScene());
  }

  private scheduleTimeout(callback: () => void, delay: number): void {
    const handle = setTimeout(() => {
      this.managedTimeouts = this.managedTimeouts.filter((h) => h !== handle);
      if (this.skipRequested) return;
      callback();
    }, delay);
    this.managedTimeouts.push(handle);
  }

  private clearManagedTimeouts(): void {
    this.managedTimeouts.forEach((handle) => clearTimeout(handle));
    this.managedTimeouts = [];
  }

  private cancelAllTweens(): void {
    cancelTween("logoFadeIn");
    cancelTween("logoFadeOut");
    cancelTween("loadingFade");
    cancelTween("coinFadeIn");
    cancelTween("coinFlip");
    cancelTween("coinScale");
    cancelTween("fadeOut");
    cancelTween("titleFadeIn");
    cancelTween("titleFadeOut");
  }

  private drawLogo(centerX: number, centerY: number): void {
    const maxWidth = 489 / 2;
    const height = 140 / 2;
    const x = centerX - maxWidth / 2;
    const y = centerY - height / 2;

    drawSprite("/logo.png", Vector2(x, y), Vector2(maxWidth, height), {
      r: 255,
      g: 255,
      b: 255,
      a: Math.round(this.logoOpacity * 255),
    });
  }

  private drawTunnelBackground(): void {
    const msTime =
      this.titleStartTime > 0 ? Date.now() - this.titleStartTime : 0;

    const settings: Partial<GameSettings> = {
      backgroundOpacity: 1.0,
      rayOpacity: 0,
      rayIntensity: 0,
      backgroundTiltRate: 0,
      bloomIntensity: 2.0,
      chevronOpacity: 0,
      gridOpacity: 0,
    };

    this.backgroundRenderer.renderBackground(
      msTime,
      2000,
      settings,
      this.tunnelOpacity,
      0,
      0,
    );
  }

  private drawCoinAndLoadingText(centerX: number, centerY: number): void {
    const iconSize = 96;
    const iconX = centerX;
    const iconY = centerY - 50;

    rlPushMatrix();
    rlTranslatef(iconX, iconY, 0);
    rlScalef(this.coinScaleX, this.coinScaleY, 1);
    rlTranslatef(-iconSize / 2, -iconSize / 2, 0);

    const iconPath =
      this.seasonMode === "halloween"
        ? "/halloween-load-indicator.png"
        : "/load-indicator.png";
    drawSprite(iconPath, Vector2(0, 0), Vector2(iconSize, iconSize), {
      r: 255,
      g: 255,
      b: 255,
      a: Math.round(this.loadingFadeOpacity * 255),
    });

    rlPopMatrix();

    drawText(
      "Did you know?",
      Vector2(centerX, centerY + 40),
      24,
      {
        r: 180,
        g: 180,
        b: 180,
        a: Math.round(this.loadingTextOpacity * 200),
      },
      "center",
    );

    const maxWidth = 600;
    const words = this.currentFact.split(" ");
    let lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length * 10 > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    lines.forEach((line, index) => {
      drawText(
        line,
        Vector2(centerX, centerY + 75 + index * 35),
        28,
        {
          r: 220,
          g: 220,
          b: 220,
          a: Math.round(this.loadingTextOpacity * 255),
        },
        "center",
      );
    });
  }

  private drawTitle(centerX: number, centerY: number): void {
    const titleColor =
      this.seasonMode === "halloween"
        ? { r: 255, g: 153, b: 0, a: Math.round(this.titleOpacity * 255) }
        : { r: 255, g: 255, b: 255, a: Math.round(this.titleOpacity * 255) };
    const subtitleColor =
      this.seasonMode === "halloween"
        ? { r: 255, g: 153, b: 0, a: Math.round(this.subtitleOpacity * 255) }
        : { r: 200, g: 200, b: 200, a: Math.round(this.subtitleOpacity * 255) };

    drawText(
      "Rhythia",
      Vector2(centerX, centerY - 60),
      120,
      titleColor,
      "center",
    );
    drawText(
      "Powered by raylib",
      Vector2(centerX, centerY + 60),
      32,
      subtitleColor,
      "center",
    );
  }

  private ensureMenuMusic(): void {
    if (this.musicStarted) return;
    const halloweenPath = "./public/halloween-theme.mp3";
    const christmasPath = "./public/christmas.mp3";
    const fallbackPath = "./public/menu_loop.mp3";
    let toPlay = fallbackPath;
    if (this.seasonMode === "halloween" && fs.existsSync(halloweenPath))
      toPlay = halloweenPath;
    else if (this.seasonMode === "christmas" && fs.existsSync(christmasPath))
      toPlay = christmasPath;
    else if (fs.existsSync(christmasPath)) toPlay = christmasPath;
    try {
      playMusic(toPlay);
      this.musicStarted = true;
    } catch (e) {
      if (toPlay !== fallbackPath) {
        try {
          playMusic(fallbackPath);
          this.musicStarted = true;
        } catch {}
      }
    }
  }

  private makeSnowflake(): Snowflake {
    const width = Rhythia.gameWidth;
    const height = Rhythia.gameHeight;
    const size = 1.5 + Math.random() * 2.5;
    const speedY = 30 + Math.random() * 90 + size * 8;
    const driftX = (Math.random() - 0.5) * 40;
    const wobbleAmp = 6 + Math.random() * 18;
    const wobbleFreq = 0.4 + Math.random() * 1.2;
    const wobblePhase = Math.random() * Math.PI * 2;
    const alpha = 140 + Math.floor(Math.random() * 110);
    return {
      x: Math.random() * width,
      y: Math.random() * -height,
      size,
      speedY,
      driftX,
      wobbleAmp,
      wobbleFreq,
      wobblePhase,
      alpha,
    };
  }

  private initSnowflakes(): void {
    const width = Rhythia.gameWidth;
    const height = Rhythia.gameHeight;
    const area = Math.max(1, width * height);
    const targetCount = Math.min(160, Math.max(60, Math.floor(area / 35000)));
    this.snowflakes = [];
    for (let i = 0; i < targetCount; i++)
      this.snowflakes.push(this.makeSnowflake());
  }

  private updateSnowflakes(): void {
    const dt = Math.max(0, GetFrameTime());
    const width = Rhythia.gameWidth;
    const height = Rhythia.gameHeight;
    for (let i = 0; i < this.snowflakes.length; i++) {
      const f = this.snowflakes[i];
      const wobble = Math.sin(f.wobblePhase) * f.wobbleAmp;
      f.x += (f.driftX + wobble) * dt;
      f.y += f.speedY * dt;
      f.wobblePhase += f.wobbleFreq * dt;
      const margin = 20;
      if (f.x < -margin) f.x = width + margin;
      if (f.x > width + margin) f.x = -margin;
      if (f.y - f.size > height + margin) {
        const nf = this.makeSnowflake();
        nf.x = Math.random() * width;
        nf.y = -nf.size - Math.random() * 50;
        this.snowflakes[i] = nf;
      }
    }
  }

  private drawSnowflakes(): void {
    if (this.seasonMode === "halloween") {
      for (const f of this.snowflakes) {
        const s = f.size * 12;
        const pos = Vector2(f.x - s / 2, f.y - s / 2);
        const rot = f.wobblePhase * 57.2958;
        drawSprite(
          "/halloween.png",
          pos,
          Vector2(s, s),
          { r: 255, g: 255, b: 255, a: f.alpha },
          undefined,
          false,
          true,
          rot,
          Vector2(s / 2, s / 2),
        );
      }
      return;
    }
    for (const f of this.snowflakes) {
      DrawCircleV(Vector2(f.x, f.y), f.size, {
        r: 255,
        g: 255,
        b: 255,
        a: f.alpha,
      });
    }
  }

  resume(): void {
    logger("IntroScene resumed - user returned from game");
  }

  destroy(): void {
    this.cancelAllTweens();
    this.clearManagedTimeouts();
    try {
      if (this.backgroundRenderer) {
        this.backgroundRenderer.destroy();
      }
    } catch {}
    this.snowflakes = [];
  }
}
