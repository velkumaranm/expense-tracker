const DB_NAME = "finwise-vault";
const STORE_NAME = "attachments";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open vault storage"));
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = run(store, resolve, reject);
    tx.onerror = () => reject(tx.error || new Error("Vault storage transaction failed"));
    tx.oncomplete = () => db.close();
    return result;
  });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function saveVaultAttachment(docId, file) {
  const dataUrl = await fileToDataUrl(file);
  const id = crypto.randomUUID();
  const record = {
    id,
    docId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: Number(file.size || 0),
    dataUrl,
    storedAt: new Date().toISOString(),
    storageDriver: "indexeddb",
    syncStatus: "local",
    lastError: "",
  };
  await withStore("readwrite", (store, resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error || new Error("Could not save attachment"));
  });
  return record;
}

async function parseApiResponse(res, fallbackMessage) {
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(text || fallbackMessage);
      return {};
    }
  }
  if (!res.ok) throw new Error(data?.error || fallbackMessage);
  return data;
}

export async function saveVaultAttachmentToCloud(userId, docId, file) {
  throw new Error("Save to cloud requires the sync flow.");
}

export async function migrateLocalAttachmentToCloud(userId, docId, attachment, authToken = "") {
  if (!attachment?.id) throw new Error("Missing local attachment reference.");
  if (!authToken) throw new Error("Sign in again before syncing this vault file.");
  const local = await getVaultAttachment(attachment.id);
  if (!local?.dataUrl) throw new Error("Local attachment payload is unavailable.");
  const res = await fetch("/api/vault/upload", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      userId,
      docId,
      attachmentId: attachment.id,
      fileName: attachment.name || local.name,
      contentType: attachment.type || local.type || "application/octet-stream",
      dataUrl: local.dataUrl,
    }),
  });
  const data = await parseApiResponse(res, "Could not sync vault file to cloud.");
  return data.attachment;
}

export async function syncVaultAttachmentToCloud(userId, docId, attachment, authToken = "") {
  if (!attachment?.id) throw new Error("Missing local attachment reference.");
  return migrateLocalAttachmentToCloud(userId, docId, attachment, authToken);
}

export async function openVaultAttachment(attachment, { authToken = "", userId = "" } = {}) {
  if (!attachment) throw new Error("Attachment is missing.");
  if (attachment.storageDriver === "vercel-blob" || attachment.storagePath) {
    if (!authToken || !userId) throw new Error("Sign in again before opening this vault file.");
    const url = new URL("/api/vault/file", window.location.origin);
    url.searchParams.set("userId", userId);
    url.searchParams.set("pathname", attachment.storagePath || "");
    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      await parseApiResponse(res, "Could not open vault attachment.");
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  const local = await getVaultAttachment(attachment.id);
  if (!local?.dataUrl) throw new Error("Attachment content is unavailable.");
  return local.dataUrl;
}

export async function removeVaultAttachment(attachment, { authToken = "", userId = "" } = {}) {
  if (!attachment) return;
  if ((attachment.storageDriver === "vercel-blob" || attachment.storagePath) && authToken && userId) {
    await fetch("/api/vault/file", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ userId, pathname: attachment.storagePath || "" }),
    }).catch(() => {});
  }
  if (attachment.id) {
    await deleteVaultAttachment(attachment.id).catch(() => {});
  }
}

export async function getVaultAttachment(id) {
  return withStore("readonly", (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Could not load attachment"));
  });
}

export async function deleteVaultAttachment(id) {
  return withStore("readwrite", (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("Could not remove attachment"));
  });
}

export async function listVaultAttachments(docId) {
  const rows = await withStore("readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error("Could not list attachments"));
  });
  return rows.filter((row) => row.docId === docId);
}

export async function purgeVaultAttachments(docId) {
  const rows = await listVaultAttachments(docId);
  await Promise.all(rows.map((row) => deleteVaultAttachment(row.id)));
}

export async function listLegacyDocAttachments(docId) {
  return listVaultAttachments(docId);
}
