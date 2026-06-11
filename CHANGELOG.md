# Changelog

All notable changes to drawex will be documented here.

## [1.0.0] - 2026-06-10

### Added
- `dx status` — usage bar with color-coded alert levels
- `dx set-limit` — daily, weekly, and monthly spending limits
- `dx history` — session log with costs and token counts
- `dx log` — manually log a session by cost or token counts
- `dx reset` — clear usage data
- `dx config` — show current configuration
- `dx install-wrapper` — guided wrapper setup instructions
- `dx-wrap.js` — drop-in `claude` replacement for auto-tracking
- Hard block at 100% of limit with `--force` override
- Warnings at 75% and 90% of limit
- All data stored locally in `~/.drawex/` — nothing leaves your machine
