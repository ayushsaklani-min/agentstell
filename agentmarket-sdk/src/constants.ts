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
  // Never commit real secret keys - this is testnet only
};

// USDC Asset configurations
export const USDC_ASSETS = {
  testnet: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  mainnet: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
} as const;

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

// Default API pricing (in USDC)
export const DEFAULT_API_PRICING = {
  weather: 0.001,
  'air-quality': 0.001,
  news: 0.002,
  currency: 0.001,
  geolocation: 0.001,
  ai: 0.005,
  default: 0.001,
} as const;

// Stroops conversion (1 USDC = 10^7 stroops)
export const STROOPS_PER_USDC = 10_000_000;

export function usdcToStroops(usdc: number): bigint {
  return BigInt(Math.floor(usdc * STROOPS_PER_USDC));
}

export function stroopsToUsdc(stroops: bigint): number {
  return Number(stroops) / STROOPS_PER_USDC;
}
