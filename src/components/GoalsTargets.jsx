import { useMemo, useState } from "react";
import { fmtINR, goalId } from "../lib/utils";

const GOAL_TYPES = ["Emergency Fund", "Vacation", "Retirement", "Education", "Home", "Vehicle", "Investment Target", "Insurance Cover"];
const GOAL_TEMPLATES = [
  { name: "Emergency Fund", category: "Emergency Fund", targetAmount: "300000", currentAmount: "", targetDate: "" },
  { name: "Annual Vacation", category: "Vacation", targetAmount: "120000", currentAmount: "", targetDate: "" },
  { name: "Retirement Top-Up", category: "Retirement", targetAmount: "500000", currentAmount: "", targetDate: "" },
  { name: "Home Down Payment", category: "Home", targetAmount: "1500000", currentAmount: "", targetDate: "" },
];

const monthsUntil = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date();
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
  return Math.max(months + 1, 1);
};

export default function GoalsTargets({ goals, setGoals }) {
  const [form, setForm] = useState({
    name: "",
    category: "Emergency Fund",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
  });
  const [contributions, setContributions] = useState({});

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

  const metrics = useMemo(() => {
    const targetTotal = goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
    const fundedTotal = goals.reduce((sum, goal) => sum + Number(goal.currentAmount || 0), 0);
    const monthlyRequired = goals.reduce((sum, goal) => {
      const remaining = Math.max(Number(goal.targetAmount || 0) - Number(goal.currentAmount || 0), 0);
      const monthsLeft = monthsUntil(goal.targetDate);
      return sum + (monthsLeft ? remaining / monthsLeft : 0);
    }, 0);
    const onTrack = goals.filter((goal) => {
      const remaining = Math.max(Number(goal.targetAmount || 0) - Number(goal.currentAmount || 0), 0);
      const monthsLeft = monthsUntil(goal.targetDate);
      if (!monthsLeft || remaining <= 0) return Number(goal.currentAmount || 0) >= Number(goal.targetAmount || 0);
      const targetPace = Number(goal.targetAmount || 0) / monthsLeft;
      return Number(goal.currentAmount || 0) >= targetPace;
    }).length;
    return {
      targetTotal,
      fundedTotal,
      monthlyRequired,
      onTrack,
      fundedPct: targetTotal ? (fundedTotal / targetTotal) * 100 : 0,
    };
  }, [goals]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Goals & Targets</h1>
          <p>Track emergency fund, travel, big purchases, and long-term milestones.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">Goal Corpus</div>
          <div className="sc-value">{fmtINR(metrics.targetTotal)}</div>
          <div className="sc-sub">Total amount planned across all active goals.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Already Funded</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(metrics.fundedTotal)}</div>
          <div className="sc-sub">{metrics.targetTotal ? `${metrics.fundedPct.toFixed(0)}% of target pool covered.` : "No active targets yet."}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Monthly Goal Pace</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(metrics.monthlyRequired)}</div>
          <div className="sc-sub">Estimated monthly contribution needed to hit dated goals.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">On-Track Goals</div>
          <div className="sc-value" style={{ color: metrics.onTrack === goals.length && goals.length ? "var(--income)" : "var(--accent)" }}>
            {goals.length ? `${metrics.onTrack}/${goals.length}` : "—"}
          </div>
          <div className="sc-sub">Goals with progress that is not obviously behind pace.</div>
        </div>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div style={{ marginBottom: 14 }}>
            <label className="fl" style={{ marginBottom: 8, display: "block" }}>Starter Templates</label>
            <div className="filter-strip" style={{ marginBottom: 0 }}>
              {GOAL_TEMPLATES.map((template) => (
                <button key={template.name} className="filter-chip" onClick={() => setForm(template)}>
                  {template.name}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <div className="fg full">
              <label className="fl">Goal Name</label>
              <input className="fi" placeholder="Emergency fund, Europe trip, house down payment..." value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Goal Type</label>
              <select className="fs" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {GOAL_TYPES.map((x) => <option key={x}>{x}</option>)}
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
            const remaining = Math.max(Number(goal.targetAmount || 0) - Number(goal.currentAmount || 0), 0);
            const monthsLeft = monthsUntil(goal.targetDate);
            const monthlyNeed = monthsLeft ? remaining / monthsLeft : 0;
            const status = progress >= 100 ? "Completed" : monthlyNeed > 0 && progress < 30 ? "Needs pace" : "In progress";
            const contribution = Number(contributions[goal.id] || 0);
            return (
              <div key={goal.id} className="goal-card goal-card-premium">
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <div>
                    <strong>{goal.name}</strong>
                    <p>{goal.category}{goal.targetDate ? ` • target ${goal.targetDate}` : ""}</p>
                  </div>
                  <div className="goal-head-actions">
                    <span className={`status-pill ${status === "Completed" ? "verified" : status === "Needs pace" ? "pending" : "neutral"}`}>{status}</span>
                    <button className="tx-btn del" onClick={() => removeGoal(goal.id)}>Delete</button>
                  </div>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${progress}%`, background: progress >= 75 ? "var(--income)" : "var(--accent)" }} />
                </div>
                <div className="split-row" style={{ fontSize: 11.5, color: "var(--text2)", marginBottom: 12 }}>
                  <span>{fmtINR(goal.currentAmount)} saved</span>
                  <span>{progress.toFixed(0)}% of {fmtINR(goal.targetAmount)}</span>
                </div>
                <div className="goal-metrics">
                  <div className="mini-stat">
                    <span>Remaining</span>
                    <strong>{fmtINR(remaining)}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Monthly need</span>
                    <strong>{monthsLeft ? fmtINR(monthlyNeed) : "No date"}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Time left</span>
                    <strong>{monthsLeft ? `${monthsLeft} mo` : "Flexible"}</strong>
                  </div>
                </div>
                <div className="setting-row">
                  <input
                    className="setting-input"
                    type="number"
                    placeholder="Add contribution"
                    value={contributions[goal.id] || ""}
                    onChange={(e) => setContributions((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                  />
                  <button
                    className="btn-save"
                    onClick={() => {
                      updateGoal(goal.id, { currentAmount: Number(goal.currentAmount || 0) + contribution });
                      setContributions((prev) => ({ ...prev, [goal.id]: "" }));
                    }}
                    disabled={!contribution}
                  >
                    Add
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      updateGoal(goal.id, { currentAmount: contribution });
                      setContributions((prev) => ({ ...prev, [goal.id]: "" }));
                    }}
                    disabled={!contribution}
                  >
                    Set Exact
                  </button>
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
