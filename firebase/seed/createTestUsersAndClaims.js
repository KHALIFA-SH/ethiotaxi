/* eslint-disable no-console */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function argValue(flag) {
  const i = process.argv.findIndex((a) => a === flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return null;
}

async function upsertUserByEmail({ email, password, displayName }) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(existing.uid, {
      password,
      displayName,
      emailVerified: true,
      disabled: false
    });
    return existing.uid;
  } catch (e) {
    if (String(e?.code || "").includes("auth/user-not-found")) {
      const created = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: true
      });
      return created.uid;
    }
    throw e;
  }
}

async function main() {
  const projectId = argValue("--project") || "ethio-taxi";

  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

  if (admin.apps.length === 0) admin.initializeApp({ projectId });

  const TEST_PASSWORD = "Passw0rd!";
  const enforcerEmail = "enforcer@test.com";
  const helperEmail = "helper@test.com";

  const enforcerUid = await upsertUserByEmail({ email: enforcerEmail, password: TEST_PASSWORD, displayName: "Enforcer Test" });
  const helperUid = await upsertUserByEmail({ email: helperEmail, password: TEST_PASSWORD, displayName: "Helper Test" });

  await admin.auth().setCustomUserClaims(enforcerUid, { enforcer: true, employeeId: "EMP-0001" });
  await admin.auth().setCustomUserClaims(helperUid, {});

  const out = {
    projectId,
    password: TEST_PASSWORD,
    enforcer: { email: enforcerEmail, uid: enforcerUid },
    helper: { email: helperEmail, uid: helperUid }
  };

  const outPath = path.join(__dirname, ".test-users.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log("✅ Created/updated users in Auth Emulator (password forced)");
  console.log({ projectId, enforcerUid, helperUid, credsFile: outPath });
}

main().catch((e) => {
  console.error("❌ createTestUsersAndClaims failed:", e);
  process.exit(1);
});
