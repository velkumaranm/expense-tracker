import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PIE_COLORS, INV_COLORS, INS_COLORS } from "../lib/constants";
import { fmtINR } from "../lib/utils";
import MonthStrip from "./MonthStrip";
import { AreaTip, PieTip } from "./ChartBits";

export default function Dashboard({
  months,
  selectedMonth,
  setSelectedMonth,
  totals,
  budgetNum,
  budgetProgress,
  budgetColor,
  expPieData,
  invPieData,
  insPieData,
  monthlySeries,
  alerts,
  topCategories,
  recurringOutflow,
  netWorth,
  unusualTransactions,
}) {
  const balanceTone = totals.balance >= 0 ? "var(--income)" : "var(--expense)";
  const savingsColor = totals.savingsRate >= 20 ? "var(--income)" : totals.savingsRate >= 10 ? "var(--accent)" : "var(--expense)";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{selectedMonth === "all" ? "Full financial system view" : `Monthly command center — ${selectedMonth}`}</p>
        </div>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="summary-grid">
        <div className="summary-card summary-span-6">
          <div className="sc-label">Net Cash Position</div>
          <div className="sc-value" style={{ color: balanceTone }}>
            {totals.balance >= 0 ? fmtINR(totals.balance) : `-${fmtINR(Math.abs(totals.balance))}`}
          </div>
          <div className="sc-sub">Income minus expenses, investments, and insurance in the selected period.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Savings Rate</div>
          <div className="sc-value" style={{ color: savingsColor }}>{totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}</div>
          <div className="sc-sub">Savings after expense only, before investing decisions.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Net Worth</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">Cash reserve + investments + manual assets - liabilities.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Income</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(totals.income)}</div>
          <div className="sc-sub">Total inflow recorded.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Expenses</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{fmtINR(totals.expense)}</div>
          <div className="sc-sub">Core lifestyle and operational outflow.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Investments</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(totals.investment)}</div>
          <div className="sc-sub">Capital deployed toward future growth.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Insurance</div>
          <div className="sc-value" style={{ color: "var(--insure)" }}>{fmtINR(totals.insurance)}</div>
          <div className="sc-sub">Protection outflow and risk cover spend.</div>
        </div>
      </div>

      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="sc-label" style={{ marginBottom: 0 }}>Expense Budget</span>
            <span style={{ color: budgetColor, fontSize: 12.5, fontWeight: 600 }}>{fmtINR(totals.expense)} / {fmtINR(budgetNum)}</span>
          </div>
          <div className="budget-track">
            <div className="budget-fill" style={{ width: `${budgetProgress}%`, background: budgetColor }} />
          </div>
          <div className="split-row" style={{ marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
            <span>{budgetProgress.toFixed(0)}% used</span>
            <span>{totals.expense <= budgetNum ? `${fmtINR(budgetNum - totals.expense)} remaining` : `${fmtINR(totals.expense - budgetNum)} over budget`}</span>
          </div>
        </div>
      )}

      <div className="charts-grid">
        <div className="chart-card chart-span-7">
          <div className="chart-title">12-Month Cash Flow</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlySeries}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#34D399" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#F87171" radius={[6, 6, 0, 0]} />
              <Bar dataKey="savings" name="Savings" fill="#C8A96E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-5">
          <div className="chart-title">Expense Mix</div>
          {expPieData.length ? (
            <div className="pie-row">
              <PieChart width={140} height={140}>
                <Pie data={expPieData.slice(0, 6)} dataKey="value" cx={62} cy={62} innerRadius={32} outerRadius={56} paddingAngle={2}>
                  {expPieData.slice(0, 6).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div className="pie-legend">
                {expPieData.slice(0, 6).map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val">{fmtINR(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="empty-state"><p>No expense data for this period yet.</p></div>}
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">Attention Center</div>
          <div className="insight-list">
            {alerts.length ? alerts.map((alert, idx) => (
              <div key={idx} className={`alert-item ${alert.tone || "info"}`}>
                <strong>{alert.title}</strong>
                <p>{alert.body}</p>
              </div>
            )) : (
              <div className="alert-item good">
                <strong>Everything looks steady</strong>
                <p>No immediate budget, anomaly, or liquidity warnings from the current data.</p>
              </div>
            )}
          </div>
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">Quick Diagnostics</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">Top Expense</div>
              <div className="v">{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
              <div className="muted">{topCategories[0]?.name || "No spend yet"}</div>
            </div>
            <div className="mini-card">
              <div className="k">Recurring Outflow</div>
              <div className="v" style={{ color: "var(--accent)" }}>{fmtINR(recurringOutflow)}</div>
              <div className="muted">Bills, EMIs, and subscriptions flagged recurring.</div>
            </div>
            <div className="mini-card">
              <div className="k">Unusual Spend</div>
              <div className="v" style={{ color: unusualTransactions.length ? "var(--expense)" : "var(--income)" }}>{unusualTransactions.length}</div>
              <div className="muted">{unusualTransactions.length ? "Needs review" : "Nothing flagged"}</div>
            </div>
          </div>
          {(invPieData.length > 0 || insPieData.length > 0) && (
            <div className="two-col" style={{ marginTop: 14 }}>
              {invPieData.length > 0 && (
                <div className="section-card" style={{ marginBottom: 0 }}>
                  <div className="chart-title" style={{ color: "var(--invest)" }}>Investment Allocation</div>
                  {invPieData.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="stat-line">
                      <span>{item.name}</span>
                      <span style={{ color: INV_COLORS[i % INV_COLORS.length] }}>{fmtINR(item.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {insPieData.length > 0 && (
                <div className="section-card" style={{ marginBottom: 0 }}>
                  <div className="chart-title" style={{ color: "var(--insure)" }}>Insurance Load</div>
                  {insPieData.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="stat-line">
                      <span>{item.name}</span>
                      <span style={{ color: INS_COLORS[i % INS_COLORS.length] }}>{fmtINR(item.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
