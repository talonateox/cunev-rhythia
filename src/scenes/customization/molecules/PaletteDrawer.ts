import {
  Vector2,
  Color,
  IsKeyPressed,
  KEY_ESCAPE,
  BeginScissorMode,
  EndScissorMode,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
} from "raylib";
import { ScrollableDrawer } from "../../menu/atoms/ScrollableDrawer";
import { GameButton } from "../atoms/GameButton";
import { drawText, measureText } from "../../../utils/text";
import { drawHLine } from "../../../ui/draw";
import { createPopup, Popup } from "../../menu/atoms/Popup";
import { noteColorManager } from "../../../utils/noteColorPalette";
import {
  importColorset,
  listCustomColorsets,
  removeColorsetByName,
} from "../../../utils/colorsets";
import { openDialog, openFolderDialog } from "nativefiledialog";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { ConfigManager } from "../../../utils/configManager";
import { clamp } from "../../../utils/lerp";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";
import { Rhythia } from "../../../atoms/Rhythia";
import { drawSprite } from "../../../utils/sprite";
import { createInputBox, InputBox } from "../../menu/atoms/InputBox";
import { GameObject } from "../../../atoms/Object";

interface PaletteButtonEntry {
  button: GameButton;
  name: string;
  isCustom: boolean;
  colors: Color[];
}

export class PaletteDrawer extends ScrollableDrawer {
  private scrollAreaTop: number = 140;
  private readonly scrollAreaBottomPadding: number = 20;
  private scrollContentStartY: number = this.scrollAreaTop + 56;
  private readonly scrollContentPadding: number = 40;
  private readonly scrollWheelStep: number = 80;

  private importButton: GameButton | null = null;
  private importFolderButton: GameButton | null = null;
  private removeButton: GameButton | null = null;
  private paletteButtons: PaletteButtonEntry[] = [];
  private selectedName: string = "";
  private onClose?: () => void;
  
  private searchInput: InputBox | null = null;
  private searchTerm: string = "";
  private readonly searchInputHeight: number = 42;
  private readonly searchGap: number = 12;
  private layoutUpdater: GameObject | null = null;

  constructor(options?: { onClose?: () => void }) {
    super(580);
    this.onClose = options?.onClose;
    try {
      this.selectedName = noteColorManager.getCurrentPalette().name || "";
    } catch {}
    this.initializeSearchInput();
    this.updateHeaderLayoutMetrics();
    this.layoutUpdater = new GameObject({
      zBase: 99,
      onUpdate: () => {
        this.updateSearchInputGeometry();
      },
    });
    this.rebuildUi();
  }

  public open(): void {
    super.open();
    this.setOverlayOpacity(0);
    this.setBackgroundOpacity(0.7);
  }

  protected onUpdate(): void {
    if (!this.isOpen || this.animationProgress < 0.5) return;
    if (IsKeyPressed(KEY_ESCAPE)) {
      this.close();
    }
    this.updateSearchInputGeometry();
  }

  private rebuildUi(): void {
    this.buildTopButtons();
    this.buildPaletteButtons();
    this.updateScrollBounds();
  }

  private buildTopButtons(): void {
    const leftMargin = 40;
    const rightMargin = 30;
    const gap = 16;
    const rowY = this.scrollContentStartY;
    const tileHeight = 56;
    const totalWidth = this.drawerWidth - leftMargin - rightMargin;
    const tileWidth = Math.floor((totalWidth - gap * 2) / 3);

    this.importButton = new GameButton({
      label: "Import",
      x: leftMargin,
      y: rowY,
      width: tileWidth,
      height: tileHeight,
      onClick: () => this.handleImport(),
    });

    this.importFolderButton = new GameButton({
      label: "Import Folder",
      x: leftMargin + tileWidth + gap,
      y: rowY,
      width: tileWidth,
      height: tileHeight,
      onClick: () => this.handleImportFolder(),
    });

    this.removeButton = new GameButton({
      label: "Remove Selected",
      x: leftMargin + (tileWidth + gap) * 2,
      y: rowY,
      width: tileWidth,
      height: tileHeight,
      onClick: () => this.handleRemove(),
    });

    const customs = listCustomColorsets();
    const isCustom = customs.some((c) => c.name === this.selectedName);
    this.removeButton.setDisabled(!isCustom);
  }

