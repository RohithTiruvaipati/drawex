# Contributing to ccusage

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/<your-username>/ccusage
cd ccusage
npm install
```

No build step — it's plain ES module Node.js.

## Project Structure

```
ccusage/
├── bin/
│   ├── ccusage.js          # Main CLI entrypoint
│   └── claude-wrapper.js   # Drop-in claude replacement
├── lib/
│   ├── store.js            # Read/write ~/.ccusage/ data
│   ├── calc.js             # Cost math, window logic, output parser
│   └── display.js          # Terminal colors and banners
├── README.md
└── CHANGELOG.md
```

## Running Locally

```bash
# Run directly without installing
node bin/ccusage.js status
node bin/ccusage.js set-limit --daily 0.40

# Or link globally for testing
npm link
ccusage status
```

## Areas for Contribution

- **Better output parsing** — Claude Code's cost/token output format may vary across versions. Improving `parseClaudeOutput()` in `lib/calc.js` is always valuable.
- **Shell completion** — bash/zsh tab completion for commands and flags
- **Export** — `ccusage export --csv` or `--json` for reporting
- **Multiple profiles** — different limits per project
- **`ccusage summary`** — weekly/monthly report with a breakdown by day

## Guidelines

- Keep zero runtime dependencies (Node stdlib only)
- All user data stays in `~/.ccusage/` — no network calls from the CLI
- Test your changes with `node bin/ccusage.js` before opening a PR
- Update `CHANGELOG.md` with what you changed

## Opening a PR

1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Open a PR with a clear description of what it does and why
