import {
  Vector2,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  BeginScissorMode,
  EndScissorMode,
  IsMouseButtonPressed,
  IsMouseButtonDown,
  MOUSE_BUTTON_LEFT,
  IsKeyPressed,
  KEY_ESCAPE,
  Color,
} from "raylib";

import { ScrollableDrawer } from "../../menu/atoms/ScrollableDrawer";
import { GameSlider } from "../atoms/GameSlider";
import { GameButton, GameButtonThemeOverrides } from "../atoms/GameButton";
import { ToggleSwitch } from "../atoms/ToggleSwitch";
import { drawText, measureText } from "../../../utils/text";
import { drawSprite, removeTextureFromCache } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";
import { HoverTooltipOverlay } from "../../../ui/HoverTooltip";
import { getSettingDescription } from "../../../utils/settingDescriptions";
import {
  getSettingsByItem,
  ITEM_SETTING_METADATA,
  toGameConfigKey,
  CUSTOMIZATION_INVENTORY_ITEMS,
} from "../../../utils/gameSettingsSchema";
import type {
  GameConfigKey,
  GameSettingDefinition,
  GameSettingKey,
  ItemSettingsCategory,
  CustomizationInventoryItem,
} from "../../../utils/gameSettingsSchema";
import { ConfigManager, GameConfig } from "../../../utils/configManager";
import { logger } from "../../../utils/logger";
import { clamp, lerpDelta } from "../../../utils/lerp";
import { getPresentationInfo } from "../../../atoms/sysutils/rendering";
import { inRect } from "../../../utils/geometry";
import { createInputBox, InputBox } from "../../menu/atoms/InputBox";
import { drawHLine } from "../../../ui/draw";
import {
  createInventoryButtonTheme,
  renderInventoryTileContent,
} from "../shared/inventory";
import { nestedForParent } from "../shared/groups";
import { selectAndSetConfig } from "../shared/fileSelect";

const ITEM_DRAWER_WIDTH = 580;

interface ItemCustomizationDrawerOptions {
  itemId: ItemSettingsCategory;
  title?: string;
  iconPath?: string;
  onClose?: () => void;
}

