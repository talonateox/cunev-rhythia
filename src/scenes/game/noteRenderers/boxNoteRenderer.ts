import { DrawRectangle } from "raylib";
import {
  BaseNoteRenderer,
  NoteRenderConfig,
  NoteRenderState,
} from "../atoms/NoteRenderer";

export class BoxNoteRenderer extends BaseNoteRenderer {
  constructor(config: NoteRenderConfig) {
    super(config);
  }

  protected drawNote(state: NoteRenderState): void {
    const halfSize = state.size / 2;
    const drawX = state.position.x - halfSize;
    const drawY = state.position.y - halfSize;

    DrawRectangle(
      Math.round(drawX),
      Math.round(drawY),
      Math.round(state.size),
      Math.round(state.size),
      {
        r: state.color.r,
        g: state.color.g,
        b: state.color.b,
        a: Math.floor(state.alpha * 255),
      }
    );
  }
}
