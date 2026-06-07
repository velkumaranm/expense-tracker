import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { monthLabel, fmtINR } from "../lib/utils";
import { getCategoryLabel, useI18n } from "../lib/i18n";
import { PIE_COLORS } from "../lib/constants";
import { AreaTip } from "./ChartBits";

export default function AnalyticsReports({
  monthlySeries = [],
  yoyComparison = {
    incomeDelta: "—",
    expenseDelta: "—",
    investDelta: "—",
    savingsDelta: "—",
    expenseUp: false,
    current: { income: 0, expense: 0, investment: 0, savings: 0 },
    previous: { income: 0, expense: 0, investment: 0, savings: 0 },
  },
  categoryTrendSeries = [],
  heatmap = { rows: [], months: [] },
  onExportPdf = () => {},
  onExportCsv = () => {},
}) {
  const { t, language } = useI18n();
  const safeMonthlySeries = Array.isArray(monthlySeries) ? monthlySeries : [];
  const safeCategoryTrendSeries = Array.isArray(categoryTrendSeries) ? categoryTrendSeries : [];
  const safeHeatmap = {
    rows: Array.isArray(heatmap?.rows) ? heatmap.rows : [],
    months: Array.isArray(heatmap?.months) ? heatmap.months : [],
  };
  const safeYoy = {
    ...yoyComparison,
    current: { income: 0, expense: 0, investment: 0, savings: 0, ...(yoyComparison?.current || {}) },
    previous: { income: 0, expense: 0, investment: 0, savings: 0, ...(yoyComparison?.previous || {}) },
  };
  const fmtAxis = (value) => {
    const amount = Number(value || 0);
    if (!amount) return "0";
    return new Intl.NumberFormat("en-IN", {
      notation: "compact",
      maximumFractionDigits: amount >= 100000 ? 1 : 0,
    }).format(amount);
  };
  const validMonths = safeMonthlySeries.filter((month) => month?.income || month?.expense || month?.investment || month?.insurance);
  const bestSavingsMonth = validMonths.reduce((best, month) => (!best || month.savings > best.savings ? month : best), null);
  const worstExpenseMonth = validMonths.reduce((worst, month) => (!worst || month.expense > worst.expense ? month : worst), null);
  const averageSavings = validMonths.length ? validMonths.reduce((sum, month) => sum + month.savings, 0) / validMonths.length : 0;
  const averageExpense = validMonths.length ? validMonths.reduce((sum, month) => sum + month.expense, 0) / validMonths.length : 0;
  const categoryKeys = Object.keys(safeCategoryTrendSeries[0] || {})
    .filter((k) => !["label", "month"].includes(k))
    .map((key) => ({
      key,
      total: safeCategoryTrendSeries.reduce((sum, row) => sum + Number(row?.[key] || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  const latestCategoryMonth = [...safeCategoryTrendSeries]
    .reverse()
    .find((row) => categoryKeys.some(({ key }) => Number(row[key] || 0) > 0));
  const categorySnapshot = categoryKeys
    .map(({ key, total }) => ({
      name: getCategoryLabel(language, key, key),
      rawName: key,
      value: Number(latestCategoryMonth?.[key] || 0),
      total,
    }))
    .filter((item) => item.value > 0 || item.total > 0)
    .sort((a, b) => (b.value || b.total) - (a.value || a.total));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("analytics.title", "Analytics & Reports")}</h1>
          <p>{t("analytics.subtitle", "Year-over-year comparison, trend analysis, and printable reports.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="icon-btn" onClick={onExportCsv}>{t("analytics.exportCsv", "Export CSV")}</button>
          <button className="btn-primary" onClick={onExportPdf}>{t("analytics.exportPdf", "Export PDF")}</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.incomeYoY", "Income YoY")}</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{safeYoy.incomeDelta}</div>
          <div className="sc-sub">{fmtINR(safeYoy.current.income)} {t("common.vs", "vs")} {fmtINR(safeYoy.previous.income)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.expenseYoY", "Expense YoY")}</div>
          <div className="sc-value" style={{ color: safeYoy.expenseUp ? "var(--expense)" : "var(--income)" }}>{safeYoy.expenseDelta}</div>
          <div className="sc-sub">{fmtINR(safeYoy.current.expense)} {t("common.vs", "vs")} {fmtINR(safeYoy.previous.expense)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.investmentYoY", "Investment YoY")}</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{safeYoy.investDelta}</div>
          <div className="sc-sub">{fmtINR(safeYoy.current.investment)} {t("common.vs", "vs")} {fmtINR(safeYoy.previous.investment)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.savingsYoY", "Savings YoY")}</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{safeYoy.savingsDelta}</div>
          <div className="sc-sub">{fmtINR(safeYoy.current.savings)} {t("common.vs", "vs")} {fmtINR(safeYoy.previous.savings)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.bestSavings", "Best Savings Month")}</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{bestSavingsMonth ? fmtINR(bestSavingsMonth.savings) : "—"}</div>
          <div className="sc-sub">{bestSavingsMonth ? bestSavingsMonth.label : t("analytics.needHistory", "Need more history")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.peakSpend", "Peak Spend Month")}</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{worstExpenseMonth ? fmtINR(worstExpenseMonth.expense) : "—"}</div>
          <div className="sc-sub">{worstExpenseMonth ? worstExpenseMonth.label : t("analytics.needHistory", "Need more history")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.averageSavings", "Average Savings")}</div>
          <div className="sc-value" style={{ color: averageSavings >= 0 ? "var(--accent)" : "var(--expense)" }}>{fmtINR(averageSavings)}</div>
          <div className="sc-sub">{t("analytics.avgSavingsSub", "Typical monthly savings across populated months.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("analytics.averageExpense", "Average Expense")}</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{fmtINR(averageExpense)}</div>
          <div className="sc-sub">{t("analytics.avgExpenseSub", "Useful as a baseline for variance and planning.")}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-span-6">
          <div className="chart-title">{t("analytics.monthlyTrend", "Monthly Trend")}</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={safeMonthlySeries} barGap={8} barCategoryGap="18%">
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} tickMargin={8} axisLine={false} tickLine={false} />
              <YAxis width={64} tickFormatter={fmtAxis} tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconSize={10} />
              <Bar dataKey="income" name={t("dashboard.incomeLabel", "Income")} fill="#34D399" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name={t("dashboard.expensesLabel", "Expense")} fill="#F87171" radius={[6, 6, 0, 0]} />
              <Bar dataKey="investment" name={t("dashboard.investmentsLabel", "Investment")} fill="#818CF8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">{t("analytics.categoryTrend", "Category Spend Snapshot")}</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categorySnapshot} layout="vertical" margin={{ top: 4, right: 20, left: 20, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis type="number" tickFormatter={fmtAxis} tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Bar dataKey="value" name={latestCategoryMonth?.label || t("analytics.latestActiveMonth", "Latest active month")} radius={[0, 6, 6, 0]}>
                {categorySnapshot.map((item, i) => (
                  <Cell key={item.rawName || item.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-12">
          <div className="chart-title">{t("analytics.heatMap", "Spending Heat Map")}</div>
          <div className="heat-grid">
            {!!safeHeatmap.rows.length && (
              <div className="heat-row" style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700 }}>
                <div>{t("analytics.category", "Category")}</div>
                {safeHeatmap.months.map((m) => <div key={m}>{monthLabel(m)}</div>)}
              </div>
            )}
            {safeHeatmap.rows.map((row) => (
              <div key={row.category} className="heat-row">
                <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>{getCategoryLabel(language, row.category, row.category)}</div>
                {(Array.isArray(row.values) ? row.values : []).map((value, i) => (
                  <div
                    key={`${row.category}-${safeHeatmap.months[i]}`}
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
