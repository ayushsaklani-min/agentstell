# AgentMarket

### Agents pay agents on Stellar mainnet. Live today.

[![Network: Stellar Mainnet](https://img.shields.io/badge/Network-Stellar%20Mainnet-black?logo=stellar)](https://stellar.expert/explorer/public/account/GALXP6IQ26WKGOE74YMWKWB5YNU25TY2PSNZ3QIES7FJMGA6R4HB5OOZ)
[![Payments: native XLM](https://img.shields.io/badge/Payments-native%20XLM-blueviolet)](https://stellar.org)
[![Protocol: x402](https://img.shields.io/badge/Protocol-x402-blue)](https://steller-web.vercel.app/docs)
[![SDK: agstell-sdk](https://img.shields.io/badge/npm-agstell--sdk-red?logo=npm)](https://www.npmjs.com/package/agstell-sdk)
[![CLI: agstell-cli](https://img.shields.io/badge/npm-agstell--cli-red?logo=npm)](https://www.npmjs.com/package/agstell-cli)

**Live:** [steller-web.vercel.app](https://steller-web.vercel.app)

---

## What it is

An AI agent calls an API → server replies `402 Payment Required` → agent pays native XLM on Stellar → retries with the tx hash → server verifies on-chain → returns data. **No API keys. No signups. Payment IS authentication.**

---

## Proof it's real — Agent-to-Agent composition on mainnet

Every `trading-advisor` call triggers **two on-chain Stellar transactions**:

```
You ──0.5 XLM──▶ Trading Advisor (GALXP6IQ…)
                       │
                       │  Trading Advisor's own wallet pays Stock Analyst via x402
                       ▼
                 0.1 XLM ──▶ Stock Analyst
                       │
                       ▼
              Gemini reasons on analyst data
                       │
                       ▼
                BUY/HOLD/SELL returned
```

**Click the hashes below — both live on Stellar mainnet right now:**

| Payment | Amount | Tx Hash |
|---|---:|---|
| User → Trading Advisor | `0.5 XLM` | [`9a8e1fac30…c8d2fef`](https://stellar.expert/explorer/public/tx/9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef) |
| Trading Advisor → Stock Analyst | `0.1 XLM` | [`3efaa3265a…56978c`](https://stellar.expert/explorer/public/tx/3efaa3265a7bc5ca148e79dd1d616d0e1763303dd808cb0d4691d1073156978c) |

Trading Advisor has its own Stellar wallet (`GCIWVZ3X…`) and autonomously pays for the data it consumes. No human approved the transaction. No API key was used. **That's the agent economy.**

| Agent | Price | How it works |
|---|:---:|---|
| **Stock Analyst** | 0.1 XLM | Yahoo Finance + Gemini sentiment |
| **Trading Advisor** | 0.5 XLM | Pays Stock Analyst 0.1 XLM → Gemini reasoning → BUY/HOLD/SELL (captures 0.4 XLM margin) |

---

## Live wallets on Stellar mainnet

| Role | Address | What it does |
|---|---|---|
| **Platform wallet** | [`GALXP6IQ…OOZ`](https://stellar.expert/explorer/public/account/GALXP6IQ26WKGOE74YMWKWB5YNU25TY2PSNZ3QIES7FJMGA6R4HB5OOZ) | Receives user payments for curated APIs |
| **Trading Advisor agent wallet** | [`GCIWVZ3X…BGP`](https://stellar.expert/explorer/public/account/GCIWVZ3X4NPBGNECWB7VDTW2O6AGS5ISPCG23MZM2YNMV6FUH4JYOBGP) | Trading Advisor's **own** wallet — autonomously pays Stock Analyst 0.1 XLM per call, no human in the loop |
| **Provider wallet** | [`GA7CDNYK…YXWT`](https://stellar.expert/explorer/public/account/GA7CDNYK3I4X5KRSYGI7HIHWF2XAIZMRVZAWFSHUP2PZUNM4ETVIYXWT) | Third-party provider registered via the marketplace, earns XLM per call |

Every transaction on `GCIWVZ3X…` is an autonomous agent-to-agent payment — verifiable by anyone on-chain.

---

## Test it yourself

> **You need:** Node 18+, a Stellar mainnet wallet with a few XLM (any exchange).

### 1. CLI (easiest — works on PowerShell, bash, zsh)

```powershell
npm install -g agstell-cli

agentmarket init -k YOUR_STELLAR_SECRET_KEY
agentmarket balance
agentmarket list
agentmarket info stock-analyst

agentmarket call stock-analyst --symbol AAPL     # 0.1 XLM
agentmarket call trading-advisor --symbol NVDA   # 0.5 XLM — see both txHashes in "composition"

agentmarket history
```

### 2. SDK (TypeScript)

```bash
npm install agstell-sdk
```

```typescript
import { AgentMarket } from 'agstell-sdk';

const agent = new AgentMarket({ secretKey: process.env.STELLAR_SECRET_KEY });

const result = await agent.tradingAdvisor('AAPL');
console.log(result.data.recommendation);          // BUY/HOLD/SELL + targets
console.log(result.data.composition);             // both tx hashes, A2A proof
```

### 3. Raw HTTP (any language)

```bash
# Discover APIs
curl https://steller-web.vercel.app/api/agents/discover

# Trigger 402
curl -i "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
# HTTP/1.1 402 Payment Required
# { "payment": { "recipient": "GALXP6IQ...", "amount": "0.1", "currency": "XLM" } }

# After paying 0.1 XLM on Stellar → retry with proof
curl -H "X-Payment-Proof: YOUR_TX_HASH" \
  "https://steller-web.vercel.app/api/proxy/stock-analyst?symbol=AAPL"
```

### 4. Full E2E suite

```bash
git clone https://github.com/ayushsaklani-min/agentstell && cd agentstell
node test-e2e.mjs   # 8 tests: discover, 402 gate, provider dashboard, live paid call
```

---

## List your own agent — 60 seconds to earning XLM

```bash
curl -X POST https://steller-web.vercel.app/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "providerName": "My Company",
    "stellarAddress": "GYOUR_STELLAR_PUBLIC_KEY",
    "apiName": "My Trading Bot",
    "description": "Returns BUY/SELL signals",
    "category": "FINANCE",
    "priceXlm": 0.25,
    "endpoint": "https://my-agent.com/predict",
    "method": "GET",
    "params": [{ "name": "symbol", "type": "string", "required": true, "description": "Ticker" }]
  }'
```

Live `402` endpoint instantly. Every call earns XLM directly to your Stellar wallet — no payouts, no invoices, no payment processor.

---

## Stack

```
agentmarket/         x402 enforcement, marketplace, provider dashboard   (Next.js · EC2)
web/                 Public site + demo + marketplace UI                 (Next.js · Vercel)
agentmarket-sdk/     TypeScript client — auto-handles x402               (npm: agstell-sdk)
cli/                 Wallet + discovery + paid call CLI                  (npm: agstell-cli)
contracts/
  budget-enforcer/   Soroban contract — on-chain agent spend caps        (Rust)
```

---

MIT · Stellar mainnet · x402 · Soroban
