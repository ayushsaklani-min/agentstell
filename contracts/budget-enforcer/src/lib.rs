//! AgentMarket Budget Enforcer Contract
//! 
//! This Soroban smart contract enforces spending limits for AI agents
//! using the AgentMarket protocol. It ensures agents cannot exceed
//! their configured budgets for API calls.
//!
//! ## Features
//! - Per-call spending limits
//! - Per-session (time-based) spending limits  
//! - Per-provider spending limits
//! - Budget top-ups
//! - Emergency pause functionality
//! - On-chain spending audit trail

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, Map, Symbol, Vec, log,
};

/// Error codes for the budget enforcer contract
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BudgetError {
    /// Contract is not initialized
    NotInitialized = 1,
    /// Caller is not authorized
    Unauthorized = 2,
    /// Payment exceeds per-call limit
    ExceedsPerCallLimit = 3,
    /// Payment would exceed session budget
    ExceedsSessionBudget = 4,
    /// Payment would exceed provider limit
    ExceedsProviderLimit = 5,
    /// Insufficient budget remaining
    InsufficientBudget = 6,
    /// Contract is paused
    ContractPaused = 7,
    /// Invalid amount (zero or negative)
    InvalidAmount = 8,
    /// Session has expired
    SessionExpired = 9,
    /// Already initialized
    AlreadyInitialized = 10,
}

/// Budget limits configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BudgetLimits {
    /// Maximum amount per single API call (in stroops, 1 USDC = 10^7 stroops)
    pub max_per_call: i128,
    /// Maximum amount per session
    pub max_per_session: i128,
    /// Maximum amount per provider per session
    pub max_per_provider: i128,
    /// Session duration in seconds (0 = no expiry)
    pub session_duration: u64,
}

/// Current budget status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BudgetStatus {
    /// Total budget allocated
    pub total_budget: i128,
    /// Amount spent in current session
    pub spent_amount: i128,
    /// Remaining budget
    pub remaining: i128,
    /// Number of API calls made
    pub call_count: u32,
    /// Session start timestamp
    pub session_start: u64,
    /// Whether contract is paused
    pub is_paused: bool,
}

/// Payment record for audit trail
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    /// Provider address that received payment
    pub provider: Address,
    /// Amount paid
    pub amount: i128,
    /// Timestamp of payment
    pub timestamp: u64,
    /// API identifier
    pub api_id: Symbol,
}

// Storage keys
const OWNER: Symbol = Symbol::short("OWNER");
const LIMITS: Symbol = Symbol::short("LIMITS");
const STATUS: Symbol = Symbol::short("STATUS");
const PAUSED: Symbol = Symbol::short("PAUSED");
const INIT: Symbol = Symbol::short("INIT");
const PROVIDER_SPENT: Symbol = Symbol::short("PROV_SPT");

#[contract]
pub struct BudgetEnforcerContract;

#[contractimpl]
impl BudgetEnforcerContract {
    /// Initialize the contract with owner and budget limits
    pub fn initialize(
        env: Env,
        owner: Address,
        total_budget: i128,
        limits: BudgetLimits,
    ) -> Result<(), BudgetError> {
        // Check not already initialized
        if env.storage().instance().has(&INIT) {
            return Err(BudgetError::AlreadyInitialized);
        }

        // Require owner authorization
        owner.require_auth();

        // Validate inputs
        if total_budget <= 0 {
            return Err(BudgetError::InvalidAmount);
        }

        // Store owner
        env.storage().instance().set(&OWNER, &owner);

        // Store limits
        env.storage().instance().set(&LIMITS, &limits);

        // Initialize status
        let status = BudgetStatus {
            total_budget,
            spent_amount: 0,
            remaining: total_budget,
            call_count: 0,
            session_start: env.ledger().timestamp(),
            is_paused: false,
        };
        env.storage().instance().set(&STATUS, &status);

        // Mark as initialized
        env.storage().instance().set(&INIT, &true);
        env.storage().instance().set(&PAUSED, &false);

        // Initialize provider spending map
        let provider_spent: Map<Address, i128> = Map::new(&env);
        env.storage().instance().set(&PROVIDER_SPENT, &provider_spent);

        log!(&env, "Budget enforcer initialized with budget: {}", total_budget);

        Ok(())
    }

    /// Authorize a payment if it's within budget limits
    /// Returns true if payment is authorized, error otherwise
    pub fn authorize_payment(
        env: Env,
        caller: Address,
        provider: Address,
        amount: i128,
        api_id: Symbol,
    ) -> Result<bool, BudgetError> {
        // Check initialized
        if !env.storage().instance().has(&INIT) {
            return Err(BudgetError::NotInitialized);
        }

        // Check not paused
        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            return Err(BudgetError::ContractPaused);
        }

        // Require caller auth (the agent wallet)
        caller.require_auth();

        // Validate amount
        if amount <= 0 {
            return Err(BudgetError::InvalidAmount);
        }