  private buildPaletteButtons(): void {
    const leftMargin = 40;
    const rightMargin = 30;
    const colGap = 16;
    const rowGap = 16;
    let tileHeight = 56;
    const startY = this.scrollContentStartY + 56 + 16; 
    const totalWidth = this.drawerWidth - leftMargin - rightMargin;
    const tileWidth = Math.floor((totalWidth - colGap * 2) / 3);
    tileHeight = tileWidth; 

    this.paletteButtons = [];
    const term = (this.searchTerm || "").trim().toLowerCase();
    const all = noteColorManager
      .getAllPalettes()
      .filter((p) => !term || p.name.toLowerCase().includes(term));
    const customs = listCustomColorsets();
    const customNames = new Set(customs.map((c) => c.name));

    all.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = leftMargin + col * (tileWidth + colGap);
      const y = startY + row * (tileHeight + rowGap);
      const isSelected = p.name === this.selectedName;
      const label = "";
      const entry: PaletteButtonEntry = {
        name: p.name,
        isCustom: customNames.has(p.name),
        colors: (p as any).colors || [],
        button: new GameButton({
          label,
          x,
          y,
          width: tileWidth,
          height: tileHeight,
          onClick: () => this.handleSelect(p.name),
          theme: isSelected
            ? { background: { default: { r: 70, g: 110, b: 140, a: 255 } } }
            : undefined,
        }),
      };
      this.paletteButtons.push(entry);
    });
  }

  private handleSelect(name: string): void {
    const all = noteColorManager.getAllPalettes();
    const match = all.find((p) => p.name === name);
    if (!match) return;
    noteColorManager.setCurrentPalette(match);
    this.selectedName = name;
    try {
      ConfigManager.update({ activeColorPaletteName: name } as any);
      ConfigManager.save();
    } catch {}
    const done = createPopup("info");
    done.show("Palette selected");
    setTimeout(() => {
      done.hide();
      done.destroy();
    }, 900);
    this.rebuildUi();
  }

  private getSearchCenterY(): number {
    const headerLineY = 70;
    return headerLineY + this.searchGap + this.searchInputHeight / 2;
  }

  private updateHeaderLayoutMetrics(): void {
    const searchBottom = this.getSearchCenterY() + this.searchInputHeight / 2;
    this.scrollAreaTop = Math.max(140, Math.round(searchBottom + 12));
    this.scrollContentStartY = this.scrollAreaTop + 56;
    this.updateScrollBounds();
  }

  private initializeSearchInput(): void {
    const width = this.drawerWidth - 40 - 30;
    const x = 40;
    const yCenter = this.getSearchCenterY();
    const initialX = (this.gameObject.rectArea?.pos.x ?? 0) + x;

    this.searchInput = createInputBox({
      position: Vector2(initialX, yCenter),
      width,
      height: this.searchInputHeight,
      placeholder: "Search palettes...",
      fontSize: 22,
      maxLength: 100,
      onValueChange: (term) => {
        const next = term.trim().toLowerCase();
        if (this.searchTerm !== next) {
          this.searchTerm = next;
          this.resetScrollState();
          this.buildPaletteButtons();
          this.updateScrollBounds();
        }
      },
      onEnter: () => {},
    });

    try {
      this.searchInput.getGameObject().zBase = 16;
      if (this.accentColor) this.searchInput.setAccentColor(this.accentColor);
    } catch {}
  }

  private updateSearchInputGeometry(): void {
    if (!this.searchInput) return;
    const width = this.drawerWidth - 40 - 30;
    const x = (this.gameObject.rectArea?.pos.x ?? 0) + 40;
    const y = this.getSearchCenterY();
    this.searchInput.setGeometry(Vector2(x, y), width, this.searchInputHeight);
  }

  private async handleImport(): Promise<void> {
    const popup = createPopup();
    try {
      popup.startLoading("Select a colorset (.txt)");
      const filePath: string = openDialog({ text: "txt" } as any);
      if (!filePath) {
        popup.endLoading();
        return;
      }
      const info = importColorset(filePath);
      popup.endLoading();
      if (!info) {
        const p = createPopup("error");
        p.show("Invalid colorset file");
        setTimeout(() => {
          p.hide();
          p.destroy();
        }, 1500);
        return;
      }
      try {
        const all = noteColorManager.getAllPalettes();
        const match = all.find((pl) => pl.name === info.name);
        if (match) {
          noteColorManager.setCurrentPalette(match);
          this.selectedName = match.name;
          ConfigManager.update({ activeColorPaletteName: match.name } as any);
          ConfigManager.save();
        }
      } catch {}
      this.rebuildUi();
      const done = createPopup("info");
      done.show(`Imported "${info.name}"`);
      setTimeout(() => {
        done.hide();
        done.destroy();
      }, 1200);
    } catch {
      try {
        popup.endLoading();
      } catch {}
      const p = createPopup("error");
      p.show("Import failed");
      setTimeout(() => {
        p.hide();
        p.destroy();
      }, 1500);
    }
  }

  private async handleImportFolder(): Promise<void> {
    const popup = createPopup();
    try {
      popup.startLoading("Select a folder...");
      const dir = openFolderDialog();
      if (!dir) {
        popup.endLoading();
        return;
      }
      popup.startLoading("Scanning folder...");
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => n.toLowerCase().endsWith(".txt"));
      if (files.length === 0) {
        popup.endLoading();
        const p = createPopup("error");
        p.show("No .txt files found");
        setTimeout(() => {
          p.hide();
          p.destroy();
        }, 1400);
        return;
      }
      let ok = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        popup.startLoading(`Importing ${i + 1}/${files.length}: ${file}`);
        try {
          const fp = path.join(dir, file);
          const res = importColorset(fp);
          if (res) ok++;
        } catch {}
      }
      popup.endLoading();
      this.rebuildUi();
      const done = createPopup("info");
      done.show(`Imported ${ok}/${files.length}`);
      setTimeout(() => {
        done.hide();
        done.destroy();
      }, 1400);
    } catch {
      try {
        popup.endLoading();
      } catch {}
      const p = createPopup("error");
      p.show("Import failed");
      setTimeout(() => {
        p.hide();
        p.destroy();
      }, 1500);
    }
  }

  private handleRemove(): void {
    const name = this.selectedName;
    const customs = listCustomColorsets();
    const isCustom = customs.some((c) => c.name === name);
    if (!isCustom) return;
    const confirm = new Popup("confirm");
    confirm.showConfirm({
      message: `Remove colorset "${name}"?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      onConfirm: () => {
        const ok = removeColorsetByName(name);
        if (ok) {
          try {
            const all = noteColorManager.getAllPalettes();
            const fallback = all[0];
            if (fallback) {
              noteColorManager.setCurrentPalette(fallback);
              this.selectedName = fallback.name;
              ConfigManager.update({
                activeColorPaletteName: fallback.name,
              } as any);
              ConfigManager.save();
            }
          } catch {}
          this.rebuildUi();
          const done = createPopup("info");
          done.show("Removed");
          setTimeout(() => {
            done.hide();
            done.destroy();
          }, 900);
        } else {
          const err = createPopup("error");
          err.show("Remove failed");
          setTimeout(() => {
            err.hide();
            err.destroy();
          }, 1200);
        }
      },
      onCancel: () => {},
    });
  }

  protected getScrollAreaTop(): number {
    return this.scrollAreaTop;
  }

  protected getScrollAreaBottomPadding(): number {
    return this.scrollAreaBottomPadding;
  }

  protected getScrollWheelStep(): number {
    return this.scrollWheelStep;
  }

  protected override updateScrollBounds(): void {
    let contentBottom = this.scrollContentStartY + 56 + 16; 
    this.paletteButtons.forEach(({ button }) => {
      const { y, height } = button.getConfig();
      contentBottom = Math.max(contentBottom, y + height);
    });
    const contentHeight = Math.max(
      0,
      contentBottom - this.scrollAreaTop + this.scrollContentPadding
    );
    const visibleHeight = this.getScrollAreaHeight();
    this.maxScrollOffset = Math.max(0, contentHeight - visibleHeight);
    this.targetScrollOffset = clamp(
      this.targetScrollOffset,
      0,
      this.maxScrollOffset
    );
    this.scrollOffset = clamp(this.scrollOffset, 0, this.maxScrollOffset);
  }

  protected drawContent(): void {
    const mousePos = this.gameObject.getMousePosition();
    this.updateScroll(mousePos);
    const adjusted = this.getScrollAdjustedMousePos(mousePos);
    this.importButton?.update(adjusted);
    this.importFolderButton?.update(adjusted);
    this.removeButton?.update(adjusted);
    this.paletteButtons.forEach((e) => {
      const cfg = e.button.getConfig();
      if (this.isContentRectVisible(cfg.y, cfg.height)) {
        e.button.update(adjusted);
      }
    });

    const scissorHeight = this.getScrollAreaHeight();
    const useScissor = scissorHeight > 0;
    if (useScissor) {
      try {
        const { viewport } = getPresentationInfo();
        const scaleX = viewport.width / Math.max(1, Rhythia.gameWidth);
        const scaleY = viewport.height / Math.max(1, Rhythia.gameHeight);
        const worldX = this.gameObject.rectArea?.pos.x ?? 0;
        const worldY = this.scrollAreaTop;
        const scissorX = Math.round(viewport.x + worldX * scaleX);
        const scissorY = Math.round(viewport.y + worldY * scaleY);
        const scissorWidth = Math.max(1, Math.round(this.drawerWidth * scaleX));
        const scissorHeightPx = Math.max(1, Math.round(scissorHeight * scaleY));
        BeginScissorMode(scissorX, scissorY, scissorWidth, scissorHeightPx);
      } catch {
        const scale = Rhythia.renderScale || 1;
        const fallbackX = Math.round(
          (this.gameObject.rectArea?.pos.x ?? 0) * scale
        );
        const fallbackY = Math.round(this.scrollAreaTop * scale);
        const fallbackW = Math.max(1, Math.round(this.drawerWidth * scale));
        const fallbackH = Math.max(1, Math.round(scissorHeight * scale));
        BeginScissorMode(fallbackX, fallbackY, fallbackW, fallbackH);
      }
    }

    rlPushMatrix();
    rlTranslatef(0, -this.scrollOffset, 0);

    
    const headerY = this.scrollAreaTop + 6;
    const color = {
      r: 210,
      g: 215,
      b: 230,
      a: Math.round(255 * this.animationProgress),
    } as Color;
    drawText("Palettes", Vector2(40, headerY), 24, color, "left");
    const lineColor = {
      r: 80,
      g: 90,
      b: 110,
      a: Math.round(200 * this.animationProgress),
    } as Color;
    drawHLine(40, headerY + 30, this.drawerWidth - 80, lineColor, 2);

    const opacity = this.animationProgress;
    const renderIfVisible = (btn: GameButton | null) => {
      if (!btn) return;
      const cfg = btn.getConfig();
      if (this.isContentRectVisible(cfg.y, cfg.height)) btn.render(opacity);
    };
    renderIfVisible(this.importButton);
    renderIfVisible(this.importFolderButton);
    renderIfVisible(this.removeButton);
    this.paletteButtons.forEach((e) => {
      const cfg = e.button.getConfig();
      if (this.isContentRectVisible(cfg.y, cfg.height)) {
        e.button.render(opacity);
        this.renderPaletteGrid(e);
        this.renderPaletteLabel(e);
      }
    });

    rlPopMatrix();
    if (useScissor) EndScissorMode();
    this.renderScrollbar();
  }

  protected onDrawerClick(mousePos: Vector2 | null): boolean {
    if (mousePos && this.searchInput) {
      const drawerX = this.gameObject.rectArea?.pos.x ?? 0;
      const left = drawerX + 40;
      const width = this.drawerWidth - 40 - 30;
      const centerY = this.getSearchCenterY();
      const top = centerY - this.searchInputHeight / 2;
      const bottom = centerY + this.searchInputHeight / 2;
      const insideSearch =
        mousePos.x >= left &&
        mousePos.x <= left + width &&
        mousePos.y >= top &&
        mousePos.y <= bottom;
      if (insideSearch) {
        try {
          this.searchInput.focus();
        } catch {}
        return true;
      }
    }
    return true;
  }

  private isContentRectVisible(y: number, height: number): boolean {
    const areaTop = this.scrollAreaTop;
    const areaBottom = areaTop + this.getScrollAreaHeight();
    const topAfterScroll = y - this.scrollOffset;
    const bottomAfterScroll = topAfterScroll + height;
    return bottomAfterScroll >= areaTop && topAfterScroll <= areaBottom;
  }

  private renderPaletteGrid(entry: PaletteButtonEntry): void {
    const { button, colors } = entry;
    if (!colors || colors.length === 0) return;
    const { x, y, width, height } = button.getConfig();
    const pad = 6;
    const gap = 2;
    const labelFontSize = 16;
    const labelYOffset = labelFontSize + 4; 
    const cols = Math.max(1, Math.ceil(Math.sqrt(colors.length)));
    const rows = Math.max(1, Math.ceil(colors.length / cols));
    const cellW = Math.max(
      1,
      Math.floor((width - pad * 2 - gap * (cols - 1)) / cols)
    );
    const cellH = Math.max(
      1,
      Math.floor((height - pad * 2 - labelYOffset - gap * (rows - 1)) / rows)
    );
    const cellSize = Math.min(cellW, cellH);
    for (let i = 0; i < colors.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (row >= rows) break;
      const cx = x + pad + col * (cellSize + gap);
      const cy = y + pad + labelYOffset + row * (cellSize + gap);
      const c = colors[i];
      drawSprite(
        "/square.png",
        Vector2(cx, cy),
        Vector2(cellSize, cellSize),
        c as any
      );
    }
  }

  private renderPaletteLabel(entry: PaletteButtonEntry): void {
    const { button, name } = entry;
    const { x, y, width } = button.getConfig();
    const pad = 6;
    const fontSize = 16;
    const maxWidth = Math.max(1, width - pad * 2);
    const text = this.trimTextToWidth(name, maxWidth, fontSize);
    const color = { r: 235, g: 240, b: 245, a: 240 } as Color;
    drawText(text, Vector2(x + pad, y + 4), fontSize, color, "left");
  }

  private trimTextToWidth(
    text: string,
    maxWidth: number,
    fontSize: number
  ): string {
    if (!text) return "";
    if (measureText(text, fontSize, 1).width <= maxWidth) return text;
    const ell = "…";
    let lo = 0;
    let hi = text.length;
    let best = "";
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = text.slice(0, Math.max(0, mid)) + ell;
      const w = measureText(candidate, fontSize, 1).width;
      if (w <= maxWidth) {
        best = candidate;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best || ell;
  }

  protected getHeaderText(): string {
    return "Colors";
  }

  public close(): void {
    super.close();
    this.onClose?.();
  }

  public destroy(): void {
    try {
      this.searchInput?.destroy();
    } catch {}
    this.searchInput = null;
    try {
      this.layoutUpdater?.destroy();
    } catch {}
    this.layoutUpdater = null;
    super.destroy();
  }
}
