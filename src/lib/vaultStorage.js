import { deleteObject, getDownloadURL, ref, uploadString } from "firebase/storage";
import { storage } from "../firebase";

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

function sanitizeName(name = "") {
  return String(name || "file").replace(/[^a-z0-9._-]+/gi, "-");
}

function buildStoragePath(userId, docId, attachmentId, fileName) {
  return `users/${userId}/vault/${docId}/${attachmentId}-${sanitizeName(fileName)}`;
}

export async function saveVaultAttachmentToCloud(userId, docId, file) {
  if (!userId) throw new Error("Sign in before uploading cloud vault files.");
  const dataUrl = await fileToDataUrl(file);
  const id = crypto.randomUUID();
  const storagePath = buildStoragePath(userId, docId, id, file.name);
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, dataUrl, "data_url", {
    contentType: file.type || "application/octet-stream",
  });
  const downloadUrl = await getDownloadURL(storageRef);
  return {
    id,
    docId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: Number(file.size || 0),
    storedAt: new Date().toISOString(),
    storagePath,
    downloadUrl,
    storageDriver: "firebase",
  };
}

export async function migrateLocalAttachmentToCloud(userId, docId, attachment) {
  if (!attachment?.id) throw new Error("Missing local attachment reference.");
  const local = await getVaultAttachment(attachment.id);
  if (!local?.dataUrl) throw new Error("Local attachment payload is unavailable.");
  const storagePath = buildStoragePath(userId, docId, attachment.id, attachment.name || local.name);
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, local.dataUrl, "data_url", {
    contentType: attachment.type || local.type || "application/octet-stream",
  });
  const downloadUrl = await getDownloadURL(storageRef);
  return {
    id: attachment.id,
    docId,
    name: attachment.name || local.name,
    type: attachment.type || local.type || "application/octet-stream",
    size: Number(attachment.size || local.size || 0),
    storedAt: attachment.storedAt || local.storedAt || new Date().toISOString(),
    storagePath,
    downloadUrl,
    storageDriver: "firebase",
    syncStatus: "synced",
    lastError: "",
  };
}

export async function syncVaultAttachmentToCloud(userId, docId, attachment) {
  if (!attachment?.id) throw new Error("Missing local attachment reference.");
  return migrateLocalAttachmentToCloud(userId, docId, attachment);
}

export async function openVaultAttachment(attachment) {
  if (!attachment) throw new Error("Attachment is missing.");
  if (attachment.downloadUrl) return attachment.downloadUrl;
  if (attachment.storagePath) {
    return getDownloadURL(ref(storage, attachment.storagePath));
  }
  const local = await getVaultAttachment(attachment.id);
  if (!local?.dataUrl) throw new Error("Attachment content is unavailable.");
  return local.dataUrl;
}

export async function removeVaultAttachment(attachment) {
  if (!attachment) return;
  if (attachment.storagePath) {
    await deleteObject(ref(storage, attachment.storagePath)).catch(() => {});
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
