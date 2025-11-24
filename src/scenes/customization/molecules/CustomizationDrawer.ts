import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
  rlScalef,
  BeginScissorMode,
  EndScissorMode,
  Color,
  IsMouseButtonDown,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
  IsKeyPressed,
  KEY_ESCAPE,
} from "raylib";
import { ScrollableDrawer } from "../../menu/atoms/ScrollableDrawer";
import { ConfigManager } from "../../../utils/configManager";
import {
  GAME_SETTINGS_SCHEMA,
  CUSTOMIZATION_INVENTORY_ITEMS,
  toGameConfigKey,
  getSettingsByItem,
} from "../../../utils/gameSettingsSchema";
import type {
  GameSettingKey,
  GameSettings,
  CustomizationInventoryItem,
} from "../../../utils/gameSettingsSchema";
import { GameButton } from "../atoms/GameButton";
import { GameSlider } from "../atoms/GameSlider";
import { drawText } from "../../../utils/text";
import { drawHLine } from "../../../ui/draw";
import { playFx } from "../../../utils/soundManager";
import { VolumeKnob } from "../../menu/atoms/VolumeKnob";
import { Rhythia } from "../../../atoms/Rhythia";
import { clamp, lerp } from "../../../utils/lerp";
import { createTween, cancelTween, easings } from "../../../utils/tween";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";
import { Popup } from "../../menu/atoms/Popup";
import { SpeedContextMenu } from "../../menu/molecules/musicplayer/SpeedContextMenu";
import { GameObject } from "../../../atoms/Object";
import { createInputBox, InputBox } from "../../menu/atoms/InputBox";
import {
  createInventoryButtonTheme,
  renderInventoryTileContent,
} from "../shared/inventory";
import { partitionForMainDrawer } from "../shared/groups";

export const CUSTOMIZATION_DRAWER_WIDTH = 580;

export class CustomizationDrawer extends ScrollableDrawer {
  private itemButtons: Array<{
    button: GameButton;
    item: CustomizationInventoryItem;
  }> = [];
  private volumeKnobs: VolumeKnob[] = [];
  
  private scrollAreaTop: number = 140;
  private readonly scrollAreaBottomPadding: number = 20;
  private scrollContentStartY: number = 180;
  private readonly scrollContentPadding: number = 40;
  private readonly scrollWheelStep: number = 80;

  private readonly hoverScale: number = 1.02;
  private readonly hoverRotation: number = 2;
  private readonly hoverTweenDuration: number = 0.18;
  private itemHoverStates: Map<string, { progress: number; target: number }> =
    new Map();

  private sectionHeaders: Array<{ label: string; y: number }> = [];
  private contentBottomHint: number = 0;

  private onItemSelected?: (item: CustomizationInventoryItem) => void;
  private onClose?: () => void;

  private searchInput: InputBox | null = null;
  private searchTerm: string = "";
  private readonly profileRowTop: number = 86;
  private readonly profileRowHeight: number = 36;
  private readonly searchInputHeight: number = 42;
  private readonly searchGap: number = 12;
  private layoutUpdater: GameObject | null = null;

  private flattenMode: boolean = false;
  private flattenedSections: Array<{
    itemId: string;
    itemLabel: string;
    headerY: number;
    sliders: Array<{ settingKey: string; slider: GameSlider }>;
  }> = [];

  
  private profileItems: Array<{ id: string; label: string }> = [];
  private selectedProfileId: string = "default";
  private profileMenu: SpeedContextMenu | null = null;
  private profileSelectButton: GameButton | null = null;
  private profileAddButton: GameButton | null = null;
  private profileRemoveButton: GameButton | null = null;
  private awaitMouseUp: boolean = false;

