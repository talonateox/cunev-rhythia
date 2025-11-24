import { Vector2, DrawCircleV, GetFrameTime } from "raylib";

interface HeartParticle {
  position: Vector2;
  velocity: Vector2;
  lifetime: number;
  age: number;
}

export class HeartBurst {
  private particles: HeartParticle[] = [];
  constructor(centerX: number, centerY: number) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 120 + Math.random() * 80;
      const velocity = Vector2(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
      this.particles.push({
        position: Vector2(centerX, centerY),
        velocity,
        lifetime: 0.4 + Math.random() * 0.2,
        age: 0,
      });
    }
  }

  public update(delta: number = GetFrameTime()): void {
    for (const p of this.particles) {
      p.age += delta;
      if (p.age > p.lifetime) continue;
      const lifeProgress = p.age / p.lifetime;
      const speedDamping = 1 - lifeProgress * 0.7;
      p.position = Vector2(
        p.position.x + p.velocity.x * delta * speedDamping,
        p.position.y + p.velocity.y * delta * speedDamping
      );
    }
  }

  public draw(): void {
    for (const p of this.particles) {
      if (p.age >= p.lifetime) continue;
      const lifeProgress = p.age / p.lifetime;
      const alpha = Math.round(255 * (1 - lifeProgress));
      const radius = 4 * (1 - lifeProgress * 0.5);
      DrawCircleV(p.position, radius, { r: 255, g: 80, b: 120, a: alpha });
    }
  }
}
