import { Vector2, IsMouseButtonPressed, MOUSE_BUTTON_LEFT } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import { createDualSlider, DualSlider } from "../atoms/DualSlider";
import { ConfigManager } from "../../../utils/configManager";
import { AccentColor } from "../../../utils/imageBlur";
import { BaseDrawer } from "../atoms/BaseDrawer";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { lerpDelta } from "../../../utils/lerp";
import { playFx } from "../../../utils/soundManager";
import { logger } from "../../../utils/logger";

export type SortOption = "length" | "starRating" | "difficulty" | "none";
export type SortDirection = "asc" | "desc";

interface SortButton {
  gameObject: GameObject;
  option: SortOption;
  label: string;
  isActive: boolean;
  direction: SortDirection;
  hoverProgress: number;
}

export class DrawerFilters extends BaseDrawer {
  private starRatingFilter: DualSlider | null = null;
  private durationFilter: DualSlider | null = null;
  private sortButtons: SortButton[] = [];
  private activeSortOption: SortOption = "none";
  private sortDirection: SortDirection = "asc";
  private sortingEnabled: boolean = false;

  onStarFilterChange = (minStars: number, maxStars: number) => {};
  onDurationFilterChange = (minDuration: number, maxDuration: number) => {};
  onSortChange = (option: SortOption, direction: SortDirection) => {};

  constructor() {
    super(600); 
    this.createFilters();
    this.createSortButtons();
  }

  getHeaderText(): string {
    return "Filters";
  }

  drawContent(): void {
    drawText("Preferences", Vector2(40, 110), 32, {
      r: 200,
      g: 200,
      b: 200,
      a: this.animationProgress * 255,
    });

    if (this.sortingEnabled) {
      drawText("Sort By", Vector2(40, 340), 32, {
        r: 200,
        g: 200,
        b: 200,
        a: this.animationProgress * 255,
      });
    }
  }

  private createFilters(): void {
    const filterWidth = 520; 
    const leftMargin = 40; 
    const topMargin = 180; 
    const spacing = 100; 

    const config = ConfigManager.get();
    const durationY = topMargin;

    const initialX = -this.drawerWidth + leftMargin;

    this.durationFilter = createDualSlider({
      position: Vector2(initialX, durationY),
      width: filterWidth,
      height: 4,
      minValue: 0,
      maxValue: 300, 
      initialMinValue: config.durationFilterMin || 0,
      initialMaxValue: config.durationFilterMax || 300,
      label: "Duration Filter",
      showValues: true,
      precision: 0,
      valueFormatter: (seconds: number) => {
        const roundedSeconds = Math.round(seconds / 5) * 5;
        const minutes = Math.floor(roundedSeconds / 60);
        const remainingSeconds = roundedSeconds % 60;

        if (roundedSeconds === 0) {
          return "0";
        } else if (minutes === 0) {
          return `${remainingSeconds}s`;
        } else {
          return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
        }
      },
      onValueChange: (minDuration, maxDuration) => {
        ConfigManager.setDurationFilter(minDuration, maxDuration);
        this.onDurationFilterChange(minDuration, maxDuration);
      },
    });

    const starY = durationY + spacing;

    this.starRatingFilter = createDualSlider({
      position: Vector2(initialX, starY),
      width: filterWidth,
      height: 4,
      minValue: 0,
      maxValue: 10,
      initialMinValue: config.starFilterMin,
      initialMaxValue: config.starFilterMax,
      label: "Star Filter",
      showValues: true,
      precision: 1,
      onValueChange: (minStars, maxStars) => {
        ConfigManager.setStarFilter(minStars, maxStars);
        this.onStarFilterChange(minStars, maxStars);
      },
    });

    if (this.durationFilter) {
      const durationGO = this.durationFilter.getGameObject();
      durationGO.zBase = 16; 
    }
    if (this.starRatingFilter) {
      const starGO = this.starRatingFilter.getGameObject();
      starGO.zBase = 16; 
    }
  }

