import { BaseTutorialStep } from "../components/BaseTutorialStep";
import {
  GetMouseX,
  GetMouseY,
  GetScreenWidth,
  GetScreenHeight,
  IsMouseButtonPressed,
  MOUSE_BUTTON_LEFT,
  Color,
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
  rlScalef,
} from "raylib";
import { drawText } from "../../../utils/text";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import { lerpDelta } from "../../../utils/lerp";

interface PCSpecCard {
  id: string;
  label: string;
  description: string;
  color: Color;
  x: number;
  y: number;
  baseY: number; 
  currentY: number; 
  baseScale: number; 
  currentScale: number; 
  baseRotation: number; 
  currentRotation: number; 
  width: number;
  height: number;
  hovered: boolean;
  selected: boolean;
}

export class PCSpecsStep extends BaseTutorialStep {
  private cards: PCSpecCard[] = [];
  private selectedCard: string | null = null;
  private cardWidth = 280; 
  private cardHeight = 360; 
  private cardSpacing = 40;
  private hoverOffset = -20; 
  private selectedScale = 1.1; 
  private selectedRotation = -3; 

  constructor() {
    super({
      id: "pcSpecs",
      text: "What kind of PC do you have? This will help me optimize your experience!",
      mascotEmote: "happy",
      waitForUser: true,
    });

    this.initializeCards();
  }

  private initializeCards(): void {
    const specs = [
      {
        id: "decent",
        label: "Potato PC",
        description: "Most games you run crash!",
        color: { r: 100, g: 150, b: 200, a: 255 },
      },
      {
        id: "good",
        label: "Good PC",
        description: "Average performance\non most games!",
        color: { r: 100, g: 200, b: 100, a: 255 },
      },
      {
        id: "powerful",
        label: "Quantum PC",
        description: "You can run anything!",
        color: { r: 200, g: 150, b: 50, a: 255 },
      },
    ];

    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;
    const totalWidth =
      specs.length * this.cardWidth + (specs.length - 1) * this.cardSpacing;
    const startX = (screenWidth - totalWidth) / 2;
    const centerY = screenHeight / 2 - 120; 

    specs.forEach((spec, index) => {
      const x = startX + index * (this.cardWidth + this.cardSpacing);
      const y = centerY - this.cardHeight / 2;

      this.cards.push({
        ...spec,
        x,
        y,
        baseY: y,
        currentY: y,
        baseScale: 1.0,
        currentScale: 1.0,
        baseRotation: 0,
        currentRotation: 0,
        width: this.cardWidth,
        height: this.cardHeight,
        hovered: false,
        selected: false,
      });
    });
  }

  protected async onStepEnter(): Promise<void> {
    this.selectedCard = null;
    this.cards.forEach((card) => {
      card.selected = false;
      card.hovered = false;
      card.currentY = card.baseY;
      card.currentScale = card.baseScale;
      card.currentRotation = card.baseRotation;
    });
  }

  protected onStepExit(): void {
    if (this.selectedCard) {
      console.log(`User selected PC spec: ${this.selectedCard}`);
    }
  }

