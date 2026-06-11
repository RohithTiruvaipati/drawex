#!/usr/bin/env node
/**
 * dx-wrap.js — drop-in replacement for the `claude` command
 *
 * Setup (add to ~/.zshrc or ~/.bashrc):
 *   export DRAWEX_REAL_CLAUDE="$(which claude)"
 *   alias claude="dx-wrap"
 */

import fs from "fs";
import path from "path";
import os from "os";
import { spawn, execFileSync } from "child_process";
import { loadConfig, appendSession, DATA_DIR } from "../lib/store.js";
import { getWindowSpend, getAlertLevel, parseClaudeOutput, calcCost } from "../lib/calc.js";
import { printWarningBanner, bold, red } from "../lib/display.js";

// ─── Find real claude binary ──────────────────────────────────────────────────
function findRealClaude() {
  if (process.env.DRAWEX_REAL_CLAUDE) return process.env.DRAWEX_REAL_CLAUDE;
  try {
    return execFileSync("sh", ["-c", "which -a claude 2>/dev/null | grep -v 'dx-wrap' | grep -v 'drawex' | grep -v 'dx' | head -1"], {
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

// ─── Run claude with pseudo-terminal wrapping (using script) ──────────────────
const tempLogFile = path.join(DATA_DIR, `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.log`);

let spawnCmd = "script";
let spawnArgs = [];

if (process.platform === "darwin") {
  // macOS script: script -F -q <logFile> <command> [args...]
  spawnArgs = ["-F", "-q", tempLogFile, REAL_CLAUDE, ...claudeArgs];
} else {
  // Linux script: script -q -c "<command> [args...]" <logFile>
  const escapedCmd = [REAL_CLAUDE, ...claudeArgs].map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(" ");
  spawnArgs = ["-q", "-c", escapedCmd, tempLogFile];
}

const child = spawn(spawnCmd, spawnArgs, {
  stdio: "inherit",
  env: process.env,
});

// ─── Real-Time Mid-Session Spending Enforcement ───────────────────────────────
const CLAUDE_DATA_DIR = path.join(os.homedir(), ".claude");
const startTime = Date.now();
const historicalSpend = config.mode ? getWindowSpend(config.mode).cost : 0;

function getActiveSessionFiles(startTimeMs) {
  const projectsDir = path.join(CLAUDE_DATA_DIR, "projects");
  if (!fs.existsSync(projectsDir)) return [];

  const filesList = [];
  function recurse(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        recurse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs >= startTimeMs) {
            filesList.push({ path: fullPath, mtimeMs: stat.mtimeMs });
          }
        } catch {}
      }
    }
  }

  recurse(projectsDir);
  return filesList;
}

const checkerInterval = setInterval(() => {
  if (!config.mode || !config.limit || FORCE) return;

  const activeFiles = getActiveSessionFiles(startTime);
  let currentSessionSpend = 0;

  for (const fileObj of activeFiles) {
    try {
      const content = fs.readFileSync(fileObj.path, "utf8");
      const lines = content.split("\n").filter(l => l.trim());
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const usage = obj.usage || obj;
          if (usage && (usage.inputTokens || usage.prompt_tokens || usage.input)) {
            const input = usage.inputTokens || usage.prompt_tokens || usage.input || 0;
            const output = usage.outputTokens || usage.completion_tokens || usage.output || 0;
            const model = obj.model || usage.model || detectModel(claudeArgs) || "default";
            currentSessionSpend += calcCost(input, output, model);
          }
        } catch {}
      }
    } catch {}
  }

  if ((historicalSpend + currentSessionSpend) >= config.limit) {
    clearInterval(checkerInterval);
    console.error(bold(red("\n\n╔══════════════════════════════════════════╗")));
    console.error(bold(red("║  🚫  CLAUDE USAGE LIMIT REACHED (KILLED) ║")));
    console.error(bold(red("╚══════════════════════════════════════════╝")));
    console.error(red(`   Spent $${(historicalSpend + currentSessionSpend).toFixed(4)} / $${config.limit.toFixed(2)} limit exceeded mid-session.`));
    console.error(red("   Terminating session to prevent overspending...\n"));
    
    child.kill("SIGKILL");
  }
}, 2000);

child.on("close", (exitCode) => {
  clearInterval(checkerInterval);

  let capturedOutput = "";
  if (fs.existsSync(tempLogFile)) {
    try {
      const rawOutput = fs.readFileSync(tempLogFile, "utf8");
      // Strip ANSI escape codes to make it plain text
      capturedOutput = rawOutput.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      // Clean up the temp file
      fs.unlinkSync(tempLogFile);
    } catch (err) {
      console.error(`\ndrawex: failed to read session log: ${err.message}`);
    }
  }

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
  clearInterval(checkerInterval);

  // Clean up if temp file was created
  if (fs.existsSync(tempLogFile)) {
    try { fs.unlinkSync(tempLogFile); } catch {}
  }
  
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
