import { Vector2, Color } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { UIDecoration, UIDecorationContext } from "./UIDecoration";
import { ConfigManager } from "../../../utils/configManager";

enum BongoPaw {
  None = 0,
  Left = 1,
  Right = 2,
  Both = 3,
}

registerCustomization(
  "BongoCatDecoration",
  {
    id: "item-bongo-cat",
    name: "Bongo Cat",
    rarity: "Rare",
    description: "",
    settingsCategory: "bongoCat",
    iconPath: "/item-bongo.png",
  } as const,
  [
    {
      key: "bongoCatEnabled",
      label: "Enabled",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "bongoCat",
    },
    {
      key: "bongoCatOpacity",
      label: "Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      itemCategory: "bongoCat",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);

export class BongoCatDecoration extends UIDecoration {
  private currentPaw: BongoPaw = BongoPaw.None;
  private lastHitTime: number = 0;
  private upAnimationTimeout: number = 300; 
  private lastHits: number = 0;
  private nextPaw: BongoPaw = BongoPaw.Left; 
  private bongoUpSprite: string = "/bongo-up.png";
  private bongoLeftSprite: string = "/bongo-left.png";
  private bongoRightSprite: string = "/bongo-right.png";
  private readonly FIXED_SIZE: number = 1.1;

  constructor() {
    super();
    this.syncWithConfig();
  }

  private syncWithConfig(): void {
    const config = ConfigManager.get();

    const enabled = (config.gameBongoCatEnabled ?? 1) >= 0.5;
    this.setEnabled(enabled);

    this.setOpacity(config.gameBongoCatOpacity ?? 1.0);

    this.setSize(this.FIXED_SIZE);
  }

  public update(deltaTime: number, context: UIDecorationContext): void {
    this.syncWithConfig();

    if (!this.enabled) return;

    if (context.hits > this.lastHits) {
      this.onHit(context.msTime);
    }
    this.lastHits = context.hits;

    const timeSinceHit = context.msTime - this.lastHitTime;
    if (timeSinceHit > this.upAnimationTimeout) {
      this.currentPaw = BongoPaw.None;
    }
  }

  private onHit(currentTime: number): void {
    this.lastHitTime = currentTime;

    this.currentPaw = this.nextPaw;

    this.nextPaw =
      this.nextPaw === BongoPaw.Left ? BongoPaw.Right : BongoPaw.Left;
  }

  public renderLeftOverlay(
    planeX: number,
    planeY: number,
    planeWidth: number,
    planeHeight: number,
    depth: number,
    context: UIDecorationContext
  ): void {}

  public renderRightOverlay(
    planeX: number,
    planeY: number,
    planeWidth: number,
    planeHeight: number,
    depth: number,
    context: UIDecorationContext
  ): void {
    if (!this.enabled || this.opacity <= 0) return;

    
    const catSize = Math.round(100 * this.size);
    const catX = 0; 
    const catY = -planeHeight / 2 - 22; 

    const finalOpacity = Math.round(255 * this.opacity);
    const catColor: Color = { r: 255, g: 255, b: 255, a: finalOpacity };

    let sprite = this.bongoUpSprite;
    if (this.currentPaw === BongoPaw.Left) {
      sprite = this.bongoLeftSprite;
    } else if (this.currentPaw === BongoPaw.Right) {
      sprite = this.bongoRightSprite;
    }

    drawSprite(
      sprite,
      Vector2(catX - catSize / 2, catY - catSize / 2),
      Vector2(catSize, catSize),
      catColor
    );
  }
}
