# AgentMarket

**Payment IS Authentication** - An API marketplace where AI agents pay per API call using x402 micropayments on Stellar.

[![SDK Build](https://github.com/agentmarket/agentmarket/actions/workflows/sdk-cli.yml/badge.svg)](https://github.com/agentmarket/agentmarket/actions)
[![Contract Build](https://github.com/agentmarket/agentmarket/actions/workflows/contract.yml/badge.svg)](https://github.com/agentmarket/agentmarket/actions)

## Overview

AgentMarket enables AI agents to autonomously access APIs without accounts, API keys, or subscriptions. Instead, agents pay per call using USDC on Stellar via the x402 payment protocol.

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   AI Agent  │────▶│  AgentMarket│────▶│  External   │
│ (uses SDK)  │     │   Proxy     │     │    APIs     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │    HTTP 402       │
       │◀──────────────────│
       │                   │
       │  Pay via Stellar  │
       │──────────────────▶│
       │                   │
       │  Data returned    │
       │◀──────────────────│
       └───────────────────┘
```

1. Agent requests API data
2. Server responds with HTTP 402 + payment details
3. Agent pays via Stellar USDC
4. Agent retries with payment proof
5. Server verifies payment, returns data

## Project Structure

```
STELLER/
├── agentmarket-sdk/     # TypeScript SDK for agents
│   ├── src/
│   │   ├── core/        # Main AgentMarket client
│   │   ├── stellar/     # Stellar blockchain integration
│   │   └── x402/        # x402 payment protocol
│   └── dist/            # Compiled output
│
├── cli/                 # Command-line interface
│   ├── src/
│   │   ├── cli.ts       # CLI commands
│   │   ├── stellar.ts   # Stellar client
│   │   └── api.ts       # API client
│   └── dist/            # Compiled output
│
├── contracts/           # Soroban smart contracts
│   └── budget-enforcer/ # Budget enforcement contract
│       └── src/lib.rs   # Rust contract code
│
├── agentmarket/         # Web app (Next.js) - deferred
│   └── src/
│       ├── app/api/     # API proxy routes
│       └── lib/x402/    # Payment middleware
│
└── docs/                # Documentation
```

## Quick Start

### Using the SDK (for developers/agents)

```bash
npm install agstell-sdk
```

```typescript
import { AgentMarket } from 'agstell-sdk';

// Initialize with your Stellar wallet
const market = new AgentMarket({
  secretKey: 'SXXXXX...', // Your Stellar secret key
  network: 'testnet',
  baseUrl: 'https://agentmarket.xyz',
});

// Make API calls - payment happens automatically!
const weather = await market.get('weather', { city: 'San Francisco' });
console.log(weather.data);
// Cost: $0.001 USDC, paid automatically via Stellar
```

### Using the CLI

```bash
npm install -g agentmarket-cli
```

```bash
# Initialize wallet
agentmarket init --generate

# Fund testnet account
agentmarket fund

# List available APIs
agentmarket list

# Call an API
agentmarket call weather --city "Tokyo"
```

## Available APIs

| API | Description | Price |
|-----|-------------|-------|
| Weather | Current weather data | $0.001 |
| Air Quality | AQI and pollution data | $0.001 |
| News | Latest headlines by topic | $0.002 |
| Currency | Exchange rates | $0.001 |
| Geolocation | IP to location | $0.001 |
| AI Inference | GPT/Claude queries | $0.005 |

## Development

### Prerequisites

- Node.js 18+
- Rust (for smart contract)
- Stellar testnet account with USDC

### Build SDK

```bash
cd agentmarket-sdk
npm install
npm run build
```

### Build CLI

```bash
cd cli
npm install
npm run build
```

### Build Smart Contract

```bash
cd contracts/budget-enforcer
stellar contract build  # Requires Stellar CLI
```

### Local Demo Wiring

`agentmarket` is the canonical paid API surface. The `web` app should be run as a separate frontend and pointed at that backend.

Required `web` environment variables for the live demo:

```bash
AGENTMARKET_BACKEND_URL=http://localhost:3001
DEMO_WALLET_SECRET_KEY=S...
DEMO_WALLET_NETWORK=testnet
```

## Architecture

### x402 Payment Protocol

The x402 protocol extends HTTP with payment semantics:

```
Client                          Server
   │                               │
   │──── GET /api/weather ────────▶│
   │                               │
   │◀─── 402 Payment Required ─────│
   │     {                         │
   │       recipient: "GXXX...",   │
   │       amount: "0.001",        │
   │       currency: "USDC"        │
   │     }                         │
   │                               │
   │──── [Pay via Stellar] ───────▶│ (Stellar Network)
   │                               │
   │──── GET /api/weather ────────▶│
   │     X-Payment-Proof: txHash   │
   │                               │
   │◀─── 200 OK + Data ────────────│
   │                               │
```

### Smart Contract Budget Enforcement

The Soroban smart contract ensures agents can't overspend:

- **Per-call limits**: Max per API call
- **Session limits**: Max per session
- **Provider limits**: Max per provider
- **Global limits**: Max total spending

## Security

- No API keys stored - payment IS authentication
- On-chain spending limits prevent runaway costs
- All transactions verifiable on Stellar
- Optional budget enforcement via smart contract

## Roadmap

- [x] Core SDK with x402 payments
- [x] CLI tool for command-line usage
- [x] Soroban budget-enforcer contract
- [x] API proxy routes with payment verification
- [x] npm package publishing (`agstell-sdk`)
- [x] Marketplace catalog/detail APIs
- [x] Provider self-service registration API
- [ ] Marketplace dashboard analytics polish
- [ ] Live demo experience
- [ ] Mainnet deployment

## Current verification snapshot

As of April 8, 2026:

- `agentmarket-sdk`: typecheck, build, and 5 Vitest smoke tests pass; lint is not configured for ESLint 9 yet
- `cli`: typecheck, build, and 3 Vitest smoke tests pass
- `web`: lint, typecheck, and production build pass
- `agentmarket`: lint, typecheck, and production build pass; the DB-backed marketplace path still falls back at runtime because the Prisma client needs an adapter or accelerate configuration
- `contracts/budget-enforcer`: local verification is blocked until the Windows linker toolchain and Stellar CLI are installed
- `test-e2e.mjs`: offline checks run without secrets; live wallet checks still require `AGENTMARKET_TEST_SECRET_KEY`
- Live SDK validation: a real `agstell-sdk` call to `/api/proxy/agent-test` succeeded against a local `agentmarket` server, transferred `0.001` testnet USDC from the CLI-configured wallet to a temporary provider wallet, and returned the paid response after an initial `402 Payment Required`

## Documentation

- [Claude Handoff](./CLAUDE.md)
- [SDK Documentation](./agentmarket-sdk/README.md)
- [CLI Documentation](./cli/README.md)
- [Smart Contract](./contracts/budget-enforcer/README.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)

## Built for Stellar Hackathon

This project demonstrates:
- x402 micropayment protocol on Stellar
- Soroban smart contracts for budget enforcement
- Autonomous AI agent API consumption
- "Payment IS Authentication" paradigm

## License

MIT

## Contributing

Contributions welcome! Please read the implementation plan and open an issue before submitting PRs.

---

Built for the Stellar ecosystem
