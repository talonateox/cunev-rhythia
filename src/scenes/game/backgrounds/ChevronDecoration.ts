import { Color, Vector3, DrawTriangle3D } from "raylib";
import { Rhythia } from "../../../atoms/Rhythia";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { BackgroundDecoration } from "./BackgroundDecoration";
import { BackgroundRenderContext } from "./types";

interface TriangleOutline {
  x: number;
  y: number;
  z: number;
  size: number;
  type: "left" | "right";
}

export class ChevronDecoration implements BackgroundDecoration {
  private accentColor: Color = { r: 255, g: 255, b: 255, a: 255 };

  setAccentColor(color: Color): void {
    this.accentColor = color;
  }

  render(context: BackgroundRenderContext): void {
    const chevronOpacity = context.settings.chevronOpacity ?? 0.8;

    if (chevronOpacity <= 0) {
      return;
    }

    if ((context.settings.chevronEnabled ?? 1) < 0.5) {
      return;
    }

    const chevronWidth = context.settings.chevronWidth ?? 4;
    const chevronGap = context.settings.chevronGap ?? 400;
    const chevronSpeedMultiplier = context.settings.chevronSpeedMultiplier ?? 1.0;
    const chevronSmallSize = context.settings.chevronSmallSize ?? 50;
    const chevronLargeSize = context.settings.chevronLargeSize ?? 180;
    const outlines = this.generateOutlines(
      context.msTime,
      chevronGap,
      chevronSpeedMultiplier,
      chevronSmallSize,
      chevronLargeSize
    );
    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;

    for (const outline of outlines) {
      if (outline.z <= -600 || outline.z >= 3200) {
        continue;
      }

      const distanceFromFar = (3000 - outline.z) / 3500;
      const fadeInProgress = Math.min(1, distanceFromFar * 2);
      const finalOpacity = fadeInProgress * chevronOpacity;

      const color = {
        r: this.accentColor.r,
        g: this.accentColor.g,
        b: this.accentColor.b,
        a: Math.round(255 * finalOpacity),
      };

      const baseX = centerX + outline.x;
      const baseY = centerY + outline.y;
      const baseZ = outline.z;
      const size = outline.size;

      const vertexX = outline.type === "right" ? baseX + size : baseX - size;
      const vertexY = baseY + size;
      const top = { x: baseX, y: baseY };
      const vertex = { x: vertexX, y: vertexY };
      const bottom = { x: baseX, y: baseY + 2 * size };
      const centerHint = {
        x: baseX + (outline.type === "right" ? size / 2 : -size / 2),
        y: baseY + size,
      };

      this.drawChevronShape(
        top,
        vertex,
        bottom,
        centerHint,
        baseZ,
        chevronWidth,
        color,
        outline.type === "left"
      );
    }
  }

  private generateOutlines(
    msTime: number,
    gap: number,
    speedMultiplier: number,
    smallSize: number,
    largeSize: number
  ): TriangleOutline[] {
    const outlines: TriangleOutline[] = [];
    const halfGap = Math.max(0, gap / 2);
    const clampedSpeed = Math.min(1.5, Math.max(0.2, speedMultiplier));
    const clampedSmall = Math.max(1, smallSize);
    const clampedLarge = Math.max(1, largeSize);
    const cycleDuration = 4500;
    const travelDistance = 3500;

    for (let i = 0; i < 3; i++) {
      const timeOffset = i * 1500;
      const chevronTime = ((msTime * clampedSpeed + timeOffset) % cycleDuration + cycleDuration) % cycleDuration;
      const progress = chevronTime / cycleDuration;
      const chevronZ = 3000 - progress * travelDistance;
      const isSmall = i % 2 === 0;
      const size = isSmall ? clampedSmall : clampedLarge;
      const yOffset = -size;

      outlines.push({
        x: halfGap,
        y: yOffset,
        z: chevronZ,
        size,
        type: "right",
      });

      outlines.push({
        x: -halfGap,
        y: yOffset,
        z: chevronZ,
        size,
        type: "left",
      });
    }

    return outlines;
  }

