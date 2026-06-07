import { useI18n } from "../lib/i18n";

export default function MonthStrip({ months = [], selectedMonth = "all", setSelectedMonth = () => {} }) {
  const { t } = useI18n();
  const safeMonths = Array.isArray(months) ? months : [];

  return (
    <div className="month-strip">
      <button
        className={`month-chip ${selectedMonth === "all" ? "active" : ""}`}
        onClick={() => setSelectedMonth("all")}
      >
        {t("common.allTime", "All Time")}
      </button>
      {safeMonths.map((m) => (
        <button
          key={m.value}
          className={`month-chip ${selectedMonth === m.value ? "active" : ""}`}
          onClick={() => setSelectedMonth(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
