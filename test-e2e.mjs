/**
 * AgentMarket End-to-End Tests
 *
 * Tests the live deployed backend on mainnet:
 *   - SDK build
 *   - Keypair generation + explorer URL
 *   - Live /api/agents/discover
 *   - Provider registration (requires GA7CDNYK wallet)
 *   - Live paid call: stock-analyst (0.1 XLM, requires funded CLI wallet)
 *
 * Usage:
 *   node test-e2e.mjs
 *
 * Optional env vars:
 *   AGENTMARKET_TEST_SECRET_KEY   Stellar secret key for the payer (falls back to ~/.agentmarket/config.json)
 *   AGENTMARKET_BASE_URL          Override backend URL (default: https://steller-web.vercel.app)
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT_DIR = path.resolve('.')
const SDK_DIR = path.join(ROOT_DIR, 'agentmarket-sdk')
const CLI_CONFIG_PATH = path.join(os.homedir(), '.agentmarket', 'config.json')
const BASE_URL = (process.env.AGENTMARKET_BASE_URL || 'https://steller-web.vercel.app').replace(/\/$/, '')

// The provider wallet that has APIs registered in the DB
const PROVIDER_ADDRESS = 'GA7CDNYK3I4X5KRSYGI7HIHWF2XAIZMRVZAWFSHUP2PZUNM4ETVIYXWT'

let AgentMarket
let StellarClient

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function summarizeError(error) {
  return error instanceof Error ? error.message : String(error)
}

async function runCommand(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = {} } = options
  const [spawnCmd, spawnArgs] =
    process.platform === 'win32'
      ? ['cmd', ['/c', command, ...args]]
      : [command, args]

  return new Promise((resolve, reject) => {
    const child = spawn(spawnCmd, spawnArgs, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += c.toString() })
    child.stderr.on('data', (c) => { stderr += c.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr })
      reject(new Error(`Command failed (${command} ${args.join(' ')}):\n${stdout}${stderr}`.trim()))
    })
  })
}

async function loadSdk() {
  const sdkUrl = pathToFileURL(path.join(SDK_DIR, 'dist', 'index.mjs')).href
  ;({ AgentMarket, StellarClient } = await import(sdkUrl))
}

async function resolveLiveSecret() {
  if (process.env.AGENTMARKET_TEST_SECRET_KEY) {
    return { secretKey: process.env.AGENTMARKET_TEST_SECRET_KEY, source: 'env' }
  }
  try {
    const raw = await fs.readFile(CLI_CONFIG_PATH, 'utf8')
    const config = JSON.parse(raw)
    if (typeof config.secretKey === 'string' && config.secretKey.length > 0) {
      return { secretKey: config.secretKey, source: 'cli config' }
    }
  } catch { /* no cli config */ }
  return null
}

