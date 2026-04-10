import { NextRequest, NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';

type NetworkType = 'testnet' | 'mainnet';

const NETWORKS: Record<NetworkType, {
  horizonUrl: string;
  networkPassphrase: string;
  explorerBaseUrl: string;
  usdcIssuer: string;
}> = {
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    explorerBaseUrl: 'https://stellar.expert/explorer/public',
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
};

interface PaymentRequest {
  recipient: string;
  amount: string;
  memo?: string;
  network?: NetworkType;
  currency?: 'USDC' | 'XLM';
}

function getDemoWalletConfig(): { secretKey: string | undefined; network: NetworkType } {
  const configuredNetwork = process.env.DEMO_WALLET_NETWORK?.trim();
  const network = configuredNetwork === 'mainnet' ? 'mainnet' : 'testnet';

  return {
    secretKey: process.env.DEMO_WALLET_SECRET_KEY?.trim() || undefined,
    network,
  };
}

function getUsdcAsset(network: NetworkType) {
  return new StellarSdk.Asset('USDC', NETWORKS[network].usdcIssuer);
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
    const { recipient, amount, memo, network, currency } = body;

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

    if (currency === 'XLM') {
      // XLM → USDC path payment via Stellar DEX
      const pathResult = await server
        .strictReceivePaths(
          [StellarSdk.Asset.native()],
          getUsdcAsset(activeNetwork),
          amount
        )
        .call();

      if (!pathResult.records || pathResult.records.length === 0) {
        return NextResponse.json(
          { error: 'No XLM→USDC conversion path available on Stellar DEX' },
          { status: 500 }
        );
      }

      const xlmNeeded = parseFloat(pathResult.records[0].source_amount);
      const sendMax = (xlmNeeded * 1.02).toFixed(7);
      const account = await server.loadAccount(keypair.publicKey());

      const txBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORKS[activeNetwork].networkPassphrase,
      }).addOperation(
        StellarSdk.Operation.pathPaymentStrictReceive({
          sendAsset: StellarSdk.Asset.native(),
          sendMax,
          destination: recipient,
          destAsset: getUsdcAsset(activeNetwork),
          destAmount: amount,
          path: [],
        })
      );

      if (memo) {
        txBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));
      }

      const transaction = txBuilder.setTimeout(30).build();
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
        xlmSendMax: sendMax,
        proof,
        proofHeader: JSON.stringify(proof),
        explorerUrl: getExplorerUrl(activeNetwork, result.hash),
      });
    }

    // Default: USDC direct payment
    const account = await server.loadAccount(keypair.publicKey());

    const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORKS[activeNetwork].networkPassphrase,
    }).addOperation(
      StellarSdk.Operation.payment({
        destination: recipient,
        asset: getUsdcAsset(activeNetwork),
        amount,
      })
    );

    if (memo) {
      transactionBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));
    }

    const transaction = transactionBuilder
      .setTimeout(30)
      .build();

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
    let usdc = '0';

    for (const balance of account.balances) {
      if (balance.asset_type === 'native') {
        xlm = balance.balance;
      } else if (
        balance.asset_type === 'credit_alphanum4' &&
        balance.asset_code === 'USDC' &&
        balance.asset_issuer === NETWORKS[network].usdcIssuer
      ) {
        usdc = balance.balance;
      }
    }

    return NextResponse.json({
      publicKey,
      network,
      xlm: parseFloat(xlm).toFixed(2),
      usdc: parseFloat(usdc).toFixed(4),
    });
  } catch (error: unknown) {
    console.error('Balance error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get balance' },
      { status: 500 }
    );
  }
}