  private drawChevronShape(
    top: { x: number; y: number },
    vertex: { x: number; y: number },
    bottom: { x: number; y: number },
    center: { x: number; y: number },
    z: number,
    strokeWeight: number,
    color: Color,
    flipWinding: boolean
  ): void {
    if (strokeWeight <= 0) {
      return;
    }

    const halfWidth = strokeWeight / 2;
    const dirTop = this.normalizeVector(vertex.x - top.x, vertex.y - top.y);
    const dirBottom = this.normalizeVector(bottom.x - vertex.x, bottom.y - vertex.y);

    if (this.isZeroVector(dirTop) || this.isZeroVector(dirBottom)) {
      return;
    }

    const topInnerNormalStart = this.getInwardNormal(dirTop, top, center);
    const topInnerNormalVertex = this.getInwardNormal(dirTop, vertex, center);
    const bottomInnerNormalVertex = this.getInwardNormal(dirBottom, vertex, center);
    const bottomInnerNormalEnd = this.getInwardNormal(dirBottom, bottom, center);

    const topOuter = this.offsetPoint(top, this.negate(topInnerNormalStart), halfWidth);
    const topInner = this.offsetPoint(top, topInnerNormalStart, halfWidth);
    const bottomOuter = this.offsetPoint(bottom, this.negate(bottomInnerNormalEnd), halfWidth);
    const bottomInner = this.offsetPoint(bottom, bottomInnerNormalEnd, halfWidth);

    const vertexInner = this.intersectOffsetLines(
      vertex,
      this.negate(dirTop),
      topInnerNormalVertex,
      dirBottom,
      bottomInnerNormalVertex,
      halfWidth
    );
    const vertexOuter = this.intersectOffsetLines(
      vertex,
      this.negate(dirTop),
      this.negate(topInnerNormalVertex),
      dirBottom,
      this.negate(bottomInnerNormalVertex),
      halfWidth
    );

    this.drawQuad3D(
      { x: topOuter.x, y: topOuter.y, z },
      { x: topInner.x, y: topInner.y, z },
      { x: vertexInner.x, y: vertexInner.y, z },
      { x: vertexOuter.x, y: vertexOuter.y, z },
      color,
      flipWinding
    );

    this.drawQuad3D(
      { x: vertexOuter.x, y: vertexOuter.y, z },
      { x: vertexInner.x, y: vertexInner.y, z },
      { x: bottomInner.x, y: bottomInner.y, z },
      { x: bottomOuter.x, y: bottomOuter.y, z },
      color,
      flipWinding
    );
  }

  private drawQuad3D(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
    p3: { x: number; y: number; z: number },
    p4: { x: number; y: number; z: number },
    color: Color,
    flipWinding: boolean
  ): void {
    if (flipWinding) {
      DrawTriangle3D(
        Vector3(p1.x, p1.y, p1.z),
        Vector3(p3.x, p3.y, p3.z),
        Vector3(p2.x, p2.y, p2.z),
        color
      );

      DrawTriangle3D(
        Vector3(p1.x, p1.y, p1.z),
        Vector3(p4.x, p4.y, p4.z),
        Vector3(p3.x, p3.y, p3.z),
        color
      );
    } else {
      DrawTriangle3D(
        Vector3(p1.x, p1.y, p1.z),
        Vector3(p2.x, p2.y, p2.z),
        Vector3(p3.x, p3.y, p3.z),
        color
      );

      DrawTriangle3D(
        Vector3(p1.x, p1.y, p1.z),
        Vector3(p3.x, p3.y, p3.z),
        Vector3(p4.x, p4.y, p4.z),
        color
      );
    }
  }

