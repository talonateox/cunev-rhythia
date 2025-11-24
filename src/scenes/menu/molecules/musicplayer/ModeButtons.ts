import { Vector2, IsMouseButtonReleased, MOUSE_BUTTON_LEFT } from "raylib";
import { drawSprite } from "../../../../utils/sprite";
import { ModeManager, BuiltinModes } from "../../../game/modes";
import type { GameMode } from "../../../game/modes";
import { drawText, measureText } from "../../../../utils/text";
import { lerpDelta } from "../../../../utils/lerp";
import { drawRect } from "../../../../ui/draw";
import { easeOutCubic } from "../../../../ui/anim";
import { AccentColor } from "../../../../utils/imageBlur";
import { SpeedContextMenu } from "./SpeedContextMenu";

type ButtonDef = {
  icon: string;
  mode: GameMode;
  submenu?: "speed";
};

type ButtonLayout = {
  button: ButtonDef;
  globalIndex: number;
  x: number;
};

type NavRect = {
  x: number;
  y: number;
  size: number;
};

export class ModeButtons {
  private readonly size: number = 65; 
  private readonly spacing: number = 16;
  private readonly buttonsPerPage: number = 7;
  private hoveredIndex: number = -1;
  private hoveredNav: "prev" | "next" | null = null;
  private currentPage: number = 0;
  private rotationAngles: number[] = [];
  
  private isTransitioning: boolean = false;
  private transitionDir: 1 | -1 = 1;
  private transitionProgress: number = 1;
  private fromPageIndex: number = 0;
  private toPageIndex: number = 0;
  private speedMenu: SpeedContextMenu;
  private pendingChange: string | null = null;

  private buttons: ButtonDef[] = [
    { mode: BuiltinModes.DefaultMode, icon: "/mod_default.png" },
    { mode: BuiltinModes.NoFailMode, icon: "/mod_nofail.png" },
    
    { mode: BuiltinModes.Speed125Mode, icon: "/time.png", submenu: "speed" },
    { mode: BuiltinModes.MirrorMode, icon: "/mod_mirror.png" },
    { mode: BuiltinModes.HardrockMode, icon: "/mod_hardrock.png" },
  ];

  constructor() {

    
    this.speedMenu = new SpeedContextMenu({
      items: [
        { id: "speed075", label: "x0.75" },
        { id: "speed080", label: "x0.80" },
        { id: "speed087", label: "x0.87" },
        { id: "default", label: "x1.00 (Default)" },
        { id: "speed115", label: "x1.15" },
        { id: "speed125", label: "x1.25" },
        { id: "speed135", label: "x1.35" },
        { id: "speed145", label: "x1.45" },
      ],
      onSelect: (id) => {
        if (id === "default") {
          
          const current = ModeManager.getActiveModeIds();
          const withoutSpeed = current.filter((mid) => !mid.startsWith("speed"));
          ModeManager.setActiveModesByIds(withoutSpeed);
          this.pendingChange = "default";
        } else {
          const res = ModeManager.toggleModeById(id);
          if (res.ok) {
            this.pendingChange = id;
          }
        }
      },
    });
  }

  public getSize(): number {
    return this.size;
  }

  private getPageCount(): number {
    if (this.buttons.length === 0) return 1;
    return Math.ceil(this.buttons.length / this.buttonsPerPage);
  }

  private ensureCurrentPage(): void {
    const pageCount = this.getPageCount();
    if (this.currentPage >= pageCount) {
      this.currentPage = pageCount - 1;
    }
    if (this.currentPage < 0) {
      this.currentPage = 0;
    }
  }

  private changePage(delta: number): void {
    if (this.isTransitioning) return;
    const pageCount = this.getPageCount();
    const target = Math.max(
      0,
      Math.min(pageCount - 1, this.currentPage + delta)
    );
    if (target !== this.currentPage) {
      this.fromPageIndex = this.currentPage;
      this.toPageIndex = target;
      this.currentPage = target;
      this.transitionDir = delta > 0 ? 1 : -1;
      this.transitionProgress = 0;
      this.isTransitioning = true;
      this.hoveredIndex = -1;
      this.hoveredNav = null;
    }
  }

  private syncRotationArray(): void {
    if (this.rotationAngles.length !== this.buttons.length) {
      this.rotationAngles = new Array(this.buttons.length).fill(0);
    }
  }

