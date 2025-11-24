import { Vector2, GetFrameTime, GetMousePosition } from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";
import { screenToGame } from "../../../atoms/sysutils/rendering";

const MOD_ICONS = [
  { path: "/mod_default.png", label: "Default", desc: "No changes" },
  { path: "/mod_nofail.png", label: "No Fail", desc: "Can't fail" },
  { path: "/mod_87.png", label: "x0.87", desc: "Play slower" },
  { path: "/mod_15.png", label: "x1.15", desc: "Play faster" },
  { path: "/mod_25.png", label: "x1.25", desc: "Faster" },
  { path: "/mod_35.png", label: "x1.35", desc: "Very fast" },
  { path: "/mod_45.png", label: "x1.45", desc: "Max speed" },
  { path: "/mod_mirror.png", label: "Mirror", desc: "Flip lanes" },
  { path: "/mod_hardrock.png", label: "Hardrock", desc: "Smaller notes" },
];

export class ModOverviewStep extends BaseTutorialStep {
  private hoverTime: number = 0;
  private hoveredIndex: number = 0;

  constructor() {
    super({
      id: "modOverview",
      text: "Move your mouse over a mod to see what it does. Mix what you like!",
      mascotEmote: "satisfied",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.hoverTime = 0;
    this.hoveredIndex = 0;
    this.markCompleted();
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {
    this.hoverTime += GetFrameTime() * 1.2;

    const iconSize = 72;
    const spacing = 32;
    const totalWidth =
      MOD_ICONS.length * iconSize + (MOD_ICONS.length - 1) * spacing;
    const startX = Rhythia.gameWidth / 2 - totalWidth / 2;
    const centerY = Rhythia.gameHeight / 2 + 20;

    const screenMouse = GetMousePosition();
    const mapped = screenToGame(screenMouse.x, screenMouse.y);
    const mouseX = mapped ? mapped.x : -Infinity;
    const mouseY = mapped ? mapped.y : -Infinity;

    let found = false;

    MOD_ICONS.forEach((_, index) => {
      const x = startX + index * (iconSize + spacing);
      const rectX = x - 8;
      const rectY = centerY - iconSize / 2 - 8;
      const rectW = iconSize + 16;
      const rectH = iconSize + 16;

      const inside =
        mouseX >= rectX &&
        mouseX <= rectX + rectW &&
        mouseY >= rectY &&
        mouseY <= rectY + rectH;

      if (inside) {
        this.hoveredIndex = index;
        found = true;
      }
    });

    if (!found && this.hoveredIndex >= MOD_ICONS.length) {
      this.hoveredIndex = 0;
    }
  }

  protected onStepRender(): void {
    const iconSize = 72;
    const spacing = 32;
    const totalWidth =
      MOD_ICONS.length * iconSize + (MOD_ICONS.length - 1) * spacing;
    const startX = Rhythia.gameWidth / 2 - totalWidth / 2;
    const centerY = Rhythia.gameHeight / 2 + 20;

    MOD_ICONS.forEach((icon, index) => {
      const x = startX + index * (iconSize + spacing);
      const isHighlighted = index === this.hoveredIndex;
      const backdropColor = isHighlighted
        ? { r: 78, g: 78, b: 78, a: 235 }
        : { r: 48, g: 48, b: 48, a: 210 };

      drawSprite(
        "/solid.png",
        Vector2(x - 8, centerY - iconSize / 2 - 8),
        Vector2(iconSize + 16, iconSize + 16),
        backdropColor
      );

      drawSprite(
        icon.path,
        Vector2(x, centerY - iconSize / 2),
        Vector2(iconSize, iconSize),
        { r: 225, g: 225, b: 225, a: 255 }
      );

      drawText(
        icon.label,
        Vector2(x + iconSize / 2, centerY + iconSize / 2 + 8),
        18,
        { r: 220, g: 220, b: 220, a: 255 },
        "center"
      );
    });

    const highlighted = MOD_ICONS[this.hoveredIndex];
    const tooltipWidth = 420;
    const tooltipHeight = 120;
    const tooltipX = Rhythia.gameWidth / 2 - tooltipWidth / 2;
    const tooltipY = centerY + iconSize / 2 + 40;

    drawSprite(
      "/solid.png",
      Vector2(tooltipX, tooltipY),
      Vector2(tooltipWidth, tooltipHeight),
      { r: 34, g: 34, b: 34, a: 235 }
    );

    drawSprite(
      highlighted.path,
      Vector2(tooltipX + 20, tooltipY + 20),
      Vector2(80, 80),
      { r: 225, g: 225, b: 225, a: 255 }
    );

    drawText(
      highlighted.label,
      Vector2(tooltipX + 120, tooltipY + 18),
      26,
      { r: 230, g: 230, b: 230, a: 255 },
      "left"
    );

    drawText(
      highlighted.desc,
      Vector2(tooltipX + 120, tooltipY + 54),
      20,
      { r: 210, g: 210, b: 210, a: 255 },
      "left"
    );

    drawText(
      "(Mods can be combined when compatible)",
      Vector2(tooltipX + 120, tooltipY + 84),
      16,
      { r: 190, g: 190, b: 190, a: 255 },
      "left"
    );
  }

  protected checkCanContinue(): boolean {
    return true;
  }

  protected onKeyPress(_key: number): boolean {
    return false;
  }

  protected onMouseMove(_x: number, _y: number): void {}
}
