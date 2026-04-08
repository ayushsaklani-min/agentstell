import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentMarket } from './client'

describe('AgentMarket', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists built-in APIs with canonical HTTP methods', () => {
    const agent = new AgentMarket()

    expect(agent.listApis()).toHaveLength(7)
    expect(agent.getApiInfo('weather')?.method).toBe('GET')
    expect(agent.getApiInfo('ai')?.method).toBe('POST')
    expect(agent.getApiInfo('agent-test')?.endpoint).toBe('/api/proxy/agent-test')
  })

  it('blocks requests that exceed the configured per-call budget', async () => {
    const agent = new AgentMarket({
      budgetLimits: {
        maxPerCall: 0.001,
        maxPerSession: 1,
      },
    })

    const result = await agent.ai('Explain x402')

    expect(result.success).toBe(false)
    expect(result.error).toContain('exceeds max per call')
    expect(agent.getBudgetStatus().spent).toBe(0)
  })

  it('tracks successful paid calls and emits payment events', async () => {
    const agent = new AgentMarket()
    const executeWithPayment = vi.fn().mockResolvedValue({
      data: { city: 'Mumbai' },
      txHash: 'tx_123',
      cost: 0.001,
    })
    const getExplorerUrl = vi
      .fn()
      .mockReturnValue('https://testnet.stellarchain.io/tx/tx_123')
    const events: string[] = []

    ;(agent as any).x402 = { executeWithPayment }
    ;(agent as any).stellar = { getExplorerUrl }

    agent.on((event) => {
      events.push(event.type)
    })

    const result = await agent.weather('Mumbai')

    expect(executeWithPayment).toHaveBeenCalledWith(
      expect.stringContaining('/api/proxy/weather?city=Mumbai'),
      { method: 'GET' }
    )
    expect(result).toMatchObject({
      success: true,
      data: { city: 'Mumbai' },
      metadata: {
        apiName: 'weather',
        txHash: 'tx_123',
        cost: 0.001,
      },
    })
    expect(agent.getBudgetStatus()).toMatchObject({
      spent: 0.001,
      remaining: 0.999,
      callCount: 1,
    })
    expect(events).toEqual(
      expect.arrayContaining(['api_call', 'payment_confirmed'])
    )
  })

  it('discovers provider-submitted APIs from the marketplace when they are not built in', async () => {
    const agent = new AgentMarket({
      baseUrl: 'https://agentmarket.xyz',
    })
    const executeWithPayment = vi.fn().mockResolvedValue({
      data: { ok: true },
      txHash: 'tx_dynamic',
      cost: 0.003,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          api: {
            id: 'custom-weather',
            slug: 'custom-weather',
            name: 'Custom Weather',
            description: 'Provider weather feed',
            category: 'Data',
            priceUsdc: 0.003,
            endpoint: '/api/proxy/custom-weather',
            method: 'GET',
            providerName: 'Demo Provider',
            providerStellarAddress: 'GDEMO123',
          },
        }),
      })
    )

    ;(agent as any).x402 = { executeWithPayment }
    ;(agent as any).stellar = { getExplorerUrl: vi.fn().mockReturnValue('https://testnet.stellarchain.io/tx/tx_dynamic') }

    const result = await agent.get('custom-weather', { city: 'Pune' })

    expect(result.success).toBe(true)
    expect(executeWithPayment).toHaveBeenCalledWith(
      'https://agentmarket.xyz/api/proxy/custom-weather?city=Pune',
      { method: 'GET' }
    )
    expect(agent.getApiInfo('custom-weather')).toMatchObject({
      provider: {
        name: 'Demo Provider',
      },
      priceUsdc: 0.003,
    })
  })
})
