import { BaseTutorialStep } from "../components/BaseTutorialStep";
import {
  GetFrameTime,
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
  rlScalef,
} from "raylib";
import { drawText } from "../../../utils/text";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import { lerpDelta } from "../../../utils/lerp";
import { loginWithDiscord } from "../../../utils/auth/supabase";

interface DiscordButton {
  x: number;
  y: number;
  width: number;
  height: number;
  hovered: boolean;
  scale: number;
  targetScale: number;
  glowAlpha: number;
  targetGlowAlpha: number;
  clicked: boolean;
}

interface OfflineButton {
  x: number;
  y: number;
  width: number;
  height: number;
  hovered: boolean;
  scale: number;
  targetScale: number;
}

interface WarningButton {
  x: number;
  y: number;
  width: number;
  height: number;
  hovered: boolean;
  scale: number;
  targetScale: number;
}

export class DiscordLoginStep extends BaseTutorialStep {
  private button!: DiscordButton;
  private offlineButton!: OfflineButton;
  private backButton!: WarningButton;
  private confirmButton!: WarningButton;
  private animationTime: number = 0;
  private loginClicked: boolean = false;
  private showingOfflineWarning: boolean = false;
  private offlineConfirmed: boolean = false;
  private isLoggingIn: boolean = false;
  private loginComplete: boolean = false;
  private loginError: string | null = null;

  constructor() {
    super({
      id: "discordLogin",
      text: "Finally, connect your Discord account for a personalized experience! We respect your privacy - no profile details will be made public.",
      mascotEmote: "happy",
      waitForUser: false,
    });

    this.initializeButtons();
  }

  private initializeButtons(): void {
    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;

    const buttonWidth = 400; 
    const buttonHeight = 100; 
    const buttonX = screenWidth / 2 - buttonWidth / 2;
    const buttonY = screenHeight / 2 - 180; 

    this.button = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      hovered: false,
      scale: 1.0,
      targetScale: 1.0,
      glowAlpha: 0,
      targetGlowAlpha: 0,
      clicked: false,
    };

    const offlineButtonWidth = 200;
    const offlineButtonHeight = 50;
    const offlineButtonX = screenWidth / 2 - offlineButtonWidth / 2;
    const offlineButtonY = buttonY + buttonHeight + 80; 

    this.offlineButton = {
      x: offlineButtonX,
      y: offlineButtonY,
      width: offlineButtonWidth,
      height: offlineButtonHeight,
      hovered: false,
      scale: 1.0,
      targetScale: 1.0,
    };

    const warningButtonWidth = 150;
    const warningButtonHeight = 50;
    const warningButtonY = screenHeight / 2 + 80; 
    const buttonSpacing = 40;
    const totalButtonsWidth = warningButtonWidth * 2 + buttonSpacing;
    const warningButtonsStartX = screenWidth / 2 - totalButtonsWidth / 2;

    this.backButton = {
      x: warningButtonsStartX,
      y: warningButtonY,
      width: warningButtonWidth,
      height: warningButtonHeight,
      hovered: false,
      scale: 1.0,
      targetScale: 1.0,
    };

