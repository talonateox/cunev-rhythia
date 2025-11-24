import { Vector2, Color } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { UIDecoration, UIDecorationContext } from "./UIDecoration";
import { ConfigManager } from "../../../utils/configManager";

registerCustomization(
  "WinXpTopBarDecoration",
  {
    id: "item-xp-topbar",
    name: "Win XP",
    rarity: "Rare",
    description: "",
    settingsCategory: "xpTopBar",
    iconPath: "/item-xp.png",
  } as const,
  [
    {
      key: "winXpEnabled",
      label: "Enabled",
      defaultValue: 0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "xpTopBar",
    },
    {
      key: "xpTopBarOpacity",
      label: "Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      itemCategory: "xpTopBar",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);

export class WinXpTopBarDecoration extends UIDecoration {
  private readonly spritePath: string = "/xp_banner.png";

  constructor() {
    super();
  }

  public update(deltaTime: number, context: UIDecorationContext): void {}

  public renderRightOverlay(
    _planeX: number,
    _planeY: number,
    planeWidth: number,
    planeHeight: number,
    _depth: number,
    _context: UIDecorationContext
  ): void {
    const config = ConfigManager.get();
    if (!config.gameWinXpEnabled) return;

    const bannerW = planeWidth + 10;
    const bannerH = Math.min(60, Math.max(28, Math.round(planeHeight * 0.18)));

    const x = -bannerW / 2;
    const y = -planeHeight / 2 - bannerH;

    const color: Color = {
      r: 255,
      g: 255,
      b: 255,
      a: Math.round(255 * config.gameXpTopBarOpacity),
    };

    drawSprite(
      this.spritePath,
      Vector2(x + 5, y + 30),
      Vector2(bannerW - 10, bannerH - 30),
      color
    );
  }
}
