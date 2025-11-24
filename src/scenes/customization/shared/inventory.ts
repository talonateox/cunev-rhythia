import { Color, Vector2 } from "raylib";
import { drawText } from "../../../utils/text";
import { drawSprite } from "../../../utils/sprite";
import type {
  CustomizationInventoryItem,
  InventoryRarity,
} from "../../../utils/gameSettingsSchema";
import type { GameButtonThemeOverrides } from "../atoms/GameButton";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function lighten(color: Color, amount: number): Color {
  const f = clamp(amount, 0, 1);
  const up = (v: number) => Math.round(v + (255 - v) * f);
  return { r: up(color.r), g: up(color.g), b: up(color.b), a: color.a } as Color;
}

export function rarityColor(rarity: InventoryRarity): Color {
  switch (rarity) {
    case "Uncommon":
      return { r: 90, g: 190, b: 120, a: 255 };
    case "Rare":
      return { r: 95, g: 140, b: 220, a: 255 };
    case "Legendary":
      return { r: 220, g: 180, b: 80, a: 255 };
    default:
      return { r: 140, g: 140, b: 150, a: 255 };
  }
}

export function createInventoryButtonTheme(
  rarity: InventoryRarity
): GameButtonThemeOverrides {
  const baseBorder = rarityColor(rarity);
  const hoverBorder = lighten(baseBorder, 0.25);
  const tileBase: Color = { r: 55, g: 55, b: 65, a: 255 };

  return {
    background: {
      default: tileBase,
      hovered: lighten(tileBase, 0.12),
    },
    border: {
      default: baseBorder,
      hovered: hoverBorder,
    },
    text: {
      default: { r: 255, g: 255, b: 255, a: 255 },
    },
  };
}

function withOpacity(color: Color, opacity: number): Color {
  const a = clamp(opacity, 0, 1);
  const baseA = color.a ?? 255;
  return { r: color.r, g: color.g, b: color.b, a: Math.round(baseA * a) };
}

export function renderInventoryTileContent(
  item: CustomizationInventoryItem,
  bounds: { x: number; y: number; width: number; height: number },
  opacity: number
): void {
  const { x, y, width } = bounds;
  const centerX = x + width / 2;

  const titleColor = withOpacity({ r: 240, g: 240, b: 250, a: 255 }, opacity);
  const rarityCol = withOpacity(rarityColor(item.rarity), opacity);

  drawText(item.name, Vector2(centerX, y + 16), 22, titleColor, "center");
  drawText(item.rarity, Vector2(centerX, y + 46), 18, rarityCol, "center");

  const icon = item.iconPath ?? "/fav.png";
  const size = width * 0.55;
  const iconX = centerX - size / 2;
  const iconY = y + 68;
  drawSprite(icon, Vector2(iconX, iconY), Vector2(size, size), {
    r: 255,
    g: 255,
    b: 255,
    a: Math.round(255 * opacity),
  });
}
