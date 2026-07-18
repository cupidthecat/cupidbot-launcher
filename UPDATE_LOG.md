# CupidBot Update Log

This is the canonical stored update log for CupidBot launcher, client, and plugin updates. It is maintained for agents and maintainers; the launcher does not render this file in the UI.

Follow `UPDATE_LOG_POLICY.md` before adding entries.

| Date | Area | Repo | Commit | Summary |
| --- | --- | --- | --- | --- |
| 2026-07-18 | Plugin | cupidbot-plugins | 0b5b6c1 | Prevent fishing level-up prompts from blocking Auto Fishing bank walks. |
| 2026-07-18 | Plugin | cupidbot-plugins | 24417d2 | Add Karambwanji support to Auto Fishing with small-net fishing at the CKR lake. |
| 2026-07-18 | CupidBot | cupidbot | 4b9b6cb | Port the latest Microbot walker, client, and July game-content updates into CupidBot. |
| 2026-07-02 | CupidBot | cupidbot | f6f29ae | Port Microbot hiscore Maggot King and tile-indicator cutscene fixes into CupidBot. |
| 2026-07-02 | CupidBot | cupidbot | 45106bb | Port Microbot walker, shortest-path, and ground-item fixes into CupidBot. |
| 2026-07-01 | Launcher | cupidbot-launcher | 95ce8d4 | Fix hamburger menu dropdown positioning near the window edge. |
| 2026-07-01 | Launcher | cupidbot-launcher | 54f0577 | Show launcher update log in the UI and expand the Operator Guide layout. |
| 2026-07-01 | Launcher | cupidbot-launcher | eae7175 | New Mission Control launcher UI. |

## Entry Workflow

After a user-facing feature, fix, plugin update, launcher update, or CupidBot client update is committed, append a row to the table above in a separate follow-up log-only commit. Use the completed implementation commit's short SHA in the `Commit` column.
