export interface HealthModel {
  getCurrentHealth(): number;
  onNoteHit(): void;
  onNoteMiss(): void;
  reset(): void;
  getMaxHealth(): number;
}
