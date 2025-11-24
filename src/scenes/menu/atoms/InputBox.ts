import {
  Vector2,
  IsKeyPressed,
  IsKeyDown,
  GetKeyPressed,
  GetCharPressed,
  IsMouseButtonPressed,
  IsMouseButtonDown,
  IsMouseButtonReleased,
  MOUSE_BUTTON_LEFT,
  KEY_BACKSPACE,
  KEY_DELETE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_HOME,
  KEY_END,
  KEY_A,
  KEY_C,
  KEY_V,
  KEY_X,
  KEY_LEFT_CONTROL,
  KEY_RIGHT_CONTROL,
  KEY_LEFT_SHIFT,
  KEY_RIGHT_SHIFT,
  KEY_ENTER,
  KEY_KP_ENTER,
  GetClipboardText,
  SetClipboardText,
  GetMousePosition,
  GetFrameTime,
  MeasureTextEx,
  GuiGetFont,
} from "raylib";
import { GameObject } from "../../../atoms/Object";
import { drawSprite } from "../../../utils/sprite";
import { drawText } from "../../../utils/text";
import { lerpDelta } from "../../../utils/lerp";
import { AccentColor } from "../../../utils/imageBlur";
import { isPrintable as kbIsPrintable, applyShiftModifiers as kbApplyShift } from "../../../utils/keyboard";

