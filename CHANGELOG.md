# Changelog

All notable changes to ccusage will be documented here.

## [1.0.0] - 2026-06-10

### Added
- `ccusage status` — usage bar with color-coded alert levels
- `ccusage set-limit` — daily, weekly, and monthly spending limits
- `ccusage history` — session log with costs and token counts
- `ccusage log` — manually log a session by cost or token counts
- `ccusage reset` — clear usage data
- `ccusage config` — show current configuration
- `ccusage install-wrapper` — guided wrapper setup instructions
- `claude-wrapper.js` — drop-in `claude` replacement for auto-tracking
- Hard block at 100% of limit with `--force` override
- Warnings at 75% and 90% of limit
- All data stored locally in `~/.ccusage/` — nothing leaves your machine