  private intersectOffsetLines(
    vertex: { x: number; y: number },
    dirA: { x: number; y: number },
    normalA: { x: number; y: number },
    dirB: { x: number; y: number },
    normalB: { x: number; y: number },
    halfWidth: number
  ): { x: number; y: number } {
    const startA = this.offsetPoint(vertex, normalA, halfWidth);
    const startB = this.offsetPoint(vertex, normalB, halfWidth);
    const denominator = dirA.x * dirB.y - dirA.y * dirB.x;

    if (Math.abs(denominator) < 1e-5) {
      return {
        x: vertex.x + (normalA.x + normalB.x) * halfWidth * 0.5,
        y: vertex.y + (normalA.y + normalB.y) * halfWidth * 0.5,
      };
    }

    const diffX = startB.x - startA.x;
    const diffY = startB.y - startA.y;
    const t = (diffX * dirB.y - diffY * dirB.x) / denominator;

    return {
      x: startA.x + dirA.x * t,
      y: startA.y + dirA.y * t,
    };
  }

  private offsetPoint(
    point: { x: number; y: number },
    normal: { x: number; y: number },
    halfWidth: number
  ): { x: number; y: number } {
    return {
      x: point.x + normal.x * halfWidth,
      y: point.y + normal.y * halfWidth,
    };
  }

  private negate(value: { x: number; y: number }): { x: number; y: number } {
    return { x: -value.x, y: -value.y };
  }

  private normalizeVector(x: number, y: number): { x: number; y: number } {
    const length = Math.sqrt(x * x + y * y);
    if (length === 0) {
      return { x: 0, y: 0 };
    }

    return { x: x / length, y: y / length };
  }

  private isZeroVector(value: { x: number; y: number }): boolean {
    return value.x === 0 && value.y === 0;
  }

  private getInwardNormal(
    direction: { x: number; y: number },
    point: { x: number; y: number },
    center: { x: number; y: number }
  ): { x: number; y: number } {
    const leftNormal = { x: -direction.y, y: direction.x };
    const rightNormal = { x: direction.y, y: -direction.x };
    const toCenter = { x: center.x - point.x, y: center.y - point.y };
    const cross = direction.x * toCenter.y - direction.y * toCenter.x;

    let chosen: { x: number; y: number };

    if (Math.abs(cross) < 1e-5) {
      const dotLeft = leftNormal.x * toCenter.x + leftNormal.y * toCenter.y;
      const dotRight = rightNormal.x * toCenter.x + rightNormal.y * toCenter.y;
      chosen = dotLeft >= dotRight ? leftNormal : rightNormal;
    } else {
      chosen = cross >= 0 ? leftNormal : rightNormal;
    }

    return this.normalizeVector(chosen.x, chosen.y);
  }
}

registerCustomization(
  "ChevronDecoration",
  {
    id: "item-chevron",
    name: "Chevron",
    rarity: "Common",
    description: "",
    settingsCategory: "chevron",
    iconPath: "/item-chevron.png",
  } as const,
  [
    {
      key: "chevronEnabled",
      label: "Enabled",
      defaultValue: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "chevron",
    },
    {
      key: "chevronOpacity",
      label: "Chevron Opacity",
      defaultValue: 0.4,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Background",
      itemCategory: "chevron",
    },
    {
      key: "chevronWidth",
      label: "Chevron Width",
      defaultValue: 12,
      min: 1,
      max: 20,
      step: 1,
      category: "Background",
      itemCategory: "chevron",
    },
    {
      key: "chevronGap",
      label: "Chevron Middle Gap",
      defaultValue: 2200,
      min: 0,
      max: 2200,
      step: 10,
      category: "Background",
      itemCategory: "chevron",
    },
    {
      key: "chevronSpeedMultiplier",
      label: "Chevron Speed",
      defaultValue: 0.7,
      min: 0.2,
      max: 1.5,
      step: 0.05,
      category: "Background",
      itemCategory: "chevron",
    },
    {
      key: "chevronSmallSize",
      label: "Chevron Small Size",
      defaultValue: 260,
      min: 10,
      max: 1200,
      step: 5,
      category: "Background",
      itemCategory: "chevron",
    },
    {
      key: "chevronLargeSize",
      label: "Chevron Large Size",
      defaultValue: 255,
      min: 10,
      max: 1200,
      step: 5,
      category: "Background",
      itemCategory: "chevron",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);