export interface InputBoxProps {
  position: Vector2;
  width: number;
  height?: number;
  placeholder?: string;
  initialValue?: string;
  maxLength?: number;
  fontSize?: number;
  onValueChange?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export class InputBox {
  private gameObject: GameObject;
  private props: InputBoxProps;
  private value: string = "";
  private cursorPosition: number = 0;
  private selectionStart: number = 0;
  private selectionEnd: number = 0;
  private isFocused: boolean = false;
  private isHovered: boolean = false;
  private fadeProgress: number = 0;
  private cursorBlinkTime: number = 0;
  private accentColor: AccentColor | null = null;
  private isDragging: boolean = false;
  private dragStartPosition: number = 0;
  private backspaceHoldElapsed: number = 0;
  private backspaceRepeatElapsed: number = 0;
  private readonly backspaceInitialDelay: number = 0.45;
  private readonly backspaceRepeatInterval: number = 0.05;

  private readonly defaultHeight: number = 48;
  private readonly defaultFontSize: number = 28;
  private readonly padding: number = 12;
  private readonly cursorWidth: number = 2;
  private readonly blinkSpeed: number = 0.5;

  constructor(props: InputBoxProps) {
    this.props = {
      height: this.defaultHeight,
      fontSize: this.defaultFontSize,
      maxLength: 256,
      placeholder: "",
      initialValue: "",
      ...props,
    };

    this.value = props.initialValue || "";
    this.cursorPosition = this.value.length;
    this.selectionStart = this.cursorPosition;
    this.selectionEnd = this.cursorPosition;

    this.gameObject = new GameObject({ zBase: 5 }); 
    this.initialize();
  }

  private initialize(): void {
    this.gameObject.attachRect({
      pos: {
        x: this.props.position.x,
        y: this.props.position.y - this.props.height! / 2,
      },
      size: { x: this.props.width, y: this.props.height! },
    });

    this.gameObject.rectArea!.onClick = () => {
      if (!this.isFocused) {
        this.setFocus(true);
      }

      const mousePos = this.gameObject.getMousePosition();
      if (mousePos) {
        this.isDragging = true;
        const relativeX = mousePos.x - (this.props.position.x + this.padding);
        const clickPos = this.getCharacterIndexFromX(relativeX);
        this.dragStartPosition = clickPos;
        this.cursorPosition = clickPos;
        this.clearSelection();
        this.resetCursorBlink();
      }

      return true;
    };

    this.gameObject.onDraw = () => this.draw();
    this.gameObject.onUpdate = () => this.update();
  }

  private update(): void {
    const mousePos = this.gameObject.getMousePosition();

    this.isHovered = this.isPointInInputBox(mousePos);

    this.handleMouseSelection(mousePos);

    if (
      IsMouseButtonPressed(MOUSE_BUTTON_LEFT) &&
      !this.isHovered &&
      this.isFocused
    ) {
      this.setFocus(false);
    }

    this.fadeProgress = lerpDelta(this.fadeProgress, 1, 0.1);

    this.cursorBlinkTime += GetFrameTime();

    if (this.isFocused) {
      this.handleKeyboardInput();
    }
  }

  private handleMouseSelection(mousePos: Vector2 | null): void {
    if (!mousePos) return;

    if (
      this.isDragging &&
      IsMouseButtonDown(MOUSE_BUTTON_LEFT) &&
      this.isFocused
    ) {
      const relativeX = mousePos.x - (this.props.position.x + this.padding);
      const currentPos = this.getCharacterIndexFromX(relativeX);

      if (currentPos !== this.dragStartPosition) {
        this.selectionStart = this.dragStartPosition;
        this.selectionEnd = currentPos;
        this.cursorPosition = currentPos;
      } else {
        this.clearSelection();
      }
      this.resetCursorBlink();
      return;
    }

    if (this.isDragging && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
      this.isDragging = false;

      if (this.hasSelection()) {
        this.cursorPosition = this.selectionEnd;
      }
      this.resetCursorBlink();
    }
  }

  private handleKeyboardInput(): void {
    const isCtrlDown =
      IsKeyDown(KEY_LEFT_CONTROL) || IsKeyDown(KEY_RIGHT_CONTROL);

    if (isCtrlDown) {
      if (IsKeyPressed(KEY_A)) {
        this.selectAll();
        return;
      }
      if (IsKeyPressed(KEY_C)) {
        this.copySelection();
        return;
      }
      if (IsKeyPressed(KEY_X)) {
        this.cutSelection();
        return;
      }
      if (IsKeyPressed(KEY_V)) {
        this.paste();
        return;
      }
    }

    if (IsKeyPressed(KEY_LEFT)) {
      if (isCtrlDown) {
        this.moveCursorByWord(-1);
      } else {
        this.moveCursor(-1);
      }
      return;
    }

    if (IsKeyPressed(KEY_RIGHT)) {
      if (isCtrlDown) {
        this.moveCursorByWord(1);
      } else {
        this.moveCursor(1);
      }
      return;
    }

    if (IsKeyPressed(KEY_HOME)) {
      this.setCursorPosition(0);
      return;
    }

    if (IsKeyPressed(KEY_END)) {
      this.setCursorPosition(this.value.length);
      return;
    }

    
    if (IsKeyPressed(KEY_BACKSPACE)) {
      this.handleBackspace();
      this.backspaceHoldElapsed = 0;
      this.backspaceRepeatElapsed = 0;
    }

    if (IsKeyDown(KEY_BACKSPACE)) {
      const dt = GetFrameTime();
      this.backspaceHoldElapsed += dt;
      if (this.backspaceHoldElapsed >= this.backspaceInitialDelay) {
        this.backspaceRepeatElapsed += dt;
        while (this.backspaceRepeatElapsed >= this.backspaceRepeatInterval) {
          this.handleBackspace();
          this.backspaceRepeatElapsed -= this.backspaceRepeatInterval;
        }
      }
    } else {
      this.backspaceHoldElapsed = 0;
      this.backspaceRepeatElapsed = 0;
    }

    if (IsKeyPressed(KEY_DELETE)) {
      this.handleDelete();
      return;
    }

    if (IsKeyPressed(KEY_ENTER) || IsKeyPressed(KEY_KP_ENTER)) {
      if (this.props.onEnter) {
        this.props.onEnter(this.value);
      }
      return;
    }

    
    let cp = GetCharPressed();
    let consumedCharInput = false;
    while (cp > 0) {
      consumedCharInput = true;
      if (cp >= 32) {
        const ch = String.fromCodePoint(cp);
        if (this.isPrintableCharacter(ch)) {
          this.insertCharacter(ch);
        }
      }
      cp = GetCharPressed();
    }

    
    if (!consumedCharInput) {
      const keyPressed = GetKeyPressed();
      if (keyPressed > 0) {
        let char = String.fromCharCode(keyPressed);
        const shiftDown = IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT);
        if (shiftDown) {
          char = this.applyShiftModifiers(char);
        } else if (char >= "A" && char <= "Z") {
          char = char.toLowerCase();
        }
        if (this.isPrintableCharacter(char)) {
          this.insertCharacter(char);
        }
      }
    }
  }

  public isFocusedNow(): boolean {
    return this.isFocused;
  }

  private isPrintableCharacter(char: string): boolean {
    return kbIsPrintable(char);
  }

  private willTextFitInWidth(text: string): boolean {
    const availableWidth = this.props.width - this.padding * 2;
    const fontSize = this.props.fontSize!;
    const font = GuiGetFont();

    const textSize = MeasureTextEx(font, text, fontSize, 1);
    return textSize.x <= availableWidth;
  }

  private getMaxCharactersForWidth(): number {
    return Math.min(this.props.maxLength || 256, 100);
  }

