import { Scene } from "../atoms/Scene";

export class EmptyScene extends Scene {
  async init(): Promise<void> {}
  render(): void {}
  sceneName: string = "Empty Scene";

  constructor() {
    super();
  }
}
