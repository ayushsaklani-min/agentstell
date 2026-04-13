/**
 * AgentMarket SDK Constants
 * Contains deployed contract addresses and network configurations
 */

// Deployed Budget Enforcer Contract
export const CONTRACTS = {
  testnet: {
    budgetEnforcer: 'CBCAATFEUDNV43RPERRZ66B76C2HIOJ7LJBG77F4KHAVU527Y3PLHPJB',
  },
  mainnet: {
    budgetEnforcer: '', // To be deployed
  },
} as const;

// Wallet used for testing
export const TEST_WALLET = {
  publicKey: 'GC3BIP4AEPKE4XR3BKPYMFPX3T75MQB4QAQEA7XPISUPGQ4P6WRMH6SF',
  // Never commit real secret keys
};

// Network configurations
export const NETWORKS = {
  testnet: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  mainnet: {
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban.stellar.org',
    friendbotUrl: '',
  },
} as const;

// Default API pricing (in XLM)
export const DEFAULT_API_PRICING = {
  'stock-analyst': 0.1,
  'trading-advisor': 0.5,
  default: 0.1,
} as const;

// Stroops conversion (1 XLM = 10^7 stroops)
export const STROOPS_PER_XLM = 10_000_000;

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.floor(xlm * STROOPS_PER_XLM));
}

export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / STROOPS_PER_XLM;
}
