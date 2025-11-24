import { Vector2 } from "raylib";
import { GameObject } from "../../../../atoms/Object";
import { Rhythia } from "../../../../atoms/Rhythia";
import { drawSprite } from "../../../../utils/sprite";
import { drawText, measureText } from "../../../../utils/text";
import { lerpDelta } from "../../../../utils/lerp";
import { AccentColor } from "../../../../utils/imageBlur";
import { tintWithAccent } from "../../../../utils/colors";

type SpeedItem = { id: string; label: string };

interface SpeedContextMenuOptions {
  items: SpeedItem[];
  onSelect: (id: string) => void;
}

export class SpeedContextMenu {
  private overlay: GameObject;
  private isOpen = false;
  private animProgress = 0;
  private menuRect: { x: number; y: number; w: number; h: number } | null = null;
  private items: Array<SpeedItem & { rect: { x: number; y: number; w: number; h: number } | null; hovered: boolean }>; 
  private anchor: { x: number; y: number; size: number } | null = null;
  private anchorRect: { x: number; y: number; w: number; h: number } | null = null;
  private onSelect: (id: string) => void;
  private accentColor: AccentColor | null = null;

  constructor(opts: SpeedContextMenuOptions) {
    this.items = opts.items.map((i) => ({ ...i, rect: null, hovered: false }));
    this.onSelect = opts.onSelect;
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
          this.onSelect(hovered.id);
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
        for (const it of this.items) { it.rect = null; it.hovered = false; }
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

  public openAt(x: number, y: number, size: number): void {
    this.anchor = { x, y, size };
    this.anchorRect = null;
    this.toggle(true);
  }

  
  
  public openAtRect(x: number, y: number, w: number, h: number): void {
    this.anchor = null;
    this.anchorRect = { x, y, w, h };
    this.toggle(true);
  }

  private toggle(state: boolean): void { this.isOpen = state; }

  public isOpenOrAnimating(): boolean { return this.isOpen || this.animProgress > 0.01; }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  private drawContextMenu(): void {
    if (!this.anchor && !this.anchorRect) return;

    
    const anchorX = this.anchorRect ? this.anchorRect.x : (this.anchor!.x);
    const anchorYTop = this.anchorRect ? this.anchorRect.y : (this.anchor!.y);
    const anchorW = this.anchorRect ? this.anchorRect.w : (this.anchor!.size);
    const anchorH = this.anchorRect ? this.anchorRect.h : (this.anchor!.size);
    const anchorY = anchorYTop + anchorH + 6;

    const fontSize = 20;
    const padX = 14;
    const padY = 10;
    const measured = this.items.map((it) => {
      const m = measureText(it.label, fontSize, 1);
      return { w: m.width, h: m.height };
    });
    
    const measuredMax = Math.max(200, ...measured.map((m) => m.w + padX * 2));
    const menuWidth = this.anchorRect ? Math.max(anchorW, measuredMax) : measuredMax;
    const itemHeights = measured.map((m) => m.h + padY * 2);
    const menuHeight = itemHeights.reduce((a, h) => a + h, 0);

    let panelX = this.anchorRect ? anchorX : (anchorX + Math.round(anchorW / 2) - Math.round(menuWidth / 2));
    const rightPadding = 12;
    if (panelX + menuWidth > Rhythia.gameWidth - rightPadding) panelX = Rhythia.gameWidth - rightPadding - menuWidth;
    if (panelX < rightPadding) panelX = rightPadding;
    let panelY = anchorY;
    const bottomPadding = 12;
    if (panelY + menuHeight > Rhythia.gameHeight - bottomPadding) {
      const aboveY = anchorYTop - menuHeight - 8;
      panelY = Math.max(8, aboveY);
    }

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

export type { SpeedItem };
