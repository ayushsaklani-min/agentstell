# C2: Wanted Board — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** New DB model + API routes + web page for posting API requests

---

## Problem

There is no mechanism for API consumers (agents or humans) to signal demand for APIs that don't exist yet. Providers have no visibility into what the market wants to build. A Wanted Board closes this gap: consumers post what they need + what they'd pay, providers browse and prioritise accordingly.

---

## Goals

1. Any Stellar address can post a "wanted" request describing an API they need and a budget in USDC per call.
2. Wanted posts have a `status` field: `open | fulfilled | closed`. Only the poster can change status.
3. The marketplace site has a `/wanted` page listing open posts with filtering by category and status.
4. A form on the same page lets anyone submit a new wanted post.

---

## Data Model

New Prisma model added to `agentmarket/prisma/schema.prisma`:

```prisma
model WantedPost {
  id            String   @id @default(cuid())
  title         String
  description   String
  category      String
  budgetUsdc    Float
  posterAddress String
  status        String   @default("open")  // open | fulfilled | closed
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

No relation to `Provider` or `ApiListing` — wanted posts are intentionally standalone. A Stellar address is the only identity requirement.

Migration: `npx prisma migrate dev --name add-wanted-posts`

---

## API Routes

### `GET /api/wanted`

**Query params:**
- `status` (optional, default `open`) — filter by status; `all` returns all statuses
- `category` (optional) — filter by category string

**Response:**
```json
{
  "posts": [
    {
      "id": "cuid",
      "title": "Real-time flight status API",
      "description": "Need IATA flight number → departure/arrival status, gate. Used by travel agent bots.",
      "category": "Data",
      "budgetUsdc": 0.005,
      "posterAddress": "GDEMO...",
      "status": "open",
      "createdAt": "2026-04-11T..."
    }
  ],
  "total": 1
}
```

Posts sorted by `createdAt` descending (newest first).

### `POST /api/wanted`

**Body:**
```json
{
  "title": "string (required, max 120 chars)",
  "description": "string (required, max 1000 chars)",
  "category": "string (required)",
  "budgetUsdc": 0.005,
  "posterAddress": "G... (required, must be valid Stellar public key format)"
}
```

**Response:** 201 with the created post object.

**Validation:**
- `title`: required, 1–120 chars
- `description`: required, 1–1000 chars
- `category`: required, non-empty string
- `budgetUsdc`: required, number > 0
- `posterAddress`: required, must match `/^G[A-Z0-9]{55}$/`

### `PATCH /api/wanted/[id]`

**Body:**
```json
{ "status": "fulfilled", "posterAddress": "G..." }
```

- `posterAddress` must match the post's `posterAddress` — this is the only auth check.
- Only `status` can be changed via PATCH.
- Valid status values: `open`, `fulfilled`, `closed`.

**Response:** 200 with updated post, or 403 if `posterAddress` doesn't match, 404 if not found.

---

## Files

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `agentmarket/prisma/schema.prisma` | Add `WantedPost` model |
| Create | `agentmarket/src/app/api/wanted/route.ts` | GET (list) + POST (create) |
| Create | `agentmarket/src/app/api/wanted/[id]/route.ts` | PATCH (update status) |
| Create | `web/src/app/api/wanted/route.ts` | Thin proxy for GET + POST |
| Create | `web/src/app/api/wanted/[id]/route.ts` | Thin proxy for PATCH |
| Create | `web/src/app/wanted/page.tsx` | Wanted board UI |
| Modify | `web/src/components/Nav.tsx` | Add "Wanted" nav link |

---

## UI: `/wanted` Page

**Layout:** Two-column on desktop, single-column on mobile.

**Left panel — Post form:**
- Fields: Title, Description (textarea), Category (select — same list as marketplace), Budget USDC (number input), Your Stellar Address
- Submit button: "Post Request"
- On success: form clears, new post appears at top of list
- On error: inline error message

**Right panel — Post list:**
- Status filter tabs: All / Open / Fulfilled / Closed (default: Open)
- Category filter dropdown
- Each card shows: title, description (truncated to 2 lines), category badge, budget (`$X.XXX/call`), poster address (first 6…last 4 chars), age ("3 days ago"), status badge
- If viewer's address matches `posterAddress` (entered in the form), show status update buttons on their posts

**Nav:** Add "Wanted" link to `web/src/components/Nav.tsx` between "Marketplace" and "Docs".

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Missing required field | 400 `{ error: 'field is required' }` |
| Invalid `posterAddress` format | 400 `{ error: 'posterAddress must be a valid Stellar public key' }` |
| `budgetUsdc` ≤ 0 | 400 `{ error: 'budgetUsdc must be greater than 0' }` |
| PATCH with wrong `posterAddress` | 403 `{ error: 'Not authorised to update this post' }` |
| Post not found | 404 `{ error: 'Post not found' }` |
| DB unavailable | 503 `{ error: 'Service unavailable' }` |

---

## Verification

```bash
cd agentmarket && npx prisma migrate dev --name add-wanted-posts
cd agentmarket && npx tsc --noEmit && npm run lint
cd web && npx tsc --noEmit && npm run lint
```

Manual smoke test:
- Post a wanted request via the web form
- Verify it appears in the list
- PATCH status to `fulfilled` via curl
- Verify list filters work

---

## Out of Scope

- Email/notification when a matching API is published — YAGNI
- Voting / upvoting posts — YAGNI
- Linking a wanted post to a published ApiListing when fulfilled — YAGNI
- Pagination — first version shows all posts (expected low volume)
