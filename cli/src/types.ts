/**
 * AgentMarket CLI - Types
 */

export interface Config {
  stellarNetwork: 'testnet' | 'mainnet';
  secretKey?: string;
  publicKey?: string;
  marketplaceUrl: string;
  budgetLimit: number;
  contractId?: string;
}

export interface ApiInfo {
  name: string;
  slug: string;
  description: string;
  category: string;
  priceUsdc: number;
  endpoint: string;
  method: 'GET' | 'POST';
  provider: string;
}

export interface WalletInfo {
  publicKey: string;
  network: 'testnet' | 'mainnet';
  xlmBalance: string;
  usdcBalance: string;
}

export interface CallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  txHash?: string;
  amountPaid?: number;
  latencyMs?: number;
}

export interface BudgetStatus {
  totalBudget: number;
  spent: number;
  remaining: number;
  callsToday: number;
  lastCall?: string;
}

export interface TransactionRecord {
  txHash: string;
  api: string;
  amount: number;
  timestamp: string;
  success: boolean;
}
