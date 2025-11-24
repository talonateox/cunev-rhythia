import { Vector2 } from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText, measureText } from "../../../utils/text";
import { Rhythia } from "../../../atoms/Rhythia";
import { AccentColor } from "../../../utils/imageBlur";
import { tintWithAccent, accentWithHover } from "../../../utils/colors";
import { lerpDelta } from "../../../utils/lerp";

export type ContextMenuItemId =
  | "import_sspm"
  | "import_folder"
  | "export_current"
  | "replace_audio"
  | "redownload_map"
  | "delete_current"
  | "open_game_folder"
  | "exit_game";

export interface TopContextMenuCallbacks {
  onImportFromSSPM: () => void;
  onImportFolder: () => void;
  onExportCurrentMap: () => void;
  onReplaceCurrentAudio: () => void;
  onRedownloadMap: () => void;
  onDeleteCurrentMap: () => void;
  onOpenGameFolder: () => void;
  onExitGame: () => void;
}

export class TopContextMenu {
  private overlay: GameObject;
  private buttonX: number = 0;
  private barHeight: number = 70;
  private accentColor: AccentColor | null = null;

  private isOpen = false;
  private animProgress = 0;
  private menuRect: { x: number; y: number; w: number; h: number } | null = null;
  private isHovered = false;
  private hoverProgress = 0;

  private callbacks: TopContextMenuCallbacks;

  private items: Array<{
    id: ContextMenuItemId;
    label: string;
    rect: { x: number; y: number; w: number; h: number } | null;
    hovered: boolean;
  }> = [
    { id: "import_sspm", label: "Import .sspm File", rect: null, hovered: false },
    { id: "import_folder", label: "Import Map Folder", rect: null, hovered: false },
    { id: "export_current", label: "Export Current Map", rect: null, hovered: false },
    { id: "replace_audio", label: "Replace current beatmap audio", rect: null, hovered: false },
    { id: "redownload_map", label: "Redownload map", rect: null, hovered: false },
    { id: "delete_current", label: "Delete Current Map", rect: null, hovered: false },
    { id: "open_game_folder", label: "Open Game Folder", rect: null, hovered: false },
    { id: "exit_game", label: "Exit Game", rect: null, hovered: false },
  ];

  constructor(callbacks: TopContextMenuCallbacks) {
    this.callbacks = callbacks;
    this.overlay = new GameObject({ zBase: 20 });
    this.overlay.attachRect({
      pos: { x: 0, y: 0 },
      size: { x: Rhythia.gameWidth, y: Rhythia.gameHeight },
      onClick: () => {
        if (!this.isOpen && this.animProgress < 0.01) return false;
        const mousePos = this.overlay.getMousePosition();
        if (!mousePos) return false;
        const inside = this.menuRect &&
          mousePos.x >= this.menuRect.x &&
          mousePos.x <= this.menuRect.x + this.menuRect.w &&
          mousePos.y >= this.menuRect.y &&
          mousePos.y <= this.menuRect.y + this.menuRect.h;
        if (!inside) {
          this.toggle(false);
          return true;
        }
        const hovered = this.items.find((i) => i.hovered && i.rect);
        if (hovered) {
          switch (hovered.id) {
            case "import_sspm":
              this.callbacks.onImportFromSSPM();
              break;
            case "import_folder":
              this.callbacks.onImportFolder();
              break;
            case "export_current":
              this.callbacks.onExportCurrentMap();
              break;
            case "delete_current":
              this.callbacks.onDeleteCurrentMap();
              break;
            case "replace_audio":
              this.callbacks.onReplaceCurrentAudio();
              break;
            case "redownload_map":
              this.callbacks.onRedownloadMap();
              break;
            case "open_game_folder":
              this.callbacks.onOpenGameFolder();
              break;
            case "exit_game":
              this.callbacks.onExitGame();
              break;
          }
          this.toggle(false);
          return true;
        }
        return true;
      },
    });

    this.overlay.onDraw = () => {
      if (this.animProgress <= 0.01) return;
      this.drawContextMenu();
    };

    this.overlay.onUpdate = () => {
      
      this.animProgress = lerpDelta(this.animProgress, this.isOpen ? 1 : 0, 0.25);
      if (!this.isOpen && this.animProgress < 0.02) {
        this.menuRect = null;
        for (const it of this.items) {
          it.rect = null; it.hovered = false;
        }
      }
      if (this.animProgress <= 0.01) return;
      const mousePos = this.overlay.getMousePosition();
      for (const it of this.items) {
        if (!it.rect || !mousePos) { it.hovered = false; continue; }
        const r = it.rect;
        it.hovered = mousePos.x >= r.x && mousePos.x <= r.x + r.w && mousePos.y >= r.y && mousePos.y <= r.y + r.h;
      }
    };
  }

  public setButtonX(x: number): void { this.buttonX = x; }
  public setBarHeight(h: number): void { this.barHeight = h; }
  public setAccentColor(c: AccentColor | null): void { this.accentColor = c; }

