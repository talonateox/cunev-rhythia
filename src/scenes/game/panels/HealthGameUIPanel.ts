import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlScalef,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import { clamp } from "../../../utils/lerp";
import { GameUIPanel, GameUIPanelCommonArgs } from "./GameUIPanel";

export interface HealthPanelArgs extends GameUIPanelCommonArgs {
  health: number;
  maxHealth: number;
}

export class HealthGameUIPanel extends GameUIPanel<HealthPanelArgs> {
  public render(args: HealthPanelArgs): void {
    rlPushMatrix();

    const playfieldScale = args.settings?.playfieldScale ?? 1.0;
    const baseBorderSize = 320 * playfieldScale;
    const barWidth = args.settings?.healthBarWidth ?? 120;
    const barHeight = args.settings?.healthBarHeight ?? 14;
    const uiTiltRate = args.settings?.uiTiltRate ?? 1.0;
    const uiScale = args.settings?.uiScale ?? 1.0;

    const planeX = Rhythia.gameWidth / 2;
    const baseMargin =
      Math.min(Rhythia.gameWidth, Rhythia.gameHeight) * 0.16 * playfieldScale;
    const marginScalePush = 1 + (uiScale - 1) * 0.25;
    const normalizedMargin = Math.round(baseMargin * marginScalePush);
    const planeY =
      Rhythia.gameHeight / 2 + baseBorderSize / 2 + normalizedMargin;

    const depth = args.closeDistance;
    rlTranslatef(planeX, planeY, depth);

    const tiltCompensation = 1 - uiTiltRate;
    rlTranslatef(
      args.cameraTiltX * 100 * tiltCompensation,
      args.cameraTiltY * 100 * tiltCompensation,
      0
    );
    rlScalef(uiScale, uiScale, 1.0);

    const barX = -barWidth / 2;
    const barY = 0;

    const backgroundOpacitySetting =
      args.settings?.healthBarOpacity !== undefined
        ? clamp(args.settings.healthBarOpacity, 0, 1)
        : 1;
    const backgroundOpacity = Math.round(200 * backgroundOpacitySetting);
    drawSprite(
      "/solid.png",
      Vector2(barX, barY),
      Vector2(barWidth, barHeight),
      { r: 8, g: 8, b: 8, a: backgroundOpacity }
    );

    const clampedHealth = clamp(args.health, 0, args.maxHealth);
    const fillWidth = (barWidth * clampedHealth) / args.maxHealth;
    if (fillWidth > 0) {
      const fillColor = this.getFillColor(
        clampedHealth,
        args.maxHealth,
        backgroundOpacitySetting
      );
      drawSprite(
        "/solid.png",
        Vector2(barX, barY),
        Vector2(fillWidth, barHeight),
        fillColor
      );
    }

    rlPopMatrix();
  }

  private getFillColor(
    health: number,
    maxHealth: number,
    opacityMultiplier: number
  ) {
    const normalized = clamp(health / maxHealth, 0, 1);

    const baseRed = 85;
    const baseGreen = 175;
    const baseBlue = 75;

    const red = Math.round(140 + (baseRed - 140) * normalized);
    const green = Math.round(80 + (baseGreen - 80) * normalized);
    const blue = Math.round(40 + (baseBlue - 40) * normalized);

    return {
      r: red,
      g: green,
      b: blue,
      a: Math.round(220 * opacityMultiplier),
    };
  }
}
