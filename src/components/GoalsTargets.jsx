import { useState } from "react";
import { fmtINR, goalId } from "../lib/utils";

export default function GoalsTargets({ goals, setGoals }) {
  const [form, setForm] = useState({
    name: "",
    category: "Emergency Fund",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
  });

  const addGoal = () => {
    if (!form.name || !form.targetAmount) return;
    setGoals((prev) => [
      {
        id: goalId(),
        ...form,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount || 0),
      },
      ...prev,
    ]);
    setForm({ name: "", category: "Emergency Fund", targetAmount: "", currentAmount: "", targetDate: "" });
  };

  const updateGoal = (id, patch) =>
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const removeGoal = (id) => setGoals((prev) => prev.filter((g) => g.id !== id));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Goals & Targets</h1>
          <p>Track emergency fund, travel, big purchases, and long-term milestones.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div className="form-grid">
            <div className="fg full">
              <label className="fl">Goal Name</label>
              <input className="fi" placeholder="Emergency fund, Europe trip, house down payment…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Goal Type</label>
              <select className="fs" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {["Emergency Fund", "Vacation", "Retirement", "Education", "Home", "Vehicle", "Investment Target", "Insurance Cover"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Target Date</label>
              <input className="fi" type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Target Amount</label>
              <input className="fi" type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Current Progress</label>
              <input className="fi" type="number" value={form.currentAmount} onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))} />
            </div>
            <div className="fg full">
              <button className="btn-primary" onClick={addGoal}>Add Goal</button>
            </div>
          </div>
        </div>

        <div className="stack">
          {goals.length ? goals.map((goal) => {
            const progress = goal.targetAmount ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            return (
              <div key={goal.id} className="goal-card">
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <div>
                    <strong>{goal.name}</strong>
                    <p>{goal.category}{goal.targetDate ? ` • target ${goal.targetDate}` : ""}</p>
                  </div>
                  <button className="tx-btn del" onClick={() => removeGoal(goal.id)}>Delete</button>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${progress}%`, background: progress >= 75 ? "var(--income)" : "var(--accent)" }} />
                </div>
                <div className="split-row" style={{ fontSize: 11.5, color: "var(--text2)", marginBottom: 10 }}>
                  <span>{fmtINR(goal.currentAmount)} saved</span>
                  <span>{progress.toFixed(0)}% of {fmtINR(goal.targetAmount)}</span>
                </div>
                <div className="setting-row">
                  <input className="setting-input" type="number" value={goal.currentAmount} onChange={(e) => updateGoal(goal.id, { currentAmount: Number(e.target.value || 0) })} />
                  <button className="btn-save" onClick={() => updateGoal(goal.id, goal)}>Save</button>
                </div>
              </div>
            );
          }) : (
            <div className="section-card">
              <h3>No goals yet</h3>
              <p>Add a financial target and start measuring progress instead of hoping it happens.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
