import {
  Color,
  DrawTexture,
  GenImageColor,
  LoadTextureFromImage,
  RAYWHITE,
  Texture,
  UnloadImage,
  UnloadTexture,
  UpdateTexture,
  WHITE,
} from "raylib";
import { BackgroundDecoration } from "./BackgroundDecoration";
import { BackgroundRenderContext } from "./types";
import { registerCustomization } from "../../../utils/settingsRegistry";
import { Video } from "simplevideo";
import { Rhythia } from "../../../atoms/Rhythia";
import { ConfigManager, GameConfig } from "../../../utils/configManager";

export class VideoBackgroundDecoration implements BackgroundDecoration {
  private accentColor: Color = { r: 255, g: 255, b: 255, a: 255 };
  private video!: Video;
  private texture!: Texture;
  private eventInitiated = false;
  private onConfigUpdateHandler?: (updates: Partial<GameConfig>) => void;

  init(): void {
    if (!this.eventInitiated) {
      this.onConfigUpdateHandler = (updates: Partial<GameConfig>) => {
        if (Object.keys(updates).includes("videoPath")) {
          this.disposeResources();
          this.createVideo();
        }
      };
      ConfigManager.events.on("onUpdate", this.onConfigUpdateHandler);
      this.eventInitiated = true;
    }

    this.createVideo();
  }

  createVideo() {
    const vPath = ConfigManager.get().videoPath;
    if (!vPath || vPath.trim().length === 0) {
      return;
    }
    console.log("Create video", vPath);
    this.video = new Video(vPath, Rhythia.gameWidth, Rhythia.gameHeight);
    this.video.speed = 1;
    this.video.loop = true;
    this.video.play();

    const image = GenImageColor(
      Rhythia.gameWidth,
      Rhythia.gameHeight,
      RAYWHITE
    );
    this.texture = LoadTextureFromImage(image);
    UnloadImage(image);
  }

  setAccentColor(color: Color): void {
    this.accentColor = color;
  }

  private disposeResources(): void {
    try {
      if (this.video) {
        this.video.dispose();
      }
    } catch {}

    try {
      if (this.texture) {
        UnloadTexture(this.texture);
      }
    } catch {}
  }

  destroy(): void {
    
    if (this.onConfigUpdateHandler) {
      ConfigManager.events.off("onUpdate", this.onConfigUpdateHandler);
      this.onConfigUpdateHandler = undefined;
      this.eventInitiated = false;
    }

    
    this.disposeResources();
  }

  render(context: BackgroundRenderContext): void {
    if (!this.video) return;
    const enabled = (context.settings.videoEnabled ?? 0) >= 0.5;
    const opacity = context.settings.videoOpacity ?? 0.0;

    if (!enabled || opacity <= 0) {
      return;
    }

    this.video.update((pixels: number) => {
      UpdateTexture(this.texture, pixels);
    });

    DrawTexture(this.texture, 0, 0, { ...WHITE, a: opacity * 255 });
  }
}

registerCustomization(
  "VideoBackgroundDecoration",
  {
    id: "item-video-background",
    name: "Video Background",
    rarity: "Common",
    description: "",
    settingsCategory: "video-background",
    iconPath: "/item-video.png",
  } as const,
  [
    {
      key: "videoEnabled",
      label: "Enabled",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "video-background",
    },
    {
      key: "videoOpacity",
      label: "Video Opacity",
      defaultValue: 0.3,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Background",
      itemCategory: "video-background",
    },
  ] as const,
  { priority: 12 }
);
