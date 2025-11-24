import { Color, Vector2, DrawRectangle } from "raylib";
import { drawText, measureText } from "./text";
import { Rhythia } from "../atoms/Rhythia";

interface ToastOptions {
  duration?: number;
  color?: Color;
}

interface ActiveToast {
  id: number;
  message: string;
  duration: number;
  elapsed: number;
  color: Color;
}

class ToastManager {
  private readonly defaultDuration = 2.5;
  private toasts: ActiveToast[] = [];
  private nextId = 1;

  public show(message: string, options: ToastOptions = {}): void {
    if (!message) return;

    const duration = Math.max(0.3, options.duration ?? this.defaultDuration);
    const baseColor = options.color ?? { r: 255, g: 255, b: 255, a: 255 };

    this.toasts.push({
      id: this.nextId++,
      message,
      duration,
      elapsed: 0,
      color: { ...baseColor },
    });
  }

  public update(deltaSeconds: number): void {
    if (!this.toasts.length) return;

    this.toasts.forEach((toast) => {
      toast.elapsed += deltaSeconds;
    });

    this.toasts = this.toasts.filter((toast) => toast.elapsed < toast.duration);
  }

  public draw(): void {
    if (!this.toasts.length) return;

    const baseX = Math.max(32, Rhythia.gameWidth * 0.05);
    const baseY = Rhythia.gameHeight - 64;
    const lineSpacing = 36;
    const paddingX = 14;
    const paddingY = 8;
    const fontSize = 28;

    const sortedToasts = [...this.toasts].sort((a, b) => b.id - a.id);
    sortedToasts.forEach((toast, index) => {
      const alpha = this.calculateAlpha(toast);
      if (alpha <= 0) return;

      const y = baseY - index * lineSpacing;
      const effectiveAlpha = Math.round(alpha * 255);
      const textColor = {
        r: toast.color.r,
        g: toast.color.g,
        b: toast.color.b,
        a: effectiveAlpha,
      };
      const shadowColor = { r: 0, g: 0, b: 0, a: effectiveAlpha };
      const { width, height } = measureText(toast.message, fontSize);
      const rectX = Math.round(baseX - paddingX);
      const rectY = Math.round(y - paddingY / 2);
      const rectWidth = Math.round(width + paddingX * 2);
      const rectHeight = Math.round(height + paddingY);
      const backgroundColor: Color = {
        r: 6,
        g: 6,
        b: 6,
        a: Math.round(effectiveAlpha * 0.75),
      };

      DrawRectangle(rectX, rectY, rectWidth, rectHeight, backgroundColor);

      drawText(toast.message, Vector2(baseX + 2, y + 2), fontSize, shadowColor);
      drawText(toast.message, Vector2(baseX, y), fontSize, textColor);
    });
  }

  private calculateAlpha(toast: ActiveToast): number {
    const fadeInDuration = 0.15;
    const fadeOutDuration = 0.4;

    let alpha = 1;

    if (toast.elapsed < fadeInDuration) {
      alpha *= toast.elapsed / fadeInDuration;
    }

    const timeRemaining = toast.duration - toast.elapsed;
    if (timeRemaining < fadeOutDuration) {
      alpha *= Math.max(0, timeRemaining / fadeOutDuration);
    }

    return Math.max(0, Math.min(1, alpha));
  }

  public clear(): void {
    this.toasts = [];
    this.nextId = 1;
  }
}

export const toastManager = new ToastManager();
