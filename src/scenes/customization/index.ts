import { Scene } from "../../atoms/Scene";
import { GameObject } from "../../atoms/Object";
import { Rhythia } from "../../atoms/Rhythia";
import { MenuScene } from "../menu";
import { SoundSpaceMemoryMap } from "../../utils/storage/ssmm";
import { Maps } from "../../utils/maps";
import {
  getMusicLength,
  isMusicPlaying,
  playMusic,
  stopMusic,
  seek,
} from "../../utils/soundManager";
import {
  CustomizationDrawer,
  CUSTOMIZATION_DRAWER_WIDTH,
} from "./molecules/CustomizationDrawer";
import { CustomizationInventoryItem } from "../../utils/gameSettingsSchema";
import { GamePreview } from "./atoms/GamePreview";
import { keybinds } from "../../utils/keybinds";
import { Cooldown } from "../../atoms/Cooldown";
import * as fs from "fs";
import { logger } from "../../utils/logger";
import { ItemCustomizationDrawer } from "./molecules/ItemCustomizationDrawer";
import { PaletteDrawer } from "./molecules/PaletteDrawer";
import { HoverTooltipOverlay } from "../../ui/HoverTooltip";
import { Popup } from "../menu/atoms/Popup";

export class CustomizationScene extends Scene {
  sceneName: string = "Customization";
  private backText: GameObject | null = null;
  private drawer: CustomizationDrawer | null = null;
  private itemDrawer: ItemCustomizationDrawer | null = null;
  private paletteDrawer: PaletteDrawer | null = null;
  private gamePreview: GamePreview | null = null;
  private testMapData: SoundSpaceMemoryMap | null = null;
  private exitCooldown: Cooldown;
  private readonly drawerAccent = { r: 8, g: 8, b: 8 };

  constructor(selectedMap?: SoundSpaceMemoryMap | null) {
    super();

    if (selectedMap) {
      this.testMapData = selectedMap;
    }
    this.exitCooldown = new Cooldown(0.4);
  }

  async init(): Promise<void> {
    stopMusic();

    this.drawer = new CustomizationDrawer({
      onItemSelected: (item) => this.handleItemSelected(item),
      onClose: () => Rhythia.goToScene(new MenuScene()),
    });

    this.drawer.setAccentColor(this.drawerAccent);

    this.drawer.open();

    if (!this.testMapData) {
      this.loadTestMapData();
    } else {
      if (this.testMapData.audioFileName) {
        const audioPath = `./cache/audio/${this.testMapData.audioFileName}`;
        logger(`Starting music from selected map: ${audioPath}`);
        playMusic(audioPath);
      }
    }

    this.gamePreview = new GamePreview({
      mapData: this.testMapData,
      drawerWidth: CUSTOMIZATION_DRAWER_WIDTH,
      settings: this.drawer ? this.drawer.getGameSettings() : undefined,
    });

    const gamePreviewObject = new GameObject({ zBase: 2 });
    gamePreviewObject.onDraw = () => {
      if (!this.gamePreview || !this.drawer) {
        return;
      }

      const settings = this.drawer.getGameSettings();
      this.gamePreview.updateSettings(settings);

      const isDrawerActive =
        this.drawer.isDrawerOpen() ||
        (this.itemDrawer ? this.itemDrawer.isDrawerOpen() : false);

      this.gamePreview.render(isDrawerActive);
    };

    this.backText = new GameObject({ zBase: 1 });

    this.backText.onDraw = () => {};

    this.backText.onUpdate = () => {
      
      if (Popup.isAnyPopupLoading()) {
        this.exitCooldown.reset();
        this.exitCooldown.update();
        return;
      }
      if (keybinds.isDown("back")) {
        if (!this.exitCooldown.isRunning()) {
          this.exitCooldown.start(() => {
            Rhythia.goToScene(new MenuScene());
          });
        }
      } else {
        this.exitCooldown.reset();
      }

      this.exitCooldown.update();
    };

    
    new HoverTooltipOverlay();
  }

  private handleItemSelected(item: CustomizationInventoryItem): void {
    this.openItemCustomizationDrawer(item);
  }

  private openItemCustomizationDrawer(item: CustomizationInventoryItem): void {
    this.drawer?.hideForItemDrawer();

    if (item.settingsCategory === ("system-colors" as any)) {
      if (!this.paletteDrawer) {
        this.paletteDrawer = new PaletteDrawer({
          onClose: () => this.handlePaletteDrawerClosed(),
        });
        try { this.paletteDrawer.setAccentColor(this.drawerAccent as any); } catch {}
      }
      this.paletteDrawer.open();
      return;
    }

    if (!this.itemDrawer) {
      this.itemDrawer = new ItemCustomizationDrawer({
        itemId: item.settingsCategory,
        title: item.name,
        iconPath: item.iconPath,
        onClose: () => this.handleItemDrawerClosed(),
      });
      this.itemDrawer.setAccentColor(this.drawerAccent);
    } else {
      this.itemDrawer.showItem(item.settingsCategory, item.name, item.iconPath);
    }

    this.itemDrawer.open();
  }

  private handleItemDrawerClosed(): void {
    if (this.drawer) {
      this.drawer.refreshActiveCategory();
      this.drawer.open();
    }
  }

  private handlePaletteDrawerClosed(): void {
    if (this.drawer) {
      this.drawer.refreshActiveCategory();
      this.drawer.open();
    }
  }

  private loadTestMapData(): void {
    const defaultMapId = "10291";
    if (this.loadMapById(defaultMapId)) {
      return;
    }

    const parsedDir = "./cache/parsed";
    if (!fs.existsSync(parsedDir)) {
      logger(
        `Customization preview fallback skipped: missing parsed maps directory at ${parsedDir}`
      );
      return;
    }

    try {
      const availableMaps = fs
        .readdirSync(parsedDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => name.trim().length > 0);

      if (availableMaps.length === 0) {
        logger("Customization preview fallback skipped: no cached maps found");
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableMaps.length);
      const fallbackId = availableMaps[randomIndex];

      if (!this.loadMapById(fallbackId)) {
        logger(`Failed to load fallback map ${fallbackId} for preview`);
      }
    } catch (error) {
      console.error(
        "Failed to select fallback map for customization preview:",
        error
      );
    }
  }

  private loadMapById(mapId: string): boolean {
    try {
      const m = Maps.getParsed(mapId);
      if (!m) {
        logger(`Map ${mapId} not found`);
        return false;
      }
      this.testMapData = m;
      const p = Maps.audioPath(mapId, m);
      if (p) playMusic(p);
      return true;
    } catch {
      return false;
    }
  }

  render(): void {
    const musicLength = getMusicLength();
    if (musicLength > 0 && !isMusicPlaying()) {
      logger("Music ended in customization - restarting");
      seek(0);
      if (this.testMapData?.audioFileName) {
        const audioPath = `./cache/audio/${this.testMapData.audioFileName}`;
        playMusic(audioPath);
      }
    }

    GameObject.updateAll();
    GameObject.drawAll();

    this.exitCooldown.draw();
  }

  destroy(): void {
    if (this.drawer) {
      this.drawer.destroy();
      this.drawer = null;
    }

    if (this.itemDrawer) {
      this.itemDrawer.destroy();
      this.itemDrawer = null;
    }

    if (this.gamePreview) {
      this.gamePreview.destroy();
      this.gamePreview = null;
    }

    stopMusic();
  }
}
