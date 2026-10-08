# AGENTS.md

TypeScript GitHub Action that creates a per-run Postgres database (`src/main.ts`) and drops every database created by the same run in the cleanup phase (`src/post.ts`).

## Build (required after every change)

- `action.yml` runs `dist/main/index.js` and `dist/post/index.js`, NOT `src/*.ts` directly.
- After editing anything under `src/`, run `./build.sh` (runs `npm install`, `tsc` into `lib/`, then `@vercel/ncc` bundles `lib/main.js`/`lib/post.js` into `dist/main` and `dist/post`) and commit the `dist/` output — it is NOT gitignored.
- Without rebuilding, workflows will run stale code.

## Tooling

- TypeScript compiled to CommonJS (`node20` runtime; `target: ES2022`, `strict`). Lint: `npm run lint` (`tsc --noEmit`).
- Tests: `npm test` (vitest; specs live next to sources as `src/*.test.ts`). CI: `.github/workflows/test.yml` runs tests and lint, rebuilds and fails if `dist/` differs (catches forgotten rebuilds), plus an `action` job that exercises the action end-to-end against a `postgres:16` service container.
- Runtime deps: `@actions/core`, `pg` (types via `@types/pg`). Dev deps: `typescript`, `vitest`, `@vercel/ncc` pinned exact — builds are byte-deterministic, so never bump it casually.
- `package.json` declares `allowScripts` for esbuild (vitest dependency); keep it in sync with the installed esbuild version.

## Testing notes

- `src/main.ts` and `src/post.ts` export `run()` and auto-run only under `if (typeof require !== 'undefined' && require.main === module)` — verified to survive ncc bundling. Do not call `run()` at module top level again.
- Tests mock `@actions/core` and `pg` with `vi.mock` (hoisted mocks at the top of each spec). No real Postgres needed for unit tests.
- `src/contract.test.ts` asserts the `core.saveState` keys `main.ts` writes match what `post.ts` consumes — update it when changing state keys.

## Behavior notes

- Database name: `<database-prefix><GITHUB_RUN_ID>_<GITHUB_JOB>_<random hex>`; exposed via output `database` and env var (`env-name` input, default `DB_DATABASE`).
- `main.ts` saves connection state via `core.saveState` for `post.ts`, which sweeps and drops every database matching `<prefix><GITHUB_RUN_ID>_%`, terminating open backends before each drop; keep those keys in sync. The run-id scoping keeps the sweep safe on a shared host even when callers share the default `test_` prefix.
