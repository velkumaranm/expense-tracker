import { TYPE_META, VALID_TYPES, CATEGORY_ICONS } from "../lib/constants";
import { categoriesForType, defaultCategoryForType } from "../lib/utils";
import { getCategoryLabel, getTypeLabel, useI18n } from "../lib/i18n";

export default function AddForm({
  amount,
  setAmount,
  type,
  setType,
  category,
  setCategory,
  note,
  setNote,
  date,
  setDate,
  editId,
  onSubmit,
  onCancel,
  recurring,
  setRecurring,
  recurringFrequency,
  setRecurringFrequency,
}) {
  const { t, language } = useI18n();
  const changeType = (nextType) => {
    setType(nextType);
    setCategory(defaultCategoryForType(nextType));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? t("add.editTitle", "Edit Transaction") : t("add.title", "Add Transaction")}</h1>
          <p>{t("add.subtitle", "Track income, expenses, investments, insurance, and recurring cash movements.")}</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="fg full">
            <label className="fl">{t("add.type", "Type")}</label>
            <div className="type-toggle">
              {VALID_TYPES.map((item) => (
                <button key={item} className={`type-btn ${type === item ? `active ${item}` : ""}`} onClick={() => changeType(item)}>
                  {TYPE_META[item].icon} {getTypeLabel(language, item, TYPE_META[item].label)}
                </button>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="fl">{t("add.amount", "Amount (₹)")}</label>
            <input className="fi" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">{t("add.category", "Category")}</label>
            <select className="fs" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categoriesForType(type).map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c] || "•"} {getCategoryLabel(language, c)}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">{t("add.date", "Date")}</label>
            <input className="fi" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">{t("add.recurring", "Recurring")}</label>
            <select
              className="fs"
              value={recurring ? recurringFrequency : "one-time"}
              onChange={(e) => {
                if (e.target.value === "one-time") {
                  setRecurring(false);
                  setRecurringFrequency("monthly");
                } else {
                  setRecurring(true);
                  setRecurringFrequency(e.target.value);
                }
              }}
            >
              <option value="one-time">{t("add.oneTime", "One-time transaction")}</option>
              <option value="monthly">{t("add.monthly", "Monthly recurring")}</option>
              <option value="quarterly">{t("add.quarterly", "Quarterly recurring")}</option>
              <option value="yearly">{t("add.yearly", "Yearly recurring")}</option>
            </select>
          </div>
          <div className="fg full">
            <label className="fl">{t("add.note", "Note")}</label>
            <textarea placeholder={t("add.notePlaceholder", "Merchant, purpose, policy number, investment note, or any context.")} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="fg full" style={{ marginTop: 4 }}>
            <button className="btn-primary" onClick={onSubmit}>{editId ? t("common.save", "Save") : t("add.title", "Add Transaction")}</button>
            {editId && <button className="btn-secondary" style={{ marginTop: 10 }} onClick={onCancel}>{t("add.cancelEdit", "Cancel Edit")}</button>}
          </div>
        </div>
      </div>
    </>
  );
}
