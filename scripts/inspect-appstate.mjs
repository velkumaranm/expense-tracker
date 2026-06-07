import { execFileSync } from "node:child_process";

const projectId = process.argv[2] || "expense-tracker-d1ed6";
const emails = process.argv.slice(3);
const firebaseWebApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;

if (!emails.length) {
  console.error("Usage: node scripts/inspect-appstate.mjs <projectId> <email1> [email2...]");
  process.exit(1);
}

if (!firebaseWebApiKey) {
  console.error("Set VITE_FIREBASE_API_KEY or FIREBASE_WEB_API_KEY before running this script.");
  process.exit(1);
}

const token = execFileSync("gcloud", ["auth", "print-access-token"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
}).trim();

if (!token) {
  throw new Error("Could not get gcloud access token.");
}

const postJson = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `POST failed (${res.status})`);
  return data;
};

const getJson = async (url) => {
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-goog-user-project": projectId,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.error?.message || `GET failed (${res.status})` };
  return data;
};

const countCollection = async (uid, collectionName) => {
  const data = await getJson(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/${collectionName}?pageSize=300`
  );
  if (data?.error) return `error:${data.error}`;
  return data?.documents?.length || 0;
};

for (const email of emails) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) continue;
  console.log(`EMAIL=${normalizedEmail}`);
  const lookup = await postJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseWebApiKey)}`,
    { email: [normalizedEmail], targetProjectId: projectId }
  );
  const user = lookup?.users?.[0];
  if (!user?.localId) {
    console.log("AUTH_USER=missing");
    console.log("---");
    continue;
  }
  console.log(`UID=${user.localId}`);
  const doc = await getJson(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.localId}/meta/appState`
  );
  if (doc?.error) {
    console.log(`APPSTATE_ERROR=${doc.error}`);
    console.log("---");
    continue;
  }
  const fields = doc?.fields || {};
  const holdingsCount = fields?.holdings?.arrayValue?.values?.length || 0;
  const snapshotsCount = fields?.portfolioSnapshots?.arrayValue?.values?.length || 0;
  const vaultCount = fields?.vaultDocs?.arrayValue?.values?.length || 0;
  console.log(`APPSTATE_HOLDINGS=${holdingsCount}`);
  console.log(`APPSTATE_SNAPSHOTS=${snapshotsCount}`);
  console.log(`APPSTATE_VAULT_DOCS=${vaultCount}`);
  console.log(`COLLECTION_EXPENSES=${await countCollection(user.localId, "expenses")}`);
  console.log(`COLLECTION_GOALS=${await countCollection(user.localId, "goals")}`);
  console.log(`COLLECTION_HOLDINGS=${await countCollection(user.localId, "holdings")}`);
  console.log(`COLLECTION_SNAPSHOTS=${await countCollection(user.localId, "portfolioSnapshots")}`);
  console.log(`COLLECTION_VAULT_DOCS=${await countCollection(user.localId, "vaultDocs")}`);
  console.log(`UPDATED=${doc.updateTime || "unknown"}`);
  console.log("---");
}
