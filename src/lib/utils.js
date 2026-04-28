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
  const dmy = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
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

export const defaultCategoryForType = (type) =>
  type === "income"
    ? "Salary"
    : type === "investment"
      ? "Stocks — NSE/BSE"
      : type === "insurance"
        ? "Term Life Insurance"
        : "Food & Dining";

export const categoriesForType = (type) => ALL_CATS[type] || EXPENSE_CATEGORIES;
