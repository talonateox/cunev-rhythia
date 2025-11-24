import {
  registerCustomization,
  getRegisteredCustomizationItems,
  getRegisteredSettings,
  getItemSettingMetadata,
  type CustomizationInventoryItem,
  type GameSettingDefinition,
  type GameSettingKey,
  type GameSettings,
  type InventoryRarity,
  type ItemSettingMetadata,
  type ItemSettingsCategory,
} from "./settingsRegistry";

import "../scenes/game/backgrounds/TunnelDecoration";
import "../scenes/game/backgrounds/RayDecoration";
import "../scenes/game/backgrounds/ChevronDecoration";
import "../scenes/game/backgrounds/GridDecoration";
import "../scenes/game/backgrounds/VideoBackgroundDecoration";
import "../scenes/game/cursorEffects/TrailEffect";
import "../scenes/game/cursorEffects/CustomCursorTrailEffect";
import "../scenes/game/cursorEffects/StarTrailEffect";
import "../scenes/game/cursorEffects/SpaceCursorEffect";
import "../scenes/game/panel-decorations/BongoCatDecoration";
import "../scenes/game/panel-decorations/WinXpTopBarDecoration";
import "../scenes/game/hitParticles/BurstParticleEffect";

const PLACEHOLDER_ICON_PATH = "/customize.png" as const;

