/**
 * AgentMarket CLI - Configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config } from './types';

const CONFIG_DIR = path.join(os.homedir(), '.agentmarket');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');
const REGISTRY_CACHE_FILE = path.join(CONFIG_DIR, 'registry.json');

export interface RegistryCache {
  cachedAt: number;
  apis: import('./types').ApiInfo[];
}

export function readRegistryCache(): RegistryCache | null {
  try {
    if (!fs.existsSync(REGISTRY_CACHE_FILE)) return null;
    const data = fs.readFileSync(REGISTRY_CACHE_FILE, 'utf-8');
    return JSON.parse(data) as RegistryCache;
  } catch {
    return null;
  }
}

export function writeRegistryCache(apis: import('./types').ApiInfo[]): void {
  try {
    ensureConfigDir();
    const cache: RegistryCache = { cachedAt: Date.now(), apis };
    fs.writeFileSync(REGISTRY_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Cache write failure is non-fatal — silently ignore
  }
}

// Deployed Contract IDs
export const CONTRACTS = {
  testnet: {
    budgetEnforcer: 'CBCAATFEUDNV43RPERRZ66B76C2HIOJ7LJBG77F4KHAVU527Y3PLHPJB',
  },
  mainnet: {
    budgetEnforcer: '',
  },
} as const;

export const DEFAULT_CONFIG: Config = {
  stellarNetwork: 'testnet',
  marketplaceUrl: 'https://agentmarket.xyz',
  budgetLimit: 10, // 10 USDC default
  contractId: CONTRACTS.testnet.budgetEnforcer,
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<Config>): void {
  ensureConfigDir();
  const existing = loadConfig();
  const updated = { ...existing, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadHistory(): { calls: { api: string; timestamp: string; amount: number; txHash: string }[] } {
  ensureConfigDir();
  
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { calls: [] };
    }
  }
  
  return { calls: [] };
}

export function appendHistory(call: { api: string; timestamp: string; amount: number; txHash: string }): void {
  const history = loadHistory();
  history.calls.push(call);
  // Keep only last 1000 calls
  if (history.calls.length > 1000) {
    history.calls = history.calls.slice(-1000);
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}
