import { HealthModel } from "./HealthModel";

interface SimpleHealthModelConfig {
  hitGain?: number;
  missPenalty?: number;
}

export class SimpleHealthModel implements HealthModel {
  private readonly maxHealth = 100;
  private readonly minHealth = 0;
  private readonly hitGain: number;
  private readonly missPenalty: number;

  private health = this.maxHealth;

  constructor(config: SimpleHealthModelConfig = {}) {
    this.hitGain = config.hitGain ?? 0.75;
    this.missPenalty = config.missPenalty ?? 12.5;
  }

  public getCurrentHealth(): number {
    return this.health;
  }

  public onNoteHit(): void {
    this.health = Math.min(this.maxHealth, this.health + this.hitGain);
  }

  public onNoteMiss(): void {
    this.health = Math.max(this.minHealth, this.health - this.missPenalty);
  }

  public reset(): void {
    this.health = this.maxHealth;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }
}
