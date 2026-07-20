# my-celo-app — Flight Booking Mini App for MiniPay

## Goal

A customer-only replica of adryxflight's flight search/booking experience, shipped as a
MiniPay mini app on Celo. Same core flow (search → book → pay → PNR), but:

- No lister/admin/hotel surfaces — flights only, customer-facing only.
- No Stripe/Paystack — payment is an on-chain escrow deposit in USDm, released to the
  company treasury once confirmed.
- Identity is the customer's connected MiniPay wallet (Sign-In-With-Ethereum), not
  email/password.

## Decisions locked in

1. **Auth: wallet-based (SIWE).** No email/password/OTP screens. Connecting the wallet
   (implicit inside MiniPay, RainbowKit modal outside it) *is* signup/login. We still collect
   name/DOB/passport/nationality etc. per booking, because Amadeus requires it — that's
   booking-form data, not account-credential data.
2. **Payment: escrow smart contract**, not a direct wallet→merchant transfer. A Solidity
   contract in `apps/contracts` holds the customer's USDm deposit and records the booking
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
  with a single implicit gateway, or a `token` field (`USDM`/`USDC`) if we support both.
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

## Phase 2 — Flights module (mostly a direct copy) ✅ done

- [x] Copied `flights/` — `flights.controller.ts`, `flights.service.ts`,
      `providers/amadeus-flight.provider.ts`, `providers/amadeus-auth.service.ts`,
      `types/amadeus.d.ts`, `dto/*`, `lib/*` — largely verbatim.
- [x] Reused the DNS fix as-is: explicit `host` override alongside `hostname` in
      `amadeus-auth.service.ts`. Confirmed still necessary and still working here too.
- [x] `currencyCode` in both Amadeus search calls changed from adryxflight's hardcoded
      `'NGN'` to `'USD'`, matching this app's `Booking.currency` default — there's no single
      home currency here the way adryxflight has Naira.
- [x] No shared `@adryx/types` package (Phase 0 decision) — `FlightOffer`/`FlightItinerary`/
      `AirportSummary`/etc. live in a new local `flights/types/flight.types.ts`, and
      `TripType`/`CabinClass` are imported straight from the generated Prisma client (re-exported
      from that same file) instead of being redefined — one less place for the enum value lists
      to drift from the schema.
- [x] `AirportSummary`/`Airport` dropped adryxflight's `isNigerian` boolean. The
      domestic-vs-international document-requirement check (`isDomesticOffer`) is now
      **country-agnostic**: domestic = every airport in the itinerary shares the same
      `countryCode`, not "every airport is in Nigeria" — this app has no single home country.
      `searchAirports`'s result ordering dropped the `isNigerian`-first sort for the same reason
      (now just `city asc`).
- [x] Seeded `Airport` from adryxflight's curated dataset (34 Nigerian + international-hub
      airports), stripped of `isNigerian`, plus 4 added hubs for other Celo/MiniPay markets
      (Nairobi NBO, Entebbe EBB, Dar es Salaam DAR, Kigali KGL) — see
      `prisma/seed/index.ts`/`prisma/seed/airports.ts`. Still Nigeria-heavy for *domestic*
      coverage specifically; expand as real usage from other markets shows up.
- [x] Reused the same Amadeus test/sandbox credentials already configured for local dev in
      the adryxflight project (same developer account, test environment only) so this could
      actually be exercised end-to-end rather than left unverified.
