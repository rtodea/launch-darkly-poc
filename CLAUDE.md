# CLAUDE.md

## Project Overview

LaunchDarkly A/B Testing Proof-of-Concept for an iOS streaming app (Zeam). Simulates feature flag evaluation and experiment tracking to demonstrate LD's experimentation capabilities to stakeholders.

## Tech Stack

- Node.js 24+ (ESM modules, `"type": "module"`)
- `@launchdarkly/node-server-sdk` for simulation
- `launchdarkly-js-client-sdk` (CDN) for frontend
- LD REST API v2 for setup/cleanup automation
- No frameworks — vanilla JS, minimal dependencies

## Architecture

- **Functional core, imperative shell**: Pure functions in `scenarios.js`, `context.js`, `simulator.js`; side effects in `run.js`, `setup.js`, `cleanup.js`
- **Shared API utilities**: `api.js` contains LD REST API helpers with caching and error handling

## Key Gotchas

### Flag Config Version (Critical)

When creating an experiment, the `flagConfigVersion` in the iteration must match the **current** flag version. The `enableFlag()` step bumps the version, so `getFlag()` must be called with `{ fresh: true }` after enabling. Using a stale version silently creates an experiment with no treatments — the API returns 201 but the iteration is incomplete.

### Experiment Lifecycle

- Experiments cannot be deleted via the API — only archived (`archiveExperiment` semantic patch)
- Running experiments must be **stopped from the LD dashboard UI** before archiving (the `stopIteration` API requires a `winningTreatmentId` that may not be accessible)
- The flag cannot be modified while an experiment references it — stop/archive the experiment first
- Each scenario (win/lose/inconclusive) needs its own experiment — events blend if sent to the same one

### LD Processing Delay

- Events appear under Flags → Audience **immediately**
- Experiment results take **15-30 minutes** to appear (Bayesian engine processes in batches)
- Run simulations 30 min before any demo/presentation
- Once the pipeline is warm, incremental updates are faster (~5 min)

### API Token

- Use a **personal access token** (not a service token) — service tokens cannot call `/members/me`
- Token needs **Writer** role for creating flags, metrics, experiments

### SDK Key vs Client-Side ID

- `LD_SDK_KEY` (starts with `sdk-`) — used by the server-side Node.js SDK (simulator)
- `LD_CLIENT_SIDE_ID` — used by the frontend client-side SDK
- Both must be from the **same environment** (e.g., `test`)

## Commands

```bash
npm run setup              # Create flag, metric, timestamped experiment
npm run cleanup            # Archive experiments (stop in UI first)
npm run demo               # Staggered win simulation (for presentations)
npm run simulate:win       # Burst mode — treatment wins
npm run simulate:lose      # Burst mode — treatment loses
npm run simulate:inconclusive  # Burst mode — no clear winner
npm run serve              # Frontend on port 3000
```

## Environment

- Environment: `test` (not production)
- Project key: `default`
- All keys in `.env` (not committed)

## Code Style

- ESM imports (`import`/`export`)
- No TypeScript, no transpilation
- Small focused functions, no classes
- No AI agent attribution in commits or files
