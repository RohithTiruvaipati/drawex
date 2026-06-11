#!/usr/bin/env node
/**
 * dx-wrap.js — drop-in replacement for the `claude` command
 *
 * Setup (add to ~/.zshrc or ~/.bashrc):
 *   export DRAWEX_REAL_CLAUDE="$(which claude)"
 *   alias claude="dx-wrap"
 */

import { spawn, execFileSync } from "child_process";
import { loadConfig, appendSession } from "../lib/store.js";
import { getWindowSpend, getAlertLevel, parseClaudeOutput } from "../lib/calc.js";
import { printWarningBanner } from "../lib/display.js";

// ─── Find real claude binary ──────────────────────────────────────────────────
function findRealClaude() {
  if (process.env.DRAWEX_REAL_CLAUDE) return process.env.DRAWEX_REAL_CLAUDE;
  if (process.env.CCUSAGE_REAL_CLAUDE) return process.env.CCUSAGE_REAL_CLAUDE;
  try {
    return execFileSync("sh", ["-c", "which -a claude 2>/dev/null | grep -v 'ccusage' | grep -v 'dx-wrap' | grep -v 'drawex' | grep -v 'dx' | head -1"], {
      encoding: "utf8",
    }).trim() || "claude";
  } catch {
    return "claude";
  }
}

const REAL_CLAUDE = findRealClaude();

// ─── Args: strip --force, pass rest to claude ─────────────────────────────────
const rawArgs = process.argv.slice(2);
const FORCE = rawArgs.includes("--force");
const claudeArgs = rawArgs.filter((a) => a !== "--force");

// ─── PRE-CHECK: block if over limit ──────────────────────────────────────────
const config = loadConfig();

if (config.mode && config.limit && !FORCE) {
  const spend = getWindowSpend(config.mode);
  const ratio = spend.cost / config.limit;
  if (getAlertLevel(ratio) === "over") {
    printWarningBanner("over", spend.cost, config.limit, config.mode);
    process.exit(1);
  }
}

// ─── Run claude, capture output ───────────────────────────────────────────────
let capturedOutput = "";

const child = spawn(REAL_CLAUDE, claudeArgs, {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  capturedOutput += chunk.toString();
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  capturedOutput += chunk.toString();
});

child.on("close", (exitCode) => {
  // ── Parse + log usage ───────────────────────────────────────────────────────
  const parsed = parseClaudeOutput(capturedOutput);
  const model = detectModel(claudeArgs);

  for (const p of parsed) {
    appendSession({
      timestamp: new Date().toISOString(),
      inputTokens: p.inputTokens || 0,
      outputTokens: p.outputTokens || 0,
      cost: p.cost,
      model: model || "default",
      note: null,
      auto: true,
    });
  }

  // ── POST-SESSION: warn if approaching limit ─────────────────────────────────
  if (parsed.length > 0 && config.mode && config.limit) {
    const fresh = getWindowSpend(config.mode);
    const level = getAlertLevel(fresh.cost / config.limit);
    if (level === "warning" || level === "critical") {
      printWarningBanner(level, fresh.cost, config.limit, config.mode);
    }
  }

  process.exit(exitCode ?? 0);
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error(`\ndrawex: cannot find claude binary at "${REAL_CLAUDE}"`);
    console.error(`Set DRAWEX_REAL_CLAUDE to the full path of your claude install.\n`);
  } else {
    console.error(`\ndrawex wrapper error: ${err.message}\n`);
  }
  process.exit(1);
});

function detectModel(args) {
  const i = args.findIndex((a) => a === "--model" || a === "-m");
  return i !== -1 ? args[i + 1] : null;
}
