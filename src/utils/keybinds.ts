import { IsKeyPressed, IsKeyDown, IsKeyReleased } from "raylib";
import * as fs from "fs";

interface KeybindsConfig {
  back: string;
  pause: string;
  restart: string;
  skipIntro: string;
  openSettings: string;
  toggleFullscreen: string;
  toggleMouseMode: string;
  increaseMouseSensitivity: string;
  decreaseMouseSensitivity: string;
}

class KeybindsManager {
  private config: KeybindsConfig;
  private defaultConfig: KeybindsConfig = {
    back: "KeyR",
    pause: "Escape",
    restart: "KeyF",
    skipIntro: "Space",
    openSettings: "Tab",
    toggleFullscreen: "F11",
    toggleMouseMode: "KeyL",
    increaseMouseSensitivity: "BracketRight",
    decreaseMouseSensitivity: "BracketLeft",
  };

  constructor() {
    this.config = this.loadKeybinds();
  }

  private loadKeybinds(): KeybindsConfig {
    try {
      const keybindsPath = "./keybinds.json";
      if (fs.existsSync(keybindsPath)) {
        const data = fs.readFileSync(keybindsPath, "utf-8");
        const parsed = JSON.parse(data);

        return { ...this.defaultConfig, ...parsed };
      }
    } catch (error) {
      console.warn("Failed to load keybinds.json, using defaults:", error);
    }

    return this.defaultConfig;
  }

  public saveKeybinds(): void {
    try {
      fs.writeFileSync("./keybinds.json", JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("Failed to save keybinds.json:", error);
    }
  }

  public getKeyCode(action: keyof KeybindsConfig): number {
    const keyName = this.config[action];
    return this.keyNameToCode(keyName);
  }

  public setKeybind(action: keyof KeybindsConfig, keyName: string): void {
    this.config[action] = keyName;
    this.saveKeybinds();
  }

  public getKeybind(action: keyof KeybindsConfig): string {
    return this.config[action];
  }

  public isPressed(action: keyof KeybindsConfig): boolean {
    const keyCode = this.getKeyCode(action);
    return IsKeyPressed(keyCode);
  }

  public isDown(action: keyof KeybindsConfig): boolean {
    const keyCode = this.getKeyCode(action);
    return IsKeyDown(keyCode);
  }

  public isReleased(action: keyof KeybindsConfig): boolean {
    const keyCode = this.getKeyCode(action);
    return IsKeyReleased(keyCode);
  }

  private keyNameToCode(keyName: string): number {
    const keyMap: Record<string, number> = {
      KeyA: 65,
      KeyB: 66,
      KeyC: 67,
      KeyD: 68,
      KeyE: 69,
      KeyF: 70,
      KeyG: 71,
      KeyH: 72,
      KeyI: 73,
      KeyJ: 74,
      KeyK: 75,
      KeyL: 76,
      KeyM: 77,
      KeyN: 78,
      KeyO: 79,
      KeyP: 80,
      KeyQ: 81,
      KeyR: 82,
      KeyS: 83,
      KeyT: 84,
      KeyU: 85,
      KeyV: 86,
      KeyW: 87,
      KeyX: 88,
      KeyY: 89,
      KeyZ: 90,

      Digit0: 48,
      Digit1: 49,
      Digit2: 50,
      Digit3: 51,
      Digit4: 52,
      Digit5: 53,
      Digit6: 54,
      Digit7: 55,
      Digit8: 56,
      Digit9: 57,

      F1: 290,
      F2: 291,
      F3: 292,
      F4: 293,
      F5: 294,
      F6: 295,
      F7: 296,
      F8: 297,
      F9: 298,
      F10: 299,
      F11: 300,
      F12: 301,

      Space: 32,
      Enter: 257,
      Tab: 258,
      Backspace: 259,
      Escape: 256,
      Delete: 261,
      Insert: 260,
      Home: 268,
      End: 269,
      PageUp: 266,
      PageDown: 267,

      ArrowUp: 265,
      ArrowDown: 264,
      ArrowLeft: 263,
      ArrowRight: 262,

      BracketLeft: 91,
      BracketRight: 93,

      ShiftLeft: 340,
      ShiftRight: 344,
      ControlLeft: 341,
      ControlRight: 345,
      AltLeft: 342,
      AltRight: 346,
    };

    return keyMap[keyName] || 0;
  }

  public getKeyDisplayName(keyName: string): string {
    const displayMap: Record<string, string> = {
      KeyA: "A",
      KeyB: "B",
      KeyC: "C",
      KeyD: "D",
      KeyE: "E",
      KeyF: "F",
      KeyG: "G",
      KeyH: "H",
      KeyI: "I",
      KeyJ: "J",
      KeyK: "K",
      KeyL: "L",
      KeyM: "M",
      KeyN: "N",
      KeyO: "O",
      KeyP: "P",
      KeyQ: "Q",
      KeyR: "R",
      KeyS: "S",
      KeyT: "T",
      KeyU: "U",
      KeyV: "V",
      KeyW: "W",
      KeyX: "X",
      KeyY: "Y",
      KeyZ: "Z",

      Digit0: "0",
      Digit1: "1",
      Digit2: "2",
      Digit3: "3",
      Digit4: "4",
      Digit5: "5",
      Digit6: "6",
      Digit7: "7",
      Digit8: "8",
      Digit9: "9",

      F1: "F1",
      F2: "F2",
      F3: "F3",
      F4: "F4",
      F5: "F5",
      F6: "F6",
      F7: "F7",
      F8: "F8",
      F9: "F9",
      F10: "F10",
      F11: "F11",
      F12: "F12",

      Space: "Space",
      Enter: "Enter",
      Tab: "Tab",
      Backspace: "Backspace",
      Escape: "Esc",
      Delete: "Delete",
      Insert: "Insert",
      Home: "Home",
      End: "End",
      PageUp: "Page Up",
      PageDown: "Page Down",

      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",

      BracketLeft: "[",
      BracketRight: "]",

      ShiftLeft: "Left Shift",
      ShiftRight: "Right Shift",
      ControlLeft: "Left Ctrl",
      ControlRight: "Right Ctrl",
      AltLeft: "Left Alt",
      AltRight: "Right Alt",
    };

    return displayMap[keyName] || keyName;
  }

  public getAllKeybinds(): KeybindsConfig {
    return { ...this.config };
  }
}

export const keybinds = new KeybindsManager();

export type { KeybindsConfig };
export type KeybindAction = keyof KeybindsConfig;
