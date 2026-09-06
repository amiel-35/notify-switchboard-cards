# Notify Switchboard Cards

Lovelace custom cards for [Notify Switchboard](https://github.com/amiel-35/notify-switchboard),
the Home Assistant integration that routes the core `alert` integration's
notifications per person. These cards are the "consumption" side: they read
and act on `alert.*` entities and the router's own entities/services, and
degrade gracefully wherever the router does not (yet) expose a feature.

Two cards are included:

- **`switchboard-alerts-card`** — lists `alert.*` entities, with
  acknowledge / un-acknowledge / snooze actions. Can render inline (`full`)
  or as a compact badge that opens a dialog (`compact`).
- **`switchboard-silence-tile`** — shows one person's silence state
  (`binary_sensor.<person>_silenced`, active snoozes, last notification)
  with silence / clear controls.

## Compatibility

These cards read only native `alert.*` entities and the router entities
documented in the
[Notify Switchboard contract](https://github.com/amiel-35/notify-switchboard/blob/main/docs/contract.md)
(`binary_sensor.<person>_silenced`, `sensor.<person>_active_snoozes`,
`sensor.<person>_last_notification`, `sensor.switchboard_dropped_today`,
`event.switchboard_delivery`).

The router's dedicated services (`notify_switchboard.acknowledge`,
`snooze`, `silence`, `unsnooze`) are planned for Notify Switchboard 0.2.0.
**Every action in these cards checks `hass.services` before calling one of
those services and falls back to the native `alert.turn_off` /
`alert.turn_on` actions, or disables itself with an explanatory tooltip,
when the service does not exist yet.** Nothing in these cards requires
0.2.0 to be usable.

## Installation

### HACS (recommended)

1. In Home Assistant, open **HACS → Frontend**, then the **⋮** menu →
   **Custom repositories**.
2. Add `https://github.com/amiel-35/notify-switchboard-cards`, category
   **Lovelace**.
3. Find **Notify Switchboard Cards** in HACS, click **Download**.
4. Add the resource if HACS did not do it automatically: **Settings →
   Dashboards → ⋮ → Resources** →
   `/hacsfiles/notify-switchboard-cards/notify-switchboard-cards.js`,
   type **JavaScript Module**.

### Manual

1. Download `notify-switchboard-cards.js` from the
   [latest release](https://github.com/amiel-35/notify-switchboard-cards/releases/latest).
2. Copy it to `<config>/www/notify-switchboard-cards.js`.
3. Add the resource: **Settings → Dashboards → ⋮ → Resources** →
   `/local/notify-switchboard-cards.js`, type **JavaScript Module**.

## Usage

### `switchboard-alerts-card`

```yaml
type: custom:switchboard-alerts-card
title: Alerts
mode: full # or "compact"
show_acknowledged: true
entities:
  - alert.leak_kitchen
  - alert.door_left_open
target_map:
  alert.leak_kitchen: leak
snooze_minutes: [15, 60, 480]
```

- `entities` — list of `alert.*` entities. Defaults to every `alert.*`
  entity in Home Assistant when omitted.
- `mode` — `full` renders the list inline; `compact` renders a badge with
  the active/acknowledged counts that opens a dialog on activation.
- `show_acknowledged` — whether acknowledged (`off`-state) alerts are
  listed alongside active ones. Idle alerts are never listed.
- `target_map` — maps an `alert.*` entity to its Notify Switchboard target
  slug (the `notify.switchboard_<slug>` row), so Acknowledge can call
  `notify_switchboard.acknowledge` and the Snooze menu can appear once
  0.2.0 is installed. Without a mapping, Acknowledge always falls back to
  `alert.turn_off`, and Snooze never appears for that entity.
- `snooze_minutes` — durations (minutes) offered in the snooze menu.
  Defaults to `[15, 60, 480]`.

### `switchboard-silence-tile`

```yaml
type: custom:switchboard-silence-tile
person: person.alice
wake_time: "07:00"
title: Alice
```

- `person` — a `person.*` entity. The tile derives
  `binary_sensor.<object_id>_silenced`, `sensor.<object_id>_active_snoozes`
  and `sensor.<object_id>_last_notification` from it.
- `wake_time` — 24h `HH:MM`, used by "Until wake" to compute how many
  minutes to silence for. Defaults to `07:00`.

## Accessibility

Both cards keep every interactive control at a 48px minimum touch target,
show a visible focus outline, expose `aria-label`s, wrap text instead of
truncating it (verified at 200% browser zoom), never rely on color alone
for state (every chip carries text), and skip non-essential motion when
`prefers-reduced-motion: reduce` is set.

## Screenshots

_Add screenshots here once the cards are running against a live dashboard._

## Development

```bash
npm install
npm run dev        # rebuilds dist/notify-switchboard-cards.js on change
npm run lint
npm run typecheck
npm test
npm run build       # dist/notify-switchboard-cards.js
npm run size        # bundle size budget check (<= 60 kB gzip)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## License

[MIT](LICENSE) © 2026 Amiel Lavon