  protected onStepUpdate(): void {
    const rawMouseX = GetMouseX();
    const rawMouseY = GetMouseY();

    const screenWidth = GetScreenWidth();
    const screenHeight = GetScreenHeight();

    const gameAspect = Rhythia.gameWidth / Rhythia.gameHeight;
    const screenAspect = screenWidth / screenHeight;

    let destWidth: number;
    let destHeight: number;
    let destX: number;
    let destY: number;

    if (screenAspect > gameAspect) {
      destHeight = screenHeight;
      destWidth = screenHeight * gameAspect;
      destX = (screenWidth - destWidth) / 2;
      destY = 0;
    } else {
      destWidth = screenWidth;
      destHeight = screenWidth / gameAspect;
      destX = 0;
      destY = (screenHeight - destHeight) / 2;
    }

    const mouseX = ((rawMouseX - destX) / destWidth) * Rhythia.gameWidth;
    const mouseY = ((rawMouseY - destY) / destHeight) * Rhythia.gameHeight;

    this.cards.forEach((card) => {
      const wasHovered = card.hovered;
      card.hovered = this.isPointInCard(mouseX, mouseY, card);

      let targetY = card.baseY;
      let targetScale = card.baseScale;
      let targetRotation = card.baseRotation;

      if (card.selected) {
        targetScale = this.selectedScale;
        targetRotation = this.selectedRotation;
        targetY = card.baseY - 10; 
      } else if (card.hovered) {
        targetY = card.baseY + this.hoverOffset;
      }

      card.currentY = lerpDelta(card.currentY, targetY, 0.2);
      card.currentScale = lerpDelta(card.currentScale, targetScale, 0.15);
      card.currentRotation = lerpDelta(
        card.currentRotation,
        targetRotation,
        0.15
      );

      if (card.hovered && !wasHovered) {
      }
    });

    if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
      this.cards.forEach((card) => {
        if (card.hovered) {
          this.cards.forEach((c) => (c.selected = false));

          card.selected = true;
          this.selectedCard = card.id;
          this.markCompleted();
        }
      });
    }
  }

  protected onStepRender(): void {
    const sortedCards = [...this.cards].sort((a, b) => {
      if (a.selected) return 1;
      if (b.selected) return -1;
      return 0;
    });

    sortedCards.forEach((card) => {
      rlPushMatrix();

      const cardCenterX = card.x + card.width / 2;
      const cardCenterY = card.currentY + card.height / 2;

      rlTranslatef(cardCenterX, cardCenterY, 0);
      rlScalef(card.currentScale, card.currentScale, 1);
      rlRotatef(card.currentRotation, 0, 0, 1);
      rlTranslatef(-cardCenterX, -cardCenterY, 0);

      let bgColor: Color = { r: 40, g: 40, b: 40, a: 240 };
      let borderColor: Color = { r: 100, g: 100, b: 100, a: 255 };
      let borderThickness = 2;

      if (card.selected) {
        bgColor = { r: 50, g: 80, b: 50, a: 250 };
        borderColor = { r: 120, g: 255, b: 120, a: 255 };
        borderThickness = 4;
      } else if (card.hovered) {
        bgColor = { r: 50, g: 50, b: 50, a: 240 };
        borderColor = card.color;
        borderThickness = 3;
      }

      if (card.hovered || card.selected) {
        const shadowOffset = card.selected ? 12 : 6;
        const shadowAlpha = card.selected ? 150 : 100;
        drawSprite(
          "/solid.png",
          Vector2(card.x + shadowOffset, card.currentY + shadowOffset),
          Vector2(card.width, card.height),
          { r: 0, g: 0, b: 0, a: shadowAlpha }
        );
      }

      drawSprite(
        "/solid.png",
        Vector2(card.x, card.currentY),
        Vector2(card.width, card.height),
        bgColor
      );

      drawSprite(
        "/solid.png",
        Vector2(card.x, card.currentY),
        Vector2(card.width, borderThickness),
        borderColor
      );

      drawSprite(
        "/solid.png",
        Vector2(card.x, card.currentY + card.height - borderThickness),
        Vector2(card.width, borderThickness),
        borderColor
      );

      drawSprite(
        "/solid.png",
        Vector2(card.x, card.currentY),
        Vector2(borderThickness, card.height),
        borderColor
      );

      drawSprite(
        "/solid.png",
        Vector2(card.x + card.width - borderThickness, card.currentY),
        Vector2(borderThickness, card.height),
        borderColor
      );

      const accentHeight = 80; 
      drawSprite(
        "/solid.png",
        Vector2(card.x + borderThickness, card.currentY + borderThickness),
        Vector2(card.width - borderThickness * 2, accentHeight),
        card.color
      );

      drawText(
        card.label,
        Vector2(card.x + card.width / 2, card.currentY + accentHeight + 50),
        28, 
        { r: 255, g: 255, b: 255, a: 255 },
        "center"
      );

      const descLines = card.description.split("\n");
      descLines.forEach((line, index) => {
        drawText(
          line,
          Vector2(
            card.x + card.width / 2,
            card.currentY + accentHeight + 110 + index * 35
          ),
          22, 
          { r: 200, g: 200, b: 200, a: 255 },
          "center"
        );
      });
      rlPopMatrix();
    });

    if (!this.selectedCard) {
      const instructionText = "Click on a card to select your PC type";
      const screenWidth = Rhythia.gameWidth;
      const screenHeight = Rhythia.gameHeight;

      drawText(
        instructionText,
        Vector2(screenWidth / 2, screenHeight / 2 + this.cardHeight / 2 - 10),
        22,
        { r: 180, g: 180, b: 180, a: 255 },
        "center"
      );
    }
  }

  protected checkCanContinue(): boolean {
    return this.selectedCard !== null;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  private isPointInCard(x: number, y: number, card: PCSpecCard): boolean {
    const padding = card.selected ? 20 : 0; 

    return (
      x >= card.x - padding &&
      x <= card.x + card.width + padding &&
      y >= card.currentY - padding &&
      y <= card.currentY + card.height + padding
    );
  }

  public getSelectedSpec(): string | null {
    return this.selectedCard;
  }
}