  private insertCharacter(char: string): void {
    if (this.hasSelection()) {
      this.deleteSelection();
    }

    const newValue =
      this.value.slice(0, this.cursorPosition) +
      char +
      this.value.slice(this.cursorPosition);

    if (!this.willTextFitInWidth(newValue)) {
      return;
    }

    this.value = newValue;
    this.cursorPosition++;
    this.clearSelection();
    this.resetCursorBlink();
    this.triggerValueChange();
  }

  private applyShiftModifiers(char: string): string {
    return kbApplyShift(char);
  }

  private handleBackspace(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
    } else if (this.cursorPosition > 0) {
      this.value =
        this.value.slice(0, this.cursorPosition - 1) +
        this.value.slice(this.cursorPosition);
      this.cursorPosition--;
      this.clearSelection();
    }
    this.resetCursorBlink();
    this.triggerValueChange();
  }

  private handleDelete(): void {
    if (this.hasSelection()) {
      this.deleteSelection();
    } else if (this.cursorPosition < this.value.length) {
      this.value =
        this.value.slice(0, this.cursorPosition) +
        this.value.slice(this.cursorPosition + 1);
      this.clearSelection();
    }
    this.resetCursorBlink();
    this.triggerValueChange();
  }

  private moveCursor(direction: number): void {
    if (this.hasSelection() && direction !== 0) {
      this.cursorPosition =
        direction < 0
          ? Math.min(this.selectionStart, this.selectionEnd)
          : Math.max(this.selectionStart, this.selectionEnd);
    } else {
      this.cursorPosition = Math.max(
        0,
        Math.min(this.value.length, this.cursorPosition + direction)
      );
    }
    this.clearSelection();
    this.isDragging = false; 
    this.resetCursorBlink();
  }

  private moveCursorByWord(direction: number): void {
    const words = this.value.split(/\s+/);
    let charCount = 0;
    let targetPos = this.cursorPosition;

    if (direction < 0) {
      for (let i = 0; i < words.length; i++) {
        if (charCount >= this.cursorPosition && i > 0) {
          targetPos = charCount - words[i - 1].length - 1;
          break;
        }
        charCount += words[i].length + (i < words.length - 1 ? 1 : 0);
      }
      if (targetPos === this.cursorPosition) targetPos = 0;
    } else {
      for (let i = 0; i < words.length; i++) {
        charCount += words[i].length + (i < words.length - 1 ? 1 : 0);
        if (charCount > this.cursorPosition) {
          targetPos = charCount;
          break;
        }
      }
    }

    this.cursorPosition = Math.max(0, Math.min(this.value.length, targetPos));
    this.clearSelection();
    this.isDragging = false; 
    this.resetCursorBlink();
  }

  private selectAll(): void {
    this.selectionStart = 0;
    this.selectionEnd = this.value.length;
    this.cursorPosition = this.selectionEnd;
  }

  private copySelection(): void {
    if (this.hasSelection()) {
      const selectedText = this.getSelectedText();
      SetClipboardText(selectedText);
    }
  }

  private cutSelection(): void {
    if (this.hasSelection()) {
      this.copySelection();
      this.deleteSelection();
    }
  }

  private paste(): void {
    try {
      const clipboardText = GetClipboardText();
      if (clipboardText && clipboardText.length > 0) {
        if (this.hasSelection()) {
          this.deleteSelection();
        }

        const filteredText = clipboardText
          .split("")
          .filter((char) => this.isPrintableCharacter(char))
          .join("");

        let textToInsert = "";
        const baseText =
          this.value.slice(0, this.cursorPosition) +
          this.value.slice(this.cursorPosition);

        for (let i = 1; i <= filteredText.length; i++) {
          const testText =
            this.value.slice(0, this.cursorPosition) +
            filteredText.slice(0, i) +
            this.value.slice(this.cursorPosition);
          if (this.willTextFitInWidth(testText)) {
            textToInsert = filteredText.slice(0, i);
          } else {
            break;
          }
        }

        this.value =
          this.value.slice(0, this.cursorPosition) +
          textToInsert +
          this.value.slice(this.cursorPosition);
        this.cursorPosition += textToInsert.length;
        this.clearSelection();
        this.resetCursorBlink();
        this.triggerValueChange();
      }
    } catch (error) {}
  }

  private deleteSelection(): void {
    if (this.hasSelection()) {
      const start = Math.min(this.selectionStart, this.selectionEnd);
      const end = Math.max(this.selectionStart, this.selectionEnd);
      this.value = this.value.slice(0, start) + this.value.slice(end);
      this.cursorPosition = start;
      this.clearSelection();
      this.triggerValueChange();
    }
  }

  private hasSelection(): boolean {
    return this.selectionStart !== this.selectionEnd;
  }

  private getSelectedText(): string {
    if (!this.hasSelection()) return "";
    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);
    return this.value.slice(start, end);
  }

  private clearSelection(): void {
    this.selectionStart = this.cursorPosition;
    this.selectionEnd = this.cursorPosition;
  }

  private setCursorPosition(position: number): void {
    this.cursorPosition = Math.max(0, Math.min(this.value.length, position));
    this.clearSelection();
    this.isDragging = false; 
    this.resetCursorBlink();
  }

  private resetCursorBlink(): void {
    this.cursorBlinkTime = 0;
  }

  private getCharacterIndexFromX(x: number): number {
    if (this.value.length === 0) return 0;

    const fontSize = this.props.fontSize!;
    let closestIndex = 0;
    let closestDistance = Math.abs(x);

    for (let i = 0; i <= this.value.length; i++) {
      const textUpToIndex = this.value.slice(0, i);
      const font = GuiGetFont();
      const textSize = MeasureTextEx(font, textUpToIndex, fontSize, 1);
      const distance = Math.abs(x - textSize.x);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return Math.max(0, Math.min(this.value.length, closestIndex));
  }

  private setFocus(focused: boolean): void {
    if (this.isFocused !== focused) {
      this.isFocused = focused;
      this.resetCursorBlink();

      if (focused && this.props.onFocus) {
        this.props.onFocus();
      } else if (!focused && this.props.onBlur) {
        this.props.onBlur();
        this.clearSelection();
      }
    }
  }

  private triggerValueChange(): void {
    if (this.props.onValueChange) {
      this.props.onValueChange(this.value);
    }
  }

  private isPointInInputBox(mousePos: Vector2 | null): boolean {
    if (!mousePos) return false;

    const { position, width, height } = this.props;
    const actualHeight = height!;

    return (
      mousePos.x >= position.x &&
      mousePos.x <= position.x + width &&
      mousePos.y >= position.y - actualHeight / 2 &&
      mousePos.y <= position.y + actualHeight / 2
    );
  }

  private draw(): void {
    if (this.fadeProgress < 0.01) return;

    const { position, width, height, placeholder, fontSize } = this.props;
    const actualHeight = height!;
    const actualFontSize = fontSize!;

    let borderR = 120,
      borderG = 120,
      borderB = 120;
    let bgR = 20,
      bgG = 20,
      bgB = 20;

    if (this.accentColor) {
      const bgTintStrength = 0.15;
      bgR = Math.round(20 + this.accentColor.r * bgTintStrength);
      bgG = Math.round(20 + this.accentColor.g * bgTintStrength);
      bgB = Math.round(20 + this.accentColor.b * bgTintStrength);

      if (this.isFocused) {
        const borderTintStrength = 0.4;
        borderR = Math.round(
          120 * (1 - borderTintStrength) +
            this.accentColor.r * borderTintStrength
        );
        borderG = Math.round(
          120 * (1 - borderTintStrength) +
            this.accentColor.g * borderTintStrength
        );
        borderB = Math.round(
          120 * (1 - borderTintStrength) +
            this.accentColor.b * borderTintStrength
        );
      } else {
        const borderTintStrength = 0.2;
        borderR = Math.round(
          120 * (1 - borderTintStrength) +
            this.accentColor.r * borderTintStrength
        );
        borderG = Math.round(
          120 * (1 - borderTintStrength) +
            this.accentColor.g * borderTintStrength
        );
        borderB = Math.round(
          120 * (1 - borderTintStrength) +
            this.accentColor.b * borderTintStrength
        );
      }
    }

    drawSprite(
      "/solid.png",
      Vector2(position.x, position.y - actualHeight / 2),
      Vector2(width, actualHeight),
      { r: bgR, g: bgG, b: bgB, a: this.fadeProgress * 255 }
    );

    const borderWidth = this.isFocused ? 2 : 1;
    const borderAlpha = this.isFocused ? 0.8 : 0.4;

    drawSprite(
      "/solid.png",
      Vector2(position.x, position.y - actualHeight / 2),
      Vector2(width, borderWidth),
      {
        r: borderR,
        g: borderG,
        b: borderB,
        a: borderAlpha * this.fadeProgress * 255,
      }
    );

    drawSprite(
      "/solid.png",
      Vector2(position.x, position.y + actualHeight / 2 - borderWidth),
      Vector2(width, borderWidth),
      {
        r: borderR,
        g: borderG,
        b: borderB,
        a: borderAlpha * this.fadeProgress * 255,
      }
    );

    drawSprite(
      "/solid.png",
      Vector2(position.x, position.y - actualHeight / 2),
      Vector2(borderWidth, actualHeight),
      {
        r: borderR,
        g: borderG,
        b: borderB,
        a: borderAlpha * this.fadeProgress * 255,
      }
    );

    drawSprite(
      "/solid.png",
      Vector2(position.x + width - borderWidth, position.y - actualHeight / 2),
      Vector2(borderWidth, actualHeight),
      {
        r: borderR,
        g: borderG,
        b: borderB,
        a: borderAlpha * this.fadeProgress * 255,
      }
    );

    if (this.hasSelection() && this.isFocused) {
      this.drawSelection();
    }

    const displayText = this.value || placeholder || "";
    const isPlaceholder = this.value.length === 0 && placeholder;
    const textColor = isPlaceholder
      ? { r: 120, g: 120, b: 120, a: this.fadeProgress * 255 }
      : { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 };

    if (displayText) {
      drawText(
        displayText,
        Vector2(position.x + this.padding, position.y - actualFontSize / 2),
        actualFontSize,
        textColor,
        "left"
      );
    }

    if (this.isFocused && !this.hasSelection()) {
      this.drawCursor();
    }
  }

  private drawSelection(): void {
    if (!this.hasSelection()) return;

    const { position, fontSize } = this.props;
    const actualFontSize = fontSize!;

    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    const textToStart = this.value.slice(0, start);
    const selectedText = this.value.slice(start, end);

    const font = GuiGetFont();
    const startTextSize = MeasureTextEx(font, textToStart, actualFontSize, 1);
    const selectedTextSize = MeasureTextEx(
      font,
      selectedText,
      actualFontSize,
      1
    );

    const startX = position.x + this.padding + startTextSize.x;
    const selectionWidth = selectedTextSize.x;

    drawSprite(
      "/solid.png",
      Vector2(startX, position.y - actualFontSize / 2),
      Vector2(selectionWidth, actualFontSize),
      { r: 100, g: 150, b: 255, a: 0.3 * this.fadeProgress * 255 }
    );
  }

  private drawCursor(): void {
    const { position, fontSize } = this.props;
    const actualFontSize = fontSize!;

    const textToCursor = this.value.slice(0, this.cursorPosition);
    const font = GuiGetFont();
    const textSize = MeasureTextEx(font, textToCursor, actualFontSize, 1);
    const cursorX = position.x + this.padding + textSize.x;

    const shouldShow = Math.sin(this.cursorBlinkTime * Math.PI) > 0;
    if (!shouldShow) return;

    drawSprite(
      "/solid.png",
      Vector2(cursorX, position.y - actualFontSize / 2),
      Vector2(this.cursorWidth, actualFontSize),
      { r: 255, g: 255, b: 255, a: this.fadeProgress * 255 }
    );
  }

  public getValue(): string {
    return this.value;
  }

  public setValue(newValue: string): void {
    let fittingValue = "";
    for (let i = 1; i <= newValue.length; i++) {
      const testValue = newValue.slice(0, i);
      if (this.willTextFitInWidth(testValue)) {
        fittingValue = testValue;
      } else {
        break;
      }
    }

    this.value = fittingValue;
    this.cursorPosition = Math.min(this.cursorPosition, this.value.length);
    this.clearSelection();
    this.resetCursorBlink();
    this.triggerValueChange();
  }

  public setValueAndMoveCursorToEnd(newValue: string): void {
    let fittingValue = "";
    for (let i = 1; i <= newValue.length; i++) {
      const testValue = newValue.slice(0, i);
      if (this.willTextFitInWidth(testValue)) {
        fittingValue = testValue;
      } else {
        break;
      }
    }

    this.value = fittingValue;
    this.cursorPosition = this.value.length;
    this.clearSelection();
    this.resetCursorBlink();
    this.triggerValueChange();
  }

  public focus(): void {
    this.setFocus(true);
  }

  public blur(): void {
    this.setFocus(false);
  }

  public isFocusedState(): boolean {
    return this.isFocused;
  }

  public setAccentColor(color: AccentColor | null): void {
    this.accentColor = color;
  }

  public getGameObject(): GameObject {
    return this.gameObject;
  }

  public destroy(): void {
    this.gameObject.destroy();
  }

  public setGeometry(position: Vector2, width: number, height?: number): void {
    
    this.props.position = position;
    this.props.width = width;
    if (height) this.props.height = height;
    this.gameObject.attachRect({
      pos: { x: this.props.position.x, y: this.props.position.y - (this.props.height || this.defaultHeight) / 2 },
      size: { x: this.props.width, y: this.props.height || this.defaultHeight },
    });
  }
}

export function createInputBox(props: InputBoxProps): InputBox {
  return new InputBox(props);
}