- [x] Same sandbox caveat applies and was reproduced here too: Ibom Air (QI) — the only
      carrier on the LOS→ABV domestic route in this test environment — is search-visible but
      not sellable via Flight Create Orders. Not a bug; confirmed by successfully booking an
      international Qatar Airways (QR) itinerary instead (see Phase 3's verification note).

---

## Phase 3 — Bookings module (copy + trim) ✅ done

- [x] Copied `bookings.controller.ts`/`bookings.service.ts` — only the `createFlightBooking`
      path exists; there's no `createHotelBooking` to drop since `HotelBooking` was never in
      this schema (Phase 0). `BOOKING_INCLUDE` is `{ flightBooking: {...}, payment: true }` —
      no hotel branch, and `payment` (singular — see Phase 0's schema note) instead of
      `payments`.
- [x] Copied `travelers.controller.ts`/`travelers.service.ts` as-is, minus the
      "`documentExpiry` might be null" branch — it's a required field here.
- [x] Copied `dto/create-flight-booking.dto.ts`, `dto/passenger.dto.ts`,
      `dto/create-saved-traveler.dto.ts`, `dto/list-bookings-query.dto.ts` — gender/expiry/
      issuing-country-required and frontend-only nationality normalization all carried over
      unchanged. Two adaptations: `contactPhone` validation uses the generalized
      `IsPhoneNumber` decorator (Phase 1) instead of `IsNigerianPhoneNumber`; and
      `CreateSavedTravelerDto.documentExpiry`/`documentIssuingCountry` were **made required**
      (adryxflight still has these optional on this one DTO specifically, inconsistent with
      its own `PassengerDto` — this schema has no nullable column to accommodate that anyway).
  - `discountCode` field dropped entirely from `CreateFlightBookingDto` — no discounts
    controller/service exists (matches Phase 0's decision to drop `DiscountCode` outright,
    not just de-scope it).
  - `ListBookingsQueryDto` dropped its `type`/`BookingType` filter — there's only ever flight
    bookings, so the field (and the `BookingType` enum itself) doesn't exist.
- [x] Sequencing preserved exactly: validate passengers → price the offer with Amadeus →
      **create the Amadeus order (reserve the PNR) before any payment exists** → persist the
      booking with `amadeusOrderId`/`pnr`. No tax/discount computation — subtotal equals
      total, `taxAmountMinor` is always 0 (no `TaxService`/`TaxRate`/jurisdiction concept
      here; adryxflight's flat Nigerian VAT rate doesn't generalize to an app with no single
      home country, and adding a real multi-jurisdiction tax model isn't justified yet).
- [ ] **Deferred to Phase 5, not built now**: the abandoned-checkout cleanup cron. It only
      makes sense once `Payment` rows actually get created (Phase 5) — built now, it would
      either be a no-op or would wrongly cancel every booking, since nothing populates
      `Payment` yet. `@nestjs/schedule` wasn't added to `apps/api` for the same reason.
- [x] **Verified for real** against the live Amadeus test environment: signed in via SIWE,
      searched LOS→ABV (domestic — only Ibom Air (QI) came back, reproducing the known
      "search-visible, not sellable" sandbox limitation from adryxflight), then searched
      LOS→IST (international) and booked a real Qatar Airways (QR) offer end-to-end — got
      back a real `amadeusOrderId` and PNR (`8KK4VK`), with the passport requirement
      correctly enforced (Nigeria→Turkey isn't domestic under the new country-agnostic
      check). Also verified `GET /bookings/:id`, `GET /bookings` (list + count), and
      `GET /travelers` (the `saveTraveler: true` passenger came back as a saved traveler).
      `tsc --noEmit` and `eslint` are clean.

---

## Phase 4 — Escrow contract (`apps/contracts`) ✅ done (pre-testnet)

- [x] Fixed a **pre-existing bug in the scaffold** before anything else could even compile:
      `hardhat.config.ts` had unquoted hyphenated object keys (`celo-sepolia: {...}` instead of
      `"celo-sepolia": {...}`) in both the `networks` and `etherscan.apiKey` blocks — invalid
      TS/JS object-literal syntax, so `hardhat compile` failed outright with parse errors
      before this session touched a single contract file.
- [x] Replaced the sample `Lock.sol` with `FlightEscrow.sol`:
  - `deposit(bytes32 bookingIdHash, uint256 amount)` — pulls the ERC20 via `SafeERC20`;
    reverts if a deposit already exists for that hash (also blocks re-depositing after
    release/refund, since those are separate, non-`None` statuses); emits
    `Deposited(bookingIdHash, payer, amount)`.
  - `release(bytes32 bookingIdHash)` — `onlyRole(OPERATOR_ROLE)`; requires `Deposited`;
    transfers to `treasury`; emits `Released`.
  - `refund(bytes32 bookingIdHash)` — `onlyRole(OPERATOR_ROLE)`; requires `Deposited`;
    transfers back to the original payer; emits `Refunded`.
  - `setTreasury(address)` — `onlyRole(DEFAULT_ADMIN_ROLE)` only; the operator role
    deliberately cannot redirect where released funds go.
  - OpenZeppelin `AccessControl` (`OPERATOR_ROLE` distinct from `DEFAULT_ADMIN_ROLE`) +
    `ReentrancyGuard` on all three token-moving functions, plus checks-effects-interactions
    (status is finalized before the external token transfer) as defense in depth.
  - `bookingIdHash = keccak256(bytes(bookingId))`, computed identically on both sides.
  - Constructor takes `(tokenAddress, treasuryAddress, admin, operator)` — all four checked
    non-zero-address at deploy time.
- [x] `contracts/mocks/MockERC20.sol` — a minimal mintable ERC20 for tests, clearly separated
      from the real contract and never deployed to a real network.
- [x] Full Hardhat test suite (`test/FlightEscrow.ts`, viem-style, matching the existing
      toolbox convention) — **19 tests, all passing**: deployment + zero-address rejection for
      each of the 4 constructor args, deposit (success, double-deposit rejected, zero-amount
      rejected, missing-approval rejected), release (success + moves funds to treasury,
      non-operator rejected, undeposited hash rejected, double-release rejected), refund
      (success + returns funds to payer, non-operator rejected, undeposited hash rejected,
      refund-after-release rejected), and `setTreasury` (admin succeeds, operator/others
      rejected).
- [ ] **Not yet done**: actual deployment to Celo Sepolia. The Ignition module
      (`ignition/modules/FlightEscrow.ts`) is written and takes `tokenAddress`/
      `treasuryAddress`/`adminAddress`/`operatorAddress` as required `--parameters` (no
      fallback defaults — a real deploy should never silently pick up a placeholder address).
      Deploying needs a funded Sepolia deployer key and real treasury/operator addresses,
      none of which exist yet — do this once Phase 5 is ready to actually integrate against a
      live contract address, not before.
- [x] **Resolved**: Celo Sepolia has no cUSD at all. Verified directly against the chain (not
      just docs, which gave inconsistent answers): mainnet's dollar stablecoin is cUSD at
      `0x765DE816845861e75A25fCA122bb6898B8B1282a` (unchanged, still real). Celo Sepolia's
      equivalent is a *different* contract, Mento Dollar (USDm), at
      `0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b` — confirmed via `eth_getCode` (real deployed
      bytecode) and `decimals()` (18, matching cUSD's convention). The app now calls this asset
      "USDm" everywhere (env var `USDM_TOKEN_ADDRESS`, UI labels) — on mainnet that variable
      still points at the real cUSD contract (there's no separate mainnet "USDm"), it's just
      named consistently with testnet now. See Phase 8 for the Mento swap mechanics needed to
      actually acquire test USDm on Sepolia.
- [ ] `tsc --noEmit` on `apps/contracts` reports real errors on the new test file (missing
      `chai-as-promised` type declarations, `hre.viem` contract-name overloads not resolving
      outside Hardhat's own compile/test pipeline) — **pre-existing across the whole scaffold**,
      not introduced here: the deleted `Lock.ts` used the exact same assertion patterns, no
      `@types/chai-as-promised` was ever a dependency, and this package has no `typecheck`
      script of its own (unlike `apps/api`/`apps/web`). `hardhat compile` and `hardhat test`
      are this package's real correctness gates, and both are clean. Worth adding
      `@types/chai-as-promised` at some point for better editor feedback, but it's a
      pre-existing gap, not a regression from this phase.

---

## Phase 5 — Payments module ✅ done, verified end-to-end on a local chain

**Network decision**: built and configured against **Celo mainnet** (chainId 42220,
`CELO_RPC_URL=https://forno.celo.org`, mainnet USDm/cUSD address) per explicit instruction —
Phase 4's original "testnet first" plan was skipped for the *network target*. Actual
deployment/operation still needs real values this session doesn't have and shouldn't invent:
a funded mainnet deployer + operator key, and a real treasury address. `ESCROW_CONTRACT_ADDRESS`,
`OPERATOR_PRIVATE_KEY`, and `TREASURY_ADDRESS` are left blank in `.env`/`.env.example` — never
filled with placeholders.

- [x] `CeloService` (`apps/api/src/payments/celo.service.ts`) — owns the viem public/wallet
      clients, lazily configured (same reasoning as `AmadeusAuthService`: the app boots fine
      without these vars set; only an actual payment call needs them). Exposes
      `bookingIdHash()`, `toTokenAmount()` (USD cents → 18-decimal token wei),
      `getTransactionReceipt()`, `decodeDepositedLogs()`, `getEscrow()`, `release()`, `refund()`.
      ABI is hand-written (`lib/flight-escrow-abi.ts`) — just the surface actually
      called/decoded, kept in sync by hand with `FlightEscrow.sol` since the two packages
      don't share a build step.
- [x] `POST /payments/bookings/:id/initiate` — returns `{ contractAddress, tokenAddress,
      amount, bookingIdHash }` (no redirect URL). Idempotent: calling it again for the same
      booking returns the same quote rather than creating a second `Payment` row (the 1:1
      `Booking.payment` relation makes this natural). Rejects if the booking has no flight
      reservation yet, isn't in USD, or is already `SUCCEEDED`.
- [x] `POST /payments/bookings/:id/confirm` — verifies the receipt (`status === 'success'`,
      `to === escrowContractAddress`, decodes the `Deposited` log and checks
      `bookingIdHash`/`amount` match), records `depositTxHash`, then calls `release()` and
      records `releaseTxHash` + flips `Booking.status` to `CONFIRMED`. Retriable: if
      verification already happened but `release()` itself failed, calling again skips
      re-verification and just retries the release.
- [x] `POST /payments/bookings/:id/refund` — gated by a new `OpsSecretGuard`
      (`common/guards/ops-secret.guard.ts`, shared-header check against `OPS_SECRET`) rather
      than a real admin role, pulling forward a small piece of Phase 7 since Phase 5 needs
      somewhere to call `refund()` from. **Resolves the open question below**: refuses with a
      clear 400 if the payment is already `SUCCEEDED` ("already released to the treasury —
      requires a manual treasury transfer, not this endpoint") rather than attempting (and
      failing on-chain) or silently no-op'ing.
- [x] No Stripe/Paystack gateway files ever existed in this app to remove (Phase 0 already
      built the schema/DTOs without them) — this bullet from the original plan was already
      satisfied by construction.
- [x] **Open question resolved**: `refund()` only ever works pre-release (both the contract's
      own `Deposited`-only `require` and now the service-level check above enforce this). A
      refund after release is explicitly out of automated scope — it needs a manual
      treasury-side transfer, which this backend deliberately does not attempt since it
      doesn't hold the treasury's key.
- [x] **Verified end-to-end against a local Hardhat network** (not real mainnet — no funded
      key/contract exists yet, see above). Fixed a real bug during this: `hardhat node`'s
      accounts aren't exposed as raw private keys through `hre.viem` (the node signs for its
      own accounts), so `apps/contracts/scripts/deploy-local.ts` (a new, reusable local-only
      deploy helper — never point it at mainnet/Sepolia, it deploys a fake token) hardcodes
      the well-known Hardhat default-mnemonic keys for the accounts it needs.
      Full real flow exercised: SIWE login → real Amadeus search/booking (Turkish Airlines,
      IST→LHR, real PNR issued) → `initiate` → customer wallet `approve`+`deposit` on the
      locally-deployed `FlightEscrow` → `confirm` → verified the treasury's on-chain balance
      increased by exactly the expected amount, `Booking.status` reached `CONFIRMED`. Then
      confirmed refund-after-release is correctly rejected (400), and — via a direct DB write
      to reach the "deposit verified, not yet released" state confirm() doesn't leave lying
      around in practice — that a genuine pre-release refund correctly returns funds to the
      customer's wallet (balance restored by exactly the deposited amount) and flips
      `Booking.status` to `CANCELLED`. All test data cleaned up afterward; the real
      mainnet-configured `.env` was backed up before the local swap and restored after.

---

## Phase 6 — Frontend (customer flows only) ✅ done

Re-implemented with the already-scaffolded shadcn/ui + Tailwind + wagmi stack — no `@adryx/ui`
pulled in, and no new Radix dependencies added either (see below).

- [x] Added the handful of shadcn primitives the port needed that didn't exist yet —
      `Input`, `Select`, `Badge`, `Skeleton` (`components/ui/*`). `Select` is a styled native
      `<select>`, not a Radix dropdown — nothing here needs custom option rendering, so the
      extra dependency wasn't worth it. Same reasoning for checkboxes: plain styled native
      inputs inline (FilterSidebar's airline filter, PassengerFields' "save traveler" toggle),
      no dedicated `Checkbox` component for two call sites.
- [x] Flight search: `SearchForm` (new — adryxflight's version had a hotels tab and used
      `iconsax-react`/`@adryx/ui`'s `DatePicker`; this one is flights-only, native
      `<input type="date">`, `lucide-react` icons) on the homepage, `FilterSidebar`,
      `FlightResultCard`, `AirlineLogo` (same gstatic CDN, added to
      `next.config.js`'s `images.remotePatterns`), `AirportAutocomplete` (native input,
      `lucide-react`'s `MapPin` instead of iconsax) at `app/flights/search`.
- [x] Booking page (`app/flights/book`) — `PassengerFields` ported (gender required; expiry +
      issuing country required for all document types; nationality/issuing-country
      normalized to 2-letter uppercase **in this component**, never server-side). No discount
      code section — `DiscountCode` was dropped from the schema back in Phase 0.
- [x] Booking success state shows the real PNR and a link to the booking detail page.
- [x] Payment step: `DepositCard` (new, replacing `PayNowCard`'s redirect-to-gateway
      behavior) — calls `initiate`, runs `approve` (viem's built-in `erc20Abi`) then
      `deposit` via wagmi's `useWalletClient`/`usePublicClient` against the connected wallet,
      waits for each receipt client-side, then calls `confirm` with the deposit tx hash.
      Used both on the booking success state and the booking detail page (shown whenever a
      booking is `PENDING` and not yet `SUCCEEDED`).
- [x] Booking detail page (`app/bookings/[id]`) — PNR box, itinerary with airline logos,
      passenger list, price breakdown; deposit/release/refund tx hashes link to
      `celoscan.io/tx/{hash}` (mainnet) where payment status is shown.
- [x] Hide-Connect-Wallet-in-MiniPay was **already fully done** before this phase started —
      `connect-button.tsx`'s `isMiniPay` check (`if (isMinipay) return null;`) was already
      in the original scaffold; Phase 1 had already fixed the one thing wrong with it
      (`navbar.tsx` referencing an undefined component instead of this one). No new work
      needed here, just confirmed it's still correct.
- [x] Fixed one new lint finding along the way: `FlightResultCardProps.children` (a
      passenger count, mirroring the backend's `FlightSearchResponse.children` field name)
      collided with React's special `children` prop and tripped
      `react/no-children-prop`. Renamed to `childrenCount` in this component only — the
      backend-matching field name stays as `children` everywhere else (DTOs, response
      types) since only this one React prop needed to differ.
- [x] **Verified**: `tsc --noEmit`, `next lint`, and `next build` are all clean; the dev
      server serves all four routes (`/`, `/flights/search`, `/flights/book`,
      `/bookings/[id]`) with no compile errors. Cross-checked the real (mainnet-configured)
      API's actual JSON responses for `/flights/airports` and `/flights/search` against
      this phase's TypeScript interfaces — they match field-for-field.
  - **Not verified**: no browser-automation tool was available this session (same
    limitation as Phase 1), so the actual in-browser flows — airport autocomplete
    dropdown, the full search → book → `DepositCard`'s approve/deposit/confirm click-through
    with a real wallet — were not clicked through end-to-end in a real browser. The
    `DepositCard` logic mirrors the exact wagmi call shapes already proven correct
    server-side in Phase 5's real on-chain test, and everything else is typechecked, linted,
    built, and shape-verified against the live API, but a real click-through is still worth
    doing before calling this phase fully closed.

**Addendum — mobile bottom navigation** (requested after Phase 6, not in the original plan):

- [x] `components/bottom-nav.tsx` — a fixed 3-tab bar (Search/Trips/Account, `lucide-react`
      icons, active-tab highlighting via `usePathname()`), `sm:hidden` so it only shows on
      mobile — this is a MiniPay mini app, meant to feel like a native mobile app when opened
      inside MiniPay's in-app browser, not a desktop site. Respects
      `env(safe-area-inset-bottom)` for phones with a home-indicator bar.
- [x] Two new pages needed real destinations for "Trips" and "Account" to point at, since
      neither existed yet: `/bookings` (list view over `bookingsApi.list()`, reusing the
      status-badge/PNR pattern from the detail page) and `/account` (wallet address + balances
      via the already-existing `UserBalance` component, contact details from the SIWE session,
      a disconnect action wired to both wagmi's `useDisconnect` and clearing the auth store).
- [x] Added both to the desktop `Navbar` too (`navLinks`) — the bottom nav is mobile-only, so
      desktop needed its own way to reach these without a dead end.
- [x] `tsc --noEmit`, `next lint`, and `next build` all clean; confirmed both new routes serve
      200 and the tab labels render in the actual page HTML.

---

## Phase 7 — Minimal ops mechanism (not a UI) ✅ done (built ahead of schedule in Phase 5)

Deliberately small scope — this app has no admin panel.

- [x] `POST /payments/bookings/:id/refund`, gated by `OpsSecretGuard` (a shared secret header,
      `X-Ops-Secret` matched against `OPS_SECRET`) — this was already built in Phase 5 because
      the payments module needed somewhere for refund() to be called from as soon as it
      existed. Exercised end-to-end in Phase 5's local-chain verification (pre-release refund
      succeeded, post-release refund correctly rejected with a clear message). Nothing left to
      build here.
- [ ] Revisit building a real ops UI only if this app gets enough real usage to need one.

---

## Phase 8 — Testing & rollout (in progress)

**Explicit decision: mainnet only, no Celo Sepolia dry run.** The original plan below (testnet
first, promote to mainnet only after a clean run) was superseded by direct instruction —
flagged the risk once (first live-network run is with real funds, no dry run) and the user
confirmed mainnet-only is intentional. Proceeding on that basis.

- [x] Testnet research done before the mainnet-only call, kept here for reference in case a
      dry run is ever wanted later: real Mento Sepolia contracts confirmed directly on-chain
      (not just docs, which gave inconsistent/outdated answers) — Broker
      `0xB9Ae2065142EB79b6c5EB1E8778F883fad6B07Ba`, BiPoolManager
      `0xeCB3C656C131fCd9bB8D1d80898716bD684feb78`, CELO/USDm `exchangeId`
      `0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c`, USDm token
      `0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b` — validated by actually calling
      `getAmountOut` on the Broker and getting back a real, sane quote (not a revert). The
      three throwaway testnet keypairs generated for this are unused now (worthless, testnet
      only, safe to leave as-is or discard).
- [x] **Dual-asset payments added** (requested mid-Phase-8, before deployment): MiniPay
      wallets hold USDm; wallets connected outside MiniPay more commonly hold native CELO than
      a Mento stable, so the whole payment path now supports both, chosen automatically via
      `useIsMiniPay()`.
  - `FlightEscrow.sol`: added `depositNative(bytes32 bookingIdHash) payable`; `Escrow` gained
    an `isNative` flag; `release()`/`refund()` branch on it to move either the ERC20 or raw
    CELO; `Deposited`/`Released`/`Refunded` events all gained an `isNative` field. `deposit()`
    (ERC20) is unchanged. One deposit per booking still holds regardless of which entry point
    was used — cross-checked with tests that hitting the *other* path on an already-used hash
    is rejected the same as double-hitting the same one.
  - Test suite grew from 19 → **26 passing tests** — full native-path coverage (deposit,
    double-deposit rejected, zero-value rejected, cross-path rejection both directions,
    release moves CELO to treasury, refund returns CELO to payer).
  - Backend: `Payment` gained `isNative Boolean` and `tokenAddress` became nullable (null for
    native deposits) — pushed to both the local dev DB and the real Aiven DB (additive only).
    `POST /payments/bookings/:id/initiate` now takes `{ asset: "USDM" | "CELO" }`; for CELO it
    quotes a live CELO amount via Mento's Broker (`getAmountIn`) rather than a fixed
    conversion, since CELO floats against the dollar unlike USDm. That quote is a **price
    reference only** — the escrow never calls Mento, it just custodies whichever asset arrives.
    `confirm()` now accepts either asset's `Deposited` event and, for CELO, checks the
    deposited amount against a **fresh** quote with a 3% tolerance (not the stale
    initiate-time one) — CELO's price can move in the seconds between quoting and the deposit
    landing, so an exact-match check would be wrong here, unlike USDm's exact peg check.
  - Real Mento mainnet addresses confirmed the same way as testnet (on-chain, not just docs):
    Broker `0x777A8255cA72412f0d706dc03C9D1987306B4CaD`, BiPoolManager
    `0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901`, CELO/cUSD `exchangeId`
    `0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c` (same id as testnet —
    plausible, Mento's exchangeId is a deterministic hash of pool parameters, not coincidence)
    — validated with a real `getAmountOut` quote (1 CELO ≈ 0.0686 cUSD at query time).
  - Frontend: extracted the duplicated `window.ethereum.isMiniPay` check (previously inline in
    both `wallet-provider.tsx` and `connect-button.tsx`) into a shared `useIsMiniPay()` hook.
    `DepositCard` now picks the asset from that hook and branches the wagmi call: MiniPay →
    `approve` + `deposit` (unchanged); everyone else → `depositNative` with the quoted value,
    no approval step.
  - **Fully verified locally, end to end, for both assets** — not just unit tests. Built a
    `MockMentoBroker.sol` fixture (fixed 1 CELO = 10 USDm rate, kept in `contracts/mocks/` for
    future re-verification) so the live-quote step could run against a local Hardhat node too.
    Ran the *real* API against a real (local) DB and chain: SIWE login → real Amadeus
    search/booking (Turkish Airlines, real PNR) → `initiate` → deposit → `confirm` → `release`,
    once for each asset, asserting the treasury's on-chain balance moved by exactly the
    expected amount both times. Also re-verified the refund path specifically for native CELO
    (via the same direct-DB "deposited but not released" simulation used in Phase 5) — customer
    balance restored exactly, booking `CANCELLED`. The real (mainnet-configured) `.env` was
    backed up before this local round and restored after; the temporary chain-31337 Mento
    config entry was removed from `celo.service.ts` afterward (production code only knows
    about real mainnet/Sepolia Mento addresses).
  - **Not yet verified**: the actual in-browser wallet click-through for either asset (same
    browser-automation-tool limitation noted in Phase 6) — the wagmi call shapes match what's
    now proven correct server-side, but a real MiniPay/RainbowKit click-through with a real
    wallet hasn't been exercised.
- [x] **Mainnet deployment — done.** The user provided a funded deployer key
      (`0x86299D48002f3f19ad340d002391d9893F29a6f1`, confirmed ~6.59 CELO before deploying)
      and chose to reuse that same address as admin, treasury, and operator (one key doing
      all three jobs — a deliberate simplicity-over-separation tradeoff, flagged and
      confirmed before proceeding).
  - **Hardhat Ignition doesn't work against Celo mainnet** — hit a real provider
    compatibility bug: `ProviderError: invalid argument 0: json: cannot unmarshal hex string
    without 0x prefix into Go value of type common.Address`, coming from Ignition's
    nonce-sync path (`getNonceSyncMessages` → `EIP1193JsonRpcClient.getTransactionCount`)
    against Celo's Go-based node. Not a config or key problem — confirmed by testing the
    exact same `eth_getTransactionCount` call directly against `forno.celo.org` via curl
    (worked fine, both `"pending"`/`"latest"` tags, both single and batched requests) — the
    bug is specifically in how Hardhat's `LocalAccountsProvider` re-serializes the address
    somewhere in that call chain. **Worked around by deploying directly via viem**
    (`walletClient.deployContract` against the compiled Hardhat artifact) instead of Ignition
    — same approach already proven reliable all session for every other on-chain
    interaction. `ignition/modules/FlightEscrow.ts` is still there and correct; it's Hardhat
    Ignition's Celo-mainnet compatibility that's broken, worth revisiting if a future Hardhat
    release fixes it, but not blocking.
  - **Deployed contract**: `0xf3466c86a2c884427b0456a84bcd809fac5d4e77` on Celo mainnet.
    Deploy tx `0x6cd3fae44ae23a32c66d973a42b7bb14023b85cc5ff8069f80e551b732be4f45` (gas used:
    1,038,111). Verified post-deploy by reading the contract's own state back on-chain (not
    just trusting a "success" status): `token()` = the real cUSD/USDm address, `treasury()` =
    the expected address, `hasRole(DEFAULT_ADMIN_ROLE, ...)` and
    `hasRole(OPERATOR_ROLE, ...)` both `true` for that same address.
  - `apps/api/.env` updated with the real `ESCROW_CONTRACT_ADDRESS`, `OPERATOR_PRIVATE_KEY`,
    `TREASURY_ADDRESS`. API rebuilt and restarted against it; health check confirms it's up.
  - **Not yet done**: an actual real-money booking → deposit → confirm → release run through
    this live contract. Deploying and verifying the deployment is not the same as exercising
    a real payment against it — that's the natural next step whenever ready to test with real
    funds (small-value, first-run, exactly as flagged when mainnet-only was decided).
- [x] **Temporary fixed test charge** (requested once live on mainnet, "since it's still in
      test"): `PaymentsService` now charges a flat **0.1 USDm** or **1 CELO** for every
      booking, regardless of the real flight price — `initiate()` and `verifyDeposit()` in
      `apps/api/src/payments/payments.service.ts` use two new constants
      (`TEST_FIXED_USDM_AMOUNT`/`TEST_FIXED_CELO_AMOUNT`) instead of
      `booking.totalAmountMinor`. The UI is unaffected — every displayed price (search
      results, booking form, booking detail totals) still reads `booking.totalAmountMinor`
      directly and was never touched; `DepositCard` never displayed a numeric amount to begin
      with, so there was nothing there to change either. **To revert to real pricing**: delete
      the two constants and their doc comment, and use `this.celo.toTokenAmount(...)` /
      `await this.celo.quoteNativeAmountForUsd(...)` again in both places — that real-pricing
      code path (including the live Mento quote and the 3%-tolerance native-amount check) was
      left completely untouched in `CeloService`, just unused while this override is active.
      **Do this before any real customer-facing launch** — right now every booking is
      underpriced by design.
- [ ] MiniPay app-directory submission — check `docs.minipay.xyz` directly for current
      submission/listing requirements before that step; nothing manifest-file-shaped turned
      up in search, so distribution may just be a listing request rather than a manifest to
      author.

---

## Environment variables (apps/api) — as actually built (see apps/api/.env.example)

```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
CORS_ORIGINS=
SIWE_DOMAIN=
SIWE_URI=
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
AMADEUS_ENV=test                            # "test" or "production" — always explicit
CELO_RPC_URL=https://forno.celo.org         # mainnet-only, per explicit decision — see Phase 8
CHAIN_ID=42220
USDM_TOKEN_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a   # mainnet's cUSD contract, called USDm here for naming consistency with testnet
ESCROW_CONTRACT_ADDRESS=                    # blank until FlightEscrow is actually deployed
OPERATOR_PRIVATE_KEY=                       # backend's release()/refund() signer — treat like a production secret
TREASURY_ADDRESS=
OPS_SECRET=                                 # gates POST /payments/bookings/:id/refund
```

## Open questions to revisit (not blocking Phase 0 start)

- Whether `DiscountCode` is in scope for v1.
- Exact refund-after-release handling (Phase 5's open question above).
- MiniPay listing/submission requirements — check `docs.minipay.xyz` when we're actually
  ready to distribute, not before.
- Whether USDC support is needed alongside USDm, or USDm-only is fine for v1.
