# Security Policy

## Scope

Notify Switchboard Cards is a Lovelace frontend plugin. It runs entirely in
the Home Assistant frontend's browser context, reads entity states already
visible to the logged-in user, and calls Home Assistant services
(`alert.turn_off`, `alert.turn_on`, and the `notify_switchboard.*` services
when present) through the standard `hass.callService` API — the same
permission model as any other Lovelace card. It has no server component, no
network calls of its own, and stores no data outside the dashboard
configuration the user already controls.

## Reporting a vulnerability

If you find a security issue (e.g. a way for the card to execute
unintended actions, leak data across dashboards, or be abused via a
malicious card configuration), please report it privately rather than
opening a public issue:

- Open a [GitHub security advisory](https://github.com/amiel-35/notify-switchboard-cards/security/advisories/new)
  for this repository, or
- Email the maintainer listed in `package.json`.

Please include the Home Assistant and card version, a minimal
reproduction, and the impact you observed. We will acknowledge reports
within a few days.

## Supported versions

Only the latest published release is supported with security fixes.
