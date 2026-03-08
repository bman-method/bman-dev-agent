import fs from "node:fs";
import path from "node:path";

type EditorOptions = {
  header: string;
};

type Cursor = {
  row: number;
  col: number;
};

const DEFAULT_HEADER = "Enter task content. Ctrl+D to save, Ctrl+C to cancel.";
const TAB_WIDTH = 8;
const COMPLETION_LIMIT = 8;
const COMPLETION_SKIP_DIRS = new Set([".git", "node_modules"]);

type CompletionEntry = {
  value: string;
  display: string;
};

type CompletionState = {
  active: boolean;
  startCol: number;
  query: string;
  matches: CompletionEntry[];
  selectedIndex: number;
};

const buildPathIndex = (root: string): CompletionEntry[] => {
  const results: CompletionEntry[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && COMPLETION_SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      const display = entry.isDirectory() ? `${fullPath}${path.sep}` : fullPath;
      results.push({ value: fullPath, display });
      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }
  return results;
};

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

const visualRowsForLine = (line: string, width: number): number => {
  const safeWidth = width > 0 ? width : 1;
  const visualLength = visualColumnForIndex(line, line.length);
  if (visualLength === 0) {
    return 1;
  }
  return Math.floor((visualLength - 1) / safeWidth) + 1;
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
  const pathIndex = buildPathIndex(process.cwd());
  const completion: CompletionState = {
    active: false,
    startCol: 0,
    query: "",
    matches: [],
    selectedIndex: 0,
  };

  const refreshCompletion = () => {
    const line = lines[cursor.row] ?? "";
    const atIndex = line.lastIndexOf("@", Math.max(0, cursor.col - 1));
    if (atIndex < 0) {
      completion.active = false;
      completion.matches = [];
      completion.query = "";
      completion.selectedIndex = 0;
      return;
    }
    const between = line.slice(atIndex + 1, cursor.col);
    if (between.length === 0 || /\s/.test(between)) {
      completion.active = false;
      completion.matches = [];
      completion.query = "";
      completion.selectedIndex = 0;
      return;
    }
    const query = between;
    const matches = pathIndex.filter((entry) => entry.value.includes(query));
    completion.active = matches.length > 0;
    completion.startCol = atIndex;
    completion.query = query;
    completion.matches = matches.slice(0, COMPLETION_LIMIT);
    if (completion.selectedIndex >= completion.matches.length) {
      completion.selectedIndex = 0;
    }
  };

  const applyCompletion = () => {
    if (!completion.active || completion.matches.length === 0) {
      return;
    }
    const selected = completion.matches[completion.selectedIndex];
    if (!selected) {
      return;
    }
    const line = lines[cursor.row] ?? "";
    const before = line.slice(0, completion.startCol);
    const after = line.slice(cursor.col);
    lines[cursor.row] = `${before}${selected.value}${after}`;
    cursor.col = completion.startCol + selected.value.length;
    completion.active = false;
    completion.matches = [];
  };

  const render = () => {
    const width = stdout.columns ?? 80;
    const output: string[] = [];
    output.push("\x1b[?25h\x1b[2J\x1b[H");
    output.push(`${header}\n`);
    for (const line of lines) {
      output.push(`${expandTabs(line)}\n`);
    }
    if (completion.active && completion.matches.length > 0) {
      output.push("\nAutocomplete: ↑/↓ select, Tab insert\n");
      for (let i = 0; i < completion.matches.length; i += 1) {
        const entry = completion.matches[i];
        const selected = i === completion.selectedIndex;
        if (selected) {
          output.push(`\x1b[7m${entry.display}\x1b[0m\n`);
        } else {
          output.push(`${entry.display}\n`);
        }
      }
    }
    const headerRows = visualRowsForLine(header, width);
    let rowsBefore = 0;
    for (let i = 0; i < cursor.row; i += 1) {
      rowsBefore += visualRowsForLine(lines[i] ?? "", width);
    }
    const cursorVisualCol = visualColumnForIndex(lines[cursor.row] ?? "", cursor.col);
    const rowOffset = Math.floor(cursorVisualCol / (width > 0 ? width : 1));
    const row = headerRows + 1 + rowsBefore + rowOffset;
    const col = (cursorVisualCol % (width > 0 ? width : 1)) + 1;
    output.push(`\x1b[${row};${col}H`);
    stdout.write(output.join(""));
  };

  const insertText = (text: string) => {
    const line = lines[cursor.row] ?? "";
    const before = line.slice(0, cursor.col);
    const after = line.slice(cursor.col);
    lines[cursor.row] = before + text + after;
    cursor.col += text.length;
    refreshCompletion();
  };

  const insertNewline = () => {
    const line = lines[cursor.row] ?? "";
    const before = line.slice(0, cursor.col);
    const after = line.slice(cursor.col);
    lines[cursor.row] = before;
    lines.splice(cursor.row + 1, 0, after);
    cursor.row += 1;
    cursor.col = 0;
    refreshCompletion();
  };

  const backspace = () => {
    if (cursor.col > 0) {
      const line = lines[cursor.row] ?? "";
      lines[cursor.row] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
      cursor.col -= 1;
      refreshCompletion();
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
      refreshCompletion();
    }
  };

  const moveLeft = () => {
    if (cursor.col > 0) {
      cursor.col -= 1;
      refreshCompletion();
      return;
    }
    if (cursor.row > 0) {
      cursor.row -= 1;
      cursor.col = lines[cursor.row]?.length ?? 0;
      refreshCompletion();
    }
  };

  const moveRight = () => {
    const lineLength = lines[cursor.row]?.length ?? 0;
    if (cursor.col < lineLength) {
      cursor.col += 1;
      refreshCompletion();
      return;
    }
    if (cursor.row < lines.length - 1) {
      cursor.row += 1;
      cursor.col = 0;
      refreshCompletion();
    }
  };

  const moveUp = () => {
    if (cursor.row > 0) {
      cursor.row -= 1;
      cursor.col = Math.min(cursor.col, lines[cursor.row]?.length ?? 0);
      refreshCompletion();
    }
  };

  const moveDown = () => {
    if (cursor.row < lines.length - 1) {
      cursor.row += 1;
      cursor.col = Math.min(cursor.col, lines[cursor.row]?.length ?? 0);
      refreshCompletion();
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
        if (completion.active) {
          completion.selectedIndex = Math.max(0, completion.selectedIndex - 1);
        } else {
          moveUp();
        }
        return index + 3;
      case "B":
        if (completion.active) {
          completion.selectedIndex = Math.min(
            completion.matches.length - 1,
            completion.selectedIndex + 1,
          );
        } else {
          moveDown();
        }
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
          if (completion.active) {
            applyCompletion();
            i += 1;
            continue;
          }
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
          if (completion.active) {
            applyCompletion();
          } else {
            insertText("\t");
          }
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
