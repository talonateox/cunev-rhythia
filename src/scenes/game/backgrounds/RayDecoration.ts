import {
  Color,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
  Vector3,
  Vector2,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { BackgroundDecoration } from "./BackgroundDecoration";
import { BackgroundRenderContext } from "./types";

interface RaySegment {
  startTime: number;
  duration: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  progress: number;
}

export class RayDecoration implements BackgroundDecoration {
  private accentColor: Color = { r: 255, g: 255, b: 255, a: 255 };
  private rays: RaySegment[] = [];
  private lastRayTime = 0;
  private nextRayTime = 200;

  setAccentColor(color: Color): void {
    this.accentColor = color;
  }

  render(context: BackgroundRenderContext): void {
    const { msTime, farDistance } = context;
    const rayOpacity = context.settings.rayOpacity ?? 1.0;
    const rayIntensity = context.settings.rayIntensity ?? 1.0;
    const enabled = (context.settings.raysEnabled ?? 1) >= 0.5;

    if (!enabled) {
      this.rays = [];
      return;
    }

    if (rayOpacity <= 0 || rayIntensity <= 0) {
      return;
    }

    if (msTime >= this.nextRayTime) {
      this.spawnRays(msTime, rayIntensity, farDistance);
    }

    this.updateAndRenderRays(
      msTime,
      farDistance,
      rayOpacity,
      context.settings.rayWidth ?? 8
    );
  }

  private spawnRays(
    msTime: number,
    rayIntensity: number,
    farDistance: number
  ): void {
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;
    const baseRayCount = 2 + Math.floor(Math.random() * 3);
    const numRays = Math.max(1, Math.round(baseRayCount * rayIntensity));

    for (let i = 0; i < numRays; i++) {
      const angle = Math.random() * 360;
      const radius =
        Rhythia.gameWidth * 0.6 + Math.random() * Rhythia.gameWidth * 0.8;
      const rayX = centerX + Math.cos((angle * Math.PI) / 180) * radius;
      const rayY = centerY + Math.sin((angle * Math.PI) / 180) * radius;

      if (this.rays.length >= 64) {
        break;
      }

      this.rays.push({
        startTime: msTime + i * 20,
        duration: 3000 + Math.random() * 2000,
        x: rayX,
        y: rayY,
        angle: Math.random() * 360,
        length: farDistance * 1.5,
        progress: 0,
      });
    }

    const baseInterval = 200;
    const nextInterval = baseInterval / Math.max(rayIntensity, 0.1);
    this.lastRayTime = msTime;
    this.nextRayTime = msTime + nextInterval;
  }

  private updateAndRenderRays(
    msTime: number,
    farDistance: number,
    rayOpacity: number,
    rayWidth: number
  ): void {
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;

    this.rays = this.rays.filter((ray) => {
      const elapsed = msTime - ray.startTime;
      if (elapsed < 0) {
        ray.progress = 0;
        return true;
      }

      const progress = elapsed / ray.duration;
      if (progress >= 1.0) {
        return false;
      }

      ray.progress = progress;
      return true;
    });

    for (const ray of this.rays) {
      if (ray.progress <= 0) {
        continue;
      }

      let opacity: number;
      if (ray.progress < 0.2) {
        const growProgress = ray.progress / 0.2;
        opacity = Math.sin(growProgress * Math.PI * 0.5) * 0.05;
      } else if (ray.progress < 0.6) {
        opacity = 0.05;
      } else {
        const fadeProgress = (ray.progress - 0.6) / 0.4;
        opacity = 0.05 * Math.cos(fadeProgress * Math.PI * 0.5);
      }

      rlPushMatrix();
      rlTranslatef(ray.x, ray.y, farDistance);
      rlRotatef(ray.angle, 0, 0, 1);
      rlRotatef(-90, 1, 0, 0);

      const dx = centerX - ray.x;
      const dy = centerY - ray.y;
      const yawAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      rlRotatef(yawAngle, 0, 1, 0);

      const variation = ((ray.x + ray.y) % 4) - 2;
      const finalWidth = Math.max(1, rayWidth + variation);

      drawSprite(
        "/solid.png",
        Vector3(-finalWidth / 2, 0, 0),
        Vector2(finalWidth, ray.length),
        {
          r: this.accentColor.r,
          g: this.accentColor.g,
          b: this.accentColor.b,
          a: Math.round(255 * Math.min(1.0, opacity * rayOpacity)),
        }
      );

      rlPopMatrix();
    }
  }
}

registerCustomization(
  "RayDecoration",
  {
    id: "item-rays",
    name: "Rays",
    rarity: "Common",
    description: "",
    settingsCategory: "rays",
    iconPath: "/item-rays.png",
  } as const,
  [
    {
      key: "raysEnabled",
      label: "Enabled",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "rays",
    },
    {
      key: "rayOpacity",
      label: "Ray Opacity",
      defaultValue: 5.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      category: "Background",
      itemCategory: "rays",
    },
    {
      key: "rayIntensity",
      label: "Ray Intensity",
      defaultValue: 1.4,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      category: "Background",
      itemCategory: "rays",
    },
    {
      key: "rayWidth",
      label: "Ray Width",
      defaultValue: 21,
      min: 2,
      max: 30,
      step: 1,
      category: "Background",
      itemCategory: "rays",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);
