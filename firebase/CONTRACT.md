# EthioTaxi CONTRACT (Immutable after Stage-2 update)

This document defines the stable backend contract for Stage 2 (Admin) and Stage 3 (Mobile).
Do not change identifiers, collection paths, or function payloads without a deliberate migration plan.

---

## 0) Key Rules (Latest)

### Identifiers
- **plate** is the **unique** vehicle identifier citywide (**PRIMARY ID**).
- tapela is **optional metadata** (NOT unique).
- vin optional.

### Roles (authenticated)
- DRIVER
- ENFORCER
- AUTHORITY
- ADMIN

Passengers do NOT login.

---

## 1) Firestore Collections (Latest)

### users/{uid}
- role: DRIVER|ENFORCER|AUTHORITY|ADMIN (string)
- plate: string|null (linked plate for DRIVER)
- employeeId: string|null (for ENFORCER/AUTHORITY)
- contractEndAt: timestamp|null (ENFORCER contract end date)
- disabled: boolean
- createdAt, updatedAt, lastLoginAt

### vehicles/{plate}  (PRIMARY vehicle registry)
- status: ACTIVE|SUSPENDED|REVOKED
- seatCapacity: number (required)
- ownerName?: string|null
- ownerPhone?: string|null
- vin?: string|null
- tapela?: string|null
- createdAt, updatedAt

### vehicles/{plate}/drivers/{uid}
- uid
- plate
- status: ACTIVE|SUSPENDED|REVOKED
- linkedAt
- linkedByEnforcerUid
- lastVerifiedAt
- verificationExpiresAt

### stations/{stationId}
- stationId
- nameAm, nameEn
- lat, lng
- waitingCount
- queueCount
- lastDispatchAt?
- createdAt, updatedAt

### stations/{stationId}/queue/{plate}
(doc id MUST be plate)
- plate
- uid (driver uid)
- status: WAITING
- joinedAt
- updatedAt

### driverClaims/{claimId}  (QR claim to verify DRIVER)
- claimId
- plate
- stationId?
- status: OPEN|USED|EXPIRED
- createdByEnforcerUid
- createdAt
- expiresAt
- usedByUid?
- usedAt?

### dispatchTokens/{tokenId}
- tokenId
- stationId
- plate
- status: ISSUED|READY|DISPATCHED|CANCELLED
- paymentAckId: string|null
- issuedByEnforcerUid
- issuedAt
- dispatchedAt?
- dispatchedByEnforcerUid?
- overrideReason?
- ratingId? (set if ratingTokenUniqueRequired)

### dispatchPaymentClaims/{claimId}
- claimId
- tokenId
- plate
- stationId
- status: OPEN|USED|EXPIRED
- amount (from config.stationDispatchFeeAmount)
- cityTelebirrPhone (from config.cityTelebirrPhone)
- createdByEnforcerUid
- createdAt
- expiresAt
- usedByUid?
- usedAt?

### paymentAcks/{ackId}
- ackId
- tokenId
- plate
- amount
- cityTelebirrPhone
- telebirrRef?
- createdByDriverUid
- createdAt

### designations/{designationId}
- designationId
- plate
- targetStationId
- note?
- status: OPEN|CLOSED
- createdAt
- createdByAuthorityUid
- closedAt?
- closedByAuthorityUid?
- closeNote?
- updatedAt

### designationChecks/{checkId}
- checkId
- designationId|null
- stationId
- plate
- driverUid
- tokenId?
- result: COMPLIED|DECLINED|NOT_APPLICABLE
- checkedAt
- checkedByEnforcerUid

### vehicleRatings/{ratingId}
Written only by HTTPS function (no client writes).
- ratingId
- plate
- rating (1..5)
- comment?
- proofType: VAN_QR|TOKEN_QR
- tokenId? (for TOKEN_QR)
- trustLevel: VERIFIED|UNVERIFIED
- createdAt
- ipHash (sha256)
- appCheckHash (sha256)

### auditLogs/{id}
- action
- actorUid?
- actorRole?
- stationId?
- plate?
- tapela?
- tokenId?
- employeeId?
- designationId?
- targetPath?
- meta?
- ts

### config/app
Must include:
- stationDispatchFeeAmount (default 20)
- cityTelebirrPhone (default "09XXXXXXXX")
- avgPassengersPerVan (default 10)
- contractExpiryWarnDays (default 30)
- driverClaimTTLMinutes (default 5)
- paymentClaimTTLMinutes (default 5)
- driverVerificationValidityDays (default 365)
- ratingRateLimitPerHourVerified (default 5)
- ratingRateLimitPerHourUnverified (default 2)
- ratingTokenUniqueRequired (default true)
  (legacy fields may remain)

---

## 2) Cloud Functions (Latest)

