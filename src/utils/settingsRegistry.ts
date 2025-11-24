export type InventoryRarity = "Common" | "Uncommon" | "Rare" | "Legendary";

export type ItemSettingsCategory = string;

export interface GameSettingDefinition {
  key: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  category?: string;
  itemCategory?: ItemSettingsCategory;
}

export interface CustomizationInventoryItem<Category extends ItemSettingsCategory = ItemSettingsCategory> {
  id: string;
  name: string;
  rarity: InventoryRarity;
  description: string;
  settingsCategory: Category;
  iconPath?: string;
}

export interface ItemSettingMetadata {
  label: string;
  description: string;
  rarity: InventoryRarity;
  iconPath?: string;
}

interface StoredSettingDefinition {
  def: GameSettingDefinition;
  priority: number;
  order: number;
}

interface StoredCustomizationItem {
  item: CustomizationInventoryItem;
  priority: number;
  order: number;
}

export interface RegisterOptions {
  priority?: number;
}

const DEFAULT_PRIORITY = 10;

let nextSettingOrder = 0;
let nextItemOrder = 0;

const settingsStore: StoredSettingDefinition[] = [];
const customizationItemsStore: StoredCustomizationItem[] = [];
const itemMetadataStore = new Map<string, ItemSettingMetadata>();
const registeredSettingKeys = new Set<string>();
const registeredItemCategories = new Set<ItemSettingsCategory>();

function normalizePriority(priority?: number): number {
  if (priority === undefined) {
    return DEFAULT_PRIORITY;
  }
  return priority;
}

export function registerSettings<const T extends readonly GameSettingDefinition[]>(
  owner: string,
  definitions: T,
  options?: RegisterOptions
): T {
  const priority = normalizePriority(options?.priority);

  definitions.forEach((definition) => {
    if (registeredSettingKeys.has(definition.key)) {
      throw new Error(
        `Duplicate game setting key "${definition.key}" registered by ${owner}`
      );
    }
    registeredSettingKeys.add(definition.key);
    settingsStore.push({
      def: { ...definition },
      priority,
      order: nextSettingOrder++,
    });
  });

  return definitions;
}

export function registerCustomizationItem<
  const Category extends ItemSettingsCategory,
  const T extends CustomizationInventoryItem<Category>
>(
  item: T,
  options?: RegisterOptions
): T {
  const priority = normalizePriority(options?.priority);
  if (registeredItemCategories.has(item.settingsCategory)) {
    throw new Error(
      `Duplicate customization item category "${item.settingsCategory}"`
    );
  }

  registeredItemCategories.add(item.settingsCategory);
  customizationItemsStore.push({
    item: { ...item },
    priority,
    order: nextItemOrder++,
  });

  itemMetadataStore.set(item.settingsCategory, {
    label: item.name,
    description: item.description,
    rarity: item.rarity,
    iconPath: item.iconPath,
  });

  return item;
}

export function registerCustomization<
  const Category extends ItemSettingsCategory,
  const TItem extends CustomizationInventoryItem<Category>,
  const TSettings extends readonly (GameSettingDefinition & {
    itemCategory: Category;
  })[]
>(
  owner: string,
  item: TItem,
  definitions: TSettings,
  options?: RegisterOptions
): { item: TItem; settings: TSettings } {
  const registeredItem = registerCustomizationItem(item, options);
  definitions.forEach((definition) => {
    if (definition.itemCategory !== item.settingsCategory) {
      throw new Error(
        `Setting "${definition.key}" itemCategory "${definition.itemCategory}" does not match customization category "${item.settingsCategory}"`
      );
    }
  });
  const registeredSettings = registerSettings(owner, definitions, options);
  return { item: registeredItem, settings: registeredSettings };
}

export function getRegisteredSettings(): GameSettingDefinition[] {
  return settingsStore
    .slice()
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .map((entry) => entry.def);
}

export function getRegisteredCustomizationItems(): CustomizationInventoryItem[] {
  return customizationItemsStore
    .slice()
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .map((entry) => entry.item);
}

export function getItemSettingMetadata(): Record<ItemSettingsCategory, ItemSettingMetadata> {
  const metadata: Record<ItemSettingsCategory, ItemSettingMetadata> = {};
  itemMetadataStore.forEach((value, key) => {
    metadata[key] = value;
  });
  return metadata;
}

export type GameSettingKey = string;

export type GameSettings = Record<GameSettingKey, number>;

export function resetSettingsRegistryForTests(): void {
  settingsStore.length = 0;
  customizationItemsStore.length = 0;
  itemMetadataStore.clear();
  registeredSettingKeys.clear();
  registeredItemCategories.clear();
  nextSettingOrder = 0;
  nextItemOrder = 0;
}
