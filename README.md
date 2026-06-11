# drawex

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

Claude Code doesn't expose per-session cost tracking or spending limits natively — especially relevant at enterprise scale where daily usage can compound quickly. `drawex` fills that gap with zero cloud dependency: everything lives in `~/.drawex/` on your machine.

---

## Install

**Requirements:** Node.js 18+

Install globally directly from npm:
```bash
npm install -g drawex
```

Or install from source for development:
```bash
git clone https://github.com/RohithTiruvaipati/drawex
cd drawex
npm install -g .
```

Verify:
```bash
dx --help
```

---

## Quick Start

```bash
# 1. Set a limit
dx set-limit --daily 0.40
dx set-limit --weekly 6.00
dx set-limit --monthly 30.00

# 2. Check your usage anytime
dx status

# 3. See session history
dx history
```

---

## Auto-tracking (Wrapper Setup)

The wrapper sits in front of the real `claude` binary. It checks your limit before every run, captures Claude's output to parse usage, and logs each session automatically.

**Step 1 — Add to your shell config** (`~/.zshrc` or `~/.bashrc`):

Since `drawex` installs `dx-wrap` globally, you can just alias the `claude` command directly to it:

```bash
export DRAWEX_REAL_CLAUDE="$(which claude)"
alias claude="dx-wrap"
```

**Step 2 — Reload your shell:**
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
   To reset:     dx reset
   Raise limit:  dx set-limit --daily <amount>
```

For urgent work, bypass the block with:
```bash
claude --force "fix this production bug"
```

---

## Commands

```
dx status                         Usage bar + stats for your active window
dx set-limit --daily <$>          Set daily spending limit
dx set-limit --weekly <$>         Set weekly spending limit
dx set-limit --monthly <$>        Set monthly spending limit
dx history [--n 20]               Show recent sessions (default: 15)
dx log --cost 0.012               Manually log a session by cost
dx log --input 1000 --output 500  Manually log by token count
dx reset [--confirm]              Clear all usage history (keeps config)
dx config                         Show current limit settings
dx install-wrapper                Step-by-step wrapper setup guide
dx-wrap [args]                    Run Claude Code with automatic limits/tracking
```

---

## Manual Logging

If you prefer not to use the wrapper, log sessions yourself after each `claude` run:

```bash
dx log --cost 0.0234
dx log --input 5000 --output 1200 --model claude-sonnet-4
dx log --cost 0.01 --note "refactored auth module"
```

---

## How it Works & Global Usage

### How Usage is Captured
Claude Code prints a cost/token summary at the end of each session:
```
Cost: $0.0123 (1,234 input, 567 output tokens)
```

The `dx-wrap` wrapper captures this line from Claude's output, parses it, and writes a session record to `~/.drawex/usage.json`. Your conversation content is never read or stored — only the cost metadata.

### Running Globally in Any Terminal / Folder
*   **Yes, it works everywhere.** Because the `claude` alias is defined in your shell config (`~/.zshrc` or `~/.bashrc`), it will load in **any** terminal instance.
*   The config and usage database are stored in `~/.drawex/` (your home directory), so all terminals write to and read from the same central location.
*   **Note:** If you run Claude from an IDE terminal or a script that does not source your shell profile/aliases, it might bypass the alias and call the real `claude` binary directly. In this case, `drawex` won't capture the usage, and your status will remain unchanged (e.g. at `0.00`). Make sure your execution environment loads your shell configuration.

---

## Data & Privacy

- All data is stored locally in `~/.drawex/`
- `config.json` — your limit settings
- `usage.json` — session history (timestamps, token counts, costs)
- No network requests, no telemetry, no accounts

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The most impactful area right now is improving the output parser in `lib/calc.js` to handle more Claude Code output formats across versions.

---

## License

MIT
