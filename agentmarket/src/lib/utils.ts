import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format USDC amount for display
export function formatUsdc(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num < 0.001) return '< $0.001'
  if (num < 1) return `$${num.toFixed(4)}`
  return `$${num.toFixed(2)}`
}

// Format large numbers with K, M suffix
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

// Truncate Stellar address for display
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

// Generate random transaction ID (for testing)
export function generateTxId(): string {
  return Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

// Sleep helper for async operations
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Validate Stellar address format
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address)
}
