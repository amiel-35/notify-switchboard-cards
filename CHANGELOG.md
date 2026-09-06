# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-07

### Fixed

- `switchboard-alerts-card` compact badge: the title no longer wraps
  letter by letter in a narrow sections column (e.g. "Al / ert / es").
  The compact badge now shows chips only by default — `title` is only
  rendered on the badge once explicitly configured, and when it is, it is
  laid out to never wrap (`white-space: nowrap` + ellipsis, with chips
  shrinking first). `getGridOptions()` for compact mode now declares
  `min_columns: 3` / `columns: 4` so the sections view has less room to
  squeeze it down to a single column in the first place. (#1)

## [0.1.0] - 2026-09-07

### Added

- `switchboard-alerts-card`: lists `alert.*` entities with acknowledge,
  un-acknowledge, and (when the router supports it) snooze actions. Compact
  badge mode with a dialog, full inline list mode.
- `switchboard-silence-tile`: shows one person's silence state, active
  snooze count, and last notification, with silence / clear-snoozes /
  lift-silence controls.
- Full `setConfig` validation on both cards: `entities`, `snooze_minutes`,
  `mode`, `target_map`, `show_acknowledged`, `person` and `wake_time` are
  checked up front, so a bad config produces a Lovelace error card naming
  the option instead of a card that throws during render.
- `unavailable` / `unknown` alerts are a distinct fourth state — a neutral
  chip with text and a `mdi:help-circle-outline` icon, no actions, and its
  own count on the compact badge. They are never shown as acknowledged.
- Compact badge count chips pair an icon and an `aria-label` with the
  number: state is never conveyed by colour alone.
- The badge dialog traps focus (Tab / Shift+Tab cycle inside it) and
  Escape closes it and restores focus to the badge button.
- Optional `person` on the alerts card, passed to
  `notify_switchboard.snooze`. Without it the menu says the snooze applies
  to everyone.
- "Today" footer on the alerts card, reading
  `sensor.switchboard_dropped_today` and `event.switchboard_delivery` when
  those entities exist.
- Clicking an alert's name opens Home Assistant's more-info dialog.
- `getGridOptions()` on both cards for the sections layout.
- Visual editors built on `ha-form` with entity/select/object selectors and
  translated labels, degrading to a YAML hint when the Home Assistant
  frontend globals are absent. Emitted configs never carry empty keys.
- English, French, and Spanish translations, selected from
  `hass.locale.language`.
- Version banner logged on load.
- Graceful degradation: every action that depends on a Notify Switchboard
  0.2.0 service checks `hass.services` first and falls back to native
  `alert.*` actions, or marks itself `aria-disabled` with a visible
  explanation.

### Fixed

- "Clear" no longer invents `notify_switchboard.silence(minutes: 0)`, a
  call that is not in the router contract. Clearing snoozes calls
  `unsnooze`; lifting a silence calls the dedicated `unsilence` service.
- `sensor.<person>_active_snoozes` in `unavailable` / `unknown` is reported
  as unknown ("—") instead of being read through `Number()` and shown as
  "No active snoozes".
- "Until wake" is computed on the Home Assistant instance's timezone
  (`hass.config.time_zone`) rather than the browser's.
- Cards only re-render when an entity they actually read changes, instead
  of on every state change in the instance; the 30 s duration tick is
  skipped when nothing is listed.
- The snooze menu's `<summary>` keeps its native role and exposes
  `aria-expanded`; Escape closes it and restores focus.
- Disabled tile actions stay focusable (`aria-disabled`) and the tile
  explains why in one visible line.
- The dialog scrim uses `--dialog-scrim-color`, hover text uses
  `--text-primary-color`, and the host no longer paints its own background
  over the theme's `ha-card`.
