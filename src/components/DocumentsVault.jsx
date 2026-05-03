import { useEffect, useMemo, useRef, useState } from "react";
import {
  migrateLocalAttachmentToCloud,
  openVaultAttachment,
  purgeVaultAttachments,
  removeVaultAttachment,
  saveVaultAttachment,
  syncVaultAttachmentToCloud,
} from "../lib/vaultStorage";
import { goalId } from "../lib/utils";
import { useI18n } from "../lib/i18n";

const DOC_TEMPLATES = [
  { title: "Health Insurance Policy", type: "Insurance", issuer: "Insurer", renewalDate: "", reminderDays: 30, reference: "", note: "" },
  { title: "Term Life Policy", type: "Insurance", issuer: "Insurer", renewalDate: "", reminderDays: 45, reference: "", note: "" },
  { title: "Home Loan Statement", type: "Loan", issuer: "Bank", renewalDate: "", reminderDays: 15, reference: "", note: "" },
  { title: "Tax Proof Bundle", type: "Tax", issuer: "Employer / CA", renewalDate: "", reminderDays: 20, reference: "", note: "" },
];

const DOC_TEMPLATE_KEYS = {
  "Health Insurance Policy": "vault.templateHealth",
  "Term Life Policy": "vault.templateTerm",
  "Home Loan Statement": "vault.templateLoan",
  "Tax Proof Bundle": "vault.templateTax",
};

const DOC_TYPE_KEYS = {
  Insurance: "vault.typeInsurance",
  Loan: "vault.typeLoan",
  Tax: "vault.typeTax",
  Investment: "vault.typeInvestment",
  Identity: "vault.typeIdentity",
  Other: "vault.typeOther",
};

const STATUS_KEYS = {
  "No renewal date": "vault.noRenewalDate",
  Expired: "vault.expiredStatus",
  "Due soon": "vault.dueSoonStatus",
  Healthy: "vault.healthyStatus",
};

const emptyDoc = {
  title: "",
  type: "Insurance",
  issuer: "",
  renewalDate: "",
  reminderDays: 30,
  reference: "",
  note: "",
  attachments: [],
};

