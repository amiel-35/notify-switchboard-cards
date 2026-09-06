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

## Commit messages

Conventional, imperative mood (`feat: ...`, `fix: ...`, `docs: ...`).
