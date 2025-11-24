import {
  Vector2,
  Color,
  RED,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
} from "raylib";
import { drawText } from "../../../utils/text";

interface MissParticle {
  x: number;
  y: number;
  vy: number; 
  life: number; 
  maxLife: number;
  size: number;
  rotation: number; 
  rotationSpeed: number; 
}

export class MissParticleSystem {
  private particles: MissParticle[] = [];

  public spawnMissParticle(x: number, y: number): void {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 20, 
      y: y,
      vy: -50 - Math.random() * 30, 
      life: 1.0,
      maxLife: 1000 + Math.random() * 500, 
      size: 28 + Math.random() * 12, 
      rotation: Math.random() * 360, 
      rotationSpeed: (Math.random() - 0.5) * 180, 
    });
  }

  public update(deltaTimeMs: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.y += particle.vy * (deltaTimeMs / 1000);

      particle.vy *= 0.995;

      particle.rotation += particle.rotationSpeed * (deltaTimeMs / 1000);

      particle.life -= deltaTimeMs / particle.maxLife;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public render(opacityMultiplier: number = 1.0): void {
    if (opacityMultiplier == 0) {
      return;
    }
    for (const particle of this.particles) {
      const opacity = particle.life * 0.8 * opacityMultiplier;

      rlPushMatrix();
      rlTranslatef(particle.x, particle.y, 0);
      rlRotatef(particle.rotation, 0, 0, 1);

      drawText(
        "X",
        Vector2(0, 0),
        particle.size,
        {
          r: 200,
          g: 50,
          b: 50,
          a: Math.round(255 * opacity),
        },
        "center"
      );

      rlPopMatrix();
    }
  }

  public clear(): void {
    this.particles.length = 0;
  }
}
