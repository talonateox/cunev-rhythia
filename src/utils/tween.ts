export interface TimerController {
  paused: boolean;
  cancel(): void;
  onEnd(action: () => void): void;
  then(action: () => void): TimerController;
}

export interface TweenController extends TimerController {}

class CustomTween<T> implements TweenController {
  public paused = false;
  private cancelled = false;
  private startTime: number;
  private endCallbacks: (() => void)[] = [];
  private completed = false;

  constructor(
    private from: T,
    private to: T,
    private duration: number,
    private setValue: (value: T) => void,
    private easeFunc: (t: number) => number = (t) => t
  ) {
    this.startTime = performance.now();
  }

  update(): boolean {
    if (this.cancelled || this.completed) {
      return false;
    }

    if (this.paused) {
      this.startTime = performance.now() - this.getElapsedTime() * 1000;
      return true;
    }

    const elapsed = this.getElapsedTime();
    const progress = Math.min(elapsed / this.duration, 1);
    const easedProgress = this.easeFunc(progress);

    const interpolated = this.interpolate(this.from, this.to, easedProgress);
    this.setValue(interpolated);

    if (progress >= 1) {
      this.completed = true;
      this.endCallbacks.forEach((callback) => callback());
      return false;
    }

    return true;
  }

  private getElapsedTime(): number {
    return (performance.now() - this.startTime) / 1000;
  }

  private interpolate(from: T, to: T, t: number): T {
    if (typeof from === "number" && typeof to === "number") {
      return (from + (to - from) * t) as T;
    }

    if (
      typeof from === "object" &&
      from !== null &&
      "x" in from &&
      "y" in from
    ) {
      const fromVec = from as any;
      const toVec = to as any;
      return {
        x: fromVec.x + (toVec.x - fromVec.x) * t,
        y: fromVec.y + (toVec.y - fromVec.y) * t,
      } as T;
    }

    if (
      typeof from === "object" &&
      from !== null &&
      "r" in from &&
      "g" in from &&
      "b" in from
    ) {
      const fromColor = from as any;
      const toColor = to as any;
      return {
        r: fromColor.r + (toColor.r - fromColor.r) * t,
        g: fromColor.g + (toColor.g - fromColor.g) * t,
        b: fromColor.b + (toColor.b - fromColor.b) * t,
        a:
          fromColor.a !== undefined
            ? fromColor.a + (toColor.a - fromColor.a) * t
            : undefined,
      } as T;
    }

    return to;
  }

  cancel(): void {
    this.cancelled = true;
  }

  onEnd(action: () => void): void {
    this.endCallbacks.push(action);
  }

  then(action: () => void): TimerController {
    this.onEnd(action);
    return this;
  }
}

const tweenRegistry: Map<
  string,
  {
    tween: CustomTween<any>;
    from: any;
    to: any;
    duration: number;
    setValue: (value: any) => void;
    easeFunc?: (t: number) => number;
    currentValue: any;
    completed: boolean;
  }
> = new Map();

const activeTweens: CustomTween<any>[] = [];

export function tween<T>(
  from: T,
  to: T,
  duration: number,
  setValue: (value: T) => void,
  easeFunc?: (t: number) => number
): TweenController {
  const customTween = new CustomTween(from, to, duration, setValue, easeFunc);
  activeTweens.push(customTween);
  return customTween;
}

export function createTween<T>(
  id: string,
  from: T,
  to: T,
  duration: number,
  setValue: (value: T) => void,
  easeFunc?: (t: number) => number
): TweenController {
  if (tweenRegistry.has(id)) {
    tweenRegistry.get(id)?.tween.cancel();
  }

  const customTween = new CustomTween(
    from,
    to,
    duration,
    (value) => {
      if (tweenRegistry.has(id)) {
        tweenRegistry.get(id)!.currentValue = value;
      }
      setValue(value);
    },
    easeFunc
  );

  tweenRegistry.set(id, {
    tween: customTween,
    from,
    to,
    duration,
    setValue,
    easeFunc,
    currentValue: from,
    completed: false,
  });

  activeTweens.push(customTween);

  customTween.onEnd(() => {
    if (tweenRegistry.has(id)) {
      const info = tweenRegistry.get(id)!;
      info.currentValue = info.to;
      info.completed = true;
    }
  });

  return customTween;
}

export function getTweenValue<T>(id: string): T | undefined {
  const tweenInfo = tweenRegistry.get(id);
  return tweenInfo?.currentValue;
}

export function restartTween(id: string): boolean {
  const tweenInfo = tweenRegistry.get(id);
  if (!tweenInfo) {
    return false;
  }

  tweenInfo.tween.cancel();

  createTween(
    id,
    tweenInfo.from,
    tweenInfo.to,
    tweenInfo.duration,
    tweenInfo.setValue,
    tweenInfo.easeFunc
  );

  return true;
}

export function pauseTween(id: string): boolean {
  const tweenInfo = tweenRegistry.get(id);
  if (!tweenInfo) {
    return false;
  }
  tweenInfo.tween.paused = true;
  return true;
}

export function resumeTween(id: string): boolean {
  const tweenInfo = tweenRegistry.get(id);
  if (!tweenInfo) {
    return false;
  }
  tweenInfo.tween.paused = false;
  return true;
}

export function cancelTween(id: string): boolean {
  const tweenInfo = tweenRegistry.get(id);
  if (!tweenInfo) {
    return false;
  }
  tweenInfo.tween.cancel();

  tweenRegistry.delete(id);
  return true;
}

export function isTweenActive(id: string): boolean {
  const tweenInfo = tweenRegistry.get(id);
  return tweenInfo ? !tweenInfo.completed : false;
}

export function getAllActiveTweens(): string[] {
  return Array.from(tweenRegistry.keys());
}

export function updateTweens(): void {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const tween = activeTweens[i];
    if (!tween.update()) {
      activeTweens.splice(i, 1);
    }
  }
}

export function resetTweens(): void {
  try {
    
    for (const info of tweenRegistry.values()) {
      try {
        info.tween.cancel();
      } catch {}
    }
  } finally {
    tweenRegistry.clear();
    activeTweens.length = 0;
  }
}

export const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - --t * t * t * t,
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number) => Math.sqrt(1 - --t * t),
  easeInOutCirc: (t: number) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2,
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  easeOutBounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
  easeInBounce: (t: number) => 1 - easings.easeOutBounce(1 - t),
  easeInOutBounce: (t: number) =>
    t < 0.5
      ? (1 - easings.easeOutBounce(1 - 2 * t)) / 2
      : (1 + easings.easeOutBounce(2 * t - 1)) / 2,
};
