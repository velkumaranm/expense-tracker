import { TYPE_META, VALID_TYPES, CATEGORY_ICONS } from "../lib/constants";
import { categoriesForType, defaultCategoryForType } from "../lib/utils";

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
  const changeType = (nextType) => {
    setType(nextType);
    setCategory(defaultCategoryForType(nextType));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>Track income, expenses, investments, insurance, and recurring cash movements.</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="fg full">
            <label className="fl">Type</label>
            <div className="type-toggle">
              {VALID_TYPES.map((item) => (
                <button key={item} className={`type-btn ${type === item ? `active ${item}` : ""}`} onClick={() => changeType(item)}>
                  {TYPE_META[item].icon} {TYPE_META[item].label}
                </button>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="fl">Amount (₹)</label>
            <input className="fi" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Category</label>
            <select className="fs" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categoriesForType(type).map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c] || "•"} {c}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Date</label>
            <input className="fi" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Recurring</label>
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
              <option value="one-time">One-time transaction</option>
              <option value="monthly">Monthly recurring</option>
              <option value="quarterly">Quarterly recurring</option>
              <option value="yearly">Yearly recurring</option>
            </select>
          </div>
          <div className="fg full">
            <label className="fl">Note</label>
            <textarea placeholder="Merchant, purpose, policy number, investment note, or any context." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="fg full" style={{ marginTop: 4 }}>
            <button className="btn-primary" onClick={onSubmit}>{editId ? "Update Transaction" : "Add Transaction"}</button>
            {editId && <button className="btn-secondary" style={{ marginTop: 10 }} onClick={onCancel}>Cancel Edit</button>}
          </div>
        </div>
      </div>
    </>
  );
}
