# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-06

### Added

- `switchboard-alerts-card`: lists `alert.*` entities with acknowledge,
  un-acknowledge, and (when the router supports it) snooze actions. Compact
  badge mode with a dialog, full inline list mode.
- `switchboard-silence-tile`: shows one person's silence state, active
  snooze count, and last notification, with silence / clear controls.
- Visual editors for both cards, registered via `getConfigElement` /
  `getStubConfig`.
- English, French, and Spanish translations, selected from
  `hass.locale.language`.
- Graceful degradation: every action that depends on a Notify Switchboard
  0.2.0 service checks `hass.services` first and falls back to native
  `alert.*` actions, or disables itself with a tooltip.