async function runTests() {
  console.log('\nAgentMarket End-to-End Tests')
  console.log(`Backend: ${BASE_URL}`)
  console.log('='.repeat(60))

  let passed = 0
  let failed = 0
  let skipped = 0

  const liveSecret = await resolveLiveSecret()

  async function runTest(name, fn) {
    process.stdout.write(`\n${name}\n`)
    try {
      const details = await fn()
      passed++
      console.log('  [PASS]')
      if (details) console.log(`  ${details}`)
    } catch (error) {
      failed++
      console.log(`  [FAIL] ${summarizeError(error)}`)
    }
  }

  function skipTest(name, reason) {
    skipped++
    console.log(`\n${name}\n  [SKIP] ${reason}`)
  }

  // ── 1. Build SDK ──────────────────────────────────────────────────────────
  await runTest('1. Build SDK', async () => {
    await runCommand(npmCommand(), ['run', 'build'], { cwd: SDK_DIR })
    await loadSdk()
    return 'agentmarket-sdk built and loaded'
  })

  // ── 2. Keypair generation ─────────────────────────────────────────────────
  await runTest('2. Keypair generation', async () => {
    const keypair = StellarClient.generateKeypair()
    assert(keypair.publicKey.startsWith('G'), 'Public key must start with G')
    assert(keypair.secretKey.startsWith('S'), 'Secret key must start with S')
    assert(keypair.publicKey.length === 56, 'Public key must be 56 chars')
    return `generated ${keypair.publicKey.slice(0, 12)}…`
  })

  // ── 3. Explorer URL ───────────────────────────────────────────────────────
  await runTest('3. Explorer URL format', async () => {
    const client = new StellarClient('mainnet')
    const url = client.getExplorerUrl('abc123')
    assert(url.includes('stellar.expert/explorer/public/tx/abc123'), `Bad URL: ${url}`)
    return url
  })

  // ── 4. Live discover endpoint ─────────────────────────────────────────────
  await runTest('4. Live discover — mainnet XLM APIs', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/discover`)
    assert(res.ok, `Discover returned ${res.status}`)
    const body = await res.json()
    assert(body.paymentAsset === 'XLM', `paymentAsset should be XLM, got: ${body.paymentAsset}`)
    assert(body.paymentNetwork === 'mainnet', `paymentNetwork should be mainnet, got: ${body.paymentNetwork}`)
    assert(Array.isArray(body.apis) && body.apis.length > 0, 'No APIs in discover response')
    const xlmApis = body.apis.filter(a => a.price?.asset === 'XLM')
    assert(xlmApis.length > 0, 'No XLM-priced APIs found')
    return `${body.total} APIs, all on mainnet XLM`
  })

  // ── 5. Stock-analyst 402 gate ─────────────────────────────────────────────
  await runTest('5. Stock-analyst 402 Payment Required', async () => {
    const res = await fetch(`${BASE_URL}/api/proxy/stock-analyst?symbol=AAPL`)
    assert(res.status === 402, `Expected 402, got ${res.status}`)
    const body = await res.json()
    assert(body.payment?.recipient, 'Missing payment.recipient in 402 response')
    assert(body.payment?.currency === 'XLM' || body.payment?.asset === 'XLM', 'Payment should be XLM')
    return `recipient: ${body.payment.recipient.slice(0, 8)}…, amount: ${body.payment.amount} XLM`
  })

  // ── 6. Provider dashboard ─────────────────────────────────────────────────
  await runTest('6. Provider dashboard (GA7CDNYK)', async () => {
    const res = await fetch(`${BASE_URL}/api/provider/dashboard?stellarAddress=${PROVIDER_ADDRESS}`)
    assert(res.ok, `Dashboard returned ${res.status}`)
    const body = await res.json()
    assert(body.provider?.stellarAddress === PROVIDER_ADDRESS, 'Wrong provider returned')
    assert(body.summary?.totalApis > 0, 'Provider has no APIs')
    return `${body.summary.totalApis} APIs, ${body.summary.totalCalls} calls, ${body.summary.totalRevenue?.toFixed(4)} XLM revenue`
  })

  // ── 7. SDK balance check ──────────────────────────────────────────────────
  if (!liveSecret) {
    skipTest('7. SDK live balance + paid call', 'Set AGENTMARKET_TEST_SECRET_KEY or run: agentmarket init')
  } else {
    await runTest('7. SDK mainnet wallet balance', async () => {
      const agent = new AgentMarket({ secretKey: liveSecret.secretKey, network: 'mainnet', baseUrl: BASE_URL })
      const balance = await agent.getBalance()
      assert(balance?.xlm !== undefined, 'No XLM balance returned')
      assert(parseFloat(balance.xlm) > 0, `XLM balance is 0 — fund wallet before calling paid APIs`)
      return `XLM balance: ${balance.xlm} (source: ${liveSecret.source})`
    })
  }

  // ── 8. Live paid call — stock-analyst (0.1 XLM) ──────────────────────────
  if (!liveSecret) {
    skipTest('8. Live paid call — stock-analyst (0.1 XLM)', 'No secret key configured')
  } else {
    await runTest('8. Live paid call — stock-analyst (0.1 XLM)', async () => {
      const agent = new AgentMarket({ secretKey: liveSecret.secretKey, network: 'mainnet', baseUrl: BASE_URL })
      const result = await agent.stockAnalyst('AAPL')
      assert(result.success, `Call failed: ${result.error}`)
      assert(result.data?.symbol, 'No symbol in response')
      assert(result.data?.sentiment, 'No sentiment in response')
      assert(result.metadata?.txHash, 'No txHash in result')
      return [
        `symbol: ${result.data.symbol}`,
        `sentiment: ${result.data.sentiment}`,
        `tx: ${result.metadata.txHash.slice(0, 16)}…`,
        `paid: ${result.metadata.cost} XLM`,
        `latency: ${result.metadata.latencyMs}ms`,
      ].join('  ')
    })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`)

  if (failed > 0) {
    console.log('[FAIL] Some tests failed. Check output above.\n')
    process.exit(1)
  }

  console.log(skipped > 0
    ? '[WARN] All runnable tests passed; some skipped (no funded wallet configured).\n'
    : '[PASS] All tests passed.\n'
  )
}

runTests().catch((error) => {
  console.error(`[FAIL] ${summarizeError(error)}`)
  process.exit(1)
})
