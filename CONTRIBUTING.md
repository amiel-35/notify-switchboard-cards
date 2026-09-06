# Contributing

Thanks for considering a contribution to Notify Switchboard Cards.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` rebuilds `dist/notify-switchboard-cards.js` on every change.
Point a Lovelace resource at your local build to iterate against a real
Home Assistant instance.

## Before opening a pull request

Run the full local check the CI workflow runs:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run size
```

## Code style

- TypeScript strict mode, no `any` without a very good reason.
- Lit 3 components, no decorators (see `src/cards/*/*.ts` for the pattern:
  a `static properties` class field, plain class fields for private state).
- Only hand-written types from `src/ha-types.ts` for the `hass` object —
  do not add `custom-card-helpers` as a dependency.
- Only theme CSS variables for color (`--primary-text-color`,
  `--card-background-color`, etc.) — never hardcoded hex values.
- Every interactive control needs a `>=48px` touch target, a visible focus
  state, and an `aria-label`. Never rely on color alone to convey state.
- New user-facing strings need an entry in all three `src/i18n/*.ts` files
  (`en.ts` is the source of truth; `fr.ts` and `es.ts` are typed against
  its keys, so a missing translation is a compile error).

## Tests

Component tests use Vitest + jsdom with a fake `hass` object
(`test/fake-hass.ts`). When you add a feature that depends on a Notify
Switchboard router service, add a test for both the "service present" and
"service absent" paths — the whole point of these cards is that they never
assume 0.2.0 is installed.

## Screenshots

`README.md`'s Screenshots section is generated from a live Home Assistant
instance, not mocked up. To refresh it:

1. Have a Home Assistant dev instance reachable (default
   `http://localhost:18124`) with a `trusted_networks` auth provider that
   bypasses login for wherever the script runs, and a dashboard (default
   path `/cards-e2e/e2e`) rendering one `switchboard-alerts-card` in `full`
   mode, one in `compact` mode, and at least one `switchboard-silence-tile`
   with realistic fixture states (an active alert, a person with a
   `friendly_name`, etc.).
2. Install a Chromium build once with `npx playwright install chromium`
   (this only needs to happen once per machine — the script never installs
   a browser itself, it reuses whatever is already cached under
   `~/Library/Caches/ms-playwright/`).
3. Run:

   ```bash
   npm i -D playwright-core   # already a devDependency after the first run
   node scripts/screenshots.mjs
   ```

   Override the target with `HA_BASE_URL` / `HA_DASHBOARD_PATH` env vars,
   or point at a specific browser binary with `PLAYWRIGHT_CHROMIUM_PATH`.

4. The script writes to `docs/screenshots/`: `alerts-card-full.png`,
   `alerts-card-compact.png`, `silence-tile.png`, `dashboard.png` and
   `dashboard-dark.png` (light/dark theme, 1280×800), and
   `dashboard-mobile.png` (480×900). It fails loudly if a screenshot comes
   back suspiciously small (a blank/loading page), rather than writing a
   bad file silently.

## Commit messages

Conventional, imperative mood (`feat: ...`, `fix: ...`, `docs: ...`).