    this.confirmButton = {
      x: warningButtonsStartX + warningButtonWidth + buttonSpacing,
      y: warningButtonY,
      width: warningButtonWidth,
      height: warningButtonHeight,
      hovered: false,
      scale: 1.0,
      targetScale: 1.0,
    };
  }

  protected async onStepEnter(): Promise<void> {
    this.animationTime = 0;
    this.loginClicked = false;
    this.showingOfflineWarning = false;
    this.offlineConfirmed = false;
    this.button.hovered = false;
    this.button.scale = 1.0;
    this.button.targetScale = 1.0;
    this.button.glowAlpha = 0;
    this.button.targetGlowAlpha = 0;
    this.button.clicked = false;
    this.offlineButton.hovered = false;
    this.offlineButton.scale = 1.0;
    this.offlineButton.targetScale = 1.0;
    this.backButton.hovered = false;
    this.backButton.scale = 1.0;
    this.backButton.targetScale = 1.0;
    this.confirmButton.hovered = false;
    this.confirmButton.scale = 1.0;
    this.confirmButton.targetScale = 1.0;
    this.isLoggingIn = false;
    this.loginComplete = false;
    this.loginError = null;
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {
    this.animationTime += GetFrameTime() * 1000;

    if (this.isLoggingIn) {
      return;
    }

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

    if (!this.showingOfflineWarning) {
      const wasHovered = this.button.hovered;
      this.button.hovered = this.isPointInDiscordButton(mouseX, mouseY);

      if (this.button.hovered) {
        this.button.targetScale = 1.05;
        this.button.targetGlowAlpha = 80;
      } else {
        this.button.targetScale = 1.0;
        this.button.targetGlowAlpha = 20;
      }

      if (this.button.targetGlowAlpha === 0) {
        this.button.targetGlowAlpha = 20;
      }

      this.offlineButton.hovered = this.isPointInOfflineButton(mouseX, mouseY);
      this.offlineButton.targetScale = this.offlineButton.hovered ? 1.05 : 1.0;

      this.button.scale = lerpDelta(
        this.button.scale,
        this.button.targetScale,
        0.15
      );
      this.button.glowAlpha = lerpDelta(
        this.button.glowAlpha,
        this.button.targetGlowAlpha,
        0.1
      );
      this.offlineButton.scale = lerpDelta(
        this.offlineButton.scale,
        this.offlineButton.targetScale,
        0.15
      );

      const pulseIntensity = Math.sin(this.animationTime * 0.002) * 0.3 + 0.7;
      this.button.targetGlowAlpha = Math.max(
        this.button.targetGlowAlpha * pulseIntensity,
        20
      );

      if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        if (this.button.hovered) {
          this.loginClicked = true;
          this.startDiscordLogin();
        } else if (this.offlineButton.hovered) {
          this.showingOfflineWarning = true;
        }
      }
    } else {
      this.backButton.hovered = this.isPointInBackButton(mouseX, mouseY);
      this.backButton.targetScale = this.backButton.hovered ? 1.05 : 1.0;

      this.confirmButton.hovered = this.isPointInConfirmButton(mouseX, mouseY);
      this.confirmButton.targetScale = this.confirmButton.hovered ? 1.05 : 1.0;

      this.backButton.scale = lerpDelta(
        this.backButton.scale,
        this.backButton.targetScale,
        0.15
      );
      this.confirmButton.scale = lerpDelta(
        this.confirmButton.scale,
        this.confirmButton.targetScale,
        0.15
      );

      if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        if (this.backButton.hovered) {
          this.showingOfflineWarning = false;
        } else if (this.confirmButton.hovered) {
          this.offlineConfirmed = true;
          this.markCompleted();
        }
      }
    }
  }

  protected onStepRender(): void {
    if (this.isLoggingIn) {
      this.renderLoadingOverlay();
      return;
    }

    if (!this.showingOfflineWarning) {
      this.renderDiscordButton();
      this.renderOfflineButton();
      this.renderPrivacyInfo();
    } else {
      this.renderOfflineWarning();
    }
  }

  private renderDiscordButton(): void {
    rlPushMatrix();

    const centerX = this.button.x + this.button.width / 2;
    const centerY = this.button.y + this.button.height / 2;

    rlTranslatef(centerX, centerY, 0);
    rlScalef(this.button.scale, this.button.scale, 1);
    rlTranslatef(-centerX, -centerY, 0);

    if (this.button.glowAlpha > 0) {
      const glowSize = 12;
      const glowColor: Color = {
        r: 88,
        g: 101,
        b: 242, 
        a: this.button.glowAlpha,
      };

      drawSprite(
        "/solid.png",
        Vector2(this.button.x - glowSize, this.button.y - glowSize),
        Vector2(
          this.button.width + glowSize * 2,
          this.button.height + glowSize * 2
        ),
        glowColor
      );
    }

    const discordColor: Color = { r: 88, g: 101, b: 242, a: 255 };
    const discordColorHover: Color = { r: 78, g: 91, b: 232, a: 255 };
    const buttonColor = this.button.hovered ? discordColorHover : discordColor;

    drawSprite(
      "/solid.png",
      Vector2(this.button.x, this.button.y),
      Vector2(this.button.width, this.button.height),
      buttonColor
    );

    const borderThickness = this.button.hovered ? 3 : 2;
    const borderColor: Color = { r: 255, g: 255, b: 255, a: 100 };

    drawSprite(
      "/solid.png",
      Vector2(this.button.x, this.button.y),
      Vector2(this.button.width, borderThickness),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(
        this.button.x,
        this.button.y + this.button.height - borderThickness
      ),
      Vector2(this.button.width, borderThickness),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(this.button.x, this.button.y),
      Vector2(borderThickness, this.button.height),
      borderColor
    );

    drawSprite(
      "/solid.png",
      Vector2(
        this.button.x + this.button.width - borderThickness,
        this.button.y
      ),
      Vector2(borderThickness, this.button.height),
      borderColor
    );

    const logoSize = 50; 
    const logoX = this.button.x + 30; 
    const logoY = this.button.y + (this.button.height - logoSize) / 2;

    const logoColor: Color = { r: 255, g: 255, b: 255, a: 255 };
    drawSprite(
      "/solid.png",
      Vector2(logoX, logoY),
      Vector2(logoSize, logoSize),
      logoColor
    );

    drawText(
      "D",
      Vector2(logoX + logoSize / 2, logoY + logoSize / 2 - 15),
      30, 
      discordColor,
      "center"
    );

    const buttonText = this.isLoggingIn
      ? "Connecting..."
      : this.loginComplete
      ? "Connected"
      : "Login with Discord";
    const textColor: Color = { r: 255, g: 255, b: 255, a: 255 };

    drawText(
      buttonText,
      Vector2(
        this.button.x + this.button.width / 2 + 25,
        this.button.y + this.button.height / 2 - 12
      ),
      28, 
      textColor,
      "center"
    );

    if (this.button.clicked) {
      drawText(
        "✓",
        Vector2(this.button.x + this.button.width - 40, this.button.y + 20),
        26, 
        { r: 0, g: 255, b: 0, a: 255 },
        "center"
      );
    }

    rlPopMatrix();
  }

  private renderPrivacyInfo(): void {
    const infoY = this.button.y + this.button.height + 30;

    drawText(
      "Your Discord profile remains private",
      Vector2(this.button.x + this.button.width / 2, infoY),
      22, 
      { r: 180, g: 180, b: 180, a: 255 },
      "center"
    );

    if (this.loginError) {
      drawText(
        this.loginError,
        Vector2(this.button.x + this.button.width / 2, infoY + 30),
        18,
        { r: 255, g: 120, b: 120, a: 255 },
        "center"
      );
    }
  }

  private renderOfflineButton(): void {
    rlPushMatrix();

    const centerX = this.offlineButton.x + this.offlineButton.width / 2;
    const centerY = this.offlineButton.y + this.offlineButton.height / 2;

    rlTranslatef(centerX, centerY, 0);
    rlScalef(this.offlineButton.scale, this.offlineButton.scale, 1);
    rlTranslatef(-centerX, -centerY, 0);

    const buttonColor: Color = this.offlineButton.hovered
      ? { r: 60, g: 60, b: 60, a: 255 }
      : { r: 40, g: 40, b: 40, a: 255 };

    drawSprite(
      "/solid.png",
      Vector2(this.offlineButton.x, this.offlineButton.y),
      Vector2(this.offlineButton.width, this.offlineButton.height),
      buttonColor
    );

    const borderColor: Color = { r: 120, g: 120, b: 120, a: 255 };
    const borderThickness = 2;

    drawSprite(
      "/solid.png",
      Vector2(this.offlineButton.x, this.offlineButton.y),
      Vector2(this.offlineButton.width, borderThickness),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(
        this.offlineButton.x,
        this.offlineButton.y + this.offlineButton.height - borderThickness
      ),
      Vector2(this.offlineButton.width, borderThickness),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(this.offlineButton.x, this.offlineButton.y),
      Vector2(borderThickness, this.offlineButton.height),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(
        this.offlineButton.x + this.offlineButton.width - borderThickness,
        this.offlineButton.y
      ),
      Vector2(borderThickness, this.offlineButton.height),
      borderColor
    );

    drawText(
      "I want to play offline",
      Vector2(
        this.offlineButton.x + this.offlineButton.width / 2,
        this.offlineButton.y + this.offlineButton.height / 2 - 8
      ),
      16,
      { r: 200, g: 200, b: 200, a: 255 },
      "center"
    );

    rlPopMatrix();
  }

  private renderOfflineWarning(): void {
    const screenWidth = Rhythia.gameWidth;
    const screenHeight = Rhythia.gameHeight;

    const panelWidth = 600;
    const panelHeight = 400;
    const panelX = screenWidth / 2 - panelWidth / 2;
    const panelY = screenHeight / 2 - panelHeight / 2 - 50;

    drawSprite(
      "/solid.png",
      Vector2(panelX, panelY),
      Vector2(panelWidth, panelHeight),
      { r: 35, g: 35, b: 40, a: 250 }
    );

    const borderColor: Color = { r: 150, g: 150, b: 150, a: 255 };
    const borderThickness = 3;

    drawSprite(
      "/solid.png",
      Vector2(panelX, panelY),
      Vector2(panelWidth, borderThickness),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(panelX, panelY + panelHeight - borderThickness),
      Vector2(panelWidth, borderThickness),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(panelX, panelY),
      Vector2(borderThickness, panelHeight),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(panelX + panelWidth - borderThickness, panelY),
      Vector2(borderThickness, panelHeight),
      borderColor
    );

    drawText(
      "Playing Offline",
      Vector2(panelX + panelWidth / 2, panelY + 30),
      28,
      { r: 255, g: 200, b: 100, a: 255 },
      "center"
    );

    drawText(
      "You will not have access to:",
      Vector2(panelX + panelWidth / 2, panelY + 70),
      20,
      { r: 200, g: 200, b: 200, a: 255 },
      "center"
    );

    const limitations = [
      "- Custom trails",
      "- Custom cursors",
      "- Custom backgrounds",
      "- Storyline",
      "- Multiplayer",
      "- Profiles and leaderboards",
    ];

    limitations.forEach((limitation, index) => {
      drawText(
        limitation,
        Vector2(panelX + 50, panelY + 120 + index * 30),
        18,
        { r: 180, g: 180, b: 180, a: 255 },
        "left"
      );
    });

    drawText(
      "Are you sure you want to continue?",
      Vector2(panelX + panelWidth / 2, panelY + panelHeight - 100),
      20,
      { r: 255, g: 255, b: 255, a: 255 },
      "center"
    );

    this.renderWarningButtons();
  }

  private renderWarningButtons(): void {
    rlPushMatrix();

    const backCenterX = this.backButton.x + this.backButton.width / 2;
    const backCenterY = this.backButton.y + this.backButton.height / 2;

    rlTranslatef(backCenterX, backCenterY, 0);
    rlScalef(this.backButton.scale, this.backButton.scale, 1);
    rlTranslatef(-backCenterX, -backCenterY, 0);

    const backButtonColor: Color = this.backButton.hovered
      ? { r: 70, g: 70, b: 70, a: 255 }
      : { r: 50, g: 50, b: 50, a: 255 };

    drawSprite(
      "/solid.png",
      Vector2(this.backButton.x, this.backButton.y),
      Vector2(this.backButton.width, this.backButton.height),
      backButtonColor
    );

    const borderColor: Color = { r: 120, g: 120, b: 120, a: 255 };
    const borderThickness = 2;

    drawSprite(
      "/solid.png",
      Vector2(this.backButton.x, this.backButton.y),
      Vector2(this.backButton.width, borderThickness),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(
        this.backButton.x,
        this.backButton.y + this.backButton.height - borderThickness
      ),
      Vector2(this.backButton.width, borderThickness),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(this.backButton.x, this.backButton.y),
      Vector2(borderThickness, this.backButton.height),
      borderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(
        this.backButton.x + this.backButton.width - borderThickness,
        this.backButton.y
      ),
      Vector2(borderThickness, this.backButton.height),
      borderColor
    );

    drawText(
      "Go Back",
      Vector2(
        this.backButton.x + this.backButton.width / 2,
        this.backButton.y + this.backButton.height / 2 - 8
      ),
      18,
      { r: 200, g: 200, b: 200, a: 255 },
      "center"
    );

    rlPopMatrix();

    rlPushMatrix();

    const confirmCenterX = this.confirmButton.x + this.confirmButton.width / 2;
    const confirmCenterY = this.confirmButton.y + this.confirmButton.height / 2;

    rlTranslatef(confirmCenterX, confirmCenterY, 0);
    rlScalef(this.confirmButton.scale, this.confirmButton.scale, 1);
    rlTranslatef(-confirmCenterX, -confirmCenterY, 0);

    const confirmButtonColor: Color = this.confirmButton.hovered
      ? { r: 80, g: 60, b: 60, a: 255 }
      : { r: 60, g: 40, b: 40, a: 255 };

    drawSprite(
      "/solid.png",
      Vector2(this.confirmButton.x, this.confirmButton.y),
      Vector2(this.confirmButton.width, this.confirmButton.height),
      confirmButtonColor
    );

    const confirmBorderColor: Color = { r: 150, g: 100, b: 100, a: 255 };

    drawSprite(
      "/solid.png",
      Vector2(this.confirmButton.x, this.confirmButton.y),
      Vector2(this.confirmButton.width, borderThickness),
      confirmBorderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(
        this.confirmButton.x,
        this.confirmButton.y + this.confirmButton.height - borderThickness
      ),
      Vector2(this.confirmButton.width, borderThickness),
      confirmBorderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(this.confirmButton.x, this.confirmButton.y),
      Vector2(borderThickness, this.confirmButton.height),
      confirmBorderColor
    );
    drawSprite(
      "/solid.png",
      Vector2(
        this.confirmButton.x + this.confirmButton.width - borderThickness,
        this.confirmButton.y
      ),
      Vector2(borderThickness, this.confirmButton.height),
      confirmBorderColor
    );

    drawText(
      "Continue Offline",
      Vector2(
        this.confirmButton.x + this.confirmButton.width / 2,
        this.confirmButton.y + this.confirmButton.height / 2 - 8
      ),
      16,
      { r: 200, g: 180, b: 180, a: 255 },
      "center"
    );

    rlPopMatrix();
  }

  protected checkCanContinue(): boolean {
    return this.loginComplete || this.offlineConfirmed;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  private isPointInDiscordButton(x: number, y: number): boolean {
    return (
      x >= this.button.x &&
      x <= this.button.x + this.button.width &&
      y >= this.button.y &&
      y <= this.button.y + this.button.height
    );
  }

  private isPointInOfflineButton(x: number, y: number): boolean {
    return (
      x >= this.offlineButton.x &&
      x <= this.offlineButton.x + this.offlineButton.width &&
      y >= this.offlineButton.y &&
      y <= this.offlineButton.y + this.offlineButton.height
    );
  }

  private isPointInBackButton(x: number, y: number): boolean {
    return (
      x >= this.backButton.x &&
      x <= this.backButton.x + this.backButton.width &&
      y >= this.backButton.y &&
      y <= this.backButton.y + this.backButton.height
    );
  }

  private startDiscordLogin(): void {
    if (this.isLoggingIn || this.loginComplete) {
      return;
    }

    this.isLoggingIn = true;
    this.loginError = null;
    this.loginComplete = false;
    this.button.clicked = false;
    this.showingOfflineWarning = false;

    this.button.targetScale = 1.1;
    setTimeout(() => {
      this.button.targetScale = this.button.hovered ? 1.05 : 1.0;
    }, 150);

    console.log("Discord login initiated");

    void (async () => {
      try {
        await supabaseLogin();

        this.button.clicked = true;
        this.loginComplete = true;
        this.markCompleted();
      } catch (error) {
        console.error("Discord login failed", error);
        this.loginError = "Discord login failed";
        this.loginClicked = false;
      } finally {
        this.isLoggingIn = false;
      }
    })();
  }

  private renderLoadingSpinner(
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    const segments = 10;
    const rotation = (this.animationTime / 1000) * Math.PI * 2;
    const dotSize = 6;

    for (let i = 0; i < segments; i++) {
      const progress = i / segments;
      const angle = rotation + progress * Math.PI * 2;
      const alpha = Math.round(80 + progress * 140);
      const x = centerX + Math.cos(angle) * radius - dotSize / 2;
      const y = centerY + Math.sin(angle) * radius - dotSize / 2;

      drawSprite("/solid.png", Vector2(x, y), Vector2(dotSize, dotSize), {
        r: 255,
        g: 255,
        b: 255,
        a: alpha,
      });
    }
  }

  private renderLoadingOverlay(): void {
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;

    this.renderLoadingSpinner(centerX, centerY, 40);
  }

  private isPointInConfirmButton(x: number, y: number): boolean {
    return (
      x >= this.confirmButton.x &&
      x <= this.confirmButton.x + this.confirmButton.width &&
      y >= this.confirmButton.y &&
      y <= this.confirmButton.y + this.confirmButton.height
    );
  }
}

async function supabaseLogin(): Promise<void> {
  const user = await loginWithDiscord();

  if (!user) {
    throw new Error("Discord login did not return a user");
  }
}
