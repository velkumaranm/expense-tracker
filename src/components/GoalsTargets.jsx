import { useMemo, useState } from "react";
import { allocationRule, fmtINR, goalId, insuranceCoverageTarget } from "../lib/utils";
import { useI18n } from "../lib/i18n";

const GOAL_TYPES = ["Emergency Fund", "Vacation", "Retirement", "Education", "Home", "Vehicle", "Investment Target", "Insurance Cover"];
const GOAL_TEMPLATES = [
  { name: "Emergency Fund", category: "Emergency Fund", targetAmount: "300000", currentAmount: "", targetDate: "" },
  { name: "Annual Vacation", category: "Vacation", targetAmount: "120000", currentAmount: "", targetDate: "" },
  { name: "Retirement Top-Up", category: "Retirement", targetAmount: "500000", currentAmount: "", targetDate: "" },
  { name: "Home Down Payment", category: "Home", targetAmount: "1500000", currentAmount: "", targetDate: "" },
];

const GOAL_TYPE_KEYS = {
  "Emergency Fund": "goals.goalTypeEmergency",
  Vacation: "goals.goalTypeVacation",
  Retirement: "goals.goalTypeRetirement",
  Education: "goals.goalTypeEducation",
  Home: "goals.goalTypeHome",
  Vehicle: "goals.goalTypeVehicle",
  "Investment Target": "goals.goalTypeInvest",
  "Insurance Cover": "goals.goalTypeInsurance",
};

const GOAL_TEMPLATE_KEYS = {
  "Emergency Fund": "goals.templateEmergency",
  "Annual Vacation": "goals.templateVacation",
  "Retirement Top-Up": "goals.templateRetirement",
  "Home Down Payment": "goals.templateHome",
};

const monthsUntil = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date();
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
  return Math.max(months + 1, 1);
};

