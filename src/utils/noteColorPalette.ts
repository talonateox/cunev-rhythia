import { Color } from "raylib";

export interface NoteColorPalette {
  colors: Color[];
  name: string;
}

export const DEFAULT_NOTE_COLOR_PALETTES: NoteColorPalette[] = [
  {
    name: "Rainbow",
    colors: [
      { r: 255, g: 64, b: 64, a: 255 }, 
      { r: 255, g: 80, b: 32, a: 255 }, 
      { r: 255, g: 100, b: 0, a: 255 }, 
      { r: 255, g: 130, b: 0, a: 255 }, 
      { r: 255, g: 165, b: 0, a: 255 }, 
      { r: 255, g: 180, b: 0, a: 255 }, 
      { r: 255, g: 200, b: 0, a: 255 }, 
      { r: 255, g: 230, b: 32, a: 255 }, 
      { r: 255, g: 255, b: 64, a: 255 }, 
      { r: 230, g: 255, b: 32, a: 255 }, 
      { r: 200, g: 255, b: 64, a: 255 }, 
      { r: 170, g: 255, b: 32, a: 255 }, 
      { r: 64, g: 255, b: 64, a: 255 }, 
      { r: 32, g: 255, b: 100, a: 255 }, 
      { r: 64, g: 255, b: 150, a: 255 }, 
      { r: 32, g: 255, b: 200, a: 255 }, 
      { r: 64, g: 255, b: 255, a: 255 }, 
      { r: 32, g: 200, b: 255, a: 255 }, 
      { r: 64, g: 190, b: 255, a: 255 }, 
      { r: 32, g: 150, b: 255, a: 255 }, 
      { r: 64, g: 120, b: 255, a: 255 }, 
      { r: 80, g: 80, b: 255, a: 255 }, 
      { r: 100, g: 64, b: 255, a: 255 }, 
      { r: 120, g: 32, b: 255, a: 255 }, 
      { r: 138, g: 43, b: 226, a: 255 }, 
      { r: 160, g: 32, b: 255, a: 255 }, 
      { r: 180, g: 64, b: 255, a: 255 }, 
      { r: 200, g: 32, b: 255, a: 255 }, 
      { r: 255, g: 64, b: 255, a: 255 }, 
      { r: 255, g: 32, b: 200, a: 255 }, 
      { r: 255, g: 64, b: 150, a: 255 }, 
      { r: 255, g: 32, b: 100, a: 255 }, 
    ],
  },
];

export class NoteColorManager {
  private currentPalette: NoteColorPalette;
  private customPalettes: NoteColorPalette[] = [];

  constructor() {
    this.currentPalette = DEFAULT_NOTE_COLOR_PALETTES[0]; 
  }

  public setCurrentPalette(palette: NoteColorPalette): void {
    this.currentPalette = palette;
  }

  public getCurrentPalette(): NoteColorPalette {
    return this.currentPalette;
  }

  public getColorForNoteIndex(noteIndex: number): Color {
    const colors = this.currentPalette.colors;
    if (colors.length === 0) {
      return { r: 255, g: 255, b: 255, a: 255 }; 
    }
    return colors[noteIndex % colors.length];
  }

  public getAllPalettes(): NoteColorPalette[] {
    return [...DEFAULT_NOTE_COLOR_PALETTES, ...this.customPalettes];
  }

  public addCustomPalette(palette: NoteColorPalette): void {
    this.customPalettes.push(palette);
  }

  public removeCustomPalette(name: string): void {
    this.customPalettes = this.customPalettes.filter((p) => p.name !== name);
  }
}

export const noteColorManager = new NoteColorManager();
