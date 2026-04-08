/**
 * Swap XLM to USDC on Stellar Testnet DEX
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const TEST_SECRET_KEY = process.env.AGENTMARKET_TEST_SECRET_KEY;
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

// USDC on testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

async function swapXlmToUsdc() {
  if (!TEST_SECRET_KEY) {
    throw new Error('Set AGENTMARKET_TEST_SECRET_KEY before running swap-xlm-usdc.mjs');
  }

  console.log('\n💱 Swapping XLM to USDC on Testnet DEX\n');
  
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);
  const keypair = StellarSdk.Keypair.fromSecret(TEST_SECRET_KEY);
  
  console.log(`Account: ${keypair.publicKey()}`);
  
  // Load account
  const account = await server.loadAccount(keypair.publicKey());
  
  // Create path payment operation (swap XLM for USDC)
  // We'll send 100 XLM and accept minimum 1 USDC (market rate will apply)
  const usdcAsset = new StellarSdk.Asset('USDC', USDC_ISSUER);
  
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: StellarSdk.Asset.native(),
      sendAmount: '100', // Send 100 XLM
      destination: keypair.publicKey(),
      destAsset: usdcAsset,
      destMin: '0.01', // Accept at least 0.01 USDC
    }))
    .setTimeout(30)
    .build();
  
  tx.sign(keypair);
  
  console.log('Submitting swap transaction...');
  
  try {
    const result = await server.submitTransaction(tx);
    console.log(`✅ Swap successful!`);
    console.log(`TX Hash: ${result.hash}`);
    console.log(`\n📍 View: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    
    // Check new balance
    const updatedAccount = await server.loadAccount(keypair.publicKey());
    for (const balance of updatedAccount.balances) {
      if (balance.asset_type === 'native') {
        console.log(`\nXLM: ${balance.balance}`);
      } else if (balance.asset_type === 'credit_alphanum4' && balance.asset_code === 'USDC') {
        console.log(`USDC: ${balance.balance}`);
      }
    }
  } catch (error) {
    console.log(`❌ Swap failed: ${error.message}`);
    if (error.response?.data?.extras?.result_codes) {
      console.log('Result codes:', error.response.data.extras.result_codes);
    }
    console.log('\n💡 No liquidity on testnet DEX. Try these alternatives:');
    console.log('1. Stellar Laboratory: https://laboratory.stellar.org');
    console.log('2. Ask in Stellar Discord for testnet USDC');
    console.log('3. Create your own test USDC issuer');
  }
}

swapXlmToUsdc().catch(console.error);
