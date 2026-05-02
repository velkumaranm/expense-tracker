import { useEffect, useMemo, useState } from "react";
import {
  migrateLocalAttachmentToCloud,
  openVaultAttachment,
  purgeVaultAttachments,
  removeVaultAttachment,
  saveVaultAttachmentToCloud,
} from "../lib/vaultStorage";
import { goalId } from "../lib/utils";

const DOC_TEMPLATES = [
  { title: "Health Insurance Policy", type: "Insurance", issuer: "Insurer", renewalDate: "", reminderDays: 30, reference: "", note: "" },
  { title: "Term Life Policy", type: "Insurance", issuer: "Insurer", renewalDate: "", reminderDays: 45, reference: "", note: "" },
  { title: "Home Loan Statement", type: "Loan", issuer: "Bank", renewalDate: "", reminderDays: 15, reference: "", note: "" },
  { title: "Tax Proof Bundle", type: "Tax", issuer: "Employer / CA", renewalDate: "", reminderDays: 20, reference: "", note: "" },
];

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
  const [form, setForm] = useState(emptyDoc);
  const [editingId, setEditingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attachmentMap, setAttachmentMap] = useState({});
  const [migrating, setMigrating] = useState(false);

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

  const saveDoc = () => {
    if (!form.title) return;
    const next = {
      ...form,
      reminderDays: Number(form.reminderDays || 30),
    };
    if (editingId) {
      setDocs((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...next } : item)));
      showToast("Document updated.");
    } else {
      const id = goalId();
      setDocs((prev) => [{ id, ...next }, ...prev]);
      showToast("Document reminder added.");
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
    showToast("Document removed.", "warning");
  };

  const uploadFiles = async (docId, files) => {
    const list = Array.from(files || []);
    if (!docId || !list.length) return;
    setUploading(true);
    try {
      const saved = [];
      for (const file of list) {
        if (file.size > 2 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than 2 MB. Keep uploads lightweight for browser vault storage.`);
        }
        const record = await saveVaultAttachmentToCloud(user?.uid, docId, file);
        saved.push({
          id: record.id,
          name: record.name,
          type: record.type,
          size: record.size,
          storedAt: record.storedAt,
          storagePath: record.storagePath,
          downloadUrl: record.downloadUrl,
          storageDriver: record.storageDriver,
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
      showToast(`${saved.length} file${saved.length === 1 ? "" : "s"} uploaded to the vault.`);
    } catch (error) {
      showToast(error.message || "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const openAttachment = async (attachmentId) => {
    try {
      const attachment = docs.flatMap((item) => item.attachments || []).find((item) => item.id === attachmentId);
      const url = await openVaultAttachment(attachment);
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      if (!tab) throw new Error("Allow pop-ups to open attached documents.");
    } catch (error) {
      showToast(error.message || "Could not open attachment.", "error");
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
    showToast("Attachment removed.", "warning");
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
      showToast("Sign in before migrating vault files.", "error");
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
      showToast("Legacy vault uploads were migrated to cloud storage.");
    } catch (error) {
      showToast(error.message || "Vault migration failed.", "error");
    } finally {
      setMigrating(false);
    }
  };

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
    showToast("Vault metadata exported.");
  };

  const importVault = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const importedDocs = Array.isArray(payload?.docs) ? payload.docs : [];
      if (!importedDocs.length) throw new Error("This export file does not contain any vault documents.");
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
      showToast(`Imported ${importedDocs.length} vault document${importedDocs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showToast(error.message || "Could not import vault backup.", "error");
    }
  };

  const attachmentCount = docs.reduce((sum, item) => sum + Number(item.attachments?.length || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Documents Vault</h1>
          <p>Store uploads, renewal reminders, and key references for insurance, loans, taxes, and wealth documents.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Documents</div>
          <div className="sc-value">{docs.length}</div>
          <div className="sc-sub">Policies, statements, tax packs, and reminders stored in one command center.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Uploads</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{attachmentCount}</div>
          <div className="sc-sub">Files attached to your Finwise cloud vault for cross-device reference and review.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Due Soon</div>
          <div className="sc-value" style={{ color: reminderCounts.dueSoon ? "var(--accent)" : "var(--income)" }}>{reminderCounts.dueSoon}</div>
          <div className="sc-sub">Documents whose reminder window has already opened.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Expired / Overdue</div>
          <div className="sc-value" style={{ color: reminderCounts.expired ? "var(--expense)" : "var(--income)" }}>{reminderCounts.expired}</div>
          <div className="sc-sub">Renewals or compliance items that need attention right away.</div>
        </div>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div className="setting-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="muted" style={{ flex: 1, minWidth: 0 }}>
              Vault reminders sync with your account. File uploads now live in Firebase Storage instead of this browser only.
            </div>
            <div className="setting-row">
              <button className="btn-secondary" onClick={exportVault}>Export Vault</button>
              <label className="btn-secondary vault-upload-btn">
                Import Vault
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
                  {migrating ? "Migrating..." : `Migrate Local Files (${legacyLocalCount})`}
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="fl" style={{ marginBottom: 8, display: "block" }}>Starter Templates</label>
            <div className="filter-strip" style={{ marginBottom: 0 }}>
              {DOC_TEMPLATES.map((template) => (
                <button key={template.title} className="filter-chip" onClick={() => setForm({ ...template, attachments: [] })}>
                  {template.title}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="fg full">
              <label className="fl">Document title</label>
              <input className="fi" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Health insurance policy, home loan statement..." />
            </div>
            <div className="fg">
              <label className="fl">Type</label>
              <select className="fs" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}>
                {["Insurance", "Loan", "Tax", "Investment", "Identity", "Other"].map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Issuer / Owner</label>
              <input className="fi" value={form.issuer} onChange={(e) => setForm((prev) => ({ ...prev, issuer: e.target.value }))} placeholder="HDFC Life, SBI, CA, Zerodha..." />
            </div>
            <div className="fg">
              <label className="fl">Renewal or due date</label>
              <input className="fi" type="date" value={form.renewalDate} onChange={(e) => setForm((prev) => ({ ...prev, renewalDate: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Reminder lead days</label>
              <input className="fi" type="number" value={form.reminderDays} onChange={(e) => setForm((prev) => ({ ...prev, reminderDays: e.target.value }))} />
            </div>
            <div className="fg full">
              <label className="fl">Reference</label>
              <input className="fi" value={form.reference} onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))} placeholder="Policy number, folio, loan account, storage path..." />
            </div>
            <div className="fg full">
              <label className="fl">Notes</label>
              <textarea className="fta" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Coverage amount, renewal checklist, nominee info, CA handoff notes..." />
            </div>
            <div className="fg full">
              <div className="setting-row" style={{ alignItems: "stretch" }}>
                <button className="btn-primary" onClick={saveDoc}>{editingId ? "Save Changes" : "Add Reminder"}</button>
                {editingId ? <button className="btn-secondary" onClick={resetForm}>Cancel</button> : null}
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
                    <p style={{ marginBottom: 0 }}>{item.type}{item.issuer ? ` • ${item.issuer}` : ""}</p>
                  </div>
                  <span className={`status-pill ${status.tone}`}>{status.label}</span>
                </div>
                <div className="mini-grid">
                  <div className="mini-card">
                    <div className="k">Renewal date</div>
                    <div className="v">{item.renewalDate || "—"}</div>
                    <div className="muted">{status.daysLeft == null ? "No date on file." : status.daysLeft < 0 ? `${Math.abs(status.daysLeft)} day(s) overdue.` : `${status.daysLeft} day(s) left.`}</div>
                  </div>
                  <div className="mini-card">
                    <div className="k">Reminder lead</div>
                    <div className="v">{item.reminderDays} days</div>
                    <div className="muted">Reminder window opens this many days before renewal.</div>
                  </div>
                  <div className="mini-card">
                    <div className="k">Attached files</div>
                    <div className="v">{attachments.length}</div>
                    <div className="muted">Cloud vault files tied to this document.</div>
                  </div>
                </div>
                {item.reference ? <div className="stat-line"><span>Reference</span><span>{item.reference}</span></div> : null}
                {item.note ? <p className="muted" style={{ marginTop: 10 }}>{item.note}</p> : null}
                <div className="vault-upload-row">
                  <label className="btn-secondary vault-upload-btn">
                    {uploading ? "Uploading..." : "Upload Files"}
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
                  <span className="muted">PDF, image, or statement up to 2 MB each. Stored in your Finwise cloud vault.</span>
                </div>
                {attachments.length ? (
                  <div className="stack" style={{ marginTop: 12 }}>
                    {attachments.map((file) => (
                      <div key={file.id} className="vault-file-row">
                        <div>
                          <strong>{file.name}</strong>
                          <p className="muted">{fmtSize(file.size)} • {file.type || "file"}</p>
                        </div>
                        <div className="setting-row">
                          <button className="tx-btn" onClick={() => openAttachment(file.id)}>Open</button>
                          <button className="tx-btn del" onClick={() => removeAttachment(item.id, file.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="setting-row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                  <button className="tx-btn edit" onClick={() => editDoc(item)}>Edit</button>
                  <button className="tx-btn del" onClick={() => removeDoc(item.id)}>Delete</button>
                </div>
              </div>
            );
          }) : (
            <div className="section-card">
              <h3>No documents yet</h3>
              <p>Add policy renewals, tax proof packs, loan statements, investment references, and actual file uploads so Finwise can surface what needs attention before it becomes urgent.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
