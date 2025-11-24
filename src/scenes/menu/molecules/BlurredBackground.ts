import { Vector2 } from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import { rgba } from "../../../utils/colors";
import { lerpDelta } from "../../../utils/lerp";
import {
  getBlurredImageWithColor,
  AccentColor,
} from "../../../utils/imageBlur";
import { logger } from "../../../utils/logger";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";

export class BlurredBackground {
  private gameObject: GameObject;
  private currentMapImage: string | null = null;
  private currentMapId: string | null = null;
  private fadeProgress: number = 0;
  private blurredImagePath: string | null = null;
  private accentColor: AccentColor | null = null;
  public onAccentColorChange: ((color: AccentColor | null) => void) | null =
    null;
  private backgroundDrawnExternally: boolean = false;

  constructor() {
    this.gameObject = new GameObject({ zBase: 0 }); 
    this.initialize();
  }

  private initialize(): void {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.gameObject.onDraw = () => this.draw();
  }

  public async setBackground(
    mapImage: string | null,
    mapId: string | null
  ): Promise<void> {
    if (mapId !== this.currentMapId) {
      this.blurredImagePath = null;
    }

    this.currentMapImage = mapImage;
    this.currentMapId = mapId;

    if (mapImage && mapId) {
      try {
        const result = await getBlurredImageWithColor(mapImage, 25);

        if (this.currentMapId === mapId) {
          this.blurredImagePath = result.path;
          this.accentColor = result.accentColor;
          logger("BlurredBackground: Set accent color", result.accentColor);
          this.onAccentColorChange?.(result.accentColor);
        }
      } catch (error) {
        console.error(
          "BlurredBackground: Failed to create blurred image:",
          error
        );
      }
    } else {
      this.blurredImagePath = null;
      this.accentColor = null;
      this.onAccentColorChange?.(null);
    }
  }

  private draw(): void {
    if (this.backgroundDrawnExternally) {
      
      
      this.updateFade();
      return;
    }
    this.updateFade();
    this.drawBlurredBackground();
  }

  private drawBlurredBackground(): void {
    if (!this.blurredImagePath || !this.currentMapId) {
      this.drawSolidBackground();
      return;
    }

    const cacheKey = `blurred-map-${this.currentMapId}`;
    const opacity = 0.3 * this.fadeProgress; 

    drawSprite(
      this.blurredImagePath,
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      rgba(255, 255, 255, opacity),
      cacheKey,
      true, 
      true 
    );

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
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      {
        r: overlayR,
        g: overlayG,
        b: overlayB,
        a: 0.5 * this.fadeProgress * 255,
      }
    );

    let bgTintR = 255,
      bgTintG = 255,
      bgTintB = 255;
    if (this.accentColor) {
      const tintStrength = 0.5;
      bgTintR = Math.round(
        255 * (1 - tintStrength) + this.accentColor.r * tintStrength
      );
      bgTintG = Math.round(
        255 * (1 - tintStrength) + this.accentColor.g * tintStrength
      );
      bgTintB = Math.round(
        255 * (1 - tintStrength) + this.accentColor.b * tintStrength
      );
    } else {
    }

    drawSprite(
      "/bg.png",
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      { r: bgTintR, g: bgTintG, b: bgTintB, a: 0.8 * this.fadeProgress * 255 }
    );
  }

  private drawSolidBackground(): void {
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
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      {
        r: overlayR,
        g: overlayG,
        b: overlayB,
        a: 0.5 * 255,
      }
    );

    let bgTintR = 255,
      bgTintG = 255,
      bgTintB = 255;
    if (this.accentColor) {
      const tintStrength = 0.5;
      bgTintR = Math.round(
        255 * (1 - tintStrength) + this.accentColor.r * tintStrength
      );
      bgTintG = Math.round(
        255 * (1 - tintStrength) + this.accentColor.g * tintStrength
      );
      bgTintB = Math.round(
        255 * (1 - tintStrength) + this.accentColor.b * tintStrength
      );
    }

    drawSprite(
      "/bg.png",
      Vector2(0, 0),
      Vector2(Rhythia.gameWidth, Rhythia.gameHeight),
      { r: bgTintR, g: bgTintG, b: bgTintB, a: 0.8 * 255 }
    );
  }

  
  public setBackgroundDrawnExternally(flag: boolean): void {
    this.backgroundDrawnExternally = flag;
  }

  private updateFade(): void {
    if (this.blurredImagePath && this.currentMapId) {
      this.fadeProgress = lerpDelta(this.fadeProgress, 1, 0.1);
    } else {
      this.fadeProgress = lerpDelta(this.fadeProgress, 0, 0.1);
    }
  }

  public drawScreenCover(): void {
    
    this.updateFade();

    
    let screenW = 0;
    let screenH = 0;
    try {
      const info = getPresentationInfo();
      screenW = Math.round(info.displayWidth);
      screenH = Math.round(info.displayHeight);
    } catch {
      
      screenW = Rhythia.gameWidth;
      screenH = Rhythia.gameHeight;
    }

    const hasBlur = !!(this.blurredImagePath && this.currentMapId);

    
    if (hasBlur) {
      const cacheKey = `blurred-map-${this.currentMapId}`;
      const opacity = 0.3 * this.fadeProgress;
      drawSprite(
        this.blurredImagePath,
        Vector2(0, 0),
        Vector2(screenW, screenH),
        rgba(255, 255, 255, opacity),
        cacheKey,
        true,
        true
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
      Vector2(0, 0),
      Vector2(screenW, screenH),
      {
        r: overlayR,
        g: overlayG,
        b: overlayB,
        a: (hasBlur ? 0.5 * this.fadeProgress : 0.5) * 255,
      }
    );

    
    let bgTintR = 255,
      bgTintG = 255,
      bgTintB = 255;
    if (this.accentColor) {
      const tintStrength = 0.5;
      bgTintR = Math.round(255 * (1 - tintStrength) + this.accentColor.r * tintStrength);
      bgTintG = Math.round(255 * (1 - tintStrength) + this.accentColor.g * tintStrength);
      bgTintB = Math.round(255 * (1 - tintStrength) + this.accentColor.b * tintStrength);
    }
    drawSprite(
      "/bg.png",
      Vector2(0, 0),
      Vector2(screenW, screenH),
      { r: bgTintR, g: bgTintG, b: bgTintB, a: (hasBlur ? 0.8 * this.fadeProgress : 0.8) * 255 }
    );
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public clear(): void {
    this.currentMapImage = null;
    this.currentMapId = null;
    this.blurredImagePath = null;
    this.accentColor = null;
    this.onAccentColorChange?.(null);
  }

  public destroy(): void {}
}

export function createBlurredBackground(): BlurredBackground {
  return new BlurredBackground();
}
