import { del, get, put } from "@vercel/blob";
import { loadLocalEnv, resolveViewerAccess } from "./ai-runtime.mjs";

loadLocalEnv();

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function ensureBlobToken() {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) {
    throw new Error("Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to the server environment.");
  }
  return token;
}

function sanitizeName(name = "") {
  return String(name || "file").replace(/[^a-z0-9._-]+/gi, "-");
}

function buildBlobPath(userId, docId, attachmentId, fileName) {
  return `users/${userId}/vault/${docId}/${attachmentId}-${sanitizeName(fileName)}`;
}

function decodeDataUrl(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Attachment payload is malformed.");
  const [, contentType, payload] = match;
  const buffer = Buffer.from(payload, "base64");
  return { contentType, buffer };
}

async function assertVaultAccess(authHeader = "", userId = "", pathname = "") {
  const access = await resolveViewerAccess(authHeader);
  if (!access?.uid || access.uid !== userId) {
    throw new Error("You are not allowed to access this vault file.");
  }
  if (pathname && !pathname.startsWith(`users/${userId}/vault/`)) {
    throw new Error("Vault file path is invalid for this user.");
  }
  return access;
}

export async function uploadVaultAttachment({
  authHeader = "",
  userId = "",
  docId = "",
  attachmentId = "",
  fileName = "",
  contentType = "",
  dataUrl = "",
}) {
  if (!userId || !docId || !attachmentId || !fileName) {
    throw new Error("Vault upload is missing document details.");
  }
  await assertVaultAccess(authHeader, userId);
  const token = ensureBlobToken();
  const decoded = decodeDataUrl(dataUrl);
  const finalContentType = String(contentType || decoded.contentType || "application/octet-stream").trim();
  if (decoded.buffer.length > MAX_FILE_BYTES) {
    throw new Error("Attachment is larger than 2 MB.");
  }
  const pathname = buildBlobPath(userId, docId, attachmentId, fileName);
  const blob = await put(pathname, decoded.buffer, {
    access: "private",
    addRandomSuffix: false,
    token,
    contentType: finalContentType,
  });
  return {
    id: attachmentId,
    docId,
    userId,
    name: fileName,
    type: finalContentType,
    size: decoded.buffer.length,
    storedAt: new Date().toISOString(),
    storageDriver: "vercel-blob",
    storagePath: blob.pathname,
    blobUrl: blob.url,
    downloadUrl: blob.downloadUrl,
    syncStatus: "synced",
    lastError: "",
  };
}

export async function fetchVaultAttachment({
  authHeader = "",
  userId = "",
  pathname = "",
}) {
  if (!pathname) throw new Error("Vault file path is missing.");
  await assertVaultAccess(authHeader, userId, pathname);
  const token = ensureBlobToken();
  const result = await get(pathname, {
    access: "private",
    token,
    useCache: false,
  });
  if (!result?.stream) {
    throw new Error("Vault file not found.");
  }
  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    headers: result.headers,
    blob: result.blob,
  };
}

export async function deleteVaultAttachment({
  authHeader = "",
  userId = "",
  pathname = "",
}) {
  if (!pathname) return { ok: true };
  await assertVaultAccess(authHeader, userId, pathname);
  const token = ensureBlobToken();
  await del(pathname, { token });
  return { ok: true };
}
