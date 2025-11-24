import { GameSettings } from "../../../utils/settingsRegistry";
import {
  UIDecoration,
  UIDecorationContext,
} from "../panel-decorations/UIDecoration";

export interface GameUIPanelCommonArgs {
  closeDistance: number;
  cameraTiltX: number;
  cameraTiltY: number;
  settings?: Partial<GameSettings>;
  decorations: UIDecoration[];
  decorationContext: UIDecorationContext;
}

export abstract class GameUIPanel<Args extends GameUIPanelCommonArgs> {
  abstract render(args: Args): void;
}
