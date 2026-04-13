/**
 * AgentMarket CLI - Stellar Client
 * Native XLM payments only
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { WalletInfo } from './types';

const NETWORKS = {
  testnet: {
    networkPassphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  mainnet: {
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
  },
} as const;

export class StellarClient {
  private network: 'testnet' | 'mainnet';
  private server: StellarSdk.Horizon.Server;
  private keypair: StellarSdk.Keypair | null = null;

  constructor(network: 'testnet' | 'mainnet' = 'mainnet') {
    this.network = network;
    const config = NETWORKS[network];
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
  }

  setSecretKey(secretKey: string): void {
    this.keypair = StellarSdk.Keypair.fromSecret(secretKey);
  }

  getPublicKey(): string | null {
    return this.keypair?.publicKey() || null;
  }

  async getWalletInfo(): Promise<WalletInfo | null> {
    if (!this.keypair) return null;

    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());

      let xlmBalance = '0';

      for (const balance of account.balances) {
        if (balance.asset_type === 'native') {
          xlmBalance = balance.balance;
        }
      }

      return {
        publicKey: this.keypair.publicKey(),
        network: this.network,
        xlmBalance,
      };
    } catch (error) {
      // Account may not exist yet
      return {
        publicKey: this.keypair.publicKey(),
        network: this.network,
        xlmBalance: '0',
      };
    }
  }

  async fundTestnetAccount(): Promise<string | null> {
    if (!this.keypair || this.network !== 'testnet') return null;

    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${this.keypair.publicKey()}`
      );
      if (response.ok) {
        return this.keypair.publicKey();
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /** Send native XLM payment */
  async sendPayment(
    destination: string,
    amount: string,
    memo?: string
  ): Promise<{ txHash: string; success: boolean } | null> {
    if (!this.keypair) return null;

    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());

      const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORKS[this.network].networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination,
            asset: StellarSdk.Asset.native(),
            amount,
          })
        )
        .setTimeout(30);

      if (memo) {
        transactionBuilder.addMemo(StellarSdk.Memo.text(memo.substring(0, 28)));
      }

      const builtTx = transactionBuilder.build();
      builtTx.sign(this.keypair);

      const result = await this.server.submitTransaction(builtTx);
      return {
        txHash: result.hash,
        success: true,
      };
    } catch (error) {
      console.error('Payment failed:', error);
      return null;
    }
  }

  async verifyTransaction(txHash: string): Promise<boolean> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();
      return tx.successful;
    } catch {
      return false;
    }
  }

  generateKeypair(): { publicKey: string; secretKey: string } {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }
}
