/**
 * Setup USDC Trustline for Testnet
 */

import { StellarClient } from './agentmarket-sdk/dist/index.mjs';

const TEST_SECRET_KEY = process.env.AGENTMARKET_TEST_SECRET_KEY;

async function setupTrustline() {
  if (!TEST_SECRET_KEY) {
    throw new Error('Set AGENTMARKET_TEST_SECRET_KEY before running setup-usdc.mjs');
  }

  console.log('\n🔗 Setting up USDC Trustline on Testnet\n');
  
  const stellar = new StellarClient('testnet', TEST_SECRET_KEY);
  
  console.log(`Public Key: ${stellar.publicKey}`);
  console.log('USDC Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5\n');
  
  console.log('Establishing trustline...');
  const result = await stellar.establishTrustline();
  
  if (result.success) {
    console.log(`✅ Trustline established!`);
    console.log(`TX Hash: ${result.txHash}`);
    console.log(`\n📍 View: https://stellar.expert/explorer/testnet/tx/${result.txHash}`);
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
  
  // Check balance
  console.log('\nChecking balance...');
  const balance = await stellar.getBalance();
  console.log(`XLM: ${balance.xlm}`);
  console.log(`USDC: ${balance.usdc}`);
  
  console.log('\n📝 To get testnet USDC:');
  console.log('1. Use Stellar Laboratory: https://laboratory.stellar.org');
  console.log('2. Or use a testnet USDC faucet');
  console.log('3. Or swap XLM to USDC on testnet DEX');
}

setupTrustline().catch(console.error);
