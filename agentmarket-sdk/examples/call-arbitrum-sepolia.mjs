import fs from 'node:fs/promises'
import path from 'node:path'
import { AgentMarket } from 'agstell-sdk'

const BASE_URL = 'http://localhost:3001'
const SLUG = 'arbitrum-sepolia'

async function loadSecretKey() {
  const secretKey =
    process.env.STELLAR_SECRET_KEY ?? process.env.AGENTMARKET_TEST_SECRET_KEY

  if (secretKey) {
    return secretKey
  }

  const home = process.env.USERPROFILE ?? process.env.HOME
  if (!home) {
    throw new Error(
      'Set STELLAR_SECRET_KEY or AGENTMARKET_TEST_SECRET_KEY before running this script.'
    )
  }

  const configPath = path.join(home, '.agentmarket', 'config.json')
  const raw = await fs.readFile(configPath, 'utf8')
  const config = JSON.parse(raw)

  if (!config.secretKey) {
    throw new Error(
      `No secretKey found in ${configPath}. Set STELLAR_SECRET_KEY or AGENTMARKET_TEST_SECRET_KEY.`
    )
  }

  return config.secretKey
}

async function main() {
  let paymentProof = null
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers || {})
    const proofHeader = headers.get('X-Payment-Proof')

    if (proofHeader) {
      paymentProof = JSON.parse(proofHeader)
      console.log('Payment proof sent:')
      console.log(JSON.stringify(paymentProof, null, 2))
    }

    return originalFetch(input, init)
  }

  try {
    const agent = new AgentMarket({
      secretKey: await loadSecretKey(),
      network: 'testnet',
      baseUrl: BASE_URL,
      debug: true,
      budgetLimits: {
        maxPerCall: 0.01,
        maxPerSession: 0.05,
      },
    })

    await agent.discoverApis(true)

    const api = agent.getApiInfo(SLUG)
    if (!api) {
      throw new Error(`Slug "${SLUG}" was not found in ${BASE_URL}/api/marketplace`)
    }

    console.log('Calling API:')
    console.log(JSON.stringify({ slug: api.slug, endpoint: api.endpoint, method: api.method }, null, 2))

    const result = await agent.invoke(SLUG)

    if (!result.success) {
      console.error('API call failed:')
      console.error(result.error)

      if (!paymentProof) {
        console.error('No payment proof was sent. The call did not reach the 402 retry path.')
      }

      process.exitCode = 1
      return
    }

    console.log('Response:')
    console.log(JSON.stringify(result.data, null, 2))
    console.log('Metadata:')
    console.log(JSON.stringify(result.metadata, null, 2))
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
