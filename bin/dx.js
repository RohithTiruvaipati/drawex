#!/usr/bin/env node
/**
 * ccusage — Claude Code usage tracker
 *
 * Commands:
 *   ccusage status                  Show usage bar + stats
 *   ccusage set-limit --daily 0.40  Set spending limit
 *   ccusage history [--n 20]        Show recent sessions
 *   ccusage log --cost 0.012 ...    Manually log a session
 *   ccusage reset                   Clear usage data
 *   ccusage config                  Show current config
 *   ccusage install-wrapper         Print wrapper install instructions
 */

import { loadConfig, saveConfig, loadUsage, saveUsage, appendSession, DATA_DIR } from "../lib/store.js";
import { getWindowSpend, getWindowLabel, renderBar, getAlertLevel, calcCost } from "../lib/calc.js";
import { bold, dim, red, yellow, green, cyan, white, colorBar } from "../lib/display.js";

const args = process.argv.slice(2);
const cmd = args[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFlag(flag, defaultVal = null) {
  const i = args.indexOf(flag);
  if (i === -1) return defaultVal;
  return args[i + 1] ?? true;
}

function hasFlag(flag) {
  return args.includes(flag);
}

function hr(char = "─", width = 44) {
  return char.repeat(width);
}

function pad(str, n) {
  return String(str).padEnd(n);
}

// ─── status ──────────────────────────────────────────────────────────────────

function cmdStatus() {
  const config = loadConfig();

  if (!config.mode || !config.limit) {
    console.log("");
    console.log(bold(cyan("  ccusage — Claude Code Usage Tracker")));
    console.log(dim("  No limit configured yet.\n"));
    console.log("  Get started:");
    console.log(cyan("    ccusage set-limit --daily 0.40"));
    console.log(cyan("    ccusage set-limit --weekly 6.00"));
    console.log(cyan("    ccusage set-limit --monthly 30.00"));
    console.log("");
    return;
  }

  const { mode, limit } = config;
  const spend = getWindowSpend(mode);
  const ratio = limit > 0 ? spend.cost / limit : 0;
  const level = getAlertLevel(ratio);
  const bar = renderBar(spend.cost, limit);
  const coloredBar = colorBar(bar, level);
  const pct = (ratio * 100).toFixed(1);
  const remaining = Math.max(limit - spend.cost, 0);
  const label = getWindowLabel(mode);
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

  const statusIcon = {
    ok:       green("● OK"),
    halfway:  cyan("● 50%+"),
    warning:  yellow("⚠ Warning"),
    critical: yellow("⚠ Critical"),
    over:     red("✖ OVER LIMIT"),
  }[level];

  console.log("");
  console.log(bold(`  Claude Code Usage — ${modeLabel}`));
  console.log(dim(`  ${label}`));
  console.log("");
  console.log(`  ${coloredBar}  ${bold(pct + "%")}  ${statusIcon}`);
  console.log("");
  console.log(`  ${pad("Spent:", 12)} ${bold("$" + spend.cost.toFixed(4))}`);
  console.log(`  ${pad("Limit:", 12)} $${limit.toFixed(2)}`);
  console.log(`  ${pad("Remaining:", 12)} ${remaining < limit * 0.1 ? yellow("$" + remaining.toFixed(4)) : green("$" + remaining.toFixed(4))}`);
  console.log("");
  console.log(dim(`  Sessions: ${spend.sessions}  |  Tokens in: ${spend.inputTokens.toLocaleString()}  |  Tokens out: ${spend.outputTokens.toLocaleString()}`));
  console.log("");

  // Show all three windows for context
  const modes = ["daily", "weekly", "monthly"];
  const others = modes.filter((m) => m !== mode);
  const rows = others.map((m) => {
    const s = getWindowSpend(m);
    return dim(`  ${pad(m.charAt(0).toUpperCase() + m.slice(1) + ":", 10)} $${s.cost.toFixed(4)} (${s.sessions} sessions)`);
  });
  if (rows.length) {
    console.log(dim("  Other windows:"));
    rows.forEach((r) => console.log(r));
    console.log("");
  }
}

// ─── set-limit ───────────────────────────────────────────────────────────────

function cmdSetLimit() {
  const daily   = getFlag("--daily");
  const weekly  = getFlag("--weekly");
  const monthly = getFlag("--monthly");

  const chosen = daily ? ["daily", daily] : weekly ? ["weekly", weekly] : monthly ? ["monthly", monthly] : null;

  if (!chosen) {
    console.error(red("Usage: ccusage set-limit --daily <amount> | --weekly <amount> | --monthly <amount>"));
    console.error(dim("Example: ccusage set-limit --daily 0.40"));
    process.exit(1);
  }

  const [mode, rawAmount] = chosen;
  const limit = parseFloat(rawAmount);

  if (isNaN(limit) || limit <= 0) {
    console.error(red(`Invalid amount: "${rawAmount}". Use a positive number like 0.40 or 30`));
    process.exit(1);
  }

  const config = loadConfig();
  config.mode = mode;
  config.limit = limit;
  saveConfig(config);

  const modeWord = mode === "daily" ? "day" : mode === "weekly" ? "week" : "month";
  console.log("");
  console.log(green(`  ✓ Limit set: ${bold("$" + limit.toFixed(2))} per ${modeWord}`));
  console.log(dim(`  Warnings at: 50% · 75% · 90%`));
  console.log(dim(`  Hard block at: 100% (override with --force)`));
  console.log("");
  console.log(dim("  Run ccusage status to see your usage bar."));
  console.log("");
}

// ─── history ─────────────────────────────────────────────────────────────────

function cmdHistory() {
  const n = parseInt(getFlag("--n", "15"), 10);
  const usage = loadUsage();
  const recent = usage.sessions.slice(-n).reverse();

  if (recent.length === 0) {
    console.log(dim("\n  No sessions logged yet.\n"));
    return;
  }

  console.log("");
  console.log(bold("  Recent Sessions"));
  console.log(dim("  " + hr()));

  for (const s of recent) {
    const date = new Date(s.timestamp).toLocaleString();
    const note = s.note ? dim(` — ${s.note}`) : "";
    console.log(`\n  ${cyan(date)}${note}`);
    console.log(`  ${pad("Cost:", 10)} $${s.cost.toFixed(4)}`);
    if (s.inputTokens) {
      console.log(dim(`  ${pad("Tokens:", 10)} ${s.inputTokens.toLocaleString()} in / ${s.outputTokens.toLocaleString()} out`));
    }
    if (s.model && s.model !== "default") {
      console.log(dim(`  ${pad("Model:", 10)} ${s.model}`));
    }
  }

  const allTime = usage.sessions.reduce((a, s) => a + s.cost, 0);
  console.log("");
  console.log(dim("  " + hr()));
  console.log(`  ${bold("All-time total:")} $${allTime.toFixed(4)} across ${usage.sessions.length} sessions`);
  console.log("");
}

// ─── log ─────────────────────────────────────────────────────────────────────

function cmdLog() {
  const cost    = parseFloat(getFlag("--cost", "0"));
  const input   = parseInt(getFlag("--input", "0"), 10);
  const output  = parseInt(getFlag("--output", "0"), 10);
  const model   = getFlag("--model", "default");
  const note    = getFlag("--note", null);

  const finalCost = cost > 0 ? cost : calcCost(input, output, model);

  if (finalCost <= 0 && input <= 0) {
    console.error(red("Provide --cost <amount> or --input <tokens> --output <tokens>"));
    process.exit(1);
  }

  const session = {
    timestamp: new Date().toISOString(),
    inputTokens: input,
    outputTokens: output,
    cost: finalCost,
    model,
    note,
    manual: true,
  };

  appendSession(session);
  console.log(green(`\n  ✓ Session logged: $${finalCost.toFixed(4)}\n`));
}

// ─── reset ───────────────────────────────────────────────────────────────────

function cmdReset() {
  if (!hasFlag("--confirm")) {
    console.log(yellow("\n  This will delete all usage history (config/limits kept)."));
    console.log(dim("  Run: ccusage reset --confirm\n"));
    return;
  }
  saveUsage({ sessions: [] });
  console.log(green("\n  ✓ Usage data cleared. Limits unchanged.\n"));
}

// ─── config ──────────────────────────────────────────────────────────────────

function cmdConfig() {
  const config = loadConfig();
  console.log("");
  console.log(bold("  Configuration"));
  console.log(dim("  " + hr()));
  if (!config.mode) {
    console.log(dim("  No limit set. Run: ccusage set-limit --daily 0.40"));
  } else {
    const modeWord = config.mode === "daily" ? "day" : config.mode === "weekly" ? "week" : "month";
    console.log(`  ${pad("Mode:", 12)} ${config.mode}`);
    console.log(`  ${pad("Limit:", 12)} $${config.limit.toFixed(2)} / ${modeWord}`);
  }
  console.log(dim(`  ${pad("Data dir:", 12)} ${DATA_DIR}`));
  console.log("");
}

// ─── install-wrapper ─────────────────────────────────────────────────────────

function cmdInstallWrapper() {
  console.log(`
${bold("  Install the claude wrapper")}
${dim("  " + hr())}

  The wrapper replaces the ${cyan("claude")} command in your terminal.
  It runs the real Claude Code, captures output, logs usage,
  and enforces your spending limit automatically.

${bold("  Step 1 — Find where the real claude binary is:")}

    ${cyan("which claude")}

${bold("  Step 2 — Create the wrapper script:")}

    Create a file at ${cyan("~/.ccusage/claude-wrapper.sh")} with this content:
    ${dim("(ccusage will generate this file for you — see below)")}

${bold("  Step 3 — Add to your shell config (~/.zshrc or ~/.bashrc):")}

    ${cyan('export CCUSAGE_REAL_CLAUDE="$(which claude)"')}
    ${cyan('alias claude="node $(npm root -g)/ccusage/bin/claude-wrapper.js"')}

  Or if you installed ccusage globally:
    ${cyan('alias claude="ccusage-wrap"')}

${bold("  Step 4 — Reload your shell:")}

    ${cyan("source ~/.zshrc")}

${bold("  How it works:")}
  • Every time you run ${cyan("claude")} the wrapper checks your limit first
  • If you're at ${yellow("75%")} or ${yellow("90%")} it shows a warning after the session
  • If you're at ${red("100%")} it ${bold("blocks")} the command before Claude even runs
  • Use ${cyan("claude --force")} to override the block for urgent work

`);
}

// ─── help ─────────────────────────────────────────────────────────────────────

function cmdHelp() {
  console.log(`
${bold("  ccusage — Claude Code Usage Tracker")}
${dim("  " + hr())}

  ${bold("Commands:")}

  ${cyan("ccusage status")}                        Show usage bar and stats
  ${cyan("ccusage set-limit --daily <$>")}         Set daily spending limit
  ${cyan("ccusage set-limit --weekly <$>")}        Set weekly spending limit
  ${cyan("ccusage set-limit --monthly <$>")}       Set monthly spending limit
  ${cyan("ccusage history [--n <count>]")}         Show recent sessions (default 15)
  ${cyan("ccusage log --cost <$>")}                Manually log a session cost
  ${cyan("ccusage log --input <n> --output <n>")}  Log by token counts
  ${cyan("ccusage reset [--confirm]")}             Clear all usage data
  ${cyan("ccusage config")}                        Show current config
  ${cyan("ccusage install-wrapper")}               How to set up auto-tracking

  ${bold("Limit behavior:")}
  ${green("●")} 0–50%   No interruption
  ${cyan("●")} 50%     Noted in status
  ${yellow("⚠")} 75%     Warning after session
  ${yellow("⚠")} 90%     Strong warning after session
  ${red("✖")} 100%    ${bold("Hard block")} — claude won't run
             Override with: ${cyan("claude --force <prompt>")}

  ${dim("Data stored in: ~/.ccusage/")}
`);
}

// ─── Router ──────────────────────────────────────────────────────────────────

switch (cmd) {
  case "status":
  case "stat":
  case undefined:
    cmdStatus(); break;

  case "set-limit":
  case "limit":
    cmdSetLimit(); break;

  case "history":
  case "hist":
    cmdHistory(); break;

  case "log":
    cmdLog(); break;

  case "reset":
    cmdReset(); break;

  case "config":
    cmdConfig(); break;

  case "install-wrapper":
    cmdInstallWrapper(); break;

  case "help":
  case "--help":
  case "-h":
    cmdHelp(); break;

  default:
    console.error(red(`\n  Unknown command: "${cmd}"\n`));
    cmdHelp();
    process.exit(1);
}
