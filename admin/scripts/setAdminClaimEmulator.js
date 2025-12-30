/**
 * Set ADMIN claim for a user in Auth Emulator.
 *
 * Usage:
 *   cd ethiotaxi/admin
 *   npm run set-admin:emu -- --email admin@ethiotaxi.local
 */
const admin = require("firebase-admin");

function arg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const email = arg("--email") || "admin@ethiotaxi.local";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "ethio-taxi";

process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

if (!admin.apps.length) admin.initializeApp({ projectId });

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  const current = user.customClaims || {};
  await admin.auth().setCustomUserClaims(user.uid, { ...current, admin: true });
  console.log(`✅ Set admin=true for ${email} (uid=${user.uid})`);
})().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
