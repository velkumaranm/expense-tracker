import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber,
} from "firebase/auth";
import {
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc,
} from "firebase/firestore";
import {
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Timezone-safe helpers (fixes IST UTC+5:30 month shift) ───────────────────
const toYYYYMM = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── Category lists ────────────────────────────────────────────────────────────
const INCOME_CATEGORIES = [
  "Salary","Freelance","Business","Rental Income","Dividend",
  "Interest","Bonus","Pension","Capital Gain","Gift","Other Income",
];
const EXPENSE_CATEGORIES = [
  "Food & Dining","Transport","Shopping","Utilities & Bills",
  "Healthcare","Entertainment","EMI / Loan","Education",
  "Personal Care","Subscriptions","Home & Rent","Groceries",
  "Fuel","Clothing","Travel","Eating Out","Other Expense",
];
const INVESTMENT_CATEGORIES = [
  "Stocks — NSE/BSE","Mutual Fund — Equity","Mutual Fund — Debt",
  "Mutual Fund — Hybrid","Index Fund / ETF","PPF","EPF / PF",
  "NPS","Fixed Deposit","Recurring Deposit","Bonds / Debentures",
  "Sovereign Gold Bond","Gold / Silver Physical","REIT / InvIT",
  "Real Estate","Cryptocurrency","ULIP","Other Investment",
];
const INSURANCE_CATEGORIES = [
  "Term Life Insurance","LIC Endowment","LIC Money Back","LIC Jeevan Anand",
  "ULIP Insurance","Whole Life Insurance","Health Insurance — Individual",
  "Health Insurance — Family","Critical Illness Cover","Personal Accident",
  "Car Insurance","Two-Wheeler Insurance","Home / Property Insurance",
  "Travel Insurance","PLI (Postal Life Insurance)","Rural PLI",
  "PMJJBY","PMSBY","Marine Insurance","Fire Insurance","Other Insurance",
];
const ALL_CATS = {
  income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES,
  investment: INVESTMENT_CATEGORIES, insurance: INSURANCE_CATEGORIES,
};
const VALID_TYPES = ["income","expense","investment","insurance"];

const CATEGORY_ICONS = {
  "Salary":"💼","Freelance":"💻","Business":"📊","Rental Income":"🏘️",
  "Dividend":"💹","Interest":"🏦","Bonus":"🎯","Pension":"👴",
  "Capital Gain":"📈","Gift":"🎁","Other Income":"✨",
  "Food & Dining":"🍽️","Transport":"🚌","Shopping":"🛍️","Utilities & Bills":"📄",
  "Healthcare":"💊","Entertainment":"🎬","EMI / Loan":"🏠","Education":"📚",
  "Personal Care":"💆","Subscriptions":"📱","Home & Rent":"🏡","Groceries":"🛒",
  "Fuel":"⛽","Clothing":"👗","Travel":"✈️","Eating Out":"🍜","Other Expense":"📦",
  "Stocks — NSE/BSE":"📉","Mutual Fund — Equity":"📈","Mutual Fund — Debt":"📊",
  "Mutual Fund — Hybrid":"⚖️","Index Fund / ETF":"🗂️","PPF":"🏛️","EPF / PF":"🏢",
  "NPS":"🪙","Fixed Deposit":"🔒","Recurring Deposit":"🔄","Bonds / Debentures":"📋",
  "Sovereign Gold Bond":"🥇","Gold / Silver Physical":"🏅","REIT / InvIT":"🏗️",
  "Real Estate":"🏠","Cryptocurrency":"₿","ULIP":"💎","Other Investment":"🧩",
  "Term Life Insurance":"🛡️","LIC Endowment":"🏛️","LIC Money Back":"💰",
  "LIC Jeevan Anand":"🌟","ULIP Insurance":"💎","Whole Life Insurance":"♾️",
  "Health Insurance — Individual":"👤","Health Insurance — Family":"👨‍👩‍👧",
  "Critical Illness Cover":"🏥","Personal Accident":"🩹","Car Insurance":"🚗",
  "Two-Wheeler Insurance":"🏍️","Home / Property Insurance":"🏡",
  "Travel Insurance":"🌍","PLI (Postal Life Insurance)":"📮","Rural PLI":"🌾",
  "PMJJBY":"📜","PMSBY":"🛟","Marine Insurance":"⚓","Fire Insurance":"🔥","Other Insurance":"📑",
};

const TYPE_META = {
  income:     { color:"var(--income)",  dim:"var(--income-dim)",  label:"Income",     icon:"📥", sign:"+" },
  expense:    { color:"var(--expense)", dim:"var(--expense-dim)", label:"Expense",    icon:"📤", sign:"-" },
  investment: { color:"var(--invest)",  dim:"var(--invest-dim)",  label:"Investment", icon:"📊", sign:"→" },
  insurance:  { color:"var(--insure)",  dim:"var(--insure-dim)",  label:"Insurance",  icon:"🛡️", sign:"→" },
};

const PIE_COLORS  = ["#C8A96E","#E8C870","#A07850","#D4B896","#F0DEB4","#8A6840","#C4A87E","#B89060"];
const INV_COLORS  = ["#818CF8","#A78BFA","#C084FC","#E879F9","#F472B6","#FB7185","#7DD3FC","#6EE7B7","#FCD34D","#A3E635"];
const INS_COLORS  = ["#FB923C","#F97316","#FDBA74","#FED7AA","#FCA5A5","#FCD34D","#86EFAC","#93C5FD","#C4B5FD","#F9A8D4"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Market data constants ─────────────────────────────────────────────────────
const TRENDING_NSE = [
  { symbol:"RELIANCE.NS",   name:"Reliance Industries", sector:"Energy" },
  { symbol:"TCS.NS",        name:"TCS",                 sector:"IT" },
  { symbol:"HDFCBANK.NS",   name:"HDFC Bank",           sector:"Banking" },
  { symbol:"INFY.NS",       name:"Infosys",             sector:"IT" },
  { symbol:"ICICIBANK.NS",  name:"ICICI Bank",          sector:"Banking" },
  { symbol:"SBIN.NS",       name:"SBI",                 sector:"Banking" },
  { symbol:"BHARTIARTL.NS", name:"Bharti Airtel",       sector:"Telecom" },
  { symbol:"ITC.NS",        name:"ITC",                 sector:"FMCG" },
  { symbol:"LT.NS",         name:"L&T",                 sector:"Infra" },
  { symbol:"KOTAKBANK.NS",  name:"Kotak Bank",          sector:"Banking" },
  { symbol:"WIPRO.NS",      name:"Wipro",               sector:"IT" },
  { symbol:"AXISBANK.NS",   name:"Axis Bank",           sector:"Banking" },
];
const TRENDING_BSE = [
  { symbol:"TATAMOTORS.BO", name:"Tata Motors",    sector:"Auto" },
  { symbol:"BAJFINANCE.BO", name:"Bajaj Finance",  sector:"Finance" },
  { symbol:"MARUTI.BO",     name:"Maruti Suzuki",  sector:"Auto" },
  { symbol:"SUNPHARMA.BO",  name:"Sun Pharma",     sector:"Pharma" },
  { symbol:"POWERGRID.BO",  name:"Power Grid",     sector:"Utilities" },
  { symbol:"NTPC.BO",       name:"NTPC",           sector:"Utilities" },
  { symbol:"HCLTECH.BO",    name:"HCL Tech",       sector:"IT" },
  { symbol:"ULTRACEMCO.BO", name:"UltraTech",      sector:"Cement" },
];
const TRENDING_US = [
  { symbol:"AAPL",  name:"Apple",     sector:"Tech" },
  { symbol:"MSFT",  name:"Microsoft", sector:"Tech" },
  { symbol:"GOOGL", name:"Alphabet",  sector:"Tech" },
  { symbol:"AMZN",  name:"Amazon",    sector:"E-com" },
  { symbol:"NVDA",  name:"Nvidia",    sector:"Chips" },
  { symbol:"META",  name:"Meta",      sector:"Social" },
  { symbol:"TSLA",  name:"Tesla",     sector:"EV" },
  { symbol:"BRK-B", name:"Berkshire", sector:"Finance" },
];
const INDICES = [
  { symbol:"^NSEI",  name:"Nifty 50",  unit:"pts" },
  { symbol:"^BSESN", name:"Sensex",    unit:"pts" },
  { symbol:"^DJI",   name:"Dow Jones", unit:"pts" },
  { symbol:"^GSPC",  name:"S&P 500",   unit:"pts" },
  { symbol:"^IXIC",  name:"Nasdaq",    unit:"pts" },
];
const COMMODITY_SYMBOLS = [
  { symbol:"GC=F",     name:"Gold",      unit:"USD/oz" },
  { symbol:"SI=F",     name:"Silver",    unit:"USD/oz" },
  { symbol:"CL=F",     name:"Crude Oil", unit:"USD/bbl" },
  { symbol:"USDINR=X", name:"USD/INR",   unit:"₹" },
  { symbol:"EURINR=X", name:"EUR/INR",   unit:"₹" },
];
const CRYPTO_IDS = [
  { id:"bitcoin",       name:"Bitcoin",  symbol:"BTC" },
  { id:"ethereum",      name:"Ethereum", symbol:"ETH" },
  { id:"binancecoin",   name:"BNB",      symbol:"BNB" },
  { id:"ripple",        name:"XRP",      symbol:"XRP" },
  { id:"solana",        name:"Solana",   symbol:"SOL" },
  { id:"matic-network", name:"Polygon",  symbol:"MATIC" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e7)  return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5)  return "₹" + (n / 1e5).toFixed(2) + " L";
  if (n >= 1000) return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return "₹" + n.toFixed(2);
};

// ── Market fetch helpers (defined ONCE here, used by Markets component) ───────
const PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchWithFallback(targetUrl, timeoutMs = 10000) {
  for (const proxyFn of PROXIES) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(proxyFn(targetUrl), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      return JSON.parse(await res.text());
    } catch { clearTimeout(t); }
  }
  throw new Error("All proxies failed");
}

async function fetchDirect(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return await res.json();
  } catch (e) { clearTimeout(t); throw e; }
}

