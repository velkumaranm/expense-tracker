import MonthStrip from "./MonthStrip";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  INVESTMENT_CATEGORIES,
  INSURANCE_CATEGORIES,
  CATEGORY_ICONS,
  TYPE_META,
  VALID_TYPES,
} from "../lib/constants";
import { fmtINR } from "../lib/utils";

export default function History({
  filtered,
  search,
  setSearch,
  filterCategory,
  setFilterCategory,
  filterType,
  setFilterType,
  recurringOnly,
  setRecurringOnly,
  onEdit,
  onDelete,
  onExport,
  months,
  selectedMonth,
  setSelectedMonth,
}) {
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES, ...INSURANCE_CATEGORIES];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>{filtered.length} record{filtered.length !== 1 ? "s" : ""} in the current view</p>
        </div>
        <button className="icon-btn" onClick={onExport}>Export CSV</button>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...VALID_TYPES].map((item) => (
            <button key={item} className={`filter-chip ${filterType === item ? "active" : ""}`} onClick={() => setFilterType(item)}>
              {item === "all" ? "All" : `${TYPE_META[item].icon} ${TYPE_META[item].label}`}
            </button>
          ))}
          <button className={`filter-chip ${recurringOnly ? "active" : ""}`} onClick={() => setRecurringOnly((v) => !v)}>
            Recurring Only
          </button>
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search note, category, amount…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filter-strip" style={{ marginBottom: 12 }}>
        <button className={`filter-chip ${!filterCategory ? "active" : ""}`} onClick={() => setFilterCategory("")}>All Categories</button>
        {allCats.map((c) => (
          <button key={c} className={`filter-chip ${filterCategory === c ? "active" : ""}`} onClick={() => setFilterCategory(filterCategory === c ? "" : c)}>
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {!filtered.length ? (
          <div className="empty-state">
            <div className="es-icon">📭</div>
            <p>No transactions match these filters yet.</p>
          </div>
        ) : filtered.map((item) => (
          <div key={item.id} className="tx-item">
            <div className={`tx-icon ${item.type}`}>{CATEGORY_ICONS[item.category] || "💸"}</div>
            <div className="tx-info">
              <div className="tx-cat">
                {item.category}
                <span className={`tx-badge ${item.type}`}>{TYPE_META[item.type]?.label || item.type}</span>
                {item.recurring && <span className="tx-badge recurring">{item.recurringFrequency || "monthly"}</span>}
              </div>
              <div className="tx-note">{item.note || "No note"}</div>
            </div>
            <div className="tx-actions">
              <button className="tx-btn" onClick={() => onEdit(item)}>Edit</button>
              <button className="tx-btn del" onClick={() => onDelete(item.id)}>Delete</button>
            </div>
            <div className="tx-meta">
              <div className="tx-amount" style={{ color: TYPE_META[item.type]?.color }}>{TYPE_META[item.type]?.sign || ""}{fmtINR(item.amount)}</div>
              <div className="tx-date">{item.date}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
