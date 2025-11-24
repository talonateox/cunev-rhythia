import {
  CUSTOMIZATION_INVENTORY_ITEMS,
  getSettingsByItem,
  type CustomizationInventoryItem,
  type ItemSettingsCategory,
} from "../../../utils/gameSettingsSchema";

const GENERAL = new Set<string>([
  "system-core",
  "system-cursor",
  "system-visuals",
  "system-interface",
  "system-colors",
]);

const BACKGROUNDS = new Set<string>([
  "grid",
  "tunnel",
  "rays",
  "chevron",
  "video-background",
]);

const CURSOR_DECOR = new Set<string>([
  "cursorRainbow",
  "customCursor",
  "spaceCursor",
  "starTrail",
]);

const UI_DECOR = new Set<string>(["bongoCat", "xpTopBar"]);

const PARTICLES = new Set<string>(["burstParticle"]);

function matchesSearchTerm(item: CustomizationInventoryItem, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  const nameHit = (item.name || "").toLowerCase().includes(t);
  const descHit = (item.description || "").toLowerCase().includes(t);
  let settingsHit = false;
  try {
    const defs = getSettingsByItem(item.settingsCategory as any);
    settingsHit = defs.some(
      (d) => d.label?.toLowerCase().includes(t) || d.key?.toLowerCase().includes(t)
    );
  } catch {}
  return nameHit || descHit || settingsHit;
}

export function partitionForMainDrawer(
  searchTerm: string
): Array<{ label: string; items: CustomizationInventoryItem[] }> {
  const consumed = new Set<string>();
  const filter = (set: Set<string>) =>
    CUSTOMIZATION_INVENTORY_ITEMS.filter((i) => {
      const inGroup = set.has(i.settingsCategory);
      const hit = inGroup && matchesSearchTerm(i, searchTerm);
      if (hit) consumed.add(i.settingsCategory);
      return hit;
    });

  const general = filter(GENERAL);

  const hidden = new Set<string>([...BACKGROUNDS, ...CURSOR_DECOR, ...UI_DECOR]);
  hidden.forEach((c) => consumed.add(c));
  for (const c of PARTICLES) consumed.add(c);

  const misc = CUSTOMIZATION_INVENTORY_ITEMS.filter(
    (i) => !consumed.has(i.settingsCategory) && matchesSearchTerm(i, searchTerm)
  );

  const sections: Array<{ label: string; items: CustomizationInventoryItem[] }> = [];
  if (general.length > 0) sections.push({ label: "General", items: general });
  if (misc.length > 0) sections.push({ label: "Misc", items: misc });
  return sections;
}

export function nestedForParent(
  parent: ItemSettingsCategory
): { label: string; items: CustomizationInventoryItem[] } | null {
  let source: Set<string> | null = null;
  let label: string | null = null;

  if (parent === ("system-cursor" as any)) {
    source = CURSOR_DECOR;
    label = "Decorations";
  } else if (parent === ("system-visuals" as any)) {
    source = new Set<string>([...BACKGROUNDS, ...PARTICLES]);
    label = "Decorations";
  } else if (parent === ("system-interface" as any)) {
    source = UI_DECOR;
    label = "Panel Decorations";
  }

  if (!source || !label) return null;
  const items = CUSTOMIZATION_INVENTORY_ITEMS.filter((i) => source!.has(i.settingsCategory));
  if (items.length === 0) return null;
  return { label, items };
}
