import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);

const getArgValue = (flag, fallback = "") => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
};

const hasFlag = (flag) => args.includes(flag);

const email = getArgValue("--email", "").trim().toLowerCase();
const projectId = getArgValue("--project", "expense-tracker-d1ed6").trim();
const remove = hasFlag("--remove");

if (!email) {
  console.error("Usage: node scripts/set-admin-claim.mjs --email velkumaran.m@gmail.com [--project expense-tracker-d1ed6] [--remove]");
  process.exit(1);
}

const getAccessToken = () => {
  const token = execFileSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  }).trim();
  if (!token) throw new Error("Could not obtain a Google OAuth access token from gcloud.");
  return token;
};

const postJson = async (url, token, body, quotaProject) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-goog-user-project": quotaProject,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
};

const token = getAccessToken();

const lookup = await postJson("https://identitytoolkit.googleapis.com/v1/accounts:lookup", token, {
  email: [email],
  targetProjectId: projectId,
}, projectId);

const user = lookup?.users?.[0];
if (!user?.localId) {
  throw new Error(`No Firebase auth user found for ${email} in project ${projectId}.`);
}

let existingClaims = {};
try {
  existingClaims = user.customAttributes ? JSON.parse(user.customAttributes) : {};
} catch {
  existingClaims = {};
}

const nextClaims = remove
  ? Object.fromEntries(Object.entries(existingClaims).filter(([key]) => key !== "admin" && key !== "role"))
  : { ...existingClaims, admin: true, role: "admin" };

await postJson("https://identitytoolkit.googleapis.com/v1/accounts:update", token, {
  localId: user.localId,
  targetProjectId: projectId,
  customAttributes: JSON.stringify(nextClaims),
}, projectId);

console.log(
  remove
    ? `Removed admin claims for ${email} in ${projectId}.`
    : `Set admin claims for ${email} in ${projectId}: ${JSON.stringify(nextClaims)}`
);
console.log("Next step: sign out of Finwise, sign back in, then refresh Settings.");
