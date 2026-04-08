# Budget Enforcer Smart Contract

Soroban smart contract for enforcing agent spending budgets on Stellar.

## Features

- **Per-call limits**: Maximum USDC that can be spent per API call
- **Per-session limits**: Maximum spending per session
- **Per-provider limits**: Maximum spending per API provider
- **Budget tracking**: Real-time tracking of spent amounts
- **Session management**: Create, extend, and close sessions
- **Pause functionality**: Emergency pause to stop all payments
- **On-chain audit trail**: Full history of payments for transparency

## Contract Functions

### Admin Functions

- `initialize(owner, limits)` - Initialize contract with owner and default limits
- `update_limits(caller, limits)` - Update spending limits (owner only)
- `pause(caller)` / `unpause(caller)` - Pause/unpause all payments (owner only)
- `withdraw(caller, amount)` - Withdraw funds (owner only)

### User Functions

- `add_funds(caller, amount)` - Add USDC to budget
- `authorize_payment(caller, amount, provider, api_id)` - Authorize a payment (checks limits)
- `get_budget_status(user)` - Get budget status for a user

### Session Functions

- `create_session(caller, limit, duration)` - Create a new spending session
- `extend_session(caller, session_id, duration)` - Extend session expiry
- `close_session(caller, session_id)` - Close a session

### Query Functions

- `get_session(session_id)` - Get session details
- `get_spending_stats(user)` - Get spending statistics
- `is_paused()` - Check if contract is paused

## Building

### Prerequisites

1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Add WASM target:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. Install Stellar CLI:
   ```bash
   cargo install --locked stellar-cli
   ```

### Build

```bash
cd contracts/budget-enforcer
stellar contract build
```

This produces the optimized WASM at:
```
target/wasm32-unknown-unknown/release/budget_enforcer.wasm
```

### Test

```bash
cargo test
```

### Deploy to Testnet

1. Configure Stellar CLI:
   ```bash
   stellar network add testnet --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"
   ```

2. Create/fund deployment account:
   ```bash
   stellar keys generate deployer --network testnet
   ```

3. Deploy:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/budget_enforcer.wasm \
     --network testnet \
     --source deployer
   ```

4. Initialize:
   ```bash
   stellar contract invoke \
     --id <CONTRACT_ID> \
     --network testnet \
     --source deployer \
     -- initialize \
     --owner <OWNER_ADDRESS> \
     --per_call_limit 10000000 \
     --session_limit 100000000 \
     --provider_limit 500000000 \
     --global_limit 1000000000
   ```

## Amounts

All amounts are in **stroops** (1 USDC = 10^7 stroops).

| Limit | Suggested Value | USDC |
|-------|-----------------|------|
| per_call_limit | 10,000,000 | 1 USDC |
| session_limit | 100,000,000 | 10 USDC |
| provider_limit | 500,000,000 | 50 USDC |
| global_limit | 1,000,000,000 | 100 USDC |

## Events

The contract emits events for:
- `payment` - When a payment is authorized
- `deposit` - When funds are added
- `session_created` - When a new session starts
- `session_closed` - When a session ends
- `paused` / `unpaused` - When contract state changes

## Security

- Only owner can update limits and pause
- Sessions expire automatically after duration
- Per-session limits prevent runaway spending
- All state changes emit events for monitoring

## License

MIT
