import { Color, Vector2, Vector3 } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import { BackgroundDecoration } from "./BackgroundDecoration";
import { BackgroundRenderContext } from "./types";
import * as fs from "fs";
import * as path from "path";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";
import { ConfigManager } from "../../../utils/configManager";

export class CoverImageDecoration implements BackgroundDecoration {
  setAccentColor(_color: Color): void {}

  render(context: BackgroundRenderContext): void {
    const coverOpacity = context.settings.coverOpacity ?? 0.0;

    if (coverOpacity <= 0) {
      return;
    }

    const cfg = ConfigManager.get();
    const configuredPath = (cfg.coverImagePath || "").trim();
    const customPng = path.join(process.cwd(), "cache", "custom_background.png");
    const customJpg = path.join(process.cwd(), "cache", "custom_background.jpg");
    const alpha = Math.round(255 * coverOpacity);
    const color: Color = { r: 255, g: 255, b: 255, a: alpha };

    let displayW = Rhythia.gameWidth;
    let displayH = Rhythia.gameHeight;
    let viewportX = 0;
    let viewportY = 0;
    let viewportW = Rhythia.gameWidth;
    let viewportH = Rhythia.gameHeight;
    const info = getPresentationInfo();
    displayW = Math.max(1, Math.round(info.displayWidth));
    displayH = Math.max(1, Math.round(info.displayHeight));
    viewportX = Math.round(info.viewport.x);
    viewportY = Math.round(info.viewport.y);
    viewportW = Math.max(1, Math.round(info.viewport.width));
    viewportH = Math.max(1, Math.round(info.viewport.height));

    const scaleX = viewportW / Math.max(1, Rhythia.gameWidth);
    const scaleY = viewportH / Math.max(1, Rhythia.gameHeight);
    const worldLeftX = -viewportX / Math.max(0.0001, scaleX);
    const worldTopY = -viewportY / Math.max(0.0001, scaleY);
    const worldWidth = displayW / Math.max(0.0001, scaleX);
    const worldHeight = displayH / Math.max(0.0001, scaleY);

    if (configuredPath && fs.existsSync(configuredPath)) {
      drawSprite(
        configuredPath,
        Vector2(worldLeftX, worldTopY),
        Vector2(worldWidth, worldHeight),
        color,
        configuredPath,
        true,
        true
      );
      return;
    }

    if (fs.existsSync(customJpg)) {
      drawSprite(
        customJpg,
        Vector2(worldLeftX, worldTopY),
        Vector2(worldWidth, worldHeight),
        color,
        "custom-background-image",
        true,
        true
      );
      return;
    }

    if (fs.existsSync(customPng)) {
      drawSprite(
        customPng,
        Vector2(worldLeftX, worldTopY),
        Vector2(worldWidth, worldHeight),
        color,
        "custom-background-image",
        true,
        true
      );
      return;
    }

    drawSprite(
      "/bg.jpg",
      Vector2(worldLeftX, worldTopY),
      Vector2(worldWidth, worldHeight),
      color
    );
  }
}
