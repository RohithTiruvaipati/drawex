import { loadUsage } from "./store.js";

// ─── Pricing (per 1M tokens, USD) ────────────────────────────────────────────
const PRICING = {
  "claude-opus-4":    { input: 15.0,  output: 75.0  },
  "claude-sonnet-4":  { input: 3.0,   output: 15.0  },
  "claude-haiku-4":   { input: 0.8,   output: 4.0   },
  "default":          { input: 3.0,   output: 15.0  },
};

export function calcCost(inputTokens, outputTokens, model = "default") {
  const key = Object.keys(PRICING).find((k) => k !== "default" && model.includes(k)) || "default";
  const p = PRICING[key];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ─── Time Windows ─────────────────────────────────────────────────────────────
export function getWindowStart(mode) {
  const now = new Date();
  if (mode === "daily")   return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (mode === "weekly")  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  if (mode === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null;
}

export function getWindowLabel(mode) {
  const now = new Date();
  if (mode === "daily") return now.toLocaleDateString();
  if (mode === "weekly") {
    const s = new Date(getWindowStart("weekly"));
    const e = new Date(s); e.setDate(e.getDate() + 6);
    return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
  }
  if (mode === "monthly") return now.toLocaleString("default", { month: "long", year: "numeric" });
  return "";
}

export function getWindowSpend(mode) {
  const usage = loadUsage();
  const windowStart = getWindowStart(mode);
  if (!windowStart) return { cost: 0, inputTokens: 0, outputTokens: 0, sessions: 0 };

  return usage.sessions
    .filter((s) => s.timestamp >= windowStart)
    .reduce(
      (acc, s) => ({
        cost: acc.cost + (s.cost || 0),
        inputTokens: acc.inputTokens + (s.inputTokens || 0),
        outputTokens: acc.outputTokens + (s.outputTokens || 0),
        sessions: acc.sessions + 1,
      }),
      { cost: 0, inputTokens: 0, outputTokens: 0, sessions: 0 }
    );
}

// ─── Parse Claude Code output for cost/token lines ───────────────────────────
// Claude Code prints lines like:
//   Cost: $0.0123 (1,234 input, 567 output tokens)
// or:
//   Tokens: 1234 input, 567 output | Cost: $0.0123
export function parseClaudeOutput(text) {
  const results = [];

  // Pattern 1: "Cost: $0.0123 (1,234 input, 567 output tokens)"
  const p1 = /Cost:\s*\$([0-9.]+)\s*\(([0-9,]+)\s*input[^,]*,\s*([0-9,]+)\s*output/gi;
  let m;
  while ((m = p1.exec(text)) !== null) {
    results.push({
      cost: parseFloat(m[1]),
      inputTokens: parseInt(m[2].replace(/,/g, ""), 10),
      outputTokens: parseInt(m[3].replace(/,/g, ""), 10),
    });
  }

  // Pattern 2: lines with token counts and a cost somewhere nearby
  if (results.length === 0) {
    const p2 = /([0-9,]+)\s*input[^,]*,\s*([0-9,]+)\s*output.*?\$([0-9.]+)/gi;
    while ((m = p2.exec(text)) !== null) {
      results.push({
        inputTokens: parseInt(m[1].replace(/,/g, ""), 10),
        outputTokens: parseInt(m[2].replace(/,/g, ""), 10),
        cost: parseFloat(m[3]),
      });
    }
  }

  // Pattern 3: just a cost line with no tokens (fallback)
  if (results.length === 0) {
    const p3 = /\$([0-9]+\.[0-9]+)/g;
    while ((m = p3.exec(text)) !== null) {
      const val = parseFloat(m[1]);
      if (val > 0 && val < 10) { // sanity range for a single session
        results.push({ cost: val, inputTokens: 0, outputTokens: 0 });
      }
    }
  }

  return results;
}

// ─── Bar Renderer ─────────────────────────────────────────────────────────────
export function renderBar(spent, limit, width = 24) {
  const ratio = limit > 0 ? Math.min(spent / limit, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "[" + "█".repeat(filled) + "·".repeat(empty) + "]";
}

export function getAlertLevel(ratio) {
  if (ratio >= 1.0)  return "over";
  if (ratio >= 0.90) return "critical";   // 90%+
  if (ratio >= 0.75) return "warning";    // 75%+
  if (ratio >= 0.50) return "halfway";    // 50%+
  return "ok";
}
