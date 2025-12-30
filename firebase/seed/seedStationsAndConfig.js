/**
 * Seeds stations + config/app into Firestore emulator or dev project.
 *
 * Emulator usage:
 *   node seed/seedStationsAndConfig.js --emulator --project ethio-taxi
 *
 * Dev project usage:
 *   node seed/seedStationsAndConfig.js --project YOUR_DEV_PROJECT_ID
 */
const admin = require("firebase-admin");

function arg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const useEmulator = process.argv.includes("--emulator");
const projectId =
  arg("--project") ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT ||
  "ethio-taxi";

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.GCLOUD_PROJECT = projectId;
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function run() {
  const now = admin.firestore.FieldValue.serverTimestamp();

  const stations = [
    {
      stationId: "MEGENAGNA",
      nameAm: "መገናኛ",
      nameEn: "Megenagna",
      lat: 0,
      lng: 0,
      waitingCount: 0,
      queueCount: 0
    },
    {
      stationId: "TORHAYLOCH",
      nameAm: "ቶርሃይሎች",
      nameEn: "Torhayloch",
      lat: 0,
      lng: 0,
      waitingCount: 0,
      queueCount: 0
    }
  ];

  const batch = db.batch();

  for (const st of stations) {
    batch.set(
      db.doc(`stations/${st.stationId}`),
      { ...st, createdAt: now, updatedAt: now },
      { merge: true }
    );
  }

  batch.set(
    db.doc("config/app"),
    {
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

      // keep old ones if you had them
      thresholds: { waitingHigh: 30, queueLow: 2 },

      updatedAt: now
    },
    { merge: true }
  );

  // optional seed one vehicle for demo
  batch.set(
    db.doc("vehicles/A-12345"),
    {
      status: "ACTIVE",
      seatCapacity: 12,
      ownerName: null,
      ownerPhone: null,
      vin: null,
      tapela: null,
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  await batch.commit();

  console.log("✅ Seeded stations + config/app (+ demo vehicle)");
  console.log("projectId =", projectId);
  console.log("FIRESTORE_EMULATOR_HOST =", process.env.FIRESTORE_EMULATOR_HOST || "(not set)");
}

run().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
