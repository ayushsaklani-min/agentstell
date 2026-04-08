import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT_DIR = path.resolve('.')
const SDK_DIR = path.join(ROOT_DIR, 'agentmarket-sdk')
const MARKET_DIR = path.join(ROOT_DIR, 'agentmarket')
const CLI_CONFIG_PATH = path.join(os.homedir(), '.agentmarket', 'config.json')
const HOST = '127.0.0.1'
const PORT = Number(process.env.AGENTMARKET_TEST_PORT || 3101)
const BASE_URL = `http://${HOST}:${PORT}`
const CONTRACT_ID = 'CBCAATFEUDNV43RPERRZ66B76C2HIOJ7LJBG77F4KHAVU527Y3PLHPJB'

let AgentMarket
let CONTRACTS
let StellarClient

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function npxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseAmount(value) {
  return Number.parseFloat(value)
}

function summarizeError(error) {
  return error instanceof Error ? error.message : String(error)
}

async function runCommand(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = {} } = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(
        new Error(
          `Command failed (${command} ${args.join(' ')}):\n${stdout}${stderr}`.trim()
        )
      )
    })
  })
}

async function loadSdk() {
  const sdkUrl = pathToFileURL(path.join(SDK_DIR, 'dist', 'index.mjs')).href
  ;({ AgentMarket, CONTRACTS, StellarClient } = await import(sdkUrl))
}

async function resolveLiveSecret() {
  if (process.env.AGENTMARKET_TEST_SECRET_KEY) {
    return {
      secretKey: process.env.AGENTMARKET_TEST_SECRET_KEY,
      source: 'env',
    }
  }

  try {
    const raw = await fs.readFile(CLI_CONFIG_PATH, 'utf8')
    const config = JSON.parse(raw)

    if (typeof config.secretKey === 'string' && config.secretKey.length > 0) {
      return {
        secretKey: config.secretKey,
        source: 'cli config',
      }
    }
  } catch {
    return null
  }

  return null
}

async function createProviderWallet() {
  const wallet = StellarClient.generateKeypair()
  const client = new StellarClient('testnet', wallet.secretKey)

  const funded = await client.fundTestnetAccount()
  assert(funded, 'Friendbot funding failed for the provider wallet')

  const trustline = await client.establishTrustline()
  assert(
    trustline.success,
    `Provider trustline failed: ${trustline.error || 'unknown error'}`
  )

  return {
    ...wallet,
    trustlineTxHash: trustline.txHash,
  }
}

async function startMarket(providerPublicKey) {
  const child = spawn(
    npmCommand(),
    ['run', 'start', '--', '--hostname', HOST, '--port', String(PORT)],
    {
      cwd: MARKET_DIR,
      env: {
        ...process.env,
        AGENTMARKET_WALLET_PUBLIC: providerPublicKey,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    }
  )

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  child.on('error', (error) => {
    stderr += summarizeError(error)
  })

  return {
    child,
    getLogs() {
      return { stdout, stderr }
    },
  }
}

async function stopMarket(server) {
  if (!server || server.child.exitCode !== null) {
    return
  }

  server.child.kill('SIGTERM')
  await sleep(1500)

  if (server.child.exitCode === null) {
    server.child.kill('SIGKILL')
    await sleep(500)
  }
}

async function waitForMarket(server) {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      const logs = server.getLogs()
      throw new Error(`agentmarket exited before becoming ready\n${logs.stdout}\n${logs.stderr}`)
    }

    try {
      const response = await fetch(`${BASE_URL}/api/marketplace`)
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until the timeout expires.
    }

    await sleep(500)
  }

  const logs = server.getLogs()
  throw new Error(`Timed out waiting for agentmarket\n${logs.stdout}\n${logs.stderr}`)
}

