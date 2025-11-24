import type { GameMode } from "./index";
import { Vector2 } from "raylib";
import { drawText, measureText } from "../../../utils/text";
import { drawSprite } from "../../../utils/sprite";
import { Rhythia } from "../../../atoms/Rhythia";

const OverlayDemoMode: GameMode = {
  id: "overlaydemo",
  name: "Overlay Demo",
  renderExtras(stage, ctx) {
    if (stage !== "uiOverlay") return;

    const label = "Overlay Demo Mode";
    const fontSize = 20;
    const padX = 8;
    const padY = 6;

    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;
    const borderHalf = 160; 
    const posX = centerX - borderHalf + 12;
    const posY = centerY - borderHalf + 12;

    const size = measureText(label, fontSize, 1);
    const boxW = size.width + padX * 2;
    const boxH = size.height + padY * 2;

    drawSprite("/solid.png", Vector2(posX, posY), Vector2(boxW, boxH), {
      r: 0,
      g: 0,
      b: 0,
      a: 160,
    });

    drawSprite("/solid.png", Vector2(posX, posY + boxH - 2), Vector2(boxW, 2), {
      r: 255,
      g: 255,
      b: 255,
      a: 120,
    });

    drawText(label, Vector2(posX + padX + 1, posY + padY + 1), fontSize, {
      r: 0,
      g: 0,
      b: 0,
      a: 220,
    });
    drawText(label, Vector2(posX + padX, posY + padY), fontSize, {
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
  },
};

export default OverlayDemoMode;
