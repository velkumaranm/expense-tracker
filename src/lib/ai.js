import { fmtINR } from "./utils";

export const buildHeuristicReport = ({
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
  const opportunities = [];
  const tips = [];
  const top1 = topCategories[0];
  const top2 = topCategories[1];

  if (top1) opportunities.push(`${top1.name} is your largest spend bucket at ${fmtINR(top1.value)} this period.`);
  if (top2) opportunities.push(`${top2.name} is the second largest spend driver. A 10% trim would free up about ${fmtINR(top2.value * 0.1)}.`);
  if (momExpenseDelta > 12) opportunities.push(`Month-over-month expenses are up ${momExpenseDelta.toFixed(1)}%. Review recent lifestyle inflation before it hardens.`);
  if (recurringOutflow > 0) opportunities.push(`Recurring bills currently consume ${fmtINR(recurringOutflow)} monthly. Audit auto-debits and overlapping subscriptions.`);
  if (!opportunities.length) opportunities.push("Your spending mix is fairly balanced. Keep reinforcing the current category discipline.");

  if (savingsRate < 15) tips.push("Savings rate is below 15%. Start by automating a transfer on salary day before discretionary spending happens.");
  else if (savingsRate < 30) tips.push("Savings rate is healthy. Redirect part of annual bonuses and tax refunds into long-term assets.");
  else tips.push("Savings rate is strong. Consider layering surplus across emergency cash, retirement, and diversified growth assets.");

  if (income > 0 && investment < income * 0.15) tips.push("Investment contributions are still light relative to income. A SIP target around 15-20% of income would improve compounding.");
  if (insurance > income * 0.1) tips.push("Insurance outflow is meaningful. Revisit overlapping covers and premium efficiency at renewal.");
  if (unusualTransactions.length) tips.push(`Detected ${unusualTransactions.length} unusual transaction${unusualTransactions.length > 1 ? "s" : ""}. Check whether they were one-offs or budget leaks.`);
  if (netWorth < 0) tips.push("Net worth is negative. Prioritize a cash buffer and high-interest debt reduction before increasing risk exposure.");

  return {
    headline:
      savingsRate >= 25
        ? "You are building wealth with solid momentum."
        : savingsRate >= 10
          ? "Your cash flow is workable, but there is room to tighten execution."
          : "Your current pattern needs intervention before expenses crowd out progress.",
    summary: [
      `Savings rate: ${income > 0 ? `${savingsRate.toFixed(1)}%` : "—"}`,
      `Monthly spend: ${fmtINR(expense)}`,
      `Investment contribution: ${fmtINR(investment)}`,
      `Insurance outflow: ${fmtINR(insurance)}`,
      `Tracked net worth: ${fmtINR(netWorth)}`,
    ],
    opportunities,
    anomalies: unusualTransactions.map((t) => `${t.category} on ${t.date} for ${fmtINR(t.amount)} looks materially above its normal range.`),
    investmentIdeas: [
      income <= 0
        ? "Stabilize income tracking first, then set an investable surplus target."
        : investment < income * 0.1
          ? "Start with core index funds or diversified mutual funds and automate a monthly SIP."
          : investment < income * 0.2
            ? "Layer tax-efficient retirement buckets like PPF, NPS, or EPF top-ups alongside market exposure."
            : "You have room to refine allocation across emergency reserve, tax-efficient retirement, and long-term growth assets.",
    ],
    tips,
  };
};

export async function getAIBackendHealth() {
  const res = await fetch("/api/ai/health");
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