  constructor(options?: {
    onItemSelected?: (item: CustomizationInventoryItem) => void;
    onClose?: () => void;
  }) {
    super(CUSTOMIZATION_DRAWER_WIDTH);
    this.onItemSelected = options?.onItemSelected;
    this.onClose = options?.onClose;

    this.syncProfilesFromConfig();
    this.initializeProfilesUi();
    this.initializeSearchInput();
    this.updateHeaderLayoutMetrics();
    this.layoutUpdater = new GameObject({
      zBase: 99,
      onUpdate: () => {
        this.updateSearchInputGeometry();
      },
    });
    this.initializeItemButtons();
    this.updateScrollBounds();
    this.initializeVolumeKnobs();
  }

  protected onUpdate(): void {
    
    if (!this.isOpen || this.animationProgress < 0.5) return;
    
    if (IsKeyPressed(KEY_ESCAPE)) {
      this.close();
    }
  }

  private initializeProfilesUi(): void {
    this.rebuildProfilesMenu();
    this.createOrUpdateProfileButtons();
  }

  private rebuildProfilesMenu(): void {
    this.profileMenu = new SpeedContextMenu({
      items: this.profileItems.slice(),
      onSelect: (pid) => {
        ConfigManager.applyProfile(pid);
        this.selectedProfileId = pid;
        this.refreshActiveCategory();
        this.createOrUpdateProfileButtons();
      },
    });
    try {
      this.profileMenu.setAccentColor(this.accentColor ?? null);
    } catch {}
  }

  private getSelectedProfileLabel(): string {
    const found = this.profileItems.find(
      (p) => p.id === this.selectedProfileId
    );
    return found?.label ?? "Default";
  }

  private createOrUpdateProfileButtons(): void {
    const leftMargin = 40;
    const rightMargin = 30;
    const rowTop = this.profileRowTop; 
    const rowHeight = this.profileRowHeight;
    const gap = 10;
    const addBtnWidth = 40;
    const removeBtnWidth = 40;
    const selectWidth =
      this.drawerWidth -
      leftMargin -
      rightMargin -
      addBtnWidth -
      removeBtnWidth -
      gap * 2;

    const selectX = leftMargin;
    const addX = leftMargin + selectWidth + gap;
    const removeX = addX + addBtnWidth + gap;

    this.profileSelectButton = new GameButton({
      label: this.getSelectedProfileLabel(),
      x: selectX,
      y: rowTop,
      width: selectWidth,
      height: rowHeight,
      onClick: () =>
        this.openProfilesMenuAt(selectX, rowTop, selectWidth, rowHeight),
      theme: {
        background: { default: { r: 55, g: 55, b: 65, a: 255 } },
        border: { default: { r: 90, g: 100, b: 120, a: 255 } },
      },
    });

    this.profileAddButton = new GameButton({
      label: "+",
      x: addX,
      y: rowTop,
      width: addBtnWidth,
      height: rowHeight,
      onClick: () => this.promptNewProfileName(),
      theme: {
        background: { default: { r: 55, g: 65, b: 75, a: 255 } },
        border: { default: { r: 110, g: 140, b: 160, a: 255 } },
        text: { default: { r: 245, g: 245, b: 245, a: 255 } },
      },
    });

    this.profileRemoveButton = new GameButton({
      label: "-",
      x: removeX,
      y: rowTop,
      width: removeBtnWidth,
      height: rowHeight,
      onClick: () => this.promptRemoveProfileConfirm(),
      theme: {
        background: { default: { r: 55, g: 55, b: 60, a: 255 } },
        border: { default: { r: 120, g: 80, b: 80, a: 255 } },
        text: { default: { r: 255, g: 230, b: 230, a: 255 } },
      },
    });
    this.profileRemoveButton.setDisabled(this.selectedProfileId === "default");
  }

