/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    fetchFn = require("node-fetch");
  } catch {
    throw new Error("No fetch available. Use Node 18+ or install node-fetch.");
  }
}

const DEFAULT_PROJECT = "ethio-taxi";
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FUNCTIONS_BASE = process.env.FUNCTIONS_BASE || "http://127.0.0.1:5001";

function argValue(flag) {
  const i = process.argv.findIndex((a) => a === flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return null;
}

function loadCreds() {
  const p = path.join(__dirname, ".test-users.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function signIn(email, password) {
  const url = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SignIn failed: ${res.status} ${text}`);
  const json = JSON.parse(text);
  return { idToken: json.idToken, localId: json.localId };
}

async function callOnCall(projectId, fnName, idToken, data) {
  const url = `${FUNCTIONS_BASE}/${projectId}/us-central1/${fnName}`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fnName} failed: ${res.status} ${text}`);
  const json = JSON.parse(text);
  return json.result;
}

function initFirestoreAdmin(projectId) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  if (admin.apps.length === 0) admin.initializeApp({ projectId });
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

async function ensureStationsAndConfig(db) {
  const megen = await db.doc("stations/MEGENAGNA").get();
  const tor = await db.doc("stations/TORHAYLOCH").get();

  if (megen.exists && tor.exists) return;

  console.log("⚠️ Stations missing in Firestore. Auto-seeding stations + config/app...");

  await db.doc("config/app").set(
    {
      avgPassengersPerVan: 10,
      thresholds: { waitingHigh: 30, queueLow: 2 },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await db.doc("stations/MEGENAGNA").set(
    {
      stationId: "MEGENAGNA",
      nameAm: "መገናኛ",
      nameEn: "Megenagna",
      lat: 9.02,
      lng: 38.8,
      waitingCount: 0,
      queueCount: 0,
      lastDispatchAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await db.doc("stations/TORHAYLOCH").set(
    {
      stationId: "TORHAYLOCH",
      nameAm: "ቶርሃይሎች",
      nameEn: "Torhayloch",
      lat: 9.01,
      lng: 38.74,
      waitingCount: 0,
      queueCount: 0,
      lastDispatchAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log("✅ Auto-seed complete.");
}

async function main() {
  const projectId = argValue("--project") || process.argv[2] || DEFAULT_PROJECT;
  console.log(`Project: ${projectId}`);

  const db = initFirestoreAdmin(projectId);
  await ensureStationsAndConfig(db);

  const creds = loadCreds();
  if (!creds) {
    throw new Error("Missing seed/.test-users.json. Run: node seed/createTestUsersAndClaims.js --project ethio-taxi");
  }

  const helperEmail = creds.helper.email;
  const enforcerEmail = creds.enforcer.email;
  const password = creds.password;

  console.log("Signing in...");
  const helper1 = await signIn(helperEmail, password);
  const enforcer = await signIn(enforcerEmail, password);

  console.log("1) upsertUserProfile (helper)");
  await callOnCall(projectId, "upsertUserProfile", helper1.idToken, { language: "am" });

  console.log("2) createVehicleClaim (enforcer)");
  const claim = await callOnCall(projectId, "createVehicleClaim", enforcer.idToken, {
    plate: "A12345",
    stationId: "MEGENAGNA"
  });
  console.log("claimId:", claim.claimId);

  console.log("3) redeemVehicleClaim (helper)");
  await callOnCall(projectId, "redeemVehicleClaim", helper1.idToken, { claimId: claim.claimId });

  console.log("Refreshing helper token to pick up custom claims...");
  const helper2 = await signIn(helperEmail, password);

  console.log("4) checkInHelperToStation (helper)");
  await callOnCall(projectId, "checkInHelperToStation", helper2.idToken, { stationId: "MEGENAGNA" });

  console.log("5) joinQueue (helper)");
  await callOnCall(projectId, "joinQueue", helper2.idToken, { stationId: "MEGENAGNA" });

  console.log("6) setWaitingCount (enforcer)");
  await callOnCall(projectId, "setWaitingCount", enforcer.idToken, {
    stationId: "MEGENAGNA",
    waitingCountAbsolute: 35
  });

  console.log("7) issueDispatchToken (enforcer)");
  const token = await callOnCall(projectId, "issueDispatchToken", enforcer.idToken, {
    stationId: "MEGENAGNA",
    plate: "A12345",
    amount: 20,
    telebirrRef: "MANUAL-REF-001"
  });
  console.log("dispatchToken:", token.tokenId, "paymentId:", token.paymentId);

  // FIX: respect backend rate limit (>= 5 seconds between updates)
  console.log("Waiting 6 seconds to respect setWaitingCount rate limit...");
  await sleep(6000);

  console.log("8) computeRebalancingNow (enforcer)");
  await callOnCall(projectId, "setWaitingCount", enforcer.idToken, {
    stationId: "MEGENAGNA",
    waitingCountAbsolute: 50
  });

  const rb = await callOnCall(projectId, "computeRebalancingNow", enforcer.idToken, {});
  console.log("computeRebalancingNow created:", rb.created);

  const orders = await db
    .collection("rebalancingOrders")
    .where("stationId", "==", "MEGENAGNA")
    .where("status", "==", "OPEN")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (orders.empty) throw new Error("Expected an OPEN rebalancing order, but none found.");

  const orderId = orders.docs[0].id;
  console.log("Found OPEN rebalancing order:", orderId);

  console.log("9) acceptRebalancingOrder (helper)");
  const accepted = await callOnCall(projectId, "acceptRebalancingOrder", helper2.idToken, { orderId });
  console.log("accept result:", accepted);

  console.log("✅ STAGE 1 FULL FLOW PASSED (dispatch + rebalancing + accept).");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
