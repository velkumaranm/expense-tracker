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
import { getCategoryLabel, getTypeLabel, useI18n } from "../lib/i18n";

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
  const { t, language } = useI18n();
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES, ...INSURANCE_CATEGORIES];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("history.title", "History")}</h1>
          <p>{filtered.length} {t("history.records", "records in the current view")}</p>
        </div>
        <button className="icon-btn" onClick={onExport}>{t("analytics.exportCsv", "Export CSV")}</button>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...VALID_TYPES].map((item) => (
            <button key={item} className={`filter-chip ${filterType === item ? "active" : ""}`} onClick={() => setFilterType(item)}>
              {item === "all" ? t("common.all", "All") : `${TYPE_META[item].icon} ${getTypeLabel(language, item, TYPE_META[item].label)}`}
            </button>
          ))}
          <button className={`filter-chip ${recurringOnly ? "active" : ""}`} onClick={() => setRecurringOnly((v) => !v)}>
            {t("history.recurringOnly", "Recurring Only")}
          </button>
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder={t("history.searchPlaceholder", "Search note, category, amount…")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filter-strip" style={{ marginBottom: 12 }}>
        <button className={`filter-chip ${!filterCategory ? "active" : ""}`} onClick={() => setFilterCategory("")}>{t("history.allCategories", "All Categories")}</button>
        {allCats.map((c) => (
          <button key={c} className={`filter-chip ${filterCategory === c ? "active" : ""}`} onClick={() => setFilterCategory(filterCategory === c ? "" : c)}>
            {CATEGORY_ICONS[c]} {getCategoryLabel(language, c)}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {!filtered.length ? (
          <div className="empty-state">
            <div className="es-icon">📭</div>
            <p>{t("history.noMatches", "No transactions match these filters yet.")}</p>
          </div>
        ) : filtered.map((item) => (
          <div key={item.id} className="tx-item">
            <div className={`tx-icon ${item.type}`}>{CATEGORY_ICONS[item.category] || "💸"}</div>
            <div className="tx-info">
              <div className="tx-cat">
                {getCategoryLabel(language, item.category, item.category)}
                <span className={`tx-badge ${item.type}`}>{getTypeLabel(language, item.type, TYPE_META[item.type]?.label || item.type)}</span>
                {item.recurring && <span className="tx-badge recurring">{t(`add.${item.recurringFrequency || "monthly"}`, item.recurringFrequency || "monthly")}</span>}
              </div>
              <div className="tx-note">{item.note || t("history.noNote", "No note")}</div>
            </div>
            <div className="tx-actions">
              <button className="tx-btn" onClick={() => onEdit(item)}>{t("common.edit", "Edit")}</button>
              <button className="tx-btn del" onClick={() => onDelete(item.id)}>{t("common.delete", "Delete")}</button>
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
