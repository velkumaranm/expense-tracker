import { fmtINR } from "./utils";
import { getCategoryLabel, getTranslation } from "./i18n";

export const buildHeuristicReport = ({
  language = "en",
  income,
  expense,
  investment,
  insurance,
  topCategories,
  momExpenseDelta,
  savingsRate,
  recurringOutflow,
  unusualTransactions,
  netWorth,
}) => {
  const tr = (key, fallback = "") => getTranslation(language, key, fallback);
  const cat = (name) => getCategoryLabel(language, name, name);
  const opportunities = [];
  const tips = [];
  const top1 = topCategories[0];
  const top2 = topCategories[1];

  if (top1) opportunities.push(`${cat(top1.name)} ${tr("ai.localLargestBucket", "is your largest spend bucket at")} ${fmtINR(top1.value)} ${tr("ai.localThisPeriod", "this period.")}`);
  if (top2) opportunities.push(`${cat(top2.name)} ${tr("ai.localSecondBucket", "is the second largest spend driver. A 10% trim would free up about")} ${fmtINR(top2.value * 0.1)}.`);
  if (momExpenseDelta > 12) opportunities.push(`${tr("ai.localMomExpenses", "Month-over-month expenses are up")} ${momExpenseDelta.toFixed(1)}%. ${tr("ai.localReviewInflation", "Review recent lifestyle inflation before it hardens.")}`);
  if (recurringOutflow > 0) opportunities.push(`${tr("ai.localRecurringBills", "Recurring bills currently consume")} ${fmtINR(recurringOutflow)} ${tr("ai.localMonthlyAudit", "monthly. Audit auto-debits and overlapping subscriptions.")}`);
  if (!opportunities.length) opportunities.push(tr("ai.localBalancedSpend", "Your spending mix is fairly balanced. Keep reinforcing the current category discipline."));

  if (savingsRate < 15) tips.push(tr("ai.localTipLowSavings", "Savings rate is below 15%. Start by automating a transfer on salary day before discretionary spending happens."));
  else if (savingsRate < 30) tips.push(tr("ai.localTipHealthySavings", "Savings rate is healthy. Redirect part of annual bonuses and tax refunds into long-term assets."));
  else tips.push(tr("ai.localTipStrongSavings", "Savings rate is strong. Consider layering surplus across emergency cash, retirement, and diversified growth assets."));

  if (income > 0 && investment < income * 0.15) tips.push(tr("ai.localTipInvestmentLight", "Investment contributions are still light relative to income. A SIP target around 15-20% of income would improve compounding."));
  if (insurance > income * 0.1) tips.push(tr("ai.localTipInsurance", "Insurance outflow is meaningful. Revisit overlapping covers and premium efficiency at renewal."));
  if (unusualTransactions.length) tips.push(`${tr("ai.localDetected", "Detected")} ${unusualTransactions.length} ${tr("ai.localUnusualTx", "unusual transaction(s). Check whether they were one-offs or budget leaks.")}`);
  if (netWorth < 0) tips.push(tr("ai.localTipNegativeWorth", "Net worth is negative. Prioritize a cash buffer and high-interest debt reduction before increasing risk exposure."));

  return {
    headline:
      savingsRate >= 25
        ? tr("ai.localHeadlineStrong", "You are building wealth with solid momentum.")
        : savingsRate >= 10
          ? tr("ai.localHeadlineWorkable", "Your cash flow is workable, but there is room to tighten execution.")
          : tr("ai.localHeadlineIntervention", "Your current pattern needs intervention before expenses crowd out progress."),
    summary: [
      `${tr("ai.savingsRate", "Savings rate")}: ${income > 0 ? `${savingsRate.toFixed(1)}%` : "—"}`,
      `${tr("ai.monthlySpend", "Monthly spend")}: ${fmtINR(expense)}`,
      `${tr("ai.investmentContribution", "Investment contribution")}: ${fmtINR(investment)}`,
      `${tr("ai.insuranceOutflow", "Insurance outflow")}: ${fmtINR(insurance)}`,
      `${tr("ai.trackedNetWorth", "Tracked net worth")}: ${fmtINR(netWorth)}`,
    ],
    opportunities,
    anomalies: unusualTransactions.map((t) => `${cat(t.category)} ${tr("ai.localOn", "on")} ${t.date} ${tr("ai.localFor", "for")} ${fmtINR(t.amount)} ${tr("ai.localAboveNormal", "looks materially above its normal range.")}`),
    investmentIdeas: [
      income <= 0
        ? tr("ai.localInvestStabilize", "Stabilize income tracking first, then set an investable surplus target.")
        : investment < income * 0.1
          ? tr("ai.localInvestStartSip", "Start with core index funds or diversified mutual funds and automate a monthly SIP.")
          : investment < income * 0.2
            ? tr("ai.localInvestTaxEfficient", "Layer tax-efficient retirement buckets like PPF, NPS, or EPF top-ups alongside market exposure.")
            : tr("ai.localInvestRefine", "You have room to refine allocation across emergency reserve, tax-efficient retirement, and long-term growth assets."),
    ],
    tips,
  };
};