  public updateHover(mousePos: Vector2 | null): void {
    const iconSize = 32;
    const hovered = !!(mousePos && mousePos.y >= 0 && mousePos.y <= this.barHeight && mousePos.x >= this.buttonX && mousePos.x <= this.buttonX + iconSize);
    this.isHovered = hovered;
    this.hoverProgress = lerpDelta(this.hoverProgress, hovered ? 1 : 0, 0.2);
  }

  public handleTopBarClick(mousePos: Vector2 | null): boolean {
    if (!mousePos) return false;
    const iconSize = 32;
    if (mousePos.y <= this.barHeight && mousePos.x >= this.buttonX && mousePos.x <= this.buttonX + iconSize) {
      this.toggle(!this.isOpen);
      return true;
    }
    return false;
  }

  public drawTopBarButton(): void {
    const iconSize = 32;
    const buttonY = (this.barHeight - iconSize) / 2;
    const color = accentWithHover(
      { r: 180, g: 180, b: 180 },
      this.accentColor,
      0.3,
      this.hoverProgress
    );
    const dotSize = 4;
    const gap = 6;
    const centerX = this.buttonX + iconSize / 2 - dotSize / 2;
    const centerY = buttonY + iconSize / 2 - dotSize / 2;

    drawSprite("/solid.png", Vector2(centerX, centerY - gap - dotSize), Vector2(dotSize, dotSize), color);
    drawSprite("/solid.png", Vector2(centerX, centerY), Vector2(dotSize, dotSize), color);
    drawSprite("/solid.png", Vector2(centerX, centerY + gap + dotSize), Vector2(dotSize, dotSize), color);

    
  }

  public isOpenOrAnimating(): boolean { return this.isOpen || this.animProgress > 0.01; }

  private toggle(state: boolean): void { this.isOpen = state; }

  private drawContextMenu(): void {
    const iconSize = 32;
    const anchorX = this.buttonX + iconSize - 4;
    const anchorY = this.barHeight + 2;

    const fontSize = 20;
    const padX = 14;
    const padY = 10;
    const measured = this.items.map((it) => {
      const m = measureText(it.label, fontSize, 1);
      return { w: m.width, h: m.height };
    });
    const menuWidth = Math.max(220, ...measured.map((m) => m.w + padX * 2));
    const itemHeights = measured.map((m) => m.h + padY * 2);
    const menuHeight = itemHeights.reduce((a, h) => a + h, 0);

    let panelX = anchorX - menuWidth;
    const rightPadding = 12;
    if (panelX + menuWidth > Rhythia.gameWidth - rightPadding) panelX = Rhythia.gameWidth - rightPadding - menuWidth;
    if (panelX < rightPadding) panelX = rightPadding;
    let panelY = anchorY;
    const bottomPadding = 12;
    if (panelY + menuHeight > Rhythia.gameHeight - bottomPadding) panelY = Math.max(8, this.barHeight - menuHeight - 8);

    const ease = this.animProgress;
    const slideOffset = (1 - ease) * -10;
    const panelYAnim = panelY + slideOffset;
    this.menuRect = { x: panelX, y: panelYAnim, w: menuWidth, h: menuHeight };

    const baseBg = { r: 15, g: 15, b: 20 };
    const baseBorder = { r: 255, g: 255, b: 255 };
    const bgColor = { ...tintWithAccent(baseBg, this.accentColor, 0.25), a: Math.round(245 * ease) } as any;
    const borderColor = { ...tintWithAccent(baseBorder, this.accentColor, 0.4), a: Math.round(90 * ease) } as any;

    drawSprite("/solid.png", Vector2(panelX, panelYAnim), Vector2(menuWidth, menuHeight), bgColor);
    drawSprite("/solid.png", Vector2(panelX, panelYAnim + menuHeight - 2), Vector2(menuWidth, 2), borderColor);

    let currentY = panelYAnim;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const h = itemHeights[i];
      const rect = { x: panelX, y: currentY, w: menuWidth, h };
      item.rect = rect;
      if (item.hovered) {
        const hoverBg = tintWithAccent({ r: 255, g: 255, b: 255 }, this.accentColor, 0.6);
        drawSprite("/solid.png", Vector2(rect.x, rect.y), Vector2(rect.w, rect.h), { ...hoverBg, a: 25 });
      }
      const textX = rect.x + Math.round(rect.w / 2);
      const textY = rect.y + Math.round((rect.h - fontSize) / 2);
      const baseText = item.hovered ? { r: 255, g: 255, b: 255, a: 255 } : { r: 220, g: 220, b: 220, a: 255 };
      const textColor = { ...baseText, a: Math.round(baseText.a * ease) } as any;
      drawText(item.label, Vector2(textX, textY), fontSize, textColor, "center");
      if (i < this.items.length - 1) {
        drawSprite("/solid.png", Vector2(rect.x, rect.y + rect.h - 1), Vector2(rect.w, 1), { r: 255, g: 255, b: 255, a: Math.round(22 * ease) });
      }
      currentY += h;
    }
  }
}

export function createTopContextMenu(callbacks: TopContextMenuCallbacks): TopContextMenu {
  return new TopContextMenu(callbacks);
}

