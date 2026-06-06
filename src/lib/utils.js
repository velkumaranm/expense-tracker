import {
  ALL_CATS,
  EXPENSE_CATEGORIES,
  MONTH_NAMES,
} from "./constants";

export const toYYYYMM = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export const fmtINR = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const fmtUSD = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n));
};

export const fmtMoney = (n, currency = "INR") =>
  String(currency).toUpperCase() === "USD" ? fmtUSD(n) : fmtINR(n);

export const fmtPct = (n, digits = 1) => {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(digits)}%`;
};

export const convertAmount = (amount, fromCurrency = "INR", toCurrency = "INR", fx = {}) => {
  const value = Number(amount || 0);
  const from = String(fromCurrency || "INR").toUpperCase();
  const to = String(toCurrency || "INR").toUpperCase();
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  const usdInr = Number(fx?.usdInr || 0);
  if (!usdInr) return value;
  if (from === "USD" && to === "INR") return value * usdInr;
  if (from === "INR" && to === "USD") return value / usdInr;
  return value;
};

export const safeJSON = (v, fallback) => {
  try {
    return JSON.parse(v ?? "");
  } catch {
    return fallback;
  }
};

export function normalizeDate(raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const mdy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const cells = [];
    let cur = "";
    let inQ = false;
    for (const c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = lines.slice(1).filter(Boolean).map(parseRow);
  return { headers, rows };
}

export function autoMapColumns(headers) {
  const map = { date: -1, type: -1, category: -1, amount: -1, note: -1 };
  headers.forEach((h, i) => {
    if (["date", "dt", "transactiondate", "txndate"].includes(h)) map.date = i;
    if (["type", "transactiontype", "kind"].includes(h)) map.type = i;
    if (["category", "cat", "subcategory"].includes(h)) map.category = i;
    if (["amount", "amt", "value", "price", "inr"].includes(h)) map.amount = i;
    if (["note", "notes", "description", "desc", "remarks", "memo"].includes(h)) map.note = i;
  });
  return map;
}

export const getMonthRange = (count) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (count - 1 - i));
    return toYYYYMM(d);
  });

export const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`;
};

export const sumByType = (items, type) =>
  items.filter((t) => t.type === type).reduce((acc, t) => acc + Number(t.amount || 0), 0);

export const buildPie = (items, type) => {
  const grouped = {};
  items
    .filter((t) => t.type === type)
    .forEach((t) => {
      grouped[t.category] = (grouped[t.category] || 0) + Number(t.amount || 0);
    });
  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
};

export const getStorageKey = (uid, key) => `finwise-${key}-${uid || "guest"}`;

export const goalId = () => crypto.randomUUID();

export const monthsBetween = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  );
};

export const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

export const nextRecurringDate = (baseDate, frequency = "monthly", afterDate = new Date()) => {
  if (!baseDate) return null;
  const base = new Date(baseDate);
  if (Number.isNaN(base.getTime())) return null;
  const next = new Date(base);
  const step = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  while (next < afterDate) {
    next.setMonth(next.getMonth() + step);
  }
  return next;
};

export const annualizedRecurringAmount = (amount, frequency = "monthly") => {
  const value = Number(amount || 0);
  if (!value) return 0;
  if (frequency === "yearly") return value;
  if (frequency === "quarterly") return value * 4;
  return value * 12;
};

export const xirr = (cashFlows = [], guess = 0.12) => {
  const flows = cashFlows
    .map((flow) => ({
      amount: Number(flow.amount || 0),
      date: new Date(flow.date),
    }))
    .filter((flow) => Number.isFinite(flow.amount) && flow.amount !== 0 && !Number.isNaN(flow.date.getTime()))
    .sort((a, b) => a.date - b.date);

  if (flows.length < 2) return null;
  const hasPositive = flows.some((flow) => flow.amount > 0);
  const hasNegative = flows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const start = flows[0].date;
  const years = (date) => (date - start) / (1000 * 60 * 60 * 24 * 365);
  const npv = (rate) =>
    flows.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, years(flow.date)), 0);
  const derivative = (rate) =>
    flows.reduce((sum, flow) => {
      const exp = years(flow.date);
      return sum - (exp * flow.amount) / Math.pow(1 + rate, exp + 1);
    }, 0);

  let rate = guess;
  for (let i = 0; i < 50; i += 1) {
    const value = npv(rate);
    const slope = derivative(rate);
    if (!Number.isFinite(value) || !Number.isFinite(slope) || Math.abs(slope) < 1e-10) break;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-7) {
      rate = next;
      return rate * 100;
    }
    rate = next;
  }

  return Number.isFinite(rate) ? rate * 100 : null;
};

export const cagr = (startValue, endValue, years) => {
  const start = Number(startValue || 0);
  const end = Number(endValue || 0);
  const span = Number(years || 0);
  if (start <= 0 || end <= 0 || span <= 0) return null;
  return (Math.pow(end / start, 1 / span) - 1) * 100;
};

export const averageHoldingYears = (items = [], fallbackDate = new Date().toISOString().slice(0, 10)) => {
  const source = Array.isArray(items) ? items : [];
  const today = new Date(fallbackDate);
  const weighted = source.reduce(
    (acc, item) => {
      const acquiredOn = item?.acquiredOn || item?.refreshedAt?.slice?.(0, 10) || fallbackDate;
      const date = new Date(acquiredOn);
      const invested = Number(item?.investedValue || Number(item?.units || 0) * Number(item?.costPerUnit || 0));
      if (Number.isNaN(date.getTime()) || invested <= 0) return acc;
      const years = Math.max((today - date) / (1000 * 60 * 60 * 24 * 365), 0.01);
      acc.weightedYears += years * invested;
      acc.total += invested;
      return acc;
    },
    { weightedYears: 0, total: 0 }
  );
  return weighted.total > 0 ? weighted.weightedYears / weighted.total : null;
};

export const allocationRule = (mode = "balanced") => {
  if (mode === "wealth") return { essentials: 45, lifestyle: 20, goals: 20, freedom: 15 };
  if (mode === "stability") return { essentials: 50, lifestyle: 20, goals: 20, freedom: 10 };
  if (mode === "retirement") return { essentials: 45, lifestyle: 15, goals: 30, freedom: 10 };
  if (mode === "debt-free") return { essentials: 50, lifestyle: 15, goals: 25, freedom: 10 };
  return { essentials: 50, lifestyle: 30, goals: 20, freedom: 0 };
};

export const insuranceCoverageTarget = ({
  annualIncome = 0,
  liabilities = 0,
  dependents = 0,
  liquidAssets = 0,
  multiplier = 12,
} = {}) => {
  const incomeBase = Number(annualIncome || 0) * Math.max(Number(multiplier || 0), 0);
  const dependentBuffer = Math.max(Number(dependents || 0), 0) * Number(annualIncome || 0) * 2;
  return Math.max(incomeBase + Number(liabilities || 0) + dependentBuffer - Number(liquidAssets || 0), 0);
};

export const defaultCategoryForType = (type) =>
  type === "income"
    ? "Salary"
    : type === "investment"
      ? "Stocks — NSE/BSE"
      : type === "insurance"
        ? "Term Life Insurance"
        : "Food & Dining";

export const categoriesForType = (type) => ALL_CATS[type] || EXPENSE_CATEGORIES;
