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
import { useI18n } from "../lib/i18n";
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
  goals,
  totalTransactions,
  assetCount,
  liabilityCount,
  onJumpToAdd,
  onJumpToImport,
  onJumpToGoals,
  onJumpToNetWorth,
}) {
  const { t } = useI18n();
  const balanceTone = totals.balance >= 0 ? "var(--income)" : "var(--expense)";
  const savingsColor = totals.savingsRate >= 20 ? "var(--income)" : totals.savingsRate >= 10 ? "var(--accent)" : "var(--expense)";
  const runwayMonths = totals.expense > 0 ? netWorth / totals.expense : 0;
  const investRate = totals.income > 0 ? (totals.investment / totals.income) * 100 : 0;
  const goalFundingGap = goals.reduce((sum, goal) => sum + Math.max(Number(goal.targetAmount || 0) - Number(goal.currentAmount || 0), 0), 0);
  const setupScore = [
    totalTransactions > 0,
    goals.length > 0,
    assetCount + liabilityCount > 0,
  ].filter(Boolean).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("dashboard.title", "Dashboard")}</h1>
          <p>{selectedMonth === "all" ? t("dashboard.subtitle", "Full financial system view") : `Monthly command center — ${selectedMonth}`}</p>
        </div>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      {setupScore < 3 && (
        <div className="section-card" style={{ marginBottom: 14 }}>
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div>
              <h3>{t("dashboard.setupTitle", "Get Finwise Fully Set Up")}</h3>
              <p style={{ marginBottom: 0 }}>
                A few pieces of data will make the dashboards, AI, goals, and net worth views much more useful.
              </p>
            </div>
            <span className="status-pill neutral">{setupScore}/3 complete</span>
          </div>
          <div className="onboarding-grid">
            <div className="insight-item">
              <strong>{totalTransactions > 0 ? "Transactions connected" : "Add your first transactions"}</strong>
              <p>{totalTransactions > 0 ? `${totalTransactions} transaction${totalTransactions !== 1 ? "s" : ""} are already shaping your analytics.` : "Income, expenses, investments, and insurance make every other page smarter."}</p>
              {!totalTransactions && <button className="btn-secondary" style={{ marginTop: 10 }} onClick={onJumpToAdd}>{t("dashboard.setupCtaAdd", "Add Transaction")}</button>}
            </div>
            <div className="insight-item">
              <strong>{goals.length > 0 ? "Goals in motion" : "Create at least one goal"}</strong>
              <p>{goals.length > 0 ? `${goals.length} goal${goals.length !== 1 ? "s are" : " is"} being tracked for progress and funding pace.` : "Goals turn your cash flow into a plan, not just a record of what already happened."}</p>
              {!goals.length && <button className="btn-secondary" style={{ marginTop: 10 }} onClick={onJumpToGoals}>{t("dashboard.setupCtaGoal", "Set a Goal")}</button>}
            </div>
            <div className="insight-item">
              <strong>{assetCount + liabilityCount > 0 ? "Balance sheet started" : "Complete your net worth"}</strong>
              <p>{assetCount + liabilityCount > 0 ? `${assetCount} asset${assetCount !== 1 ? "s" : ""} and ${liabilityCount} liabilit${liabilityCount === 1 ? "y" : "ies"} are already included.` : "Adding assets and liabilities makes runway, debt, and wealth diagnostics more realistic."}</p>
              {!(assetCount + liabilityCount > 0) && <button className="btn-secondary" style={{ marginTop: 10 }} onClick={onJumpToNetWorth}>{t("dashboard.setupCtaAsset", "Add Assets")}</button>}
            </div>
          </div>
          {!totalTransactions && (
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={onJumpToImport}>
              {t("dashboard.setupCtaImport", "Import Existing Data")}
            </button>
          )}
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("dashboard.netCash", "Net Cash Position")}</div>
          <div className="sc-value" style={{ color: balanceTone }}>
            {totals.balance >= 0 ? fmtINR(totals.balance) : `-${fmtINR(Math.abs(totals.balance))}`}
          </div>
          <div className="sc-sub">{t("dashboard.netCashSub", "Income minus expenses, investments, and insurance in the selected period.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.savingsRateLabel", "Savings Rate")}</div>
          <div className="sc-value" style={{ color: savingsColor }}>{totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}</div>
          <div className="sc-sub">{t("dashboard.savingsRateSub", "Savings after expense only, before investing decisions.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.trackedWorth", "Tracked Net Worth")}</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">{t("dashboard.trackedWorthSub", "Cash reserve + investments + manual assets - liabilities.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.incomeLabel", "Income")}</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(totals.income)}</div>
          <div className="sc-sub">{t("dashboard.incomeSub", "Total inflow recorded.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.expensesLabel", "Expenses")}</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{fmtINR(totals.expense)}</div>
          <div className="sc-sub">{t("dashboard.expensesSub", "Core lifestyle and operational outflow.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.investmentsLabel", "Investments")}</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(totals.investment)}</div>
          <div className="sc-sub">{t("dashboard.investmentsSub", "Capital deployed toward future growth.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.insuranceLabel", "Insurance")}</div>
          <div className="sc-value" style={{ color: "var(--insure)" }}>{fmtINR(totals.insurance)}</div>
          <div className="sc-sub">{t("dashboard.insuranceSub", "Protection outflow and risk cover spend.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.runwayLabel", "Runway")}</div>
          <div className="sc-value" style={{ color: runwayMonths >= 6 ? "var(--income)" : "var(--accent)" }}>{totals.expense > 0 ? `${runwayMonths.toFixed(1)} mo` : "—"}</div>
          <div className="sc-sub">{t("dashboard.runwaySub", "How many months current net worth could cover the selected-period expense level.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("dashboard.investmentRateLabel", "Investment Rate")}</div>
          <div className="sc-value" style={{ color: investRate >= 15 ? "var(--invest)" : "var(--accent)" }}>{totals.income > 0 ? `${investRate.toFixed(1)}%` : "—"}</div>
          <div className="sc-sub">{t("dashboard.investmentRateSub", "Share of income currently routed into investing.")}</div>
        </div>
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("dashboard.goalGapLabel", "Goal Funding Gap")}</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(goalFundingGap)}</div>
          <div className="sc-sub">{t("dashboard.goalGapSub", "Amount still needed to fully fund all active goals and targets.")}</div>
        </div>
      </div>

      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="sc-label" style={{ marginBottom: 0 }}>{t("dashboard.expenseBudget", "Expense Budget")}</span>
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
          <div className="chart-title">{t("dashboard.cashFlow12", "12-Month Cash Flow")}</div>
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
          <div className="chart-title">{t("dashboard.expenseMix", "Expense Mix")}</div>
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
          <div className="chart-title">{t("dashboard.attentionCenter", "Attention Center")}</div>
          <div className="insight-list">
            {alerts.length ? alerts.map((alert, idx) => (
              <div key={idx} className={`alert-item ${alert.tone || "info"}`}>
                <strong>{alert.title}</strong>
                <p>{alert.body}</p>
              </div>
            )) : (
              <div className="alert-item good">
                <strong>{t("dashboard.steadyTitle", "Everything looks steady")}</strong>
                <p>{t("dashboard.steadyBody", "No immediate budget, anomaly, or liquidity warnings from the current data.")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">{t("dashboard.quickDiagnostics", "Quick Diagnostics")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("dashboard.topExpense", "Top Expense")}</div>
              <div className="v">{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
              <div className="muted">{topCategories[0]?.name || t("dashboard.noSpend", "No spend yet")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("dashboard.recurringOutflow", "Recurring Outflow")}</div>
              <div className="v" style={{ color: "var(--accent)" }}>{fmtINR(recurringOutflow)}</div>
              <div className="muted">{t("dashboard.recurringBody", "Bills, EMIs, and subscriptions flagged recurring.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("dashboard.unusualSpend", "Unusual Spend")}</div>
              <div className="v" style={{ color: unusualTransactions.length ? "var(--expense)" : "var(--income)" }}>{unusualTransactions.length}</div>
              <div className="muted">{unusualTransactions.length ? t("dashboard.needsReview", "Needs review") : t("dashboard.nothingFlagged", "Nothing flagged")}</div>
            </div>
          </div>
          {(invPieData.length > 0 || insPieData.length > 0) && (
            <div className="two-col" style={{ marginTop: 14 }}>
              {invPieData.length > 0 && (
                <div className="section-card" style={{ marginBottom: 0 }}>
                  <div className="chart-title" style={{ color: "var(--invest)" }}>{t("dashboard.investAlloc", "Investment Allocation")}</div>
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
                  <div className="chart-title" style={{ color: "var(--insure)" }}>{t("dashboard.insuranceLoad", "Insurance Load")}</div>
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
