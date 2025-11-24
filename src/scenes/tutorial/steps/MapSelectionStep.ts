import { BaseTutorialStep } from "../components/BaseTutorialStep";
import { GameObject } from "../../../atoms/Object";
import { getBeatmaps } from "rhythia-api";
import { ProfileManager } from "../../../utils/profileManager";
import { BeatmapData } from "../../../utils/types";
import { logger } from "../../../utils/logger";
import {
  setScrollY,
  setScrollBounds,
  getScrollY,
  updateScrollInput,
  updateScrollRender,
} from "../../../utils/scroll";
import { Rhythia } from "../../../atoms/Rhythia";
import { MapButton } from "../../menu/molecules/MapButton";

export class MapSelectionStep extends BaseTutorialStep {
  private mapButtons: GameObject[] = [];
  private mapButtonInstances: any[] = [];
  private selectedMap: BeatmapData | null = null;
  private downloadedMaps: BeatmapData[] = [];
  private buttonHeight: number = 140; 
  private pendingMapId: string | null = null;

  constructor() {
    super({
      id: "mapSelection",
      text: "Now let me show you some awesome ranked maps! Click on one to choose it.",
      mascotEmote: "happy",
      waitForUser: false,
    });
  }

  protected async onStepEnter(): Promise<void> {
    setScrollY(0);
    this.selectedMap = null;
    this.pendingMapId = null;
    await this.fetchAndDisplayRankedMaps();
  }

  protected onStepExit(): void {}

  protected onStepUpdate(): void {
    updateScrollInput();
    updateScrollRender();
  }

  protected onStepRender(): void {}

  protected checkCanContinue(): boolean {
    return this.selectedMap !== null;
  }

  protected onKeyPress(key: number): boolean {
    return false;
  }

  protected onMouseMove(x: number, y: number): void {}

  private async fetchAndDisplayRankedMaps(): Promise<void> {
    try {
      logger("Fetching ranked maps for tutorial");

      const mapsRequest = await getBeatmaps({
        page: 1,
        status: "RANKED",
        session: ProfileManager.get().token || "",
        maxStars: 2,
      });
      let rankedMaps = mapsRequest.beatmaps || [];

      if (rankedMaps.length === 0) {
        logger("No ranked maps fetched, using fallback data");
        rankedMaps = [
          {
            id: 1,
            title: "Through The Fire And Flames",
            ownerUsername: "DragonForce",
            difficulty: 9,
            status: "ranked",
            length: 445,
            noteCount: 3421,
            starRating: 8.5,
            image: "/default-album.png",
          },
          {
            id: 2,
            title: "Bad Apple!!",
            ownerUsername: "Touhou",
            difficulty: 7,
            status: "ranked",
            length: 219,
            noteCount: 1876,
            starRating: 6.3,
            image: "/default-album.png",
          },
        ];
      }

      this.downloadedMaps = rankedMaps;
      await this.createMapButtons(rankedMaps);
      this.updateScrollBounds();

      logger(`Tutorial: Displayed ${rankedMaps.length} ranked maps`);
    } catch (error) {
      logger("Error fetching ranked maps for tutorial:", error);
    }
  }

  private async createMapButtons(rankedMaps: BeatmapData[]): Promise<void> {
    const startY = 200;
    const spacing = 140;

    this.mapButtons = rankedMaps.map((map, index) => {
      const mapButtonInstance = new MapButton(
        { ...map, length: map.length! / 1000 },
        startY + index * spacing,
        index
      );
      const buttonGameObject = mapButtonInstance.getGameObject();

      buttonGameObject.zBase = -10;

      this.mapButtonInstances.push(mapButtonInstance);

      const originalOnClick = buttonGameObject.rectArea?.onClick;
      const originalOnHoverStart = buttonGameObject.rectArea?.onHoverStart;
      const originalOnHoverEnd = buttonGameObject.rectArea?.onHoverEnd;

      buttonGameObject.rectArea!.onHoverStart = () => {
        logger(`Tutorial: Hovering map "${map.title}"`);
        if (originalOnHoverStart) {
          originalOnHoverStart();
        }
      };

      buttonGameObject.rectArea!.onHoverEnd = () => {
        logger(`Tutorial: Stopped hovering map "${map.title}"`);
        if (originalOnHoverEnd) {
          originalOnHoverEnd();
        }
      };

      buttonGameObject.rectArea!.onClick = () => {
        logger(`Tutorial: Clicked map "${map.title}"`);

        if (originalOnClick) {
          originalOnClick();
        }

        this.pendingMapId = map.id?.toString() || null;
        this.selectedMap = null;

        if (this.pendingMapId) {
          logger(`Tutorial: Waiting for map "${map.title}" to finish loading`);
        }
      };

      mapButtonInstance.onSelectionComplete = ({ success, mapId }: any) => {
        if (!mapId || this.pendingMapId !== mapId) {
          return;
        }

        this.pendingMapId = null;

        if (success) {
          this.selectedMap = map;
          this.markCompleted();
          logger(`Tutorial: Selected map "${map.title}"`);
        } else {
          logger(`Tutorial: Failed to load map "${map.title}"`);
        }
      };

      return buttonGameObject;
    });
  }

  public getSelectedMap(): BeatmapData | null {
    return this.selectedMap;
  }

  public getMapButtonInstances(): any[] {
    return this.mapButtonInstances;
  }

  public isCompleted(): boolean {
    return this.selectedMap !== null;
  }

  public canContinue(): boolean {
    return this.selectedMap !== null;
  }

  public clearMapButtons(): void {
    this.mapButtons = [];
    this.mapButtonInstances = [];
  }

  private updateScrollBounds(): void {
    if (this.downloadedMaps.length === 0) {
      setScrollBounds(0, 0);
      return;
    }

    const startY = 200;
    const firstButtonY = startY;
    const lastButtonY =
      firstButtonY + (this.downloadedMaps.length - 1) * this.buttonHeight;

    const minScroll = firstButtonY - (Rhythia.gameHeight / 2 - 65);

    const maxScroll = lastButtonY - (Rhythia.gameHeight / 2 - 65);

    setScrollBounds(minScroll, maxScroll);
  }
}