const SYSTEM_CORE_CATEGORY = "system-core" as const;
registerCustomization(
  "SystemCoreSettings",
  {
    id: "item-system-core",
    name: "System",
    rarity: "Common",
    description: "",
    settingsCategory: SYSTEM_CORE_CATEGORY,
    iconPath: "/item-settings.png",
  } as const,
  [
    
    {
      key: "globalOffset",
      label: "Global Offset (ms)",
      defaultValue: 0,
      min: -160,
      max: 160,
      step: 1,
      category: "Timing",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    
    {
      key: "approachRate",
      label: "Approach Rate",
      defaultValue: 20.5,
      min: 1,
      max: 60,
      step: 0.5,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "approachDistance",
      label: "Approach Distance",
      defaultValue: 24,
      min: 0,
      max: 60,
      step: 0.5,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "fadeIn",
      label: "Fade In (%)",
      defaultValue: 100,
      min: 0,
      max: 100,
      step: 5,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "fadeOut",
      label: "Fade Out",
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 1,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "noteMaxOpacity",
      label: "Note Max Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "pushback",
      label: "Pushback",
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 1,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "squareScale",
      label: "Square Scale",
      defaultValue: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.05,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "playfieldScale",
      label: "Playfield Scale",
      defaultValue: 1.0,
      min: 0.5,
      max: 5.0,
      step: 0.05,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "tiltAmount",
      label: "Tilt Amount",
      defaultValue: 4,
      min: 0,
      max: 10,
      step: 0.1,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "playfieldDistance",
      label: "Playfield Distance",
      defaultValue: 200,
      min: 150,
      max: 500,
      step: 10,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "mouseBoundRate",
      label: "Mouse Bound Rate",
      defaultValue: 1.0,
      min: 0.7,
      max: 2.0,
      step: 0.05,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "backgroundTiltRate",
      label: "Background Tilt Rate",
      defaultValue: 1.9,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "borderTargetOpacity",
      label: "Border Target Opacity",
      defaultValue: 0.8,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
    {
      key: "borderStaleOpacity",
      label: "Border Stale Opacity",
      defaultValue: 0.25,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Game Field",
      itemCategory: SYSTEM_CORE_CATEGORY,
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 0 }
);

const SYSTEM_CURSOR_CATEGORY = "system-cursor" as const;
registerCustomization(
  "SystemCursorSettings",
  {
    id: "item-system-cursor",
    name: "Cursor",
    rarity: "Common",
    description: "",
    settingsCategory: SYSTEM_CURSOR_CATEGORY,
    iconPath: "/item-default-cursor.png",
  } as const,
  [
    {
      key: "mouseSensitivity",
      label: "Mouse Sensitivity",
      defaultValue: 0.65,
      min: 0.01,
      max: 5.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: SYSTEM_CURSOR_CATEGORY,
    },
    {
      key: "cursorScale",
      label: "Cursor Scale",
      defaultValue: 1.7,
      min: 0.1,
      max: 25.0,
      step: 0.1,
      category: "Cursor",
      itemCategory: SYSTEM_CURSOR_CATEGORY,
    },
    {
      key: "cursorOpacity",
      label: "Cursor Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Cursor",
      itemCategory: SYSTEM_CURSOR_CATEGORY,
    },
    {
      key: "cursorTrailFadeRate",
      label: "Trail Fade Rate",
      defaultValue: 14,
      min: 1,
      max: 35,
      step: 1,
      category: "Cursor",
      itemCategory: SYSTEM_CURSOR_CATEGORY,
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 0 }
);

const SYSTEM_VISUALS_CATEGORY = "system-visuals" as const;
registerCustomization(
  "SystemVisualSettings",
  {
    id: "item-system-visuals",
    name: "Background",
    rarity: "Common",
    description: "",
    settingsCategory: SYSTEM_VISUALS_CATEGORY,
    iconPath: "/item-visual.png",
  } as const,
  [
    {
      key: "coverOpacity",
      label: "Cover Image Opacity",
      defaultValue: 0.2,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Background",
      itemCategory: SYSTEM_VISUALS_CATEGORY,
    },
    {
      key: "screenClearRed",
      label: "Screen Clear Red",
      defaultValue: 5,
      min: 0,
      max: 255,
      step: 1,
      category: "Background",
      itemCategory: SYSTEM_VISUALS_CATEGORY,
    },
    {
      key: "screenClearGreen",
      label: "Screen Clear Green",
      defaultValue: 5,
      min: 0,
      max: 255,
      step: 1,
      category: "Background",
      itemCategory: SYSTEM_VISUALS_CATEGORY,
    },
    {
      key: "screenClearBlue",
      label: "Screen Clear Blue",
      defaultValue: 5,
      min: 0,
      max: 255,
      step: 1,
      category: "Background",
      itemCategory: SYSTEM_VISUALS_CATEGORY,
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 0 }
);

const SYSTEM_INTERFACE_CATEGORY = "system-interface" as const;
registerCustomization(
  "SystemInterfaceSettings",
  {
    id: "item-system-interface",
    name: "Interface",
    rarity: "Common",
    description: "",
    settingsCategory: SYSTEM_INTERFACE_CATEGORY,
    iconPath: "/item-interface.png",
  } as const,
  [
    {
      key: "uiTiltRate",
      label: "UI Tilt Rate",
      defaultValue: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      category: "UI",
      itemCategory: SYSTEM_INTERFACE_CATEGORY,
    },
    {
      key: "uiOpacity",
      label: "UI Opacity",
      defaultValue: 0.2,
      min: 0.0,
      max: 0.2,
      step: 0.01,
      category: "UI",
      itemCategory: SYSTEM_INTERFACE_CATEGORY,
    },
    {
      key: "uiScale",
      label: "UI Scale",
      defaultValue: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.05,
      category: "UI",
      itemCategory: SYSTEM_INTERFACE_CATEGORY,
    },
    {
      key: "healthBarWidth",
      label: "Health Bar Width",
      defaultValue: 290,
      min: 50,
      max: 800,
      step: 5,
      category: "UI",
      itemCategory: SYSTEM_INTERFACE_CATEGORY,
    },
    {
      key: "healthBarHeight",
      label: "Health Bar Height",
      defaultValue: 5,
      min: 5,
      max: 50,
      step: 1,
      category: "UI",
      itemCategory: SYSTEM_INTERFACE_CATEGORY,
    },
    {
      key: "healthBarOpacity",
      label: "Health Bar Opacity",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "UI",
      itemCategory: SYSTEM_INTERFACE_CATEGORY,
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 0 }
);

const SYSTEM_COLORS_CATEGORY = "system-colors" as const;
registerCustomization(
  "SystemColorPalettes",
  {
    id: "item-system-colors",
    name: "Colors",
    rarity: "Common",
    description: "",
    settingsCategory: SYSTEM_COLORS_CATEGORY,
    iconPath: "/item-colors.png",
  } as const,
  [] as const,
  { priority: 0 }
);

export type GameConfigKey<K extends GameSettingKey = GameSettingKey> =
  `game${Capitalize<K>}`;

export function toGameConfigKey<K extends GameSettingKey>(
  key: K
): GameConfigKey<K> {
  return `game${key.charAt(0).toUpperCase()}${key.slice(
    1
  )}` as GameConfigKey<K>;
}

export const GAME_SETTINGS_SCHEMA = getRegisteredSettings();
export const CUSTOMIZATION_INVENTORY_ITEMS = getRegisteredCustomizationItems();
export const ITEM_SETTING_METADATA = getItemSettingMetadata();

export function getDefaultGameSettings(): GameSettings {
  const defaults: GameSettings = {} as GameSettings;
  GAME_SETTINGS_SCHEMA.forEach((setting) => {
    defaults[setting.key] = setting.defaultValue;
  });
  return defaults;
}

export function getGameSettingByKey(
  key: string
): GameSettingDefinition | undefined {
  return GAME_SETTINGS_SCHEMA.find((setting) => setting.key === key);
}

export function getUniqueCategories(): string[] {
  const categories = new Set<string>();
  GAME_SETTINGS_SCHEMA.forEach((setting) => {
    if (setting.category && !setting.itemCategory) {
      categories.add(setting.category);
    }
  });
  return Array.from(categories).sort();
}

export function getSettingsByCategory(
  category: string
): GameSettingDefinition[] {
  return GAME_SETTINGS_SCHEMA.filter(
    (setting) => setting.category === category && !setting.itemCategory
  );
}

export function getUniqueItemCategories(): ItemSettingsCategory[] {
  const categories = new Set<ItemSettingsCategory>();
  GAME_SETTINGS_SCHEMA.forEach((setting) => {
    if (setting.itemCategory) {
      categories.add(setting.itemCategory as ItemSettingsCategory);
    }
  });
  return Array.from(categories);
}

export function getSettingsByItem(
  itemCategory: ItemSettingsCategory
): GameSettingDefinition[] {
  return GAME_SETTINGS_SCHEMA.filter(
    (setting) => setting.itemCategory === itemCategory
  );
}

export type {
  GameSettingDefinition,
  GameSettingKey,
  GameSettings,
  CustomizationInventoryItem,
  ItemSettingMetadata,
  ItemSettingsCategory,
  InventoryRarity,
};
