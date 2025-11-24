import { createPopup } from "../../menu/atoms/Popup";
import { ConfigManager } from "../../../utils/configManager";
import { openDialog } from "nativefiledialog";
import { removeTextureFromCache } from "../../../utils/sprite";

type DialogSpec = { images?: string } | { video?: string };

interface SelectAndSetConfigOptions {
  popupTitle: string;
  dialog: DialogSpec;
  configKey: string;
  successMessage: string;
  invalidateTextureKeys?: string[];
  invalidateWithPickedPath?: (pickedPath: string) => string[];
}

export async function selectAndSetConfig(options: SelectAndSetConfigOptions): Promise<void> {
  const { popupTitle, dialog, configKey, successMessage } = options;
  const popup = createPopup();
  try {
    popup.startLoading(popupTitle);
    const result: string = openDialog(dialog as any);
    const filePath = result;
    if (!filePath) {
      popup.endLoading();
      return;
    }
    ConfigManager.update({ [configKey]: filePath } as any);
    ConfigManager.save();
    try {
      options.invalidateTextureKeys?.forEach((k) => removeTextureFromCache(k));
      if (options.invalidateWithPickedPath) {
        const keys = options.invalidateWithPickedPath(filePath);
        keys.forEach((k) => removeTextureFromCache(k));
      }
    } catch {}
    popup.endLoading();
    const done = createPopup("info");
    done.show(successMessage);
    setTimeout(() => {
      done.hide();
      done.destroy();
    }, 1200);
  } catch {
    try {
      popup.endLoading();
    } catch {}
    const err = createPopup("error");
    err.show("File selection failed");
    setTimeout(() => {
      err.hide();
      err.destroy();
    }, 1800);
  }
}