All callable functions are `https.onCall` unless noted.

### 2.1 Public Authenticated
#### upsertUserProfile()
Request: {}
Response: { ok: true }

### 2.2 Admin (callable; ADMIN allowlist/claim)
#### adminUpsertVehicle({ plate, seatCapacity, status, vin?, tapela?, ownerName?, ownerPhone? })
Response: { ok: true, plate }

#### adminUpsertEmployee({ employeeId, staffType: ENFORCER|AUTHORITY, status, contractEndAtMillis? })
Response: { ok: true }

#### adminApproveUserRole({ uid, role, employeeId?, contractEndAtMillis? })
Rules:
- ENFORCER/AUTHORITY require employeeId.
  Response: { ok: true }

#### adminSetConfig({...config fields...})
Response: { ok: true }

#### adminUpsertStation({ stationId, nameAm, nameEn, lat, lng })
Response: { ok: true }

### 2.3 Driver verification
#### createDriverClaim({ plate, stationId? }) // ENFORCER only
Response: { ok, claimId, expiresAtMillis, qr }

#### redeemDriverClaim({ claimId }) // any authed user
Response: { ok: true }
Errors:
- deadline-exceeded: Claim expired
- failed-precondition: Claim already used

### 2.4 Queue
#### checkInDriverToStation({ stationId }) // DRIVER only
Response: { ok: true }

#### joinQueue({ stationId }) // DRIVER only
Requires driver verification not expired; else:
- failed-precondition: REVERIFY_REQUIRED

#### leaveQueue({ stationId }) // DRIVER only

### 2.5 Demand
#### setWaitingCount({ stationId, waitingCountAbsolute }) // ENFORCER only
Rate limited.

### 2.6 Dispatch + payment ACK
#### issueDispatchToken({ stationId, plate, overrideReason? }) // ENFORCER only
Rules:
- If no overrideReason, plate must be first in queue by joinedAt.
  Response: { ok: true, tokenId }

#### createDispatchPaymentClaim({ tokenId }) // ENFORCER only
Response: { ok, claimId, amount, cityTelebirrPhone, expiresAtMillis, qr }

#### redeemDispatchPaymentClaim({ claimId, telebirrRef? }) // DRIVER only
Rules:
- driver plate must match claim plate
- sets token.status READY and token.paymentAckId
  Response: { ok: true, ackId }

#### markTokenDispatched({ tokenId }) // ENFORCER only
Rules:
- token.status must be READY and paymentAckId exists
  Response: { ok: true }

### 2.7 Designations
#### createDesignation({ plate, targetStationId, note? }) // AUTHORITY only
Response: { ok, designationId }

#### closeDesignation({ designationId, note? }) // AUTHORITY only
Response: { ok: true }

#### checkDesignationBeforeLoading({ stationId, plate, driverUid, tokenId?, result }) // ENFORCER only
Response: { ok, designationId, checkId }

### 2.8 Passenger rating (NO LOGIN)
#### submitVehicleRatingAnon (HTTPS)
- Requires Firebase App Check
  Input JSON:
  {
  plate: string,
  rating: 1..5,
  comment?: string,
  proofType: "VAN_QR"|"TOKEN_QR",
  tokenId?: string
  }
  Rules:
- TOKEN_QR validates token exists and matches plate
- Enforce one rating per token if config.ratingTokenUniqueRequired
- Best-effort rate limit per hour:
  - Verified bucket: config.ratingRateLimitPerHourVerified
  - Unverified bucket: config.ratingRateLimitPerHourUnverified
    Response:
    { ok: true, trustLevel: "VERIFIED"|"UNVERIFIED" }

---

## 3) Standard QR Payloads (compact JSON strings)
- VAN_QR:        {"t":"van","plate":"A-12345"}
- TOKEN_QR:      {"t":"token","tokenId":"<TOKEN_ID>","plate":"A-12345"}
- DRIVER_CLAIM:  {"t":"dclaim","claimId":"<CLAIM_ID>"}
- PAY_CLAIM:     {"t":"pay","claimId":"<PAYCLAIM_ID>"}

---

## 4) Legacy / Deprecated (tapela-based)
These exist for migration compatibility only.

### Deprecated functions (kept as shims)
- createVehicleClaim({ tapela, stationId? }) -> maps tapela -> plate or returns MIGRATION_REQUIRED
- redeemVehicleClaim({ claimId }) -> maps to redeemDriverClaim
- checkInHelperToStation -> maps to checkInDriverToStation

### Deprecated collections
- vehicleCredentials/{tapela} and subcollections
- vehicleClaims/{claimId}
- payments/{paymentId}
- rebalancingOrders/{orderId}

Admin + new mobile MUST use plate-based schema going forward.
