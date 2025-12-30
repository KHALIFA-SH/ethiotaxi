# EthioTaxi (Monorepo)

## Overview
EthioTaxi is a role-based system for Addis Ababa minivan taxis:
- Passengers: can view station demand (Stage 3)
- Helpers/Drivers: queue vehicles (Stage 3)
- Enforcers: set demand + issue dispatch tokens (Stage 3)
- Admin: approves enforcers (Stage 2)

Stage 1 delivers a strict Firebase backend (Auth + Firestore + Functions + Rules + Indexes) and proves it works via Emulator Suite.

## Repo structure
- `functions/` ✅ Stage 1 Cloud Functions (TypeScript)
- `firestore.rules` ✅ Stage 1 security rules (deny-by-default)
- `firestore.indexes.json` ✅ Stage 1 composite indexes
- `seed/` ✅ Stage 1 seed + optional test runner
- `admin/` (placeholder, Stage 2)
- `mobile/` (placeholder, Stage 3)

---

## Stage 1: Backend setup + emulator run + tests

### Prereqs
- Node.js 18+
- Firebase CLI:
  - `npm i -g firebase-tools`
- Login:
  - `firebase login`

### 1) Create dev Firebase project
1. Go to Firebase Console → Add project
2. Choose a project id (example: `ethioTaxi-dev-xxxxx`)
3. Update `.firebaserc`:
```json
{ "projects": { "default": "YOUR_DEV_PROJECT_ID" } }
```

### 2) Install dependencies
From repo root:
```bash
cd functions
npm i
npm run build
```

### 3) Start emulators
From repo root:
```bash
firebase emulators:start
```

Emulator UI:
- http://127.0.0.1:4000

### 4) Seed stations + config
In a new terminal (repo root):
```bash
node seed/seedStationsAndConfig.js --emulator
```

Verify in Emulator UI → Firestore:
- `stations/MEGENAGNA`
- `stations/TORHAYLOCH`
- `config/app`

### 5) Create test users and claims
With emulators still running:
```bash
node seed/createTestUsersAndClaims.js
```

This creates:
- `enforcer@test.com` (enforcer=true via custom claims)
- `helper@test.com` (no role initially)

### 6) Stage 1 Proof Checklist (Required)
Use either the automated runner OR manual steps.

#### Option A: Automated runner
```bash
cd functions
npm test
```

Expected:
- script completes without error
- documents appear in Firestore Emulator UI (vehicleClaims, dispatchTokens, payments, auditLogs)

#### Option B: Manual verification (Emulator UI)
1) **createVehicleClaim → redeemVehicleClaim**
- Call `createVehicleClaim` as enforcer → get `claimId`
- Call `redeemVehicleClaim` as helper → claim becomes REDEEMED
- Verify Firestore:
  - `vehicleClaims/{claimId}.status == "REDEEMED"`
  - `vehicleCredentials/A12345` exists
  - `vehicleCredentials/A12345/helpers/{helperUid}` exists
  - `users/{helperUid}.roles.helper == true`
  - `users/{helperUid}.primaryplate == "A12345"`
  - `auditLogs` has entries for create/redeem

2) **helper check-in + joinQueue increments queueCount**
- Call `checkInHelperToStation({stationId:"MEGENAGNA"})`
- Call `joinQueue({stationId:"MEGENAGNA"})`
- Verify:
  - `stations/MEGENAGNA.queueCount` increments
  - `stations/MEGENAGNA/queue/A12345` exists
  - `auditLogs` entries exist

3) **enforcer setWaitingCount updates waitingCount**
- Call `setWaitingCount({stationId:"MEGENAGNA", waitingCountAbsolute:40})`
- Verify:
  - `stations/MEGENAGNA.waitingCount == 40`
  - `waitingCountUpdatedBy` set
  - `auditLogs` entry exists

4) **issueDispatchToken creates payment+token, decrements queue & waiting**
- Call `issueDispatchToken({stationId:"MEGENAGNA", plate:"A12345", amount:50, telebirrRef:"TB-REF-001"})`
- Verify:
  - `payments/{paymentId}` exists with `paid==true`
  - `dispatchTokens/{tokenId}` exists with stationId/plate/paymentId
  - `stations/MEGENAGNA.queueCount` decremented by 1
  - `stations/MEGENAGNA.waitingCount` decremented by `config/app.avgPassengersPerVan` (default 10), never below 0
  - queue doc removed
  - `auditLogs` entry exists

5) **computeRebalancing creates order; helper accept works**
- Set `stations/MEGENAGNA.waitingCount` high (>=30) and queue low (<=2)
- Wait for scheduled function to run (every 2 minutes)
- Verify:
  - new `rebalancingOrders/{orderId}` created (status OPEN)
- Call `acceptRebalancingOrder({orderId})` as helper
- Verify:
  - `rebalancingOrders/{orderId}.acceptedBy.A12345` exists
  - `acceptedCount` increments
  - `vehicleCredentials/A12345.rebalancingCredits` increments
  - `auditLogs` entry exists

---

## Stage 2 (Admin Web) — placeholder
(To be filled in next stage)

## Stage 3 (Mobile App) — placeholder
(To be filled in next stage)
