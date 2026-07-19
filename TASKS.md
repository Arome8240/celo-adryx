# my-celo-app — Flight Booking Mini App for MiniPay

## Goal

A customer-only replica of adryxflight's flight search/booking experience, shipped as a
MiniPay mini app on Celo. Same core flow (search → book → pay → PNR), but:

- No lister/admin/hotel surfaces — flights only, customer-facing only.
- No Stripe/Paystack — payment is an on-chain escrow deposit in cUSD, released to the
  company treasury once confirmed.
- Identity is the customer's connected MiniPay wallet (Sign-In-With-Ethereum), not
  email/password.

## Decisions locked in

1. **Auth: wallet-based (SIWE).** No email/password/OTP screens. Connecting the wallet
   (implicit inside MiniPay, RainbowKit modal outside it) *is* signup/login. We still collect
   name/DOB/passport/nationality etc. per booking, because Amadeus requires it — that's
   booking-form data, not account-credential data.
2. **Payment: escrow smart contract**, not a direct wallet→merchant transfer. A Solidity
   contract in `apps/contracts` holds the customer's cUSD deposit and records the booking
   reference on-chain. A backend-held operator key calls `release()` (→ treasury) once the
   booking is confirmed, or `refund()` (→ customer) if it's cancelled/fails. This gives an
   auditable on-chain trail and real refund logic, at the cost of real contract-security work
   before it touches mainnet funds.

## Non-goals (explicitly out of scope for this app)

- Hotels (Property/Room/RatePlan/RoomAvailability/Review — none of it).
- Lister/admin roles, subdomain multi-tenancy, payouts/ledger.
- Stripe, Paystack, saved credit cards.
- A polished internal ops UI. Phase 7 below is a deliberately minimal "make release/refund
  callable" mechanism, not a dashboard. Revisit if this app gets real usage.

## Target workspace layout

```
my-celo-app/
  apps/
    web/         # existing Next.js 14 + Tailwind + shadcn/ui + wagmi/RainbowKit (already scaffolded)
    contracts/   # existing Hardhat + viem + OpenZeppelin (currently just the Lock.sol sample)
    api/         # NEW — NestJS + Prisma, adapted from adryxflight/apps/api
  packages/
    types/       # NEW (optional) — trimmed copy of @adryx/types (flights.ts, auth.ts, money.ts only)
```

`pnpm-workspace.yaml` already globs `apps/*`, so `apps/api` needs no workspace config change.
`packages/*` is not yet globbed — add it if we pull in a shared types package.

---

## Phase 0 — Foundations ✅ done

- [x] ~~Add `packages/*` to `pnpm-workspace.yaml`~~ — skipped. No shared types package was
      created; `apps/api` and `apps/web` each define their own local types for now. Revisit
      only once real duplication shows up (e.g. once Phase 2/6 both need the same
      `FlightOffer` shape).
- [x] Scaffolded `apps/api` as a NestJS project, matching adryxflight's dependency set minus
      `stripe`/`cloudinary`/`resend`/`bcryptjs`/`amadeus` (those come back in Phase 2/5), plus
      `siwe` + `ethers` (SIWE signature verification). `@nestjs/schedule` was left out too —
      add it back in Phase 3 when the abandoned-booking cleanup cron needs it.
- [x] Copied `adryxflight/apps/api/prisma/schema.prisma` and trimmed it — see "Schema plan"
      below for what actually shipped vs. what was planned.
