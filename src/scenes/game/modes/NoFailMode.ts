import type { GameMode } from "./index";
import type { HealthModel } from "../health/HealthModel";
import { SimpleHealthModel } from "../health/SimpleHealthModel";

const NoFailMode: GameMode = {
  id: "nofail",
  name: "No Fail",
  createHealthModel(base?: HealthModel): HealthModel {
    const inner = base ?? new SimpleHealthModel();
    const wrapper: HealthModel = {
      getCurrentHealth: () => inner.getCurrentHealth(),
      onNoteHit: () => inner.onNoteHit(),
      onNoteMiss: () => {},
      reset: () => inner.reset(),
      getMaxHealth: () => inner.getMaxHealth(),
    };
    return wrapper;
  },

  settingsOverride: {
    burstParticleIntensity: 1.15,
  },
};

export default NoFailMode;
