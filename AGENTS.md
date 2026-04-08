# STELLER / AgentMarket

This repository is building AgentMarket: an API marketplace where AI agents pay for API access with x402 micropayments on Stellar.

Core product promise: payment is authentication.

## Read first

- `CLAUDE.md` for the current handoff state and token-efficient starting context
- `README.md` for the repository overview and module layout
- `IMPLEMENTATION_PLAN.md` for the intended architecture and sequencing
- `agentmarket/AGENTS.md` and `web/AGENTS.md` when working in those subdirectories
- Long-form project note, when accessible in the current environment: `C:\Users\sakla\Documents\SecondBrain\01 Projects\STELLER.md`

## Repository map

- `agentmarket-sdk/`: TypeScript SDK for discovery and x402 payment flow
- `cli/`: command-line UX for wallet setup, API discovery, and paid calls
- `contracts/`: Soroban smart contracts, including budget enforcement
- `agentmarket/`: marketplace and proxy application work
- `web/`: web frontend and product surfaces
- `docs/`: supporting documentation

## Working rules

- Preserve x402 semantics across the SDK, CLI, proxy routes, and contracts. If payment flow behavior changes in one place, audit the other surfaces.
- Keep Stellar assumptions explicit: network, asset, amount, recipient, proof format, and contract addresses should never be implied.
- Prefer changes that improve demo reliability, happy-path clarity, and actionable error reporting.
- Favor targeted edits over broad rewrites.
- Update docs when setup steps, commands, environment variables, or architecture expectations change.
- Ask before large dependency additions, disruptive reorganizations, or protocol-level changes.

## Verification

- For JavaScript or TypeScript work, run the smallest relevant build, lint, or test command in the affected package.
- For contract work, run the relevant Rust or Stellar contract checks when available.
- In the final summary, state exactly what was verified and what remains unverified.

## Notes sync

- The long-term project brain lives in Obsidian. After major work, produce a concise Markdown summary of decisions, blockers, and next steps that can be copied back to the vault.
