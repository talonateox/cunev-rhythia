import { HealthModel } from "./HealthModel";

export class SoundSpaceHealthModel implements HealthModel {
  private readonly maxEnergy = 5;
  private readonly minEnergy = 0;
  private readonly hitGain = 0.5;
  private readonly missPenalty = 1;

  private energy = this.maxEnergy;

  public getCurrentHealth(): number {
    return this.energy;
  }

  public onNoteHit(): void {
    this.energy = Math.min(this.maxEnergy, this.energy + this.hitGain);
  }

  public onNoteMiss(): void {
    this.energy = Math.max(this.minEnergy, this.energy - this.missPenalty);
  }

  public reset(): void {
    this.energy = this.maxEnergy;
  }

  public getMaxHealth(): number {
    return this.maxEnergy;
  }
}
