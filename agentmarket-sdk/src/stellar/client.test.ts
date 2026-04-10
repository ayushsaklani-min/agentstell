import { describe, expect, it, vi } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { StellarClient } from './client'

describe('StellarClient.sendPathPayment', () => {
  it('returns error when no keypair configured', async () => {
    const client = new StellarClient('testnet') // no secret key
    const result = await client.sendPathPayment('GDEST', '0.001')
    expect(result.success).toBe(false)
    expect(result.error).toContain('No secret key configured')
  })

  it('returns error when DEX has no XLM→USDC path', async () => {
    const kp = StellarSdk.Keypair.random()
    const client = new StellarClient('testnet', kp.secret())
    ;(client as any).server = {
      strictReceivePaths: vi.fn().mockReturnValue({
        call: vi.fn().mockResolvedValue({ records: [] }),
      }),
    }
    const result = await client.sendPathPayment('GDEST', '0.001')
    expect(result.success).toBe(false)
    expect(result.error).toBe('No XLM→USDC path available on DEX')
  })

  it('submits pathPaymentStrictReceive with 2% slippage buffer', async () => {
    const kp = StellarSdk.Keypair.random()
    const client = new StellarClient('testnet', kp.secret())
    const mockAccount = new StellarSdk.Account(kp.publicKey(), '100')
    const submitMock = vi.fn().mockResolvedValue({ hash: 'abc123', ledger: 42 })
    ;(client as any).server = {
      strictReceivePaths: vi.fn().mockReturnValue({
        call: vi.fn().mockResolvedValue({
          records: [{ source_amount: '1.0000000' }],
        }),
      }),
      loadAccount: vi.fn().mockResolvedValue(mockAccount),
      submitTransaction: submitMock,
    }

    const destKp = StellarSdk.Keypair.random()
    const result = await client.sendPathPayment(destKp.publicKey(), '0.001', 'test-memo')

    expect(result.success).toBe(true)
    expect(result.txHash).toBe('abc123')
    expect(result.ledger).toBe(42)
    const submittedTx = submitMock.mock.calls[0][0] as StellarSdk.Transaction
    const op = submittedTx.operations[0] as StellarSdk.Operation.PathPaymentStrictReceive
    expect(op.type).toBe('pathPaymentStrictReceive')
    expect(parseFloat(op.sendMax)).toBeCloseTo(1.02, 5)
    expect(parseFloat(op.destAmount)).toBeCloseTo(0.001, 7)
  })
})