  private createSortButtons(): void {
    const buttonWidth = 250;
    const buttonHeight = 50;
    const leftMargin = 40;
    const topMargin = 380; 
    const horizontalSpacing = 270;
    const verticalSpacing = 60;

    const sortOptions: { option: SortOption; label: string }[] = [
      { option: "length", label: "Length" },
      { option: "starRating", label: "Star Rating" },
      { option: "difficulty", label: "Difficulty" },
      { option: "none", label: "No Sort" },
    ];

    sortOptions.forEach((sortOption, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = -this.drawerWidth + leftMargin + col * horizontalSpacing;
      const y = topMargin + row * verticalSpacing;

      const gameObject = new GameObject({ zBase: 16 });
      gameObject.attachRect({
        pos: { x, y },
        size: { x: buttonWidth, y: buttonHeight },
      });

      const button: SortButton = {
        gameObject,
        option: sortOption.option,
        label: sortOption.label,
        isActive: sortOption.option === this.activeSortOption,
        direction:
          sortOption.option === this.activeSortOption
            ? this.sortDirection
            : "asc",
        hoverProgress: 0,
      };

      gameObject.rectArea!.onClick = () => {
        this.handleSortButtonClick(button);
        return true; 
      };

      gameObject.rectArea!.onHoverStart = () => {
        playFx("/click.wav", 0.1);
      };

      gameObject.onDraw = () => this.drawSortButton(button);
      gameObject.onUpdate = () => this.updateSortButton(button);

      this.sortButtons.push(button);
    });
  }

  private handleSortButtonClick(button: SortButton): void {
    if (!this.sortingEnabled) return;

    playFx("/click.wav", 0.3);

    if (button.isActive) {
      if (button.option !== "none") {
        button.direction = button.direction === "asc" ? "desc" : "asc";
      }
    } else {
      this.sortButtons.forEach((b) => {
        b.isActive = false;
      });

      button.isActive = true;
      button.direction = "asc"; 
    }

    this.activeSortOption = button.option;
    this.sortDirection = button.direction;
    this.onSortChange(button.option, button.direction);
  }

  private updateSortButton(button: SortButton): void {
    const mousePos = button.gameObject.getMousePosition();
    const isHovered =
      mousePos &&
      button.gameObject.rectArea &&
      mousePos.x >= button.gameObject.rectArea.pos.x &&
      mousePos.x <=
        button.gameObject.rectArea.pos.x + button.gameObject.rectArea.size.x &&
      mousePos.y >= button.gameObject.rectArea.pos.y &&
      mousePos.y <=
        button.gameObject.rectArea.pos.y + button.gameObject.rectArea.size.y;

    if (isHovered) {
      button.hoverProgress = lerpDelta(button.hoverProgress, 1, 0.15);
    } else {
      button.hoverProgress = lerpDelta(button.hoverProgress, 0, 0.15);
    }
  }

  private drawSortButton(button: SortButton): void {
    if (this.animationProgress < 0.01) return;

    if (!this.sortingEnabled) return;

    const rect = button.gameObject.rectArea!;
    const isHovered = button.hoverProgress > 0.01;

    let bgAlpha = 0.2;
    if (button.isActive) bgAlpha = 0.4;
    if (isHovered) bgAlpha += button.hoverProgress * 0.1;

    let bgColor = {
      r: 100,
      g: 100,
      b: 100,
      a: bgAlpha * this.animationProgress * 255,
    };
    if (this.accentColor && button.isActive) {
      bgColor = {
        r: this.accentColor.r,
        g: this.accentColor.g,
        b: this.accentColor.b,
        a: bgAlpha * this.animationProgress * 255,
      };
    }

    drawSprite(
      "/solid.png",
      Vector2(rect.pos.x, rect.pos.y),
      Vector2(rect.size.x, rect.size.y),
      bgColor
    );

    if (button.isActive) {
      const borderColor = this.accentColor
        ? {
            r: this.accentColor.r,
            g: this.accentColor.g,
            b: this.accentColor.b,
            a: 0.6 * this.animationProgress * 255,
          }
        : { r: 150, g: 150, b: 150, a: 0.6 * this.animationProgress * 255 };

      drawSprite(
        "/solid.png",
        Vector2(rect.pos.x, rect.pos.y),
        Vector2(rect.size.x, 2),
        borderColor
      );

      drawSprite(
        "/solid.png",
        Vector2(rect.pos.x, rect.pos.y + rect.size.y - 2),
        Vector2(rect.size.x, 2),
        borderColor
      );

      drawSprite(
        "/solid.png",
        Vector2(rect.pos.x, rect.pos.y),
        Vector2(2, rect.size.y),
        borderColor
      );

      drawSprite(
        "/solid.png",
        Vector2(rect.pos.x + rect.size.x - 2, rect.pos.y),
        Vector2(2, rect.size.y),
        borderColor
      );
    }

    const textColor = button.isActive
      ? { r: 255, g: 255, b: 255, a: this.animationProgress * 255 }
      : { r: 180, g: 180, b: 180, a: this.animationProgress * 255 };

    drawText(
      button.label,
      Vector2(rect.pos.x + 15, rect.pos.y + 12),
      28,
      textColor
    );

    if (button.isActive && button.option !== "none") {
      const arrowX = rect.pos.x + rect.size.x - 40;
      const arrowY = rect.pos.y + rect.size.y / 2 - 8;
      const arrow = button.direction === "asc" ? ">" : "<";
      drawText(arrow, Vector2(arrowX, arrowY), 32, textColor);
    }
  }

