import type { GameMode } from "./index";

const MirrorMode: GameMode = {
  id: "mirror",
  name: "Mirror",
  getNotes(map) {
    return map.notes.map(([t, x, y]) => {
      const mirroredX = 2 - x;
      return [t, mirroredX, y] as [number, number, number];
    });
  },
};

export default MirrorMode;
