import { NextRequest, NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';

type NetworkType = 'testnet' | 'mainnet';

const NETWORKS: Record<NetworkType, {
  horizonUrl: string;
  networkPassphrase: string;
  explorerBaseUrl: string;
}> = {
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
  },
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    explorerBaseUrl: 'https://stellar.expert/explorer/public',
  },
};

interface PaymentRequest {
  recipient: string;
  amount: string;
  memo?: string;
  network?: NetworkType;
}

function getDemoWalletConfig(): { secretKey: string | undefined; network: NetworkType } {
  const configuredNetwork = process.env.DEMO_WALLET_NETWORK?.trim();
  const network: NetworkType = configuredNetwork === 'testnet' ? 'testnet' : 'mainnet';

  return {
    secretKey: process.env.DEMO_WALLET_SECRET_KEY?.trim() || undefined,
    network,
  };
}

function getExplorerUrl(network: NetworkType, txHash: string) {
  return `${NETWORKS[network].explorerBaseUrl}/tx/${txHash}`;
}

function missingSecretResponse() {
  return NextResponse.json(
    { error: 'Missing DEMO_WALLET_SECRET_KEY for web demo payments' },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  const { secretKey, network: configuredNetwork } = getDemoWalletConfig();

  if (!secretKey) {
    return missingSecretResponse();
  }

  try {
    const body: PaymentRequest = await request.json();
    const { recipient, amount, memo, network } = body;

    if (!recipient || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: recipient, amount' },
        { status: 400 }
      );
    }

    if (network && network !== configuredNetwork) {
      return NextResponse.json(
        { error: `Demo wallet is configured for ${configuredNetwork}, not ${network}` },
        { status: 400 }
      );
    }

    const activeNetwork = configuredNetwork;
    const server = new StellarSdk.Horizon.Server(NETWORKS[activeNetwork].horizonUrl);
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);

    // Native XLM payment — no trustline, no issuer
    const account = await server.loadAccount(keypair.publicKey());

    const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORKS[activeNetwork].networkPassphrase,
    }).addOperation(
      StellarSdk.Operation.payment({
        destination: recipient,
        asset: StellarSdk.Asset.native(),
        amount,
      })
    );

    if (memo) {
      transactionBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));
    }

    const transaction = transactionBuilder.setTimeout(30).build();
    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction);

    const proof = {
      txHash: result.hash,
      network: activeNetwork,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      txHash: result.hash,
      ledger: result.ledger,
      amount,
      recipient,
      network: activeNetwork,
      currency: 'XLM',
      proof,
      proofHeader: JSON.stringify(proof),
      explorerUrl: getExplorerUrl(activeNetwork, result.hash),
    });
  } catch (error: unknown) {
    console.error('Payment error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Payment failed';
    const errorDetails = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: { extras?: { result_codes?: unknown } } } }).response?.data?.extras?.result_codes
      : undefined;

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { secretKey, network } = getDemoWalletConfig();

  if (!secretKey) {
    return missingSecretResponse();
  }

  try {
    const server = new StellarSdk.Horizon.Server(NETWORKS[network].horizonUrl);
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    const account = await server.loadAccount(publicKey);

    let xlm = '0';

    for (const balance of account.balances) {
      if (balance.asset_type === 'native') {
        xlm = balance.balance;
      }
    }

    return NextResponse.json({
      publicKey,
      network,
      xlm: parseFloat(xlm).toFixed(4),
      usdc: '0.0000',
    });
  } catch (error: unknown) {
    console.error('Balance error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get balance' },
      { status: 500 }
    );
  }
}
