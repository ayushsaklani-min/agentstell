# AgentMarket

### The API Economy for Autonomous AI Agents — Powered by Stellar

[![Network: Stellar Mainnet](https://img.shields.io/badge/Network-Stellar%20Mainnet-black?logo=stellar)](https://stellar.org)
[![Payments: XLM](https://img.shields.io/badge/Payments-XLM-blueviolet)](https://stellar.org)
[![Protocol: x402](https://img.shields.io/badge/Protocol-x402-blue)](https://steller-web.vercel.app/docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Live:** [steller-web.vercel.app](https://steller-web.vercel.app) &nbsp;·&nbsp; **API:** `https://steller-web.vercel.app/api`

---

## The Problem with Every Other API Marketplace

Every existing API marketplace was designed for humans.

You sign up. You get an API key. You configure billing. You watch a dashboard. You rotate credentials when they leak. You manage subscriptions.

That works fine when a developer is in the loop.

**But AI agents can't sign up. They can't manage API keys. They can't complete OAuth flows. And they're about to become the largest consumers of APIs on the internet.**

The entire model breaks.

---

## AgentMarket: Payment IS Authentication

AgentMarket is an API marketplace where the payment transaction *is* the credential. No accounts. No API keys. No subscriptions. No human required.

An AI agent discovers an API, pays for it in **XLM on Stellar mainnet**, and receives data — in a single autonomous round trip. The on-chain transaction hash is the proof. Nothing else is needed.

```
Every other marketplace:        AgentMarket:

  Agent                           Agent
    │                               │
    │  "I need weather data"        │  GET /api/proxy/weather
    │                               │◀── 402 + { recipient, amount: "0.001 XLM" }
    ✗  Can't sign up               │
    ✗  Can't get API key           │  [pays 0.001 XLM on Stellar mainnet]
    ✗  Can't manage billing        │
    ✗  Can't complete OAuth        │  GET /api/proxy/weather
                                   │  X-Payment-Proof: <txHash>
                                   │──▶ 200 OK + { data }
                                   
                                   Done. No account ever created.
```

---

## Why Stellar Makes This Possible

This is not "Stellar for billing." Stellar is the reason this works at all.

| What agents need | Why Stellar delivers it |
|---|---|
| Sub-cent payments per API call | XLM fees are fractions of a cent — no other L1 makes $0.001 payments economical |
| 5-second settlement | Agents can't wait 10 minutes for a block — Stellar settles in ~5s |
| No gas uncertainty | Fixed, predictable fees — an agent can calculate cost before paying |
| Programmable spending limits | Soroban smart contracts enforce on-chain budget caps — no server trust required |
| Verifiable on-chain proof | Any node can verify the payment — no proprietary payment oracle needed |

Traditional payment rails charge more in fees than the entire transaction is worth. Stellar makes micropayments real.

---

## The x402 Protocol

AgentMarket implements **x402** — an open protocol that extends HTTP with payment semantics. It requires no new infrastructure, no wallet SDKs on the server, and no proprietary payment layer. Just HTTP.

```
Agent                        AgentMarket Server               Stellar Mainnet
  │                                  │                               │
  │── GET /api/proxy/stock-analyst ─▶│                               │
  │                                  │                               │
  │◀── HTTP 402 Payment Required ────│                               │
  │    {                             │                               │
  │      recipient: "GABC...XYZ",    │                               │
  │      amount: "0.005",            │                               │
  │      currency: "XLM",            │                               │
  │      network: "mainnet"          │                               │
  │    }                             │                               │
  │                                  │                               │
  │── send 0.005 XLM ───────────────────────────────────────────────▶│
  │◀──────────────────────── txHash ───────────────────────────────-─│
  │                                  │                               │
  │── GET /api/proxy/stock-analyst ─▶│                               │
  │   X-Payment-Proof: <txHash>      │                               │
  │                                  │── verify tx on Horizon ──────▶│
  │                                  │◀── confirmed ─────────────────│
  │                                  │                               │
  │◀── 200 OK ───────────────────────│                               │
  │    {                             │                               │
  │      symbol: "AAPL",             │                               │
  │      sentiment: "bullish",       │                               │
  │      price: 195.23,              │                               │
  │      reason: "Up 2.1%..."        │                               │
  │    }                             │                               │
```

The agent is fully autonomous. No human touched a keyboard.

---

## Marketplace APIs

| API | What it does | Price |
|-----|-------------|:-----:|
| **Stock Analyst** | Live price from Yahoo Finance + Gemini AI sentiment (bullish / bearish / neutral) | 0.005 XLM |
| **AI Inference** | Gemini-powered text generation and reasoning | 0.005 XLM |
| **News** | Real-time headlines by topic | 0.002 XLM |
| **Weather** | Current conditions and forecast by city | 0.001 XLM |
| **Air Quality** | AQI, PM2.5, and pollution data | 0.001 XLM |
| **Currency** | Live exchange rates for 170+ currencies | 0.001 XLM |
| **Geolocation** | IP to country, city, lat/lon | 0.001 XLM |

Anyone can list an API. Providers register at the dashboard and immediately get a live `402` endpoint — no code deployment, no approval process.

---

## On-Chain Budget Enforcement via Soroban

What happens when an AI agent goes rogue and starts spending?

With a traditional API key — you discover the damage on your next billing statement.

With AgentMarket — a **Soroban smart contract** enforces spending limits *before the payment clears*.

```rust
// contracts/budget-enforcer/src/lib.rs
// The contract enforces these limits — not a server promise, on-chain law:

per_call_limit:   max XLM per single API call
session_limit:    max XLM total in this session
provider_limit:   max XLM to any one provider
global_limit:     absolute ceiling — agent cannot spend past this
```

Deploy the contract, configure the limits, hand the agent its keypair. The contract does the rest. No backend, no monitoring dashboard, no alerts at 3am.

**This is the only API marketplace where spending limits are enforced by code on a blockchain.**

---

## Quick Start

### For AI Agents — SDK

```bash
npm install agstell-sdk
```

```typescript
import { AgentMarket } from 'agstell-sdk';

const agent = new AgentMarket({
  secretKey: process.env.STELLAR_SECRET_KEY,  // agent's Stellar wallet
  network: 'mainnet',
  baseUrl: 'https://steller-web.vercel.app',
});

// The agent pays automatically — zero extra code
const stock = await agent.get('stock-analyst', { symbol: 'NVDA' });
// { symbol: 'NVDA', sentiment: 'bullish', price: 875.40, reason: 'Up 3.2%...' }
// Cost: 0.005 XLM. Paid. On-chain. Verified. Done.

const weather = await agent.get('weather', { city: 'San Francisco' });
// Cost: 0.001 XLM

const news = await agent.get('news', { topic: 'AI' });
// Cost: 0.002 XLM
```

### For Developers — CLI

```bash
npm install -g agstell-cli

agentmarket init --generate   # create a Stellar keypair
agentmarket fund              # fund from faucet (testnet) or transfer XLM (mainnet)
agentmarket list              # browse the marketplace
agentmarket call stock-analyst -p '{"symbol":"TSLA"}'
```

### Raw HTTP — Any Language, Any Agent

```bash
# Works from curl, Python requests, Go http, anything that speaks HTTP

# 1. Hit the endpoint — get the price
curl -i "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# HTTP/1.1 402 Payment Required
# {"recipient":"GABC...","amount":"0.005","currency":"XLM","network":"mainnet"}

# 2. Pay on Stellar, get the txHash

# 3. Retry with proof — get the data
curl -H "X-Payment-Proof: <txHash>" \
     "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# {"symbol":"AAPL","sentiment":"bullish","price":195.23,"reason":"..."}
```

---

## For API Providers

Register any JSON API and start earning XLM in minutes.

```bash
curl -X POST https://steller-web.vercel.app/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Data API",
    "description": "Real-time data for agents",
    "price": 0.002,
    "upstreamUrl": "https://myapi.com/data",
    "walletAddress": "GYOUR...STELLAR...ADDRESS"
  }'
```

That's it. Your API immediately appears in the marketplace with a live `402` endpoint. Every agent call pays your Stellar wallet directly — no invoices, no monthly payouts, no payment processor.

The provider dashboard shows real-time call counts, revenue, and health status.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Agent                                  │
│               (any language, any framework)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP + x402
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AgentMarket Backend                          │
│                    (Next.js · AWS EC2)                           │
│                                                                  │
│  /api/proxy/[slug]        withX402Payment middleware             │
│  /api/marketplace         Catalog: curated + DB-backed          │
│  /api/providers/register  Provider self-service                  │
│  /api/provider/dashboard  Earnings, calls, health               │
└────────────────┬─────────────────────────┬───────────────────────┘
                 │                         │
                 ▼                         ▼
    ┌────────────────────┐    ┌─────────────────────────┐
    │   Stellar Horizon  │    │    Upstream APIs         │
    │   (mainnet)        │    │  Yahoo Finance, Gemini,  │
    │  verify tx proof   │    │  Weather, News, ...      │
    └────────────────────┘    └─────────────────────────┘
                 │
                 ▼
    ┌────────────────────┐
    │  Soroban Contract  │
    │  budget-enforcer   │
    │  (on-chain limits) │
    └────────────────────┘
```

```
agentmarket/           Backend — paid API enforcement + marketplace
web/                   Frontend — marketplace UI + provider dashboard
agentmarket-sdk/       TypeScript SDK (npm: agstell-sdk)
cli/                   CLI wallet and testing surface
contracts/
└── budget-enforcer/   Soroban smart contract (Rust) — on-chain budget caps
```

---

## What Makes This Different

| Capability | Traditional API Marketplace | AgentMarket |
|---|:---:|:---:|
| Requires account signup | Yes | **No** |
| Issues API keys | Yes | **No — ever** |
| Works for autonomous agents | No | **Yes** |
| Sub-cent micropayments | No (fees too high) | **Yes — XLM** |
| On-chain budget enforcement | No | **Yes — Soroban** |
| Payment verifiable by anyone | No | **Yes — Stellar Horizon** |
| Provider earns instantly | No (monthly payout) | **Yes — per call** |
| 5-second settlement | No | **Yes — Stellar** |

---

## Roadmap

- [x] x402 payment middleware — payment as authentication
- [x] Curated paid routes: Stock Analyst, AI, Weather, News, Currency, Geolocation, Air Quality
- [x] TypeScript SDK (`agstell-sdk`) with automatic x402 payment handling
- [x] CLI — wallet setup, discovery, paid calls
- [x] Provider self-service registration
- [x] Generic DB-backed proxy for provider-registered APIs
- [x] Marketplace catalog with health status badges
- [x] Provider dashboard — earnings, call counts, API health
- [x] Soroban budget-enforcer smart contract (Rust)
- [x] Deployed: Vercel (frontend) + AWS EC2 (backend)
- [ ] Mainnet XLM payments live (wallet funded, migration in progress)
- [ ] Soroban budget enforcement activated in production

---

## Development

```bash
# Backend
cd agentmarket
cp .env.example .env   # STELLAR_WALLET_PUBLIC, GEMINI_API_KEY, DATABASE_URL
npm install && npm run dev   # :3001

# Frontend
cd web
cp .env.example .env   # AGENTMARKET_BACKEND_URL=http://localhost:3001
npm install && npm run dev   # :3000
```

**Verify:**
```bash
cd agentmarket-sdk && npm run typecheck && npm run test:run
cd agentmarket    && npx tsc --noEmit && npm run lint && npm run build
cd web            && npx tsc --noEmit && npm run lint && npm run build
```

---

## The Bigger Picture

We are entering a world where AI agents outnumber human developers as API consumers. They need an economic layer that works without human intervention — one where access is earned through payment, spending is enforced on-chain, and no credential can be leaked because no credential was ever issued.

That's what Stellar makes possible. That's what AgentMarket builds.

**The agent economy needs Stellar. AgentMarket is the marketplace.**

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built on Stellar mainnet · x402 protocol · Soroban smart contracts*
