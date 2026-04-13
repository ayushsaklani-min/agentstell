import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentMarket } from './client'

describe('AgentMarket', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists built-in APIs with canonical HTTP methods', () => {
    const agent = new AgentMarket()

    expect(agent.listApis()).toHaveLength(2)
    expect(agent.getApiInfo('stock-analyst')?.method).toBe('GET')
    expect(agent.getApiInfo('trading-advisor')?.method).toBe('GET')
    expect(agent.getApiInfo('stock-analyst')?.priceXlm).toBe(0.1)
    expect(agent.getApiInfo('trading-advisor')?.priceXlm).toBe(0.5)
  })

  it('blocks requests that exceed the configured per-call budget', async () => {
    const agent = new AgentMarket({
      budgetLimits: {
        maxPerCall: 0.05,
        maxPerSession: 10,
      },
    })

    const result = await agent.stockAnalyst('NVDA')

    expect(result.success).toBe(false)
    expect(result.error).toContain('exceeds max per call')
    expect(agent.getBudgetStatus().spent).toBe(0)
  })

  it('tracks successful paid calls and emits payment events', async () => {
    const agent = new AgentMarket()
    const executeWithPayment = vi.fn().mockResolvedValue({
      data: { symbol: 'NVDA', sentiment: 'bullish' },
      txHash: 'tx_123',
      cost: 0.1,
    })
    const getExplorerUrl = vi
      .fn()
      .mockReturnValue('https://stellar.expert/explorer/public/tx/tx_123')
    const events: string[] = []

    ;(agent as any).x402 = { executeWithPayment }
    ;(agent as any).stellar = { getExplorerUrl }

    agent.on((event) => {
      events.push(event.type)
    })

    const result = await agent.stockAnalyst('NVDA')

    expect(executeWithPayment).toHaveBeenCalledWith(
      expect.stringContaining('/api/proxy/stock-analyst?symbol=NVDA'),
      { method: 'GET' }
    )
    expect(result).toMatchObject({
      success: true,
      data: { symbol: 'NVDA', sentiment: 'bullish' },
      metadata: {
        apiName: 'stock-analyst',
        txHash: 'tx_123',
        cost: 0.1,
      },
    })
    expect(agent.getBudgetStatus()).toMatchObject({
      spent: 0.1,
      remaining: 9.9,
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
      cost: 0.2,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          api: {
            id: 'custom-agent',
            slug: 'custom-agent',
            name: 'Custom Agent',
            description: 'Provider agent',
            category: 'Finance',
            priceXlm: 0.2,
            endpoint: '/api/proxy/custom-agent',
            method: 'GET',
            providerName: 'Demo Provider',
            providerStellarAddress: 'GDEMO123',
          },
        }),
      })
    )

    ;(agent as any).x402 = { executeWithPayment }
    ;(agent as any).stellar = { getExplorerUrl: vi.fn().mockReturnValue('https://stellar.expert/explorer/public/tx/tx_dynamic') }

    const result = await agent.get('custom-agent', { symbol: 'AAPL' })

    expect(result.success).toBe(true)
    expect(executeWithPayment).toHaveBeenCalledWith(
      'https://agentmarket.xyz/api/proxy/custom-agent?symbol=AAPL',
      { method: 'GET' }
    )
    expect(agent.getApiInfo('custom-agent')).toMatchObject({
      provider: {
        name: 'Demo Provider',
      },
      priceXlm: 0.2,
    })
  })
})
