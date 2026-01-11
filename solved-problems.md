# Solved Problems

## 2026-01-11 - Anonymize README example output
- Problem: README example output exposed local repo paths.
- Root cause: Example table used real project paths.
- Solution: Replaced example paths with generic placeholders.
- Relevant files: `README.md`.
- Commands: none.

## 2026-01-11 - Daily usage repo and dir filtering
- Problem: Daily usage reports could not filter by repo name or directory prefix.
- Root cause: CLI lacked repo/dir options and repo-name extraction; directory filter used substring match.
- Solution: Added repo-name extraction + validation, switched directory filter to prefix match, added daily filtering and logging.
- Relevant files: `src/cli/commands.ts`, `src/aggregator/index.ts`, `src/utils/logger.ts`.
- Commands: none.
