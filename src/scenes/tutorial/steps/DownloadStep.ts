import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { BeatmapData } from "../../../utils/types";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { Maps } from "../../../utils/maps";
import { logger } from "../../../utils/logger";

export class DownloadStep extends BaseTutorialStep {
  private selectedMap: BeatmapData | null = null;
  private downloadedMapData: SoundSpaceMemoryMap | null = null;
  private downloadComplete: boolean = false;

  constructor() {
    super({
      id: "download",
      text: "Perfect! Now I'll download and prepare your chosen map. This might take a moment...",
      mascotEmote: "satisfied",
      waitForUser: true,
    });
  }

  protected async onStepEnter(): Promise<void> {
    await this.downloadSelectedMap();
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {}

  protected onStepRender(): void {}

  protected checkCanContinue(): boolean {
    return this.downloadComplete;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  public setSelectedMap(map: BeatmapData): void {
    this.selectedMap = map;
  }

  private async downloadSelectedMap(): Promise<void> {
    if (!this.selectedMap) {
      logger("No map selected for download");
      this.downloadComplete = true;
      this.markCompleted();
      return;
    }

    try {
      logger(`Downloading and parsing map: ${this.selectedMap.title}`);
      const mapId = this.selectedMap.id.toString();
      const existing = Maps.getParsed(mapId);
      if (existing) {
        this.downloadedMapData = existing;
        this.downloadComplete = true;
        this.markCompleted();
        return;
      }
      if (!this.selectedMap.beatmapFile) {
        this.downloadComplete = true;
        this.markCompleted();
        return;
      }
      const onlineData = {
        starRating: this.selectedMap.starRating || 0,
        status: this.selectedMap.status || "UNRANKED",
        onlineId: this.selectedMap.id.toString(),
        onlineImage: this.selectedMap.image || "",
      };
      const result = await Maps.fetchAndAdd(this.selectedMap.beatmapFile, onlineData);
      if (!result) throw new Error("Failed to process beatmap");
      this.downloadedMapData = result;
      this.downloadComplete = true;
      this.markCompleted();
    } catch (error) {
      logger("Error downloading/parsing map:", error);
      this.downloadComplete = true;
      this.markCompleted();
    }
  }

  public getDownloadedMapData(): SoundSpaceMemoryMap | null {
    return this.downloadedMapData;
  }

  public isCompleted(): boolean {
    return this.downloadComplete;
  }

  public canContinue(): boolean {
    return this.downloadComplete;
  }
}
