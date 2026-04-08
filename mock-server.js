/**
 * Mock x402 API Server for Testing
 * Implements the x402 payment protocol
 */

const http = require('http');
const { Horizon } = require('@stellar/stellar-sdk');

const PORT = 3402;
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// API Provider wallet (receives payments)
const PROVIDER_PUBLIC_KEY = 'GC3BIP4AEPKE4XR3BKPYMFPX3T75MQB4QAQEA7XPISUPGQ4P6WRMH6SF';

// Track verified payments (in-memory for demo)
const verifiedPayments = new Set();

// API pricing in USDC
const API_PRICES = {
  '/api/weather': 0.001,
  '/api/news': 0.002,
  '/api/ai': 0.005,
};

// Mock API responses
const MOCK_RESPONSES = {
  '/api/weather': {
    city: 'Mumbai',
    temperature: 32,
    humidity: 78,
    condition: 'Partly Cloudy',
    wind: { speed: 12, direction: 'SW' },
    timestamp: new Date().toISOString(),
  },
  '/api/news': {
    headlines: [
      { title: 'AI Agents Now Using x402 Payments', source: 'TechCrunch' },
      { title: 'Stellar Network Sees Record Adoption', source: 'CoinDesk' },
      { title: 'Micropayments Revolution in APIs', source: 'Wired' },
    ],
    timestamp: new Date().toISOString(),
  },
  '/api/ai': {
    response: 'Hello! I am an AI assistant powered by x402 micropayments.',
    model: 'gpt-4-turbo',
    tokens: 42,
    timestamp: new Date().toISOString(),
  },
};

async function verifyPayment(txHash, expectedAmount) {
  if (verifiedPayments.has(txHash)) {
    return { valid: true, cached: true };
  }

  try {
    const server = new Horizon.Server(HORIZON_URL);
    const operations = await server.operations().forTransaction(txHash).call();

    for (const op of operations.records) {
      if (op.type === 'payment' || op.type === 'path_payment_strict_send') {
        const amount = parseFloat(op.amount);
        if (amount >= expectedAmount) {
          verifiedPayments.add(txHash);
          return { valid: true, amount, recipient: op.to };
        }
      }
    }
    return { valid: false, reason: 'Payment amount insufficient' };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  console.log(`\n📥 ${req.method} ${path}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Payment-Proof, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check if this is an API endpoint
  const price = API_PRICES[path];
  if (!price) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Check for payment proof
  const paymentProof = req.headers['x-payment-proof'];

  if (!paymentProof) {
    // Return 402 Payment Required
    console.log(`   💳 Returning 402 - Payment Required ($${price} USDC)`);
    
    res.writeHead(402, {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
      'X-Payment-Recipient': PROVIDER_PUBLIC_KEY,
      'X-Payment-Amount': price.toString(),
      'X-Payment-Asset': 'USDC',
      'X-Payment-Network': 'stellar:testnet',
      'X-Payment-Memo': `api:${path.replace('/api/', '')}`,
    });
    
    res.end(JSON.stringify({
      error: 'Payment Required',
      payment: {
        recipient: PROVIDER_PUBLIC_KEY,
        amount: price,
        asset: 'USDC',
        network: 'stellar:testnet',
        memo: `api:${path.replace('/api/', '')}`,
      },
    }));
    return;
  }

  // Verify payment
  console.log(`   🔍 Verifying payment: ${paymentProof.slice(0, 16)}...`);
  const verification = await verifyPayment(paymentProof, price);

  if (!verification.valid) {
    console.log(`   ❌ Payment invalid: ${verification.reason}`);
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Payment verification failed',
      reason: verification.reason,
    }));
    return;
  }

  // Payment verified - return data
  console.log(`   ✅ Payment verified! Returning data...`);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    data: MOCK_RESPONSES[path],
    payment: {
      txHash: paymentProof,
      amount: price,
      verified: true,
    },
  }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 x402 Mock API Server running on http://localhost:${PORT}`);
  console.log('\n📡 Available endpoints:');
  console.log('   GET /api/weather  - $0.001 USDC');
  console.log('   GET /api/news     - $0.002 USDC');
  console.log('   GET /api/ai       - $0.005 USDC');
  console.log('\n💰 Provider wallet:', PROVIDER_PUBLIC_KEY);
  console.log('\n⏳ Waiting for requests...\n');
});
