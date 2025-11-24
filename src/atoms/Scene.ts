export abstract class Scene {
  abstract sceneName: string;
  abstract init(): Promise<void>;
  abstract render(): void;

  public readonly sceneId: string;

  private _isPaused: boolean = false;

  constructor() {
    this.sceneId = `${this.constructor.name}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  destroy?(): void;

  pause?(): void;
  resume?(): void;

  get isPaused(): boolean {
    return this._isPaused;
  }

  set isPaused(value: boolean) {
    this._isPaused = value;
  }
}
