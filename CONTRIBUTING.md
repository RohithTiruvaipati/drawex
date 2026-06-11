# Contributing to drawex

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/<your-username>/drawex
cd drawex
npm install
```

No build step — it's plain ES module Node.js.

## Project Structure

```
drawex/
├── bin/
│   ├── dx.js          # Main CLI entrypoint (dx)
│   └── dx-wrap.js     # Drop-in claude replacement (dx-wrap)
├── lib/
│   ├── store.js       # Read/write ~/.drawex/ data
│   ├── calc.js        # Cost math, window logic, output parser
│   └── display.js     # Terminal colors and banners
├── README.md
└── CHANGELOG.md
```

## Running Locally

```bash
# Run directly without installing
node bin/dx.js status
node bin/dx.js set-limit --daily 0.40

# Or link globally for testing
npm link
dx status
```

## Areas for Contribution

- **Better output parsing** — Claude Code's cost/token output format may vary across versions. Improving `parseClaudeOutput()` in `lib/calc.js` is always valuable.
- **Shell completion** — bash/zsh tab completion for commands and flags
- **Export** — `dx export --csv` or `--json` for reporting
- **Multiple profiles** — different limits per project
- **`dx summary`** — weekly/monthly report with a breakdown by day

## Guidelines

- Keep zero runtime dependencies (Node stdlib only)
- All user data stays in `~/.drawex/` — no network calls from the CLI
- Test your changes with `node bin/dx.js` before opening a PR
- Update `CHANGELOG.md` with what you changed

## Opening a PR

1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Open a PR with a clear description of what it does and why
