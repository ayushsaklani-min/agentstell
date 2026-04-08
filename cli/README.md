# AgentMarket CLI

Command-line interface for interacting with the AgentMarket API marketplace using x402 micropayments on Stellar.

## Installation

```bash
npm install -g agentmarket-cli
```

Or use directly with npx:

```bash
npx agentmarket-cli
```

## Quick Start

```bash
# Initialize with your Stellar wallet
agentmarket init

# Or generate a new testnet keypair
agentmarket init --generate

# Fund your testnet account
agentmarket fund

# Check your balance
agentmarket balance

# List available APIs
agentmarket list

# Call an API (auto-pays with USDC)
agentmarket call weather --city "San Francisco"
```

## Commands

### `init`

Initialize the CLI with your Stellar wallet.

```bash
# Interactive mode
agentmarket init

# With secret key
agentmarket init --key SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Generate new keypair
agentmarket init --generate

# Use mainnet (default is testnet)
agentmarket init --network mainnet
```

### `fund`

Fund your testnet account using Stellar Friendbot (testnet only).

```bash
agentmarket fund
```

### `balance`

Check your wallet balance.

```bash
agentmarket balance
# or
agentmarket bal
```

Output:
```
Balance retrieved

  Network:     testnet
  Address:     GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  XLM:         10000.0000000 XLM
  USDC:        100.0000000 USDC
```

### `list`

List available APIs.

```bash
# List all APIs
agentmarket list

# Filter by category
agentmarket list --category Data
agentmarket list -c AI
```

Categories: Data, Finance, Geo, AI

### `call`

Call an API with automatic x402 payment.

```bash
# Weather
agentmarket call weather --city "Tokyo"

# Air Quality
agentmarket call air-quality --city "Delhi"

# News
agentmarket call news --topic "cryptocurrency"

# Currency conversion
agentmarket call currency --from USD --to EUR --amount 100

# Geolocation
agentmarket call geolocation --ip "8.8.8.8"

# AI inference
agentmarket call ai --prompt "Explain blockchain in simple terms"

# Custom params (JSON)
agentmarket call weather -p '{"city": "London", "units": "metric"}'

# Dry run (no payment)
agentmarket call weather --city "Paris" --dry-run
```

### `info`

Get detailed information about an API.

```bash
agentmarket info weather
```

### `history`

View your call history.

```bash
# Last 20 calls
agentmarket history

# Last 50 calls
agentmarket history --limit 50
```

### `config`

View or update configuration.

```bash
# Show config
agentmarket config --show

# Update settings
agentmarket config --network mainnet
agentmarket config --budget 50
agentmarket config --marketplace https://api.agentmarket.xyz
```

## How It Works

1. **Request**: When you call an API, the CLI first sends a request
2. **402 Response**: The server responds with HTTP 402 and payment details
3. **Payment**: CLI automatically sends USDC via Stellar
4. **Data**: CLI retries the request with payment proof and returns data

All of this happens automatically - you just make the call!

## Configuration

Config is stored in `~/.agentmarket/config.json`:

```json
{
  "stellarNetwork": "testnet",
  "secretKey": "SXXXXX...",
  "publicKey": "GXXXXX...",
  "marketplaceUrl": "https://agentmarket.xyz",
  "budgetLimit": 10
}
```

Call history is stored in `~/.agentmarket/history.json`.

## Pricing

| API | Price per call |
|-----|---------------|
| Weather | $0.001 USDC |
| Air Quality | $0.001 USDC |
| News | $0.002 USDC |
| Currency | $0.001 USDC |
| Geolocation | $0.001 USDC |
| AI Inference | $0.005 USDC |

## Environment Variables

You can also configure via environment variables:

```bash
export AGENTMARKET_SECRET_KEY=SXXXXX...
export AGENTMARKET_NETWORK=testnet
export AGENTMARKET_URL=https://agentmarket.xyz
```

## Development

```bash
# Clone
git clone https://github.com/agentmarket/cli.git
cd cli

# Install deps
npm install

# Build
npm run build

# Run locally
node dist/cli.js

# Development mode (watch)
npm run dev
```

## License

MIT
