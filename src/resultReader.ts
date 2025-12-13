import fs from "node:fs";
import { RawAgentResult, ResultReader } from "./types";

export class DefaultResultReader implements ResultReader {
  read(path: string): RawAgentResult {
    const content = fs.readFileSync(path, "utf8");
    return JSON.parse(content) as RawAgentResult;
  }
}
