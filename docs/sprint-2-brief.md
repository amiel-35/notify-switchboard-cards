# Sprint 2 brief — Notify Switchboard Cards v0.2.0 (consumes router 0.6.0)

> One coding agent, branch `feat/0.2.0`, own worktree. TypeScript/Lit, same
> tooling as 0.1.x (eslint, prettier, vitest, size budget, screenshots
> script against the dev instance is run by the orchestrator, not by you).
> Never touch `.github/workflows` or any Home Assistant instance.

## Scope (must)

1. **Read the routing table from the router** (`sensor.switchboard_routing_table`,
   attributes `targets` and `persons`, router ≥ 0.6.0): `switchboard-alerts-card`
   derives alert ↔ slug, `snooze_minutes`, `allow_acknowledge` from it;
   `switchboard-silence-tile` derives `wake_time`. The card-level
   `target_map` / `snooze_minutes` / `wake_time` options remain as
   overrides and are marked "optional since router 0.6.0" in the editor;
   with an older router the 0.1.x behaviour is unchanged.
2. **"Acknowledged by …"** — the alerts card shows, for an acknowledged
   alert, who and when, from `sensor.switchboard_acknowledgements`
   attributes (`by_target[slug]`: `person` friendly name when resolvable
   from `person.*`, else the raw `user_id` shortened, plus a relative
   time). Nothing shown when the router does not expose it.
3. **Kiosk person picker** — option `person_picker: true` (default false):
   before Snooze, a compact chooser (avatars/names of `persons` from the
   routing table) selects the `person` passed to `notify_switchboard.snooze`;
   Acknowledge never asks. Keyboard-reachable, ≥ 48 px targets.
4. **Editors and i18n** updated (en/fr/es), README updated (feature matrix
   by router version), CHANGELOG.

## Out of scope

Journal view, full-screen takeover on critical, any write that is not an
existing router service.

## Definition of done

Unit tests for the new derivations and the picker; eslint/prettier/
typecheck/size budget green; PR opened, not merged, not tagged; report what
was verified and what needs the browser check (the orchestrator runs it).