function reminderStatus(item) {
  if (!item.renewalDate) return { label: "No renewal date", tone: "neutral", daysLeft: null };
  const renewal = new Date(item.renewalDate);
  if (Number.isNaN(renewal.getTime())) return { label: "No renewal date", tone: "neutral", daysLeft: null };
  const daysLeft = Math.ceil((renewal - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: "Expired", tone: "pending", daysLeft };
  if (daysLeft <= Number(item.reminderDays || 30)) return { label: "Due soon", tone: "neutral", daysLeft };
  return { label: "Healthy", tone: "verified", daysLeft };
}

function fmtSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${value} B`;
}

export default function DocumentsVault({ docs, setDocs, showToast, user }) {
  const { t } = useI18n();
  const [form, setForm] = useState(emptyDoc);
  const [editingId, setEditingId] = useState("");
  const [attachmentMap, setAttachmentMap] = useState({});
  const [migrating, setMigrating] = useState(false);
  const syncChainRef = useRef(Promise.resolve());

  const reminderCounts = useMemo(
    () =>
      docs.reduce(
        (acc, item) => {
          const status = reminderStatus(item);
          if (status.label === "Due soon") acc.dueSoon += 1;
          if (status.label === "Expired") acc.expired += 1;
          return acc;
        },
        { dueSoon: 0, expired: 0 }
      ),
    [docs]
  );

  const sortedDocs = useMemo(
    () =>
      [...docs].sort((a, b) => {
        if (!a.renewalDate && !b.renewalDate) return a.title.localeCompare(b.title);
        if (!a.renewalDate) return 1;
        if (!b.renewalDate) return -1;
        return new Date(a.renewalDate) - new Date(b.renewalDate);
      }),
    [docs]
  );

  useEffect(() => {
    let disposed = false;
    const loadAttachments = async () => {
      const entries = await Promise.all(
        docs.map(async (item) => [item.id, (item.attachments || []).slice()])
      );
      if (!disposed) {
        setAttachmentMap(Object.fromEntries(entries));
      }
    };
    loadAttachments().catch(() => {});
    return () => {
      disposed = true;
    };
  }, [docs]);

  const resetForm = () => {
    setEditingId("");
    setForm(emptyDoc);
  };

  const updateAttachmentRecord = (docId, attachmentId, updater) => {
    setDocs((prev) =>
      prev.map((item) =>
        item.id === docId
          ? {
              ...item,
              attachments: (item.attachments || []).map((file) =>
                file.id === attachmentId ? { ...file, ...(typeof updater === "function" ? updater(file) : updater) } : file
              ),
            }
          : item
      )
    );
    setAttachmentMap((prev) => ({
      ...prev,
      [docId]: (prev[docId] || []).map((file) =>
        file.id === attachmentId ? { ...file, ...(typeof updater === "function" ? updater(file) : updater) } : file
      ),
    }));
  };

  const queueSync = (task) => {
    syncChainRef.current = syncChainRef.current.then(task).catch(() => {});
    return syncChainRef.current;
  };

  const syncAttachment = async (docId, attachment) => {
    if (!user?.uid) {
      updateAttachmentRecord(docId, attachment.id, { syncStatus: "local", lastError: t("vault.signInToSync", "Sign in to sync this file to cloud.") });
      return;
    }
    updateAttachmentRecord(docId, attachment.id, { syncStatus: "syncing", lastError: "" });
    try {
      const uploaded = await syncVaultAttachmentToCloud(user.uid, docId, attachment);
      updateAttachmentRecord(docId, attachment.id, uploaded);
    } catch (error) {
      updateAttachmentRecord(docId, attachment.id, {
        syncStatus: "error",
        lastError: error.message || t("vault.cloudSyncFailed", "Cloud sync failed."),
      });
    }
  };

  const saveDoc = () => {
    if (!form.title) return;
    const next = {
      ...form,
      reminderDays: Number(form.reminderDays || 30),
    };
    if (editingId) {
      setDocs((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...next } : item)));
      showToast(t("vault.documentUpdated", "Document updated."));
    } else {
      const id = goalId();
      setDocs((prev) => [{ id, ...next }, ...prev]);
      showToast(t("vault.documentAdded", "Document reminder added."));
    }
    resetForm();
  };

  const editDoc = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      type: item.type || "Insurance",
      issuer: item.issuer || "",
      renewalDate: item.renewalDate || "",
      reminderDays: item.reminderDays || 30,
      reference: item.reference || "",
      note: item.note || "",
      attachments: item.attachments || [],
    });
  };

  const removeDoc = async (id) => {
    await purgeVaultAttachments(id).catch(() => {});
    setDocs((prev) => prev.filter((item) => item.id !== id));
    setAttachmentMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showToast(t("vault.documentRemoved", "Document removed."), "warning");
  };

  const uploadFiles = async (docId, files) => {
    const list = Array.from(files || []);
    if (!docId || !list.length) return;
    try {
      const saved = [];
      for (const file of list) {
        if (file.size > 2 * 1024 * 1024) {
          throw new Error(`${file.name} ${t("vault.fileTooLarge", "is larger than 2 MB. Keep uploads lightweight for browser vault storage.")}`);
        }
        const record = await saveVaultAttachment(docId, file);
        saved.push({
          id: record.id,
          name: record.name,
          type: record.type,
          size: record.size,
          storedAt: record.storedAt,
          storageDriver: record.storageDriver,
          syncStatus: record.syncStatus,
          lastError: record.lastError,
        });
      }
      setDocs((prev) =>
        prev.map((item) =>
          item.id === docId
            ? { ...item, attachments: [...(item.attachments || []), ...saved] }
            : item
        )
      );
      setAttachmentMap((prev) => ({ ...prev, [docId]: [...(prev[docId] || []), ...saved] }));
      showToast(`${saved.length} ${t("vault.filesSavedLocal", "file(s) saved locally. Cloud sync is running in the background.")}`);
    } catch (error) {
      showToast(error.message || t("vault.uploadFailed", "Upload failed."), "error");
    }
  };

  const openAttachment = async (attachmentId) => {
    try {
      const attachment = docs.flatMap((item) => item.attachments || []).find((item) => item.id === attachmentId);
      const url = await openVaultAttachment(attachment);
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      if (!tab) throw new Error(t("vault.allowPopups", "Allow pop-ups to open attached documents."));
    } catch (error) {
      showToast(error.message || t("vault.openFailed", "Could not open attachment."), "error");
    }
  };

  const removeAttachment = async (docId, attachmentId) => {
    const attachment = docs
      .flatMap((item) => (item.id === docId ? item.attachments || [] : []))
      .find((file) => file.id === attachmentId);
    await removeVaultAttachment(attachment).catch(() => {});
    setDocs((prev) =>
      prev.map((item) =>
        item.id === docId
          ? { ...item, attachments: (item.attachments || []).filter((file) => file.id !== attachmentId) }
          : item
      )
    );
    setAttachmentMap((prev) => ({
      ...prev,
      [docId]: (prev[docId] || []).filter((file) => file.id !== attachmentId),
    }));
    showToast(t("vault.attachmentRemoved", "Attachment removed."), "warning");
  };

  const legacyLocalCount = useMemo(
    () =>
      docs.reduce(
        (sum, item) =>
          sum +
          (item.attachments || []).filter((file) => !file.storagePath && !file.downloadUrl).length,
        0
      ),
    [docs]
  );

  const migrateLegacyAttachments = async () => {
    if (!user?.uid) {
      showToast(t("vault.signInBeforeMigrate", "Sign in before migrating vault files."), "error");
      return;
    }
    setMigrating(true);
    try {
      const nextDocs = [];
      for (const item of docs) {
        const currentAttachments = item.attachments || [];
        const migrated = [];
        for (const file of currentAttachments) {
          if (file.storagePath || file.downloadUrl) {
            migrated.push(file);
            continue;
          }
          try {
            migrated.push(await migrateLocalAttachmentToCloud(user.uid, item.id, file));
          } catch {
            migrated.push(file);
          }
        }
        nextDocs.push({ ...item, attachments: migrated });
      }
      setDocs(nextDocs);
      setAttachmentMap(Object.fromEntries(nextDocs.map((item) => [item.id, item.attachments || []])));
      showToast(t("vault.legacyMigrated", "Legacy vault uploads were migrated to cloud storage."));
    } catch (error) {
      showToast(error.message || t("vault.migrationFailed", "Vault migration failed."), "error");
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (!user?.uid || !docs.length) return;
    const pending = docs.flatMap((item) =>
      (item.attachments || [])
        .filter((file) => !file.storagePath && !file.downloadUrl && (file.syncStatus || "local") === "local")
        .map((file) => ({ docId: item.id, file }))
    );
    if (!pending.length) return;
    pending.forEach(({ docId, file }) => {
      queueSync(() => syncAttachment(docId, file));
    });
  }, [docs, user]);

  const exportVault = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      userEmail: user?.email || "",
      docs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finwise-vault-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(t("vault.exported", "Vault metadata exported."));
  };

  const importVault = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const importedDocs = Array.isArray(payload?.docs) ? payload.docs : [];
      if (!importedDocs.length) throw new Error(t("vault.importEmpty", "This export file does not contain any vault documents."));
      setDocs((prev) => {
        const existing = new Map(prev.map((item) => [item.id, item]));
        importedDocs.forEach((item) => {
          existing.set(item.id || goalId(), {
            ...item,
            id: item.id || goalId(),
            attachments: Array.isArray(item.attachments) ? item.attachments : [],
          });
        });
        return Array.from(existing.values());
      });
      showToast(`${t("vault.imported", "Imported")} ${importedDocs.length} ${t("vault.vaultDocuments", "vault document(s)")}.`);
    } catch (error) {
      showToast(error.message || t("vault.importFailed", "Could not import vault backup."), "error");
    }
  };

  const attachmentCount = docs.reduce((sum, item) => sum + Number(item.attachments?.length || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("vault.title", "Documents Vault")}</h1>
          <p>{t("vault.subtitle", "Store uploads, renewal reminders, and key references for insurance, loans, taxes, and wealth documents.")}</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("vault.trackedDocs", "Tracked Documents")}</div>
          <div className="sc-value">{docs.length}</div>
          <div className="sc-sub">{t("vault.trackedDocsSub", "Policies, statements, tax packs, and reminders stored in one command center.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("vault.uploads", "Uploads")}</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{attachmentCount}</div>
          <div className="sc-sub">{t("vault.uploadsSub", "Files attached to your Finwise cloud vault for cross-device reference and review.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("vault.dueSoon", "Due Soon")}</div>
          <div className="sc-value" style={{ color: reminderCounts.dueSoon ? "var(--accent)" : "var(--income)" }}>{reminderCounts.dueSoon}</div>
          <div className="sc-sub">{t("vault.dueSoonSub", "Documents whose reminder window has already opened.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("vault.expired", "Expired / Overdue")}</div>
          <div className="sc-value" style={{ color: reminderCounts.expired ? "var(--expense)" : "var(--income)" }}>{reminderCounts.expired}</div>
          <div className="sc-sub">{t("vault.expiredSub", "Renewals or compliance items that need attention right away.")}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div className="vault-toolbar" style={{ marginBottom: 14 }}>
            <div className="muted vault-toolbar-copy">
              {t("vault.toolbarCopy", "Vault reminders sync with your account. Files appear here immediately from local storage, then move to your cloud vault in the background.")}
            </div>
            <div className="vault-toolbar-actions">
              <button className="btn-secondary" onClick={exportVault}>{t("vault.export", "Export Vault")}</button>
              <label className="btn-secondary vault-upload-btn">
                {t("vault.import", "Import Vault")}
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    importVault(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {legacyLocalCount ? (
                <button className="btn-secondary" disabled={migrating} onClick={migrateLegacyAttachments}>
                  {migrating ? t("vault.migrating", "Migrating...") : `${t("vault.migrateLocal", "Migrate Local Files")} (${legacyLocalCount})`}
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="fl" style={{ marginBottom: 8, display: "block" }}>{t("goals.starterTemplates", "Starter Templates")}</label>
            <div className="filter-strip" style={{ marginBottom: 0 }}>
              {DOC_TEMPLATES.map((template) => (
                <button key={template.title} className="filter-chip" onClick={() => setForm({ ...template, attachments: [] })}>
                  {t(DOC_TEMPLATE_KEYS[template.title] || "vault.docTitle", template.title)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="fg full">
              <label className="fl">{t("vault.docTitle", "Document Title")}</label>
              <input className="fi" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t("vault.docPlaceholder", "Health insurance policy, home loan statement...")} />
            </div>
            <div className="fg">
              <label className="fl">{t("vault.type", "Type")}</label>
              <select className="fs" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}>
                {["Insurance", "Loan", "Tax", "Investment", "Identity", "Other"].map((option) => <option key={option} value={option}>{t(DOC_TYPE_KEYS[option], option)}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">{t("vault.issuerOwner", "Issuer / Owner")}</label>
              <input className="fi" value={form.issuer} onChange={(e) => setForm((prev) => ({ ...prev, issuer: e.target.value }))} placeholder={t("vault.issuerPlaceholder", "HDFC Life, SBI, CA, Zerodha...")} />
            </div>
            <div className="fg">
              <label className="fl">{t("vault.renewalDate", "Renewal or Due Date")}</label>
              <input className="fi" type="date" value={form.renewalDate} onChange={(e) => setForm((prev) => ({ ...prev, renewalDate: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">{t("vault.reminderLeadDays", "Reminder Lead Days")}</label>
              <input className="fi" type="number" value={form.reminderDays} onChange={(e) => setForm((prev) => ({ ...prev, reminderDays: e.target.value }))} />
            </div>
            <div className="fg full">
              <label className="fl">{t("vault.reference", "Reference")}</label>
              <input className="fi" value={form.reference} onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))} placeholder={t("vault.referencePlaceholder", "Policy number, folio, loan account, storage path...")} />
            </div>
            <div className="fg full">
              <label className="fl">{t("vault.notes", "Notes")}</label>
              <textarea className="fta" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder={t("vault.notesPlaceholder", "Coverage amount, renewal checklist, nominee info, CA handoff notes...")} />
            </div>
            <div className="fg full">
              <div className="setting-row" style={{ alignItems: "stretch" }}>
                <button className="btn-primary" onClick={saveDoc}>{editingId ? t("vault.saveChanges", "Save Changes") : t("vault.addReminder", "Add Reminder")}</button>
                {editingId ? <button className="btn-secondary" onClick={resetForm}>{t("common.cancel", "Cancel")}</button> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          {sortedDocs.length ? sortedDocs.map((item) => {
            const status = reminderStatus(item);
            const attachments = attachmentMap[item.id] || item.attachments || [];
            return (
              <div key={item.id} className="section-card">
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <div>
                    <h3 style={{ marginBottom: 2 }}>{item.title}</h3>
                    <p style={{ marginBottom: 0 }}>{t(DOC_TYPE_KEYS[item.type], item.type)}{item.issuer ? ` • ${item.issuer}` : ""}</p>
                  </div>
                  <span className={`status-pill ${status.tone}`}>{t(STATUS_KEYS[status.label], status.label)}</span>
                </div>
                <div className="mini-grid">
                  <div className="mini-card">
                    <div className="k">{t("vault.renewalDate", "Renewal or Due Date")}</div>
                    <div className="v">{item.renewalDate || "—"}</div>
                    <div className="muted">{status.daysLeft == null ? t("vault.noDateOnFile", "No date on file.") : status.daysLeft < 0 ? `${Math.abs(status.daysLeft)} ${t("vault.daysOverdue", "day(s) overdue.")}` : `${status.daysLeft} ${t("vault.daysLeft", "day(s) left.")}`}</div>
                  </div>
                  <div className="mini-card">
                    <div className="k">{t("vault.reminderLead", "Reminder Lead")}</div>
                    <div className="v">{item.reminderDays} {t("vault.days", "days")}</div>
                    <div className="muted">{t("vault.reminderLeadSub", "Reminder window opens this many days before renewal.")}</div>
                  </div>
                  <div className="mini-card">
                    <div className="k">{t("vault.attachedFiles", "Attached Files")}</div>
                    <div className="v">{attachments.length}</div>
                    <div className="muted">{t("vault.attachedFilesSub", "Local-first files tied to this document. Cloud sync runs in the background.")}</div>
                  </div>
                </div>
                {item.reference ? <div className="stat-line"><span>{t("vault.reference", "Reference")}</span><span>{item.reference}</span></div> : null}
                {item.note ? <p className="muted" style={{ marginTop: 10 }}>{item.note}</p> : null}
                <div className="vault-upload-row">
                  <label className="btn-secondary vault-upload-btn">
                    {t("vault.uploadFiles", "Upload Files")}
                    <input
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        uploadFiles(item.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="muted">{t("vault.uploadSub", "PDF, image, or statement up to 2 MB each. Files save locally first, then sync to your Finwise cloud vault.")}</span>
                </div>
                <div className="vault-files-block">
                  <div className="vault-files-head">
                    <strong>{t("vault.filesInVault", "Files in Vault")}</strong>
                    <span className="muted">{attachments.length ? `${attachments.length} ${t("vault.filesAttached", "file(s) attached")}` : t("vault.noFilesYet", "No files attached yet")}</span>
                  </div>
                  {attachments.length ? (
                    <div className="stack" style={{ marginTop: 10 }}>
                      {attachments.map((file) => (
                        <div key={file.id} className="vault-file-row">
                          <div>
                            <strong>{file.name}</strong>
                            <p className="muted">{fmtSize(file.size)} • {file.type || "file"}</p>
                            <div className="vault-sync-meta">
                              <span className={`sync-pill ${file.syncStatus || "local"}`}>
                                {file.syncStatus === "synced"
                                  ? t("vault.synced", "Synced")
                                  : file.syncStatus === "syncing"
                                    ? t("vault.syncing", "Syncing")
                                    : file.syncStatus === "error"
                                      ? t("vault.retryNeeded", "Retry needed")
                                      : t("vault.savedLocally", "Saved locally")}
                              </span>
                              {file.lastError ? <span className="muted">{file.lastError}</span> : null}
                            </div>
                          </div>
                          <div className="setting-row">
                            <button className="tx-btn" onClick={() => openAttachment(file.id)}>{t("vault.open", "Open")}</button>
                            {file.syncStatus !== "synced" ? (
                              <button
                                className="tx-btn edit"
                                onClick={() => queueSync(() => syncAttachment(item.id, file))}
                              >
                                {t("vault.retry", "Retry")}
                              </button>
                            ) : null}
                            <button className="tx-btn del" onClick={() => removeAttachment(item.id, file.id)}>{t("common.delete", "Delete")}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="vault-files-empty muted">
                      {t("vault.fileEmpty", "Upload a PDF, image, or statement and it will appear here with Open and Delete actions.")}
                    </div>
                  )}
                </div>
                <div className="setting-row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                  <button className="tx-btn edit" onClick={() => editDoc(item)}>{t("common.edit", "Edit")}</button>
                  <button className="tx-btn del" onClick={() => removeDoc(item.id)}>{t("common.delete", "Delete")}</button>
                </div>
              </div>
            );
          }) : (
            <div className="section-card">
              <h3>{t("vault.emptyTitle", "No documents yet")}</h3>
              <p>{t("vault.emptyBody", "Add policy renewals, tax proof packs, loan statements, investment references, and actual file uploads so Finwise can surface what needs attention before it becomes urgent.")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