  private doComputeLayout(
    pageIndex: number,
    centerX: number,
    y: number
  ): {
    buttonLayouts: ButtonLayout[];
    prevRect?: NavRect;
    nextRect?: NavRect;
    pageCount: number;
  } {
    const pageCount = this.getPageCount();
    const hasPrev = pageIndex > 0;
    const hasNext = pageIndex < pageCount - 1;
    const navSize = Math.round(this.size / 2);
    const navTop = y + (this.size - navSize) / 2;
    const navSpacing = this.spacing;

    const startIndex = pageIndex * this.buttonsPerPage;
    const visible = this.buttons.slice(
      startIndex,
      startIndex + this.buttonsPerPage
    );
    const visibleCount = visible.length;

    const rowWidth =
      visibleCount === 0
        ? 0
        : visibleCount * this.size + (visibleCount - 1) * this.spacing;

    const buttonStartX = centerX - rowWidth / 2;
    let prevRect: NavRect | undefined;
    if (hasPrev) {
      prevRect = {
        x: buttonStartX - navSpacing - navSize,
        y: navTop,
        size: navSize,
      };
    }
    const buttonLayouts: ButtonLayout[] = visible.map((button, idx) => ({
      button,
      globalIndex: startIndex + idx,
      x: buttonStartX + idx * (this.size + this.spacing),
    }));

    let nextRect: NavRect | undefined;
    if (hasNext) {
      const nextX = buttonStartX + rowWidth + navSpacing;
      nextRect = { x: nextX, y: navTop, size: navSize };
    }

    return {
      buttonLayouts,
      prevRect,
      nextRect,
      pageCount,
    };
  }

  private computeLayout(centerX: number, y: number) {
    this.ensureCurrentPage();
    return this.doComputeLayout(this.currentPage, centerX, y);
  }

  private computeLayoutForPage(pageIndex: number, centerX: number, y: number) {
    return this.doComputeLayout(pageIndex, centerX, y);
  }

  private pointInRect(pos: Vector2, rect?: NavRect): boolean {
    if (!rect) return false;
    return (
      pos.x >= rect.x &&
      pos.x <= rect.x + rect.size &&
      pos.y >= rect.y &&
      pos.y <= rect.y + rect.size
    );
  }

  public update(mousePos: Vector2, centerX: number, y: number): string | null {
    
    if (this.pendingChange) {
      const c = this.pendingChange;
      this.pendingChange = null;
      return c;
    }
    
    if (this.speedMenu.isOpenOrAnimating()) {
      return null;
    }
    this.syncRotationArray();
    this.ensureCurrentPage();

    if (this.isTransitioning) {
      
      this.transitionProgress = lerpDelta(this.transitionProgress, 1, 0.18);
      if (this.transitionProgress > 0.995) {
        this.transitionProgress = 1;
        this.isTransitioning = false;
      }

      
      const toLayout = this.computeLayoutForPage(this.toPageIndex, centerX, y);
      const eased = easeOutCubic(this.transitionProgress);
      const slideDistance = 40;
      const dxTo = this.transitionDir * (1 - eased) * slideDistance;

      this.hoveredIndex = -1;
      this.hoveredNav = null;

      for (const { button, globalIndex, x } of toLayout.buttonLayouts) {
        const hovered =
          mousePos.x >= x + dxTo &&
          mousePos.x <= x + dxTo + this.size &&
          mousePos.y >= y &&
          mousePos.y <= y + this.size;

        if (hovered) {
          this.hoveredIndex = globalIndex;
          if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
            if (button.mode.id === "default") {
              ModeManager.setActiveModesByIds([]);
              return "default";
            } else {
              const res = ModeManager.toggleModeById(button.mode.id);
              if (res.ok) {
                return button.mode.id;
              }
            }
          }
        }

        const targetRot = hovered ? 12 : 0;
        this.rotationAngles[globalIndex] = lerpDelta(
          this.rotationAngles[globalIndex] ?? 0,
          targetRot,
          0.25
        );
      }
      return null;
    }

    const layout = this.computeLayout(centerX, y);
    const { buttonLayouts, prevRect, nextRect } = layout;

    this.hoveredIndex = -1;
    this.hoveredNav = null;

