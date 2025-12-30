/**
 * Usage:
 *   node scripts/setAdminEmu.js admin@ethiotaxi.local ethio-taxi
 */
const admin = require("firebase-admin");

const email = process.argv[2];
const projectId = process.argv[3] || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ethio-taxi";

if (!email) {
  console.error("Missing email. Example: node scripts/setAdminEmu.js admin@ethiotaxi.local ethio-taxi");
  process.exit(1);
}

// Auth emulator (critical)
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = projectId;
process.env.GOOGLE_CLOUD_PROJECT = projectId;

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true }); // <-- claim key
  console.log(`✅ Set ADMIN claim for ${email} (uid=${user.uid})`);
  console.log("Now sign out and sign in again to refresh token.");
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