        // Get limits and status
        let limits: BudgetLimits = env.storage().instance().get(&LIMITS)
            .ok_or(BudgetError::NotInitialized)?;
        let mut status: BudgetStatus = env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)?;

        // Check session expiry
        if limits.session_duration > 0 {
            let current_time = env.ledger().timestamp();
            if current_time > status.session_start + limits.session_duration {
                return Err(BudgetError::SessionExpired);
            }
        }

        // Check per-call limit
        if amount > limits.max_per_call {
            return Err(BudgetError::ExceedsPerCallLimit);
        }

        // Check session budget
        if status.spent_amount + amount > limits.max_per_session {
            return Err(BudgetError::ExceedsSessionBudget);
        }

        // Check remaining budget
        if amount > status.remaining {
            return Err(BudgetError::InsufficientBudget);
        }

        // Check per-provider limit
        let mut provider_spent: Map<Address, i128> = env.storage().instance()
            .get(&PROVIDER_SPENT)
            .unwrap_or(Map::new(&env));
        
        let current_provider_spent = provider_spent.get(provider.clone()).unwrap_or(0);
        if current_provider_spent + amount > limits.max_per_provider {
            return Err(BudgetError::ExceedsProviderLimit);
        }

        // All checks passed - update state
        status.spent_amount += amount;
        status.remaining -= amount;
        status.call_count += 1;
        env.storage().instance().set(&STATUS, &status);

        // Update provider spending
        provider_spent.set(provider.clone(), current_provider_spent + amount);
        env.storage().instance().set(&PROVIDER_SPENT, &provider_spent);

        log!(&env, "Payment authorized: {} for API {}", amount, api_id);

        Ok(true)
    }

    /// Add funds to the budget
    pub fn add_funds(env: Env, owner: Address, amount: i128) -> Result<(), BudgetError> {
        // Check initialized
        if !env.storage().instance().has(&INIT) {
            return Err(BudgetError::NotInitialized);
        }

        // Verify owner
        let stored_owner: Address = env.storage().instance().get(&OWNER)
            .ok_or(BudgetError::NotInitialized)?;
        if owner != stored_owner {
            return Err(BudgetError::Unauthorized);
        }
        owner.require_auth();

        // Validate amount
        if amount <= 0 {
            return Err(BudgetError::InvalidAmount);
        }

        // Update status
        let mut status: BudgetStatus = env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)?;
        
        status.total_budget += amount;
        status.remaining += amount;
        env.storage().instance().set(&STATUS, &status);

        log!(&env, "Funds added: {}, new total: {}", amount, status.total_budget);

        Ok(())
    }

    /// Update budget limits (owner only)
    pub fn update_limits(
        env: Env,
        owner: Address,
        new_limits: BudgetLimits,
    ) -> Result<(), BudgetError> {
        // Check initialized
        if !env.storage().instance().has(&INIT) {
            return Err(BudgetError::NotInitialized);
        }

        // Verify owner
        let stored_owner: Address = env.storage().instance().get(&OWNER)
            .ok_or(BudgetError::NotInitialized)?;
        if owner != stored_owner {
            return Err(BudgetError::Unauthorized);
        }
        owner.require_auth();

        // Update limits
        env.storage().instance().set(&LIMITS, &new_limits);

        log!(&env, "Budget limits updated");

        Ok(())
    }

    /// Reset session (clears spent amounts, keeps total budget)
    pub fn reset_session(env: Env, owner: Address) -> Result<(), BudgetError> {
        // Check initialized
        if !env.storage().instance().has(&INIT) {
            return Err(BudgetError::NotInitialized);
        }

        // Verify owner
        let stored_owner: Address = env.storage().instance().get(&OWNER)
            .ok_or(BudgetError::NotInitialized)?;
        if owner != stored_owner {
            return Err(BudgetError::Unauthorized);
        }
        owner.require_auth();

        // Reset status
        let mut status: BudgetStatus = env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)?;
        
        status.spent_amount = 0;
        status.remaining = status.total_budget;
        status.call_count = 0;
        status.session_start = env.ledger().timestamp();
        env.storage().instance().set(&STATUS, &status);

        // Reset provider spending
        let provider_spent: Map<Address, i128> = Map::new(&env);
        env.storage().instance().set(&PROVIDER_SPENT, &provider_spent);

        log!(&env, "Session reset");

        Ok(())
    }

    /// Pause the contract (emergency stop)
    pub fn pause(env: Env, owner: Address) -> Result<(), BudgetError> {
        // Verify owner
        let stored_owner: Address = env.storage().instance().get(&OWNER)
            .ok_or(BudgetError::NotInitialized)?;
        if owner != stored_owner {
            return Err(BudgetError::Unauthorized);
        }
        owner.require_auth();

        env.storage().instance().set(&PAUSED, &true);

        let mut status: BudgetStatus = env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)?;
        status.is_paused = true;
        env.storage().instance().set(&STATUS, &status);

        log!(&env, "Contract paused");

        Ok(())
    }

    /// Unpause the contract
    pub fn unpause(env: Env, owner: Address) -> Result<(), BudgetError> {
        // Verify owner
        let stored_owner: Address = env.storage().instance().get(&OWNER)
            .ok_or(BudgetError::NotInitialized)?;
        if owner != stored_owner {
            return Err(BudgetError::Unauthorized);
        }
        owner.require_auth();

        env.storage().instance().set(&PAUSED, &false);

        let mut status: BudgetStatus = env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)?;
        status.is_paused = false;
        env.storage().instance().set(&STATUS, &status);

        log!(&env, "Contract unpaused");

        Ok(())
    }

    /// Get current budget status
    pub fn get_status(env: Env) -> Result<BudgetStatus, BudgetError> {
        env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)
    }

    /// Get current limits
    pub fn get_limits(env: Env) -> Result<BudgetLimits, BudgetError> {
        env.storage().instance().get(&LIMITS)
            .ok_or(BudgetError::NotInitialized)
    }

    /// Get spending for a specific provider
    pub fn get_provider_spent(env: Env, provider: Address) -> i128 {
        let provider_spent: Map<Address, i128> = env.storage().instance()
            .get(&PROVIDER_SPENT)
            .unwrap_or(Map::new(&env));
        provider_spent.get(provider).unwrap_or(0)
    }

    /// Check if a payment would be authorized (dry run)
    pub fn check_payment(
        env: Env,
        provider: Address,
        amount: i128,
    ) -> Result<bool, BudgetError> {
        // Check initialized
        if !env.storage().instance().has(&INIT) {
            return Err(BudgetError::NotInitialized);
        }

        // Check not paused
        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            return Err(BudgetError::ContractPaused);
        }

        // Validate amount
        if amount <= 0 {
            return Err(BudgetError::InvalidAmount);
        }

        // Get limits and status
        let limits: BudgetLimits = env.storage().instance().get(&LIMITS)
            .ok_or(BudgetError::NotInitialized)?;
        let status: BudgetStatus = env.storage().instance().get(&STATUS)
            .ok_or(BudgetError::NotInitialized)?;

        // Check session expiry
        if limits.session_duration > 0 {
            let current_time = env.ledger().timestamp();
            if current_time > status.session_start + limits.session_duration {
                return Err(BudgetError::SessionExpired);
            }
        }

        // Check per-call limit
        if amount > limits.max_per_call {
            return Err(BudgetError::ExceedsPerCallLimit);
        }

        // Check session budget
        if status.spent_amount + amount > limits.max_per_session {
            return Err(BudgetError::ExceedsSessionBudget);
        }

        // Check remaining budget
        if amount > status.remaining {
            return Err(BudgetError::InsufficientBudget);
        }

        // Check per-provider limit
        let provider_spent: Map<Address, i128> = env.storage().instance()
            .get(&PROVIDER_SPENT)
            .unwrap_or(Map::new(&env));
        
        let current_provider_spent = provider_spent.get(provider).unwrap_or(0);
        if current_provider_spent + amount > limits.max_per_provider {
            return Err(BudgetError::ExceedsProviderLimit);
        }

        Ok(true)
    }

    /// Get contract version
    pub fn version() -> u32 {
        1
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(BudgetEnforcerContract, ());
        let client = BudgetEnforcerContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let total_budget = 1_000_000_000i128; // 100 USDC in stroops

        let limits = BudgetLimits {
            max_per_call: 100_000i128,      // 0.01 USDC
            max_per_session: 10_000_000i128, // 1 USDC
            max_per_provider: 5_000_000i128, // 0.5 USDC
            session_duration: 3600,          // 1 hour
        };

        client.initialize(&owner, &total_budget, &limits);

        let status = client.get_status();
        assert_eq!(status.total_budget, total_budget);
        assert_eq!(status.spent_amount, 0);
        assert_eq!(status.remaining, total_budget);
    }

    #[test]
    fn test_authorize_payment() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(BudgetEnforcerContract, ());
        let client = BudgetEnforcerContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let provider = Address::generate(&env);
        let total_budget = 1_000_000_000i128;

        let limits = BudgetLimits {
            max_per_call: 100_000i128,
            max_per_session: 10_000_000i128,
            max_per_provider: 5_000_000i128,
            session_duration: 0, // No expiry for test
        };

        client.initialize(&owner, &total_budget, &limits);

        // Authorize a payment
        let api_id = Symbol::new(&env, "weather");
        let result = client.authorize_payment(&owner, &provider, &10_000i128, &api_id);
        assert!(result);

        // Check updated status
        let status = client.get_status();
        assert_eq!(status.spent_amount, 10_000);
        assert_eq!(status.call_count, 1);
    }

    #[test]
    fn test_exceeds_per_call_limit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(BudgetEnforcerContract, ());
        let client = BudgetEnforcerContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let provider = Address::generate(&env);

        let limits = BudgetLimits {
            max_per_call: 100_000i128,
            max_per_session: 10_000_000i128,
            max_per_provider: 5_000_000i128,
            session_duration: 0,
        };

        client.initialize(&owner, &1_000_000_000i128, &limits);

        // Try to authorize payment exceeding per-call limit
        let api_id = Symbol::new(&env, "weather");
        let result = client.try_authorize_payment(&owner, &provider, &200_000i128, &api_id);
        assert!(result.is_err());
    }
}