    if (this.pointInRect(mousePos, prevRect)) {
      this.hoveredNav = "prev";
      if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        this.changePage(-1);
        return null;
      }
    }

    if (this.pointInRect(mousePos, nextRect)) {
      this.hoveredNav = "next";
      if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        this.changePage(1);
        return null;
      }
    }

    for (const { button, globalIndex, x } of buttonLayouts) {
      const hovered =
        mousePos.x >= x &&
        mousePos.x <= x + this.size &&
        mousePos.y >= y &&
        mousePos.y <= y + this.size;

      if (hovered) {
        this.hoveredIndex = globalIndex;

        if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
          
          if (button.submenu === "speed") {
            this.speedMenu.openAt(x, y, this.size);
            return null;
          }
          if (button.mode.id === "default") {
            ModeManager.setActiveModesByIds([]);
            return "default";
          } else {
            const res = ModeManager.toggleModeById(button.mode.id);
            if (res.ok) {
              return button.mode.id;
            }
          }
        }
      }

      const targetRot = hovered ? 12 : 0;
      this.rotationAngles[globalIndex] = lerpDelta(
        this.rotationAngles[globalIndex] ?? 0,
        targetRot,
        0.25
      );
    }

    return null;
  }

  public isOverlayOpen(): boolean {
    return this.speedMenu?.isOpenOrAnimating() || false;
  }

  public setAccentColor(color: AccentColor | null): void {
    try {
      this.speedMenu.setAccentColor(color);
    } catch {}
  }

  public draw(centerX: number, y: number): void {
    this.ensureCurrentPage();
    const activeIds = ModeManager.getActiveModeIds();

    if (this.isTransitioning) {
      const fromLayout = this.computeLayoutForPage(
        this.fromPageIndex,
        centerX,
        y
      );
      const toLayout = this.computeLayoutForPage(this.toPageIndex, centerX, y);
      const eased = 1 - Math.pow(1 - this.transitionProgress, 3);
      
      const slideDistance = 40;
      const dxFrom = -this.transitionDir * eased * slideDistance;
      const dxTo = this.transitionDir * (1 - eased) * slideDistance;

      
      this.drawButtonSet(
        fromLayout.buttonLayouts,
        y,
        activeIds,
        1 - eased,
        dxFrom
      );
      this.drawButtonSet(toLayout.buttonLayouts, y, activeIds, eased, dxTo);

      
      const prevRect = toLayout.prevRect;
      const nextRect = toLayout.nextRect;
      const pageCount = toLayout.pageCount;
      const clickTargets: Array<{
        rect: NavRect;
        label: string;
        isHovered: boolean;
      }> = [];
      if (prevRect)
        clickTargets.push({ rect: prevRect, label: "<", isHovered: false });
      if (nextRect)
        clickTargets.push({ rect: nextRect, label: ">", isHovered: false });

      const navFontSize = 26;
      for (const target of clickTargets) {
        const half = target.rect.size / 2;
        const centerXBtn = target.rect.x + half;
        const centerYBtn = target.rect.y + half;
        const labelSize = measureText(target.label, navFontSize, 1);
        const bgAlpha = 20;
        drawRect(
          centerXBtn - half,
          centerYBtn - half,
          target.rect.size,
          target.rect.size,
          { r: 255, g: 255, b: 255, a: bgAlpha }
        );
        drawText(
          target.label,
          Vector2(centerXBtn, centerYBtn - labelSize.height / 2),
          navFontSize,
          { r: 255, g: 255, b: 255, a: 180 },
          "center"
        );
        drawRect(
          centerXBtn - half,
          centerYBtn + half - 2,
          target.rect.size,
          2,
          { r: 255, g: 255, b: 255, a: 60 }
        );
      }

      if (pageCount > 1) {
        const label = `${this.currentPage + 1} / ${pageCount}`;
        const fontSize = 18;
        const textSize = measureText(label, fontSize, 1);
        const indicatorTop = y + this.size + 24;
        drawRect(
          centerX - textSize.width / 2 - 6,
          indicatorTop - 4,
          textSize.width + 12,
          textSize.height + 8,
          { r: 0, g: 0, b: 0, a: 120 }
        );
        drawText(
          label,
          Vector2(centerX, indicatorTop),
          fontSize,
          { r: 255, g: 255, b: 255, a: 220 },
          "center"
        );
      }
      return;
    }

    const { buttonLayouts, prevRect, nextRect, pageCount } = this.computeLayout(
      centerX,
      y
    );
    const clickTargets: Array<{
      rect: NavRect;
      label: string;
      isHovered: boolean;
    }> = [];

    if (prevRect) {
      clickTargets.push({
        rect: prevRect,
        label: "<",
        isHovered: this.hoveredNav === "prev",
      });
    }
    if (nextRect) {
      clickTargets.push({
        rect: nextRect,
        label: ">",
        isHovered: this.hoveredNav === "next",
      });
    }

    const navFontSize = 26;
    for (const target of clickTargets) {
      const half = target.rect.size / 2;
      const centerXBtn = target.rect.x + half;
      const centerYBtn = target.rect.y + half;
      const labelSize = measureText(target.label, navFontSize, 1);

      const bgAlpha = target.isHovered ? 50 : 20;
      drawSprite(
        "/solid.png",
        Vector2(centerXBtn - half, centerYBtn - half),
        Vector2(target.rect.size, target.rect.size),
        { r: 255, g: 255, b: 255, a: bgAlpha }
      );

      drawText(
        target.label,
        Vector2(centerXBtn, centerYBtn - labelSize.height / 2),
        navFontSize,
        { r: 255, g: 255, b: 255, a: target.isHovered ? 255 : 180 },
        "center"
      );

      drawSprite(
        "/solid.png",
        Vector2(centerXBtn - half, centerYBtn + half - 2),
        Vector2(target.rect.size, 2),
        { r: 255, g: 255, b: 255, a: target.isHovered ? 120 : 60 }
      );
    }

    for (const { button, globalIndex, x } of buttonLayouts) {
      const half = this.size / 2;
      const centerXBtn = x + half;
      const centerYBtn = y + half;

      const isHovered = globalIndex === this.hoveredIndex;
      const isSelected =
        button.submenu === "speed"
          ? activeIds.some((id) => id.startsWith("speed"))
          : button.mode.id === "default"
          ? activeIds.length === 0
          : activeIds.includes(button.mode.id);
      const canEnable =
        isSelected || ModeManager.canEnableWithCurrent(button.mode).ok === true;

      const bgAlpha = isSelected ? 60 : isHovered ? 40 : 12;
      drawRect(centerXBtn - half, centerYBtn - half, this.size, this.size, {
        r: 255,
        g: 255,
        b: 255,
        a: bgAlpha,
      });

      const padding = 14;
      const iconSize = this.size - padding;
      
      const speedId = activeIds.find((id) => id.startsWith("speed"));
      let iconPath = button.icon;
      if (button.submenu === "speed") {
        switch (speedId) {
          case "speed075":
            iconPath = "/mod_75.png";
            break;
          case "speed080":
            iconPath = "/mod_80.png";
            break;
          case "speed087":
            iconPath = "/mod_87.png";
            break;
          case "speed115":
            iconPath = "/mod_15.png";
            break;
          case "speed125":
            iconPath = "/mod_25.png";
            break;
          case "speed135":
            iconPath = "/mod_35.png";
            break;
          case "speed145":
            iconPath = "/mod_45.png";
            break;
          default:
            iconPath = "/mod_100.png";
        }
      }

      let iconAlpha = isSelected ? 255 : isHovered ? 220 : 130;

      if (!canEnable && !isSelected) iconAlpha = Math.min(iconAlpha, 80);
      const iconColor = { r: 255, g: 255, b: 255, a: iconAlpha };

      const rotation = this.rotationAngles[globalIndex] ?? 0;
      drawSprite(
        iconPath,
        Vector2(centerXBtn, centerYBtn),
        Vector2(iconSize, iconSize),
        iconColor,
        undefined,
        false,
        false,
        rotation,
        Vector2(iconSize / 2, iconSize / 2)
      );

      const borderAlpha = isSelected ? 180 : isHovered ? 120 : 50;
      drawRect(centerXBtn - half, centerYBtn + half - 2, this.size, 2, {
        r: 255,
        g: 255,
        b: 255,
        a: borderAlpha,
      });

      if (isHovered) {
        let tooltip: string;
        if (button.submenu === "speed") {
          const label = (() => {
            switch (speedId) {
              case "speed075":
                return "x0.75";
              case "speed080":
                return "x0.80";
              case "speed087":
                return "x0.87";
              case "speed115":
                return "x1.15";
              case "speed125":
                return "x1.25";
              case "speed135":
                return "x1.35";
              case "speed145":
                return "x1.45";
              default:
                return "x1.00";
            }
          })();
          tooltip = `Speed ${label}`;
        } else {
          tooltip = button.mode.name;
        }
        const fontSize = 18;
        const padX = 8;
        const padY = 6;

        const size = measureText(tooltip, fontSize, 1);
        const boxW = size.width + padX * 2;
        const boxH = size.height + padY * 2;
        const boxX = centerXBtn - boxW / 2;
        const boxY = y - boxH - 8; 

        drawRect(boxX, boxY, boxW, boxH, { r: 0, g: 0, b: 0, a: 180 });

        drawRect(boxX, boxY + boxH - 2, boxW, 2, {
          r: 255,
          g: 255,
          b: 255,
          a: 120,
        });

        drawText(
          tooltip,
          Vector2(centerXBtn, boxY + padY),
          fontSize,
          { r: 255, g: 255, b: 255, a: 255 },
          "center"
        );
      }
    }

    if (pageCount > 1) {
      const label = `${this.currentPage + 1} / ${pageCount}`;
      const fontSize = 18;
      const textSize = measureText(label, fontSize, 1);
      const indicatorTop = y + this.size + 24;
      drawRect(
        centerX - textSize.width / 2 - 6,
        indicatorTop - 4,
        textSize.width + 12,
        textSize.height + 8,
        { r: 0, g: 0, b: 0, a: 120 }
      );
      drawText(
        label,
        Vector2(centerX, indicatorTop),
        fontSize,
        { r: 255, g: 255, b: 255, a: 220 },
        "center"
      );
    }
  }

  private drawButtonSet(
    buttonLayouts: ButtonLayout[],
    y: number,
    activeIds: string[],
    alphaFactor: number,
    dx: number
  ): void {
    for (const { button, globalIndex, x } of buttonLayouts) {
      const half = this.size / 2;
      const centerXBtn = x + dx + half;
      const centerYBtn = y + half;

      const isSelected =
        button.submenu === "speed"
          ? activeIds.some((id) => id.startsWith("speed"))
          : button.mode.id === "default"
          ? activeIds.length === 0
          : activeIds.includes(button.mode.id);

      const bgAlpha = (isSelected ? 60 : 12) * alphaFactor;
      drawRect(centerXBtn - half, centerYBtn - half, this.size, this.size, {
        r: 255,
        g: 255,
        b: 255,
        a: bgAlpha,
      });

      const padding = 14;
      const iconSize = this.size - padding;
      
      const speedId = activeIds.find((id) => id.startsWith("speed"));
      let iconPath = button.icon;
      if (button.submenu === "speed") {
        switch (speedId) {
          case "speed075":
            iconPath = "/mod_75.png";
            break;
          case "speed080":
            iconPath = "/mod_80.png";
            break;
          case "speed087":
            iconPath = "/mod_87.png";
            break;
          case "speed115":
            iconPath = "/mod_15.png";
            break;
          case "speed125":
            iconPath = "/mod_25.png";
            break;
          case "speed135":
            iconPath = "/mod_35.png";
            break;
          case "speed145":
            iconPath = "/mod_45.png";
            break;
          default:
            iconPath = "/mod_100.png";
        }
      }
      let iconAlpha = (isSelected ? 255 : 130) * alphaFactor;
      const iconColor = { r: 255, g: 255, b: 255, a: iconAlpha };
      const rotation = this.rotationAngles[globalIndex] ?? 0;
      drawSprite(
        iconPath,
        Vector2(centerXBtn, centerYBtn),
        Vector2(iconSize, iconSize),
        iconColor,
        undefined,
        false,
        false,
        rotation,
        Vector2(iconSize / 2, iconSize / 2)
      );

      const borderAlpha = (isSelected ? 180 : 50) * alphaFactor;
      drawRect(centerXBtn - half, centerYBtn + half - 2, this.size, 2, {
        r: 255,
        g: 255,
        b: 255,
        a: borderAlpha,
      });
    }
  }
}
