/**
 * AgentMarket CLI - Stellar Client
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { WalletInfo } from './types';

const NETWORKS = {
  testnet: {
    networkPassphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanUrl: 'https://soroban-testnet.stellar.org',
  },
  mainnet: {
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    sorobanUrl: 'https://mainnet.stellar.org',
  },
} as const;

// USDC testnet issuer
const USDC_TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_MAINNET_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export class StellarClient {
  private network: 'testnet' | 'mainnet';
  private server: StellarSdk.Horizon.Server;
  private keypair: StellarSdk.Keypair | null = null;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
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
      let usdcBalance = '0';
      const usdcIssuer = this.network === 'testnet' ? USDC_TESTNET_ISSUER : USDC_MAINNET_ISSUER;

      for (const balance of account.balances) {
        if (balance.asset_type === 'native') {
          xlmBalance = balance.balance;
        } else if (
          balance.asset_type !== 'liquidity_pool_shares' &&
          balance.asset_code === 'USDC' &&
          balance.asset_issuer === usdcIssuer
        ) {
          usdcBalance = balance.balance;
        }
      }

      return {
        publicKey: this.keypair.publicKey(),
        network: this.network,
        xlmBalance,
        usdcBalance,
      };
    } catch (error) {
      // Account may not exist yet
      return {
        publicKey: this.keypair.publicKey(),
        network: this.network,
        xlmBalance: '0',
        usdcBalance: '0',
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

  async sendPayment(
    destination: string,
    amount: string,
    memo?: string
  ): Promise<{ txHash: string; success: boolean } | null> {
    if (!this.keypair) return null;

    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());
      const usdcIssuer = this.network === 'testnet' ? USDC_TESTNET_ISSUER : USDC_MAINNET_ISSUER;
      const usdcAsset = new StellarSdk.Asset('USDC', usdcIssuer);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORKS[this.network].networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination,
            asset: usdcAsset,
            amount,
          })
        )
        .setTimeout(30);

      if (memo) {
        transaction.addMemo(StellarSdk.Memo.text(memo.substring(0, 28)));
      }

      const builtTx = transaction.build();
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
