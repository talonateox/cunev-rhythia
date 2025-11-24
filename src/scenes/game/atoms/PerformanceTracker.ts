export class PerformanceTracker {
  private currentNoteIndex = 0;

  public findVisibleNotesRange(
    notes: [number, number, number][],
    msTime: number,
    window: number
  ): { startIndex: number; endIndex: number } {
    const startTime = msTime - window;

    const endTime = msTime + window + 500;

    let startIndex = this.binarySearchNotes(notes, startTime);

    if (startIndex > this.currentNoteIndex) {
      this.currentNoteIndex = startIndex;
    }

    let endIndex = startIndex;
    while (endIndex < notes.length && notes[endIndex][0] <= endTime) {
      endIndex++;
    }

    return { startIndex, endIndex };
  }

  public isNoteVisible(
    note: [number, number, number],
    msTime: number,
    window: number
  ): boolean {
    return msTime > note[0] - window && msTime < note[0];
  }

  public calculateIncomingRate(
    note: [number, number, number],
    msTime: number,
    window: number
  ): number {
    return (msTime - (note[0] - window)) / window;
  }

  public resetCurrentNoteIndex(): void {
    this.currentNoteIndex = 0;
  }

  public getCurrentNoteIndex(): number {
    return this.currentNoteIndex;
  }

  private binarySearchNotes(
    notes: [number, number, number][],
    targetTime: number
  ): number {
    let left = 0;
    let right = notes.length - 1;
    let result = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      if (notes[mid][0] < targetTime) {
        left = mid + 1;
      } else {
        result = mid;
        right = mid - 1;
      }
    }

    return Math.max(0, result - 1);
  }
}