export class ItemCustomizationDrawer extends ScrollableDrawer {
  private itemId: ItemSettingsCategory;
  private itemLabel: string;
  private iconPath: string | null = null;
  private sliders: { [key: string]: GameSlider } = {};
  private buttons: GameButton[] = [];
  private itemSettings: GameSettingDefinition[] = [];
  private resetButton: GameButton | null = null;
  private onCloseCallback?: () => void;
  private initialValues: Record<string, number> = {};
  private enabledSetting: GameSettingDefinition | null = null;
  private enabledToggle: ToggleSwitch | null = null;
  private enabledToggleValue: boolean = true;
  private enabledInitialValue: boolean = true;
  private readonly sliderLeftMargin = 40;
  private readonly sliderRightMargin = 90;
  private readonly sliderStartY = 180;
  private readonly sliderSpacing = 70;
  private readonly scrollAreaBottomPadding: number = 40;
  private readonly scrollContentPadding: number = 60;
  private readonly scrollWheelStep: number = 80;
  private activeValueInput: InputBox | null = null;
  private activeValueInputKey: string | null = null;
  private parentItemId: ItemSettingsCategory | null = null;
  private parentTitle: string | null = null;
  private parentIconPath: string | null = null;
  private nestedItemButtons: Array<{
    button: GameButton;
    item: CustomizationInventoryItem;
  }> = [];
  private nestedSectionLabel: string | null = null;
  private nestedHeaderY: number = 0;
  private readonly nestedHeaderHeight: number = 32;
  private readonly nestedHeaderSpacing: number = 22;
  private readonly nestedColumnCount: number = 2;
  private readonly nestedColumnSpacing: number = 18;
  private readonly nestedRowSpacing: number = 24;
  private readonly nestedLeftMargin: number = 40;
  private readonly nestedRightMargin: number = 30;
  private breadcrumbSpans: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    clickable: boolean;
    onClick?: () => void;
  }> = [];
  private hoveredBreadcrumbIndex: number | null = null;
  private readonly headerRowTop: number = 86;
  private readonly headerRowHeight: number = 36;
  private pendingBreadcrumbAction: "root" | "parent" | null = null;
  private pendingBreadcrumbReleaseSeen: boolean = false;

  constructor(options: ItemCustomizationDrawerOptions) {
    super(ITEM_DRAWER_WIDTH);
    this.itemId = options.itemId;
    this.itemLabel =
      options.title ?? ITEM_SETTING_METADATA[this.itemId]?.label ?? "Item";
    this.iconPath = options.iconPath ?? null;
    this.onCloseCallback = options.onClose;
    this.setOverlayOpacity(0);
    this.setBackgroundOpacity(0.7);
    this.configureForCurrentItem();
  }

  protected shouldShowCloseButton(): boolean {
    return false;
  }

  protected onOverlayClick(): boolean {
    return false;
  }

  public showItem(
    itemId: ItemSettingsCategory,
    title?: string,
    iconPath?: string
  ): void {
    this.itemId = itemId;
    this.itemLabel = title ?? ITEM_SETTING_METADATA[itemId]?.label ?? "Item";
    this.iconPath = iconPath ?? null;
    this.configureForCurrentItem();
  }

  protected getHeaderText(): string {
    return this.itemLabel + " Settings";
  }

  protected drawContent(): void {
    const opacity = this.animationProgress;
    const mousePos = this.gameObject.getMousePosition();

    this.updateComponents(mousePos);
    this.renderComponents(opacity);
  }

  protected onUpdate(): void {
    if (IsKeyPressed(KEY_ESCAPE)) {
      this.goBack();
    }

    if (this.pendingBreadcrumbAction) {
      const mouseDown = IsMouseButtonDown(MOUSE_BUTTON_LEFT);
      if (mouseDown) {
        return;
      }
      if (!this.pendingBreadcrumbReleaseSeen) {
        this.pendingBreadcrumbReleaseSeen = true;
        return;
      }
      const action = this.pendingBreadcrumbAction;
      this.pendingBreadcrumbAction = null;
      this.pendingBreadcrumbReleaseSeen = false;
      if (action === "root") {
        this.close();
      } else if (action === "parent") {
        this.goBack();
      }
    }
  }

  public close(): void {
    const wasOpen = this.isDrawerOpen();
    this.closeActiveValueInput();
    super.close();
    if (wasOpen) {
      this.onCloseCallback?.();
    }
  }

  public destroy(): void {
    super.destroy();
    this.buttons = [];
    this.sliders = {};
    this.closeActiveValueInput();
  }

  private configureForCurrentItem(): void {
    this.closeActiveValueInput();
    this.resetScrollState();
    const originalSettings = getSettingsByItem(this.itemId);

    this.captureInitialValues(originalSettings);

    const enabledIndex = this.configureEnabledToggle(originalSettings);
    this.itemSettings = originalSettings.filter(
      (_, index) => index !== enabledIndex
    );

    this.initializeSliders();
    this.initializeButtons();
    this.initializeNestedItems();
    this.initializeHeaderControls();
    this.updateScrollBounds();
  }

  private configureEnabledToggle(
    originalSettings: GameSettingDefinition[]
  ): number {
    const idx = originalSettings.findIndex(
      (s) =>
        s.label.toLowerCase() === "enabled" ||
        s.key.toLowerCase().endsWith("enabled")
    );
    if (idx < 0) {
      this.enabledSetting = null;
      this.enabledToggle = null;
      this.enabledToggleValue = true;
      this.enabledInitialValue = true;
      return -1;
    }
    this.enabledSetting = originalSettings[idx];
    const config = ConfigManager.get();
    const configKey = this.getConfigKey(this.enabledSetting);
    const raw =
      (config[configKey] as number) ?? this.enabledSetting.defaultValue;
    this.enabledToggleValue = raw >= 0.5;
    this.enabledInitialValue = this.enabledToggleValue;
    const w = 56;
    this.enabledToggle = new ToggleSwitch({
      x: this.drawerWidth - this.sliderRightMargin - w,
      y: this.sliderStartY - 10,
      initialValue: this.enabledToggleValue,
      onToggle: (value) => {
        this.enabledToggleValue = value;
        this.handleEnabledChanged(value);
        this.updateButtonsState();
      },
    });
    return idx;
  }

  private initializeHeaderControls(): void {
    const crumbs: Array<{
      label: string;
      clickable: boolean;
      onClick?: () => void;
    }> = [];
    if (this.parentItemId) {
      const parentLabel =
        this.parentTitle ??
        ITEM_SETTING_METADATA[this.parentItemId]?.label ??
        "Parent";
      crumbs.push({
        label: "Customization",
        clickable: true,
        onClick: () => this.scheduleBreadcrumbAction("root"),
      });
      crumbs.push({
        label: parentLabel,
        clickable: true,
        onClick: () => this.scheduleBreadcrumbAction("parent"),
      });
      crumbs.push({ label: this.itemLabel, clickable: false });
    } else {
      crumbs.push({
        label: "Customization",
        clickable: true,
        onClick: () => this.scheduleBreadcrumbAction("root"),
      });
      crumbs.push({ label: this.itemLabel, clickable: false });
    }

    this.breadcrumbSpans = [];
    let cursorX = this.nestedLeftMargin;
    const sep = " > ";
    const sepW = measureText(sep, 18).width + 12;
    crumbs.forEach((c, idx) => {
      const label = c.label;
      const fontSize = 20;
      const w = Math.max(40, measureText(label, fontSize).width);
      this.breadcrumbSpans.push({
        x: cursorX,
        y: this.headerRowTop,
        width: w,
        height: this.headerRowHeight,
        label,
        clickable: c.clickable,
        onClick: c.onClick,
      });
      cursorX += w;
      if (idx < crumbs.length - 1) cursorX += sepW;
    });
  }

  private initializeNestedItems(): void {
    this.nestedItemButtons = [];
    this.nestedSectionLabel = null;
    this.nestedHeaderY = 0;

    const nested = nestedForParent(this.itemId);
    if (!nested) return;
    const items = nested.items;
    this.nestedSectionLabel = nested.label;

    const innerWidth =
      this.drawerWidth - this.nestedLeftMargin - this.nestedRightMargin;
    const itemSize =
      (innerWidth - this.nestedColumnSpacing) / this.nestedColumnCount;

    let currentY = this.getContentBottomBeforeNested() + 40;
    this.nestedHeaderY = currentY;
    currentY += this.nestedHeaderHeight + this.nestedHeaderSpacing;

    items.forEach((item, index) => {
      const column = index % this.nestedColumnCount;
      const row = Math.floor(index / this.nestedColumnCount);
      const x =
        this.nestedLeftMargin + column * (itemSize + this.nestedColumnSpacing);
      const y = currentY + row * (itemSize + this.nestedRowSpacing);

      const button = new GameButton({
        label: "",
        x,
        y,
        width: itemSize,
        height: itemSize,
        theme: createInventoryButtonTheme(item.rarity),
        onClick: () => this.openSubItem(item),
      });
      this.nestedItemButtons.push({ button, item });
    });
  }

  private openSubItem(item: CustomizationInventoryItem): void {
    this.parentItemId = this.itemId;
    this.parentTitle = this.itemLabel;
    this.parentIconPath = this.iconPath;
    this.showItem(
      item.settingsCategory as any,
      item.name,
      item.iconPath ?? undefined
    );
  }

  private scheduleBreadcrumbAction(action: "root" | "parent"): void {
    if (!this.pendingBreadcrumbAction) {
      this.pendingBreadcrumbAction = action;
      this.pendingBreadcrumbReleaseSeen = false;
    }
  }

  private getContentBottomBeforeNested(): number {
    let contentBottom = this.getSliderBaseY();
    if (this.itemSettings.length > 0) {
      contentBottom =
        this.getSliderBaseY() +
        (this.itemSettings.length - 1) * this.sliderSpacing +
        this.sliderSpacing;
    } else if (!this.enabledSetting) {
      contentBottom = Math.max(contentBottom, this.getSliderBaseY() + 40);
    }
    this.buttons.forEach((button) => {
      const { y, height } = button.getConfig();
      contentBottom = Math.max(contentBottom, y + height);
    });
    return contentBottom;
  }

  private getSliderBaseY(): number {
    return this.sliderStartY + (this.enabledSetting ? 70 : 0);
  }

  private captureInitialValues(settings: GameSettingDefinition[]): void {
    this.initialValues = {};
    const config = ConfigManager.get();
    settings.forEach((setting) => {
      const configKey = this.getConfigKey(setting);
      const value = (config[configKey] as number) ?? setting.defaultValue;
      this.initialValues[setting.key] = value;
    });
  }

  private initializeSliders(): void {
    this.sliders = {};
    if (this.itemSettings.length === 0) {
      return;
    }

    const config = ConfigManager.get();
    const sliderWidth =
      this.drawerWidth - this.sliderLeftMargin - this.sliderRightMargin;
    const baseY = this.getSliderBaseY();

    this.itemSettings.forEach((setting, index) => {
      const configKey = this.getConfigKey(setting);
      const value = (config[configKey] as number) ?? setting.defaultValue;
      const y = baseY + index * this.sliderSpacing;

      this.sliders[setting.key] = new GameSlider({
        label: setting.label,
        value,
        min: setting.min,
        max: setting.max,
        step: setting.step,
        x: this.sliderLeftMargin,
        y,
        width: sliderWidth,
        onChange: (newValue) => this.handleSliderChanged(setting, newValue),
      });
    });
  }

  private handleSliderChanged(
    setting: GameSettingDefinition,
    value: number
  ): void {
    const configKey = this.getConfigKey(setting);
    ConfigManager.update({
      [configKey]: value,
    } as Partial<GameConfig>);
  }

  private handleEnabledChanged(value: boolean): void {
    if (!this.enabledSetting) {
      return;
    }

    const configKey = this.getConfigKey(this.enabledSetting);
    ConfigManager.update({
      [configKey]: value ? 1 : 0,
    } as Partial<GameConfig>);
  }

  private initializeButtons(): void {
    this.buttons = [];
    this.resetButton = null;

    const resetButtonWidth = 180;
    const buttonHeight = 40;
    const buttonSpacing = 20;
    const baseY = this.getSliderBaseY();
    const y = baseY + this.itemSettings.length * this.sliderSpacing + 40;

    const actions = this.getItemActions();
    let row = 0;
    actions.forEach((a) => {
      const ax = this.sliderLeftMargin;
      const ay = y + row * (buttonHeight + buttonSpacing);
      const aw = a.width ?? 180;
      const btn = new GameButton({
        label: a.label,
        x: ax,
        y: ay,
        width: aw,
        height: buttonHeight,
        onClick: a.onClick,
      });
      this.buttons.push(btn);
      row += 1;
    });
    this.updateButtonsState();
    this.updateScrollBounds();
  }

  protected getScrollAreaTop(): number {
    const rawTop = this.getSliderBaseY() - 40;
    return clamp(rawTop, 0, this.drawerHeight - this.scrollAreaBottomPadding);
  }

  protected getScrollAreaBottomPadding(): number {
    return this.scrollAreaBottomPadding;
  }

  protected getScrollWheelStep(): number {
    return this.scrollWheelStep;
  }

  protected isScrollInteractionSuspended(): boolean {
    return this.isValueEditingActive();
  }

  protected override updateScrollBounds(): void {
    const areaHeight = this.getScrollAreaHeight();
    if (areaHeight <= 0) {
      this.maxScrollOffset = 0;
      this.resetScrollState();
      return;
    }

    let contentBottom = this.getContentBottomBeforeNested();

    if (this.nestedItemButtons.length > 0 && this.nestedSectionLabel) {
      const innerWidth =
        this.drawerWidth - this.nestedLeftMargin - this.nestedRightMargin;
      const itemSize =
        (innerWidth - this.nestedColumnSpacing) / this.nestedColumnCount;
      const rows = Math.ceil(
        this.nestedItemButtons.length / this.nestedColumnCount
      );
      const gridHeight =
        rows > 0
          ? (rows - 1) * (itemSize + this.nestedRowSpacing) + itemSize
          : 0;
      const sectionTop = this.nestedHeaderY;
      const afterHeader =
        sectionTop + this.nestedHeaderHeight + this.nestedHeaderSpacing;
      contentBottom = Math.max(contentBottom, afterHeader + gridHeight + 30);
    }

    const contentHeight = Math.max(
      0,
      contentBottom - this.getScrollAreaTop() + this.scrollContentPadding
    );

    this.maxScrollOffset = Math.max(0, contentHeight - areaHeight);
    this.targetScrollOffset = clamp(
      this.targetScrollOffset,
      0,
      this.maxScrollOffset
    );
    this.scrollOffset = clamp(this.scrollOffset, 0, this.maxScrollOffset);
  }

  private updateComponents(mousePos: Vector2 | null): void {
    this.updateScroll(mousePos);

    const contentMousePos =
      this.isDraggingScrollbar ||
      this.suppressButtonReleaseClickFrames > 0 ||
      this.isValueEditingActive()
        ? null
        : this.getScrollAdjustedMousePos(mousePos);

    
    let hoveredShown = false;
    Object.values(this.sliders).forEach((slider) => {
      slider.update(contentMousePos);
      if (!hoveredShown && slider.isHoveredForTooltip(contentMousePos)) {
        
        const setting = this.itemSettings.find(
          (s) => this.sliders[s.key] === slider
        );
        if (setting) {
          const desc = getSettingDescription(setting.key);
          if (desc) {
            const title = `${setting.label}`;
            const cfg = slider.getConfig();
            const anchorY = cfg.y - 30 - this.scrollOffset; 
            HoverTooltipOverlay.set(
              { title, text: desc },
              { x: this.drawerWidth + 16, y: anchorY }
            );
            hoveredShown = true;
          }
        }
      }
    });
    this.buttons.forEach((button) => button.update(contentMousePos));
    this.nestedItemButtons.forEach(({ button }) =>
      button.update(contentMousePos)
    );
    const headerMouse =
      this.isDraggingScrollbar || this.suppressButtonReleaseClickFrames > 0
        ? null
        : mousePos;
    this.hoveredBreadcrumbIndex = null;
    if (headerMouse) {
      for (let i = 0; i < this.breadcrumbSpans.length; i++) {
        const s = this.breadcrumbSpans[i];
        const inside =
          headerMouse.x >= s.x &&
          headerMouse.x <= s.x + s.width &&
          headerMouse.y >= s.y &&
          headerMouse.y <= s.y + s.height;
        if (inside) {
          this.hoveredBreadcrumbIndex = i;
          break;
        }
      }
      if (
        this.hoveredBreadcrumbIndex !== null &&
        IsMouseButtonPressed(MOUSE_BUTTON_LEFT)
      ) {
        const s = this.breadcrumbSpans[this.hoveredBreadcrumbIndex];
        if (s.clickable && s.onClick) s.onClick();
      }
    }
    
    if (contentMousePos && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
      const hit = this.findSliderValueLabelHit(contentMousePos);
      if (hit) {
        this.openInlineValueEditor(hit.setting, hit.slider);
      }
    }
    if (this.suppressButtonReleaseClickFrames > 0) {
      this.suppressButtonReleaseClickFrames -= 1;
    }
    if (this.enabledToggle) {
      const toggleMouse =
        this.isDraggingScrollbar || this.suppressButtonReleaseClickFrames > 0
          ? null
          : mousePos;
      this.enabledToggle.update(toggleMouse);
      if (
        !hoveredShown &&
        this.enabledToggle.isHovered() &&
        this.enabledSetting
      ) {
        const key = this.enabledSetting.key;
        const desc = getSettingDescription(key);
        if (desc) {
          const title = `${this.itemLabel}: Enabled`;
          const labelY = this.sliderStartY + 4; 
          HoverTooltipOverlay.set(
            { title, text: desc },
            { x: this.drawerWidth + 16, y: labelY }
          );
          hoveredShown = true;
        }
      }
    }

    
    if (!hoveredShown) {
      HoverTooltipOverlay.clear();
    }

    this.updateButtonsState();
  }

  private renderComponents(opacity: number): void {
    this.renderHeaderControls(opacity);

    if (this.enabledToggle && this.enabledSetting) {
      const labelY = this.sliderStartY + 4;
      drawText(
        "Enabled",
        Vector2(this.sliderLeftMargin, labelY),
        20,
        {
          r: 200,
          g: 200,
          b: 210,
          a: Math.round(255 * opacity),
        },
        "left"
      );
      this.enabledToggle.render(opacity);
    }

    const scrollAreaTop = this.getScrollAreaTop();
    const scrollAreaHeight = this.getScrollAreaHeight();
    const hasContent =
      this.itemSettings.length > 0 ||
      this.buttons.length > 0 ||
      (!this.enabledSetting && this.itemSettings.length === 0);

    let scissorActive = false;
    if (hasContent && scrollAreaHeight > 0) {
      try {
        const { viewport } = getPresentationInfo();
        const scaleX = viewport.width / Math.max(1, Rhythia.gameWidth);
        const scaleY = viewport.height / Math.max(1, Rhythia.gameHeight);
        const worldX = this.gameObject.rectArea?.pos.x ?? 0;
        const worldY = scrollAreaTop;

        const scissorX = Math.round(viewport.x + worldX * scaleX);
        const scissorY = Math.round(viewport.y + worldY * scaleY);
        const scissorWidth = Math.max(1, Math.round(this.drawerWidth * scaleX));
        const scissorHeightPx = Math.max(
          1,
          Math.round(scrollAreaHeight * scaleY)
        );
        BeginScissorMode(scissorX, scissorY, scissorWidth, scissorHeightPx);
        scissorActive = true;
      } catch {
        const scale = Rhythia.renderScale || 1;
        const scissorX = Math.round(
          (this.gameObject.rectArea?.pos.x ?? 0) * scale
        );
        const scissorY = Math.round(scrollAreaTop * scale);
        const scissorWidth = Math.max(1, Math.round(this.drawerWidth * scale));
        const scissorHeightPx = Math.max(
          1,
          Math.round(scrollAreaHeight * scale)
        );
        BeginScissorMode(scissorX, scissorY, scissorWidth, scissorHeightPx);
        scissorActive = true;
      }
    }

    rlPushMatrix();
    rlTranslatef(0, -this.scrollOffset, 0);

    if (this.itemSettings.length === 0 && !this.enabledSetting) {
      this.renderEmptyState(opacity);
    } else {
      for (const setting of this.itemSettings) {
        const slider = this.sliders[setting.key];
        if (!slider) continue;

        if (
          this.activeValueInputKey === setting.key &&
          this.isValueEditingActive()
        ) {
          const cfg = slider.getConfig();
          drawText(
            setting.label,
            Vector2(cfg.x, cfg.y - 30),
            20,
            { r: 200, g: 200, b: 200, a: Math.round(255 * opacity) },
            "left"
          );
          
        } else {
          slider.render(opacity);
        }
      }
    }

    this.buttons.forEach((button) => button.render(opacity));

    if (this.nestedItemButtons.length > 0 && this.nestedSectionLabel) {
      const color = {
        r: 210,
        g: 215,
        b: 230,
        a: Math.round(255 * opacity),
      } as Color;
      drawText(
        this.nestedSectionLabel,
        Vector2(this.nestedLeftMargin, this.nestedHeaderY),
        24,
        color,
        "left"
      );
      const lineColor = {
        r: 80,
        g: 90,
        b: 110,
        a: Math.round(200 * opacity),
      } as Color;
      drawHLine(
        this.nestedLeftMargin,
        this.nestedHeaderY + 30,
        this.drawerWidth - this.nestedLeftMargin - this.nestedRightMargin,
        lineColor,
        2
      );

      this.nestedItemButtons.forEach((entry) => {
        this.renderNestedTile(entry, opacity);
      });
    }

    rlPopMatrix();

    if (scissorActive) {
      EndScissorMode();
    }

    this.renderScrollbar();
  }

  private getItemActions(): Array<{
    label: string;
    onClick: () => void;
    width?: number;
  }> {
    if (this.itemId === ("customCursor" as any)) {
      return [
        {
          label: "Select",
          width: 105,
          onClick: () => this.handleSelectCustomCursor(),
        },
      ];
    }
    if (this.itemId === ("system-visuals" as any)) {
      return [
        {
          label: "Select cover image",
          width: 220,
          onClick: () => this.handleSelectBackgroundImage(),
        },
      ];
    }
    if (this.itemId === ("video-background" as any)) {
      return [
        {
          label: "Select background video",
          width: 240,
          onClick: () => this.handleSelectBackgroundVideo(),
        },
      ];
    }
    return [];
  }

  private renderHeaderControls(opacity: number): void {
    if (this.breadcrumbSpans.length > 0) {
      const sep = " > ";
      const sepColor = { r: 140, g: 150, b: 170, a: Math.round(255 * opacity) };
      this.breadcrumbSpans.forEach((s, idx) => {
        const isHovered = idx === this.hoveredBreadcrumbIndex;
        const baseColor = s.clickable
          ? isHovered
            ? { r: 230, g: 235, b: 245, a: Math.round(255 * opacity) }
            : { r: 200, g: 210, b: 230, a: Math.round(255 * opacity) }
          : { r: 180, g: 185, b: 200, a: Math.round(255 * opacity) };
        drawText(s.label, Vector2(s.x, s.y + 6), 20, baseColor, "left");
        if (s.clickable) {
          const underlineY = s.y + this.headerRowHeight - 10;
          drawHLine(
            s.x,
            underlineY,
            Math.max(1, s.width),
            {
              r: baseColor.r,
              g: baseColor.g,
              b: baseColor.b,
              a: Math.round(180 * opacity),
            },
            1
          );
        }
        if (idx < this.breadcrumbSpans.length - 1) {
          const nextX = s.x + s.width + 4;
          drawText(sep, Vector2(nextX, s.y + 6), 18, sepColor, "left");
        }
      });
    }
  }

  private renderNestedTile(
    entry: { button: GameButton; item: CustomizationInventoryItem },
    opacity: number
  ): void {
    const { button, item } = entry;
    const { x, y, width, height } = button.getConfig();
    button.render(opacity);
    renderInventoryTileContent(item, { x, y, width, height }, opacity);
  }

  private findSliderValueLabelHit(
    contentMousePos: Vector2
  ): { setting: GameSettingDefinition; slider: GameSlider } | null {
    for (const setting of this.itemSettings) {
      const slider = this.sliders[setting.key];
      if (!slider) continue;
      const bounds = this.getValueLabelBounds(slider);
      if (
        inRect(
          contentMousePos.x,
          contentMousePos.y,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height
        )
      ) {
        return { setting, slider };
      }
    }
    return null;
  }

  private getValueLabelBounds(slider: GameSlider): {
    x: number;
    y: number;
    width: number;
    height: number;
    centerY: number;
  } {
    const cfg = slider.getConfig();
    const valueText = cfg.value.toFixed(cfg.step < 1 ? 2 : 0);
    const fontSize = 18;
    const drawerX = this.gameObject.rectArea?.pos.x ?? 0;
    const labelX = drawerX + cfg.x + cfg.width + 20;
    const labelY = cfg.y - 10;
    const size = measureText(valueText, fontSize);
    const pad = 6;
    return {
      x: labelX - pad,
      y: labelY - pad / 2,
      width: Math.max(36, size.width) + pad * 2,
      height: size.height + pad,
      centerY: labelY + size.height / 2,
    };
  }

  private openInlineValueEditor(
    setting: GameSettingDefinition,
    slider: GameSlider
  ): void {
    if (this.activeValueInput) {
      this.closeActiveValueInput();
    }

    const cfg = slider.getConfig();
    const drawerX = this.gameObject.rectArea?.pos.x ?? 0;
    const initialText = cfg.value.toFixed(cfg.step < 1 ? 2 : 0);

    const width = cfg.width;
    const height = 28;
    const fontSize = 18;
    const inputX = drawerX + cfg.x;
    const inputCenterY = cfg.y + 6 - this.scrollOffset; 

    const ib = createInputBox({
      position: Vector2(inputX, inputCenterY),
      width,
      height,
      fontSize,
      initialValue: initialText,
      maxLength: 12,
      onValueChange: (text) => {
        const parsed = Number.parseFloat(text);
        if (!Number.isFinite(parsed)) return;
        const clamped = clamp(parsed, setting.min, setting.max);
        slider.setValue(clamped);
        this.handleSliderChanged(setting, clamped);
      },
      onEnter: () => {
        this.closeActiveValueInput();
      },
      onBlur: () => {
        this.closeActiveValueInput();
      },
    });

    this.activeValueInput = ib;
    try {
      ib.getGameObject().zBase = 16; 
    } catch {}
    this.activeValueInputKey = setting.key;
    ib.focus();
  }

  private closeActiveValueInput(): void {
    try {
      this.activeValueInput?.destroy();
    } catch {}
    this.activeValueInput = null;
    this.activeValueInputKey = null;
  }

  private isValueEditingActive(): boolean {
    return !!this.activeValueInput && !!this.activeValueInputKey;
  }

  

  private renderEmptyState(opacity: number): void {
    const color = {
      r: 180,
      g: 180,
      b: 190,
      a: Math.round(255 * opacity),
    };

    drawText(
      "No settings are available for this item yet.",
      Vector2(this.sliderLeftMargin, this.getSliderBaseY()),
      20,
      color,
      "left"
    );
  }

  private saveAndReturn(): void {
    if (this.itemSettings.length === 0 && !this.enabledSetting) {
      if (this.parentItemId) {
        const pid = this.parentItemId;
        const ptitle = this.parentTitle ?? undefined;
        const picon = this.parentIconPath ?? undefined;
        this.parentItemId = null;
        this.parentTitle = null;
        this.parentIconPath = null;
        this.showItem(pid, ptitle, picon);
      } else {
        this.close();
      }
      return;
    }

    const hadChanges = this.areSettingsChanged();
    const updates: Partial<GameConfig> = {};

    if (this.enabledSetting && this.enabledToggle) {
      const enabledKey = this.getConfigKey(this.enabledSetting);
      const enabledValue = this.enabledToggleValue ? 1 : 0;
      (updates as any)[enabledKey] = enabledValue;
      this.initialValues[this.enabledSetting.key] = enabledValue;
      this.enabledInitialValue = this.enabledToggleValue;
    }

    this.itemSettings.forEach((setting) => {
      const slider = this.sliders[setting.key];
      if (!slider) {
        return;
      }
      const configKey = this.getConfigKey(setting);
      const value = slider.getValue();
      (updates as any)[configKey] = value;
      this.initialValues[setting.key] = value;
    });

    if (hadChanges) {
      ConfigManager.update(updates);
      ConfigManager.save();
      logger(this.itemLabel + " settings saved.");
    } else {
      logger(this.itemLabel + " settings unchanged.");
    }

    this.updateButtonsState();

    if (this.parentItemId) {
      const pid = this.parentItemId;
      const ptitle = this.parentTitle ?? undefined;
      const picon = this.parentIconPath ?? undefined;
      this.parentItemId = null;
      this.parentTitle = null;
      this.parentIconPath = null;
      this.showItem(pid, ptitle, picon);
    } else {
      this.close();
    }
  }

  private goBack(): void {
    if (this.parentItemId) {
      const pid = this.parentItemId;
      const ptitle = this.parentTitle ?? undefined;
      const picon = this.parentIconPath ?? undefined;
      this.parentItemId = null;
      this.parentTitle = null;
      this.parentIconPath = null;
      this.showItem(pid, ptitle, picon);
    } else {
      this.close();
    }
  }

  private resetToOriginal(): void {
    if (this.enabledSetting && this.enabledToggle) {
      this.enabledToggle.setValue(this.enabledInitialValue);
      this.enabledToggleValue = this.enabledInitialValue;
      this.handleEnabledChanged(this.enabledInitialValue);
    }

    this.itemSettings.forEach((setting) => {
      const slider = this.sliders[setting.key];
      if (!slider) {
        return;
      }

      const originalValue =
        this.initialValues[setting.key] ?? setting.defaultValue;
      slider.setValue(originalValue);
      this.handleSliderChanged(setting, originalValue);
    });

    logger(this.itemLabel + " settings reset to original values.");
    this.updateButtonsState();
  }

  private areSettingsChanged(): boolean {
    const slidersChanged = this.itemSettings.some((setting) => {
      const slider = this.sliders[setting.key];
      if (!slider) {
        return false;
      }
      const baseline = this.initialValues[setting.key] ?? setting.defaultValue;
      return slider.getValue() !== baseline;
    });

    const toggleChanged = this.enabledSetting
      ? this.enabledToggleValue !== this.enabledInitialValue
      : false;

    return slidersChanged || toggleChanged;
  }

  private updateButtonsState(): void {
    const changed = this.areSettingsChanged();

    if (this.resetButton) {
      this.resetButton.setDisabled(!changed);
    }
  }

  

  private getConfigKey(setting: GameSettingDefinition): GameConfigKey {
    return toGameConfigKey(setting.key as GameSettingKey);
  }

  private async handleSelectCustomCursor(): Promise<void> {
    await selectAndSetConfig({
      popupTitle: "Select a cursor image",
      dialog: { images: "png,jpg,jpeg" },
      configKey: "cursorImagePath",
      successMessage: "Custom cursor set",
      invalidateTextureKeys: ["custom-cursor-texture"],
      invalidateWithPickedPath: (p) => [`${p}-custom-cursor-image`],
    });
  }

  private async handleSelectBackgroundImage(): Promise<void> {
    await selectAndSetConfig({
      popupTitle: "Select a background image",
      dialog: { images: "png,jpg,jpeg" },
      configKey: "coverImagePath",
      successMessage: "Background image set",
      invalidateTextureKeys: ["custom-background-image"],
    });
  }

  private async handleSelectBackgroundVideo(): Promise<void> {
    await selectAndSetConfig({
      popupTitle: "Select a background video",
      dialog: { video: "mp4,mkv" },
      configKey: "videoPath",
      successMessage: "Background video saved",
    });
  }
}
