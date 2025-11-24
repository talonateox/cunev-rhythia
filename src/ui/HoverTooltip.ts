import { GameObject } from "../atoms/Object";
import { drawPanel } from "./draw";
import { drawText, measureText } from "../utils/text";
import { Vector2 } from "raylib";
import { Rhythia } from "../atoms/Rhythia";
import { lerpDelta } from "../utils/lerp";

interface TooltipContent {
  title?: string;
  text: string;
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const next = current ? current + " " + w : w;
    const size = measureText(next, fontSize, 1);
    if (size.width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export class HoverTooltipOverlay {
  private static current: TooltipContent | null = null;
  private static visible: boolean = false;
  private static instanceCount = 0;
  private readonly obj: GameObject;
  private static progress: number = 0; 
  private static anchor: { x: number; y: number } | null = null;

  constructor() {
    HoverTooltipOverlay.instanceCount++;
    this.obj = new GameObject({ zBase: 20 });
    this.obj.onDraw = () => this.draw();
    this.obj.onUpdate = () => this.update();
  }

  public static set(content: TooltipContent, anchor?: { x: number; y: number }): void {
    this.current = content;
    this.visible = true;
    this.anchor = anchor ?? null;
  }

  public static clear(): void {
    
    this.visible = false;
  }

  private update(): void {
    
    const target = HoverTooltipOverlay.visible && HoverTooltipOverlay.current ? 1 : 0;
    HoverTooltipOverlay.progress = lerpDelta(HoverTooltipOverlay.progress, target, 0.22);
    
    if (target === 0 && HoverTooltipOverlay.progress <= 0.01) {
      HoverTooltipOverlay.current = null;
      HoverTooltipOverlay.anchor = null;
    }
  }

  private draw(): void {
    const p = HoverTooltipOverlay.progress;
    if (p <= 0.01 || !HoverTooltipOverlay.current) return;

    const paddingX = 14;
    const paddingY = 12;
    const maxWidth = 520;
    const titleSize = 28;
    const bodySize = 20;
    const margin = 12;
    let startY = margin;

    const title = HoverTooltipOverlay.current.title?.trim();
    const text = HoverTooltipOverlay.current.text.trim();

    const bodyLines = wrapText(text, maxWidth, bodySize);
    const titleMetrics = title
      ? measureText(title, titleSize, 1)
      : { width: 0, height: 0 };
    let contentWidth = Math.max(
      title ? titleMetrics.width : 0,
      ...bodyLines.map((l) => measureText(l, bodySize, 1).width)
    );
    contentWidth = Math.min(Math.max(180, contentWidth), maxWidth);

    let contentHeight = 0;
    if (title) contentHeight += titleSize + 2;
    if (title) contentHeight += 6; 
    contentHeight += bodyLines.length * (bodySize + 2);

    const panelW = Math.ceil(contentWidth + paddingX * 2);
    const panelH = Math.ceil(contentHeight + paddingY * 2);
    
    let startX = Math.max(margin, Rhythia.gameWidth - panelW - margin);
    if (HoverTooltipOverlay.anchor) {
      startX = Math.max(margin, Math.min(HoverTooltipOverlay.anchor.x, Rhythia.gameWidth - panelW - margin));
      startY = Math.max(margin, Math.min(HoverTooltipOverlay.anchor.y, Rhythia.gameHeight - panelH - margin));
    }
    const slideXOffset = Math.round((1 - p) * 18); 

    
    drawPanel(
      startX + slideXOffset,
      startY,
      panelW,
      panelH,
      { r: 25, g: 25, b: 32, a: Math.round(230 * p) },
      { r: 120, g: 150, b: 200, a: Math.round(255 * p) },
      2
    );

    let cursorY = startY + paddingY;
    if (title) {
      drawText(
        title,
        Vector2(startX + paddingX + slideXOffset, cursorY),
        titleSize,
        { r: 230, g: 235, b: 245, a: Math.round(255 * p) },
        "left"
      );
      cursorY += titleSize + 8;
    }

    for (const line of bodyLines) {
      drawText(
        line,
        Vector2(startX + paddingX + slideXOffset, cursorY),
        bodySize,
        { r: 190, g: 195, b: 210, a: Math.round(255 * p) },
        "left"
      );
      cursorY += bodySize + 2;
    }
  }
}
