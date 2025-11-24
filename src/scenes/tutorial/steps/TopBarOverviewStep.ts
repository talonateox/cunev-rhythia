import { Vector2, GetFrameTime } from "raylib";
import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";

export class TopBarOverviewStep extends BaseTutorialStep {
  private pulse: number = 0;

  constructor() {
    super({
      id: "topBarOverview",
      text: "Remember the top bar icons: they handle layout, customization, leaderboards, lobbies, and filters. Here’s a quick legend!",
      mascotEmote: "happy",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.pulse = 0;
    this.markCompleted();
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {
    this.pulse += GetFrameTime() * 2;
  }

  protected onStepRender(): void {
    const entries = [
      {
        title: "Layout Toggle",
        description: "Switch between compact and grid views.",
        renderer: (x: number, y: number) => this.drawToggleIcon(x, y),
      },
      {
        title: "Customize",
        description: "Open the customization drawer to tweak visuals.",
        renderer: (x: number, y: number) =>
          drawSprite("/customize.png", Vector2(x, y), Vector2(42, 42), {
            r: 220,
            g: 225,
            b: 245,
            a: 255,
          }),
      },
      {
        title: "Leaderboards",
        description: "Jump straight to global and friend rankings.",
        renderer: (x: number, y: number) =>
          drawSprite("/leads.png", Vector2(x, y), Vector2(42, 42), {
            r: 220,
            g: 225,
            b: 245,
            a: 255,
          }),
      },
      {
        title: "Lobbies",
        description: "Host or join multiplayer sessions.",
        renderer: (x: number, y: number) => this.drawPlusIcon(x, y),
      },
      {
        title: "Filters",
        description: "Refine map lists by difficulty or status.",
        renderer: (x: number, y: number) =>
          drawSprite("/stat.png", Vector2(x, y), Vector2(42, 42), {
            r: 220,
            g: 225,
            b: 245,
            a: 255,
          }),
      },
    ];

    const entryHeight = 88;
    const totalHeight = entries.length * entryHeight + 20;
    let startY = Rhythia.gameHeight / 2 - totalHeight / 2;
    const startX = Rhythia.gameWidth / 2 - 240;

    entries.forEach((entry, index) => {
      const highlight = Math.max(0, Math.sin(this.pulse + index * 0.9));
      const cardColor = {
        r: Math.round(36 + highlight * 10),
        g: Math.round(36 + highlight * 10),
        b: Math.round(44 + highlight * 12),
        a: 230,
      };

      drawSprite(
        "/solid.png",
        Vector2(startX, startY),
        Vector2(480, entryHeight - 12),
        cardColor
      );

      const iconX = startX + 16;
      const iconY = startY + (entryHeight - 12 - 42) / 2;
      entry.renderer(iconX, iconY);

      drawText(
        entry.title,
        Vector2(iconX + 56, iconY),
        22,
        { r: 230, g: 230, b: 230, a: 255 },
        "left"
      );
      drawText(
        entry.description,
        Vector2(iconX + 56, iconY + 26),
        18,
        { r: 205, g: 205, b: 205, a: 255 },
        "left"
      );

      startY += entryHeight;
    });
  }

  protected checkCanContinue(): boolean {
    return true;
  }

  protected onKeyPress(_key: number): boolean {
    return false;
  }

  protected onMouseMove(_x: number, _y: number): void {}

  private drawToggleIcon(x: number, y: number): void {
    const width = 56;
    const height = 28;
    const progress = (Math.sin(this.pulse) + 1) * 0.5;

    drawSprite(
      "/solid.png",
      Vector2(x, y + 7),
      Vector2(width, height),
      { r: 70, g: 70, b: 70, a: 230 }
    );

    const knobSize = 22;
    const knobPadding = 3;
    const knobX = x + knobPadding + (width - knobSize - knobPadding * 2) * progress;
    drawSprite(
      "/solid.png",
      Vector2(knobX, y + 7 + knobPadding),
      Vector2(knobSize, knobSize),
      { r: 225, g: 225, b: 225, a: 255 }
    );
  }

  private drawPlusIcon(x: number, y: number): void {
    const size = 42;
    const barWidth = 6;
    drawSprite(
      "/solid.png",
      Vector2(x + size / 2 - barWidth / 2, y + 6),
      Vector2(barWidth, size - 12),
      { r: 220, g: 220, b: 220, a: 255 }
    );
    drawSprite(
      "/solid.png",
      Vector2(x + 6, y + size / 2 - barWidth / 2),
      Vector2(size - 12, barWidth),
      { r: 220, g: 220, b: 220, a: 255 }
    );
  }
}
