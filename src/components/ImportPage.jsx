import { useRef, useState } from "react";
import { ALL_CATS, EXPENSE_CATEGORIES, VALID_TYPES } from "../lib/constants";
import { autoMapColumns, normalizeDate, parseCSV, toLocalDateStr, fmtINR } from "../lib/utils";
import { TYPE_META } from "../lib/constants";

export default function ImportPage({ onImport, showToast }) {
  const [step, setStep] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [colMap, setColMap] = useState({ date: -1, type: -1, category: -1, amount: -1, note: -1 });
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) {
        showToast("Could not parse CSV.", "error");
        return;
      }
      setCsvData({ headers, rows });
      setColMap(autoMapColumns(headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const result = [];
    const errs = [];
    csvData.rows.forEach((row, i) => {
      const rawDate = colMap.date >= 0 ? row[colMap.date] : "";
      const rawType = colMap.type >= 0 ? row[colMap.type]?.toLowerCase().trim() : "expense";
      const rawCat = colMap.category >= 0 ? row[colMap.category]?.trim() : "";
      const rawAmt = colMap.amount >= 0 ? row[colMap.amount] : "0";
      const rawNote = colMap.note >= 0 ? row[colMap.note] : "";
      const date = normalizeDate(rawDate);
      const amount = parseFloat((rawAmt || "0").replace(/[^0-9.]/g, ""));
      const type = VALID_TYPES.includes(rawType) ? rawType : "expense";
      const known = ALL_CATS[type] || EXPENSE_CATEGORIES;
      const category = known.find((c) => c.toLowerCase() === rawCat.toLowerCase()) || known[0];
      const rowErrs = [];
      if (!date) rowErrs.push("invalid date");
      if (Number.isNaN(amount) || amount <= 0) rowErrs.push("invalid amount");
      if (rowErrs.length) errs.push(`Row ${i + 2}: ${rowErrs.join(", ")}`);
      result.push({
        date: date || toLocalDateStr(new Date()),
        type,
        category,
        amount: Number.isNaN(amount) ? 0 : amount,
        note: rawNote,
        valid: !rowErrs.length,
      });
    });
    setParsed(result);
    setErrors(errs);
    setStep("preview");
  };

  const runImport = async () => {
    setStep("importing");
    const valid = parsed.filter((r) => r.valid);
    let done = 0;
    for (const rec of valid) {
      await onImport(rec);
      done += 1;
      setImported(done);
      setProgress(Math.round((done / valid.length) * 100));
    }
    setStep("done");
    showToast(`Imported ${done} transaction${done !== 1 ? "s" : ""}.`);
  };

  const reset = () => {
    setStep("upload");
    setCsvData(null);
    setParsed([]);
    setErrors([]);
    setProgress(0);
    setImported(0);
  };

  const validCount = parsed.filter((r) => r.valid).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Import Transactions</h1>
          <p>Bulk upload your historic data from CSV.</p>
        </div>
        {step !== "upload" && <button className="icon-btn" onClick={reset}>Start Over</button>}
      </div>

      {step === "upload" && (
        <>
          <div
            className={`import-zone${drag ? " drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
            <div style={{ fontSize: 34, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Drop a CSV here</div>
            <div className="muted">or click to browse</div>
          </div>
          <div className="section-card">
            <h3>Expected Format</h3>
            <p>Date, Type, Category, Amount, Note</p>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text2)", background: "var(--surface)", padding: "12px 13px", borderRadius: 12, lineHeight: 1.8 }}>
              Date,Type,Category,Amount,Note<br />
              2026-04-15,expense,Food &amp; Dining,450,Lunch<br />
              2026-04-16,income,Salary,75000,April salary<br />
              2026-04-17,investment,PPF,5000,Monthly PPF<br />
              2026-04-18,insurance,Term Life Insurance,1200,Premium
            </div>
          </div>
        </>
      )}

      {step === "map" && csvData && (
        <div className="section-card">
          <h3>Map Columns</h3>
          <p>{csvData.rows.length} rows found. Match each CSV column to the right field.</p>
          <div className="form-grid">
            {Object.keys(colMap).map((field) => (
              <div key={field} className="fg">
                <label className="fl">{field}</label>
                <select className="fs" value={colMap[field]} onChange={(e) => setColMap((prev) => ({ ...prev, [field]: parseInt(e.target.value, 10) }))}>
                  <option value={-1}>Skip</option>
                  {csvData.headers.map((h, i) => <option key={i} value={i}>{h} (col {i + 1})</option>)}
                </select>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={buildPreview}>Preview Import</button>
        </div>
      )}

      {step === "preview" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="pill active">Valid: {validCount}</span>
            {errors.length > 0 && <span className="pill" style={{ color: "var(--expense)", borderColor: "rgba(248,113,113,.3)" }}>Skipped: {errors.length}</span>}
          </div>
          {errors.length > 0 && (
            <div className="section-card">
              <h3>Import Warnings</h3>
              <p>{errors.slice(0, 5).join(" | ")}{errors.length > 5 ? ` and ${errors.length - 5} more.` : ""}</p>
            </div>
          )}
          <div className="stack">
            {parsed.slice(0, 15).map((r, i) => (
              <div key={i} className="table-row" style={{ opacity: r.valid ? 1 : 0.45 }}>
                <div className="split-row">
                  <strong>{r.valid ? "Valid" : "Skip"}</strong>
                  <span style={{ color: TYPE_META[r.type]?.color }}>{TYPE_META[r.type]?.label}</span>
                </div>
                <p>{r.date} • {r.category} • {fmtINR(r.amount)} • {r.note || "No note"}</p>
              </div>
            ))}
          </div>
          {validCount > 0 && <button className="btn-primary" style={{ marginTop: 14 }} onClick={runImport}>Import {validCount} Transactions</button>}
        </>
      )}

      {step === "importing" && (
        <div className="section-card" style={{ textAlign: "center" }}>
          <h3>Importing</h3>
          <p>{imported} / {validCount} completed</p>
          <div className="progress-track" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${progress}%`, background: "var(--accent)" }} />
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="section-card" style={{ textAlign: "center" }}>
          <h3>Import Complete</h3>
          <p>{imported} transactions imported successfully.</p>
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={reset}>Import More</button>
        </div>
      )}
    </>
  );
}
