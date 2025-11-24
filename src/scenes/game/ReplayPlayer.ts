import { ReplayCursorSample, ReplayFile } from "../../utils/replays";
import { Vector2 } from "raylib";

export class ReplayPlayer {
  private readonly samples: ReplayCursorSample[];

  constructor(replay: ReplayFile) {
    this.samples = [...(replay.samples || [])].sort((a, b) => a.t - b.t);
  }

  public getCursorGamePosition(timeMs: number): Vector2 | null {
    if (this.samples.length === 0) return null;
    if (timeMs <= this.samples[0].t) {
      const s = this.samples[0];
      return Vector2(s.x, s.y);
    }
    const last = this.samples[this.samples.length - 1];
    if (timeMs >= last.t) {
      return Vector2(last.x, last.y);
    }
    
    let lo = 0;
    let hi = this.samples.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.samples[mid].t <= timeMs) lo = mid;
      else hi = mid;
    }
    const a = this.samples[lo];
    const b = this.samples[hi];
    const dt = Math.max(1, b.t - a.t);
    const t = Math.max(0, Math.min(1, (timeMs - a.t) / dt));
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    return Vector2(x, y);
  }

  public getLastSampleTimeMs(): number {
    if (this.samples.length === 0) return 0;
    return this.samples[this.samples.length - 1].t;
  }
}
