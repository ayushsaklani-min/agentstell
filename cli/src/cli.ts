#!/usr/bin/env node

/**
 * AgentMarket CLI
 * 
 * Command-line interface for interacting with the AgentMarket API marketplace
 * using x402 micropayments on Stellar.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as dotenv from 'dotenv';

import { loadConfig, saveConfig, getConfigPath, loadHistory } from './config';
import { StellarClient } from './stellar';
import { listApis, getApiInfo, callApi } from './api';

dotenv.config();

const program = new Command();

// ASCII banner
const banner = `
   _                    _   __  __            _        _   
  / \\   __ _  ___ _ __ | |_|  \\/  | __ _ _ __| | _____| |_ 
 / _ \\ / _\` |/ _ \\ '_ \\| __| |\\/| |/ _\` | '__| |/ / _ \\ __|
/ ___ \\ (_| |  __/ | | | |_| |  | | (_| | |  |   <  __/ |_ 
/_/   \\_\\__, |\\___|_| |_|\\__|_|  |_|\\__,_|_|  |_|\\_\\___|\\__|
       |___/                                                
`;

program
  .name('agentmarket')
  .description('AgentMarket CLI - Payment IS Authentication')
  .version('0.1.0')
  .addHelpText('beforeAll', chalk.cyan(banner));

// ========== INIT COMMAND ==========
program
  .command('init')
  .description('Initialize AgentMarket CLI with your wallet')
  .option('-k, --key <secret>', 'Stellar secret key')
  .option('-n, --network <network>', 'Stellar network (testnet/mainnet)', 'testnet')
  .option('--generate', 'Generate a new Stellar keypair')
  .action(async (options) => {
    console.log(chalk.cyan(banner));
    console.log(chalk.bold('\nAgentMarket CLI Setup\n'));

    let secretKey = options.key;
    const network = options.network as 'testnet' | 'mainnet';

    const stellarClient = new StellarClient(network);

    if (options.generate) {
      const spinner = ora('Generating new Stellar keypair...').start();
      const keypair = stellarClient.generateKeypair();
      spinner.succeed('Keypair generated!');
      
      console.log('\n' + chalk.yellow('SAVE THIS INFORMATION SECURELY:\n'));
      console.log(chalk.bold('Public Key:  ') + chalk.green(keypair.publicKey));
      console.log(chalk.bold('Secret Key:  ') + chalk.red(keypair.secretKey));
      console.log('\n' + chalk.dim('Never share your secret key with anyone!'));

      secretKey = keypair.secretKey;
    }

    if (!secretKey) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'secretKey',
          message: 'Enter your Stellar secret key (starts with S):',
          validate: (input: string) => 
            input.startsWith('S') && input.length === 56 
              ? true 
              : 'Invalid secret key format',
        },
      ]);
      secretKey = answers.secretKey;
    }

    // Validate and save
    try {
      stellarClient.setSecretKey(secretKey);
      const publicKey = stellarClient.getPublicKey();

      if (!publicKey) {
        console.log(chalk.red('Invalid secret key'));
        process.exit(1);
      }

      saveConfig({
        secretKey,
        publicKey,
        stellarNetwork: network,
      });

      console.log(chalk.green('\nConfiguration saved.'));
      console.log(chalk.dim(`  Config file: ${getConfigPath()}`));
      console.log(chalk.bold(`  Public Key:  `) + publicKey);
      console.log(chalk.bold(`  Network:     `) + network);

      // Check balance
      const spinner = ora('Checking wallet balance...').start();
      const wallet = await stellarClient.getWalletInfo();
      
      if (wallet) {
        spinner.succeed('Wallet connected!');
        console.log(chalk.bold(`  XLM Balance: `) + wallet.xlmBalance + ' XLM');
        console.log(chalk.bold(`  USDC Balance:`) + wallet.usdcBalance + ' USDC');

        if (parseFloat(wallet.xlmBalance) === 0 && network === 'testnet') {
          console.log(chalk.yellow('\nAccount not funded. Run: agentmarket fund'));
        }
      } else {
        spinner.warn('Account not found on network');
        if (network === 'testnet') {
          console.log(chalk.yellow('Run: agentmarket fund'));
        }
      }

    } catch (error) {
      console.log(chalk.red('Failed to initialize: ' + (error instanceof Error ? error.message : 'Unknown error')));
      process.exit(1);
    }
  });

// ========== FUND COMMAND ==========
program
  .command('fund')
  .description('Fund testnet account using Friendbot')
  .action(async () => {
    const config = loadConfig();
    
    if (!config.secretKey) {
      console.log(chalk.red('Not initialized. Run: agentmarket init'));
      process.exit(1);
    }

    if (config.stellarNetwork !== 'testnet') {
      console.log(chalk.red('Fund command only works on testnet'));
      process.exit(1);
    }

    const stellarClient = new StellarClient(config.stellarNetwork);
    stellarClient.setSecretKey(config.secretKey);

    const spinner = ora('Requesting testnet funds from Friendbot...').start();
    const result = await stellarClient.fundTestnetAccount();

    if (result) {
      spinner.succeed('Account funded!');
      
      const wallet = await stellarClient.getWalletInfo();
      if (wallet) {
        console.log(chalk.bold(`  XLM Balance: `) + wallet.xlmBalance + ' XLM');
      }
      
      console.log(chalk.yellow('\nNote: You also need testnet USDC to make API calls.'));
      console.log(chalk.dim('  Get testnet USDC from: https://laboratory.stellar.org'));
    } else {
      spinner.fail('Failed to fund account');
    }
  });

// ========== BALANCE COMMAND ==========
program
  .command('balance')
  .alias('bal')
  .description('Check wallet balance')
  .action(async () => {
    const config = loadConfig();
    
    if (!config.secretKey) {
      console.log(chalk.red('Not initialized. Run: agentmarket init'));
      process.exit(1);
    }

    const stellarClient = new StellarClient(config.stellarNetwork);
    stellarClient.setSecretKey(config.secretKey);

    const spinner = ora('Fetching balance...').start();
    const wallet = await stellarClient.getWalletInfo();

    if (wallet) {
      spinner.succeed('Balance retrieved');
      console.log('');
      console.log(chalk.bold('  Network:     ') + wallet.network);
      console.log(chalk.bold('  Address:     ') + wallet.publicKey);
      console.log(chalk.bold('  XLM:         ') + chalk.cyan(wallet.xlmBalance + ' XLM'));
      console.log(chalk.bold('  USDC:        ') + chalk.green(wallet.usdcBalance + ' USDC'));
    } else {
      spinner.fail('Failed to fetch balance');
    }
  });

// ========== LIST COMMAND ==========
program
  .command('list')
  .alias('ls')
  .description('List available APIs')
  .option('-c, --category <category>', 'Filter by category (Data, Finance, Geo, AI)')
  .action((options) => {
    const apis = listApis(options.category);

    console.log(chalk.bold('\nAvailable APIs\n'));
    console.log(chalk.dim('─'.repeat(70)));

    if (apis.length === 0) {
      console.log(chalk.yellow('  No APIs found'));
      return;
    }

    // Group by category
    const categories = new Map<string, typeof apis>();
    for (const api of apis) {
      const cat = api.category;
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat)!.push(api);
    }

    for (const [category, categoryApis] of categories) {
      console.log(chalk.bold.blue(`\n  ${category}`));
      
      for (const api of categoryApis) {
        const price = chalk.green(`$${api.priceUsdc.toFixed(4)}`);
        console.log(`    ${chalk.bold(api.slug.padEnd(15))} ${price.padEnd(15)} ${chalk.dim(api.description)}`);
      }
    }

    console.log(chalk.dim('\n─'.repeat(70)));
    console.log(chalk.dim(`  ${apis.length} APIs available | Prices in USDC per call\n`));
  });

// ========== CALL COMMAND ==========
program
  .command('call <api>')
  .description('Call an API with x402 payment')
  .option('-p, --params <json>', 'Parameters as JSON string')
  .option('--city <city>', 'City name (for weather/air-quality)')
  .option('--topic <topic>', 'Topic (for news)')
  .option('--from <currency>', 'Source currency (for currency)')
  .option('--to <currency>', 'Target currency (for currency)')
  .option('--amount <amount>', 'Amount to convert (for currency)')
  .option('--ip <ip>', 'IP address (for geolocation)')
  .option('--prompt <prompt>', 'Prompt (for ai)')
  .option('--dry-run', 'Show what would be called without making payment')
  .action(async (apiSlug, options) => {
    const config = loadConfig();
    
    if (!config.secretKey) {
      console.log(chalk.red('Not initialized. Run: agentmarket init'));
      process.exit(1);
    }

    const api = getApiInfo(apiSlug);
    if (!api) {
      console.log(chalk.red(`Unknown API: ${apiSlug}`));
      console.log(chalk.dim('  Run: agentmarket list'));
      process.exit(1);
    }

    // Build params
    let params: Record<string, unknown> = {};
    
    if (options.params) {
      try {
        params = JSON.parse(options.params);
      } catch {
        console.log(chalk.red('Invalid JSON params'));
        process.exit(1);
      }
    } else {
      // Use convenience options
      if (options.city) params.city = options.city;
      if (options.topic) params.topic = options.topic;
      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;
      if (options.amount) params.amount = parseFloat(options.amount);
      if (options.ip) params.ip = options.ip;
      if (options.prompt) params.prompt = options.prompt;
    }

    console.log(chalk.bold(`\nCalling ${api.name} API\n`));
    console.log(chalk.dim(`  Endpoint: ${api.endpoint}`));
    console.log(chalk.dim(`  Price:    ${api.priceUsdc} USDC`));
    console.log(chalk.dim(`  Params:   ${JSON.stringify(params)}`));

    if (options.dryRun) {
      console.log(chalk.yellow('\n  [DRY RUN] No payment made'));
      return;
    }

    const stellarClient = new StellarClient(config.stellarNetwork);
    stellarClient.setSecretKey(config.secretKey);

    const spinner = ora('Making payment and calling API...').start();
    const result = await callApi(apiSlug, params, stellarClient);

    if (result.success) {
      spinner.succeed('API call successful!');
      
      if (result.txHash) {
        console.log(chalk.dim(`  Transaction: ${result.txHash}`));
        const explorerUrl = config.stellarNetwork === 'testnet'
          ? `https://stellar.expert/explorer/testnet/tx/${result.txHash}`
          : `https://stellar.expert/explorer/public/tx/${result.txHash}`;
        console.log(chalk.dim(`  Explorer:    ${explorerUrl}`));
      }
      if (result.amountPaid) {
        console.log(chalk.dim(`  Paid:        ${result.amountPaid} USDC`));
      }
      if (result.latencyMs) {
        console.log(chalk.dim(`  Latency:     ${result.latencyMs}ms`));
      }
      
      console.log(chalk.bold('\nResponse:\n'));
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      spinner.fail('API call failed');
      console.log(chalk.red(`  Error: ${result.error}`));
      
      if (result.txHash) {
        console.log(chalk.yellow(`  Note: Payment was made (${result.txHash})`));
      }
    }
  });

// ========== HISTORY COMMAND ==========
program
  .command('history')
  .alias('hist')
  .description('Show call history')
  .option('-n, --limit <number>', 'Number of entries to show', '20')
  .action((options) => {
    const history = loadHistory();
    const limit = parseInt(options.limit, 10);
    const recent = history.calls.slice(-limit).reverse();

    console.log(chalk.bold('\nCall History\n'));

    if (recent.length === 0) {
      console.log(chalk.dim('  No calls made yet'));
      return;
    }

    console.log(chalk.dim('  ' + 'Time'.padEnd(20) + 'API'.padEnd(15) + 'Amount'.padEnd(12) + 'Transaction'));
    console.log(chalk.dim('  ' + '─'.repeat(70)));

    for (const call of recent) {
      const time = new Date(call.timestamp).toLocaleString();
      const amount = chalk.green(`$${call.amount.toFixed(4)}`);
      const txShort = call.txHash.substring(0, 16) + '...';
      console.log(`  ${time.padEnd(20)} ${call.api.padEnd(15)} ${amount.padEnd(12)} ${chalk.dim(txShort)}`);
    }

    // Summary
    const totalSpent = history.calls.reduce((sum, c) => sum + c.amount, 0);
    console.log(chalk.dim('  ' + '─'.repeat(70)));
    console.log(chalk.bold(`  Total: ${history.calls.length} calls, ${chalk.green('$' + totalSpent.toFixed(4))} USDC spent`));
  });

// ========== CONFIG COMMAND ==========
program
  .command('config')
  .description('View or update configuration')
  .option('--show', 'Show current config')
  .option('--network <network>', 'Set network (testnet/mainnet)')
  .option('--budget <amount>', 'Set budget limit (USDC)')
  .option('--marketplace <url>', 'Set marketplace URL')
  .action((options) => {
    const config = loadConfig();

    if (options.show || Object.keys(options).length === 1) {
      console.log(chalk.bold('\nConfiguration\n'));
      console.log(chalk.dim(`  Config file: ${getConfigPath()}`));
      console.log('');
      console.log(chalk.bold('  Network:     ') + config.stellarNetwork);
      console.log(chalk.bold('  Budget:      ') + config.budgetLimit + ' USDC');
      console.log(chalk.bold('  Marketplace: ') + config.marketplaceUrl);
      console.log(chalk.bold('  Public Key:  ') + (config.publicKey || 'Not set'));
      console.log(chalk.bold('  Secret Key:  ') + (config.secretKey ? '••••••••••••' : 'Not set'));
      return;
    }

    const updates: Record<string, unknown> = {};
    
    if (options.network) {
      if (!['testnet', 'mainnet'].includes(options.network)) {
        console.log(chalk.red('Invalid network. Use testnet or mainnet'));
        process.exit(1);
      }
      updates.stellarNetwork = options.network;
    }
    
    if (options.budget) {
      updates.budgetLimit = parseFloat(options.budget);
    }
    
    if (options.marketplace) {
      updates.marketplaceUrl = options.marketplace;
    }

    saveConfig(updates);
    console.log(chalk.green('Configuration updated.'));
  });

// ========== INFO COMMAND ==========
program
  .command('info <api>')
  .description('Get detailed information about an API')
  .action((apiSlug) => {
    const api = getApiInfo(apiSlug);
    
    if (!api) {
      console.log(chalk.red(`Unknown API: ${apiSlug}`));
      console.log(chalk.dim('  Run: agentmarket list'));
      process.exit(1);
    }

    console.log(chalk.bold(`\n${api.name}\n`));
    console.log(chalk.dim('─'.repeat(50)));
    console.log('');
    console.log(chalk.bold('  Slug:        ') + api.slug);
    console.log(chalk.bold('  Description: ') + api.description);
    console.log(chalk.bold('  Category:    ') + api.category);
    console.log(chalk.bold('  Price:       ') + chalk.green(`$${api.priceUsdc.toFixed(4)} USDC`));
    console.log(chalk.bold('  Provider:    ') + api.provider);
    console.log(chalk.bold('  Endpoint:    ') + api.endpoint);

    // Example usage
    console.log(chalk.bold('\n  Example:\n'));
    
    switch (api.slug) {
      case 'weather':
        console.log(chalk.cyan('    agentmarket call weather --city "New York"'));
        break;
      case 'air-quality':
        console.log(chalk.cyan('    agentmarket call air-quality --city "Delhi"'));
        break;
      case 'news':
        console.log(chalk.cyan('    agentmarket call news --topic "technology"'));
        break;
      case 'currency':
        console.log(chalk.cyan('    agentmarket call currency --from USD --to EUR --amount 100'));
        break;
      case 'geolocation':
        console.log(chalk.cyan('    agentmarket call geolocation --ip "8.8.8.8"'));
        break;
      case 'ai':
        console.log(chalk.cyan('    agentmarket call ai --prompt "Explain quantum computing"'));
        break;
      default:
        console.log(chalk.cyan(`    agentmarket call ${api.slug} -p '{"key": "value"}'`));
    }
  });

// Parse and run
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan(banner));
  program.outputHelp();
}
