# AgentMarket - Full Implementation Plan

## Problem Statement
Build a production-grade API marketplace where AI agents can autonomously purchase API access using x402 micropayments on Stellar. Payment IS authentication - no accounts, no API keys, no subscriptions. The system must handle provider registration, marketplace browsing, SDK-based consumption, on-chain budget enforcement, and live payment demonstration.

## Approach
We'll build three interconnected systems: (1) Marketplace web app for browsing and provider onboarding, (2) SDK for agent/developer consumption with x402 payment flow, (3) Payment infrastructure using Stellar Testnet with Soroban smart contracts for budget enforcement. The architecture prioritizes real-time demo capability with live transaction feeds while maintaining production-grade code quality.

---

## Tech Stack (Best-in-Class Selection)

### Frontend
- **Next.js 14** (App Router) - SEO, SSR, API routes, fast refresh
- **React 18** - Component library
- **TypeScript** - Type safety
- **Tailwind CSS** - Rapid styling
- **shadcn/ui** - Production-quality components
- **Framer Motion** - Smooth animations for demo

### Backend & API Proxy
- **Next.js API Routes** - Serverless functions for API proxying
- **Node.js 20+** - Runtime
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Production database (or Supabase for faster setup)

### SDK
- **TypeScript** - Core SDK language
- **Viem** - Modern web3 library (if needed)
- **x402-stellar** npm package - Official x402 implementation
- **@stellar/stellar-sdk** - Stellar operations

### Blockchain
- **Stellar Testnet** - Payment layer
- **Soroban Smart Contracts** - Budget enforcement (Rust)
- **x402 Protocol** - HTTP 402 payment flow
- **Freighter Wallet** - Browser wallet integration
- **Stellar Laboratory** - Testing tool

### DevOps
- **Vercel** - Frontend + API hosting
- **GitHub Actions** - CI/CD
- **Supabase** - Database + real-time subscriptions (optional)
- **npm** - Package registry for SDK

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTMARKET ECOSYSTEM                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │  Marketplace Web  │────────▶│  PostgreSQL Database   │   │
│  │   (Next.js 14)    │         │   (API listings,       │   │
│  │                   │         │    providers, stats)   │   │
│  └──────────────────┘         └────────────────────────┘   │
│           │                                                  │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │   API Proxy       │────────▶│  External APIs         │   │
│  │  (Next.js API     │         │  (OpenWeather, News,   │   │
│  │   Routes)         │         │   AirVisual, etc.)     │   │
│  └──────────────────┘         └────────────────────────┘   │
│           ▲                                                  │
│           │                                                  │
│           │                                                  │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │  agentmarket-sdk  │────────▶│   Stellar Testnet      │   │
│  │   (npm package)   │         │   (x402 payments)      │   │
│  │                   │         │                         │   │
│  └──────────────────┘         └────────────────────────┘   │
│           │                              │                   │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │   AI Agent /      │────────▶│  Soroban Contract      │   │
│  │   Developer       │         │  (Budget enforcer)     │   │
│  └──────────────────┘         └────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation & Infrastructure

### 1.1 Project Setup
- Initialize monorepo structure (turborepo or npm workspaces)
- Setup Next.js 14 app with TypeScript
- Configure Tailwind CSS + shadcn/ui
- Setup Prisma with PostgreSQL
- Configure ESLint, Prettier
- Initialize Git with proper .gitignore
- Setup environment variables management

### 1.2 Database Schema Design
```prisma
model ApiListing {
  id            String   @id @default(cuid())
  name          String   @unique
  slug          String   @unique
  description   String
  category      String
  priceUsdc     Decimal  @db.Decimal(10, 6)
  endpoint      String
  provider      Provider @relation(fields: [providerId], references: [id])
  providerId    String
  totalCalls    Int      @default(0)
  isActive      Boolean  @default(true)
  isProxied     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  calls         ApiCall[]
}

model Provider {
  id              String       @id @default(cuid())
  name            String
  stellarAddress  String       @unique
  email           String?
  apiListings     ApiListing[]
  totalEarnings   Decimal      @db.Decimal(10, 2) @default(0)
  createdAt       DateTime     @default(now())
}

model ApiCall {
  id            String     @id @default(cuid())
  apiListing    ApiListing @relation(fields: [apiListingId], references: [id])
  apiListingId  String
  caller        String
  txHash        String
  amountUsdc    Decimal    @db.Decimal(10, 6)
  success       Boolean
  createdAt     DateTime   @default(now())
}
```

