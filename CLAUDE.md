# Claude Handoff

This file exists to stop repeated repo-wide analysis. Use it as the starting context for all future work in this repository.

## Read Order

Do not start with a full codebase scan.

Read in this order:

1. `CLAUDE.md`
2. `AGENTS.md`
3. `README.md`
4. Only the files directly relevant to the requested task

Do not read every app, route, or package unless the task actually requires it.

## Token Discipline

- Do not re-derive the architecture from scratch.
- Do not scan the entire repo to “understand everything”.
- Do not inspect both `web` and `agentmarket` deeply unless the task crosses frontend and backend boundaries.
- Prefer targeted reads with `rg` and open only the exact files needed.
- Treat the architecture and product state below as authoritative unless a file you open directly contradicts it.

## Canonical Product Shape

AgentMarket is an API marketplace where AI agents pay for API access with x402 micropayments on Stellar.

Canonical surfaces:

- `agentmarket/`: canonical paid API backend
- `web/`: public product shell and provider dashboard UI
- `agentmarket-sdk/`: published SDK, package name `agstell-sdk`
- `cli/`: CLI wallet and testing surface
- `contracts/budget-enforcer/`: Soroban budget control contract

Core rule: payment is authentication.

## Architecture Summary

### 1. Paid API execution

- Curated paid routes live under `agentmarket/src/app/api/proxy/*`.
- x402 verification lives in `agentmarket/src/lib/x402/middleware.ts`.
- The request flow is:
  1. Agent requests API
  2. Server returns `402 Payment Required`
  3. Agent pays in Stellar USDC
  4. Agent retries with `X-Payment-Proof`
  5. Server verifies payment and returns data

### 2. Provider-submitted APIs

- Provider registration route: `agentmarket/src/app/api/providers/register/route.ts`
- Generic paid execution for DB-backed provider listings: `agentmarket/src/app/api/proxy/[slug]/route.ts`
- Marketplace catalog helpers: `agentmarket/src/lib/marketplace/catalog.ts`

Provider-submitted APIs are no longer just metadata. A registered listing can now return a real `402`, accept payment, proxy upstream, and log usage.

### 3. Provider dashboard

- Backend aggregation: `agentmarket/src/lib/provider/dashboard.ts`
- Backend route: `agentmarket/src/app/api/provider/dashboard/route.ts`
- Web proxy route: `web/src/app/api/provider/dashboard/route.ts`
- UI: `web/src/app/provider/page.tsx`

The provider dashboard now has real sections for:

- Overview
- APIs
- Register API
- Calls
- Settings

### 4. SDK

- Package name: `agstell-sdk`
- Main client: `agentmarket-sdk/src/core/client.ts`
- x402 client: `agentmarket-sdk/src/x402/client.ts`

Important current behavior:

- Built-in curated APIs still exist in the SDK registry.
- Non-hardcoded marketplace APIs can now be discovered on demand from `/api/marketplace` and `/api/marketplace/[id]`.
- Agents can call a newly registered API by slug without publishing a new SDK version.

## Current Product State

### Verified working

These passed recently:

- `agentmarket`: `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `web`: `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `agentmarket-sdk`: `npm run typecheck`, `npm run test:run`

Also verified live:

- DB-backed marketplace routes returned database data during local runtime
- `/api/provider/dashboard` returned real provider/dashboard JSON
- Generic DB-backed proxy route `/api/proxy/<slug>` returned a real `402 Payment Required`
- Curated live x402 payment paths were previously proven with real Stellar USDC payments
- Gemini-backed AI proxy was previously tested successfully through the paid flow

### Still incomplete or blocked

- `test-e2e.mjs` still times out and needs cleanup/refactoring
- Soroban budget-enforcer is not fully validated on this machine because Stellar CLI and Windows linker toolchain are missing
- The provider dashboard is real now, but further polish is still possible
- Provider-submission flow currently supports the simple first-version model:
  - `GET` and `POST`
  - JSON
  - public endpoint submission
  - no advanced upstream auth management yet

## Highest-Value Remaining Tasks

1. Fix and shorten `test-e2e.mjs` so it proves:
   - DB-backed listing registration
   - marketplace visibility
   - paid SDK call
   - provider dashboard update

2. Add one real automated live test for a provider-submitted API slug, not just curated routes.

3. Validate `contracts/budget-enforcer` locally after installing:
   - Stellar CLI
   - Windows C++ linker / build tools

4. Improve provider submission capabilities if needed:
   - request schema storage
   - example response storage
   - optional upstream auth config

## Files To Read For Common Tasks

### If working on provider registration or dashboard

Read only:

- `web/src/app/provider/page.tsx`
- `web/src/app/api/provider/dashboard/route.ts`
- `web/src/app/api/providers/register/route.ts`
- `agentmarket/src/app/api/provider/dashboard/route.ts`
- `agentmarket/src/app/api/providers/register/route.ts`
- `agentmarket/src/lib/provider/dashboard.ts`

### If working on paid API execution

Read only:

- `agentmarket/src/lib/x402/middleware.ts`
- `agentmarket/src/app/api/proxy/[slug]/route.ts`
- the specific curated route you are touching

### If working on marketplace data

Read only:

- `agentmarket/src/app/api/marketplace/route.ts`
- `agentmarket/src/app/api/marketplace/[id]/route.ts`
- `agentmarket/src/lib/marketplace/catalog.ts`
- `agentmarket/src/lib/db.ts`
- `agentmarket/prisma/schema.prisma`

### If working on SDK behavior

Read only:

- `agentmarket-sdk/src/core/client.ts`
- `agentmarket-sdk/src/x402/client.ts`
- `agentmarket-sdk/src/types/index.ts`
- `agentmarket-sdk/src/core/client.test.ts`

## Commands To Prefer

Use the smallest relevant verification:

### Backend

```bash
cd agentmarket
npx tsc --noEmit
npm run lint
npm run build
```

### Web

```bash
cd web
npx tsc --noEmit
npm run lint
npm run build
```

### SDK

```bash
cd agentmarket-sdk
npm run typecheck
npm run test:run
```

## Do Not Waste Time On

- Repo-wide architecture rediscovery
- Reading every README in every package unless required
- Replacing the current split (`web` + `agentmarket`) with a rewrite
- Refactoring curated routes before the live provider-submission loop is fully hardened
- Contract work before machine tooling is installed

## One-Sentence Mental Model

`web` sells and manages the product, `agentmarket` enforces and serves paid APIs, `agstell-sdk` is how agents pay and consume, and the next meaningful work is hardening the live provider-submission loop rather than re-analyzing the repo.
