export function isPrintable(char: string): boolean {
  if (!char || char.length === 0) return false;
  const code = char.codePointAt(0) ?? 0;
  
  return code >= 32 && code <= 126;
}

const SHIFT_MAP: Record<string, string> = {
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": '"',
  ",": "<",
  ".": ">",
  "/": "?",
};

export function applyShiftModifiers(char: string): string {
  if (char >= "a" && char <= "z") return char.toUpperCase();
  return SHIFT_MAP[char] ?? char;
}

