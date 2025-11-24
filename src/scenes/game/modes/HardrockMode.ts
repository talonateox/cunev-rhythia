import type { GameMode } from "./index";

const HardrockMode: GameMode = {
  id: "hardrock",
  name: "Hardrock",

  hitboxScale: 0.75,

  resolveSettings(base) {
    const squareScale = (base.squareScale ?? 1.0) * 0.75;
    return {
      squareScale,
      mouseBoundRate: 1.1,
    };
  },
};

export default HardrockMode;
