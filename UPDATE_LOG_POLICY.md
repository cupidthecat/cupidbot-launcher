# Update Log Policy

This file tells coding agents how to maintain the shared CupidBot update log after implementing and git committing user-facing work.

## Canonical Log

The canonical stored update log lives in this repo at `UPDATE_LOG.md`.

## When To Add An Entry

After creating a commit for any user-facing launcher update, CupidBot client update, or plugin update, append one row to `UPDATE_LOG.md`.

Do not add entries for docs-only commits, log-only commits, formatting-only commits, or internal cleanup unless the user explicitly asks for the change to appear in the update log.

## Required Entry Format

Use this table format:

```markdown
| Date | Area | Repo | Commit | Summary |
| --- | --- | --- | --- | --- |
| 2026-07-01 | Launcher | cupidbot-launcher | abc1234 | Redesign Jagex account picker. |
```

Fields:

- `Date`: local date in `YYYY-MM-DD` format.
- `Area`: one of `Launcher`, `CupidBot`, or `Plugin`.
- `Repo`: repository name, such as `cupidbot-launcher`, `cupidbot`, or `cupidbot-plugins`.
- `Commit`: short SHA for the completed implementation commit.
- `Summary`: short user-facing impact, written as a sentence fragment or sentence.

## Commit Workflow

A commit cannot reliably contain its own final SHA. First create the implementation commit, then append the update-log row in `UPDATE_LOG.md`, then create a follow-up log-only commit.

Use this subject pattern for the follow-up commit:

```text
docs: update launcher update log for <short-sha>
```

If the launcher repo is not available when working from another repo, mention in the final response that the update-log entry is still required and blocked by the missing `cupidbot-launcher` checkout.