export async function getAIBackendHealth(token = "") {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const res = await fetch("/api/ai/health", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not load AI backend status");
  return data;
}

export async function requestAIInsights(payload) {
  const res = await fetch("/api/ai/insights", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "AI request failed");
  return data;
}

export async function requestAIQuery(payload) {
  const res = await fetch("/api/ai/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "AI query failed");
  return data;
}

export function answerLocalFinanceQuestion(question, context, report) {
  const language = context.language || "en";
  const tr = (key, fallback = "") => getTranslation(language, key, fallback);
  const cat = (name) => getCategoryLabel(language, name, name);
  const q = question.toLowerCase();
  const top = context.topCategories?.[0];
  const savingsRate = context.totals?.savingsRate || 0;
  const monthlyExpense = context.totals?.expense || 0;
  const investment = context.totals?.investment || 0;
  const insurance = context.totals?.insurance || 0;
  const netWorth = context.netWorth || 0;
  const portfolio = context.portfolio || {};

  if (q.includes("save") || q.includes("cut") || q.includes("reduce")) {
    return [
      top
        ? `${cat(top.name)} ${tr("ai.answerInspectTop", "is the first place to inspect because it is your largest expense bucket at")} ${fmtINR(top.value)}.`
        : tr("ai.answerTopGeneric", "Your biggest savings opportunity will usually come from the top expense category."),
      report.opportunities[1] || tr("ai.answerTrimRecurring", "Trim recurring discretionary spend before touching long-term investments."),
      savingsRate < 15
        ? tr("ai.answerSavingsSoft", "Your savings rate is still soft, so protect savings first and then optimize smaller categories.")
        : tr("ai.answerSavingsDecent", "Your savings rate is already decent, so focus on waste and low-value recurring spend rather than cutting aggressively everywhere."),
    ].join(" ");
  }

  if (q.includes("invest")) {
    return [
      `${tr("ai.answerInvestingNow", "You are currently investing")} ${fmtINR(investment)} ${tr("ai.answerSelectedPeriod", "in the selected period.")}`,
      portfolio.holdingsCount
        ? `${tr("ai.answerPortfolioWorth", "Tracked market holdings are worth")} ${fmtINR(portfolio.currentValue || 0)} ${tr("ai.answerVersusInvested", "versus an invested basis of")} ${fmtINR(portfolio.investedValue || 0)}.`
        : tr("ai.answerNoHoldings", "No live market holdings are being tracked yet, so this answer is based on cash-flow contributions only."),
      report.investmentIdeas[0],
      savingsRate < 10
        ? tr("ai.answerImproveStability", "Improve cash-flow stability before taking materially more portfolio risk.")
        : tr("ai.answerEmergencyIntact", "If your emergency buffer is intact, increasing automated investing is the cleanest next lever."),
    ].join(" ");
  }

  if (q.includes("insurance")) {
    return [
      `${tr("ai.answerInsuranceOutflow", "Insurance outflow in the selected view is")} ${fmtINR(insurance)}.`,
      insurance > 0
        ? tr("ai.answerInsuranceReview", "Review whether each policy is still necessary, competitively priced, and sized to the real risk it is covering.")
        : tr("ai.answerInsuranceGap", "You do not have much visible insurance spend in the current data, so check whether important protection gaps exist."),
    ].join(" ");
  }

  if (q.includes("net worth") || q.includes("wealth")) {
    return `${tr("ai.answerNetWorth", "Your tracked net worth is")} ${fmtINR(netWorth)}. ${tr("ai.answerNetWorthBasis", "This is built from tracked cash reserve, logged investments, manual assets, and liabilities, so the answer improves as those sections stay updated.")}`;
  }

  if (q.includes("spend") || q.includes("expense")) {
    return [
      `${tr("ai.answerCurrentExpense", "Current selected-period expense is")} ${fmtINR(monthlyExpense)}.`,
      top ? `${cat(top.name)} ${tr("ai.answerLargestSpendArea", "is your largest spend area.")}` : tr("ai.answerNoDominantSpend", "You do not have a dominant spend bucket yet."),
      context.unusualTransactions?.length
        ? `${tr("ai.answerUnusualTx", "Unusual transactions worth reviewing")}: ${context.unusualTransactions.length}.`
        : tr("ai.answerNoUnusual", "No unusual transactions are standing out right now."),
    ].join(" ");
  }

  return [
    report.headline,
    report.opportunities[0],
    report.tips[0],
    tr("ai.answerSharper", "For a sharper answer, ask about spending cuts, investing, insurance, savings rate, or net worth."),
  ].join(" ");
}
