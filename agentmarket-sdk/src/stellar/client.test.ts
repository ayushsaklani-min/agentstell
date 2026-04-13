import { describe, expect, it, vi } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { StellarClient } from './client'

describe('StellarClient', () => {
  it('returns error when no keypair configured', async () => {
    const client = new StellarClient('mainnet') // no secret key
    const destKey = StellarSdk.Keypair.random().publicKey()
    await expect(client.sendPayment(destKey, '0.1')).rejects.toThrow('No secret key configured')
  })

  it('sends native XLM payment', async () => {
    const kp = StellarSdk.Keypair.random()
    const client = new StellarClient('mainnet', kp.secret())
    const mockAccount = new StellarSdk.Account(kp.publicKey(), '100')
    const submitMock = vi.fn().mockResolvedValue({ hash: 'abc123', ledger: 42 })
    ;(client as any).server = {
      loadAccount: vi.fn().mockResolvedValue(mockAccount),
      submitTransaction: submitMock,
    }

    const destKp = StellarSdk.Keypair.random()
    const result = await client.sendPayment(destKp.publicKey(), '0.1', 'test-memo')

    expect(result.success).toBe(true)
    expect(result.txHash).toBe('abc123')
    expect(result.ledger).toBe(42)
    const submittedTx = submitMock.mock.calls[0][0] as StellarSdk.Transaction
    const op = submittedTx.operations[0] as StellarSdk.Operation.Payment
    expect(op.type).toBe('payment')
    expect(op.asset.isNative()).toBe(true)
    expect(op.amount).toBe('0.1000000')
  })

  it('verifies native XLM payment', async () => {
    const client = new StellarClient('mainnet')
    const recipient = StellarSdk.Keypair.random().publicKey()
    ;(client as any).server = {
      operations: vi.fn().mockReturnValue({
        forTransaction: vi.fn().mockReturnValue({
          call: vi.fn().mockResolvedValue({
            records: [
              {
                type: 'payment',
                to: recipient,
                asset_type: 'native',
                amount: '0.1000000',
              },
            ],
          }),
        }),
      }),
    }

    const result = await client.verifyPayment('tx_hash', recipient, '0.1')
    expect(result).toBe(true)
  })
})
