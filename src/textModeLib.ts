const ESC = "\x1b";

export const ANSI = {
  cursorShow: `${ESC}[?25h`,
  cursorHide: `${ESC}[?25l`,
  clearScreen: `${ESC}[2J`,
  cursorHome: `${ESC}[H`,
  inverse: `${ESC}[7m`,
  reset: `${ESC}[0m`,
};

export const screenRefreshSequence = (): string =>
  `${ANSI.cursorShow}${ANSI.clearScreen}${ANSI.cursorHome}`;

export const cursorTo = (row: number, col: number): string =>
  `${ESC}[${row};${col}H`;

export const applyInverseStyle = (text: string): string =>
  `${ANSI.inverse}${text}${ANSI.reset}`;
