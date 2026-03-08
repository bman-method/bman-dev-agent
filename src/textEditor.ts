type EditorOptions = {
  header: string;
};

type Cursor = {
  row: number;
  col: number;
};

const DEFAULT_HEADER = "Enter task content. Ctrl+D to save, Ctrl+C to cancel.";
const TAB_WIDTH = 8;

const expandTabs = (line: string): string => {
  let column = 0;
  let output = "";
  for (const ch of line) {
    if (ch === "\t") {
      const spaces = TAB_WIDTH - (column % TAB_WIDTH);
      output += " ".repeat(spaces);
      column += spaces;
      continue;
    }
    output += ch;
    column += 1;
  }
  return output;
};

const visualColumnForIndex = (line: string, index: number): number => {
  let column = 0;
  let offset = 0;
  for (const ch of line) {
    if (offset >= index) {
      break;
    }
    if (ch === "\t") {
      column += TAB_WIDTH - (column % TAB_WIDTH);
    } else {
      column += 1;
    }
    offset += 1;
  }
  return column;
};

export async function openTextEditor(options: Partial<EditorOptions> = {}): Promise<string | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive editor requires a TTY.");
  }

  const header = options.header ?? DEFAULT_HEADER;
  const stdin = process.stdin;
  const stdout = process.stdout;
  const lines = [""];
  const cursor: Cursor = { row: 0, col: 0 };

  const render = () => {
    const output: string[] = [];
    output.push("\x1b[?25h\x1b[2J\x1b[H");
    output.push(`${header}\n`);
    for (const line of lines) {
      output.push(`${expandTabs(line)}\n`);
    }
    const row = cursor.row + 2;
    const col = visualColumnForIndex(lines[cursor.row] ?? "", cursor.col) + 1;
    output.push(`\x1b[${row};${col}H`);
    stdout.write(output.join(""));
  };

  const insertText = (text: string) => {
    const line = lines[cursor.row] ?? "";
    const before = line.slice(0, cursor.col);
    const after = line.slice(cursor.col);
    lines[cursor.row] = before + text + after;
    cursor.col += text.length;
  };

  const insertNewline = () => {
    const line = lines[cursor.row] ?? "";
    const before = line.slice(0, cursor.col);
    const after = line.slice(cursor.col);
    lines[cursor.row] = before;
    lines.splice(cursor.row + 1, 0, after);
    cursor.row += 1;
    cursor.col = 0;
  };

  const backspace = () => {
    if (cursor.col > 0) {
      const line = lines[cursor.row] ?? "";
      lines[cursor.row] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
      cursor.col -= 1;
      return;
    }
    if (cursor.row > 0) {
      const current = lines[cursor.row] ?? "";
      const previous = lines[cursor.row - 1] ?? "";
      const newCol = previous.length;
      lines[cursor.row - 1] = previous + current;
      lines.splice(cursor.row, 1);
      cursor.row -= 1;
      cursor.col = newCol;
    }
  };

  const moveLeft = () => {
    if (cursor.col > 0) {
      cursor.col -= 1;
      return;
    }
    if (cursor.row > 0) {
      cursor.row -= 1;
      cursor.col = lines[cursor.row]?.length ?? 0;
    }
  };

  const moveRight = () => {
    const lineLength = lines[cursor.row]?.length ?? 0;
    if (cursor.col < lineLength) {
      cursor.col += 1;
      return;
    }
    if (cursor.row < lines.length - 1) {
      cursor.row += 1;
      cursor.col = 0;
    }
  };

  const moveUp = () => {
    if (cursor.row > 0) {
      cursor.row -= 1;
      cursor.col = Math.min(cursor.col, lines[cursor.row]?.length ?? 0);
    }
  };

  const moveDown = () => {
    if (cursor.row < lines.length - 1) {
      cursor.row += 1;
      cursor.col = Math.min(cursor.col, lines[cursor.row]?.length ?? 0);
    }
  };

  const handleEscapeSequence = (input: string, index: number): number => {
    const next = input[index + 1];
    if (next !== "[") {
      return index + 1;
    }
    const command = input[index + 2];
    switch (command) {
      case "A":
        moveUp();
        return index + 3;
      case "B":
        moveDown();
        return index + 3;
      case "C":
        moveRight();
        return index + 3;
      case "D":
        moveLeft();
        return index + 3;
      default:
        return index + 3;
    }
  };

  return new Promise((resolve) => {
    const onResize = () => {
      render();
    };

    const cleanup = () => {
      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.removeListener("resize", onResize);
      stdout.write("\x1b[?25h");
      stdout.write("\n");
    };

    const finish = (value: string | null) => {
      cleanup();
      resolve(value);
    };

    const onData = (data: string) => {
      let i = 0;
      while (i < data.length) {
        const ch = data[i];
        if (ch === "\x04") {
          finish(lines.join("\n"));
          return;
        }
        if (ch === "\x03") {
          finish(null);
          return;
        }
        if (ch === "\x1b") {
          i = handleEscapeSequence(data, i);
          continue;
        }
        if (ch === "\r" || ch === "\n") {
          insertNewline();
          i += 1;
          continue;
        }
        if (ch === "\x7f") {
          backspace();
          i += 1;
          continue;
        }
        if (ch === "\t") {
          insertText("\t");
          i += 1;
          continue;
        }
        if (ch >= " ") {
          insertText(ch);
          i += 1;
          continue;
        }
        i += 1;
      }
      render();
    };

    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    render();
    stdin.on("data", onData);
    stdout.on("resize", onResize);
  });
}
