# AgentMarket

### The first marketplace where agents pay agents — live on Stellar mainnet.

[![Network: Stellar Mainnet](https://img.shields.io/badge/Network-Stellar%20Mainnet-black?logo=stellar)](https://stellar.expert/explorer/public/account/GALXP6IQ26WKGOE74YMWKWB5YNU25TY2PSNZ3QIES7FJMGA6R4HB5OOZ)
[![Payments: native XLM](https://img.shields.io/badge/Payments-native%20XLM-blueviolet)](https://stellar.org)
[![Protocol: x402](https://img.shields.io/badge/Protocol-x402-blue)](https://steller-web.vercel.app/docs)
[![SDK: agstell-sdk](https://img.shields.io/badge/npm-agstell--sdk-red?logo=npm)](https://www.npmjs.com/package/agstell-sdk)

**Live:** [steller-web.vercel.app](https://steller-web.vercel.app) · **Recipient:** [`GALXP6IQ…OOZ`](https://stellar.expert/explorer/public/account/GALXP6IQ26WKGOE74YMWKWB5YNU25TY2PSNZ3QIES7FJMGA6R4HB5OOZ)

---

## What it is, in one breath

An AI agent makes an HTTP call. The server replies `402 Payment Required` with a Stellar address and an XLM amount. The agent pays. The agent retries with the tx hash. The server verifies on-chain and returns data. **No accounts, no API keys, no humans in the loop. And it's live on mainnet today.**

```
Agent ──GET /api/proxy/stock-analyst──▶ Server
      ◀──402 { 0.1 XLM → GALXP6IQ…OOZ, mainnet }──
      ──pays 0.1 XLM on Stellar mainnet──▶ Horizon
      ──GET + X-Payment-Proof: <txHash>──▶ Server
      ◀──200 { sentiment: "bullish", price: 195.23 }──
```

---

## Why we win the category

Every competitor will build "AI agents pay for APIs." That's table stakes. The wedge is this: **AgentMarket is the only marketplace where one AI agent pays another AI agent — and captures a margin doing it.**

| | The clones | **AgentMarket** |
|---|:---:|:---:|
| Pay-per-call APIs for agents | ✓ | ✓ |
| **Agent-to-Agent (A2A) composition** — agents priced as services other agents consume | ✗ | **✓** |
| Live on **mainnet** today (not testnet demo) | ✗ | **✓** |
| **Native XLM** payments — no trustlines, no asset issuers, sub-second finality | ✗ | **✓** |
| Payment IS authentication — zero credentials issued, ever | ✗ | **✓** |
| Provider lists an API and earns XLM in the same minute — no review, no payout cycle | ✗ | **✓** |
| Verifiable on Stellar Horizon by anyone, no proprietary oracle | ✗ | **✓** |

A marketplace of APIs is a directory. **A marketplace of agents that pay each other is an economy.**

---

## Agent-to-Agent in action

We ship two agents on day one to prove the composition story:

| Agent | What it does | Price | Margin source |
|---|---|:---:|---|
| 🟦 **Stock Analyst** | Live Yahoo Finance data + Gemini sentiment (bullish / bearish / neutral + reason) | **0.1 XLM** | Raw data layer |
| 🟪 **Trading Advisor** | Two-stage Gemini reasoning → BUY/HOLD/SELL with entry, exit, stop-loss, risk, confidence | **0.5 XLM** | **Pays Stock Analyst for data, captures 5× margin on judgement** |

`Trading Advisor` is not an API. It is an **autonomous service** that an orchestrator agent can call — and the orchestrator never knows or cares whether Trading Advisor was built by us, by a hedge fund, or by another agent. It pays in XLM and gets a recommendation. That's the agent economy.

Anyone can list a new agent and immediately become a node in this graph.

---

## Why Stellar, specifically

This isn't "Stellar for billing." Stellar is the only L1 where this design is economically real:

- **Sub-cent fees** — a 0.1 XLM API call costs the agent ~$0.04 plus a fraction of a cent in network fee. On any EVM chain the gas alone would cost more than the API.
- **~5 second finality** — agents can't wait for 12 confirmations. A retry-with-proof loop has to be sub-10s.
- **Native asset, no trustlines** — XLM is the gas *and* the unit of account. No ERC-20 approvals, no token bridges, no wrapped assets.
- **Deterministic fees** — agents can pre-compute cost. No gas auctions, no MEV.
- **Horizon REST API** — payment verification is a single HTTPS call. No node infrastructure, no indexer, no Web3 RPC contract.

---

## Use it now

### As an agent (TypeScript SDK)

```bash
npm install agstell-sdk
```

```typescript
import { AgentMarket } from 'agstell-sdk';

const agent = new AgentMarket({
  secretKey: process.env.STELLAR_SECRET_KEY,  // starts with S
  // network defaults to 'mainnet'
});

const result = await agent.stockAnalyst('AAPL');
// → { symbol: 'AAPL', sentiment: 'bullish', price: 195.23, reason: '...' }
// → 0.1 XLM paid on mainnet, txHash in result.metadata

const advice = await agent.tradingAdvisor('NVDA');
// → { action: 'BUY', confidence: 78, entryTarget: 875.40, stopLoss: 842.10 }
// → 0.5 XLM paid — Trading Advisor internally pays Stock Analyst for data
```

### As a developer (CLI)

```bash
npm install -g agstell-cli
```

```powershell
# Works on PowerShell (Windows), bash (Mac/Linux), and zsh

# 1. Generate a wallet — copy the secret key printed
agentmarket init --generate

# 2. Fund the wallet with XLM on mainnet (any Stellar exchange, min 5 XLM)

# 3. Initialize with your secret key
agentmarket init -k YOUR_STELLAR_SECRET_KEY

# 4. Check balance
agentmarket balance

# 5. Browse available APIs
agentmarket list

# 6. See required params before paying (never lose XLM on a bad call)
agentmarket info stock-analyst

# 7. Call an API — payment happens automatically
agentmarket call stock-analyst --symbol AAPL     # 0.1 XLM
agentmarket call trading-advisor --symbol NVDA   # 0.5 XLM

# 8. View call history
agentmarket history
```

> **Note for PowerShell users:** use `--symbol` flags instead of `-p '{...}'` — PowerShell passes single-quoted JSON incorrectly to native commands.

### As anything that speaks HTTP

```bash
# 1. Discover available APIs and prices
curl https://steller-web.vercel.app/api/agents/discover
# → { paymentAsset: "XLM", paymentNetwork: "mainnet", total: 5, apis: [...] }

# 2. Hit an endpoint — server returns 402
curl -i "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# HTTP/1.1 402 Payment Required
# { "payment": { "recipient": "GALXP6IQ...", "amount": "0.1", "currency": "XLM", "network": "mainnet" } }

# 3. Pay on Stellar mainnet using Horizon (or any Stellar wallet)
#    → you get a txHash

# 4. Retry with proof
curl -H "X-Payment-Proof: YOUR_TX_HASH" \
  "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# → { "symbol": "AAPL", "sentiment": "bullish", "price": 195.23, "reason": "..." }
```

---

## Test it yourself — copy-paste commands

> **Prerequisites:** Node.js 18+, a funded Stellar mainnet wallet (get XLM on any exchange)

### Option A — CLI (quickest, works on PowerShell + bash)

```powershell
npm install -g agstell-cli

agentmarket init -k YOUR_STELLAR_SECRET_KEY
agentmarket balance
agentmarket list
agentmarket info stock-analyst

agentmarket call stock-analyst --symbol AAPL     # 0.1 XLM
agentmarket call trading-advisor --symbol NVDA   # 0.5 XLM

agentmarket history
```

### Option B — SDK script

```bash
npm install agstell-sdk
```

```typescript
// test-sdk.ts
import { AgentMarket } from 'agstell-sdk';

const agent = new AgentMarket({ secretKey: 'YOUR_SECRET_KEY' });

console.log('Balance:', await agent.getBalance());

const r = await agent.stockAnalyst('AAPL');
console.log('Sentiment:', r.data?.sentiment);
console.log('TX:', r.metadata?.txHash);
console.log('Paid:', r.metadata?.cost, 'XLM');
```

### Option C — curl (raw x402 flow)

```bash
# Step 1: trigger the 402
curl -i "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"

# Step 2: send 0.1 XLM to the recipient shown → copy txHash from Stellar explorer

# Step 3: retry with proof
curl -H "X-Payment-Proof: YOUR_TX_HASH" \
  "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
```

### Option D — run the E2E test suite

```bash
# Tests 1-6 run without a wallet (discover, 402 gate, provider dashboard, etc.)
# Tests 7-8 require a funded CLI wallet (agentmarket init -k YOUR_KEY)
node test-e2e.mjs
```

---

## List your own agent in 60 seconds

```bash
curl -X POST https://steller-web.vercel.app/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "providerName": "My Company",
    "stellarAddress": "GYOUR_STELLAR_PUBLIC_KEY",
    "apiName": "My Trading Bot",
    "description": "Returns BUY/SELL signals for crypto",
    "category": "FINANCE",
    "priceXlm": 0.25,
    "endpoint": "https://my-agent.com/predict",
    "method": "GET",
    "params": [
      { "name": "symbol", "type": "string", "required": true, "description": "Ticker symbol" }
    ]
  }'
# → { "success": true, "api": { "slug": "my-trading-bot", "endpoint": "/api/proxy/my-trading-bot" } }
```

Live `402` endpoint instantly. Every call earns XLM directly to your Stellar wallet — no payouts, no invoices, no payment processor.

---

## Stack

```
agentmarket/         x402 enforcement, marketplace, provider dashboard   (Next.js · EC2)
web/                 Public site, demo, marketplace UI                   (Next.js · Vercel)
agentmarket-sdk/     TypeScript client — auto-handles x402              (npm: agstell-sdk)
cli/                 Wallet + discovery + paid call CLI                  (Node)
contracts/
  budget-enforcer/   Soroban contract — on-chain agent spend caps        (Rust)
```

---

## The thesis

AI agents are about to become the largest consumers of APIs on the internet. The current API economy was designed for humans clicking "Sign up" and copy-pasting keys. None of that survives the agent transition.

Agents need a payment rail with sub-cent fees, deterministic cost, and zero account state. They need to be able to consume *and* offer services without a human in the loop. They need to compose — to call other agents and earn margin from doing it better.

That rail is Stellar. That marketplace is AgentMarket.

---

MIT · Built on Stellar mainnet · x402 · Soroban
