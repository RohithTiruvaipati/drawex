// ANSI colors — falls back gracefully if terminal doesn't support them
const NO_COLOR = process.env.NO_COLOR || process.env.TERM === "dumb";

const c = (code) => (str) => NO_COLOR ? str : `\x1b[${code}m${str}\x1b[0m`;

export const bold   = c("1");
export const dim    = c("2");
export const red    = c("31");
export const yellow = c("33");
export const green  = c("32");
export const cyan   = c("36");
export const white  = c("37");
export const bgRed  = c("41");

export function colorBar(bar, level) {
  if (level === "over" || level === "critical") return red(bar);
  if (level === "warning")  return yellow(bar);
  if (level === "halfway")  return cyan(bar);
  return green(bar);
}

export function printWarningBanner(level, spent, limit, mode) {
  const pct = ((spent / limit) * 100).toFixed(1);
  const remaining = Math.max(limit - spent, 0);
  const modeWord = mode === "daily" ? "today" : mode === "weekly" ? "this week" : "this month";

  if (level === "over") {
    console.error("");
    console.error(bold(red("╔══════════════════════════════════════════╗")));
    console.error(bold(red("║  🚫  CLAUDE USAGE LIMIT REACHED          ║")));
    console.error(bold(red("╚══════════════════════════════════════════╝")));
    console.error(red(`   Spent $${spent.toFixed(4)} / $${limit.toFixed(2)} ${modeWord} (${pct}%)`));
    console.error("");
    console.error(white("   To override:  claude --force <your prompt>"));
    console.error(white("   To reset:      ccusage reset"));
    console.error(white("   Raise limit:   ccusage set-limit --" + mode + " <amount>"));
    console.error("");
    return;
  }

  if (level === "critical") {
    console.error("");
    console.error(bold(yellow("⚠️  WARNING: 90%+ of your " + mode + " limit used")));
    console.error(yellow(`   $${spent.toFixed(4)} spent — only $${remaining.toFixed(4)} remaining ${modeWord}`));
    console.error("");
    return;
  }

  if (level === "warning") {
    console.error("");
    console.error(yellow(`⚡ 75% of ${mode} limit reached — $${remaining.toFixed(4)} left ${modeWord}`));
    console.error("");
  }
}
