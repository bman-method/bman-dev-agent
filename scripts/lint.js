#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectDir = path.resolve(__dirname, "..");
const configPath = path.join(projectDir, "tsconfig.json");
const formatHost = {
  getCanonicalFileName: (filePath) => filePath,
  getCurrentDirectory: () => projectDir,
  getNewLine: () => ts.sys.newLine,
};

const shouldFix = process.argv.includes("--fix");

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  reportAndExit([configFile.error]);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  projectDir,
  {
    noEmit: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitAny: true,
  },
  configPath
);

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

if (shouldFix) {
  applyCurlyFixes(parsedConfig, printer);
}

const allDiagnostics = collectDiagnostics(parsedConfig);
if (allDiagnostics.length > 0) {
  reportAndExit(allDiagnostics);
}
console.log("Lint passed.");

function applyCurlyFixes(config, sourcePrinter) {
  const program = ts.createProgram(config.fileNames, config.options);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.startsWith(projectDir)) continue;

    const { diagnostics: curlyDiagnostics, updatedSource } = enforceCurlyBraces(
      sourceFile,
      true,
      sourcePrinter
    );

    if (curlyDiagnostics.length > 0 && updatedSource) {
      fs.writeFileSync(sourceFile.fileName, updatedSource, "utf8");
    }
  }
}

function collectDiagnostics(config) {
  const program = ts.createProgram(config.fileNames, config.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const curlyDiagnostics = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.startsWith(projectDir)) continue;

    curlyDiagnostics.push(...enforceCurlyBraces(sourceFile, false, printer).diagnostics);
  }

  return [...diagnostics, ...curlyDiagnostics];
}

function enforceCurlyBraces(sourceFile, shouldApplyFix, sourcePrinter) {
  const curlyDiagnostics = [];
  let updatedSource = null;

  if (shouldApplyFix) {
    const { transformed, diagnostics, changed } = transformCurlyBraces(
      sourceFile
    );
    curlyDiagnostics.push(...diagnostics);
    if (changed) {
      updatedSource = sourcePrinter.printFile(transformed);
    }
  } else {
    curlyDiagnostics.push(...collectCurlyDiagnostics(sourceFile));
  }

  return { diagnostics: curlyDiagnostics, updatedSource };
}

function transformCurlyBraces(sourceFile) {
  let changed = false;
  const diagnostics = [];

  const transformer = (context) => {
    const visit = (node) => {
      const { node: updatedNode, changed: nodeChanged } = enforceBlocks(
        node,
        diagnostics,
        true
      );
      if (nodeChanged) {
        changed = true;
      }

      return ts.visitEachChild(updatedNode, visit, context);
    };

    return (node) => ts.visitNode(node, visit);
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformed = result.transformed[0];
  result.dispose();

  return { transformed, diagnostics, changed };
}

function collectCurlyDiagnostics(sourceFile) {
  const diagnostics = [];
  const visit = (node) => {
    enforceBlocks(node, diagnostics, false);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return diagnostics;
}

function enforceBlocks(node, diagnostics, applyFix) {
  const wrapIfNeeded = (statement, keyword) => {
    if (ts.isBlock(statement)) {
      return { statement, changed: false };
    }
    diagnostics.push(createDiagnostic(statement, keyword));
    if (!applyFix) {
      return { statement, changed: false };
    }
    return {
      statement: ts.factory.createBlock([ensureStatement(statement)], true),
      changed: true,
    };
  };

  if (ts.isIfStatement(node)) {
    const thenResult = wrapIfNeeded(node.thenStatement, "if");
    let elseResult = { statement: node.elseStatement, changed: false };

    if (node.elseStatement && !ts.isIfStatement(node.elseStatement)) {
      elseResult = wrapIfNeeded(node.elseStatement, "else");
    }

    if (applyFix && (thenResult.changed || elseResult.changed)) {
      return {
        node: ts.factory.updateIfStatement(
          node,
          node.expression,
          thenResult.statement,
          elseResult.statement ?? undefined
        ),
        changed: true,
      };
    }

    return { node, changed: false };
  }

  if (ts.isForStatement(node)) {
    const result = wrapIfNeeded(node.statement, "for");
    if (applyFix && result.changed) {
      return {
        node: ts.factory.updateForStatement(
          node,
          node.initializer,
          node.condition,
          node.incrementor,
          result.statement
        ),
        changed: true,
      };
    }
    return { node, changed: false };
  }

  if (ts.isForInStatement(node)) {
    const result = wrapIfNeeded(node.statement, "for-in");
    if (applyFix && result.changed) {
      return {
        node: ts.factory.updateForInStatement(
          node,
          node.initializer,
          node.expression,
          result.statement
        ),
        changed: true,
      };
    }
    return { node, changed: false };
  }

  if (ts.isForOfStatement(node)) {
    const result = wrapIfNeeded(node.statement, "for-of");
    if (applyFix && result.changed) {
      return {
        node: ts.factory.updateForOfStatement(
          node,
          node.awaitModifier,
          node.initializer,
          node.expression,
          result.statement
        ),
        changed: true,
      };
    }
    return { node, changed: false };
  }

  if (ts.isWhileStatement(node)) {
    const result = wrapIfNeeded(node.statement, "while");
    if (applyFix && result.changed) {
      return {
        node: ts.factory.updateWhileStatement(
          node,
          node.expression,
          result.statement
        ),
        changed: true,
      };
    }
    return { node, changed: false };
  }

  if (ts.isDoStatement(node)) {
    const result = wrapIfNeeded(node.statement, "do-while");
    if (applyFix && result.changed) {
      return {
        node: ts.factory.updateDoStatement(
          node,
          result.statement,
          node.expression
        ),
        changed: true,
      };
    }
    return { node, changed: false };
  }

  return { node, changed: false };
}

function ensureStatement(statement) {
  if (ts.isBlock(statement)) {
    return statement;
  }
  if (ts.isEmptyStatement(statement)) {
    return ts.factory.createEmptyStatement();
  }
  return statement;
}

function createDiagnostic(statement, keyword) {
  return {
    file: statement.getSourceFile(),
    start: statement.getStart(),
    length: statement.getWidth(),
    category: ts.DiagnosticCategory.Error,
    code: 9001,
    messageText: `Add curly braces to the ${keyword} statement.`,
  };
}

function reportAndExit(diags) {
  const message = ts.formatDiagnosticsWithColorAndContext(diags, formatHost);
  console.error(message.trimEnd());
  process.exit(1);
}