### 1.3 Stellar Development Environment
- Setup Stellar testnet accounts (marketplace, test provider, test agent)
- Configure Freighter wallet for testing
- Setup Stellar SDK integration
- Test basic USDC transactions on testnet
- Document wallet addresses and test USDC funding

---

## Phase 2: Soroban Smart Contract Development

### 2.1 Budget Enforcer Contract (Rust)
```rust
// Contract Features:
// - Set spending limits per session, per call, per provider
// - Authorize payments only within budget
// - Track cumulative spending
// - Emit events for monitoring
// - Allow budget top-ups
// - Emergency pause functionality
```

### 2.2 Contract Functions
- `initialize(owner, limits)`
- `authorize_payment(amount, provider, api_id)`
- `check_budget(caller)`
- `update_limits(new_limits)`
- `add_funds(amount)`
- `get_spending_stats()`
- `pause()` / `unpause()`

### 2.3 Contract Testing
- Unit tests for all budget scenarios
- Integration tests with Stellar testnet
- Edge cases: overflow, zero amounts, unauthorized callers
- Gas optimization
- Security audit checklist

### 2.4 Contract Deployment
- Deploy to Stellar testnet
- Verify contract on Stellar Laboratory
- Generate contract bindings for TypeScript
- Document contract address and invocation patterns

---

## Phase 3: Core SDK Development

### 3.1 SDK Architecture (`agentmarket-sdk`)
```typescript
// packages/sdk/src/index.ts
export class AgentMarketSDK {
  private wallet: StellarWallet
  private registry: ApiRegistry
  private budgetContract: BudgetEnforcer
  private x402Client: X402Client

  constructor(config: SDKConfig)
  async initialize()
  async get(apiName: string, params: object): Promise<any>
  async listApis(category?: string): Promise<ApiListing[]>
  async getBudgetStatus(): Promise<BudgetStatus>
  async topUpBudget(amount: number)
}
```

### 3.2 SDK Features
- **Wallet Integration**: Connect Freighter, Albedo, or xBull wallet
- **Registry Discovery**: Fetch available APIs from marketplace
- **x402 Payment Flow**: 
  1. Request resource
  2. Receive 402 + payment details
  3. Sign & submit Stellar transaction
  4. Retry request with payment proof
  5. Return data
- **Budget Checks**: Query Soroban contract before each payment
- **Automatic Retries**: Handle network failures gracefully
- **TypeScript Types**: Full type definitions for all APIs
- **Logging**: Structured logs for debugging
- **Error Handling**: Clear error messages for common issues

### 3.3 SDK Testing
- Unit tests for all SDK methods
- Integration tests with live testnet
- Mock mode for CI/CD
- Performance benchmarks (< 1 second per call target)
- Browser and Node.js compatibility tests

### 3.4 SDK Documentation
- README with quick start
- API reference documentation
- Code examples for each proxied API
- Troubleshooting guide
- Migration guide from direct API usage

### 3.5 SDK Publishing
- Configure npm package.json
- Setup GitHub Actions for automated publishing
- Version with semantic versioning
- Generate changelog
- Publish to npm registry

---

## Phase 4: Marketplace Web Application

### 4.1 Pages & Routes
```
/                    - Homepage with hero + value prop
/marketplace         - Browse all APIs by category
/api/[slug]          - Individual API detail page
/providers/register  - Provider onboarding form
/providers/dashboard - Provider earnings & stats
/demo                - Live 3-panel demo
/docs                - SDK documentation
/about               - About the project
```

### 4.2 Homepage Components
- Hero section with tagline: "Payment IS Authentication"
- Value proposition: 3-column features
- Live stats: Total calls, Total APIs, Total USDC transacted
- CTA: "Try the Demo" + "Browse APIs"
- Testimonial section (optional)
- Footer with links

### 4.3 Marketplace Page
- Category filters (Data, Finance, Geo, AI, Utilities)
- Search bar
- API cards showing:
  - API name & icon
  - Description (1 line)
  - Price in USDC
  - Total calls
  - Provider name
  - "View Details" button
- Sort by: Price, Popularity, Recent
- Real-time updates when new APIs are added

### 4.4 API Detail Page
- API name and description
- Category badge
- Price per call (large, prominent)
- Provider information
- Total calls made
- Code example using SDK
- "Try it now" interactive tester
- Payment required: Connect wallet first
- Sample request/response
- Related APIs

### 4.5 Provider Registration
- Form fields:
  - Provider name
  - Email (optional)
  - Stellar address (auto-filled from wallet)
  - API name
  - API endpoint URL
  - Description
  - Category selection
  - Price per call (USDC)