export default function GoalsTargets({ goals, setGoals, plannerState, setPlannerState, plannerSummary }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    category: "Emergency Fund",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
  });
  const [contributions, setContributions] = useState({});

  const setPlannerField = (key, value) => {
    setPlannerState((prev) => ({ ...prev, [key]: value }));
  };

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

  const annualExpenseBaseline = Number(plannerState.monthlyHouseholdExpense || 0) * 12;
  const currentInvestable = Number(plannerState.currentInvestableAssets || 0);
  const monthlyGoalContribution = Number(plannerState.monthlyGoalContribution || 0);
  const fireTarget = annualExpenseBaseline > 0 ? annualExpenseBaseline * Number(plannerState.fireMultiple || 25) : 0;
  const annualContribution = monthlyGoalContribution * 12;
  const fireYears = fireTarget > currentInvestable && annualContribution > 0
    ? Math.max((fireTarget - currentInvestable) / annualContribution, 0)
    : fireTarget <= currentInvestable && fireTarget > 0
      ? 0
      : null;
  const insuranceTarget = insuranceCoverageTarget({
    annualIncome: Number(plannerState.annualIncome || 0),
    liabilities: Number(plannerState.totalLiabilities || 0),
    dependents: Number(plannerState.dependents || 0),
    liquidAssets: Number(plannerState.currentEmergencyFund || 0),
    multiplier: Number(plannerState.coverMultiplier || 12),
  });
  const currentInsuranceCover = Number(plannerState.currentInsuranceCover || 0);
  const insuranceGap = Math.max(insuranceTarget - currentInsuranceCover, 0);
  const allocation = allocationRule(plannerState.primaryAllocationMode || "balanced");
  const monthlyIncome = Number(plannerState.annualIncome || 0) > 0 ? Number(plannerState.annualIncome) / 12 : 0;
  const goalTypeLabel = (value) => t(GOAL_TYPE_KEYS[value] || "goals.goalType", value);
  const goalTemplateLabel = (value) => t(GOAL_TEMPLATE_KEYS[value] || "goals.goalName", value);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("goals.title", "Goals & Targets")}</h1>
          <p>{t("goals.subtitle", "Track emergency fund, travel, big purchases, and long-term milestones.")}</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("goals.corpus", "Goal Corpus")}</div>
          <div className="sc-value">{fmtINR(metrics.targetTotal)}</div>
          <div className="sc-sub">{t("goals.totalPlannedSub", "Total amount planned across all active goals.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("goals.funded", "Already Funded")}</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(metrics.fundedTotal)}</div>
          <div className="sc-sub">{metrics.targetTotal ? `${metrics.fundedPct.toFixed(0)}${t("goals.fundedPoolSub", "% of target pool covered.")}` : t("goals.noActiveTargets", "No active targets yet.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("goals.monthlyPace", "Monthly Goal Pace")}</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(metrics.monthlyRequired)}</div>
          <div className="sc-sub">{t("goals.monthlyNeedSub", "Estimated monthly contribution needed to hit dated goals.")}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("goals.onTrack", "On-Track Goals")}</div>
          <div className="sc-value" style={{ color: metrics.onTrack === goals.length && goals.length ? "var(--income)" : "var(--accent)" }}>
            {goals.length ? `${metrics.onTrack}/${goals.length}` : "—"}
          </div>
          <div className="sc-sub">{t("goals.onTrackSub", "Goals with progress that is not obviously behind pace.")}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-span-4">
          <div className="chart-title">{t("goals.emergencyPlanner", "Emergency Fund Planner")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("goals.targetReserve", "Target Reserve")}</div>
              <div className="v">{fmtINR(plannerSummary.emergencyTarget)}</div>
              <div className="muted">{plannerState.emergencyFundMonths} {t("goals.monthsBaseline", "months of baseline expenses.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.currentBuffer", "Current Buffer")}</div>
              <div className="v" style={{ color: "var(--income)" }}>{fmtINR(Number(plannerState.currentEmergencyFund || 0))}</div>
              <div className="muted">{plannerSummary.emergencyCoverageMonths.toFixed(1)} {t("goals.monthsCoveredToday", "months covered today.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.fundingGap", "Funding Gap")}</div>
              <div className="v" style={{ color: plannerSummary.emergencyGap > 0 ? "var(--accent)" : "var(--income)" }}>{fmtINR(plannerSummary.emergencyGap)}</div>
              <div className="muted">{plannerSummary.emergencyGap > 0 ? t("goals.stillToBuild", "Still to be built before the buffer is complete.") : t("goals.alreadyFunded", "Emergency reserve target is already funded.")}</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">{t("goals.retirementPlanner", "Retirement Planner")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("goals.targetCorpus", "Target Corpus")}</div>
              <div className="v">{fmtINR(plannerSummary.retirementTarget)}</div>
              <div className="muted">{t("goals.retirementTargetSub", "Inflation-adjusted 25x annual expense target.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.projectedCorpus", "Projected Corpus")}</div>
              <div className="v" style={{ color: "var(--invest)" }}>{fmtINR(plannerSummary.futureCorpus)}</div>
              <div className="muted">{plannerSummary.yearsToRetirement} {t("goals.yearsToRetirement", "years to retirement at current pace.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.retirementGap", "Retirement Gap")}</div>
              <div className="v" style={{ color: plannerSummary.retirementGap > 0 ? "var(--accent)" : "var(--income)" }}>{fmtINR(plannerSummary.retirementGap)}</div>
              <div className="muted">{plannerSummary.retirementGap > 0 ? t("goals.retirementGapSub", "Extra saving or return is needed to close the gap.") : t("goals.retirementOnTrack", "Current contribution path is enough to hit the target.")}</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">{t("goals.emiPlanner", "EMI Planner")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("goals.suggestedEmi", "Suggested EMI")}</div>
              <div className="v">{fmtINR(plannerSummary.suggestedEmi)}</div>
              <div className="muted">{t("goals.suggestedEmiSub", "Based on principal, interest rate, and remaining tenure.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.currentEmi", "Current EMI")}</div>
              <div className="v" style={{ color: "var(--expense)" }}>{fmtINR(Number(plannerState.emiAmount || 0))}</div>
              <div className="muted">{t("goals.currentEmiSub", "Compare your actual repayment pace with the ideal EMI.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.incomeLoad", "Income Load")}</div>
              <div className="v" style={{ color: plannerSummary.emiStress > 35 ? "var(--expense)" : "var(--accent)" }}>
                {plannerSummary.emiStress ? `${plannerSummary.emiStress.toFixed(1)}%` : "—"}
              </div>
              <div className="muted">{t("goals.incomeLoadSub", "Healthy EMI load is usually below one-third of income.")}</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">{t("goals.fireCalculator", "FIRE Calculator")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("goals.fireNumber", "FIRE Number")}</div>
              <div className="v">{fmtINR(fireTarget)}</div>
              <div className="muted">{plannerState.fireMultiple || 25}{t("goals.annualSpendingTarget", "x annual spending target.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.investableBase", "Investable Base")}</div>
              <div className="v" style={{ color: "var(--invest)" }}>{fmtINR(currentInvestable)}</div>
              <div className="muted">{t("goals.assetsTowardFi", "Assets already working toward financial independence.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.yearsToFi", "Years to FI")}</div>
              <div className="v" style={{ color: fireYears != null && fireYears <= 10 ? "var(--income)" : "var(--accent)" }}>
                {fireYears == null ? t("goals.needInputs", "Need inputs") : `${fireYears.toFixed(1)} y`}
              </div>
              <div className="muted">{t("goals.contributionEstimate", "Simple contribution-based estimate before investment alpha.")}</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">{t("goals.insuranceAdequacy", "Insurance Adequacy")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("goals.suggestedCover", "Suggested Cover")}</div>
              <div className="v">{fmtINR(insuranceTarget)}</div>
              <div className="muted">{plannerState.coverMultiplier || 12}{t("goals.coverTargetSub", "x income, debt, and dependent buffer.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.currentCover", "Current Cover")}</div>
              <div className="v" style={{ color: "var(--income)" }}>{fmtINR(currentInsuranceCover)}</div>
              <div className="muted">{t("goals.coverInForce", "Life or family cover already in force.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.protectionGap", "Protection Gap")}</div>
              <div className="v" style={{ color: insuranceGap > 0 ? "var(--accent)" : "var(--income)" }}>{fmtINR(insuranceGap)}</div>
              <div className="muted">{insuranceGap > 0 ? t("goals.coverLight", "Coverage still looks light for current responsibilities.") : t("goals.coverAdequate", "Protection level looks broadly adequate.")}</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">{t("goals.cashAllocationPlanner", "Cash Allocation Planner")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("goals.essentials", "Essentials")}</div>
              <div className="v">{monthlyIncome ? fmtINR((monthlyIncome * allocation.essentials) / 100) : "—"}</div>
              <div className="muted">{allocation.essentials}{t("goals.essentialsSub", "% for bills, rent, EMI, and family basics.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.lifestyle", "Lifestyle")}</div>
              <div className="v">{monthlyIncome ? fmtINR((monthlyIncome * allocation.lifestyle) / 100) : "—"}</div>
              <div className="muted">{allocation.lifestyle}{t("goals.lifestyleSub", "% for flexible spend and leisure.")}</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("goals.goalsFreedom", "Goals & Freedom")}</div>
              <div className="v">{monthlyIncome ? fmtINR((monthlyIncome * (allocation.goals + allocation.freedom)) / 100) : "—"}</div>
              <div className="muted">{allocation.goals + allocation.freedom}{t("goals.goalsFreedomSub", "% reserved for wealth goals and optionality.")}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div>
              <h3>{t("goals.planningInputs", "Planning Inputs")}</h3>
              <p style={{ marginBottom: 0 }}>{t("goals.planningInputsSub", "These values power emergency fund, retirement, and EMI guidance across Finwise.")}</p>
            </div>
          </div>

          <div className="planner-grid" style={{ marginBottom: 16 }}>
            <div className="fg">
              <label className="fl">{t("goals.monthlyExpenseBaseline", "Monthly Expense Baseline")}</label>
              <input className="fi" type="number" value={plannerState.monthlyHouseholdExpense} onChange={(e) => setPlannerField("monthlyHouseholdExpense", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.emergencyMonths", "Emergency Fund Months")}</label>
              <input className="fi" type="number" value={plannerState.emergencyFundMonths} onChange={(e) => setPlannerField("emergencyFundMonths", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentEmergencyFund", "Current Emergency Fund")}</label>
              <input className="fi" type="number" value={plannerState.currentEmergencyFund} onChange={(e) => setPlannerField("currentEmergencyFund", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentAge", "Current Age")}</label>
              <input className="fi" type="number" value={plannerState.currentAge} onChange={(e) => setPlannerField("currentAge", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.retirementAge", "Retirement Age")}</label>
              <input className="fi" type="number" value={plannerState.retirementAge} onChange={(e) => setPlannerField("retirementAge", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentRetirementCorpus", "Current Retirement Corpus")}</label>
              <input className="fi" type="number" value={plannerState.currentRetirementCorpus} onChange={(e) => setPlannerField("currentRetirementCorpus", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.monthlyRetirementContribution", "Monthly Retirement Contribution")}</label>
              <input className="fi" type="number" value={plannerState.monthlyRetirementContribution} onChange={(e) => setPlannerField("monthlyRetirementContribution", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.expectedReturn", "Expected Return %")}</label>
              <input className="fi" type="number" value={plannerState.expectedReturn} onChange={(e) => setPlannerField("expectedReturn", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.inflation", "Inflation %")}</label>
              <input className="fi" type="number" value={plannerState.inflationRate} onChange={(e) => setPlannerField("inflationRate", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.loanPrincipal", "Loan Principal")}</label>
              <input className="fi" type="number" value={plannerState.loanPrincipal} onChange={(e) => setPlannerField("loanPrincipal", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.loanRate", "Loan Rate %")}</label>
              <input className="fi" type="number" value={plannerState.loanRate} onChange={(e) => setPlannerField("loanRate", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.remainingMonths", "Remaining Months")}</label>
              <input className="fi" type="number" value={plannerState.loanRemainingMonths} onChange={(e) => setPlannerField("loanRemainingMonths", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentEmiLabel", "Current EMI")}</label>
              <input className="fi" type="number" value={plannerState.emiAmount} onChange={(e) => setPlannerField("emiAmount", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.annualIncome", "Annual Income")}</label>
              <input className="fi" type="number" value={plannerState.annualIncome || ""} onChange={(e) => setPlannerField("annualIncome", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentInvestableAssets", "Current Investable Assets")}</label>
              <input className="fi" type="number" value={plannerState.currentInvestableAssets || ""} onChange={(e) => setPlannerField("currentInvestableAssets", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.monthlyGoalContribution", "Monthly Goal Contribution")}</label>
              <input className="fi" type="number" value={plannerState.monthlyGoalContribution || ""} onChange={(e) => setPlannerField("monthlyGoalContribution", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.fireMultiple", "FIRE Multiple")}</label>
              <input className="fi" type="number" value={plannerState.fireMultiple || 25} onChange={(e) => setPlannerField("fireMultiple", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.dependents", "Dependents")}</label>
              <input className="fi" type="number" value={plannerState.dependents || ""} onChange={(e) => setPlannerField("dependents", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentInsuranceCoverLabel", "Current Insurance Cover")}</label>
              <input className="fi" type="number" value={plannerState.currentInsuranceCover || ""} onChange={(e) => setPlannerField("currentInsuranceCover", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.totalLiabilities", "Total Liabilities")}</label>
              <input className="fi" type="number" value={plannerState.totalLiabilities || ""} onChange={(e) => setPlannerField("totalLiabilities", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.coverMultiplier", "Cover Multiplier")}</label>
              <input className="fi" type="number" value={plannerState.coverMultiplier || 12} onChange={(e) => setPlannerField("coverMultiplier", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.allocationMode", "Allocation Mode")}</label>
              <select className="fs" value={plannerState.primaryAllocationMode || "balanced"} onChange={(e) => setPlannerField("primaryAllocationMode", e.target.value)}>
                <option value="balanced">50 / 30 / 20</option>
                <option value="wealth">{t("goals.modeWealth", "Wealth-first")}</option>
                <option value="stability">{t("goals.modeStability", "Stability-first")}</option>
                <option value="retirement">{t("goals.modeRetirement", "Retirement-first")}</option>
                <option value="debt-free">{t("goals.modeDebtFree", "Debt-free mode")}</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="fl" style={{ marginBottom: 8, display: "block" }}>{t("goals.starterTemplates", "Starter Templates")}</label>
            <div className="filter-strip" style={{ marginBottom: 0 }}>
              {GOAL_TEMPLATES.map((template) => (
                <button key={template.name} className="filter-chip" onClick={() => setForm(template)}>
                  {goalTemplateLabel(template.name)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <div className="fg full">
              <label className="fl">{t("goals.goalName", "Goal Name")}</label>
              <input className="fi" placeholder={t("goals.goalTypePlaceholder", "Emergency fund, Europe trip, house down payment...")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.goalType", "Goal Type")}</label>
              <select className="fs" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {GOAL_TYPES.map((x) => <option key={x} value={x}>{goalTypeLabel(x)}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">{t("goals.targetDate", "Target Date")}</label>
              <input className="fi" type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.targetAmount", "Target Amount")}</label>
              <input className="fi" type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">{t("goals.currentProgress", "Current Progress")}</label>
              <input className="fi" type="number" value={form.currentAmount} onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))} />
            </div>
            <div className="fg full">
              <button className="btn-primary" onClick={addGoal}>{t("goals.add", "Add Goal")}</button>
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
            const statusText = status === "Completed" ? t("goals.completed", "Completed") : status === "Needs pace" ? t("goals.needsPace", "Needs pace") : t("goals.inProgress", "In progress");
            const contribution = Number(contributions[goal.id] || 0);
            return (
              <div key={goal.id} className="goal-card goal-card-premium">
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <div>
                    <strong>{goal.name}</strong>
                    <p>{goalTypeLabel(goal.category)}{goal.targetDate ? ` • ${t("goals.targetShort", "target")} ${goal.targetDate}` : ""}</p>
                  </div>
                  <div className="goal-head-actions">
                    <span className={`status-pill ${status === "Completed" ? "verified" : status === "Needs pace" ? "pending" : "neutral"}`}>{statusText}</span>
                    <button className="tx-btn del" onClick={() => removeGoal(goal.id)}>{t("common.delete", "Delete")}</button>
                  </div>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${progress}%`, background: progress >= 75 ? "var(--income)" : "var(--accent)" }} />
                </div>
                <div className="split-row" style={{ fontSize: 11.5, color: "var(--text2)", marginBottom: 12 }}>
                  <span>{fmtINR(goal.currentAmount)} {t("goals.savedShort", "saved")}</span>
                  <span>{progress.toFixed(0)}% of {fmtINR(goal.targetAmount)}</span>
                </div>
                <div className="goal-metrics">
                  <div className="mini-stat">
                    <span>{t("goals.remaining", "Remaining")}</span>
                    <strong>{fmtINR(remaining)}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>{t("goals.monthlyNeed", "Monthly need")}</span>
                    <strong>{monthsLeft ? fmtINR(monthlyNeed) : t("goals.noDate", "No date")}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>{t("goals.timeLeft", "Time left")}</span>
                    <strong>{monthsLeft ? `${monthsLeft} mo` : t("goals.flexible", "Flexible")}</strong>
                  </div>
                </div>
                <div className="setting-row">
                  <input
                    className="setting-input"
                    type="number"
                    placeholder={t("goals.addContribution", "Add contribution")}
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
                    {t("common.add", "Add")}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      updateGoal(goal.id, { currentAmount: contribution });
                      setContributions((prev) => ({ ...prev, [goal.id]: "" }));
                    }}
                    disabled={!contribution}
                  >
                    {t("goals.setExact", "Set Exact")}
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="section-card">
              <h3>{t("goals.noGoals", "No goals yet")}</h3>
              <p>{t("goals.emptyHelp", "Add a financial target and start measuring progress instead of hoping it happens.")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
