const PASSKEY_STORE_KEY = "finwise-passkeys";

function bytesToBase64Url(bytes) {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function readProfiles() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PASSKEY_STORE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.credentialId && item?.email) : [];
  } catch {
    return [];
  }
}

function writeProfiles(next) {
  window.localStorage.setItem(PASSKEY_STORE_KEY, JSON.stringify(next));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getHostName() {
  return window.location.hostname || "localhost";
}

function isLoopbackHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function getRpId() {
  const host = getHostName();
  return isLoopbackHost(host) ? "" : host;
}

function buildRp() {
  const rpId = getRpId();
  return rpId ? { name: "Finwise", id: rpId } : { name: "Finwise" };
}

function buildRequestRpId() {
  const rpId = getRpId();
  return rpId ? { rpId } : {};
}

function getDisplayName(email) {
  const local = normalizeEmail(email).split("@")[0] || "Finwise";
  return local.slice(0, 48);
}

export function isPasskeySupported() {
  const host = getHostName();
  return Boolean(
    window.PublicKeyCredential &&
      navigator.credentials?.create &&
      navigator.credentials?.get &&
      window.isSecureContext &&
      !isLoopbackHost(host)
  );
}

export function getStoredPasskeys() {
  return readProfiles();
}

export async function createLocalPasskey(email) {
  if (!isPasskeySupported()) throw new Error("Passkeys are not supported on this device or browser.");
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("An email address is required before creating a passkey.");

  const userId = crypto.getRandomValues(new Uint8Array(24));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: buildRp(),
      user: {
        id: userId,
        name: normalized,
        displayName: getDisplayName(normalized),
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      timeout: 60_000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "preferred",
      },
      attestation: "none",
    },
  });

  if (!credential) throw new Error("Passkey creation was cancelled.");

  const credentialId = bytesToBase64Url(new Uint8Array(credential.rawId));
  const profiles = readProfiles().filter((item) => item.email !== normalized && item.credentialId !== credentialId);
  const next = [
    {
      email: normalized,
      credentialId,
      label: getDisplayName(normalized),
      createdAt: new Date().toISOString(),
      rpId: getRpId() || getHostName(),
    },
    ...profiles,
  ].slice(0, 8);
  writeProfiles(next);
  return next;
}

export async function authenticateWithLocalPasskey(preferredEmail = "") {
  if (!isPasskeySupported()) throw new Error("Passkeys are not supported on this device or browser.");
  const profiles = readProfiles();
  if (!profiles.length) throw new Error("No passkey is saved on this device yet.");

  const normalized = normalizeEmail(preferredEmail);
  const orderedProfiles = normalized
    ? [...profiles.filter((item) => item.email === normalized), ...profiles.filter((item) => item.email !== normalized)]
    : profiles;

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: orderedProfiles.map((item) => ({
        id: base64UrlToBytes(item.credentialId),
        type: "public-key",
      })),
      userVerification: "preferred",
      ...buildRequestRpId(),
      timeout: 60_000,
    },
  });

  if (!assertion) throw new Error("Passkey verification was cancelled.");

  const credentialId = bytesToBase64Url(new Uint8Array(assertion.rawId));
  const match = profiles.find((item) => item.credentialId === credentialId);
  if (!match) throw new Error("This passkey does not match a saved Finwise account on this device.");
  return match;
}

export function removeLocalPasskey(email) {
  const normalized = normalizeEmail(email);
  const next = readProfiles().filter((item) => item.email !== normalized);
  writeProfiles(next);
  return next;
}
