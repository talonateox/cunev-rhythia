import { Vector2, Vector3 } from "raylib";
import { drawSprite } from "../../../utils/sprite";
import {
  BaseNoteRenderer,
  NoteRenderConfig,
  NoteRenderState,
} from "../atoms/NoteRenderer";

export class SpriteNoteRenderer extends BaseNoteRenderer {
  constructor(config: NoteRenderConfig) {
    super(config);
  }

  protected drawNote(state: NoteRenderState): void {
    this.applyTransform(state.position);

    const noteSize = Vector2(state.size, state.size);
    drawSprite(
      "/square.png",
      Vector3(-noteSize.x / 2, -noteSize.y / 2, 0),
      noteSize,
      {
        r: state.color.r,
        g: state.color.g,
        b: state.color.b,
        a: Math.floor(state.alpha * 255),
      }
    );

    this.removeTransform();
  }
}
