# ccusage

> Track your Claude Code spending. Get warned before you overspend. Get blocked when you do.

A lightweight CLI tool that wraps the `claude` command, logs every session's cost automatically, and enforces daily, weekly, or monthly spending limits — with hard blocks, not just suggestions.

```
  Claude Code Usage — Daily
  6/10/2026

  [████████████·············]  50.2%  ● OK

  Spent:       $0.2008
  Limit:       $0.40
  Remaining:   $0.1992

  Sessions: 3  |  Tokens in: 12,400  |  Tokens out: 4,200
```

---

## Why

Claude Code doesn't expose per-session cost tracking or spending limits natively — especially relevant at enterprise scale where daily usage can compound quickly. `ccusage` fills that gap with zero cloud dependency: everything lives in `~/.ccusage/` on your machine.

---

## Install

**Requirements:** Node.js 18+

```bash
git clone https://github.com/<your-username>/ccusage
cd ccusage
npm install -g .
```

Verify:
```bash
ccusage --help
```

---

## Quick Start

```bash
# 1. Set a limit
ccusage set-limit --daily 0.40
ccusage set-limit --weekly 6.00
ccusage set-limit --monthly 30.00

# 2. Check your usage anytime
ccusage status

# 3. See session history
ccusage history
```

---

## Auto-tracking (Wrapper Setup)

The wrapper sits in front of the real `claude` binary. It checks your limit before every run, captures Claude's output to parse usage, and logs each session automatically.

**Step 1 — Find your claude binary:**
```bash
which claude
# /usr/local/bin/claude
```

**Step 2 — Add to your shell config** (`~/.zshrc` or `~/.bashrc`):
```bash
export CCUSAGE_REAL_CLAUDE="/usr/local/bin/claude"
alias claude="node $(npm root -g)/ccusage/bin/claude-wrapper.js"
```

**Step 3 — Reload:**
```bash
source ~/.zshrc
```

Now every `claude` call is tracked automatically — no other changes to your workflow.

---

## Limit Behavior

| Usage | What happens |
|-------|-------------|
| 0–50% | Silent — no interruption |
| 75% | ⚡ Warning printed after the session |
| 90% | ⚠️ Strong warning printed after the session |
| **100%** | 🚫 **Hard block — `claude` won't run** |

When blocked:
```
╔══════════════════════════════════════════╗
║  🚫  CLAUDE USAGE LIMIT REACHED          ║
╚══════════════════════════════════════════╝
   Spent $0.4231 / $0.40 today (105.8%)

   To override:  claude --force <your prompt>
   To reset:     ccusage reset
   Raise limit:  ccusage set-limit --daily <amount>
```

For urgent work, bypass the block with:
```bash
claude --force "fix this production bug"
```

---

## Commands

```
ccusage status                         Usage bar + stats for your active window
ccusage set-limit --daily <$>          Set daily spending limit
ccusage set-limit --weekly <$>         Set weekly spending limit
ccusage set-limit --monthly <$>        Set monthly spending limit
ccusage history [--n 20]               Show recent sessions (default: 15)
ccusage log --cost 0.012               Manually log a session by cost
ccusage log --input 1000 --output 500  Manually log by token count
ccusage reset [--confirm]              Clear all usage history (keeps config)
ccusage config                         Show current limit settings
ccusage install-wrapper                Step-by-step wrapper setup guide
```

---

## Manual Logging

If you prefer not to use the wrapper, log sessions yourself after each `claude` run:

```bash
ccusage log --cost 0.0234
ccusage log --input 5000 --output 1200 --model claude-sonnet-4
ccusage log --cost 0.01 --note "refactored auth module"
```

---

## How Usage is Captured

Claude Code prints a cost/token summary at the end of each session:
```
Cost: $0.0123 (1,234 input, 567 output tokens)
```

The wrapper captures this line from Claude's output, parses it, and writes a session record to `~/.ccusage/usage.json`. Your conversation content is never read or stored — only the cost metadata.

---

## Data & Privacy

- All data is stored locally in `~/.ccusage/`
- `config.json` — your limit settings
- `usage.json` — session history (timestamps, token counts, costs)
- No network requests, no telemetry, no accounts

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The most impactful area right now is improving the output parser in `lib/calc.js` to handle more Claude Code output formats across versions.

---

## License

MIT