  private openProfilesMenuAt(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.profileMenu) return;
    const drawerX = this.gameObject.rectArea?.pos.x ?? 0;
    this.profileMenu.openAtRect(drawerX + x, y, width, height);
  }

  public armUntilMouseRelease(): void {
    this.awaitMouseUp = true;
  }

  private getSearchCenterY(): number {
    return (
      this.profileRowTop +
      this.profileRowHeight +
      this.searchGap +
      this.searchInputHeight / 2
    );
  }

  private updateHeaderLayoutMetrics(): void {
    const searchBottom = this.getSearchCenterY() + this.searchInputHeight / 2;
    this.scrollAreaTop = Math.max(140, Math.round(searchBottom + 12));
    this.scrollContentStartY = this.scrollAreaTop + 40;
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
      placeholder: "Search settings...",
      fontSize: 22,
      maxLength: 100,
      onValueChange: (term) => {
        const next = term.trim().toLowerCase();
        if (this.searchTerm !== next) {
          this.searchTerm = next;
          this.refreshActiveCategory();
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

  private promptNewProfileName(): void {
    const popup = new Popup("prompt");
    try {
      popup.setAccentColor(this.accentColor ?? null);
    } catch {}
    popup.showPrompt({
      message: "New profile name",
      placeholder: "Type a name",
      initialValue: "",
      confirmText: "Create",
      cancelText: "Cancel",
      maxLength: 64,
      onConfirm: (name) => this.handleCreateProfile(name),
      onCancel: () => {},
    });
  }

  private handleCreateProfile(name: string): void {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const id = ConfigManager.createProfile(trimmed);
    this.syncProfilesFromConfig();
    this.selectedProfileId = id;
    this.rebuildProfilesMenu();
    this.createOrUpdateProfileButtons();
    this.refreshActiveCategory();
  }

  private promptRemoveProfileConfirm(): void {
    if (this.selectedProfileId === "default") return;
    const profileLabel = this.getSelectedProfileLabel();
    const message = `Remove profile "${profileLabel}"?`;
    const popup = new Popup("confirm");
    try {
      popup.setAccentColor(this.accentColor ?? null);
    } catch {}
    popup.showConfirm({
      message,
      confirmText: "Remove",
      cancelText: "Cancel",
      onConfirm: () => this.handleRemoveProfile(),
      onCancel: () => {},
    });
  }

  private handleRemoveProfile(): void {
    if (this.selectedProfileId === "default") return;
    ConfigManager.removeProfile(this.selectedProfileId);
    this.syncProfilesFromConfig();
    this.selectedProfileId = ConfigManager.getActiveProfileId();
    this.rebuildProfilesMenu();
    this.createOrUpdateProfileButtons();
    this.refreshActiveCategory();
  }

  private syncProfilesFromConfig(): void {
    try {
      const list = ConfigManager.getProfiles();
      this.profileItems = list.map((p) => ({ id: p.id, label: p.name }));
      this.selectedProfileId = ConfigManager.getActiveProfileId();
      if (!this.profileItems.some((p) => p.id === "default")) {
        this.profileItems.unshift({ id: "default", label: "Default" });
      }
    } catch {
      this.profileItems = [{ id: "default", label: "Default" }];
      this.selectedProfileId = "default";
    }
  }

  private initializeItemButtons(): void {
    if (this.searchTerm && this.searchTerm.trim().length > 0) {
      this.buildFlattenedSettings();
      return;
    }

    const leftMargin = 40;
    const rightMargin = 30;
    const columnCount = 2;
    const columnSpacing = 18;
    const rowSpacing = 24;
    const itemSize =
      (this.drawerWidth - leftMargin - rightMargin - columnSpacing) /
      columnCount;

    this.resetHoverAnimations();
    this.itemButtons = [];
    this.sectionHeaders = [];

    let currentY = this.scrollContentStartY;
    const headerHeight = 32;
    const headerSpacing = 22;

    const sections = partitionForMainDrawer(this.searchTerm);
    sections.forEach(({ label, items }) => {
      if (items.length === 0) return;
      this.sectionHeaders.push({ label, y: currentY });
      currentY += headerHeight + headerSpacing;

      items.forEach((item, index) => {
        const column = index % columnCount;
        const row = Math.floor(index / columnCount);
        const x = leftMargin + column * (itemSize + columnSpacing);
        const y = currentY + row * (itemSize + rowSpacing);
        const button = new GameButton({
          label: "",
          x,
          y,
          width: itemSize,
          height: itemSize,
          theme: createInventoryButtonTheme(item.rarity),
          onClick: () => this.handleItemSelection(item),
        });
        this.itemButtons.push({ button, item });
        this.ensureHoverState(item.id);
      });

      const rows = Math.ceil(items.length / columnCount);
      if (rows > 0) {
        const sectionBottom =
          currentY + (rows - 1) * (itemSize + rowSpacing) + itemSize;
        currentY = sectionBottom + 30;
      }
    });

    this.contentBottomHint = currentY;
  }

  private buildFlattenedSettings(): void {
    const leftMargin = 40;
    const rightMargin = 90; 
    const sliderWidth = this.drawerWidth - leftMargin - rightMargin;
    const sliderSpacing = 70;

    this.flattenMode = true;
    this.itemButtons = [];
    this.sectionHeaders = [];
    this.flattenedSections = [];

    const term = this.searchTerm.trim().toLowerCase();
    let currentY = this.scrollContentStartY;
    const headerHeight = 32;
    const headerSpacing = 40;

    for (const item of CUSTOMIZATION_INVENTORY_ITEMS) {
      const defs = getSettingsByItem(item.settingsCategory as any);
      const matching = defs.filter(
        (d) =>
          d.label?.toLowerCase().includes(term) ||
          d.key?.toLowerCase().includes(term)
      );

      if (matching.length === 0) continue;

      this.sectionHeaders.push({ label: item.name, y: currentY });
      const headerY = currentY;
      currentY += headerHeight + headerSpacing;

      const sliders: Array<{ settingKey: string; slider: GameSlider }> = [];

      for (const setting of matching) {
        const configKey = toGameConfigKey(setting.key as GameSettingKey);
        const config = ConfigManager.get();
        const value = (config[configKey] as number) ?? setting.defaultValue;
        const y = currentY;
        const slider = new GameSlider({
          label: setting.label,
          value,
          min: setting.min,
          max: setting.max,
          step: setting.step,
          x: leftMargin,
          y,
          width: sliderWidth,
          onChange: (newValue) => {
            ConfigManager.update({ [configKey]: newValue } as any);
          },
        });
        sliders.push({ settingKey: setting.key, slider });
        currentY += sliderSpacing;
      }

      this.flattenedSections.push({
        itemId: item.settingsCategory,
        itemLabel: item.name,
        headerY,
        sliders,
      });

      currentY += 10; 
    }

    this.contentBottomHint = currentY;
  }

  private getHoverTweenId(itemId: string): string {
    return `customization-hover-${itemId}`;
  }

  private ensureHoverState(itemId: string): {
    progress: number;
    target: number;
  } {
    let state = this.itemHoverStates.get(itemId);
    if (!state) {
      state = { progress: 0, target: 0 };
      this.itemHoverStates.set(itemId, state);
    }
    return state;
  }

  private resetHoverAnimations(): void {
    this.itemHoverStates.forEach((_, itemId) => {
      cancelTween(this.getHoverTweenId(itemId));
    });
    this.itemHoverStates.clear();
  }

  private updateHoverAnimation(
    button: GameButton,
    item: CustomizationInventoryItem
  ): void {
    const state = this.ensureHoverState(item.id);
    const target = button.isHovered() ? 1 : 0;

    if (state.target === target) {
      return;
    }

    state.target = target;
    const tweenId = this.getHoverTweenId(item.id);
    createTween(
      tweenId,
      state.progress,
      target,
      this.hoverTweenDuration,
      (value) => {
        state.progress = value;
      },
      easings.easeInOutSine
    );
  }

  private initializeVolumeKnobs(): void {
    const rightMargin = 80;
    const spacing = 120;
    const volumeTypes: Array<"master" | "music" | "fx"> = [
      "master",
      "music",
      "fx",
    ];

    const totalHeight = (volumeTypes.length - 1) * spacing;
    const baseY = (Rhythia.gameHeight - totalHeight) / 2;

    volumeTypes.forEach((volumeType, index) => {
      const knobX = Rhythia.gameWidth - rightMargin;
      const knobY = baseY + index * spacing;

      const volumeKnob = new VolumeKnob(
        { x: knobX, y: knobY },
        volumeType,
        "small",
        "right"
      );

      this.volumeKnobs.push(volumeKnob);
    });
  }

  private handleItemSelection(item: CustomizationInventoryItem): void {
    playFx("/click.wav", 0.3);
    this.hideForItemDrawer();
    this.onItemSelected?.(item);
  }

  private renderInventoryTile(
    entry: {
      button: GameButton;
      item: CustomizationInventoryItem;
    },
    opacity: number
  ): void {
    const { button, item } = entry;
    const { x, y, width, height } = button.getConfig();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const hoverState = this.ensureHoverState(item.id);
    const progress = clamp(hoverState.progress, 0, 1);
    const scale = lerp(1, this.hoverScale, progress);
    const rotation = lerp(0, this.hoverRotation, progress);

    rlPushMatrix();
    rlTranslatef(centerX, centerY, 0);
    if (Math.abs(rotation) > 0.001) {
      rlRotatef(rotation, 0, 0, 1);
    }
    if (Math.abs(scale - 1) > 0.001) {
      rlScalef(scale, scale, 1);
    }
    rlTranslatef(-centerX, -centerY, 0);

    button.render(opacity);
    renderInventoryTileContent(item, { x, y, width, height }, opacity);

    const iconSize = width * 0.55;
    const iconY = y + 68;
    const descriptionY = Math.min(iconY + iconSize + 12, y + height - 28);
    const descriptionColor = {
      r: 180,
      g: 180,
      b: 200,
      a: Math.round(255 * opacity),
    } as Color;
    drawText(
      item.description,
      Vector2(centerX, descriptionY),
      14,
      descriptionColor,
      "center"
    );

    rlPopMatrix();
  }

  public hideForItemDrawer(): void {
    this.isOpen = false;
  }

  public refreshActiveCategory(): void {
    this.resetScrollState();
    this.flattenMode = !!(this.searchTerm && this.searchTerm.trim().length > 0);
    this.initializeItemButtons();
    this.updateScrollBounds();
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
    if (this.itemButtons.length === 0) {
      this.maxScrollOffset = 0;
      this.resetScrollState();
      return;
    }

    let contentBottom = this.scrollContentStartY;

    this.itemButtons.forEach(({ button }) => {
      const { y, height } = button.getConfig();
      contentBottom = Math.max(contentBottom, y + height);
    });
    contentBottom = Math.max(contentBottom, this.contentBottomHint);

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

  private updateComponents(mousePos: Vector2 | null): void {
    this.updateSearchInputGeometry();
    this.updateScroll(mousePos);
    const overlayBlocking =
      (this.profileMenu?.isOpenOrAnimating?.() ?? false) ||
      Popup.isAnyPopupLoading();
    const adjustedMousePos =
      overlayBlocking ||
      this.isDraggingScrollbar ||
      this.suppressButtonReleaseClickFrames > 0
        ? null
        : this.getScrollAdjustedMousePos(mousePos);

    if (this.flattenMode) {
      
      const contentMouse = adjustedMousePos;
      this.flattenedSections.forEach((sec) => {
        sec.sliders.forEach(({ slider }) => slider.update(contentMouse));
      });
    } else {
      this.itemButtons.forEach(({ button, item }) => {
        button.update(adjustedMousePos);
        this.updateHoverAnimation(button, item);
      });
    }

    if (this.suppressButtonReleaseClickFrames > 0) {
      this.suppressButtonReleaseClickFrames -= 1;
    }
  }

  private renderComponents(): void {
    this.renderProfilesRow();

    const hasScrollableContent =
      (this.flattenMode && this.flattenedSections.length > 0) ||
      (!this.flattenMode && this.itemButtons.length > 0);

    if (hasScrollableContent) {
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
          const scissorWidth = Math.max(
            1,
            Math.round(this.drawerWidth * scaleX)
          );
          const scissorHeightPx = Math.max(
            1,
            Math.round(scissorHeight * scaleY)
          );
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

      this.sectionHeaders.forEach((h) => {
        const color = {
          r: 210,
          g: 215,
          b: 230,
          a: Math.round(255 * this.animationProgress),
        } as Color;
        drawText(h.label, Vector2(40, h.y), 24, color, "left");
        const lineColor = {
          r: 80,
          g: 90,
          b: 110,
          a: Math.round(200 * this.animationProgress),
        } as Color;
        drawHLine(40, h.y + 30, this.drawerWidth - 80, lineColor, 2);
      });

      if (this.flattenMode) {
        this.flattenedSections.forEach((sec) => {
          sec.sliders.forEach(({ slider }) =>
            slider.render(this.animationProgress)
          );
        });
      } else {
        this.itemButtons.forEach((entry) => {
          this.renderInventoryTile(entry, this.animationProgress);
        });
      }

      rlPopMatrix();

      if (useScissor) {
        EndScissorMode();
      }

      this.renderScrollbar();
    } else {
      this.itemButtons.forEach((entry) => {
        this.renderInventoryTile(entry, this.animationProgress);
      });
    }
  }

  private updateProfilesRow(mousePos: Vector2 | null): void {
    const overlayBlocking =
      (this.profileMenu?.isOpenOrAnimating?.() ?? false) ||
      Popup.isAnyPopupLoading();
    if (this.awaitMouseUp) {
      const down = IsMouseButtonDown(MOUSE_BUTTON_LEFT);
      const released = IsMouseButtonReleased(MOUSE_BUTTON_LEFT);
      if (!down && !released) {
        this.awaitMouseUp = false;
      }
    }
    const safePos =
      overlayBlocking ||
      this.awaitMouseUp ||
      this.suppressButtonReleaseClickFrames > 0
        ? null
        : mousePos;
    this.profileSelectButton?.update(safePos);
    this.profileAddButton?.update(safePos);
    this.profileRemoveButton?.update(safePos);
  }

  private renderProfilesRow(): void {
    const opacity = this.animationProgress;
    this.profileSelectButton?.render(opacity);
    this.profileAddButton?.render(opacity);
    this.profileRemoveButton?.render(opacity);
  }

  protected drawContent(): void {
    const mousePos = this.gameObject.getMousePosition();
    this.updateProfilesRow(mousePos);
    this.updateComponents(mousePos);
    this.renderComponents();
  }

  protected onOverlayClick(): boolean {
    return false;
  }

  public destroy(): void {
    this.resetHoverAnimations();
    this.volumeKnobs.forEach((knob) => {
      knob.destroy();
    });
    this.volumeKnobs = [];
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

  public getGameSettings(): GameSettings {
    const settings: Record<string, number> = {};
    const config = ConfigManager.get();

    GAME_SETTINGS_SCHEMA.forEach((setting) => {
      const configKey = toGameConfigKey(setting.key as GameSettingKey);
      settings[setting.key] = config[configKey] ?? setting.defaultValue;
    });

    return settings as GameSettings;
  }

  protected getHeaderText(): string {
    return "Customization";
  }

  public close(): void {
    super.close();
    this.onClose?.();
  }

  public toggle(): void {
    if (!this.isOpen) {
      this.open();
    }
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

  public isDrawerOpen(): boolean {
    return this.isOpen;
  }

  public open(): void {
    super.open();
    this.setOverlayOpacity(0);
    this.setBackgroundOpacity(0.7);
  }
}