async function registerDatabaseListing() {
  const apiName = `sdk-db-test-${Date.now()}`
  const response = await fetch(`${BASE_URL}/api/providers/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      providerName: 'AgentMarket E2E Provider',
      email: 'e2e@agentmarket.local',
      stellarAddress: 'GC3BIP4AEPKE4XR3BKPYMFPX3T75MQB4QAQEA7XPISUPGQ4P6WRMH6SF',
      apiName,
      description: 'Database-backed listing created during the E2E flow.',
      endpoint: `${BASE_URL}/api/proxy/agent-test`,
      category: 'utilities',
      priceUsdc: 0.001,
    }),
  })

  const body = await response.json()
  assert(response.ok, `Provider registration failed: ${JSON.stringify(body)}`)
  assert(body.success === true, 'Provider registration did not return success')

  return body.api.slug
}

async function verifyDatabaseMarketplace(slug) {
  const marketplaceResponse = await fetch(`${BASE_URL}/api/marketplace`)
  const marketplaceBody = await marketplaceResponse.json()

  assert(marketplaceResponse.ok, 'Marketplace request failed')
  assert(
    marketplaceBody.source === 'database',
    `Marketplace route did not use the database source: ${marketplaceBody.source}`
  )
  assert(
    marketplaceBody.apis.some((api) => api.slug === slug),
    `Marketplace response did not include the registered listing ${slug}`
  )

  const listingResponse = await fetch(`${BASE_URL}/api/marketplace/${slug}`)
  const listingBody = await listingResponse.json()

  assert(listingResponse.ok, 'Marketplace detail request failed')
  assert(
    listingBody.source === 'database',
    `Marketplace detail route did not use the database source: ${listingBody.source}`
  )
  assert(
    listingBody.api.slug === slug,
    `Marketplace detail returned ${listingBody.api.slug} instead of ${slug}`
  )

  return marketplaceBody.apis.length
}

async function verifyPaymentRequired(providerPublicKey) {
  const response = await fetch(
    `${BASE_URL}/api/proxy/agent-test?task=raw-402-check`
  )
  const body = await response.json()

  assert(response.status === 402, `Expected 402, received ${response.status}`)
  assert(
    body.payment.recipient === providerPublicKey,
    '402 response used the wrong provider wallet'
  )
  assert(body.payment.apiId === 'agent-test', '402 response used the wrong API id')

  return body.payment.amount
}

async function verifyLiveSdkPayment(secretKey, providerPublicKey) {
  const agent = new AgentMarket({
    secretKey,
    network: 'testnet',
    baseUrl: BASE_URL,
  })
  const observer = new StellarClient('testnet')
  const events = []

  agent.on((event) => {
    events.push(event.type)
  })

  const beforePayer = await agent.getBalance()
  const beforeProvider = await observer.getBalance(providerPublicKey)

  const result = await agent.get('agent-test', {
    task: 'live sdk verification',
    agentId: 'test-e2e',
  })

  const afterPayer = await agent.getBalance()
  const afterProvider = await observer.getBalance(providerPublicKey)

  assert(result.success, `SDK call failed: ${result.error || 'unknown error'}`)
  assert(result.metadata.txHash, 'SDK call did not return a payment transaction hash')
  assert(
    parseAmount(afterPayer.usdc) < parseAmount(beforePayer.usdc),
    'Payer USDC balance did not decrease'
  )
  assert(
    parseAmount(afterProvider.usdc) > parseAmount(beforeProvider.usdc),
    'Provider USDC balance did not increase'
  )
  assert(
    events.includes('payment_confirmed'),
    `SDK events did not include payment_confirmed: ${events.join(', ')}`
  )

  return {
    txHash: result.metadata.txHash,
    cost: result.metadata.cost,
    beforePayer,
    afterPayer,
    beforeProvider,
    afterProvider,
  }
}

async function runTests() {
  console.log('\nAgentMarket End-to-End Tests\n')
  console.log('='.repeat(50))

  let passed = 0
  let failed = 0
  let skipped = 0

  const liveSecret = await resolveLiveSecret()

  async function runTest(name, fn) {
    process.stdout.write(`\n${name}\n`)

    try {
      const details = await fn()
      passed += 1
      console.log('   [PASS]')
      if (details) {
        console.log(`   ${details}`)
      }
    } catch (error) {
      failed += 1
      console.log(`   [FAIL] ${summarizeError(error)}`)
    }
  }

  function skipTest(name, reason) {
    skipped += 1
    console.log(`\n${name}\n   [SKIP] ${reason}`)
  }

  await runTest('1. Building SDK artifacts', async () => {
    await runCommand(npmCommand(), ['run', 'build'], { cwd: SDK_DIR })
    await loadSdk()
    return 'agentmarket-sdk build completed'
  })

  await runTest('2. Testing contract configuration', async () => {
    assert(CONTRACTS.testnet.budgetEnforcer === CONTRACT_ID, 'Contract ID mismatch')
    return `contract ${CONTRACT_ID}`
  })

  await runTest('3. Testing keypair generation', async () => {
    const keypair = StellarClient.generateKeypair()
    assert(keypair.publicKey.startsWith('G'), 'Generated public key is invalid')
    assert(keypair.secretKey.startsWith('S'), 'Generated secret key is invalid')
    return `generated ${keypair.publicKey.slice(0, 12)}...`
  })

  await runTest('4. Testing explorer URL generation', async () => {
    const stellar = new StellarClient('testnet')
    const url = stellar.getExplorerUrl('abc123')
    assert(url.includes('testnet.stellarchain.io/tx/abc123'), 'Explorer URL format is invalid')
    return url
  })

  if (!liveSecret) {
    skipTest(
      '5. Live market, database, and SDK payment flow',
      'Set AGENTMARKET_TEST_SECRET_KEY or configure the CLI wallet at ~/.agentmarket/config.json'
    )
  } else {
    await runTest('5. Live market, database, and SDK payment flow', async () => {
      await runCommand(npmCommand(), ['run', 'build'], { cwd: MARKET_DIR })
      await runCommand(npxCommand(), ['prisma', 'db', 'push'], {
        cwd: MARKET_DIR,
      })

      const provider = await createProviderWallet()
      const server = await startMarket(provider.publicKey)

      try {
        await waitForMarket(server)

        const slug = await registerDatabaseListing()
        const listingCount = await verifyDatabaseMarketplace(slug)
        const amount = await verifyPaymentRequired(provider.publicKey)
        const payment = await verifyLiveSdkPayment(
          liveSecret.secretKey,
          provider.publicKey
        )

        return [
          `wallet source: ${liveSecret.source}`,
          `registered listing: ${slug}`,
          `database listings visible: ${listingCount}`,
          `paid amount: ${amount} USDC`,
          `tx hash: ${payment.txHash}`,
        ].join('\n   ')
      } finally {
        await stopMarket(server)
      }
    })
  }

  console.log('\n' + '='.repeat(50))
  console.log(`\nTest Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`)

  if (failed > 0) {
    console.log('[FAIL] Some tests failed. Check output above.\n')
    process.exit(1)
  }

  console.log(skipped > 0 ? '[WARN] All runnable tests passed; some checks were skipped.\n' : '[PASS] All tests passed.\n')
}

runTests().catch((error) => {
  console.error(`[FAIL] ${summarizeError(error)}`)
  process.exit(1)
})
