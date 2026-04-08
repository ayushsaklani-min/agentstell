This repository is AgentMarket / STELLER. Preserve the core product promise: payment is authentication through x402 micropayments on Stellar.

Read `README.md` and `IMPLEMENTATION_PLAN.md` before broad changes. If you are working inside `agentmarket/` or `web/`, also follow the nearest `AGENTS.md` file.

Repository map:
- `agentmarket-sdk/` is the TypeScript SDK for agent and developer consumption.
- `cli/` is the command-line interface for wallet setup, API discovery, and paid calls.
- `contracts/` contains Soroban smart contracts, including budget enforcement.
- `agentmarket/` and `web/` contain marketplace and frontend application work.
- `docs/` contains supporting documentation.

Working expectations:
- Keep x402 request, `402 Payment Required`, payment, proof, and retry semantics consistent across SDK, CLI, proxy routes, and contracts.
- Keep Stellar details explicit: network, asset, amount, recipient, proof format, and contract addresses.
- Prefer small, targeted changes that improve demo reliability and error clarity.
- Update docs when commands, setup steps, environment variables, public APIs, or architecture expectations change.
- Run the smallest useful verification for the files you touched and say what was not verified.
