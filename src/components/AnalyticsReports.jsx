import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { monthLabel, fmtINR } from "../lib/utils";
import { PIE_COLORS } from "../lib/constants";
import { AreaTip } from "./ChartBits";

export default function AnalyticsReports({
  monthlySeries,
  yoyComparison,
  categoryTrendSeries,
  heatmap,
  onExportPdf,
  onExportCsv,
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Analytics & Reports</h1>
          <p>Year-over-year comparison, trend analysis, and printable reports.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="icon-btn" onClick={onExportCsv}>Export CSV</button>
          <button className="btn-primary" onClick={onExportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">Income YoY</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{yoyComparison.incomeDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.income)} vs {fmtINR(yoyComparison.previous.income)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Expense YoY</div>
          <div className="sc-value" style={{ color: yoyComparison.expenseUp ? "var(--expense)" : "var(--income)" }}>{yoyComparison.expenseDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.expense)} vs {fmtINR(yoyComparison.previous.expense)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Investment YoY</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{yoyComparison.investDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.investment)} vs {fmtINR(yoyComparison.previous.investment)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Savings YoY</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{yoyComparison.savingsDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.savings)} vs {fmtINR(yoyComparison.previous.savings)}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-span-6">
          <div className="chart-title">Monthly Trend</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlySeries}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Income" stroke="#34D399" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#F87171" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="investment" name="Investment" stroke="#818CF8" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">Category Trend Lines</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={categoryTrendSeries}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Legend />
              {Object.keys(categoryTrendSeries[0] || {})
                .filter((k) => !["label", "month"].includes(k))
                .map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-12">
          <div className="chart-title">Spending Heat Map</div>
          <div className="heat-grid">
            {!!heatmap.rows.length && (
              <div className="heat-row" style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700 }}>
                <div>Category</div>
                {heatmap.months.map((m) => <div key={m}>{monthLabel(m)}</div>)}
              </div>
            )}
            {heatmap.rows.map((row) => (
              <div key={row.category} className="heat-row">
                <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>{row.category}</div>
                {row.values.map((value, i) => (
                  <div
                    key={`${row.category}-${heatmap.months[i]}`}
                    className="heat-cell"
                    style={{
                      background: `rgba(200,169,110,${0.12 + value.intensity * 0.62})`,
                      borderColor: value.amount ? "rgba(200,169,110,.32)" : "var(--border)",
                    }}
                  >
                    {value.amount ? fmtINR(value.amount) : "—"}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