- Validation:
  - Test endpoint before approval
  - Verify Stellar address
- Submit creates pending listing
- Admin approval workflow (manual for now)

### 4.6 Provider Dashboard
- Total earnings (USDC)
- Total calls across all APIs
- API performance table:
  - API name
  - Calls today
  - Revenue today
  - Total calls
  - Total revenue
- Recent transactions list
- Stellar address display
- "Add New API" button

### 4.7 Design System
- Use shadcn/ui components:
  - Button, Card, Badge, Input, Select, Table
  - Dialog, Sheet, Tabs
  - Dropdown Menu, Toast
- Color scheme:
  - Primary: Stellar blue (#000000 or brand color)
  - Accent: USDC green (#26A17B)
  - Background: Dark mode + Light mode
- Typography: Inter or Geist font
- Icons: Lucide React
- Responsive: Mobile-first design

---

## Phase 5: API Proxy Layer

### 5.1 Proxied API Integrations
Each API needs:
- API key management (stored in env vars)
- Request transformation (SDK params → API params)
- Response transformation (API response → standardized format)
- Error handling
- Rate limiting
- Caching (optional for hackathon)

### 5.2 API Implementations

#### OpenWeatherMap
```typescript
// /api/proxy/weather
// Input: { city: string }
// Output: { temp, conditions, humidity, windSpeed }
// Price: 0.001 USDC
```

#### AirVisual
```typescript
// /api/proxy/air-quality
// Input: { city: string }
// Output: { aqi, pollutants, healthRecommendation }
// Price: 0.001 USDC
```

#### NewsAPI
```typescript
// /api/proxy/news
// Input: { topic: string, limit: number }
// Output: { articles: [{ title, source, url, publishedAt }] }
// Price: 0.002 USDC
```

#### ExchangeRate API
```typescript
// /api/proxy/currency
// Input: { from: string, to: string, amount: number }
// Output: { rate, converted, timestamp }
// Price: 0.001 USDC
```

#### IPInfo
```typescript
// /api/proxy/geolocation
// Input: { ip: string }
// Output: { city, country, lat, lon, timezone }
// Price: 0.001 USDC
```

#### OpenAI / Gemini
```typescript
// /api/proxy/ai-inference
// Input: { prompt: string, model?: string }
// Output: { response, tokensUsed }
// Price: 0.005 USDC
```

### 5.3 x402 Middleware
```typescript
// Middleware for all /api/proxy/* routes
async function x402Middleware(req, res, next) {
  // 1. Extract payment proof from headers
  // 2. Verify Stellar transaction
  // 3. Check amount matches API price
  // 4. Check transaction timestamp (prevent replay)
  // 5. If valid: proceed to API
  // 6. If invalid: return 402 with payment details
}
```

### 5.4 Payment Details Format
```json
{
  "error": "Payment Required",
  "payment": {
    "recipient": "GBXXXX...marketplace",
    "amount": "0.001",
    "currency": "USDC",
    "memo": "agentmarket:weather:call123",
    "network": "testnet"
  }
}
```

---

## Phase 6: Demo Experience (The Showstopper)

### 6.1 Three-Panel Layout
```
┌─────────────────┬─────────────────┬─────────────────┐
│   AGENT PANEL   │ MARKETPLACE     │ TRANSACTION     │
│                 │ PANEL           │ FEED PANEL      │
│  AI reasoning   │                 │                 │
│  Task progress  │ Live API        │ Real-time       │
│  API calls made │ listings        │ Stellar txs     │
│  Data gathered  │                 │                 │
│  Final output   │ Price per call  │ USDC flowing    │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### 6.2 Demo Scenario Implementation
**Task**: "Research air quality, weather, and top news for the 5 most polluted Indian cities today and give me a weekend travel recommendation."

#### Agent Panel
- Show task input at top
- Real-time log of agent reasoning:
  ```
  [THINKING] Need to identify most polluted cities in India
  [CALLING] air-quality API for Delhi, Mumbai, Kolkata, Chennai, Bangalore
  [RESULT] Air quality data received for 5 cities
  [THINKING] Now fetching weather data
  [CALLING] weather API for all 5 cities
  [RESULT] Weather data received
  [THINKING] Getting latest news for context
  [CALLING] news API with topic "India pollution travel"
  [RESULT] News articles received
  [ANALYZING] Comparing data across cities
  [RECOMMENDATION] Weekend travel suggestion: [City] because...
  ```
- Final output: Structured recommendation card
- Total cost: 0.023 USDC
- Time taken: 18 seconds

#### Marketplace Panel
- Live API cards with real-time highlight when called
- Show price pulse animation on call
- Increment total calls counter
- Category tabs to filter view

#### Transaction Feed Panel
- WebSocket or Server-Sent Events for real-time updates
- Each transaction shows:
  - Timestamp
  - API called
  - Amount (USDC)
  - Transaction hash (link to Stellar Expert)
  - Status: Pending → Confirmed
- Auto-scroll to latest
- Running total USDC spent
- Success/failure indicators

### 6.3 Agent Implementation
- Use OpenAI GPT-4 or Claude API for reasoning
- Give agent access to AgentMarketSDK
- System prompt:
  ```
  You are an autonomous research agent with access to real-time data APIs
  through AgentMarket. You can call APIs by using the SDK. Each call costs
  a small amount of USDC but gives you fresh data. Complete the user's task
  efficiently, showing your reasoning at each step.
  ```
- Log each action to frontend via WebSocket
- Handle API failures gracefully
- Respect budget limits

### 6.4 Real-time Communication
- Setup WebSocket server (or Supabase real-time)
- Channels:
  - `agent-log`: Agent reasoning steps
  - `marketplace-update`: API calls, new listings
  - `transaction-feed`: Stellar transactions
- Frontend subscribes to all channels
- Backend publishes events as they happen

### 6.5 Demo Controls
- "Start Demo" button
- "Reset Demo" button
- Wallet connection required before start
- Budget display: Remaining USDC
- Pause/resume functionality (optional)

---

## Phase 7: Documentation & Developer Experience

### 7.1 SDK Documentation Site
- Quick Start (< 5 minutes to first call)
- Installation: `npm install agentmarket-sdk`
- Configuration guide
- API reference (auto-generated from TypeScript)
- Example recipes:
  - Get weather data
  - Fetch news headlines
  - Currency conversion
  - Build an AI research agent
- Troubleshooting common errors
- Migration from direct API usage

### 7.2 Marketplace Documentation
- For Developers:
  - How to use the SDK
  - Budget management
  - Error handling
- For API Providers:
  - How to list an API
  - Setting pricing
  - Viewing earnings
  - Best practices

### 7.3 Video Tutorial
- 2-minute demo video showing:
  - Browse marketplace
  - Install SDK
  - Make first API call
  - View transaction on Stellar
- Screen recording with voiceover
- Upload to YouTube
- Embed on homepage

---

## Phase 8: Testing & Quality Assurance

### 8.1 Unit Testing
- SDK: Jest + ts-jest
- Smart contract: Rust tests
- API proxy: Jest + supertest
- Target: >80% code coverage

### 8.2 Integration Testing
- End-to-end SDK flow with testnet
- Provider registration → API listing → API call → payment
- Demo scenario dry run
- Wallet connection testing (Freighter, Albedo)

### 8.3 Load Testing
- Simulate 100 concurrent API calls
- Test marketplace under load
- Verify Stellar testnet handles volume
- Identify bottlenecks

### 8.4 Security Review
- Environment variable protection
- API key rotation strategy
- Input validation on all forms
- SQL injection prevention (Prisma handles this)
- XSS prevention
- CORS configuration
- Rate limiting on proxy endpoints

### 8.5 Browser Testing
- Chrome, Firefox, Safari
- Mobile responsiveness
- Wallet extension compatibility

---

## Phase 9: Deployment & DevOps

### 9.1 Database Deployment
- Setup PostgreSQL on Supabase (or Railway, Render)
- Run Prisma migrations
- Seed initial data:
  - 6 proxied APIs
  - AgentMarket as provider
  - Sample stats for realism

### 9.2 Frontend Deployment
- Deploy Next.js to Vercel
- Configure environment variables
- Setup custom domain (optional)
- Enable analytics

### 9.3 SDK Publishing
- Publish to npm: `@agentmarket/sdk` or `agentmarket-sdk`
- Setup GitHub releases
- Create changelog

### 9.4 Smart Contract Deployment
- Deploy budget enforcer to Stellar testnet
- Verify contract
- Document contract address in repo
- Create backup deployment script

### 9.5 Monitoring
- Setup Vercel analytics
- Configure error tracking (Sentry)
- Stellar transaction monitoring
- Database query performance monitoring

### 9.6 CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
- Lint & format check
- Type checking
- Unit tests
- Build SDK
- Build frontend
- Deploy preview for PRs
- Deploy production on merge to main
```

---

## Phase 10: Polish & Hackathon Submission

### 10.1 Visual Polish
- Smooth animations (Framer Motion)
- Loading states everywhere
- Empty states with helpful messages
- Success/error toasts
- Skeleton loaders
- Micro-interactions on hover

### 10.2 Copy & Messaging
- Punchy headline: "Payment IS Authentication"
- Clear value props on homepage
- Concise API descriptions
- Error messages that help, not confuse
- Call-to-action buttons

### 10.3 Demo Rehearsal
- Run demo end-to-end 10 times
- Fix any flakiness
- Optimize for < 20 second completion
- Prepare fallback if testnet is slow
- Record backup video

### 10.4 GitHub Repository
- Clean README with:
  - Project description
  - Architecture diagram
  - Quick start guide
  - Demo video embed
  - Links to live site and SDK
- License (MIT recommended)
- Contributing guidelines
- Code of conduct
- Issue templates

### 10.5 Hackathon Submission Materials
- **Video**: 3-minute demo walkthrough
- **Pitch Deck**: 10 slides
  1. Problem (agents can't use APIs)
  2. Solution (AgentMarket)
  3. How it works (architecture)
  4. Demo screenshot
  5. Market size
  6. Why Stellar
  7. Tech stack
  8. Business model
  9. Roadmap
  10. Team & ask
- **Written Description**: Compelling summary
- **Links**: Live demo, GitHub, SDK npm page
- **Screenshots**: Marketplace, demo, transaction feed

### 10.6 Social Media Assets
- Twitter thread explaining the project
- LinkedIn post
- Demo GIFs
- Screenshots for sharing

---

## Technical Decisions & Rationale

### Why Next.js 14?
- Best-in-class developer experience
- API routes eliminate need for separate backend
- SSR for SEO (marketplace discovery)
- Vercel deployment is seamless
- App Router is production-ready

### Why Prisma?
- Type-safe database queries
- Migrations handled automatically
- Great with PostgreSQL
- Schema is code

### Why x402-stellar npm package?
- Official Stellar implementation
- Battle-tested for hackathon use cases
- Maintained by Stellar team
- Good documentation

### Why TypeScript everywhere?
- Catches bugs at compile time
- Better IDE support
- Self-documenting code
- Required for production-grade SDK

### Why Vercel?
- Zero-config deployment
- Serverless functions scale automatically
- Edge network for global performance
- Free tier generous enough for hackathon

---

## Success Metrics

### Demo Success Criteria
- ✅ Agent completes task in < 25 seconds
- ✅ All 3 panels update in real-time
- ✅ Every transaction appears on Stellar Expert
- ✅ Zero manual intervention after "Start"
- ✅ Works on first try in front of judges

### Technical Success Criteria
- ✅ SDK call latency < 1 second
- ✅ Test coverage > 80%
- ✅ Zero TypeScript errors
- ✅ Lighthouse score > 90
- ✅ Mobile responsive

### Product Success Criteria
- ✅ All 6 APIs callable via SDK
- ✅ Provider registration works end-to-end
- ✅ Budget enforcement prevents overspending
- ✅ Transaction feed shows real Stellar testnet txs
- ✅ Documentation covers all use cases

---

## Risk Mitigation

### Risk: Stellar testnet is slow/down during demo
- **Mitigation**: Record backup video, test at multiple times of day, have fallback narration

### Risk: x402 implementation is complex
- **Mitigation**: Start with x402 early, follow official examples, ask in Stellar Discord

### Risk: Soroban contract has bugs
- **Mitigation**: Extensive testing, start with simple version, security checklist

### Risk: APIs rate limit us
- **Mitigation**: Implement caching, use multiple API keys, fallback to mock data

### Risk: Scope is too large
- **Mitigation**: This plan includes everything, but we track todos and can cut advanced features if needed

---

## Timeline Estimate (Aggressive)

- **Week 1**: Foundation, database, Stellar setup, start SDK
- **Week 2**: SDK completion, smart contract development
- **Week 3**: Marketplace frontend, API proxy layer
- **Week 4**: Demo experience, testing, deployment, polish
- **Week 5**: Documentation, video, submission materials

Total: 5 weeks for production-grade MVP

For faster hackathon delivery, we can parallelize and cut scope as needed.

---

## Next Steps After Plan Approval

1. Confirm plan looks good
2. Initialize project structure
3. Setup development environment
4. Start with Phase 1: Foundation
5. Track progress via SQL todos

Ready to build! 🚀
