import * as fs from "fs";
import * as fsPromises from "fs/promises";
import { Maps } from "../../../utils/maps";
import { createPopup, Popup } from "../atoms/Popup";
import { SoundSpaceMemoryMap } from "../../../utils/storage/ssmm";
import { getVolumes, playMusic } from "../../../utils/soundManager";
import { openDialog, openFolderDialog } from "nativefiledialog";

export async function pickSSPMFile(): Promise<string | null> {
  try {
    const result = openDialog({
      beatmap: "sspm",
    });
    return result;
  } catch (e) {
    console.warn("open-file-manager-dialog failed:", e);
    return null;
  }
}

export interface ImportDeps {
  popup: Popup;
  switchToDownloaded: () => Promise<void> | void;
  selectMap: (map: SoundSpaceMemoryMap) => void;
}

export async function importFromDialog(deps: ImportDeps): Promise<void> {
  const { popup, switchToDownloaded, selectMap } = deps;
  try {
    await Maps.ensure();

    popup.startLoading("Select a .sspm file");
    const filePath = await pickSSPMFile();
    if (!filePath) {
      popup.endLoading();
      return;
    }

    if (!filePath.toLowerCase().endsWith(".sspm")) {
      popup.endLoading();
      const p = createPopup("error");
      p.show("Please select a .sspm file");
      setTimeout(() => {
        p.hide();
        p.destroy();
      }, 1800);
      return;
    }

    popup.startLoading("Importing map...");
    const buf = await fsPromises.readFile(filePath);
    const result = await Maps.importBuffer(Buffer.from(buf));
    if (!result) {
      popup.endLoading();
      const p = createPopup("error");
      p.show("Failed to import map");
      setTimeout(() => {
        p.hide();
        p.destroy();
      }, 1800);
      return;
    }

    await switchToDownloaded();
    selectMap(result);

    try {
      const id = (result as any).id?.toString?.() || "";
      const path = Maps.audioPath(id, result);
      if (path && fs.existsSync(path)) {
        const volumes = getVolumes();
        playMusic(path, volumes.music);
      }
    } catch {}

    popup.endLoading();
  } catch (e) {
    console.error("Failed to import SSPM:", e);
    try {
      deps.popup.endLoading();
    } catch {}
    const p = createPopup("error");
    p.show("Import failed");
    setTimeout(() => {
      p.hide();
      p.destroy();
    }, 2000);
  }
}

export interface ImportFolderDeps {
  popup: Popup;
  onComplete?: (importedCount: number) => Promise<void> | void;
}

export async function importFolder(deps: ImportFolderDeps): Promise<void> {
  try {
    await Maps.ensure();
    const dir = openFolderDialog();
    if (!dir) return;
    deps.popup.startLoading("Scanning folder...");
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => n.toLowerCase().endsWith(".sspm"));
    if (files.length === 0) {
      deps.popup.endLoading();
      const p = createPopup("error");
      p.show("No .sspm files found");
      setTimeout(() => {
        p.hide();
        p.destroy();
      }, 1800);
      return;
    }
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const name = files[i];
      deps.popup.startLoading(`Importing ${i + 1}/${files.length}: ${name}`);
      try {
        const buf = await fsPromises.readFile(`${dir}/${name}`);
        const res = await Maps.importBuffer(Buffer.from(buf));
        if (res) ok++;
      } catch {}
    }
    deps.popup.endLoading();
    const done = createPopup("info");
    done.show(`Imported ${ok}/${files.length}`);
    setTimeout(() => {
      done.hide();
      done.destroy();
    }, 1500);
    await deps.onComplete?.(ok);
  } catch (e) {
    console.error("Folder import failed:", e);
    try {
      deps.popup.endLoading();
    } catch {}
    const p = createPopup("error");
    p.show("Import failed");
    setTimeout(() => {
      p.hide();
      p.destroy();
    }, 2000);
  }
}
