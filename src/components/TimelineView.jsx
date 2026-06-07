import { addMonths, nextRecurringDate } from "../lib/utils";
import { getCategoryLabel, localizeKnownText, useI18n } from "../lib/i18n";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TimelineView({
  recurringBills = [],
  goals = [],
  vaultDocs = [],
  holdings = [],
  plannerSummary = {},
}) {
  const { t, language } = useI18n();
  recurringBills = Array.isArray(recurringBills) ? recurringBills : [];
  goals = Array.isArray(goals) ? goals : [];
  vaultDocs = Array.isArray(vaultDocs) ? vaultDocs : [];
  holdings = Array.isArray(holdings) ? holdings : [];
  plannerSummary = plannerSummary || {};
  const now = new Date();
  const end = addMonths(now, 5);
  const months = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const events = [];

  recurringBills.forEach((bill) => {
    const next = nextRecurringDate(bill.date, bill.recurringFrequency, now);
    if (!next || next > end) return;
    events.push({
      id: `bill-${bill.id}`,
      date: next,
      title: getCategoryLabel(language, bill.category, bill.category),
      kind: t("timeline.recurringBill", "Recurring bill"),
      detail: `${bill.recurringFrequency || "monthly"} • ${bill.note || t("timeline.cashCommitment", "Cash commitment")}`,
    });
  });

  goals.forEach((goal) => {
    if (!goal.targetDate) return;
    const target = new Date(goal.targetDate);
    if (Number.isNaN(target.getTime()) || target < now || target > end) return;
    events.push({
      id: `goal-${goal.id}`,
      date: target,
      title: goal.name,
      kind: t("timeline.goalMilestone", "Goal milestone"),
      detail: `${localizeKnownText(language, goal.category)} ${t("timeline.targetDate", "target date")}`,
    });
  });

  vaultDocs.forEach((doc) => {
    if (!doc.renewalDate) return;
    const renewal = new Date(doc.renewalDate);
    if (Number.isNaN(renewal.getTime()) || renewal < now || renewal > end) return;
    events.push({
      id: `doc-${doc.id}`,
      date: renewal,
      title: doc.title,
      kind: t("timeline.documentRenewal", "Document renewal"),
      detail: doc.issuer || doc.type,
    });
  });

  if (Number(plannerSummary?.emiAmount || 0) > 0) {
    months.forEach((month, idx) => {
      const date = new Date(month.getFullYear(), month.getMonth(), Math.min(now.getDate(), 28));
      events.push({
        id: `emi-${idx}`,
        date,
        title: t("timeline.emiDue", "EMI due"),
        kind: t("timeline.loanRepayment", "Loan repayment"),
        detail: `${t("timeline.expectedEmiCycle", "Expected EMI cycle")} • ${plannerSummary.emiAmount}`,
      });
    });
  }

  if (holdings.some((item) => Number(item.monthlyContribution || 0) > 0)) {
    months.forEach((month, idx) => {
      const date = new Date(month.getFullYear(), month.getMonth(), 5);
      events.push({
        id: `sip-${idx}`,
        date,
        title: t("timeline.sipWindow", "SIP window"),
        kind: t("timeline.investmentRhythm", "Investment rhythm"),
        detail: t("timeline.reviewMonthly", "Review monthly contributions and rebalance plan."),
      });
    });
  }

  const grouped = months.map((month) => ({
    key: monthKey(month),
    label: month.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    items: events
      .filter((event) => monthKey(event.date) === monthKey(month))
      .sort((a, b) => a.date - b.date),
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("timeline.title", "Calendar & Timeline")}</h1>
          <p>{t("timeline.subtitle", "See recurring bills, goal milestones, vault renewals, and key money dates in one timeline.")}</p>
        </div>
      </div>

      <div className="timeline-grid">
        {grouped.map((month) => (
          <div key={month.key} className="section-card">
            <div className="section-head" style={{ marginBottom: 10 }}>
              <div>
                <h3>{month.label}</h3>
                <p style={{ marginBottom: 0 }}>{month.items.length} {t("timeline.scheduledItems", "scheduled item(s)")}</p>
              </div>
            </div>
            {month.items.length ? (
              <div className="stack">
                {month.items.map((item) => (
                  <div key={item.id} className="timeline-item">
                    <div className="timeline-date">{formatDate(item.date)}</div>
                    <div className="timeline-body">
                      <strong>{item.title}</strong>
                      <div className="muted">{item.kind}</div>
                      <p className="muted" style={{ marginTop: 4 }}>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 18 }}>
                <p>{t("timeline.noDates", "No tracked dates for this month yet.")}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