- [x] **Local dev database provisioned via `npx prisma dev -n my-celo-app --db-port 5434 -d`**
      (Prisma's own local Postgres, no Docker/system service needed — matches the approach
      referenced in adryxflight's own `.env`). `db push` runs clean against it. A real hosted
      Postgres (Render/Neon/Supabase) is still needed before this goes anywhere near
      production — this is dev-only.
- [x] Copied `common/` guards/decorators/interfaces/lib as planned, with two adjustments:
      `lib/date-range.ts` was skipped (hotel-only, not needed yet) and `lib/phone.ts` was
      **generalized to international E.164 validation** instead of Nigeria-only —
      MiniPay's user base isn't Nigeria-specific the way adryxflight's is.
- [x] `.env` set up for the Phase 0/1 subset (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
      `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `SIWE_DOMAIN`, `SIWE_URI`, `PORT=4100` — distinct
      from adryxflight's API on 4000). Amadeus/Celo/escrow vars are documented in
      `.env.example` but commented out until Phase 2/4/5 actually consume them.

### Prisma schema plan

**Keep, lightly modified:**
- `User` — replace `passwordHash`/email-verification fields with `walletAddress String @unique`
  (store checksummed). Keep `email`/`phone` as optional contact fields (booking confirmations),
  not credentials. Drop `Role` enum entirely (single implicit CUSTOMER role) or keep it with
  just `CUSTOMER` if we want the column ready for a future ops role.
- `RefreshToken` — unchanged; still rotate JWT refresh tokens after SIWE verification.
- `Booking` — unchanged shape; `type` effectively always `FLIGHT`.
- `FlightBooking`, `Passenger`, `Gender` enum, `SavedTraveler` — unchanged, this is the part
  that already works end-to-end in adryxflight (PNR + amadeusOrderId fields included).
- `Airport` — unchanged (Amadeus airport autocomplete data).
- `DiscountCode` — keep if we want promo codes; trivial to drop if not needed for v1.
- `TripType`, `CabinClass`, `PassengerType`, `DocumentType` enums — unchanged.
- `Payment` — reshaped, see below.

**New:**
- `Payment` gets on-chain fields instead of gateway-checkout fields:
  `chainId Int`, `tokenAddress String`, `depositTxHash String? @unique`,
  `releaseTxHash String?`, `refundTxHash String?`, `escrowBookingIdHash String` (the
  `keccak256` value the contract indexes on). Replace `PaymentGatewayName` (STRIPE/PAYSTACK)
  with a single implicit gateway, or a `token` field (`CUSD`/`USDC`) if we support both.
  `PaymentStatus` enum (PENDING/SUCCEEDED/FAILED/REFUNDED) stays as-is — it already matches
  the escrow lifecycle (deposited=PENDING, released=SUCCEEDED, refunded=REFUNDED).

**Drop entirely:** `ExchangeCode` (subdomain auth handoff — single-app now, doesn't apply),
`PasswordResetToken`, `VerificationCode` (no password/email-OTP flow), `WebhookEvent` (no
gateway webhooks — confirmation is an RPC receipt check, not a webhook),
`SavedPaymentMethod` (no cards), `ListerVerification`, `PayoutAccount`, `Payout`, `LedgerBook`,
`LedgerPosting` (no listers, no payouts), `Property`, `PropertyTax`, `Room`, `RatePlan`,
`RoomAvailability`, `Review`, `HotelBooking`, `TaxRate`, `City` (all hotel-only), plus their
enums (`ListerVerificationStatus`, `ListerBusinessType`, `IdDocumentType`, `PayoutStatus`,
`LedgerBookOwnerType`, `PropertyType`, `PropertyStatus`, `TaxValueType`).

**What actually shipped, differing from the plan above:**

- `DiscountCode` was **dropped**, not kept — nothing consumes it yet; add back in Phase 3 if
  promo codes turn out to be in scope.
- `User` also dropped `suspendedAt` and `Role` entirely (not just de-scoped to `CUSTOMER`) —
  no admin surface exists yet to ever set either one. Trivial to add back once Phase 7's ops
  mechanism needs it.
- `Booking.assignedAdminId`/`assignedAdmin` dropped too, same reason (no admin panel).
- `Payment` is **one-to-one** with `Booking` (`Booking.payment`, not `payments: Payment[]`) —
  the escrow contract's `deposit()` only ever accepts one deposit per `bookingIdHash` (reverts
  on a second call), so unlike Stripe/Paystack retries-mint-a-new-row, there's naturally only
  ever one Payment row per booking here.
- Default `currency` on `Booking` is `"USD"`, not `"NGN"` — no Naira-specific pricing in this
  app.

---

## Phase 1 — Auth (SIWE) ✅ done

- [x] `GET /auth/nonce` — no request body needed (a SIWE nonce isn't bound to an address at
      issuance); returns a fresh nonce from an in-memory, TTL'd store (5 min). Single-instance
      only for now — move to Redis/DB if this ever runs horizontally scaled.
- [x] `POST /auth/verify` — built on the official `siwe` npm package (v3, backed by `ethers`
      for signature recovery) rather than hand-rolling it. Verifies signature + domain, checks
      and single-use-consumes the nonce, upserts `User` by lowercased `walletAddress`, issues
      the same access+refresh JWT pair adryxflight uses (`RefreshToken` rotation, reuse
      detection that revokes the whole session family — copied byte-for-byte).
- [x] `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me` — copied
      from adryxflight, with `suspendedAt`/role checks removed (fields no longer exist).
      `PATCH /auth/me` also accepts `email` now (a plain contact field here, not a login
      identifier, so it's editable — unlike adryxflight where it's immutable).
- [x] Dropped `register`/`login`/`forgot-password`/`reset-password`/`verify-email`/
      `verify-phone`/`exchange-code`/`exchange` as planned.
- [x] Frontend (`wallet-provider.tsx`): the MiniPay auto-connect effect was already scaffolded;
      added a second effect that runs the nonce → build `SiweMessage` → `signMessageAsync` →
      `POST /auth/verify` flow whenever a wallet is connected without a session already
      matching that address, storing the result in a new `zustand` store
      (`lib/auth-store.ts`, persisted to localStorage, session fields only — `isSigningIn` is
      excluded from persistence). `lib/api-client.ts` adds a fetch wrapper that retries once
      through `/auth/refresh` on a 401. Session clears automatically on wallet disconnect.
- [x] Fixed two pre-existing scaffold bugs while wiring this: `navbar.tsx` referenced an
      undefined `WalletConnectButton` (should've been the imported `ConnectButton`) in both
      the mobile drawer and desktop nav; and `next build` failed outright because
      `@rainbow-me/rainbowkit` → `@wagmi/connectors`' Base Account connector transitively pulls
      in `@coinbase/cdp-sdk`, which statically references five `@x402/*` submodules that
      aren't installed. Aliased them to `false` in `next.config.js` (same pattern already used
      there for the MetaMask async-storage dep) since this app only configures the injected
      wallet connector and never touches Base Account/x402.
- [x] Verified for real: a Node script built a `SiweMessage`, signed it with a real
      `ethers.Wallet`, and drove `/auth/nonce` → `/auth/verify` → `/auth/me` → nonce-replay
      (rejected) → `/auth/refresh` → reused-old-refresh-token (rejected, session family
      revoked) → `/auth/me` PATCH against the live running API — all passed. `tsc --noEmit`,
      `eslint`, and `next build` are clean on both `apps/api` and `apps/web`.
  - **Not verified**: the actual in-browser wallet-popup interaction (clicking "Connect
    Wallet", approving the `personal_sign` prompt) — no browser-automation tool was available
    this session. The wiring is typechecked, linted, and built successfully, and mirrors the
    exact request/response shape already proven against the live API, but a real
    MiniPay/RainbowKit click-through hasn't been exercised. Worth a manual pass (or a
    Playwright check in a future session) before calling Phase 1 fully closed.

---

## Phase 2 — Flights module (mostly a direct copy)

- [ ] Copy `flights/` wholesale: `flights.controller.ts`, `flights.service.ts`,
      `providers/amadeus-flight.provider.ts`, `providers/amadeus-auth.service.ts`,
      `types/amadeus.d.ts`, `dto/*`, `lib/*`.
- [ ] Reuse the DNS fix as-is: explicit `host: 'travel.api.amadeus.com'` /
      `'test.travel.api.amadeus.com'` override alongside `hostname` in
      `amadeus-auth.service.ts` — the SDK's default hostnames are DNS-dead in this
      environment too.
- [ ] Same sandbox caveat applies: only major carriers are sellable via Flight Create Orders
      in the Amadeus test environment; small regional carriers are search-only. Not a bug if
      it recurs here.

---

## Phase 3 — Bookings module (copy + trim)

- [ ] Copy `bookings.controller.ts` / `bookings.service.ts`, keep only the
      `createFlightBooking` path — drop `createHotelBooking` and any hotel-specific
      branching in `BOOKING_INCLUDE`.
- [ ] Copy `travelers.controller.ts` / `travelers.service.ts` (saved travelers) as-is.
- [ ] Copy `dto/create-flight-booking.dto.ts`, `dto/passenger.dto.ts`,
      `dto/create-saved-traveler.dto.ts`, `dto/list-bookings-query.dto.ts` as-is — these
      already encode the hard-won lessons from adryxflight (gender required; expiry +
      issuing country required for *all* document types, not just passports; nationality
      and issuing country are 2-letter ISO codes **enforced entirely on the frontend**, the
      backend must not re-derive or normalize them).
- [ ] Copy `discounts.controller.ts` / `discounts.service.ts` only if discount codes are
      in scope for v1; otherwise skip.
- [ ] Sequencing stays identical to adryxflight's already-working design: validate
      passengers → price the offer with Amadeus → **create the Amadeus order (reserve the
      PNR) before any payment exists** → persist the booking with `amadeusOrderId`/`pnr` →
      only then does the frontend show a payment step. This is the one piece of the original
      feature request ("reservation made on Amadeus once the user clicks confirm, not after
      payment") that carries over unchanged.
- [ ] Add a scheduled cleanup job (reuse the node-cron pattern already used elsewhere in
      adryxflight) that cancels/expires bookings whose Amadeus order was created but no
      escrow deposit ever arrived within some window (e.g. 30 minutes) — otherwise seats get
      reserved with Amadeus indefinitely for abandoned checkouts.

---

## Phase 4 — Escrow contract (`apps/contracts`)

- [ ] Replace the sample `Lock.sol` with `FlightEscrow.sol`:
  - `deposit(bytes32 bookingIdHash, uint256 amount)` — `transferFrom(msg.sender, address(this), amount)`
    on the configured ERC20 (cUSD); reverts if a deposit already exists for that hash; emits
    `Deposited(bookingIdHash, payer, amount)`.
  - `release(bytes32 bookingIdHash)` — `onlyOperator`; requires state `Deposited`; transfers
    to the treasury address; emits `Released`.
  - `refund(bytes32 bookingIdHash)` — `onlyOperator`; requires state `Deposited`; transfers
    back to the original payer; emits `Refunded`.
  - Use OpenZeppelin `AccessControl` (already a dependency) for an `OPERATOR_ROLE` distinct
    from the contract owner/admin, and `ReentrancyGuard` on all three token-moving functions.
  - `bookingIdHash = keccak256(bytes(bookingId))` computed identically on both sides (backend
    when verifying a deposit, contract when indexing it) so a Prisma cuid string maps
    deterministically to the on-chain key.
- [ ] Write Hardhat tests for the full lifecycle (deposit → release, deposit → refund,
      double-deposit rejected, release/refund by non-operator rejected, release/refund on an
      undeposited hash rejected) before this goes anywhere near mainnet funds.
- [ ] Deploy to Celo Sepolia first (`pnpm contracts:deploy:celo-sepolia`, networks already
      configured in `hardhat.config.ts`); only promote to `pnpm contracts:deploy:celo` once
      the full booking→pay→release flow has been exercised end-to-end on testnet.
- [ ] cUSD addresses: mainnet `0x765DE816845861e75A25fCA122bb6898B8B1282a`. Confirm the Celo
      Sepolia cUSD address from `docs.celo.org/tooling/contracts/token-contracts` before
      testnet deployment — didn't come back cleanly in search and needs a direct check.

---

## Phase 5 — Payments module (new, replacing Stripe/Paystack entirely)

This is not a gateway swap — the whole request/response shape changes from "redirect to a
hosted checkout page + webhook" to "read a transaction receipt off the chain."

- [ ] `POST /payments/bookings/:id/initiate` — returns `{ contractAddress, tokenAddress,
      amount, bookingIdHash }`. No redirect URL. The frontend uses this to drive an
      ERC20 `approve` + the contract's `deposit` call directly from the customer's connected
      wallet (wagmi `useWriteContract`).
- [ ] `POST /payments/bookings/:id/confirm` — body is `{ txHash }`. Backend:
  1. Fetches the receipt via `viem`'s public client against `CELO_RPC_URL`.
  2. Confirms `status === 'success'`, `to === ESCROW_CONTRACT_ADDRESS`.
  3. Decodes the `Deposited` log and checks `bookingIdHash`/`amount` match what was quoted.
  4. Marks `Payment` `SUCCEEDED` with `depositTxHash` recorded, then calls the contract's
     `release()` from the operator wallet and records `releaseTxHash`.
  - No polling loop needed the way `bookings/[id]/pay/return/page.tsx` currently polls a
    payment-gateway webhook fast-path — a confirmed receipt is final immediately, so this can
    be a single call once the frontend's wagmi hook reports the deposit tx is mined.
- [ ] `POST /payments/bookings/:id/refund` (admin/ops-triggered, see Phase 7) — calls the
      contract's `refund()`, records `refundTxHash`.
- [ ] Drop `gateways/stripe.gateway.ts`, `gateways/paystack.gateway.ts`,
      `interfaces/payment-gateway.interface.ts` (redirect/webhook-shaped, doesn't fit
      on-chain verification), `saved-payment-methods.*`, `payouts.*`, `ledger.service.ts`.
      Remove the `stripe` npm dependency.
- [ ] Open question to settle during implementation, not now: if `release()` has already
      moved funds to treasury by the time a cancellation comes in, `refund()` on the
      contract no longer has anything to send back (funds aren't in escrow anymore). Either
      add a hold window before auto-releasing, or have the treasury-side refund be a manual
      ERC20 transfer outside the contract. Don't design this further until Phase 4/5 are
      actually being built.

---

## Phase 6 — Frontend (customer flows only)

Re-implement using the already-scaffolded shadcn/ui + Tailwind + wagmi stack — don't pull in
`@adryx/ui`, it's a different design system built for the adryxflight product.

- [ ] Flight search page (`app/flights/search`) — port the search form, `FilterSidebar`,
      `FlightResultCard`, `AirlineLogo` (Google's gstatic airline-logo CDN, already proven to
      work: `https://www.gstatic.com/flights/airline_logos/70px/{IATA}.png`), and
      `AirportAutocomplete` logic, restyled with shadcn primitives instead of `@adryx/ui`.
- [ ] Booking page (`app/flights/book`) — port `PassengerFields` (gender required; expiry +
      issuing country required for all document types; nationality/issuing-country
      normalized to 2-letter uppercase **in this component**, never server-side) and the
      booking-submit flow.
- [ ] Booking success state — show the real PNR (`booking.flightBooking.pnr`) and a link to
      the booking detail page, matching the pattern just built in adryxflight
      (`flights/book/page.tsx`'s `confirmed` state).
- [ ] Payment step — replace `PayNowCard`'s "redirect to Paystack/Stripe" behavior with:
      call `initiate`, run `approve` + `deposit` via wagmi against the user's MiniPay wallet,
      wait for the tx receipt client-side, then call `confirm` with the hash.
- [ ] Booking detail page (`app/bookings/[id]`) — port as-is: PNR box, itinerary with airline
      logos, passenger list; add the deposit/release tx hashes (linking to Celoscan) where a
      payment-gateway reference used to be shown.
- [ ] Hide the RainbowKit "Connect Wallet" button entirely when `window.ethereum.isMiniPay`
      is true (already partially handled in `wallet-provider.tsx`'s auto-connect effect —
      needs the UI-hiding half added too, not just the auto-connect half).

---

## Phase 7 — Minimal ops mechanism (not a UI)

Deliberately small scope — this app has no admin panel.

- [ ] A single protected endpoint or authenticated CLI script (gate however's cheapest right
      now — e.g. a shared ops secret header) to trigger `refund()` for a given booking ID,
      for the rare case a confirmed booking needs to be unwound after money has moved.
- [ ] Revisit building a real ops UI only if this app gets enough real usage to need one.

---

## Phase 8 — Testing & rollout

- [ ] End-to-end on Celo Sepolia testnet first: search → book (real Amadeus test-env order)
      → deposit test cUSD → confirm → release → verify booking detail page shows PNR + tx
      hashes. Use Amadeus's test environment exactly as adryxflight does (small regional
      carriers are search-only, not sellable — use a major carrier like Turkish Airlines to
      validate the full order-creation path, same as adryxflight's verification).
- [ ] Only after that passes cleanly: mainnet contract deployment, mainnet Amadeus
      credentials (if/when this goes beyond a test build), and MiniPay app-directory
      submission — check `docs.minipay.xyz` directly for current submission/listing
      requirements before that step; nothing manifest-file-shaped turned up in search, so
      distribution may just be a listing request rather than a manifest to author.

---

## Environment variables (apps/api)

```
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
AMADEUS_HOST=travel.api.amadeus.com        # test.travel.api.amadeus.com in dev
CELO_RPC_URL=https://forno.celo.org        # Celo Sepolia RPC in dev
CHAIN_ID=42220                              # 11142220 for Celo Sepolia
ESCROW_CONTRACT_ADDRESS=
CUSD_TOKEN_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a
OPERATOR_PRIVATE_KEY=                       # backend's release()/refund() signer — treat like a production secret
TREASURY_ADDRESS=
```

## Open questions to revisit (not blocking Phase 0 start)

- Whether `DiscountCode` is in scope for v1.
- Exact refund-after-release handling (Phase 5's open question above).
- MiniPay listing/submission requirements — check `docs.minipay.xyz` when we're actually
  ready to distribute, not before.
- Whether USDC support is needed alongside cUSD, or cUSD-only is fine for v1.
