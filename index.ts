import { Rhythia } from "./src/atoms/Rhythia";
import { ConfigManager } from "./src/utils/configManager";
import { ProfileManager } from "./src/utils/profileManager";
import { setEnvironment } from "rhythia-api/handleApi";
import { logger } from "./src/utils/logger";
import { initializeSteam } from "./src/utils/steam";
import { Modes } from "./src/scenes/game/modes";
import { initializeColorPalettesFromDisk } from "./src/utils/colorsets";

initializeSteam();

setEnvironment("production");

ConfigManager.load();
ProfileManager.load();
initializeColorPalettesFromDisk();

Rhythia.gameInit();
