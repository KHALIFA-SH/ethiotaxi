/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const ROLES = ["DRIVER", "ENFORCER", "AUTHORITY", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

type VehicleStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
type TokenStatus = "ISSUED" | "READY" | "DISPATCHED" | "CANCELLED";
type ClaimStatus = "OPEN" | "USED" | "EXPIRED";

const DEFAULT_CONFIG = {
  stationDispatchFeeAmount: 20,
  cityTelebirrPhone: "09XXXXXXXX",
  avgPassengersPerVan: 10,
  contractExpiryWarnDays: 30,
  driverClaimTTLMinutes: 5,
  paymentClaimTTLMinutes: 5,
  driverVerificationValidityDays: 365,
  ratingRateLimitPerHourVerified: 5,
  ratingRateLimitPerHourUnverified: 2,
  ratingTokenUniqueRequired: true,
};

function nowMillis() {
  return Date.now();
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function asString(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function mustAuth(ctx: functions.https.CallableContext) {
  if (!ctx.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required.");
  }
  return { uid: ctx.auth.uid, token: ctx.auth.token as any };
}

function claimHasRole(token: any, role: Role): boolean {
  // We support:
  // - token.role === "DRIVER"/...
  // - OR token.driver/enforcer/authority/admin === true
  if (typeof token?.role === "string" && token.role === role) return true;
  const key = role.toLowerCase();
  return token?.[key] === true;
}

function mustRole(ctx: functions.https.CallableContext, role: Role) {
  const { uid, token } = mustAuth(ctx);
  if (!claimHasRole(token, role)) {
    throw new functions.https.HttpsError("permission-denied", `Requires role: ${role.toLowerCase()}`);
  }
  return { uid, token };
}

async function loadConfig() {
  const snap = await db.doc("config/app").get();
  const data = (snap.exists ? snap.data() : {}) || {};
  return {
    ...DEFAULT_CONFIG,
    ...data,
  } as typeof DEFAULT_CONFIG;
}

async function writeAuditLog(params: {
  action: string;
  actorUid?: string | null;
  actorRole?: string | null;
  stationId?: string | null;
  plate?: string | null;
  tapela?: string | null;
  tokenId?: string | null;
  employeeId?: string | null;
  designationId?: string | null;
  targetPath?: string | null;
  meta?: any;
}) {
  const id = crypto.randomUUID();
  const payload: any = {
    action: params.action,
    actorUid: params.actorUid || null,
    actorRole: params.actorRole || null,
    stationId: params.stationId || null,
    plate: params.plate || null,
    tapela: params.tapela || null,
    tokenId: params.tokenId || null,
    employeeId: params.employeeId || null,
    designationId: params.designationId || null,
    targetPath: params.targetPath || null,
    meta: params.meta || null,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.doc(`auditLogs/${id}`).set(payload);
}

async function getUserDoc(uid: string) {
  return db.doc(`users/${uid}`);
}

async function ensureStationExists(stationId: string) {
  const ref = db.doc(`stations/${stationId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Station not found.");
  return ref;
}

/**
 * COMPAT SHIM: legacy tapela to plate mapping.
 * If a legacy call comes in, we try to map tapela -> plate by looking up vehicles where tapela ==.
 */
async function mapTapelaToPlateOrThrow(tapela: string): Promise<string> {
  const q = await db.collection("vehicles").where("tapela", "==", tapela).limit(1).get();
  if (q.empty) {
    throw new functions.https.HttpsError("failed-precondition", "MIGRATION_REQUIRED: tapela has no mapped plate.");
  }
  return q.docs[0].id; // vehicles/{plate} doc id
}

/**
 * ======================================================================
 * 1) upsertUserProfile()
 * ======================================================================
 */
export const upsertUserProfile = functions.https.onCall(async (data, ctx) => {
  const { uid, token } = mustAuth(ctx);

  const userRecord = await auth.getUser(uid);
  const email = userRecord.email || null;
  const displayName = userRecord.displayName || null;
  const photoURL = userRecord.photoURL || null;
  const providerIds = (userRecord.providerData || []).map((p) => p.providerId);

  const usersRef = await getUserDoc(uid);

  // Derive role from claims if available; otherwise keep existing or null.
  let derivedRole: Role | null = null;
  for (const r of ROLES) {
    if (claimHasRole(token, r)) {
      derivedRole = r;
      break;
    }
  }

  await usersRef.set(
    {
      uid,
      email,
      displayName,
      photoURL,
      providerIds,
      role: derivedRole || admin.firestore.FieldValue.delete(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      plate: null,
      employeeId: null,
      contractEndAt: null,
      disabled: false,
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "user:upsertProfile",
    actorUid: uid,
    actorRole: derivedRole || null,
    targetPath: `users/${uid}`,
  });

  return { ok: true };
});

/**
 * ======================================================================
 * ADMIN allowlist/claim gate for admin callables
 * ======================================================================
 */
function parseAdminAllowlist(): string[] {
  const raw = process.env.ADMIN_ALLOWLIST || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
async function mustAdmin(ctx: functions.https.CallableContext) {
  const { uid, token } = mustAuth(ctx);
  const email = asString(token?.email).toLowerCase();
  const allow = parseAdminAllowlist();
  const allowlisted = !!email && allow.includes(email);
  const isAdmin = claimHasRole(token, "ADMIN") || token?.admin === true;
  if (!isAdmin && !allowlisted) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  return { uid, token, email };
}

/**
 * ======================================================================
 * 2) ADMIN privileged functions (callable)
 * ======================================================================
 */

// adminUpsertVehicle({ plate, status, seatCapacity, vin?, tapela?, ownerName?, ownerPhone? })
export const adminUpsertVehicle = functions.https.onCall(async (data, ctx) => {
  const { uid } = await mustAdmin(ctx);

  const plate = asString(data?.plate).toUpperCase();
  if (!plate) throw new functions.https.HttpsError("invalid-argument", "plate is required.");

  const seatCapacity = asInt(data?.seatCapacity);
  if (!Number.isFinite(seatCapacity) || seatCapacity <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "seatCapacity must be > 0.");
  }

  const status = asString(data?.status) as VehicleStatus;
  const finalStatus: VehicleStatus = (["ACTIVE", "SUSPENDED", "REVOKED"].includes(status) ? status : "ACTIVE") as VehicleStatus;

  const payload: any = {
    status: finalStatus,
    seatCapacity,
    ownerName: asString(data?.ownerName) || null,
    ownerPhone: asString(data?.ownerPhone) || null,
    vin: asString(data?.vin) || null,
    tapela: asString(data?.tapela) || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.doc(`vehicles/${plate}`).set(payload, { merge: true });

  await writeAuditLog({
    action: "admin:upsertVehicle",
    actorUid: uid,
    actorRole: "ADMIN",
    plate,
    tapela: payload.tapela || null,
    targetPath: `vehicles/${plate}`,
  });

  return { ok: true, plate };
});

// adminUpsertEmployee({ employeeId, staffType: ENFORCER|AUTHORITY, status, contractEndAt? })
export const adminUpsertEmployee = functions.https.onCall(async (data, ctx) => {
  const { uid } = await mustAdmin(ctx);

  const employeeId = asString(data?.employeeId);
  if (!employeeId) throw new functions.https.HttpsError("invalid-argument", "employeeId is required.");

  const staffType = asString(data?.staffType);
  if (!["ENFORCER", "AUTHORITY"].includes(staffType)) {
    throw new functions.https.HttpsError("invalid-argument", "staffType must be ENFORCER or AUTHORITY.");
  }

  const status = asString(data?.status) || "ACTIVE";
  const contractEndAtMillis = data?.contractEndAtMillis ? asInt(data.contractEndAtMillis) : NaN;
  const contractEndAt = Number.isFinite(contractEndAtMillis)
    ? admin.firestore.Timestamp.fromMillis(contractEndAtMillis)
    : null;

  await db.doc(`employeeCredentials/${employeeId}`).set(
    {
      employeeId,
      staffType,
      status,
      contractEndAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "admin:upsertEmployee",
    actorUid: uid,
    actorRole: "ADMIN",
    employeeId,
    targetPath: `employeeCredentials/${employeeId}`,
    meta: { staffType, status, contractEndAt: contractEndAt ? contractEndAt.toDate().toISOString() : null },
  });

  return { ok: true };
});

// adminApproveUserRole({ uid, role, employeeId?, contractEndAt? })
export const adminApproveUserRole = functions.https.onCall(async (data, ctx) => {
  const { uid: adminUid } = await mustAdmin(ctx);

  const targetUid = asString(data?.uid);
  const role = asString(data?.role) as Role;

  if (!targetUid) throw new functions.https.HttpsError("invalid-argument", "uid is required.");
  if (!ROLES.includes(role)) throw new functions.https.HttpsError("invalid-argument", "Invalid role.");

  const employeeId = asString(data?.employeeId) || null;
  const contractEndAtMillis = data?.contractEndAtMillis ? asInt(data.contractEndAtMillis) : NaN;
  const contractEndAt = Number.isFinite(contractEndAtMillis)
    ? admin.firestore.Timestamp.fromMillis(contractEndAtMillis)
    : null;

  if ((role === "ENFORCER" || role === "AUTHORITY") && !employeeId) {
    throw new functions.https.HttpsError("invalid-argument", "employeeId required for ENFORCER/AUTHORITY.");
  }

  // Verify employee record exists if provided
  if (employeeId) {
    const empSnap = await db.doc(`employeeCredentials/${employeeId}`).get();
    if (!empSnap.exists) throw new functions.https.HttpsError("not-found", "Employee not found.");
  }

  // Set custom claims
  const claims: any = {
    role,
    driver: role === "DRIVER",
    enforcer: role === "ENFORCER",
    authority: role === "AUTHORITY",
    admin: role === "ADMIN",
  };
  await auth.setCustomUserClaims(targetUid, claims);

  await db.doc(`users/${targetUid}`).set(
    {
      role,
      employeeId: employeeId,
      contractEndAt: contractEndAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "admin:approveUserRole",
    actorUid: adminUid,
    actorRole: "ADMIN",
    employeeId: employeeId || null,
    targetPath: `users/${targetUid}`,
    meta: { role, contractEndAt: contractEndAt ? contractEndAt.toDate().toISOString() : null },
  });

  return { ok: true };
});

// adminSetConfig({ ... })
export const adminSetConfig = functions.https.onCall(async (data, ctx) => {
  const { uid } = await mustAdmin(ctx);

  const cfg = await loadConfig();
  const next = {
    stationDispatchFeeAmount: Number.isFinite(asInt(data?.stationDispatchFeeAmount)) ? asInt(data.stationDispatchFeeAmount) : cfg.stationDispatchFeeAmount,
    cityTelebirrPhone: asString(data?.cityTelebirrPhone) || cfg.cityTelebirrPhone,
    avgPassengersPerVan: Number.isFinite(asInt(data?.avgPassengersPerVan)) ? asInt(data.avgPassengersPerVan) : cfg.avgPassengersPerVan,
    contractExpiryWarnDays: Number.isFinite(asInt(data?.contractExpiryWarnDays)) ? asInt(data.contractExpiryWarnDays) : cfg.contractExpiryWarnDays,
    driverClaimTTLMinutes: Number.isFinite(asInt(data?.driverClaimTTLMinutes)) ? asInt(data.driverClaimTTLMinutes) : cfg.driverClaimTTLMinutes,
    paymentClaimTTLMinutes: Number.isFinite(asInt(data?.paymentClaimTTLMinutes)) ? asInt(data.paymentClaimTTLMinutes) : cfg.paymentClaimTTLMinutes,
    driverVerificationValidityDays: Number.isFinite(asInt(data?.driverVerificationValidityDays)) ? asInt(data.driverVerificationValidityDays) : cfg.driverVerificationValidityDays,
    ratingRateLimitPerHourVerified: Number.isFinite(asInt(data?.ratingRateLimitPerHourVerified)) ? asInt(data.ratingRateLimitPerHourVerified) : cfg.ratingRateLimitPerHourVerified,
    ratingRateLimitPerHourUnverified: Number.isFinite(asInt(data?.ratingRateLimitPerHourUnverified)) ? asInt(data.ratingRateLimitPerHourUnverified) : cfg.ratingRateLimitPerHourUnverified,
    ratingTokenUniqueRequired: data?.ratingTokenUniqueRequired === false ? false : true,
    thresholds: data?.thresholds || { waitingHigh: 30, queueLow: 2 }, // keep old field if you had it
  };

  await db.doc("config/app").set(
    {
      ...next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "admin:updateConfig",
    actorUid: uid,
    actorRole: "ADMIN",
    targetPath: "config/app",
    meta: next,
  });

  return { ok: true };
});

// adminUpsertStation({ stationId, nameAm, nameEn, lat, lng })
export const adminUpsertStation = functions.https.onCall(async (data, ctx) => {
  const { uid } = await mustAdmin(ctx);

  const stationId = asString(data?.stationId).toUpperCase();
  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId is required.");

  const nameAm = asString(data?.nameAm) || stationId;
  const nameEn = asString(data?.nameEn) || stationId;
  const lat = Number(data?.lat);
  const lng = Number(data?.lng);

  await db.doc(`stations/${stationId}`).set(
    {
      stationId,
      nameAm,
      nameEn,
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "admin:upsertStation",
    actorUid: uid,
    actorRole: "ADMIN",
    stationId,
    targetPath: `stations/${stationId}`,
  });

  return { ok: true };
});

/**
 * ======================================================================
 * 3) DRIVER verification (ENFORCER -> DRIVER)
 * ======================================================================
 */

// createDriverClaim({ plate, stationId? }) // ENFORCER only
export const createDriverClaim = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");
  const cfg = await loadConfig();

  const plate = asString(data?.plate).toUpperCase();
  if (!plate) throw new functions.https.HttpsError("invalid-argument", "plate is required.");

  const stationId = asString(data?.stationId).toUpperCase() || null;

  const claimId = crypto.randomUUID();
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMillis() + cfg.driverClaimTTLMinutes * 60_000);

  await db.doc(`driverClaims/${claimId}`).set({
    claimId,
    plate,
    stationId,
    status: "OPEN" as ClaimStatus,
    createdByEnforcerUid: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  });

  await writeAuditLog({
    action: "enforcer:createDriverClaim",
    actorUid: uid,
    actorRole: "ENFORCER",
    stationId,
    plate,
    targetPath: `driverClaims/${claimId}`,
  });

  return { ok: true, claimId, expiresAtMillis: expiresAt.toMillis(), qr: JSON.stringify({ t: "dclaim", claimId }) };
});

// redeemDriverClaim({ claimId }) // any authed user
export const redeemDriverClaim = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustAuth(ctx);
  const cfg = await loadConfig();

  const claimId = asString(data?.claimId);
  if (!claimId) throw new functions.https.HttpsError("invalid-argument", "claimId is required.");

  const claimRef = db.doc(`driverClaims/${claimId}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) throw new functions.https.HttpsError("not-found", "Claim not found.");

    const claim = claimSnap.data() as any;
    if (claim.status !== "OPEN") throw new functions.https.HttpsError("failed-precondition", "Claim already used.");
    const expiresAt: admin.firestore.Timestamp = claim.expiresAt;
    if (expiresAt && expiresAt.toMillis() < nowMillis()) {
      tx.update(claimRef, { status: "EXPIRED" as ClaimStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      throw new functions.https.HttpsError("deadline-exceeded", "Claim expired.");
    }

    const plate: string = claim.plate;

    // link driver under vehicles/{plate}/drivers/{uid} even if vehicle doc doesn't exist yet
    const linkRef = db.doc(`vehicles/${plate}/drivers/${uid}`);

    const lastVerifiedAt = admin.firestore.Timestamp.fromMillis(nowMillis());
    const verificationExpiresAt = admin.firestore.Timestamp.fromMillis(nowMillis() + cfg.driverVerificationValidityDays * 24 * 60 * 60_000);

    tx.set(
      linkRef,
      {
        uid,
        plate,
        status: "ACTIVE",
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        linkedByEnforcerUid: claim.createdByEnforcerUid || null,
        lastVerifiedAt,
        verificationExpiresAt,
      },
      { merge: true }
    );

    tx.set(
      userRef,
      {
        role: "DRIVER" as Role,
        plate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.update(claimRef, {
      status: "USED" as ClaimStatus,
      usedByUid: uid,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // set claims after DB success
  await auth.setCustomUserClaims(uid, {
    role: "DRIVER",
    driver: true,
    enforcer: false,
    authority: false,
    admin: false,
  });

  await writeAuditLog({
    action: "driver:redeemDriverClaim",
    actorUid: uid,
    actorRole: "DRIVER",
    targetPath: `driverClaims/${claimId}`,
  });

  return { ok: true };
});

/**
 * ======================================================================
 * 4) Queue (plate-based)
 * ======================================================================
 */

export const checkInDriverToStation = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "DRIVER");

  const stationId = asString(data?.stationId).toUpperCase();
  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId is required.");
  await ensureStationExists(stationId);

  await db.doc(`users/${uid}`).set(
    { lastStationId: stationId, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  await writeAuditLog({
    action: "driver:checkInStation",
    actorUid: uid,
    actorRole: "DRIVER",
    stationId,
    targetPath: `users/${uid}`,
  });

  return { ok: true };
});

// joinQueue({ stationId }) DRIVER only; queue doc id must be plate
export const joinQueue = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "DRIVER");

  const stationId = asString(data?.stationId).toUpperCase();
  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId is required.");
  await ensureStationExists(stationId);

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = (userSnap.data() || {}) as any;
  const plate = asString(user.plate).toUpperCase();
  if (!plate) throw new functions.https.HttpsError("failed-precondition", "NO_PLATE_LINKED: driver must be linked to a plate.");

  // require verification not expired
  const linkSnap = await db.doc(`vehicles/${plate}/drivers/${uid}`).get();
  const link = (linkSnap.data() || {}) as any;
  const expiresAt: admin.firestore.Timestamp | null = link.verificationExpiresAt || null;
  if (!expiresAt || expiresAt.toMillis() < nowMillis()) {
    throw new functions.https.HttpsError("failed-precondition", "REVERIFY_REQUIRED: driver verification expired.");
  }

  const stationRef = db.doc(`stations/${stationId}`);
  const queueRef = db.doc(`stations/${stationId}/queue/${plate}`);

  await db.runTransaction(async (tx) => {
    const [stSnap, qSnap] = await Promise.all([tx.get(stationRef), tx.get(queueRef)]);
    if (!stSnap.exists) throw new functions.https.HttpsError("not-found", "Station not found.");

    if (qSnap.exists) {
      const q = qSnap.data() as any;
      if (q.status === "WAITING") return; // idempotent
    }

    tx.set(
      queueRef,
      {
        plate,
        uid,
        status: "WAITING",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.update(stationRef, {
      queueCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    action: "driver:joinQueue",
    actorUid: uid,
    actorRole: "DRIVER",
    stationId,
    plate,
    targetPath: `stations/${stationId}/queue/${plate}`,
  });

  return { ok: true, plate };
});

export const leaveQueue = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "DRIVER");

  const stationId = asString(data?.stationId).toUpperCase();
  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId is required.");

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = (userSnap.data() || {}) as any;
  const plate = asString(user.plate).toUpperCase();
  if (!plate) throw new functions.https.HttpsError("failed-precondition", "NO_PLATE_LINKED.");

  const stationRef = db.doc(`stations/${stationId}`);
  const queueRef = db.doc(`stations/${stationId}/queue/${plate}`);

  await db.runTransaction(async (tx) => {
    const [stSnap, qSnap] = await Promise.all([tx.get(stationRef), tx.get(queueRef)]);
    if (!stSnap.exists) throw new functions.https.HttpsError("not-found", "Station not found.");
    if (!qSnap.exists) return;

    const q = qSnap.data() as any;
    if (q.status !== "WAITING") {
      tx.delete(queueRef);
      return;
    }

    tx.delete(queueRef);
    tx.update(stationRef, {
      queueCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    action: "driver:leaveQueue",
    actorUid: uid,
    actorRole: "DRIVER",
    stationId,
    plate,
    targetPath: `stations/${stationId}/queue/${plate}`,
  });

  return { ok: true };
});

/**
 * ======================================================================
 * 5) Demand
 * ======================================================================
 */
export const setWaitingCount = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");
  const stationId = asString(data?.stationId).toUpperCase();
  const waitingCountAbsolute = asInt(data?.waitingCountAbsolute);

  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId is required.");
  if (!Number.isFinite(waitingCountAbsolute) || waitingCountAbsolute < 0) {
    throw new functions.https.HttpsError("invalid-argument", "waitingCountAbsolute must be >= 0.");
  }

  // Basic rate limit: 1 update per 5 seconds per enforcer per station
  const key = `rateLimits/waitingCount:${uid}:${stationId}`;
  const ref = db.doc(key);
  const now = nowMillis();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists ? (snap.data() as any).lastAtMillis : 0;
    if (now - last < 5000) {
      throw new functions.https.HttpsError("resource-exhausted", "Rate limited. Try again in a few seconds.");
    }
    tx.set(ref, { lastAtMillis: now, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(
      db.doc(`stations/${stationId}`),
      { waitingCount: waitingCountAbsolute, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  await writeAuditLog({
    action: "enforcer:setWaitingCount",
    actorUid: uid,
    actorRole: "ENFORCER",
    stationId,
    targetPath: `stations/${stationId}`,
    meta: { waitingCountAbsolute },
  });

  return { ok: true };
});

/**
 * ======================================================================
 * 6) Dispatch + payment ACK
 * ======================================================================
 */

// issueDispatchToken({ stationId, plate, overrideReason? }) ENFORCER only
export const issueDispatchToken = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");
  const cfg = await loadConfig();

  const stationId = asString(data?.stationId).toUpperCase();
  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId is required.");

  const plateInput = asString(data?.plate).toUpperCase();
  if (!plateInput) throw new functions.https.HttpsError("invalid-argument", "plate is required.");

  const overrideReason = asString(data?.overrideReason) || null;

  const stationRef = db.doc(`stations/${stationId}`);
  const queueColl = db.collection(`stations/${stationId}/queue`);
  const queueRef = db.doc(`stations/${stationId}/queue/${plateInput}`);

  const tokenId = crypto.randomUUID();
  const tokenRef = db.doc(`dispatchTokens/${tokenId}`);

  await db.runTransaction(async (tx) => {
    const [stSnap, qSnap] = await Promise.all([tx.get(stationRef), tx.get(queueRef)]);
    if (!stSnap.exists) throw new functions.https.HttpsError("not-found", "Station not found.");
    if (!qSnap.exists) throw new functions.https.HttpsError("failed-precondition", "Vehicle not in queue.");
    const q = qSnap.data() as any;

    if (q.status !== "WAITING") {
      throw new functions.https.HttpsError("failed-precondition", "Vehicle not waiting.");
    }

    if (!overrideReason) {
      // Must be first in queue by joinedAt
      const first = await tx.get(queueColl.orderBy("joinedAt", "asc").limit(1));
      const firstDoc = first.docs[0];
      if (!firstDoc || firstDoc.id !== plateInput) {
        throw new functions.https.HttpsError("failed-precondition", "NOT_FIRST_IN_QUEUE: requires overrideReason.");
      }
    }

    const st = stSnap.data() as any;
    const waitingCount = Number(st.waitingCount || 0);
    const dec = cfg.avgPassengersPerVan;
    const nextWaiting = Math.max(0, waitingCount - dec);

    tx.set(tokenRef, {
      tokenId,
      stationId,
      plate: plateInput,
      status: "ISSUED" as TokenStatus,
      paymentAckId: null,
      issuedByEnforcerUid: uid,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      overrideReason,
    });

    // remove from queue and update counts
    tx.delete(queueRef);
    tx.update(stationRef, {
      queueCount: admin.firestore.FieldValue.increment(-1),
      waitingCount: nextWaiting,
      lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    action: "enforcer:issueDispatchToken",
    actorUid: uid,
    actorRole: "ENFORCER",
    stationId,
    plate: plateInput,
    tokenId,
    targetPath: `dispatchTokens/${tokenId}`,
    meta: { overrideReason },
  });

  return { ok: true, tokenId };
});

// createDispatchPaymentClaim({ tokenId }) ENFORCER only
export const createDispatchPaymentClaim = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");
  const cfg = await loadConfig();

  const tokenId = asString(data?.tokenId);
  if (!tokenId) throw new functions.https.HttpsError("invalid-argument", "tokenId is required.");

  const tokenRef = db.doc(`dispatchTokens/${tokenId}`);
  const claimId = crypto.randomUUID();
  const claimRef = db.doc(`dispatchPaymentClaims/${claimId}`);
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMillis() + cfg.paymentClaimTTLMinutes * 60_000);

  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) throw new functions.https.HttpsError("not-found", "Token not found.");
  const token = tokenSnap.data() as any;
  if (token.status !== "ISSUED") throw new functions.https.HttpsError("failed-precondition", "Token must be ISSUED.");

  await claimRef.set({
    claimId,
    tokenId,
    plate: token.plate,
    stationId: token.stationId,
    status: "OPEN" as ClaimStatus,
    amount: cfg.stationDispatchFeeAmount,
    cityTelebirrPhone: cfg.cityTelebirrPhone,
    createdByEnforcerUid: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  });

  await writeAuditLog({
    action: "enforcer:createDispatchPaymentClaim",
    actorUid: uid,
    actorRole: "ENFORCER",
    stationId: token.stationId,
    plate: token.plate,
    tokenId,
    targetPath: `dispatchPaymentClaims/${claimId}`,
  });

  return {
    ok: true,
    claimId,
    amount: cfg.stationDispatchFeeAmount,
    cityTelebirrPhone: cfg.cityTelebirrPhone,
    expiresAtMillis: expiresAt.toMillis(),
    qr: JSON.stringify({ t: "pay", claimId }),
  };
});

// redeemDispatchPaymentClaim({ claimId, telebirrRef? }) DRIVER only
export const redeemDispatchPaymentClaim = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "DRIVER");
  const cfg = await loadConfig();

  const claimId = asString(data?.claimId);
  if (!claimId) throw new functions.https.HttpsError("invalid-argument", "claimId is required.");

  const telebirrRef = asString(data?.telebirrRef) || null;

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = (userSnap.data() || {}) as any;
  const plate = asString(user.plate).toUpperCase();
  if (!plate) throw new functions.https.HttpsError("failed-precondition", "NO_PLATE_LINKED.");

  const claimRef = db.doc(`dispatchPaymentClaims/${claimId}`);
  const ackId = crypto.randomUUID();
  const ackRef = db.doc(`paymentAcks/${ackId}`);

  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) throw new functions.https.HttpsError("not-found", "Payment claim not found.");

    const claim = claimSnap.data() as any;
    if (claim.status !== "OPEN") throw new functions.https.HttpsError("failed-precondition", "Payment claim already used.");
    const expiresAt: admin.firestore.Timestamp = claim.expiresAt;
    if (expiresAt.toMillis() < nowMillis()) {
      tx.update(claimRef, { status: "EXPIRED" as ClaimStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      throw new functions.https.HttpsError("deadline-exceeded", "Payment claim expired.");
    }
    if (asString(claim.plate).toUpperCase() !== plate) {
      throw new functions.https.HttpsError("permission-denied", "Plate mismatch for payment claim.");
    }

    const tokenId = asString(claim.tokenId);
    const tokenRef = db.doc(`dispatchTokens/${tokenId}`);
    const tokenSnap = await tx.get(tokenRef);
    if (!tokenSnap.exists) throw new functions.https.HttpsError("not-found", "Token not found.");
    const token = tokenSnap.data() as any;
    if (token.status !== "ISSUED") throw new functions.https.HttpsError("failed-precondition", "Token must be ISSUED.");
    if (token.paymentAckId) throw new functions.https.HttpsError("failed-precondition", "Payment already acknowledged.");

    tx.set(ackRef, {
      ackId,
      tokenId,
      plate,
      amount: cfg.stationDispatchFeeAmount,
      cityTelebirrPhone: cfg.cityTelebirrPhone,
      telebirrRef,
      createdByDriverUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(tokenRef, {
      status: "READY" as TokenStatus,
      paymentAckId: ackId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(claimRef, {
      status: "USED" as ClaimStatus,
      usedByUid: uid,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    action: "driver:redeemDispatchPaymentClaim",
    actorUid: uid,
    actorRole: "DRIVER",
    plate,
    targetPath: `dispatchPaymentClaims/${claimId}`,
    meta: { telebirrRef },
  });

  return { ok: true, ackId };
});

// markTokenDispatched({ tokenId }) ENFORCER only
export const markTokenDispatched = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");

  const tokenId = asString(data?.tokenId);
  if (!tokenId) throw new functions.https.HttpsError("invalid-argument", "tokenId is required.");

  const tokenRef = db.doc(`dispatchTokens/${tokenId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Token not found.");
    const t = snap.data() as any;
    if (t.status !== "READY") throw new functions.https.HttpsError("failed-precondition", "Token must be READY.");
    if (!t.paymentAckId) throw new functions.https.HttpsError("failed-precondition", "Payment ACK required.");

    tx.update(tokenRef, {
      status: "DISPATCHED" as TokenStatus,
      dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
      dispatchedByEnforcerUid: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    action: "enforcer:markTokenDispatched",
    actorUid: uid,
    actorRole: "ENFORCER",
    tokenId,
    targetPath: `dispatchTokens/${tokenId}`,
  });

  return { ok: true };
});

/**
 * ======================================================================
 * 7) Designations
 * ======================================================================
 */

export const createDesignation = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "AUTHORITY");

  const plate = asString(data?.plate).toUpperCase();
  const targetStationId = asString(data?.targetStationId).toUpperCase();
  const note = asString(data?.note) || null;

  if (!plate) throw new functions.https.HttpsError("invalid-argument", "plate is required.");
  if (!targetStationId) throw new functions.https.HttpsError("invalid-argument", "targetStationId is required.");

  const id = crypto.randomUUID();
  await db.doc(`designations/${id}`).set({
    designationId: id,
    plate,
    targetStationId,
    note,
    status: "OPEN",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByAuthorityUid: uid,
    closedAt: null,
    closedByAuthorityUid: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeAuditLog({
    action: "authority:createDesignation",
    actorUid: uid,
    actorRole: "AUTHORITY",
    plate,
    designationId: id,
    targetPath: `designations/${id}`,
    meta: { targetStationId, note },
  });

  return { ok: true, designationId: id };
});

export const closeDesignation = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "AUTHORITY");
  const designationId = asString(data?.designationId);
  const note = asString(data?.note) || null;

  if (!designationId) throw new functions.https.HttpsError("invalid-argument", "designationId is required.");

  await db.doc(`designations/${designationId}`).set(
    {
      status: "CLOSED",
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      closedByAuthorityUid: uid,
      closeNote: note,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "authority:closeDesignation",
    actorUid: uid,
    actorRole: "AUTHORITY",
    designationId,
    targetPath: `designations/${designationId}`,
    meta: { note },
  });

  return { ok: true };
});

// checkDesignationBeforeLoading({ stationId, plate, driverUid, tokenId?, result })
export const checkDesignationBeforeLoading = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");

  const stationId = asString(data?.stationId).toUpperCase();
  const plate = asString(data?.plate).toUpperCase();
  const driverUid = asString(data?.driverUid);
  const tokenId = asString(data?.tokenId) || null;
  const result = asString(data?.result); // COMPLIED | DECLINED | NOT_APPLICABLE

  if (!stationId) throw new functions.https.HttpsError("invalid-argument", "stationId required.");
  if (!plate) throw new functions.https.HttpsError("invalid-argument", "plate required.");
  if (!driverUid) throw new functions.https.HttpsError("invalid-argument", "driverUid required.");
  if (!["COMPLIED", "DECLINED", "NOT_APPLICABLE"].includes(result)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid result.");
  }

  // Find open designation for plate (best-effort)
  const open = await db.collection("designations").where("plate", "==", plate).where("status", "==", "OPEN").limit(1).get();
  const designationId = open.empty ? null : open.docs[0].id;

  const checkId = crypto.randomUUID();
  await db.doc(`designationChecks/${checkId}`).set({
    checkId,
    designationId,
    stationId,
    plate,
    driverUid,
    tokenId,
    result,
    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    checkedByEnforcerUid: uid,
  });

  await writeAuditLog({
    action: "enforcer:designationCheck",
    actorUid: uid,
    actorRole: "ENFORCER",
    stationId,
    plate,
    tokenId,
    designationId,
    targetPath: `designationChecks/${checkId}`,
    meta: { result, driverUid },
  });

  return { ok: true, designationId, checkId };
});

/**
 * ======================================================================
 * 8) Passenger rating (NO AUTH) — HTTPS
 * ======================================================================
 */

function requireAppCheck(req: functions.https.Request) {
  // App Check token is sent in this header by Firebase SDK
  const token = req.header("X-Firebase-AppCheck");
  if (!token) throw new functions.https.HttpsError("unauthenticated", "App Check required.");
  return token;
}

async function checkRateLimit(params: {
  bucket: "VERIFIED" | "UNVERIFIED";
  keyMaterial: string;
  limitPerHour: number;
}) {
  const hour = Math.floor(nowMillis() / 3600000);
  const docId = `rating:${params.bucket}:${sha256(params.keyMaterial)}:${hour}`;
  const ref = db.doc(`rateLimits/${docId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data() as any).count || 0 : 0;
    if (count >= params.limitPerHour) {
      throw new functions.https.HttpsError("resource-exhausted", "RATE_LIMITED");
    }
    tx.set(
      ref,
      {
        bucket: params.bucket,
        hour,
        count: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export const submitVehicleRatingAnon = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
      return;
    }

    const cfg = await loadConfig();

    // Require App Check
    const appCheckToken = requireAppCheck(req);
    try {
      await admin.appCheck().verifyToken(appCheckToken);
    } catch {
      res.status(401).json({ error: "APP_CHECK_INVALID" });
      return;
    }

    const body = req.body || {};
    const plate = asString(body.plate).toUpperCase();
    const rating = asInt(body.rating);
    const comment = asString(body.comment) || null;
    const proofType = asString(body.proofType); // VAN_QR | TOKEN_QR
    const tokenId = asString(body.tokenId) || null;

    if (!plate) {
      res.status(400).json({ error: "plate required" });
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be 1..5" });
      return;
    }
    if (!["VAN_QR", "TOKEN_QR"].includes(proofType)) {
      res.status(400).json({ error: "proofType must be VAN_QR or TOKEN_QR" });
      return;
    }

    // identify rate-limit key: best effort (ip hash + appcheck hash)
    const ip = (req.header("x-forwarded-for") || req.ip || "unknown").split(",")[0].trim();
    const ipHash = sha256(ip);
    const appCheckHash = sha256(appCheckToken);
    const keyMaterial = `${ipHash}:${appCheckHash}`;

    let trustLevel: "VERIFIED" | "UNVERIFIED" = "UNVERIFIED";

    // Token QR: validate token, enforce one rating per token
    if (proofType === "TOKEN_QR") {
      if (!tokenId) {
        res.status(400).json({ error: "tokenId required for TOKEN_QR" });
        return;
      }
      const tokenRef = db.doc(`dispatchTokens/${tokenId}`);

      await db.runTransaction(async (tx) => {
        const tokenSnap = await tx.get(tokenRef);
        if (!tokenSnap.exists) throw new functions.https.HttpsError("not-found", "token not found");
        const t = tokenSnap.data() as any;
        if (asString(t.plate).toUpperCase() !== plate) throw new functions.https.HttpsError("failed-precondition", "plate mismatch");
        if (cfg.ratingTokenUniqueRequired && t.ratingId) throw new functions.https.HttpsError("already-exists", "token already rated");

        const ratingId = crypto.randomUUID();
        const ratingRef = db.doc(`vehicleRatings/${ratingId}`);
        tx.set(ratingRef, {
          ratingId,
          plate,
          rating,
          comment,
          proofType,
          tokenId,
          trustLevel: "VERIFIED",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          ipHash,
          appCheckHash,
        });
        tx.update(tokenRef, { ratingId, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });

      trustLevel = "VERIFIED";
      await checkRateLimit({
        bucket: "VERIFIED",
        keyMaterial,
        limitPerHour: cfg.ratingRateLimitPerHourVerified,
      });
    } else {
      // VAN_QR: unverified
      trustLevel = "UNVERIFIED";
      await checkRateLimit({
        bucket: "UNVERIFIED",
        keyMaterial,
        limitPerHour: cfg.ratingRateLimitPerHourUnverified,
      });

      const ratingId = crypto.randomUUID();
      await db.doc(`vehicleRatings/${ratingId}`).set({
        ratingId,
        plate,
        rating,
        comment,
        proofType,
        tokenId: null,
        trustLevel,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ipHash,
        appCheckHash,
      });
    }

    await writeAuditLog({
      action: "passenger:submitRating",
      actorUid: null,
      actorRole: null,
      plate,
      tokenId: tokenId,
      targetPath: "vehicleRatings",
      meta: { trustLevel, proofType, rating },
    });

    res.status(200).json({ ok: true, trustLevel });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (e?.code) {
      res.status(400).json({ error: msg });
      return;
    }
    res.status(500).json({ error: "INTERNAL", message: msg });
  }
});

/**
 * ======================================================================
 * Legacy (tapela-based) — keep DEPRECATED shims if you had them
 * ======================================================================
 *
 * If your old Stage 1 had these:
 * - createVehicleClaim({ tapela, stationId? })
 * - redeemVehicleClaim({ claimId })
 * - checkInHelperToStation(...)
 * Those are now DEPRECATED. We'll keep minimal shims:
 */

// DEPRECATED: createVehicleClaim({ tapela, stationId? }) ENFORCER only
export const createVehicleClaim = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustRole(ctx, "ENFORCER");
  const tapela = asString(data?.tapela);
  if (!tapela) throw new functions.https.HttpsError("invalid-argument", "tapela required");

  // map tapela -> plate if possible and create new driver claim
  const plate = await mapTapelaToPlateOrThrow(tapela);
  const stationId = asString(data?.stationId).toUpperCase() || null;

  await writeAuditLog({
    action: "DEPRECATED:createVehicleClaim",
    actorUid: uid,
    actorRole: "ENFORCER",
    tapela,
    plate,
    stationId,
    meta: { note: "Deprecated tapela claim mapped to plate driver claim" },
  });

  // reuse new function logic
  return await (createDriverClaim as any).run({ plate, stationId }, ctx);
});

// DEPRECATED: redeemVehicleClaim({ claimId }) -> redeemDriverClaim
export const redeemVehicleClaim = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustAuth(ctx);
  const claimId = asString(data?.claimId);
  if (!claimId) throw new functions.https.HttpsError("invalid-argument", "claimId required");

  await writeAuditLog({
    action: "DEPRECATED:redeemVehicleClaim",
    actorUid: uid,
    actorRole: null,
    meta: { note: "Deprecated tapela redeem mapped to driver claim redeem" },
  });

  return await (redeemDriverClaim as any).run({ claimId }, ctx);
});

// DEPRECATED: checkInHelperToStation -> checkInDriverToStation
export const checkInHelperToStation = functions.https.onCall(async (data, ctx) => {
  const { uid } = mustAuth(ctx);
  await writeAuditLog({
    action: "DEPRECATED:checkInHelperToStation",
    actorUid: uid,
    actorRole: null,
  });
  return await (checkInDriverToStation as any).run(data, ctx);
});

/**
 * Optional legacy stubs (if your admin expects them):
 * computeRebalancing / acceptRebalancingOrder can remain from Stage 1 if present,
 * but requirements no longer depend on them. We keep a tiny placeholder so deploy doesn't break.
 */
export const computeRebalancing = functions.pubsub.schedule("every 2 minutes").onRun(async () => {
  // no-op (legacy)
  return null;
});
export const acceptRebalancingOrder = functions.https.onCall(async (_data, ctx) => {
  mustAuth(ctx);
  throw new functions.https.HttpsError("failed-precondition", "DEPRECATED: rebalancing removed in latest requirements.");
});

// Convenience callable for later tests (admin/enforcer can run it)
export const computeRebalancingNow = functions.https.onCall(async (_data, ctx) => {
  mustAuth(ctx);
  return { ok: true, created: 0 };
});