async function fetchYahooQuotes(symbols) {
  for (const ep of ["v8", "v7"]) {
    try {
      const url = `https://query1.finance.yahoo.com/${ep}/finance/quote?symbols=${symbols}`;
      const data = await fetchWithFallback(url, 11000);
      const res = data?.quoteResponse?.result;
      if (res?.length) return res;
    } catch {}
  }
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${symbols}`;
    const data = await fetchWithFallback(url, 11000);
    return data?.quoteResponse?.result || [];
  } catch { return null; }
}

// ── CSV import helpers ────────────────────────────────────────────────────────
function normalizeDate(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
  return null;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const cells = []; let cur = ""; let inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; }
      else if (c === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else { cur += c; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = lines.slice(1).filter(l => l.trim()).map(l => parseRow(l));
  return { headers, rows };
}

function autoMapColumns(headers) {
  const map = { date:-1, type:-1, category:-1, amount:-1, note:-1 };
  headers.forEach((h, i) => {
    if (["date","dt","transactiondate","txdate","txndate"].includes(h)) map.date = i;
    else if (["type","txtype","transactiontype","kind"].includes(h)) map.type = i;
    else if (["category","cat","subcategory"].includes(h)) map.category = i;
    else if (["amount","amt","value","price","inr","rs","rupees"].includes(h)) map.amount = i;
    else if (["note","notes","description","desc","remarks","memo"].includes(h)) map.note = i;
  });
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}

:root{
  --bg:#09090B;--surface:#0F0F13;--card:#17171D;--card2:#1C1C24;--card-hover:#1E1E26;
  --border:#24242E;--border-l:#32323E;
  --accent:#C8A96E;--accent-dim:rgba(200,169,110,.12);--accent-h:#D4BC8A;
  --income:#34D399;--income-dim:rgba(52,211,153,.1);
  --expense:#F87171;--expense-dim:rgba(248,113,113,.1);
  --invest:#818CF8;--invest-dim:rgba(129,140,248,.12);
  --insure:#FB923C;--insure-dim:rgba(251,146,60,.12);
  --text:#EEEAE4;--text2:#9A9590;--text3:#52524E;
  --shadow:0 2px 12px rgba(0,0,0,.5);
  --r:16px;--rx:7px;
}
body.light{
  --bg:#F4F1EC;--surface:#FDFBF7;--card:#FFFFFF;--card2:#F9F6F0;--card-hover:#F0EDE6;
  --border:#E2DDD5;--border-l:#CCC7BE;
  --accent:#A07840;--accent-dim:rgba(160,120,64,.1);--accent-h:#8B6530;
  --income:#059669;--income-dim:rgba(5,150,105,.1);
  --expense:#DC2626;--expense-dim:rgba(220,38,38,.1);
  --invest:#4F46E5;--invest-dim:rgba(79,70,229,.1);
  --insure:#C2410C;--insure-dim:rgba(194,65,12,.1);
  --text:#1C1A17;--text2:#6B6560;--text3:#A09890;
  --shadow:0 2px 12px rgba(0,0,0,.08);
}

html,body{height:100%;}
body{background:var(--bg);color:var(--text);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;transition:background .25s,color .25s;}
#root{height:100%;}
input,select,button,textarea{font-family:'Outfit',sans-serif;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}

@keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
@keyframes slideUp{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}
@keyframes toastIn{from{opacity:0;transform:translateX(110%);}to{opacity:1;transform:translateX(0);}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse2{0%,100%{opacity:1;}50%{opacity:.4;}}

.app-shell{display:flex;height:100vh;overflow:hidden;}

/* ── Sidebar ── */
.sidebar{width:224px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0;gap:1px;overflow:hidden;transition:background .25s,border-color .25s;}
.sidebar-logo{padding:0 20px 18px;border-bottom:1px solid var(--border);margin-bottom:6px;}
.wordmark{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:700;color:var(--accent);}
.tagline{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1.4px;margin-top:3px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 13px;margin:0 7px;border-radius:var(--rx);cursor:pointer;color:var(--text2);font-size:12.5px;font-weight:500;transition:all .18s;border:1px solid transparent;}
.nav-item:hover{color:var(--text);background:var(--card);}
.nav-item.active{color:var(--accent);background:var(--accent-dim);border-color:rgba(200,169,110,.2);}
.nav-item .ni{font-size:15px;width:20px;text-align:center;}
.sidebar-spacer{flex:1;}
.sidebar-footer{padding:14px 8px 0;border-top:1px solid var(--border);}
.user-row{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:5px;}
.user-avatar{width:30px;height:30px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent);flex-shrink:0;}
.user-email{font-size:10.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.logout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:1px solid var(--border);border-radius:var(--rx);color:var(--text2);font-size:11.5px;font-weight:500;cursor:pointer;transition:all .18s;}
.logout-btn:hover{color:var(--expense);border-color:rgba(248,113,113,.4);background:var(--expense-dim);}

/* Theme toggle */
.theme-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin:0 8px 6px;border-radius:var(--rx);border:1px solid var(--border);cursor:pointer;transition:all .18s;}
.theme-row:hover{background:var(--card);}
.theme-label{font-size:11px;font-weight:500;color:var(--text2);}
.tt-track{width:32px;height:17px;border-radius:99px;background:var(--border-l);position:relative;transition:background .2s;flex-shrink:0;}
.tt-track.on{background:var(--accent);}
.tt-thumb{width:13px;height:13px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s;}
.tt-track.on .tt-thumb{left:17px;}

/* ── Main ── */
.main{flex:1;overflow-y:auto;background:var(--bg);transition:background .25s;}
.content{padding:28px 30px;max-width:960px;margin:0 auto;animation:fadeIn .3s ease;}

/* Page header */
.page-header{margin-bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;}
.page-header h1{font-family:'Cormorant Garamond',serif;font-size:29px;font-weight:700;}
.page-header p{font-size:12px;color:var(--text3);margin-top:2px;}

/* Month strip */
.month-strip{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;margin-bottom:20px;scrollbar-width:none;}
.month-strip::-webkit-scrollbar{display:none;}
.month-chip{padding:5px 14px;border-radius:99px;font-size:11.5px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;transition:all .17s;white-space:nowrap;flex-shrink:0;}
.month-chip:hover{color:var(--text);border-color:var(--border-l);}
.month-chip.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,.35);}
.month-chip.alltime{border-style:dashed;}

/* Summary */
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px;}
.summary-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;transition:all .2s;box-shadow:var(--shadow);}
.summary-card:hover{border-color:var(--border-l);transform:translateY(-1px);}
.sc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:var(--text3);margin-bottom:6px;}
.sc-value{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;line-height:1;}
.sc-value.balance{color:var(--accent);}
.sc-value.income{color:var(--income);}
.sc-value.expense{color:var(--expense);}
.sc-value.investment{color:var(--invest);}
.sc-value.insurance{color:var(--insure);}
.sc-sub{font-size:9.5px;color:var(--text3);margin-top:4px;}

/* Budget */
.budget-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;margin-bottom:16px;box-shadow:var(--shadow);}
.budget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;}
.budget-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);}
.budget-track{height:4px;background:var(--border);border-radius:99px;overflow:hidden;}
.budget-fill{height:100%;border-radius:99px;transition:width .9s cubic-bezier(.34,1.56,.64,1);}
.budget-footer{display:flex;justify-content:space-between;margin-top:6px;font-size:10.5px;color:var(--text3);}

/* Charts */
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
.chart-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:17px 19px;box-shadow:var(--shadow);}
.chart-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:13px;}
.pie-row{display:flex;align-items:center;gap:12px;}
.pie-legend{display:flex;flex-direction:column;gap:6px;flex:1;overflow:hidden;}
.pie-legend-item{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text2);}
.pie-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.pie-legend-val{margin-left:auto;font-weight:600;font-size:10.5px;white-space:nowrap;}

/* Form */
.form-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px;box-shadow:var(--shadow);}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.fg{display:flex;flex-direction:column;gap:5px;}
.fg.full{grid-column:1/-1;}
.fl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;color:var(--text3);}
.fi,.fs{background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:10px 12px;color:var(--text);font-size:13.5px;width:100%;outline:none;transition:border-color .18s,box-shadow .18s;-webkit-appearance:none;appearance:none;}
.fs{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%235A5A5A' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:30px;}
.fi:focus,.fs:focus{border-color:rgba(200,169,110,.5);box-shadow:0 0 0 3px rgba(200,169,110,.07);}
.fi::placeholder{color:var(--text3);}
.type-toggle{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid var(--border);border-radius:var(--rx);overflow:hidden;}
.type-btn{padding:10px 4px;text-align:center;cursor:pointer;font-size:11px;font-weight:500;transition:all .17s;color:var(--text3);border:none;background:var(--surface);}
.type-btn.active.expense{background:var(--expense-dim);color:var(--expense);}
.type-btn.active.income{background:var(--income-dim);color:var(--income);}
.type-btn.active.investment{background:var(--invest-dim);color:var(--invest);}
.type-btn.active.insurance{background:var(--insure-dim);color:var(--insure);}
.btn-primary{background:var(--accent);color:#fff;border:none;border-radius:var(--rx);padding:12px 24px;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .18s;width:100%;margin-top:3px;}
.btn-primary:hover{background:var(--accent-h);transform:translateY(-1px);box-shadow:0 5px 18px rgba(200,169,110,.25);}
.btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none;}
.btn-secondary{background:none;border:1px solid var(--border);border-radius:var(--rx);padding:11px 18px;font-size:13px;font-weight:500;color:var(--text2);cursor:pointer;transition:all .18s;width:100%;margin-top:3px;}
.btn-secondary:hover{border-color:var(--border-l);color:var(--text);}

/* Transactions */
.tx-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px;}
.search-wrap{position:relative;}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:12px;pointer-events:none;}
.search-input{background:var(--card);border:1px solid var(--border);border-radius:99px;padding:7px 13px 7px 30px;color:var(--text);font-size:12.5px;width:170px;outline:none;transition:all .18s;}
.search-input:focus{border-color:rgba(200,169,110,.4);width:210px;}
.search-input::placeholder{color:var(--text3);}
.filter-strip{display:flex;gap:5px;overflow-x:auto;margin-bottom:12px;padding-bottom:2px;scrollbar-width:none;}
.filter-strip::-webkit-scrollbar{display:none;}
.filter-chip{padding:3px 11px;border-radius:99px;font-size:10.5px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0;}
.filter-chip:hover{color:var(--text);border-color:var(--border-l);}
.filter-chip.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,.3);}
.filter-chip.inv-chip.active{background:var(--invest-dim);color:var(--invest);border-color:rgba(129,140,248,.3);}
.filter-chip.ins-chip.active{background:var(--insure-dim);color:var(--insure);border-color:rgba(251,146,60,.3);}
.tx-list{display:flex;flex-direction:column;gap:5px;}
.tx-item{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:11px 13px;display:flex;align-items:center;gap:11px;transition:all .17s;animation:fadeIn .28s ease;box-shadow:var(--shadow);}
.tx-item:hover{border-color:var(--border-l);background:var(--card-hover);}
.tx-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.tx-icon.expense{background:var(--expense-dim);}
.tx-icon.income{background:var(--income-dim);}
.tx-icon.investment{background:var(--invest-dim);}
.tx-icon.insurance{background:var(--insure-dim);}
.tx-info{flex:1;min-width:0;}
.tx-cat{font-size:12.5px;font-weight:600;color:var(--text);}
.tx-note{font-size:10.5px;color:var(--text3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tx-badge{display:inline-block;padding:1px 6px;border-radius:99px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-left:5px;vertical-align:middle;}
.tx-badge.expense{background:var(--expense-dim);color:var(--expense);}
.tx-badge.income{background:var(--income-dim);color:var(--income);}
.tx-badge.investment{background:var(--invest-dim);color:var(--invest);}
.tx-badge.insurance{background:var(--insure-dim);color:var(--insure);}
.tx-actions{display:flex;gap:4px;opacity:0;transition:opacity .17s;}
.tx-item:hover .tx-actions{opacity:1;}
.tx-btn{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:9.5px;font-weight:600;cursor:pointer;color:var(--text2);transition:all .13s;text-transform:uppercase;letter-spacing:.4px;}
.tx-btn:hover{color:var(--text);border-color:var(--border-l);}
.tx-btn.del:hover{color:var(--expense);border-color:rgba(248,113,113,.4);background:var(--expense-dim);}
.tx-meta{text-align:right;flex-shrink:0;}
.tx-amount{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;}
.tx-amount.income{color:var(--income);}
.tx-amount.expense{color:var(--expense);}
.tx-amount.investment{color:var(--invest);}
.tx-amount.insurance{color:var(--insure);}
.tx-date{font-size:9.5px;color:var(--text3);margin-top:2px;}
.empty-state{text-align:center;padding:44px 24px;color:var(--text3);}
.empty-state .es-icon{font-size:34px;margin-bottom:10px;}
.empty-state p{font-size:12.5px;}

/* Icon button */
.icon-btn{display:flex;align-items:center;gap:5px;background:none;border:1px solid var(--border);border-radius:var(--rx);padding:6px 12px;font-size:11.5px;font-weight:500;color:var(--text2);cursor:pointer;transition:all .18s;}
.icon-btn:hover{color:var(--accent);border-color:rgba(200,169,110,.35);background:var(--accent-dim);}

/* Markets */
.market-tabs{display:flex;gap:5px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;width:fit-content;flex-wrap:wrap;}
.market-tab{padding:7px 13px;border-radius:5px;font-size:11.5px;font-weight:500;cursor:pointer;color:var(--text3);transition:all .17s;border:none;background:none;white-space:nowrap;}
.market-tab.active{background:var(--card);color:var(--text);box-shadow:0 1px 6px rgba(0,0,0,.2);}
.market-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;}
.mkt-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:12px 13px;transition:all .18s;box-shadow:var(--shadow);}
.mkt-card:hover{border-color:var(--border-l);transform:translateY(-1px);}
.mkt-card.idx{border-color:rgba(200,169,110,.2);background:var(--accent-dim);}
.mkt-name{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mkt-sym{font-size:9px;color:var(--text3);margin-bottom:6px;}
.mkt-sector{display:inline-block;padding:1px 7px;border-radius:99px;font-size:8.5px;font-weight:600;background:var(--border);color:var(--text3);margin-bottom:6px;}
.mkt-price{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:700;color:var(--text);}
.mkt-change{font-size:10px;font-weight:600;margin-top:3px;}
.mkt-change.up{color:var(--income);}
.mkt-change.down{color:var(--expense);}
.mkt-loading{font-size:10px;color:var(--text3);animation:pulse2 1.2s infinite;margin-top:8px;}
.refresh-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
.spinner{width:13px;height:13px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;}
.stock-search-bar{display:flex;gap:8px;margin-bottom:8px;}
.stock-search{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:9px 13px;color:var(--text);font-size:13px;outline:none;transition:border-color .18s;}
.stock-search:focus{border-color:rgba(200,169,110,.4);}
.stock-search::placeholder{color:var(--text3);}
.search-hint{font-size:10.5px;color:var(--text3);margin-bottom:14px;}
.mf-row{display:flex;gap:8px;margin-bottom:14px;}
.mf-input{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:9px 13px;color:var(--text);font-size:13px;outline:none;transition:border-color .18s;}
.mf-input:focus{border-color:rgba(200,169,110,.4);}
.mf-input::placeholder{color:var(--text3);}
.mf-results{display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto;}
.mf-item{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:12px;box-shadow:var(--shadow);}
.mf-item-name{font-size:12px;font-weight:500;color:var(--text);flex:1;}
.mf-nav{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:700;color:var(--invest);}
.mf-date{font-size:9.5px;color:var(--text3);margin-top:2px;text-align:right;}
.mkt-section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin:14px 0 8px;}

/* Import */
.import-zone{border:2px dashed var(--border);border-radius:var(--r);padding:38px 24px;text-align:center;cursor:pointer;transition:all .2s;background:var(--card);}
.import-zone:hover,.import-zone.drag{border-color:var(--accent);background:var(--accent-dim);}

/* Settings */
.settings-section{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-bottom:12px;box-shadow:var(--shadow);}
.settings-section h3{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;}
.settings-section p{font-size:11.5px;color:var(--text3);margin-bottom:14px;line-height:1.5;}
.setting-row{display:flex;align-items:center;gap:10px;}
.setting-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:10px 12px;color:var(--text);font-size:13.5px;outline:none;transition:border-color .18s;}
.setting-input:focus{border-color:rgba(200,169,110,.5);}
.setting-input::placeholder{color:var(--text3);}
.btn-save{background:var(--accent);color:#fff;border:none;border-radius:var(--rx);padding:10px 18px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .18s;}
.btn-save:hover{background:var(--accent-h);}
.danger-btn{background:none;border:1px solid rgba(248,113,113,.3);border-radius:var(--rx);padding:10px 18px;font-size:12.5px;font-weight:500;color:var(--expense);cursor:pointer;transition:all .18s;}
.danger-btn:hover{background:var(--expense-dim);border-color:rgba(248,113,113,.6);}

/* Bottom nav */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);z-index:200;padding-bottom:env(safe-area-inset-bottom,0px);}
.bnav-items{display:flex;justify-content:space-around;}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 4px;cursor:pointer;color:var(--text3);font-size:7px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;transition:color .17s;min-width:0;flex:1;}
.bnav-item .bnav-icon{font-size:16px;}
.bnav-item.active{color:var(--accent);}
.bnav-fab{background:var(--accent);border:none;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;color:#fff;box-shadow:0 4px 14px rgba(200,169,110,.4);transition:transform .18s;margin-top:-9px;}
.bnav-fab:hover{transform:scale(1.09);}

/* Toast */
.toast{position:fixed;top:20px;right:20px;background:var(--card2);border:1px solid var(--border);border-radius:var(--rx);padding:10px 16px;font-size:12.5px;z-index:9999;animation:toastIn .28s ease;box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;align-items:center;gap:7px;max-width:320px;}
.toast.success{border-color:rgba(52,211,153,.4);color:var(--income);}
.toast.error{border-color:rgba(248,113,113,.4);color:var(--expense);}
.toast.warning{border-color:rgba(200,169,110,.4);color:var(--accent);}

/* Login */
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:hidden;}
.login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(200,169,110,.08) 0%,transparent 70%);pointer-events:none;}
.login-card{width:100%;max-width:390px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px;animation:slideUp .42s ease;position:relative;z-index:1;box-shadow:var(--shadow);}
.login-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:var(--accent);text-align:center;margin-bottom:3px;}
.login-tagline{font-size:11.5px;color:var(--text3);text-align:center;margin-bottom:22px;}
.tab2{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;margin-bottom:16px;}
.tab2-btn{padding:8px;text-align:center;border-radius:5px;cursor:pointer;font-size:12.5px;font-weight:500;color:var(--text3);transition:all .17s;border:none;background:none;}
.tab2-btn.active{background:var(--card);color:var(--text);}
.auth-error{background:var(--expense-dim);border:1px solid rgba(248,113,113,.3);border-radius:var(--rx);padding:9px 13px;font-size:11.5px;color:var(--expense);margin-bottom:13px;}
.auth-ok{background:var(--income-dim);border:1px solid rgba(52,211,153,.3);border-radius:var(--rx);padding:9px 13px;font-size:11.5px;color:var(--income);margin-bottom:13px;}
.google-btn{width:100%;padding:11px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer;transition:all .17s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:9px;}
.google-btn:hover{border-color:var(--border-l);background:var(--card-hover);}
.divider{display:flex;align-items:center;gap:9px;margin:12px 0;color:var(--text3);font-size:10.5px;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border);}
.forgot-link{font-size:11px;color:var(--accent);cursor:pointer;text-align:right;margin-top:-4px;margin-bottom:10px;display:block;}
.forgot-link:hover{text-decoration:underline;}
.otp-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:14px;color:var(--text);font-size:22px;font-weight:700;text-align:center;outline:none;transition:border-color .18s;letter-spacing:6px;margin-bottom:14px;}
.otp-input:focus{border-color:rgba(200,169,110,.5);}
.phone-row{display:flex;margin-bottom:14px;}
.phone-pre{background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:var(--rx) 0 0 var(--rx);padding:10px 12px;color:var(--text2);font-size:13.5px;display:flex;align-items:center;white-space:nowrap;}
.phone-inp{flex:1;background:var(--surface);border:1px solid var(--border);border-left:none;border-radius:0 var(--rx) var(--rx) 0;padding:10px 12px;color:var(--text);font-size:13.5px;outline:none;transition:border-color .18s;}
.phone-inp:focus{border-color:rgba(200,169,110,.5);}
.resend-link{font-size:11px;color:var(--accent);cursor:pointer;text-align:center;margin-top:8px;display:block;}

/* Responsive */
@media(max-width:768px){
  .sidebar{display:none;}
  .bottom-nav{display:block;}
  .content{padding:16px 13px 86px;}
  .summary-grid{grid-template-columns:1fr 1fr;}
  .summary-card:first-child{grid-column:1/-1;}
  .sc-value{font-size:19px!important;}
  .charts-row{grid-template-columns:1fr;}
  .form-grid{grid-template-columns:1fr;}
  .fg.full{grid-column:1;}
  .type-toggle{grid-template-columns:1fr 1fr;}
  .page-header h1{font-size:24px;}
  .search-input{width:100%;}
  .search-input:focus{width:100%;}
  .toast{top:auto;bottom:80px;right:12px;left:12px;}
  .pie-row{flex-direction:column;}
  .market-grid{grid-template-columns:1fr 1fr;}
  .market-tabs{width:100%;}
}
@media(max-width:420px){
  .market-grid{grid-template-columns:1fr 1fr;}
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background:"#1C1C24", border:"1px solid #32323E", borderRadius:8, padding:"7px 11px", fontSize:11, color:"#EEEAE4" }}>
      <div style={{ color:"#9A9590", marginBottom:2 }}>Day {label}</div>
      <div style={{ color: v >= 0 ? "#34D399" : "#F87171", fontWeight:600 }}>
        {v >= 0 ? "+" : ""}₹{Math.abs(v).toLocaleString("en-IN")}
      </div>
    </div>
  );
};

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1C1C24", border:"1px solid #32323E", borderRadius:8, padding:"7px 11px", fontSize:11 }}>
      <div style={{ color:"#EEEAE4", fontWeight:600 }}>{payload[0].name}</div>
      <div style={{ color:"#C8A96E" }}>₹{payload[0].value.toLocaleString("en-IN")}</div>
    </div>
  );
};

function MonthStrip({ months, selectedMonth, setSelectedMonth }) {
  return (
    <div className="month-strip">
      <button className={`month-chip alltime ${selectedMonth === "all" ? "active" : ""}`}
        onClick={() => setSelectedMonth("all")}>All Time</button>
      {months.map((m) => (
        <button key={m.value} className={`month-chip ${selectedMonth === m.value ? "active" : ""}`}
          onClick={() => setSelectedMonth(m.value)}>{m.label}</button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin, onSignup, onGoogle }) {
  const [authTab, setAuthTab]   = useState("email");  // email | phone
  const [signTab, setSignTab]   = useState("signin"); // signin | signup
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState("");
  const [step, setStep]         = useState("phone");  // phone | otp
  const [conf, setConf]         = useState(null);
  const [forgot, setForgot]     = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [ok, setOk]             = useState("");

  const handleEmail = async () => {
    if (!email || !password) return;
    setErr(""); setLoading(true);
    try {
      if (signTab === "signin") await onLogin(email, password);
      else await onSignup(email, password);
    } catch (e) { setErr(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  const handleForgot = async () => {
    if (!resetEmail) return;
    setErr(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setOk("✓ Reset link sent — check your inbox.");
    } catch (e) { setErr(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  const sendOTP = async () => {
    if (!phone || phone.length < 10) { setErr("Enter a valid 10-digit number"); return; }
    setErr(""); setLoading(true);
    try {
      if (window._rcv) { window._rcv.clear(); window._rcv = null; }
      window._rcv = new RecaptchaVerifier(auth, "rcv-container", { size: "invisible" });
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, window._rcv);
      setConf(result); setStep("otp"); setOk("OTP sent to +91-" + phone);
    } catch (e) { setErr(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length < 4) { setErr("Enter the OTP"); return; }
    setErr(""); setLoading(true);
    try { await conf.confirm(otp); }
    catch { setErr("Invalid OTP. Try again."); }
    finally { setLoading(false); }
  };

  if (forgot) return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Reset your password</div>
        {err && <div className="auth-error">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}
        {!ok && (
          <>
            <div className="fg" style={{ marginBottom:14 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="you@example.com" value={resetEmail}
                onChange={e => setResetEmail(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleForgot()} />
            </div>
            <button className="btn-primary" onClick={handleForgot} disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </>
        )}
        <button className="btn-secondary" onClick={() => { setForgot(false); setErr(""); setOk(""); }}>
          ← Back to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="login-page">
      <div id="rcv-container" />
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Smart money. Clear picture.</div>

        <div className="tab2">
          <button className={`tab2-btn ${authTab==="email"?"active":""}`}
            onClick={() => { setAuthTab("email"); setErr(""); setOk(""); }}>📧 Email</button>
          <button className={`tab2-btn ${authTab==="phone"?"active":""}`}
            onClick={() => { setAuthTab("phone"); setErr(""); setOk(""); }}>📱 Mobile OTP</button>
        </div>

        {err && <div className="auth-error">{err}</div>}
        {ok  && <div className="auth-ok">{ok}</div>}

        {authTab === "email" ? (
          <>
            <div className="tab2" style={{ marginBottom:16 }}>
              <button className={`tab2-btn ${signTab==="signin"?"active":""}`} onClick={() => setSignTab("signin")}>Sign In</button>
              <button className={`tab2-btn ${signTab==="signup"?"active":""}`} onClick={() => setSignTab("signup")}>Sign Up</button>
            </div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="fg" style={{ marginBottom:4 }}>
              <label className="fl">Password</label>
              <input className="fi" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleEmail()} />
            </div>
            {signTab === "signin" && (
              <span className="forgot-link" onClick={() => { setForgot(true); setErr(""); }}>
                Forgot password?
              </span>
            )}
            <button className="btn-primary" onClick={handleEmail} disabled={loading} style={{ marginTop:10 }}>
              {loading ? "Please wait…" : signTab==="signin" ? "Sign In" : "Create Account"}
            </button>
            <div className="divider">or</div>
            <button className="google-btn" onClick={onGoogle}>
              <span style={{ fontWeight:700 }}>G</span> Continue with Google
            </button>
          </>
        ) : step === "phone" ? (
          <>
            <div className="fg" style={{ marginBottom:14 }}>
              <label className="fl">Mobile Number (India +91)</label>
              <div className="phone-row">
                <div className="phone-pre">🇮🇳 +91</div>
                <input className="phone-inp" type="tel" placeholder="9876543210" maxLength={10}
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,""))}
                  onKeyDown={e => e.key==="Enter" && sendOTP()} />
              </div>
            </div>
            <button className="btn-primary" onClick={sendOTP} disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize:12, color:"var(--text3)", marginBottom:12 }}>
              Enter the 6-digit OTP sent to +91-{phone}
            </p>
            <input className="otp-input" type="tel" maxLength={6} placeholder="------"
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))}
              onKeyDown={e => e.key==="Enter" && verifyOTP()} />
            <button className="btn-primary" onClick={verifyOTP} disabled={loading}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
            <span className="resend-link" onClick={() => { setStep("phone"); setOtp(""); setErr(""); setOk(""); }}>
              ← Change number / Resend
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({ income, expense, investment, insurance, balance, budget,
  budgetProgress, budgetColor, expPieData, invPieData, insPieData,
  trendData, months, selectedMonth, setSelectedMonth }) {

  const budgetNum = parseFloat(budget) || 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{selectedMonth === "all" ? "All-time summary" : "Monthly overview — " + selectedMonth}</p>
        </div>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      {/* Row 1 — 4 main cards */}
      <div className="summary-grid" style={{ gridTemplateColumns:"repeat(4,1fr)" }}>
        <div className="summary-card" style={{ gridColumn:"1/span 2" }}>
          <div className="sc-label">Net Balance</div>
          <div className="sc-value balance">{balance >= 0 ? fmtINR(balance) : "-" + fmtINR(Math.abs(balance))}</div>
          <div className="sc-sub">Income − Expense</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Income</div>
          <div className="sc-value income">{fmtINR(income)}</div>
          <div className="sc-sub">earned</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Expense</div>
          <div className="sc-value expense">{fmtINR(expense)}</div>
          <div className="sc-sub">spent</div>
        </div>
      </div>

      {/* Row 2 — extra KPIs */}
      <div className="summary-grid" style={{ gridTemplateColumns:"repeat(4,1fr)", marginTop:-6 }}>
        <div className="summary-card">
          <div className="sc-label">Invested</div>
          <div className="sc-value investment">{fmtINR(investment)}</div>
          <div className="sc-sub">deployed</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Insurance</div>
          <div className="sc-value insurance">{fmtINR(insurance)}</div>
          <div className="sc-sub">premiums paid</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Savings Rate</div>
          <div className="sc-value" style={{ color: income>0 && (income-expense)>0 ? "var(--income)" : "var(--expense)" }}>
            {income > 0 ? (((income-expense)/income)*100).toFixed(1)+"%" : "—"}
          </div>
          <div className="sc-sub">of income saved</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Outflow</div>
          <div className="sc-value" style={{ color:"var(--text2)" }}>
            {fmtINR(expense + investment + insurance)}
          </div>
          <div className="sc-sub">exp + inv + ins</div>
        </div>
      </div>

      {/* Budget bar */}
      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="budget-title">Expense Budget</span>
            <span style={{ color:budgetColor, fontSize:12.5, fontWeight:600 }}>
              {fmtINR(expense)} / {fmtINR(budgetNum)}
            </span>
          </div>
          <div className="budget-track">
            <div className="budget-fill" style={{ width:`${budgetProgress}%`, background:budgetColor }} />
          </div>
          <div className="budget-footer">
            <span>{budgetProgress.toFixed(0)}% used</span>
            <span style={{ color: budgetNum-expense>0 ? "var(--income)" : "var(--expense)" }}>
              {budgetNum-expense > 0 ? fmtINR(budgetNum-expense)+" remaining" : fmtINR(expense-budgetNum)+" over budget"}
            </span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Expense Breakdown</div>
          {expPieData.length > 0 ? (
            <div className="pie-row">
              <PieChart width={110} height={110}>
                <Pie data={expPieData} dataKey="value" cx={51} cy={51} innerRadius={28} outerRadius={48} paddingAngle={2}>
                  {expPieData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div className="pie-legend">
                {expPieData.slice(0,6).map((item,i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background:PIE_COLORS[i%PIE_COLORS.length] }} />
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val">₹{item.value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ textAlign:"center", padding:"22px 0", color:"var(--text3)", fontSize:12 }}>No expense data</div>}
        </div>

        <div className="chart-card">
          <div className="chart-title">Daily Cash Flow</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={148}>
              <AreaChart data={trendData} margin={{ top:4, right:4, left:-32, bottom:0 }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C8A96E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#C8A96E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize:9, fill:"#52524E" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:"#52524E" }} axisLine={false} tickLine={false} />
                <Tooltip content={<AreaTip />} />
                <Area type="monotone" dataKey="amount" stroke="#C8A96E" strokeWidth={1.8} fill="url(#ag)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign:"center", padding:"22px 0", color:"var(--text3)", fontSize:12 }}>No trend data</div>}
        </div>

        {invPieData.length > 0 && (
          <div className="chart-card">
            <div className="chart-title" style={{ color:"var(--invest)" }}>Investment Allocation</div>
            <div className="pie-row">
              <PieChart width={110} height={110}>
                <Pie data={invPieData} dataKey="value" cx={51} cy={51} innerRadius={28} outerRadius={48} paddingAngle={2}>
                  {invPieData.map((_,i) => <Cell key={i} fill={INV_COLORS[i%INV_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div className="pie-legend">
                {invPieData.slice(0,6).map((item,i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background:INV_COLORS[i%INV_COLORS.length] }} />
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val" style={{ color:INV_COLORS[i%INV_COLORS.length] }}>₹{item.value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {insPieData.length > 0 && (
          <div className="chart-card">
            <div className="chart-title" style={{ color:"var(--insure)" }}>Insurance Premiums</div>
            <div className="pie-row">
              <PieChart width={110} height={110}>
                <Pie data={insPieData} dataKey="value" cx={51} cy={51} innerRadius={28} outerRadius={48} paddingAngle={2}>
                  {insPieData.map((_,i) => <Cell key={i} fill={INS_COLORS[i%INS_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div className="pie-legend">
                {insPieData.slice(0,6).map((item,i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background:INS_COLORS[i%INS_COLORS.length] }} />
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val" style={{ color:INS_COLORS[i%INS_COLORS.length] }}>₹{item.value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD FORM
// ═══════════════════════════════════════════════════════════════════════════════
function AddForm({ amount, setAmount, type, setType, category, setCategory,
  note, setNote, date, setDate, editId, onSubmit, onCancel }) {

  const getCats  = (t) => ALL_CATS[t] || EXPENSE_CATEGORIES;
  const getDef   = (t) => t==="income"?"Salary":t==="investment"?"Stocks — NSE/BSE":t==="insurance"?"Term Life Insurance":"Food & Dining";
  const changeType = (t) => { setType(t); setCategory(getDef(t)); };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>Record income, expense, investment or insurance premium</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="fg full">
            <label className="fl">Type</label>
            <div className="type-toggle">
              {["expense","income","investment","insurance"].map(t => (
                <button key={t} className={`type-btn ${type===t?"active "+t:""}`} onClick={() => changeType(t)}>
                  {TYPE_META[t].icon} {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="fl">Amount (₹)</label>
            <input className="fi" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Category</label>
            <select className="fs" value={category} onChange={e => setCategory(e.target.value)}>
              {getCats(type).map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]||"•"} {c}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Date</label>
            <input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Note (optional)</label>
            <input className="fi" type="text" placeholder="Add a note…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div className="fg full" style={{ marginTop:4 }}>
            <button className="btn-primary" onClick={onSubmit}>{editId ? "✓ Update" : "+ Add Transaction"}</button>
            {editId && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
function History({ filtered, search, setSearch, filterCategory, setFilterCategory,
  filterType, setFilterType, onEdit, onDelete, onExport, months, selectedMonth, setSelectedMonth }) {

  const allCats = [...EXPENSE_CATEGORIES,...INCOME_CATEGORIES,...INVESTMENT_CATEGORIES,...INSURANCE_CATEGORIES];

  return (
    <>
      <div className="page-header">
        <div><h1>Transactions</h1><p>{filtered.length} record{filtered.length!==1?"s":""}</p></div>
        <button className="icon-btn" onClick={onExport}>↓ CSV</button>
      </div>
      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {["all","expense","income","investment","insurance"].map(t => (
            <button key={t}
              className={`filter-chip ${filterType===t?"active"+(t==="investment"?" inv-chip":t==="insurance"?" ins-chip":""):""}`}
              onClick={() => setFilterType(t)}>
              {t==="all" ? "All" : TYPE_META[t]?.icon+" "+TYPE_META[t]?.label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filter-strip">
        <button className={`filter-chip ${!filterCategory?"active":""}`} onClick={() => setFilterCategory("")}>All Categories</button>
        {allCats.map(c => (
          <button key={c} className={`filter-chip ${filterCategory===c?"active":""}`}
            onClick={() => setFilterCategory(filterCategory===c?"":c)}>
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">📭</div><p>No transactions found</p></div>
          : filtered.map(e => (
            <div key={e.id} className="tx-item">
              <div className={`tx-icon ${e.type}`}>{CATEGORY_ICONS[e.category]||"💸"}</div>
              <div className="tx-info">
                <div className="tx-cat">
                  {e.category}
                  <span className={`tx-badge ${e.type}`}>{TYPE_META[e.type]?.label||e.type}</span>
                </div>
                <div className="tx-note">{e.note||<span style={{ fontStyle:"italic" }}>No note</span>}</div>
              </div>
              <div className="tx-actions">
                <button className="tx-btn" onClick={() => onEdit(e)}>Edit</button>
                <button className="tx-btn del" onClick={() => onDelete(e.id)}>Delete</button>
              </div>
              <div className="tx-meta">
                <div className={`tx-amount ${e.type}`}>{TYPE_META[e.type]?.sign||""}₹{e.amount.toLocaleString("en-IN")}</div>
                <div className="tx-date">{e.date}</div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ImportPage({ onImport, showToast }) {
  const [step, setStep]       = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [colMap, setColMap]   = useState({ date:-1, type:-1, category:-1, amount:-1, note:-1 });
  const [parsed, setParsed]   = useState([]);
  const [errors, setErrors]   = useState([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [drag, setDrag]       = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) { showToast("Could not parse — check file format", "error"); return; }
      setCsvData({ headers, rows });
      setColMap(autoMapColumns(headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const result = []; const errs = [];
    csvData.rows.forEach((row, i) => {
      const rawDate = colMap.date   >= 0 ? row[colMap.date]              : "";
      const rawType = colMap.type   >= 0 ? row[colMap.type]?.toLowerCase().trim() : "expense";
      const rawCat  = colMap.category>=0 ? row[colMap.category]?.trim()  : "";
      const rawAmt  = colMap.amount >= 0 ? row[colMap.amount]            : "0";
      const rawNote = colMap.note   >= 0 ? row[colMap.note]              : "";
      const date    = normalizeDate(rawDate);
      const amount  = parseFloat((rawAmt||"0").replace(/[^0-9.]/g,""));
      const type    = VALID_TYPES.includes(rawType) ? rawType : "expense";
      const knownC  = ALL_CATS[type] || EXPENSE_CATEGORIES;
      const category = knownC.find(c => c.toLowerCase()===rawCat.toLowerCase()) || knownC[0];
      const rowErrs = [];
      if (!date) rowErrs.push("invalid date");
      if (isNaN(amount)||amount<=0) rowErrs.push("invalid amount");
      if (rowErrs.length) errs.push(`Row ${i+2}: ${rowErrs.join(", ")}`);
      result.push({ date:date||toLocalDateStr(new Date()), type, category, amount:isNaN(amount)?0:amount, note:rawNote, valid:rowErrs.length===0 });
    });
    setParsed(result); setErrors(errs); setStep("preview");
  };

  const runImport = async () => {
    setStep("importing");
    const valid = parsed.filter(r => r.valid);
    let done = 0;
    for (const rec of valid) {
      await onImport(rec);
      done++;
      setProgress(Math.round((done/valid.length)*100));
      setImported(done);
    }
    setStep("done");
    showToast(`✓ Imported ${done} transaction${done!==1?"s":""}`, "success");
  };

  const reset = () => { setStep("upload"); setCsvData(null); setParsed([]); setErrors([]); setProgress(0); setImported(0); };
  const validCount = parsed.filter(r => r.valid).length;

  return (
    <>
      <div className="page-header">
        <div><h1>Import Transactions</h1><p>Bulk upload from CSV file</p></div>
        {step !== "upload" && <button className="icon-btn" onClick={reset}>↩ Start Over</button>}
      </div>

      {step === "upload" && (
        <>
          <div className={`import-zone${drag?" drag":""}`}
            onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:"none" }}
              onChange={e=>handleFile(e.target.files[0])} />
            <div style={{ fontSize:34, marginBottom:10 }}>📂</div>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:5 }}>Drop CSV file here</div>
            <div style={{ fontSize:12, color:"var(--text3)" }}>or click to browse</div>
          </div>
          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--rx)", padding:"16px 18px", marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px", color:"var(--text3)", marginBottom:9 }}>Expected Format</div>
            <div style={{ fontFamily:"monospace", fontSize:12, color:"var(--text2)", background:"var(--surface)", padding:"10px 13px", borderRadius:"var(--rx)", lineHeight:1.9 }}>
              Date,Type,Category,Amount,Note<br/>
              2026-04-15,expense,Food &amp; Dining,450,Lunch<br/>
              2026-04-16,income,Salary,75000,April salary<br/>
              2026-04-17,investment,PPF,5000,Monthly PPF<br/>
              2026-04-18,insurance,Term Life Insurance,1200,Premium
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:10, lineHeight:1.7 }}>
              Date: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY · Type: income/expense/investment/insurance · Amount: number only (no ₹)
            </div>
          </div>
          <button className="btn-primary" style={{ marginTop:14 }} onClick={() => {
            const csv = "Date,Type,Category,Amount,Note\n2026-04-15,expense,Food & Dining,450,Sample\n2026-04-16,income,Salary,75000,Monthly salary";
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
            a.download = "finwise_template.csv"; a.click();
          }}>⬇ Download Template</button>
        </>
      )}

      {step === "map" && csvData && (
        <>
          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"20px", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:4 }}>
              Found {csvData.rows.length} row{csvData.rows.length!==1?"s":""} · {csvData.headers.length} columns
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginBottom:16 }}>Map CSV columns to fields:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {Object.keys(colMap).map(field => (
                <div key={field} className="fg">
                  <label className="fl">{field.charAt(0).toUpperCase()+field.slice(1)}</label>
                  <select className="fs" value={colMap[field]}
                    onChange={e => setColMap(m => ({...m, [field]:parseInt(e.target.value)}))}>
                    <option value={-1}>— Skip —</option>
                    {csvData.headers.map((h,i) => <option key={i} value={i}>{h} (col {i+1})</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:12 }}>
              Preview first row: {csvData.rows[0]?.join(" | ")}
            </div>
          </div>
          <button className="btn-primary" onClick={buildPreview}>Preview {csvData.rows.length} Rows →</button>
        </>
      )}

      {step === "preview" && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <div style={{ background:"var(--income-dim)", border:"1px solid rgba(52,211,153,.3)", borderRadius:"var(--rx)", padding:"7px 13px", fontSize:12, color:"var(--income)", fontWeight:600 }}>
              ✓ {validCount} valid
            </div>
            {errors.length > 0 && (
              <div style={{ background:"var(--expense-dim)", border:"1px solid rgba(248,113,113,.3)", borderRadius:"var(--rx)", padding:"7px 13px", fontSize:12, color:"var(--expense)", fontWeight:600 }}>
                ✗ {errors.length} will be skipped
              </div>
            )}
          </div>
          {errors.length > 0 && (
            <div style={{ background:"var(--card)", border:"1px solid rgba(248,113,113,.2)", borderRadius:"var(--rx)", padding:"11px 14px", marginBottom:14, fontSize:11, color:"var(--text3)", lineHeight:1.8 }}>
              {errors.slice(0,5).map((e,i) => <div key={i}>⚠ {e}</div>)}
              {errors.length > 5 && <div>…and {errors.length-5} more</div>}
            </div>
          )}
          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--r)", overflow:"hidden", marginBottom:16 }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5 }}>
                <thead>
                  <tr style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                    {["","Date","Type","Category","Amount","Note"].map(h => (
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".8px", color:"var(--text3)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0,20).map((r,i) => (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)", opacity:r.valid?1:.4 }}>
                      <td style={{ padding:"7px 12px" }}>{r.valid?"✓":"✗"}</td>
                      <td style={{ padding:"7px 12px", color:"var(--text2)" }}>{r.date}</td>
                      <td style={{ padding:"7px 12px" }}><span className={`tx-badge ${r.type}`}>{TYPE_META[r.type]?.label||r.type}</span></td>
                      <td style={{ padding:"7px 12px", color:"var(--text)" }}>{CATEGORY_ICONS[r.category]||""} {r.category}</td>
                      <td style={{ padding:"7px 12px", color:r.type==="income"?"var(--income)":"var(--expense)", fontWeight:600 }}>₹{r.amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding:"7px 12px", color:"var(--text3)", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.note||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > 20 && (
              <div style={{ padding:"8px 13px", fontSize:11, color:"var(--text3)", borderTop:"1px solid var(--border)" }}>
                Showing 20 of {parsed.length} rows
              </div>
            )}
          </div>
          {validCount > 0
            ? <button className="btn-primary" onClick={runImport}>⬆ Import {validCount} Transaction{validCount!==1?"s":""}</button>
            : <div style={{ fontSize:13, color:"var(--text3)", padding:"12px 0" }}>No valid rows — go back and fix column mapping.</div>
          }
        </>
      )}

      {step === "importing" && (
        <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"32px", textAlign:"center" }}>
          <div style={{ fontSize:30, marginBottom:12 }}>⬆</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:16 }}>
            Importing {imported} / {validCount}…
          </div>
          <div style={{ background:"var(--border)", borderRadius:99, height:6, overflow:"hidden", maxWidth:300, margin:"0 auto" }}>
            <div style={{ height:"100%", borderRadius:99, background:"var(--accent)", width:`${progress}%`, transition:"width .3s ease" }} />
          </div>
          <div style={{ fontSize:11, color:"var(--text3)", marginTop:10 }}>{progress}%</div>
        </div>
      )}

      {step === "done" && (
        <div style={{ background:"var(--card)", border:"1px solid rgba(52,211,153,.3)", borderRadius:"var(--r)", padding:"32px", textAlign:"center" }}>
          <div style={{ fontSize:38, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--income)", marginBottom:8 }}>Import Complete!</div>
          <div style={{ fontSize:13, color:"var(--text3)", marginBottom:20 }}>
            {imported} transaction{imported!==1?"s":""} imported.
            {errors.length>0 ? ` ${errors.length} skipped.` : ""}
          </div>
          <button className="btn-primary" style={{ width:"auto" }} onClick={reset}>Import More</button>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETS  (single definition — no duplicates)
// ═══════════════════════════════════════════════════════════════════════════════
// ── Price cache helpers ───────────────────────────────────────────────────────
const CACHE_KEY = "finwise-prices-v1";

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function writeCache(patch) {
  try {
    const next = { ...readCache(), ...patch, _savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
}
function cacheAgeLabel(ts) {
  if (!ts) return "";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Merge live Yahoo quotes onto a stock list, returns enriched array
function mergeQuotes(stocks, quotes) {
  return stocks.map(s => {
    const q = quotes.find(q => q.symbol === s.symbol);
    if (!q?.regularMarketPrice) return s; // keep existing cached value
    return { ...s, price:q.regularMarketPrice, change:q.regularMarketChange, changePct:q.regularMarketChangePercent };
  });
}

function PriceCard({ name, symbol, price, changePct, change, unit, sector, isIndex, cached }) {
  const up = (changePct ?? 0) >= 0;
  return (
    <div className={`mkt-card${isIndex?" idx":""}`}>
      <div className="mkt-name" title={name}>{name}</div>
      <div className="mkt-sym">{symbol}{cached && <span style={{ marginLeft:4, fontSize:8.5, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:".4px" }}>cached</span>}</div>
      {sector && !isIndex && <div className="mkt-sector">{sector}</div>}
      {price == null ? (
        <div className="mkt-loading">Fetching…</div>
      ) : (
        <>
          <div className="mkt-price">
            {price?.toLocaleString("en-IN", { maximumFractionDigits: price > 1000 ? 0 : 2 })}
            {unit && unit !== "₹" && <span style={{ fontSize:9.5, color:"var(--text3)", marginLeft:3 }}>{unit}</span>}
          </div>
          {changePct != null && (
            <div className={`mkt-change ${up?"up":"down"}`}>
              {up?"▲":"▼"} {Math.abs(changePct).toFixed(2)}%
              {change != null && <span style={{ opacity:.6, marginLeft:4, fontWeight:400 }}>({change>=0?"+":""}{change.toFixed(1)})</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Markets() {
  const cache = readCache();

  // Initialise state directly from cache so the UI is populated immediately
  const hydrate = (list, key) =>
    list.map(s => { const c = cache[key]?.[s.symbol]; return c ? { ...s, ...c, cached:true } : s; });

  const [mktTab, setMktTab]       = useState("stocks");
  const [stockTab, setStockTab]   = useState("nse");
  const [indices, setIndices]     = useState(() => hydrate(INDICES,        "indices"));
  const [nseStocks, setNse]       = useState(() => hydrate(TRENDING_NSE,   "nse"));
  const [bseStocks, setBse]       = useState(() => hydrate(TRENDING_BSE,   "bse"));
  const [usStocks, setUs]         = useState(() => hydrate(TRENDING_US,    "us"));
  const [commodities, setCom]     = useState(() => hydrate(COMMODITY_SYMBOLS,"com"));
  const [crypto, setCrypto]       = useState(() => hydrate(CRYPTO_IDS,     "crypto"));
  const [mfQuery, setMfQuery]     = useState("");
  const [mfResults, setMfResults] = useState([]);
  const [mfLoading, setMfLoad]    = useState(false);
  const [stockQ, setStockQ]       = useState("");
  const [srResults, setSrResults] = useState([]);
  const [srLoading, setSrLoad]    = useState(false);
  const [loading, setLoading]     = useState(false);
  const [lastUpdate, setLast]     = useState(() => cache._savedAt ? new Date(cache._savedAt) : null);
  const [isLive, setIsLive]       = useState(false); // true when last fetch was successful
  const timer = useRef(null);

  // Save a stock list to cache under a named key
  const saveToCache = (key, list) => {
    const patch = {};
    list.forEach(s => {
      if (s.price != null) patch[s.symbol] = { price:s.price, change:s.change, changePct:s.changePct };
    });
    writeCache({ [key]: patch });
  };

  // Fetch a batch; on failure fall back to current state (cached values stay visible)
  const loadBatch = useCallback(async (stocks, setter, cacheKey) => {
    const syms = stocks.map(s => s.symbol).join(",");
    const quotes = await fetchYahooQuotes(syms);
    if (!quotes) return false; // leave current (cached) state untouched
    const enriched = mergeQuotes(stocks, quotes).map(s => ({ ...s, cached:false }));
    setter(enriched);
    saveToCache(cacheKey, enriched);
    return true;
  }, []);

  const loadCrypto = useCallback(async () => {
    try {
      const ids = CRYPTO_IDS.map(c => c.id).join(",");
      const data = await fetchDirect(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr&include_24hr_change=true`, 11000);
      const list = CRYPTO_IDS.map(c => ({ ...c, price:data[c.id]?.inr, changePct:data[c.id]?.inr_24h_change, cached:false }));
      setCrypto(list); saveToCache("crypto", list); return true;
    } catch {
      try {
        const ids = CRYPTO_IDS.map(c => c.id).join(",");
        const data = await fetchDirect(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=${ids}&per_page=10&page=1&price_change_percentage=24h`, 11000);
        const list = CRYPTO_IDS.map(c => {
          const coin = data?.find(d => d.id === c.id);
          return { ...c, price:coin?.current_price, changePct:coin?.price_change_percentage_24h, cached:false };
        });
        setCrypto(list); saveToCache("crypto", list); return true;
      } catch { return false; }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      loadBatch(INDICES,         setIndices, "indices"),
      loadBatch(TRENDING_NSE,    setNse,     "nse"),
      loadBatch(TRENDING_BSE,    setBse,     "bse"),
      loadBatch(TRENDING_US,     setUs,      "us"),
      loadBatch(COMMODITY_SYMBOLS, setCom,   "com"),
      loadCrypto(),
    ]);
    const anyOk = results.some(r => r.status === "fulfilled" && r.value === true);
    setIsLive(anyOk);
    const now = new Date();
    setLast(now);
    if (anyOk) writeCache({ _savedAt: now.getTime() });
    setLoading(false);
  }, [loadBatch, loadCrypto]);

  useEffect(() => {
    refreshAll();
    timer.current = setInterval(refreshAll, 12 * 60 * 60 * 1000); // 12 hours
    return () => clearInterval(timer.current);
  }, [refreshAll]);

  const searchStock = async () => {
    const q = stockQ.trim().toUpperCase();
    if (!q) return;
    setSrLoad(true); setSrResults([]);
    const syms = q.endsWith(".NS")||q.endsWith(".BO") ? q : [q, q+".NS", q+".BO"].join(",");
    const quotes = await fetchYahooQuotes(syms);
    if (quotes?.length) {
      setSrResults(quotes.filter(q => q.regularMarketPrice != null).map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        sector: q.sector || (q.symbol.endsWith(".NS")?"NSE":q.symbol.endsWith(".BO")?"BSE":"US"),
      })));
    }
    setSrLoad(false);
  };

  const searchMF = async () => {
    if (!mfQuery.trim()) return;
    setMfLoad(true);
    try {
      const list = await fetchDirect(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(mfQuery)}`, 12000);
      const top = (list||[]).slice(0,8);
      const navs = await Promise.allSettled(top.map(async f => {
        const d = await fetchDirect(`https://api.mfapi.in/mf/${f.schemeCode}/latest`, 8000);
        return { code:f.schemeCode, name:f.schemeName, nav:d?.data?.[0]?.nav, date:d?.data?.[0]?.date };
      }));
      setMfResults(navs.map((r,i) => r.status==="fulfilled" ? r.value : { code:top[i]?.schemeCode, name:top[i]?.schemeName, nav:null }));
    } catch { setMfResults([]); }
    finally { setMfLoad(false); }
  };

  const activeStocks = stockTab==="nse" ? nseStocks : stockTab==="bse" ? bseStocks : usStocks;
  const cacheTs = cache._savedAt;

  return (
    <>
      <div className="page-header">
        <div><h1>Live Markets</h1><p>Stocks · MF NAV · Crypto · Commodities</p></div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {loading && <div className="spinner" />}
          <button className="icon-btn" onClick={refreshAll}>↻ Refresh</button>
        </div>
      </div>

      <div className="refresh-bar">
        <p>
          {lastUpdate
            ? isLive
              ? `🟢 Live · Updated ${lastUpdate.toLocaleTimeString("en-IN")}`
              : `🟡 Cached · Last live data ${cacheAgeLabel(cacheTs)} · Yahoo Finance rate-limited`
            : "Fetching prices…"}
        </p>
        {!isLive && lastUpdate && (
          <span style={{ fontSize:10.5, color:"var(--text3)" }}>
            Prices shown from last successful fetch · Click ↻ Refresh anytime
          </span>
        )}
      </div>

      {/* Global indices */}
      <div className="mkt-section">Global Indices</div>
      <div className="market-grid" style={{ gridTemplateColumns:"repeat(5,1fr)", marginBottom:18 }}>
        {indices.map(s => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol} price={s.price} changePct={s.changePct} change={s.change} unit={s.unit} isIndex cached={s.cached} />)}
      </div>

      <div className="market-tabs">
        {[["stocks","📊 Stocks"],["mf","📈 MF NAV"],["crypto","₿ Crypto"],["commodities","🥇 Commodities"]].map(([id,label]) => (
          <button key={id} className={`market-tab ${mktTab===id?"active":""}`} onClick={() => setMktTab(id)}>{label}</button>
        ))}
      </div>

      {mktTab === "stocks" && (
        <>
          <div className="stock-search-bar">
            <input className="stock-search" placeholder="Search: INFY, INFY.NS, INFY.BO, AAPL…"
              value={stockQ} onChange={e => setStockQ(e.target.value)}
              onKeyDown={e => e.key==="Enter" && searchStock()} />
            <button className="btn-primary" style={{ width:"auto", margin:0, padding:"9px 18px" }}
              onClick={searchStock} disabled={srLoading}>{srLoading?"…":"Search"}</button>
          </div>
          <div className="search-hint">💡 .NS = NSE · .BO = BSE · no suffix = US/Global</div>

          {srResults.length > 0 && (
            <>
              <div className="mkt-section">Search Results</div>
              <div className="market-grid" style={{ marginBottom:18 }}>
                {srResults.map(s => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol} price={s.price} changePct={s.changePct} change={s.change} unit="₹" sector={s.sector} />)}
              </div>
            </>
          )}

          <div className="mkt-section">Trending</div>
          <div style={{ display:"flex", gap:5, marginBottom:12 }}>
            {[["nse","🇮🇳 NSE"],["bse","🏛 BSE"],["us","🇺🇸 US"]].map(([id,label]) => (
              <button key={id} style={{ padding:"5px 14px", borderRadius:99, fontSize:11.5, fontWeight:500, border:"1px solid var(--border)", background:stockTab===id?"var(--accent-dim)":"none", color:stockTab===id?"var(--accent)":"var(--text3)", cursor:"pointer", transition:"all .15s" }}
                onClick={() => setStockTab(id)}>{label}</button>
            ))}
          </div>
          <div className="market-grid">
            {activeStocks.map(s => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol.replace(/\.(NS|BO)$/,"")} price={s.price} changePct={s.changePct} change={s.change} unit="₹" sector={s.sector} cached={s.cached} />)}
          </div>
        </>
      )}

      {mktTab === "mf" && (
        <>
          <div className="mf-row">
            <input className="mf-input" placeholder="Search fund (e.g. HDFC Midcap, SBI Bluechip, Axis ELSS)…"
              value={mfQuery} onChange={e => setMfQuery(e.target.value)}
              onKeyDown={e => e.key==="Enter" && searchMF()} />
            <button className="btn-primary" style={{ width:"auto", margin:0 }} onClick={searchMF} disabled={mfLoading}>
              {mfLoading?"…":"Search"}
            </button>
          </div>
          {mfResults.length === 0
            ? <div className="empty-state"><div className="es-icon">📈</div><p>Search a fund to see latest NAV (AMFI data via mfapi.in)</p></div>
            : <div className="mf-results">
                {mfResults.map(f => (
                  <div key={f.code} className="mf-item">
                    <div className="mf-item-name">{f.name}</div>
                    <div>
                      <div className="mf-nav">{f.nav ? "₹"+parseFloat(f.nav).toFixed(4) : "—"}</div>
                      <div className="mf-date">{f.date||""}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>
      )}

      {mktTab === "crypto" && (
        <div className="market-grid">
          {crypto.map(c => <PriceCard key={c.id} name={c.name} symbol={c.symbol} price={c.price} changePct={c.changePct} unit="INR" cached={c.cached} />)}
        </div>
      )}

      {mktTab === "commodities" && (
        <div className="market-grid">
          {commodities.map(c => <PriceCard key={c.symbol} name={c.name} symbol={c.symbol} price={c.price} changePct={c.changePct} change={c.change} unit={c.unit} cached={c.cached} />)}
        </div>
      )}

      <div style={{ marginTop:16, padding:"10px 14px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--rx)", fontSize:10.5, color:"var(--text3)", lineHeight:1.7 }}>
        ⚠️ Stocks & Commodities via Yahoo Finance (~15 min delayed) · Crypto via CoinGecko (live INR) · MF NAV via mfapi.in (official AMFI). Not investment advice.
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function Settings({ budget, budgetInput, setBudgetInput, onSaveBudget, darkMode, setDarkMode, user, logout }) {
  return (
    <>
      <div className="page-header"><div><h1>Settings</h1><p>Manage preferences</p></div></div>

      <div className="settings-section">
        <h3>🎨 Appearance</h3>
        <p>Switch between dark and light theme. Preference is saved automatically.</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:13, color:"var(--text)" }}>{darkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
          <div className="theme-row" style={{ margin:0, border:"none", padding:0, background:"none" }}
            onClick={() => setDarkMode(d => !d)}>
            <div className={`tt-track ${darkMode?"on":""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>💰 Monthly Expense Budget</h3>
        <p>Set a spending cap. Only expense transactions count — investments and insurance are tracked separately.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly limit…"
            value={budgetInput} onChange={e => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {budget && <div style={{ marginTop:9, fontSize:11.5, color:"var(--text3)" }}>
          Current: <span style={{ color:"var(--accent)", fontWeight:600 }}>₹{parseFloat(budget).toLocaleString("en-IN")}</span>
        </div>}
      </div>

      <div className="settings-section">
        <h3>👤 Account</h3>
        <p>Signed in as <strong style={{ color:"var(--text)" }}>{user?.email || user?.phoneNumber || "Google User"}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>

      <div className="settings-section">
        <h3>📋 Finwise Premium — Feature List</h3>
        <p>Everything included in this app:</p>
        <div style={{ fontSize:11.5, color:"var(--text3)", lineHeight:2 }}>
          ✓ 4 transaction types: Income, Expense, Investment, Insurance<br/>
          ✓ 70+ categories with emoji icons<br/>
          ✓ All-time + 12-month filter (IST timezone-safe)<br/>
          ✓ Dashboard: Net balance, savings rate, investment rate KPIs<br/>
          ✓ Live NSE/BSE/US stock prices + search (Yahoo Finance)<br/>
          ✓ Mutual Fund NAV search (AMFI via mfapi.in)<br/>
          ✓ Crypto prices in INR (CoinGecko)<br/>
          ✓ Gold, Silver, Crude Oil, USD/INR, EUR/INR<br/>
          ✓ Email / Google / Phone OTP login<br/>
          ✓ Forgot password reset via email<br/>
          ✓ Budget alert with animated progress bar<br/>
          ✓ Bulk CSV import with column mapping + preview<br/>
          ✓ CSV export per period<br/>
          ✓ Dark / Light theme toggle<br/>
          ✓ Fully responsive — desktop + mobile web
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT  — all hooks declared before any early returns
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth ──
  const [user, setUser] = useState(null);

  // ── Dark mode — must be declared BEFORE any conditional returns ──
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("finwise-theme") !== "light");
  useEffect(() => {
    document.body.classList.toggle("light", !darkMode);
    localStorage.setItem("finwise-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ── Transaction form state ──
  const [amount, setAmount]     = useState("");
  const [type, setType]         = useState("expense");
  const [category, setCategory] = useState("Food & Dining");
  const [note, setNote]         = useState("");
  const [date, setDate]         = useState(toLocalDateStr(new Date()));
  const [expenses, setExpenses] = useState([]);
  const [editId, setEditId]     = useState(null);

  // ── Filter state ──
  const [search, setSearch]                 = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType]         = useState("all");

  // ── Budget ──
  const [budget, setBudget]           = useState(localStorage.getItem("budget") || "");
  const [budgetInput, setBudgetInput] = useState(localStorage.getItem("budget") || "");

  // ── UI state ──
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast]         = useState(null);

  // ── Month selection (local date — fixes IST UTC shift bug) ──
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(now));

  // ── Auth listener ──
  useEffect(() => auth.onAuthStateChanged(setUser), []);

  // ── Firestore listener ──
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
  }, [user]);

  // ── Budget sync ──
  useEffect(() => { localStorage.setItem("budget", budget); }, [budget]);

  // ── Budget alert ──
  useEffect(() => {
    if (!budget || expenses.length === 0) return;
    const exp = expenses
      .filter(e => e.type === "expense" && e.date?.startsWith(toYYYYMM(now)))
      .reduce((s, e) => s + e.amount, 0);
    if (exp > parseFloat(budget)) showToast("⚠️ Monthly budget exceeded!", "warning");
  }, [expenses]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Auth helpers ──
  const handleLogin  = (e, p) => signInWithEmailAndPassword(auth, e, p);
  const handleSignup = (e, p) => createUserWithEmailAndPassword(auth, e, p);
  const handleGoogle = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { throw e; }
  };
  const logout = () => { signOut(auth); setActiveTab("dashboard"); };

  // ── CRUD ──
  const submitTransaction = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    const data = { amount:parseFloat(amount), type, category, note, date };
    try {
      if (editId) {
        await updateDoc(doc(db, "users", user.uid, "expenses", editId), data);
        setEditId(null); showToast("✓ Transaction updated");
      } else {
        await addDoc(collection(db, "users", user.uid, "expenses"), data);
        showToast("✓ Transaction added");
      }
      setAmount(""); setNote(""); setActiveTab("dashboard");
    } catch { showToast("Failed to save", "error"); }
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
    showToast("Transaction removed", "error");
  };

  const editExpense = (e) => {
    setAmount(String(e.amount)); setType(e.type); setCategory(e.category);
    setNote(e.note||""); setDate(e.date); setEditId(e.id); setActiveTab("add");
  };

  const cancelEdit = () => { setEditId(null); setAmount(""); setNote(""); setActiveTab("history"); };

  const importSingleRecord = useCallback(async (rec) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "expenses"), {
      amount: rec.amount, type: rec.type, category: rec.category,
      note: rec.note || "", date: rec.date,
    });
  }, [user]);

  // ── Computed values ──
  const recs = selectedMonth === "all"
    ? expenses
    : expenses.filter(e => e.date?.startsWith(selectedMonth));

  const income     = recs.filter(e => e.type==="income"    ).reduce((s,e) => s+e.amount, 0);
  const expense    = recs.filter(e => e.type==="expense"   ).reduce((s,e) => s+e.amount, 0);
  const investment = recs.filter(e => e.type==="investment").reduce((s,e) => s+e.amount, 0);
  const insurance  = recs.filter(e => e.type==="insurance" ).reduce((s,e) => s+e.amount, 0);
  const balance    = income - expense;

  const buildPie = (t) => {
    const totals = {};
    recs.filter(e => e.type===t).forEach(e => { totals[e.category]=(totals[e.category]||0)+e.amount; });
    return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value }));
  };
  const expPieData = buildPie("expense");
  const invPieData = buildPie("investment");
  const insPieData = buildPie("insurance");

  const trend = {};
  recs.filter(e => e.type!=="investment" && e.type!=="insurance").forEach(e => {
    const day = e.date?.split("-")[2]; if (!day) return;
    trend[day] = (trend[day]||0) + (e.type==="income" ? e.amount : -e.amount);
  });
  const trendData = Object.entries(trend).sort((a,b) => +a[0]-+b[0]).map(([day,amount]) => ({ day:+day, amount }));

  const filtered = recs
    .filter(e =>
      (filterType==="all" || e.type===filterType) &&
      (!search || e.note?.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCategory || e.category===filterCategory)
    )
    .sort((a,b) => new Date(b.date)-new Date(a.date));

  const budgetNum      = parseFloat(budget) || 0;
  const budgetProgress = budgetNum ? Math.min((expense/budgetNum)*100, 100) : 0;
  const budgetColor    = budgetProgress>90 ? "var(--expense)" : budgetProgress>70 ? "var(--accent)" : "var(--income)";

  const months = Array.from({ length:12 }, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return { value:toYYYYMM(d), label:MONTH_NAMES[d.getMonth()]+" '"+String(d.getFullYear()).slice(2) };
  });

  const exportCSV = () => {
    const headers = ["Date","Type","Category","Amount","Note"];
    const rows = filtered.map(e => [e.date,e.type,e.category,e.amount,e.note||""]);
    const csv = [headers,...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `finwise-${selectedMonth}.csv`; a.click();
    showToast("✓ CSV exported");
  };

  // ── Login screen (after all hooks) ──
  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginPage onLogin={handleLogin} onSignup={handleSignup} onGoogle={handleGoogle} />
    </>
  );

  const NAV = [
    { id:"dashboard", icon:"◉", label:"Overview" },
    { id:"add",       icon:"＋", label:"Add"      },
    { id:"history",   icon:"≡",  label:"History"  },
    { id:"import",    icon:"⬆",  label:"Import"   },
    { id:"markets",   icon:"📈", label:"Markets"  },
    { id:"settings",  icon:"◎", label:"Settings" },
  ];

  const MOBILE_NAV = [
    { id:"dashboard", icon:"◉", label:"Home"    },
    { id:"add",       fab:true               },
    { id:"history",   icon:"≡",  label:"History" },
    { id:"import",    icon:"⬆",  label:"Import"  },
    { id:"markets",   icon:"📈", label:"Markets" },
    { id:"settings",  icon:"◎", label:"More"    },
  ];

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="app-shell">
        {/* Desktop Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="wordmark">◈ Finwise</div>
            <div className="tagline">Smart Finance Tracker</div>
          </div>

          {NAV.map(item => (
            <div key={item.id} className={`nav-item ${activeTab===item.id?"active":""}`}
              onClick={() => setActiveTab(item.id)}>
              <span className="ni">{item.icon}</span>{item.label}
            </div>
          ))}

          <div className="sidebar-spacer" />

          {/* Theme toggle */}
          <div style={{ padding:"0 8px 8px" }}>
            <div className="theme-row" onClick={() => setDarkMode(d => !d)}>
              <span className="theme-label">{darkMode ? "🌙 Dark" : "☀️ Light"}</span>
              <div className={`tt-track ${darkMode?"on":""}`}>
                <div className="tt-thumb" />
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="user-row">
              <div className="user-avatar">{(user?.email||user?.phoneNumber||"U")[0].toUpperCase()}</div>
              <div className="user-email">{user?.email || user?.phoneNumber}</div>
            </div>
            <button className="logout-btn" onClick={logout}>⎋ Sign Out</button>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="content">
            {activeTab === "dashboard" && (
              <Dashboard income={income} expense={expense} investment={investment} insurance={insurance}
                balance={balance} budget={budget} budgetProgress={budgetProgress} budgetColor={budgetColor}
                expPieData={expPieData} invPieData={invPieData} insPieData={insPieData} trendData={trendData}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
            )}
            {activeTab === "add" && (
              <AddForm amount={amount} setAmount={setAmount} type={type} setType={setType}
                category={category} setCategory={setCategory} note={note} setNote={setNote}
                date={date} setDate={setDate} editId={editId} onSubmit={submitTransaction} onCancel={cancelEdit} />
            )}
            {activeTab === "history" && (
              <History filtered={filtered} search={search} setSearch={setSearch}
                filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                filterType={filterType} setFilterType={setFilterType}
                onEdit={editExpense} onDelete={deleteExpense} onExport={exportCSV}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
            )}
            {activeTab === "import" && (
              <ImportPage onImport={importSingleRecord} showToast={showToast} />
            )}
            {activeTab === "markets" && <Markets />}
            {activeTab === "settings" && (
              <Settings budget={budget} budgetInput={budgetInput} setBudgetInput={setBudgetInput}
                onSaveBudget={() => { setBudget(budgetInput); showToast("✓ Budget saved"); }}
                darkMode={darkMode} setDarkMode={setDarkMode}
                user={user} logout={logout} />
            )}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          <div className="bnav-items">
            {MOBILE_NAV.map(item =>
              item.fab ? (
                <div key="add" className="bnav-item" onClick={() => setActiveTab("add")}>
                  <button className="bnav-fab">+</button>
                </div>
              ) : (
                <div key={item.id} className={`bnav-item ${activeTab===item.id?"active":""}`}
                  onClick={() => setActiveTab(item.id)}>
                  <span className="bnav-icon">{item.icon}</span>
                  {item.label}
                </div>
              )
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
