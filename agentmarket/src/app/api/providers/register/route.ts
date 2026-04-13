import type { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { getPrismaClient } from '@/lib/db'
import { mapDbListing } from '@/lib/marketplace/catalog'

interface ProviderRegistrationRequest {
  providerName: string
  email?: string
  providerDescription?: string
  stellarAddress: string
  apiName: string
  description: string
  longDescription?: string
  endpoint: string
  category: string
  priceXlm?: number
  priceUsdc?: number   // legacy alias — treated as XLM amount
  method?: string
  // Capability spec fields
  contentType?: string
  requestSchema?: Record<string, unknown>
  responseSchema?: Record<string, unknown>
  exampleRequest?: Record<string, unknown>
  exampleResponse?: Record<string, unknown>
  params?: Array<{ name: string; type: string; required: boolean; description: string }>
  sideEffectLevel?: 'read' | 'write' | 'financial' | 'destructive'
  latencyHint?: 'fast' | 'medium' | 'slow'
  idempotent?: boolean
}

const VALID_SIDE_EFFECTS = new Set(['read', 'write', 'financial', 'destructive'])
const VALID_LATENCY_HINTS = new Set(['fast', 'medium', 'slow'])
const ENDPOINT_PROBE_TIMEOUT_MS = 8000

// Stellar network config for wallet readiness checks
const STELLAR_NETWORK = (process.env.STELLAR_NETWORK || 'mainnet') as 'testnet' | 'mainnet'
const HORIZON_URLS = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
}

interface WalletReadiness {
  exists: boolean
  error?: string
}

async function checkWalletReadiness(stellarAddress: string): Promise<WalletReadiness> {
  const horizonUrl = HORIZON_URLS[STELLAR_NETWORK]

  try {
    const res = await fetch(`${horizonUrl}/accounts/${stellarAddress}`, {
      headers: { Accept: 'application/json' },
    })

    if (res.status === 404) {
      return { exists: false, error: `Stellar account ${stellarAddress.slice(0, 8)}… does not exist on ${STELLAR_NETWORK}. Fund it first.` }
    }

    if (!res.ok) {
      return { exists: false, error: `Horizon returned ${res.status} when checking account` }
    }

    return { exists: true }
  } catch (err) {
    // Network issues shouldn't block registration — just warn
    console.warn('Wallet readiness check failed (non-blocking):', err)
    return { exists: true }
  }
}

const RESERVED_SLUGS = new Set([
  'weather',
  'air-quality',
  'news',
  'currency',
  'geolocation',
  'ai',
  'agent-test',
])

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeCategory(category: string) {
  const normalized = category.trim().toUpperCase()

  if (['DATA', 'FINANCE', 'GEO', 'AI', 'UTILITIES', 'NEWS', 'WEATHER'].includes(normalized)) {
    return normalized
  }

  return 'UTILITIES'
}

async function buildUniqueSlug(prisma: PrismaClient, baseSlug: string) {
  let candidate = baseSlug || 'api'
  let suffix = 1

  while (
    RESERVED_SLUGS.has(candidate) ||
    await prisma.apiListing.findUnique({ where: { slug: candidate } })
  ) {
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return candidate
}

function normalizeMethod(method?: string) {
  const normalized = method?.trim().toUpperCase() || 'GET'
  return normalized === 'POST' ? 'POST' : 'GET'
}

function isValidStellarAddress(address: string) {
  try {
    StellarSdk.Keypair.fromPublicKey(address)
    return true
  } catch {
    return false
  }
}

function isAllowedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)

    if (url.protocol === 'https:') {
      return true
    }

    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

async function probeEndpoint(endpoint: string, method: string): Promise<{ reachable: boolean; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ENDPOINT_PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint, {
      method: method === 'POST' ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'AgentMarket-Probe/1.0' },
      signal: controller.signal,
      ...(method === 'POST' ? { body: '{}' } : {}),
    })
    clearTimeout(timer)
    // Any HTTP response means the endpoint is reachable (even 4xx/5xx)
    if (res.status >= 200 && res.status < 600) return { reachable: true }
    return { reachable: false, error: `Endpoint returned unexpected status ${res.status}` }
  } catch (err) {
    clearTimeout(timer)
    if (controller.signal.aborted) {
      return { reachable: false, error: `Endpoint did not respond within ${ENDPOINT_PROBE_TIMEOUT_MS / 1000}s` }
    }
    return { reachable: false, error: `Endpoint unreachable: ${err instanceof Error ? err.message : 'unknown error'}` }
  }
}

function safeStringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  try { return JSON.stringify(value) } catch { return undefined }
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient()
    const body = await request.json() as ProviderRegistrationRequest

    const {
      providerName,
      email,
      providerDescription,
      stellarAddress,
      apiName,
      description,
      longDescription,
      endpoint,
      category,
      priceXlm,
      priceUsdc: priceUsdcLegacy,
      method,
      // Capability spec
      contentType,
      requestSchema,
      responseSchema,
      exampleRequest,
      exampleResponse,
      params,
      sideEffectLevel,
      latencyHint,
      idempotent,
    } = body

    // Resolve price — accept priceXlm (preferred) or legacy priceUsdc alias
    const priceUsdc = priceXlm ?? priceUsdcLegacy

    // ── Required field validation ──
    if (
      !providerName ||
      !stellarAddress ||
      !apiName ||
      !description ||
      !endpoint ||
      !category ||
      !priceUsdc
    ) {
      return NextResponse.json(
        { error: 'Missing required registration fields' },
        { status: 400 }
      )
    }

    if (priceUsdc <= 0) {
      return NextResponse.json(
        { error: 'priceXlm must be greater than zero' },
        { status: 400 }
      )
    }

    if (!isValidStellarAddress(stellarAddress)) {
      return NextResponse.json(
        { error: 'stellarAddress must be a valid Stellar public key (starts with G, 56 characters)' },
        { status: 400 }
      )
    }

    if (!isAllowedEndpoint(endpoint)) {
      return NextResponse.json(
        {
          error:
            'Endpoint must be HTTPS, or HTTP on localhost/127.0.0.1 for local testing',
        },
        { status: 400 }
      )
    }

    // ── Wallet readiness: account must exist on Stellar mainnet ──
    const wallet = await checkWalletReadiness(stellarAddress)
    if (!wallet.exists) {
      return NextResponse.json(
        { error: wallet.error ?? 'Provider wallet does not exist on the Stellar network' },
        { status: 422 }
      )
    }

    // ── Capability spec validation ──
    if (sideEffectLevel && !VALID_SIDE_EFFECTS.has(sideEffectLevel)) {
      return NextResponse.json(
        { error: `sideEffectLevel must be one of: read, write, financial, destructive` },
        { status: 400 }
      )
    }

    if (latencyHint && !VALID_LATENCY_HINTS.has(latencyHint)) {
      return NextResponse.json(
        { error: `latencyHint must be one of: fast, medium, slow` },
        { status: 400 }
      )
    }

    // ── Protocol-aware linting ──
    const normalizedMethod = normalizeMethod(method)
    const looksJsonRpc =
      endpoint.toLowerCase().includes('jsonrpc') ||
      endpoint.toLowerCase().includes('json-rpc') ||
      (exampleRequest && 'jsonrpc' in exampleRequest)

    if (looksJsonRpc) {
      if (normalizedMethod !== 'POST') {
        return NextResponse.json(
          { error: 'JSON-RPC endpoints must use POST method' },
          { status: 400 }
        )
      }
      if (!exampleRequest || Object.keys(exampleRequest).length === 0) {
        return NextResponse.json(
          { error: 'JSON-RPC endpoints require a non-empty exampleRequest so agents can construct valid calls' },
          { status: 400 }
        )
      }
    }

    // ── Readiness gate: probe endpoint ──
    const probe = await probeEndpoint(endpoint, normalizedMethod)
    if (!probe.reachable) {
      return NextResponse.json(
        { error: `Endpoint readiness check failed: ${probe.error}` },
        { status: 422 }
      )
    }

    // ── Persist ──
    const provider = await prisma.provider.upsert({
      where: { stellarAddress },
      update: {
        name: providerName,
        email,
        description: providerDescription,
      },
      create: {
        name: providerName,
        email,
        stellarAddress,
        description: providerDescription,
      },
    })

    const slug = await buildUniqueSlug(prisma, slugify(apiName))

    const listing = await prisma.apiListing.create({
      data: {
        name: apiName,
        slug,
        description,
        longDescription: longDescription || description,
        category: normalizeCategory(category),
        priceUsdc,
        endpoint,
        method: normalizedMethod,
        contentType: contentType || 'application/json',
        requestSchema: safeStringify(requestSchema),
        responseSchema: safeStringify(responseSchema),
        exampleRequest: safeStringify(exampleRequest),
        exampleResponse: safeStringify(exampleResponse),
        params: safeStringify(params),
        sideEffectLevel: sideEffectLevel || 'read',
        latencyHint: latencyHint || 'fast',
        idempotent: idempotent ?? true,
        providerId: provider.id,
        isActive: true,
        isFeatured: false,
      },
      include: {
        provider: {
          select: {
            name: true,
            stellarAddress: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      api: mapDbListing(listing),
    })
  } catch (error) {
    console.error('Provider registration failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Provider registration failed',
      },
      { status: 500 }
    )
  }
}
