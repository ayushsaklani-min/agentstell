# AgentMarket

> **Payment IS Authentication** — An API marketplace where AI agents pay per call using x402 micropayments on Stellar. No accounts. No API keys. No subscriptions.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network: Stellar](https://img.shields.io/badge/Network-Stellar-black?logo=stellar)](https://stellar.org)
[![Built for Stellar Hackathon](https://img.shields.io/badge/Built%20for-Stellar%20Hackathon-blueviolet)](https://stellar.org)

**Live Demo:** [steller-web.vercel.app](https://steller-web.vercel.app) &nbsp;|&nbsp; **Backend API:** `https://steller-web.vercel.app/api`

---

## What Is AgentMarket?

AgentMarket lets AI agents autonomously consume APIs without human intervention. An agent discovers an API, pays for it in USDC (or XLM on mainnet) via Stellar, and receives data — all in a single round trip. There are no sign-up flows, no rate-limit dashboards, and no secrets to manage. The on-chain payment transaction is the credential.

### The x402 Payment Flow

```
Agent                          AgentMarket                    Stellar
  │                                 │                            │
  │── GET /api/proxy/weather ──────▶│                            │
  │                                 │                            │
  │◀── 402 Payment Required ────────│                            │
  │    { recipient, amount,         │                            │
  │      currency: "USDC" }         │                            │
  │                                 │                            │
  │── [pay 0.001 USDC] ─────────────┼───────────────────────────▶│
  │◀────────────────── txHash ──────┼───────────────────────────-│
  │                                 │                            │
  │── GET /api/proxy/weather ──────▶│                            │
  │   X-Payment-Proof: txHash       │                            │
  │                                 │                            │
  │◀── 200 OK + { data } ───────────│                            │
```

1. Agent requests an API endpoint
2. Server returns `402 Payment Required` with recipient address and price
3. Agent pays via Stellar USDC (transaction confirmed on-chain)
4. Agent retries with `X-Payment-Proof: <txHash>` header
5. Server verifies on-chain, returns the data

**Payment is authentication. No API key is ever issued.**

---

## Marketplace APIs

| API | Description | Price (USDC) |
|-----|-------------|:---:|
| **Stock Analyst** | Live stock price + Gemini AI sentiment (bullish/bearish/neutral) | $0.005 |
| **AI Inference** | Gemini-powered text generation and Q&A | $0.005 |
| **News** | Latest headlines by topic | $0.002 |
| **Weather** | Real-time weather data by city | $0.001 |
| **Air Quality** | AQI and pollution data | $0.001 |
| **Currency** | Live exchange rates | $0.001 |
| **Geolocation** | IP-to-location lookup | $0.001 |

Providers can register new APIs through the provider dashboard — registered APIs immediately receive a `402` endpoint and appear in the marketplace catalog.

---

## Quick Start

### SDK (recommended for agents)

```bash
npm install agstell-sdk
```

```typescript
import { AgentMarket } from 'agstell-sdk';

const market = new AgentMarket({
  secretKey: 'SXXXXX...',   // Stellar secret key
  network: 'testnet',
  baseUrl: 'https://steller-web.vercel.app',
});

// Payment happens automatically — no extra code needed
const result = await market.get('stock-analyst', { symbol: 'AAPL' });
console.log(result.data);
// { symbol: 'AAPL', sentiment: 'bullish', reason: '...', price: 195.23, ... }
```

### CLI

```bash
npm install -g agentmarket-cli
```

```bash
# One-time setup
agentmarket init --generate    # generates a Stellar keypair
agentmarket fund               # funds it from the testnet faucet

# Use the marketplace
agentmarket list               # show available APIs
agentmarket call stock-analyst --symbol AAPL
agentmarket call weather --city Tokyo
```

### Raw HTTP (curl)

```bash
# Step 1 — trigger the 402
curl -i "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# HTTP/1.1 402 Payment Required
# { "recipient": "G...", "amount": "0.005", "currency": "USDC" }

# Step 2 — pay and retry with proof
curl -H "X-Payment-Proof: <txHash>" \
     "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# { "symbol": "AAPL", "sentiment": "bullish", "reason": "...", "price": 195.23 }
```

---

## Architecture

```
STELLER/
├── agentmarket/           # Paid API backend (Next.js, deployed on AWS EC2)
│   ├── src/app/api/
│   │   ├── proxy/         # Curated paid routes (weather, stock-analyst, ai, …)
│   │   ├── proxy/[slug]/  # Generic route for provider-registered APIs
│   │   ├── marketplace/   # Catalog + detail discovery endpoints
│   │   └── providers/     # Provider registration API
│   └── src/lib/
│       ├── x402/          # Payment middleware (withX402Payment)
│       ├── marketplace/   # Fallback catalog + DB merge logic
│       └── provider/      # Provider dashboard aggregation
│
├── web/                   # Product frontend (Next.js, deployed on Vercel)
│   └── src/app/
│       ├── page.tsx       # Marketplace listing
│       ├── docs/          # API documentation
│       └── provider/      # Provider self-service dashboard
│
├── agentmarket-sdk/       # TypeScript SDK (npm: agstell-sdk)
│   └── src/
│       ├── core/          # AgentMarket client
│       ├── stellar/       # Stellar transaction signing
│       └── x402/          # 402-aware HTTP client
│
├── cli/                   # CLI wallet + marketplace interface
│
├── contracts/
│   └── budget-enforcer/   # Soroban smart contract (Rust)
│       └── src/lib.rs     # On-chain per-call / per-session spend limits
│
└── docs/                  # Deployment and integration guides
```

### Key Design Decisions

| Concern | Decision |
|---|---|
| Authentication | Payment proof replaces API keys entirely |
| API discovery | Merged catalog: curated fallback + DB-backed provider entries |
| AI layer | Gemini 2.5 Flash for sentiment analysis; rule-based fallback when unavailable |
| Budget control | Optional Soroban contract enforces per-call and session limits on-chain |
| Network | Stellar testnet (USDC) for development; mainnet XLM for production |

---

## Provider Dashboard

Providers register APIs at `/api/providers/register` and immediately get:
- A live `402` endpoint at `/api/proxy/<slug>`
- Marketplace visibility
- Usage analytics in the provider dashboard

No code deployment required. Any JSON API can be listed and monetized in minutes.

---

## Smart Contract: Budget Enforcer

The Soroban contract at `contracts/budget-enforcer/` enforces agent spending limits on-chain:

- **Per-call limit** — cap spend per single API call
- **Session limit** — cap total spend within a session
- **Provider limit** — cap spend toward any one provider
- **Global limit** — hard ceiling on total agent spending

This gives operators programmable guardrails without trusting any off-chain server.

---

## Development

### Prerequisites

- Node.js 18+
- Rust + Stellar CLI (only needed for contract work)
- Stellar testnet account with USDC

### Run locally

```bash
# Backend (agentmarket)
cd agentmarket
cp .env.example .env       # set STELLAR_WALLET_PUBLIC, GEMINI_API_KEY, DATABASE_URL
npm install && npm run dev  # listens on :3001

# Frontend (web)
cd web
cp .env.example .env       # set AGENTMARKET_BACKEND_URL=http://localhost:3001
npm install && npm run dev  # listens on :3000
```

### Verify a package

```bash
# SDK
cd agentmarket-sdk && npm run typecheck && npm run test:run

# CLI
cd cli && npx tsc --noEmit

# Backend
cd agentmarket && npx tsc --noEmit && npm run lint && npm run build

# Frontend
cd web && npx tsc --noEmit && npm run lint && npm run build
```

### Build the smart contract

```bash
cd contracts/budget-enforcer
stellar contract build      # requires Stellar CLI + Rust toolchain
```

---

## Deployment

| Surface | Host | URL |
|---|---|---|
| Frontend (web) | Vercel | [steller-web.vercel.app](https://steller-web.vercel.app) |
| Backend (agentmarket) | AWS EC2 | `https://steller-web.vercel.app/api` (proxied) |

See [docs/deployment.md](./docs/deployment.md) for the full EC2 setup guide.

---

## Roadmap

- [x] Core SDK with x402 payment handling (`agstell-sdk`)
- [x] CLI for wallet setup, discovery, and paid calls
- [x] x402 middleware — payment-as-authentication on the server
- [x] Curated paid routes: weather, air quality, news, currency, geolocation, AI
- [x] Stock Analyst route — live Yahoo Finance data + Gemini sentiment analysis
- [x] Provider self-service registration API
- [x] Generic DB-backed proxy for provider-registered APIs
- [x] Marketplace catalog with fallback + DB merge
- [x] Provider dashboard with usage analytics
- [x] Soroban budget-enforcer smart contract (Rust)
- [x] Vercel + EC2 production deployments
- [ ] Mainnet XLM payments (wallet created, code migration in progress)
- [ ] On-chain budget enforcement activated in production
- [ ] E2E test suite hardened for CI

---

## Security

- No credentials stored server-side — payment proof is verified on-chain via Stellar Horizon
- Spending limits enforceable via Soroban smart contract
- All transactions publicly verifiable on [Stellar Explorer](https://stellar.expert)
- No user accounts, no session tokens, no OAuth flows

---

## Built for the Stellar Hackathon

AgentMarket demonstrates three Stellar ecosystem primitives working together:

1. **x402 micropayments** — per-call economic access control with no accounts
2. **Soroban smart contracts** — programmable, on-chain budget enforcement for agents
3. **Autonomous AI agent economy** — agents discover, pay for, and consume APIs end-to-end without human intervention

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built on the Stellar network*
