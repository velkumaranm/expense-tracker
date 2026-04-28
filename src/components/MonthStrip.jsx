export default function MonthStrip({ months, selectedMonth, setSelectedMonth }) {
  return (
    <div className="month-strip">
      <button
        className={`month-chip ${selectedMonth === "all" ? "active" : ""}`}
        onClick={() => setSelectedMonth("all")}
      >
        All Time
      </button>
      {months.map((m) => (
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