  onUpdate(): void {
    const xOffset =
      -this.drawerWidth + this.drawerWidth * this.animationProgress;
    const leftMargin = 40;
    const topMargin = 180;
    const spacing = 100;

    
    
    const shouldHideSliders = !this.isOpen || this.animationProgress < 0.05;

    if (this.durationFilter) {
      const durationGO = this.durationFilter.getGameObject();
      if (shouldHideSliders) {
        
        this.durationFilter.setPosition(Vector2(-1_000_000, -1_000_000));
        if (durationGO.rectArea) {
          durationGO.rectArea.pos.x = -1_000_000;
          durationGO.rectArea.pos.y = -1_000_000;
        }
      } else {
        const sliderX = xOffset + leftMargin;
        this.durationFilter.setPosition(Vector2(sliderX, topMargin));
        if (durationGO.rectArea) {
          durationGO.rectArea.pos.x = sliderX;
          durationGO.rectArea.pos.y = topMargin;
        }
      }
    }

    if (this.starRatingFilter) {
      const starGO = this.starRatingFilter.getGameObject();
      if (shouldHideSliders) {
        this.starRatingFilter.setPosition(Vector2(-1_000_000, -1_000_000));
        if (starGO.rectArea) {
          starGO.rectArea.pos.x = -1_000_000;
          starGO.rectArea.pos.y = -1_000_000;
        }
      } else {
        const sliderX = xOffset + leftMargin;
        this.starRatingFilter.setPosition(
          Vector2(sliderX, topMargin + spacing)
        );
        if (starGO.rectArea) {
          starGO.rectArea.pos.x = sliderX;
          starGO.rectArea.pos.y = topMargin + spacing;
        }
      }
    }

    if (this.sortingEnabled) {
      const buttonTopMargin = 380;
      const horizontalSpacing = 270;
      const verticalSpacing = 60;

      this.sortButtons.forEach((button, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const buttonX = xOffset + leftMargin + col * horizontalSpacing;
        const buttonY = buttonTopMargin + row * verticalSpacing;

        if (button.gameObject.rectArea) {
          button.gameObject.rectArea.pos.x = buttonX;
          button.gameObject.rectArea.pos.y = buttonY;
        }
      });
    }
  }

  public setAccentColor(color: AccentColor | null): void {
    logger(color);
    super.setAccentColor(color);
    if (this.starRatingFilter) {
      this.starRatingFilter.setAccentColor(color);
    }
    if (this.durationFilter) {
      this.durationFilter.setAccentColor(color);
    }
  }

  public getStarFilterValues(): { minStars: number; maxStars: number } {
    if (!this.starRatingFilter) {
      return { minStars: 0, maxStars: 10 };
    }
    return {
      minStars: this.starRatingFilter.getMinValue(),
      maxStars: this.starRatingFilter.getMaxValue(),
    };
  }

  public getDurationFilterValues(): {
    minDuration: number;
    maxDuration: number;
  } {
    if (!this.durationFilter) {
      return { minDuration: 0, maxDuration: 300 };
    }
    return {
      minDuration: this.durationFilter.getMinValue(),
      maxDuration: this.durationFilter.getMaxValue(),
    };
  }

  public getSortOption(): { option: SortOption; direction: SortDirection } {
    return {
      option: this.activeSortOption,
      direction: this.sortDirection,
    };
  }

  public setSortingEnabled(enabled: boolean): void {
    this.sortingEnabled = enabled;

    this.sortButtons.forEach((button) => {
      if (button.gameObject.rectArea) {
        if (!enabled) {
          button.gameObject.rectArea.pos.y = -1000;
        }
      }
    });
  }

  public destroy(): void {
    this.sortButtons.forEach((button) => {
      button.gameObject.destroy();
    });
    if (this.starRatingFilter) {
      this.starRatingFilter.destroy();
    }
    if (this.durationFilter) {
      this.durationFilter.destroy();
    }
  }
}

export function createDrawerFilters(): DrawerFilters {
  return new DrawerFilters();
}
