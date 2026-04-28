import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const toYYYYMM = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Rental Income",
  "Dividend",
  "Interest",
  "Bonus",
  "Pension",
  "Capital Gain",
  "Gift",
  "Other Income",
];
const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Utilities & Bills",
  "Healthcare",
  "Entertainment",
  "EMI / Loan",
  "Education",
  "Personal Care",
  "Subscriptions",
  "Home & Rent",
  "Groceries",
  "Fuel",
  "Clothing",
  "Travel",
  "Eating Out",
  "Other Expense",
];
const INVESTMENT_CATEGORIES = [
  "Stocks — NSE/BSE",
  "Mutual Fund — Equity",
  "Mutual Fund — Debt",
  "Mutual Fund — Hybrid",
  "Index Fund / ETF",
  "PPF",
  "EPF / PF",
  "NPS",
  "Fixed Deposit",
  "Recurring Deposit",
  "Bonds / Debentures",
  "Sovereign Gold Bond",
  "Gold / Silver Physical",
  "REIT / InvIT",
  "Real Estate",
  "Cryptocurrency",
  "ULIP",
  "Other Investment",
];
const INSURANCE_CATEGORIES = [
  "Term Life Insurance",
  "LIC Endowment",
  "LIC Money Back",
  "LIC Jeevan Anand",
  "ULIP Insurance",
  "Whole Life Insurance",
  "Health Insurance — Individual",
  "Health Insurance — Family",
  "Critical Illness Cover",
  "Personal Accident",
  "Car Insurance",
  "Two-Wheeler Insurance",
  "Home / Property Insurance",
  "Travel Insurance",
  "PLI (Postal Life Insurance)",
  "Rural PLI",
  "PMJJBY",
  "PMSBY",
  "Marine Insurance",
  "Fire Insurance",
  "Other Insurance",
];

const ALL_CATS = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
  insurance: INSURANCE_CATEGORIES,
};

const CATEGORY_ICONS = {
  Salary: "💼",
  Freelance: "💻",
  Business: "🏢",
  "Rental Income": "🏘️",
  Dividend: "💹",
  Interest: "🏦",
  Bonus: "🎯",
  Pension: "👴",
  "Capital Gain": "📈",
  Gift: "🎁",
  "Other Income": "✨",
  "Food & Dining": "🍽️",
  Transport: "🚌",
  Shopping: "🛍️",
  "Utilities & Bills": "📄",
  Healthcare: "💊",
  Entertainment: "🎬",
  "EMI / Loan": "🏠",
  Education: "📚",
  "Personal Care": "💆",
  Subscriptions: "📱",
  "Home & Rent": "🏡",
  Groceries: "🛒",
  Fuel: "⛽",
  Clothing: "👗",
  Travel: "✈️",
  "Eating Out": "🍜",
  "Other Expense": "📦",
  "Stocks — NSE/BSE": "📉",
  "Mutual Fund — Equity": "📈",
  "Mutual Fund — Debt": "📊",
  "Mutual Fund — Hybrid": "⚖️",
  "Index Fund / ETF": "🗂️",
  PPF: "🏛️",
  "EPF / PF": "🏢",
  NPS: "🪙",
  "Fixed Deposit": "🔒",
  "Recurring Deposit": "🔄",
  "Bonds / Debentures": "📋",
  "Sovereign Gold Bond": "🥇",
  "Gold / Silver Physical": "🏅",
  "REIT / InvIT": "🏗️",
  "Real Estate": "🏠",
  Cryptocurrency: "₿",
  ULIP: "💎",
  "Other Investment": "🧩",
  "Term Life Insurance": "🛡️",
  "LIC Endowment": "🏛️",
  "LIC Money Back": "💰",
  "LIC Jeevan Anand": "🌟",
  "ULIP Insurance": "💎",
  "Whole Life Insurance": "♾️",
  "Health Insurance — Individual": "👤",
  "Health Insurance — Family": "👨‍👩‍👧",
  "Critical Illness Cover": "🏥",
  "Personal Accident": "🩹",
  "Car Insurance": "🚗",
  "Two-Wheeler Insurance": "🏍️",
  "Home / Property Insurance": "🏡",
  "Travel Insurance": "🌍",
  "PLI (Postal Life Insurance)": "📮",
  "Rural PLI": "🌾",
  PMJJBY: "📜",
  PMSBY: "🛟",
  "Marine Insurance": "⚓",
  "Fire Insurance": "🔥",
  "Other Insurance": "📑",
};

const TYPE_META = {
  income: { color: "var(--income)", dim: "var(--income-dim)", label: "Income", icon: "📥", sign: "+" },
  expense: { color: "var(--expense)", dim: "var(--expense-dim)", label: "Expense", icon: "📤", sign: "-" },
  investment: { color: "var(--invest)", dim: "var(--invest-dim)", label: "Investment", icon: "📊", sign: "→" },
  insurance: { color: "var(--insure)", dim: "var(--insure-dim)", label: "Insurance", icon: "🛡️", sign: "→" },
};

const PIE_COLORS = ["#C8A96E", "#E8C870", "#A07850", "#D4B896", "#F0DEB4", "#8A6840"];
const INV_COLORS = ["#818CF8", "#A78BFA", "#C084FC", "#E879F9", "#F472B6", "#7DD3FC"];
const INS_COLORS = ["#FB923C", "#F97316", "#FDBA74", "#FED7AA", "#FCA5A5", "#FCD34D"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const VALID_TYPES = ["income", "expense", "investment", "insurance"];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#09090B;--surface:#0F0F13;--card:#17171D;--card2:#1C1C24;--card-hover:#1E1E26;
  --border:#24242E;--border-l:#32323E;--accent:#C8A96E;--accent-dim:rgba(200,169,110,.12);--accent-h:#D4BC8A;
  --income:#34D399;--income-dim:rgba(52,211,153,.12);--expense:#F87171;--expense-dim:rgba(248,113,113,.12);
  --invest:#818CF8;--invest-dim:rgba(129,140,248,.12);--insure:#FB923C;--insure-dim:rgba(251,146,60,.12);
  --text:#EEEAE4;--text2:#9A9590;--text3:#66615B;--shadow:0 8px 32px rgba(0,0,0,.35);--r:18px;--rx:10px
}
body.light{
  --bg:#F4F1EC;--surface:#FCFAF6;--card:#FFFFFF;--card2:#F7F3EC;--card-hover:#F2EEE7;
  --border:#E2DDD5;--border-l:#CCC7BE;--accent:#A07840;--accent-dim:rgba(160,120,64,.1);--accent-h:#8B6530;
  --income:#059669;--income-dim:rgba(5,150,105,.1);--expense:#DC2626;--expense-dim:rgba(220,38,38,.1);
  --invest:#4F46E5;--invest-dim:rgba(79,70,229,.1);--insure:#C2410C;--insure-dim:rgba(194,65,12,.1);
  --text:#1C1A17;--text2:#6B6560;--text3:#8A8279;--shadow:0 8px 24px rgba(0,0,0,.08)
}
html,body,#root{height:100%}
body{background:var(--bg);color:var(--text);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;transition:background .2s,color .2s}
input,select,button,textarea{font-family:'Outfit',sans-serif}
button{border:none}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:var(--border-l);border-radius:99px}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes toastIn{from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.app-shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:240px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:22px 0}
.sidebar-logo{padding:0 20px 18px;border-bottom:1px solid var(--border);margin-bottom:8px}
.wordmark{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--accent)}
.tagline{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.6px;margin-top:3px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:0 8px;border-radius:var(--rx);cursor:pointer;color:var(--text2);font-size:12.5px;font-weight:500;transition:all .18s;border:1px solid transparent}
.nav-item:hover{background:var(--card);color:var(--text)}
.nav-item.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,.24)}
.nav-item .ni{width:18px;text-align:center}
.sidebar-spacer{flex:1}
.sidebar-footer{padding:14px 8px 0;border-top:1px solid var(--border)}
.user-row{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px}
.user-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--accent-dim);border:1px solid var(--accent);color:var(--accent);font-weight:700;flex-shrink:0}
.user-email{font-size:10.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logout-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 12px;background:none;border:1px solid var(--border);border-radius:var(--rx);color:var(--text2);font-size:11.5px;font-weight:500;cursor:pointer;transition:all .18s}
.logout-btn:hover{color:var(--expense);border-color:rgba(248,113,113,.4);background:var(--expense-dim)}
.main{flex:1;overflow-y:auto;background:var(--bg)}
.content{padding:28px 30px 90px;max-width:1180px;margin:0 auto;animation:fadeIn .28s ease}
.page-header{margin-bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.page-header h1{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700}
.page-header p{font-size:12px;color:var(--text3);margin-top:2px}
.month-strip,.filter-strip{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px}
.month-strip{margin-bottom:18px}
.month-chip,.filter-chip,.pill,.mini-btn{padding:6px 13px;border-radius:999px;font-size:11px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;white-space:nowrap;transition:all .16s}
.month-chip:hover,.filter-chip:hover,.pill:hover,.mini-btn:hover{border-color:var(--border-l);color:var(--text)}
.month-chip.active,.filter-chip.active,.pill.active{background:var(--accent-dim);border-color:rgba(200,169,110,.32);color:var(--accent)}
.summary-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;margin-bottom:14px}
.summary-card,.chart-card,.form-card,.settings-section,.section-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow)}
.summary-card{padding:16px 18px;transition:all .18s}
.summary-card:hover,.chart-card:hover,.section-card:hover{border-color:var(--border-l);transform:translateY(-1px)}
.summary-span-4{grid-column:span 4}.summary-span-3{grid-column:span 3}.summary-span-6{grid-column:span 6}.summary-span-12{grid-column:span 12}
.sc-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:7px}
.sc-value{font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:700;line-height:1.05}
.sc-sub{font-size:10.5px;color:var(--text3);margin-top:6px;line-height:1.45}
.budget-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:17px 18px;margin-bottom:16px;box-shadow:var(--shadow)}
.budget-header,.split-row,.tx-toolbar,.section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.budget-track,.progress-track{height:7px;background:var(--border);border-radius:999px;overflow:hidden}
.budget-fill,.progress-fill{height:100%;border-radius:999px}
.charts-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;margin-bottom:16px}
.chart-span-7{grid-column:span 7}.chart-span-5{grid-column:span 5}.chart-span-6{grid-column:span 6}.chart-span-12{grid-column:span 12}
.chart-card{padding:18px}
.chart-title{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:14px}
.pie-row{display:flex;align-items:center;gap:12px}
.pie-legend{display:flex;flex-direction:column;gap:7px;flex:1}
.pie-legend-item{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text2)}
.pie-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.pie-legend-val{margin-left:auto;font-weight:600;white-space:nowrap}
.two-col{display:grid;grid-template-columns:1.2fr .8fr;gap:12px}
.insight-list{display:grid;gap:10px}
.insight-item,.alert-item,.net-item,.goal-card,.tx-item,.table-row{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 14px}
.insight-item strong,.alert-item strong,.goal-card strong{display:block;font-size:12.5px;color:var(--text);margin-bottom:4px}
.insight-item p,.alert-item p,.goal-card p,.muted{font-size:11.5px;color:var(--text3);line-height:1.55}
.alert-item.warn{border-color:rgba(248,113,113,.28)}.alert-item.info{border-color:rgba(200,169,110,.28)}.alert-item.good{border-color:rgba(52,211,153,.28)}
.mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.mini-card{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px}
.mini-card .v{font-size:20px;font-family:'Cormorant Garamond',serif;font-weight:700}
.mini-card .k{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:5px}
.form-card{padding:24px}
.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.fg{display:flex;flex-direction:column;gap:6px}
.fg.full{grid-column:1/-1}
.fl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;color:var(--text3)}
.fi,.fs,.setting-input,.search-input,.stock-input,textarea{background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:11px 12px;color:var(--text);font-size:13px;outline:none;transition:border-color .18s,box-shadow .18s;width:100%}
textarea{min-height:92px;resize:vertical}
.fi:focus,.fs:focus,.setting-input:focus,.search-input:focus,.stock-input:focus,textarea:focus{border-color:rgba(200,169,110,.46);box-shadow:0 0 0 3px rgba(200,169,110,.07)}
.fi::placeholder,.search-input::placeholder,textarea::placeholder{color:var(--text3)}
.fs{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%235A5A5A' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:30px}
.type-toggle{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);border-radius:var(--rx);overflow:hidden}
.type-btn{padding:11px 6px;background:var(--surface);color:var(--text3);font-size:11.5px;cursor:pointer;transition:all .16s}
.type-btn.active.expense{background:var(--expense-dim);color:var(--expense)}
.type-btn.active.income{background:var(--income-dim);color:var(--income)}
.type-btn.active.investment{background:var(--invest-dim);color:var(--invest)}
.type-btn.active.insurance{background:var(--insure-dim);color:var(--insure)}
.btn-primary,.btn-secondary,.btn-save,.danger-btn,.icon-btn{border-radius:var(--rx);padding:11px 16px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .18s}
.btn-primary,.btn-save{background:var(--accent);color:#fff}
.btn-primary:hover,.btn-save:hover{background:var(--accent-h);transform:translateY(-1px)}
.btn-secondary,.icon-btn{background:none;border:1px solid var(--border);color:var(--text2)}
.btn-secondary:hover,.icon-btn:hover{border-color:var(--border-l);color:var(--text)}
.danger-btn{background:none;border:1px solid rgba(248,113,113,.35);color:var(--expense)}
.danger-btn:hover{background:var(--expense-dim)}
.search-wrap{position:relative;min-width:180px}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text3)}
.search-input{padding-left:30px;border-radius:999px}
.tx-list,.stack{display:grid;gap:8px}
.tx-item{display:flex;align-items:center;gap:12px}
.tx-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.tx-icon.expense{background:var(--expense-dim)}.tx-icon.income{background:var(--income-dim)}.tx-icon.investment{background:var(--invest-dim)}.tx-icon.insurance{background:var(--insure-dim)}
.tx-info{flex:1;min-width:0}
.tx-cat{font-size:12.5px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tx-note{font-size:10.5px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tx-badge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.tx-badge.expense{background:var(--expense-dim);color:var(--expense)}.tx-badge.income{background:var(--income-dim);color:var(--income)}.tx-badge.investment{background:var(--invest-dim);color:var(--invest)}.tx-badge.insurance{background:var(--insure-dim);color:var(--insure)}.tx-badge.recurring{background:var(--accent-dim);color:var(--accent)}
.tx-actions{display:flex;gap:6px;opacity:0;transition:opacity .16s}
.tx-item:hover .tx-actions{opacity:1}
.tx-btn{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 9px;font-size:10px;font-weight:600;cursor:pointer;color:var(--text2)}
.tx-btn.del:hover{color:var(--expense);border-color:rgba(248,113,113,.4);background:var(--expense-dim)}
.tx-meta{text-align:right;flex-shrink:0}
.tx-amount{font-size:13px;font-weight:600}
.tx-date{font-size:9.5px;color:var(--text3);margin-top:2px}
.empty-state{text-align:center;padding:42px 20px;color:var(--text3)}
.empty-state .es-icon{font-size:34px;margin-bottom:10px}
.import-zone{border:2px dashed var(--border);border-radius:var(--r);padding:40px 24px;text-align:center;background:var(--card);cursor:pointer;transition:all .18s}
.import-zone:hover,.import-zone.drag{border-color:var(--accent);background:var(--accent-dim)}
.settings-section,.section-card{padding:20px;margin-bottom:12px}
.settings-section h3,.section-card h3{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px}
.settings-section p{font-size:11.5px;color:var(--text3);line-height:1.55;margin-bottom:14px}
.setting-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.theme-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin:0 8px 6px;border-radius:var(--rx);border:1px solid var(--border);cursor:pointer}
.tt-track{width:34px;height:18px;border-radius:999px;background:var(--border-l);position:relative;transition:background .2s;flex-shrink:0}
.tt-track.on{background:var(--accent)}.tt-thumb{width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s}.tt-track.on .tt-thumb{left:18px}
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);z-index:200;padding-bottom:env(safe-area-inset-bottom,0)}
.bnav-items{display:flex;justify-content:space-around}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;color:var(--text3);font-size:8px;font-weight:600;text-transform:uppercase;cursor:pointer;flex:1}
.bnav-item.active{color:var(--accent)}.bnav-icon{font-size:16px}.bnav-fab{background:var(--accent);width:42px;height:42px;border-radius:50%;color:#fff;box-shadow:0 8px 22px rgba(200,169,110,.35);margin-top:-11px;cursor:pointer}
.toast{position:fixed;top:20px;right:20px;background:var(--card2);border:1px solid var(--border);border-radius:var(--rx);padding:10px 16px;font-size:12.5px;z-index:9999;animation:toastIn .28s ease;box-shadow:0 10px 40px rgba(0,0,0,.4);max-width:360px}
.toast.success{border-color:rgba(52,211,153,.4);color:var(--income)}.toast.error{border-color:rgba(248,113,113,.4);color:var(--expense)}.toast.warning{border-color:rgba(200,169,110,.4);color:var(--accent)}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:hidden}
.login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(200,169,110,.08) 0%,transparent 70%)}
.login-card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px;animation:slideUp .4s ease;position:relative;z-index:1;box-shadow:var(--shadow)}
.login-logo{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:var(--accent);text-align:center;margin-bottom:3px}
.login-tagline{font-size:11.5px;color:var(--text3);text-align:center;margin-bottom:22px}
.tab2{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;margin-bottom:16px}
.tab2-btn{padding:8px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text3);background:none}
.tab2-btn.active{background:var(--card);color:var(--text)}
.auth-error,.auth-ok{border-radius:var(--rx);padding:9px 13px;font-size:11.5px;margin-bottom:13px}
.auth-error{background:var(--expense-dim);border:1px solid rgba(248,113,113,.3);color:var(--expense)}
.auth-ok{background:var(--income-dim);border:1px solid rgba(52,211,153,.3);color:var(--income)}
.google-btn{width:100%;padding:11px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer;margin-top:9px}
.divider{display:flex;align-items:center;gap:9px;margin:12px 0;color:var(--text3);font-size:10.5px}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}
.forgot-link,.resend-link{font-size:11px;color:var(--accent);cursor:pointer;display:block}
.forgot-link{text-align:right;margin-top:-4px;margin-bottom:10px}
.otp-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:14px;color:var(--text);font-size:22px;font-weight:700;text-align:center;letter-spacing:6px;margin-bottom:14px}
.phone-row{display:flex;margin-bottom:14px}.phone-pre{background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:var(--rx) 0 0 var(--rx);padding:10px 12px;color:var(--text2);display:flex;align-items:center}.phone-inp{flex:1;background:var(--surface);border:1px solid var(--border);border-left:none;border-radius:0 var(--rx) var(--rx) 0;padding:10px 12px;color:var(--text);outline:none}
.heat-grid{display:grid;gap:7px}.heat-row{display:grid;grid-template-columns:140px repeat(6,1fr);gap:7px;align-items:center}.heat-cell{height:32px;border-radius:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text2)}
.stat-line{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--text2);padding:8px 0;border-bottom:1px solid var(--border)}
.stat-line:last-child{border-bottom:none}
@media(max-width:900px){
  .summary-span-4,.summary-span-3,.summary-span-6,.chart-span-7,.chart-span-5,.chart-span-6{grid-column:span 12}
  .two-col,.mini-grid,.heat-row{grid-template-columns:1fr}
}
@media(max-width:768px){
  .sidebar{display:none}.bottom-nav{display:block}.content{padding:16px 14px 92px}
  .summary-grid,.charts-grid,.form-grid{grid-template-columns:1fr}
  .summary-span-4,.summary-span-3,.summary-span-6,.summary-span-12,.chart-span-7,.chart-span-5,.chart-span-6,.chart-span-12{grid-column:span 1}
  .type-toggle{grid-template-columns:1fr 1fr}.pie-row{flex-direction:column}
  .tx-actions{opacity:1}.toast{top:auto;bottom:84px;right:12px;left:12px}
}
`;

const fmtINR = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const safeJSON = (v, fallback) => {
  try {
    return JSON.parse(v ?? "");
  } catch {
    return fallback;
  }
};

function normalizeDate(raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const mdy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

function parseCSV(text) {
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
      } else cur += c;
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = lines.slice(1).filter(Boolean).map(parseRow);
  return { headers, rows };
}

function autoMapColumns(headers) {
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

const getMonthRange = (count) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (count - 1 - i));
    return toYYYYMM(d);
  });

const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`;
};

const sumByType = (items, type) =>
  items.filter((t) => t.type === type).reduce((acc, t) => acc + Number(t.amount || 0), 0);

const buildPie = (items, type) => {
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

const getStorageKey = (uid, key) => `finwise-${key}-${uid || "guest"}`;

const buildHeuristicReport = ({
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
  if (top2) opportunities.push(`${top2.name} is the second largest drain. A 10% trim would free up ${fmtINR(top2.value * 0.1)}.`);
  if (momExpenseDelta > 12) opportunities.push(`Month-over-month expenses are up ${momExpenseDelta.toFixed(1)}%. Review recent lifestyle inflation before it hardens.`);
  if (recurringOutflow > 0) opportunities.push(`Recurring bills currently consume ${fmtINR(recurringOutflow)} monthly. Audit auto-debits and duplicate subscriptions.`);
  if (!opportunities.length) opportunities.push("Your spending mix is balanced. Keep reinforcing the current discipline with category caps.");

  if (savingsRate < 15) tips.push("Savings rate is below 15%. Start by automating a transfer on salary day before discretionary spends happen.");
  else if (savingsRate < 30) tips.push("Savings rate is healthy. Redirect part of annual bonuses and tax refunds into long-term assets.");
  else tips.push("Savings rate is strong. Consider laddering surplus into emergency cash, retirement, and diversified growth assets.");

  if (income > 0 && investment < income * 0.15) tips.push("Investment contributions are still light relative to income. A SIP target of 15-20% of income would materially improve compounding.");
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
          ? "Start with core index funds / diversified mutual funds and automate a monthly SIP."
          : investment < income * 0.2
            ? "Layer tax-efficient retirement buckets like PPF, NPS, or EPF top-ups alongside market exposure."
            : "You have room to refine allocation across emergency reserve, tax-efficient retirement, and long-term growth assets.",
    ],
    tips,
  };
};

async function runExternalAI(config, context) {
  const prompt = `You are a personal finance analyst. Analyze this structured data and return concise, actionable recommendations with sections: Overview, Risks, Savings Opportunities, Investments, Insurance, and Next Actions.\n\n${JSON.stringify(
    context,
    null,
    2
  )}`;

  if (config.provider === "anthropic" && config.apiKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || "claude-3-5-haiku-latest",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "Anthropic request failed");
    return data?.content?.map((x) => x.text).join("\n\n") || "";
  }

  if (config.provider === "openrouter" && config.apiKey) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.freeModel || "meta-llama/llama-3.3-8b-instruct:free",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "OpenRouter request failed");
    return data?.choices?.[0]?.message?.content || "";
  }

  return "";
}

function exportPdfReport({ title, sections }) {
  const html = `<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111}
    h1{font-size:28px;margin:0 0 6px}
    h2{font-size:16px;margin:24px 0 8px}
    p,li{font-size:13px;line-height:1.6;color:#333}
    ul{padding-left:18px}
    .meta{color:#666;font-size:12px;margin-bottom:18px}
  </style></head><body>
    <h1>${title}</h1>
    <div class="meta">Generated on ${new Date().toLocaleString()}</div>
    ${sections
      .map(
        (s) =>
          `<h2>${s.title}</h2>${Array.isArray(s.body) ? `<ul>${s.body.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p>${s.body}</p>`}`
      )
      .join("")}
  </body></html>`;
  const w = window.open("", "_blank", "width=1080,height=860");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}

const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C1C24", border: "1px solid #32323E", borderRadius: 10, padding: "8px 11px", fontSize: 11 }}>
      <div style={{ color: "#9A9590", marginBottom: 2 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color || "#EEEAE4", fontWeight: 600 }}>
          {p.name}: {fmtINR(Number(p.value || 0))}
        </div>
      ))}
    </div>
  );
};

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C1C24", border: "1px solid #32323E", borderRadius: 10, padding: "8px 11px", fontSize: 11 }}>
      <div style={{ color: "#EEEAE4", fontWeight: 600 }}>{payload[0].name}</div>
      <div style={{ color: "#C8A96E" }}>{fmtINR(payload[0].value)}</div>
    </div>
  );
};

function MonthStrip({ months, selectedMonth, setSelectedMonth }) {
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

function LoginPage({ onLogin, onSignup, onGoogle }) {
  const [authTab, setAuthTab] = useState("email");
  const [signTab, setSignTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [conf, setConf] = useState(null);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const handleEmail = async () => {
    if (!email || !password) return;
    setErr("");
    setLoading(true);
    try {
      if (signTab === "signin") await onLogin(email, password);
      else await onSignup(email, password);
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!resetEmail) return;
    setErr("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setOk("Reset link sent. Check your inbox.");
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      setErr("Enter a valid 10-digit number");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      if (window._rcv) {
        window._rcv.clear();
        window._rcv = null;
      }
      window._rcv = new RecaptchaVerifier(auth, "rcv-container", { size: "invisible" });
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, window._rcv);
      setConf(result);
      setStep("otp");
      setOk(`OTP sent to +91-${phone}`);
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length < 4) {
      setErr("Enter the OTP");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await conf.confirm(otp);
    } catch {
      setErr("Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (forgot) {
    return (
      <div className="login-page">
        <div className="login-bg" />
        <div className="login-card">
          <div className="login-logo">◈ Finwise</div>
          <div className="login-tagline">Reset your password</div>
          {err && <div className="auth-error">{err}</div>}
          {ok && <div className="auth-ok">{ok}</div>}
          {!ok && (
            <>
              <div className="fg" style={{ marginBottom: 14 }}>
                <label className="fl">Email</label>
                <input
                  className="fi"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={handleForgot} disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </>
          )}
          <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => {
            setForgot(false);
            setErr("");
            setOk("");
          }}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div id="rcv-container" />
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Premium personal finance command center</div>
        <div className="tab2">
          <button className={`tab2-btn ${authTab === "email" ? "active" : ""}`} onClick={() => setAuthTab("email")}>
            Email
          </button>
          <button className={`tab2-btn ${authTab === "phone" ? "active" : ""}`} onClick={() => setAuthTab("phone")}>
            Mobile OTP
          </button>
        </div>
        {err && <div className="auth-error">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}
        {authTab === "email" ? (
          <>
            <div className="tab2" style={{ marginBottom: 16 }}>
              <button className={`tab2-btn ${signTab === "signin" ? "active" : ""}`} onClick={() => setSignTab("signin")}>
                Sign In
              </button>
              <button className={`tab2-btn ${signTab === "signup" ? "active" : ""}`} onClick={() => setSignTab("signup")}>
                Sign Up
              </button>
            </div>
            <div className="fg" style={{ marginBottom: 12 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="fg" style={{ marginBottom: 4 }}>
              <label className="fl">Password</label>
              <input
                className="fi"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
              />
            </div>
            {signTab === "signin" && <span className="forgot-link" onClick={() => setForgot(true)}>Forgot password?</span>}
            <button className="btn-primary" onClick={handleEmail} disabled={loading}>
              {loading ? "Please wait…" : signTab === "signin" ? "Sign In" : "Create Account"}
            </button>
            <div className="divider">or</div>
            <button className="google-btn" onClick={onGoogle}>Continue with Google</button>
          </>
        ) : step === "phone" ? (
          <>
            <div className="fg" style={{ marginBottom: 14 }}>
              <label className="fl">Mobile Number (India +91)</label>
              <div className="phone-row">
                <div className="phone-pre">+91</div>
                <input
                  className="phone-inp"
                  type="tel"
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={sendOTP} disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>Enter the 6-digit OTP sent to +91-{phone}</p>
            <input
              className="otp-input"
              type="tel"
              maxLength={6}
              placeholder="------"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn-primary" onClick={verifyOTP} disabled={loading}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
            <span className="resend-link" style={{ marginTop: 8, textAlign: "center" }} onClick={() => setStep("phone")}>
              Change number / Resend
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({
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
}) {
  const balanceTone = totals.balance >= 0 ? "var(--income)" : "var(--expense)";
  const savingsColor = totals.savingsRate >= 20 ? "var(--income)" : totals.savingsRate >= 10 ? "var(--accent)" : "var(--expense)";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{selectedMonth === "all" ? "Full financial system view" : `Monthly command center — ${selectedMonth}`}</p>
        </div>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="summary-grid">
        <div className="summary-card summary-span-6">
          <div className="sc-label">Net Cash Position</div>
          <div className="sc-value" style={{ color: balanceTone }}>
            {totals.balance >= 0 ? fmtINR(totals.balance) : `-${fmtINR(Math.abs(totals.balance))}`}
          </div>
          <div className="sc-sub">Income minus expenses, investments, and insurance in the selected period.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Savings Rate</div>
          <div className="sc-value" style={{ color: savingsColor }}>{totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}</div>
          <div className="sc-sub">Savings after expense only, before investing decisions.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Net Worth</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">Cash reserve + investments + manual assets - liabilities.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Income</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(totals.income)}</div>
          <div className="sc-sub">Total inflow recorded.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Expenses</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{fmtINR(totals.expense)}</div>
          <div className="sc-sub">Core lifestyle and operational outflow.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Investments</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(totals.investment)}</div>
          <div className="sc-sub">Capital deployed toward future growth.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Insurance</div>
          <div className="sc-value" style={{ color: "var(--insure)" }}>{fmtINR(totals.insurance)}</div>
          <div className="sc-sub">Protection outflow and risk cover spend.</div>
        </div>
      </div>

      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="sc-label" style={{ marginBottom: 0 }}>Expense Budget</span>
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
          <div className="chart-title">12-Month Cash Flow</div>
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
          <div className="chart-title">Expense Mix</div>
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
          <div className="chart-title">Attention Center</div>
          <div className="insight-list">
            {alerts.length ? alerts.map((alert, idx) => (
              <div key={idx} className={`alert-item ${alert.tone || "info"}`}>
                <strong>{alert.title}</strong>
                <p>{alert.body}</p>
              </div>
            )) : (
              <div className="alert-item good">
                <strong>Everything looks steady</strong>
                <p>No immediate budget, anomaly, or liquidity warnings from the current data.</p>
              </div>
            )}
          </div>
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">Quick Diagnostics</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">Top Expense</div>
              <div className="v">{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
              <div className="muted">{topCategories[0]?.name || "No spend yet"}</div>
            </div>
            <div className="mini-card">
              <div className="k">Recurring Outflow</div>
              <div className="v" style={{ color: "var(--accent)" }}>{fmtINR(recurringOutflow)}</div>
              <div className="muted">Bills, EMIs, and subscriptions flagged recurring.</div>
            </div>
            <div className="mini-card">
              <div className="k">Unusual Spend</div>
              <div className="v" style={{ color: unusualTransactions.length ? "var(--expense)" : "var(--income)" }}>{unusualTransactions.length}</div>
              <div className="muted">{unusualTransactions.length ? "Needs review" : "Nothing flagged"}</div>
            </div>
          </div>
          {(invPieData.length > 0 || insPieData.length > 0) && (
            <div className="two-col" style={{ marginTop: 14 }}>
              {invPieData.length > 0 && (
                <div className="section-card" style={{ marginBottom: 0 }}>
                  <div className="chart-title" style={{ color: "var(--invest)" }}>Investment Allocation</div>
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
                  <div className="chart-title" style={{ color: "var(--insure)" }}>Insurance Load</div>
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

function AddForm({
  amount,
  setAmount,
  type,
  setType,
  category,
  setCategory,
  note,
  setNote,
  date,
  setDate,
  editId,
  onSubmit,
  onCancel,
  recurring,
  setRecurring,
  recurringFrequency,
  setRecurringFrequency,
}) {
  const getCats = (t) => ALL_CATS[t] || EXPENSE_CATEGORIES;
  const getDef = (t) =>
    t === "income"
      ? "Salary"
      : t === "investment"
        ? "Stocks — NSE/BSE"
        : t === "insurance"
          ? "Term Life Insurance"
          : "Food & Dining";

  const changeType = (t) => {
    setType(t);
    setCategory(getDef(t));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>Track income, expenses, investments, insurance, and recurring cash movements.</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="fg full">
            <label className="fl">Type</label>
            <div className="type-toggle">
              {VALID_TYPES.map((t) => (
                <button key={t} className={`type-btn ${type === t ? `active ${t}` : ""}`} onClick={() => changeType(t)}>
                  {TYPE_META[t].icon} {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="fl">Amount (₹)</label>
            <input className="fi" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Category</label>
            <select className="fs" value={category} onChange={(e) => setCategory(e.target.value)}>
              {getCats(type).map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c] || "•"} {c}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Date</label>
            <input className="fi" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Recurring</label>
            <select className="fs" value={recurring ? recurringFrequency : "one-time"} onChange={(e) => {
              if (e.target.value === "one-time") {
                setRecurring(false);
                setRecurringFrequency("monthly");
              } else {
                setRecurring(true);
                setRecurringFrequency(e.target.value);
              }
            }}>
              <option value="one-time">One-time transaction</option>
              <option value="monthly">Monthly recurring</option>
              <option value="quarterly">Quarterly recurring</option>
              <option value="yearly">Yearly recurring</option>
            </select>
          </div>
          <div className="fg full">
            <label className="fl">Note</label>
            <textarea placeholder="Merchant, purpose, policy number, investment note, or any context." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="fg full" style={{ marginTop: 4 }}>
            <button className="btn-primary" onClick={onSubmit}>{editId ? "Update Transaction" : "Add Transaction"}</button>
            {editId && <button className="btn-secondary" style={{ marginTop: 10 }} onClick={onCancel}>Cancel Edit</button>}
          </div>
        </div>
      </div>
    </>
  );
}

function History({
  filtered,
  search,
  setSearch,
  filterCategory,
  setFilterCategory,
  filterType,
  setFilterType,
  recurringOnly,
  setRecurringOnly,
  onEdit,
  onDelete,
  onExport,
  months,
  selectedMonth,
  setSelectedMonth,
}) {
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES, ...INSURANCE_CATEGORIES];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>{filtered.length} record{filtered.length !== 1 ? "s" : ""} in the current view</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="icon-btn" onClick={onExport}>Export CSV</button>
        </div>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...VALID_TYPES].map((t) => (
            <button key={t} className={`filter-chip ${filterType === t ? "active" : ""}`} onClick={() => setFilterType(t)}>
              {t === "all" ? "All" : `${TYPE_META[t].icon} ${TYPE_META[t].label}`}
            </button>
          ))}
          <button className={`filter-chip ${recurringOnly ? "active" : ""}`} onClick={() => setRecurringOnly((v) => !v)}>
            Recurring Only
          </button>
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search note, category, amount…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filter-strip" style={{ marginBottom: 12 }}>
        <button className={`filter-chip ${!filterCategory ? "active" : ""}`} onClick={() => setFilterCategory("")}>All Categories</button>
        {allCats.map((c) => (
          <button key={c} className={`filter-chip ${filterCategory === c ? "active" : ""}`} onClick={() => setFilterCategory(filterCategory === c ? "" : c)}>
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {!filtered.length ? (
          <div className="empty-state">
            <div className="es-icon">📭</div>
            <p>No transactions match these filters yet.</p>
          </div>
        ) : filtered.map((e) => (
          <div key={e.id} className="tx-item">
            <div className={`tx-icon ${e.type}`}>{CATEGORY_ICONS[e.category] || "💸"}</div>
            <div className="tx-info">
              <div className="tx-cat">
                {e.category}
                <span className={`tx-badge ${e.type}`}>{TYPE_META[e.type]?.label || e.type}</span>
                {e.recurring && <span className="tx-badge recurring">{e.recurringFrequency || "monthly"}</span>}
              </div>
              <div className="tx-note">{e.note || "No note"}</div>
            </div>
            <div className="tx-actions">
              <button className="tx-btn" onClick={() => onEdit(e)}>Edit</button>
              <button className="tx-btn del" onClick={() => onDelete(e.id)}>Delete</button>
            </div>
            <div className="tx-meta">
              <div className="tx-amount" style={{ color: TYPE_META[e.type]?.color }}>{TYPE_META[e.type]?.sign || ""}{fmtINR(e.amount)}</div>
              <div className="tx-date">{e.date}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ImportPage({ onImport, showToast }) {
  const [step, setStep] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [colMap, setColMap] = useState({ date: -1, type: -1, category: -1, amount: -1, note: -1 });
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) {
        showToast("Could not parse CSV.", "error");
        return;
      }
      setCsvData({ headers, rows });
      setColMap(autoMapColumns(headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const result = [];
    const errs = [];
    csvData.rows.forEach((row, i) => {
      const rawDate = colMap.date >= 0 ? row[colMap.date] : "";
      const rawType = colMap.type >= 0 ? row[colMap.type]?.toLowerCase().trim() : "expense";
      const rawCat = colMap.category >= 0 ? row[colMap.category]?.trim() : "";
      const rawAmt = colMap.amount >= 0 ? row[colMap.amount] : "0";
      const rawNote = colMap.note >= 0 ? row[colMap.note] : "";
      const date = normalizeDate(rawDate);
      const amount = parseFloat((rawAmt || "0").replace(/[^0-9.]/g, ""));
      const type = VALID_TYPES.includes(rawType) ? rawType : "expense";
      const known = ALL_CATS[type] || EXPENSE_CATEGORIES;
      const category = known.find((c) => c.toLowerCase() === rawCat.toLowerCase()) || known[0];
      const rowErrs = [];
      if (!date) rowErrs.push("invalid date");
      if (Number.isNaN(amount) || amount <= 0) rowErrs.push("invalid amount");
      if (rowErrs.length) errs.push(`Row ${i + 2}: ${rowErrs.join(", ")}`);
      result.push({
        date: date || toLocalDateStr(new Date()),
        type,
        category,
        amount: Number.isNaN(amount) ? 0 : amount,
        note: rawNote,
        valid: !rowErrs.length,
      });
    });
    setParsed(result);
    setErrors(errs);
    setStep("preview");
  };

  const runImport = async () => {
    setStep("importing");
    const valid = parsed.filter((r) => r.valid);
    let done = 0;
    for (const rec of valid) {
      await onImport(rec);
      done += 1;
      setImported(done);
      setProgress(Math.round((done / valid.length) * 100));
    }
    setStep("done");
    showToast(`Imported ${done} transaction${done !== 1 ? "s" : ""}.`);
  };

  const reset = () => {
    setStep("upload");
    setCsvData(null);
    setParsed([]);
    setErrors([]);
    setProgress(0);
    setImported(0);
  };

  const validCount = parsed.filter((r) => r.valid).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Import Transactions</h1>
          <p>Bulk upload your historic data from CSV.</p>
        </div>
        {step !== "upload" && <button className="icon-btn" onClick={reset}>Start Over</button>}
      </div>

      {step === "upload" && (
        <>
          <div
            className={`import-zone${drag ? " drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
            <div style={{ fontSize: 34, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Drop a CSV here</div>
            <div className="muted">or click to browse</div>
          </div>
          <div className="section-card">
            <h3>Expected Format</h3>
            <p>Date, Type, Category, Amount, Note</p>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text2)", background: "var(--surface)", padding: "12px 13px", borderRadius: 12, lineHeight: 1.8 }}>
              Date,Type,Category,Amount,Note<br />
              2026-04-15,expense,Food &amp; Dining,450,Lunch<br />
              2026-04-16,income,Salary,75000,April salary<br />
              2026-04-17,investment,PPF,5000,Monthly PPF<br />
              2026-04-18,insurance,Term Life Insurance,1200,Premium
            </div>
          </div>
        </>
      )}

      {step === "map" && csvData && (
        <div className="section-card">
          <h3>Map Columns</h3>
          <p>{csvData.rows.length} rows found. Match each CSV column to the right field.</p>
          <div className="form-grid">
            {Object.keys(colMap).map((field) => (
              <div key={field} className="fg">
                <label className="fl">{field}</label>
                <select className="fs" value={colMap[field]} onChange={(e) => setColMap((prev) => ({ ...prev, [field]: parseInt(e.target.value, 10) }))}>
                  <option value={-1}>Skip</option>
                  {csvData.headers.map((h, i) => <option key={i} value={i}>{h} (col {i + 1})</option>)}
                </select>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={buildPreview}>Preview Import</button>
        </div>
      )}

      {step === "preview" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="pill active">Valid: {validCount}</span>
            {errors.length > 0 && <span className="pill" style={{ color: "var(--expense)", borderColor: "rgba(248,113,113,.3)" }}>Skipped: {errors.length}</span>}
          </div>
          {errors.length > 0 && (
            <div className="section-card">
              <h3>Import Warnings</h3>
              <p>{errors.slice(0, 5).join(" | ")}{errors.length > 5 ? ` and ${errors.length - 5} more.` : ""}</p>
            </div>
          )}
          <div className="stack">
            {parsed.slice(0, 15).map((r, i) => (
              <div key={i} className="table-row" style={{ opacity: r.valid ? 1 : 0.45 }}>
                <div className="split-row">
                  <strong>{r.valid ? "Valid" : "Skip"}</strong>
                  <span style={{ color: TYPE_META[r.type]?.color }}>{TYPE_META[r.type]?.label}</span>
                </div>
                <p>{r.date} • {r.category} • {fmtINR(r.amount)} • {r.note || "No note"}</p>
              </div>
            ))}
          </div>
          {validCount > 0 && <button className="btn-primary" style={{ marginTop: 14 }} onClick={runImport}>Import {validCount} Transactions</button>}
        </>
      )}

      {step === "importing" && (
        <div className="section-card" style={{ textAlign: "center" }}>
          <h3>Importing</h3>
          <p>{imported} / {validCount} completed</p>
          <div className="progress-track" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${progress}%`, background: "var(--accent)" }} />
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="section-card" style={{ textAlign: "center" }}>
          <h3>Import Complete</h3>
          <p>{imported} transactions imported successfully.</p>
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={reset}>Import More</button>
        </div>
      )}
    </>
  );
}

function AIInsights({
  report,
  aiState,
  onGenerate,
  aiConfig,
  topCategories,
  unusualTransactions,
  totals,
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Insights</h1>
          <p>Personalized financial intelligence powered by your transaction graph.</p>
        </div>
        <button className="btn-primary" onClick={onGenerate} disabled={aiState.loading}>
          {aiState.loading ? "Analyzing…" : "Refresh Insights"}
        </button>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-4">
          <div className="sc-label">AI Mode</div>
          <div className="sc-value" style={{ fontSize: 20 }}>
            {aiConfig.apiKey ? (aiConfig.provider === "anthropic" ? "Claude" : "Free Model") : "On-device"}
          </div>
          <div className="sc-sub">{aiConfig.apiKey ? "External model connected through Settings." : "Heuristic insights run locally without an API key."}</div>
        </div>
        <div className="summary-card summary-span-4">
          <div className="sc-label">Top Spend Bucket</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
          <div className="sc-sub">{topCategories[0]?.name || "No expense data yet"}</div>
        </div>
        <div className="summary-card summary-span-4">
          <div className="sc-label">Savings Rate</div>
          <div className="sc-value" style={{ color: totals.savingsRate >= 20 ? "var(--income)" : "var(--accent)" }}>
            {totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}
          </div>
          <div className="sc-sub">Used for savings, investment, and risk recommendations.</div>
        </div>
      </div>

      {aiState.error && <div className="alert-item warn" style={{ marginBottom: 12 }}><strong>AI request issue</strong><p>{aiState.error}</p></div>}

      {report ? (
        <div className="two-col">
          <div className="stack">
            <div className="section-card">
              <h3>Overview</h3>
              <p style={{ marginBottom: 12 }}>{report.headline}</p>
              <div className="stack">
                {report.summary.map((line) => <div key={line} className="stat-line"><span>{line}</span></div>)}
              </div>
            </div>

            <div className="section-card">
              <h3>Savings Opportunities</h3>
              <div className="insight-list">
                {report.opportunities.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>Opportunity</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card">
              <h3>Next Best Moves</h3>
              <div className="insight-list">
                {report.tips.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>Action</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="section-card">
              <h3>Anomaly Watch</h3>
              {report.anomalies.length ? (
                <div className="insight-list">
                  {report.anomalies.map((item) => (
                    <div key={item} className="alert-item warn">
                      <strong>Unusual Spend</strong>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No unusual transactions were flagged in the current scan.</p>
              )}
            </div>

            <div className="section-card">
              <h3>Investment Guidance</h3>
              <div className="insight-list">
                {report.investmentIdeas.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>Portfolio Nudge</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {!!aiState.externalText && (
              <div className="section-card">
                <h3>Model Notes</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{aiState.externalText}</p>
              </div>
            )}

            {unusualTransactions.length > 0 && (
              <div className="section-card">
                <h3>Flagged Transactions</h3>
                <div className="stack">
                  {unusualTransactions.map((t) => (
                    <div key={t.id} className="table-row">
                      <div className="split-row">
                        <strong>{t.category}</strong>
                        <span style={{ color: "var(--expense)" }}>{fmtINR(t.amount)}</span>
                      </div>
                      <p>{t.date} • {t.note || "No note"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="section-card">
          <h3>No insights yet</h3>
          <p>Run the analyzer to generate spending insights, anomaly detection, savings opportunities, and investment suggestions from your live data.</p>
        </div>
      )}
    </>
  );
}

function AnalyticsReports({
  monthlySeries,
  yoyComparison,
  categoryTrendSeries,
  heatmap,
  onExportPdf,
  onExportCsv,
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Analytics & Reports</h1>
          <p>Year-over-year comparison, trend analysis, and printable reports.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="icon-btn" onClick={onExportCsv}>Export CSV</button>
          <button className="btn-primary" onClick={onExportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">Income YoY</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{yoyComparison.incomeDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.income)} vs {fmtINR(yoyComparison.previous.income)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Expense YoY</div>
          <div className="sc-value" style={{ color: yoyComparison.expenseUp ? "var(--expense)" : "var(--income)" }}>{yoyComparison.expenseDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.expense)} vs {fmtINR(yoyComparison.previous.expense)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Investment YoY</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{yoyComparison.investDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.investment)} vs {fmtINR(yoyComparison.previous.investment)}</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Savings YoY</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{yoyComparison.savingsDelta}</div>
          <div className="sc-sub">{fmtINR(yoyComparison.current.savings)} vs {fmtINR(yoyComparison.previous.savings)}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-span-6">
          <div className="chart-title">Monthly Trend</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlySeries}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Income" stroke="#34D399" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#F87171" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="investment" name="Investment" stroke="#818CF8" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-6">
          <div className="chart-title">Category Trend Lines</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={categoryTrendSeries}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} />
              <Legend />
              {Object.keys(categoryTrendSeries[0] || {})
                .filter((k) => !["label", "month"].includes(k))
                .map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-span-12">
          <div className="chart-title">Spending Heat Map</div>
          <div className="heat-grid">
            {!!heatmap.rows.length && (
              <div className="heat-row" style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700 }}>
                <div>Category</div>
                {heatmap.months.map((m) => <div key={m}>{monthLabel(m)}</div>)}
              </div>
            )}
            {heatmap.rows.map((row) => (
              <div key={row.category} className="heat-row">
                <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>{row.category}</div>
                {row.values.map((value, i) => (
                  <div
                    key={`${row.category}-${heatmap.months[i]}`}
                    className="heat-cell"
                    style={{
                      background: `rgba(200,169,110,${0.12 + value.intensity * 0.62})`,
                      borderColor: value.amount ? "rgba(200,169,110,.32)" : "var(--border)",
                    }}
                  >
                    {value.amount ? fmtINR(value.amount) : "—"}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function GoalsTargets({ goals, setGoals }) {
  const [form, setForm] = useState({
    name: "",
    category: "Emergency Fund",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
  });

  const addGoal = () => {
    if (!form.name || !form.targetAmount) return;
    setGoals((prev) => [
      {
        id: crypto.randomUUID(),
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

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Goals & Targets</h1>
          <p>Track emergency fund, travel, big purchases, and long-term milestones.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="form-card">
          <div className="form-grid">
            <div className="fg full">
              <label className="fl">Goal Name</label>
              <input className="fi" placeholder="Emergency fund, Europe trip, house down payment…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Goal Type</label>
              <select className="fs" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {["Emergency Fund", "Vacation", "Retirement", "Education", "Home", "Vehicle", "Investment Target", "Insurance Cover"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Target Date</label>
              <input className="fi" type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Target Amount</label>
              <input className="fi" type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Current Progress</label>
              <input className="fi" type="number" value={form.currentAmount} onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))} />
            </div>
            <div className="fg full">
              <button className="btn-primary" onClick={addGoal}>Add Goal</button>
            </div>
          </div>
        </div>

        <div className="stack">
          {goals.length ? goals.map((goal) => {
            const progress = goal.targetAmount ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            return (
              <div key={goal.id} className="goal-card">
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <div>
                    <strong>{goal.name}</strong>
                    <p>{goal.category}{goal.targetDate ? ` • target ${goal.targetDate}` : ""}</p>
                  </div>
                  <button className="tx-btn del" onClick={() => removeGoal(goal.id)}>Delete</button>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${progress}%`, background: progress >= 75 ? "var(--income)" : "var(--accent)" }} />
                </div>
                <div className="split-row" style={{ fontSize: 11.5, color: "var(--text2)", marginBottom: 10 }}>
                  <span>{fmtINR(goal.currentAmount)} saved</span>
                  <span>{progress.toFixed(0)}% of {fmtINR(goal.targetAmount)}</span>
                </div>
                <div className="setting-row">
                  <input
                    className="setting-input"
                    type="number"
                    value={goal.currentAmount}
                    onChange={(e) => updateGoal(goal.id, { currentAmount: Number(e.target.value || 0) })}
                  />
                  <button className="btn-save" onClick={() => updateGoal(goal.id, goal)}>Save</button>
                </div>
              </div>
            );
          }) : (
            <div className="section-card">
              <h3>No goals yet</h3>
              <p>Add a financial target and start measuring progress instead of hoping it happens.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function NetWorthTracker({
  assets,
  setAssets,
  liabilities,
  setLiabilities,
  trackedCash,
  trackedInvestments,
  netWorth,
}) {
  const [assetForm, setAssetForm] = useState({ name: "", type: "Cash", value: "" });
  const [liabilityForm, setLiabilityForm] = useState({ name: "", type: "Loan", value: "" });

  const addAsset = () => {
    if (!assetForm.name || !assetForm.value) return;
    setAssets((prev) => [{ id: crypto.randomUUID(), ...assetForm, value: Number(assetForm.value) }, ...prev]);
    setAssetForm({ name: "", type: "Cash", value: "" });
  };
  const addLiability = () => {
    if (!liabilityForm.name || !liabilityForm.value) return;
    setLiabilities((prev) => [{ id: crypto.randomUUID(), ...liabilityForm, value: Number(liabilityForm.value) }, ...prev]);
    setLiabilityForm({ name: "", type: "Loan", value: "" });
  };

  const assetTotal = assets.reduce((s, x) => s + Number(x.value || 0), 0);
  const liabilityTotal = liabilities.reduce((s, x) => s + Number(x.value || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Net Worth</h1>
          <p>Bring together tracked cash flow, investment buildup, manual assets, and liabilities.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Cash Reserve</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(trackedCash)}</div>
          <div className="sc-sub">Income - expenses - insurance - investments.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Investments</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(trackedInvestments)}</div>
          <div className="sc-sub">Total capital deployed via transaction log.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Manual Assets</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(assetTotal)}</div>
          <div className="sc-sub">Property, cash accounts, gold, and other holdings.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Net Worth</div>
          <div className="sc-value" style={{ color: netWorth >= 0 ? "var(--income)" : "var(--expense)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">All tracked assets minus liabilities.</div>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="form-card">
            <div className="form-grid">
              <div className="fg full">
                <label className="fl">Add Asset</label>
                <input className="fi" placeholder="Emergency fund, bank FD, gold, property…" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Type</label>
                <select className="fs" value={assetForm.type} onChange={(e) => setAssetForm((f) => ({ ...f, type: e.target.value }))}>
                  {["Cash", "Property", "Gold", "Vehicle", "Retirement", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Value</label>
                <input className="fi" type="number" value={assetForm.value} onChange={(e) => setAssetForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="fg full">
                <button className="btn-primary" onClick={addAsset}>Add Asset</button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>Assets</h3>
            <div className="stack">
              {assets.length ? assets.map((item) => (
                <div key={item.id} className="net-item">
                  <div className="split-row">
                    <strong>{item.name}</strong>
                    <span style={{ color: "var(--income)" }}>{fmtINR(item.value)}</span>
                  </div>
                  <p>{item.type}</p>
                </div>
              )) : <p>No manual assets added yet.</p>}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="form-card">
            <div className="form-grid">
              <div className="fg full">
                <label className="fl">Add Liability</label>
                <input className="fi" placeholder="Home loan, personal loan, credit card balance…" value={liabilityForm.name} onChange={(e) => setLiabilityForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Type</label>
                <select className="fs" value={liabilityForm.type} onChange={(e) => setLiabilityForm((f) => ({ ...f, type: e.target.value }))}>
                  {["Loan", "Credit Card", "Mortgage", "Tax Due", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Value</label>
                <input className="fi" type="number" value={liabilityForm.value} onChange={(e) => setLiabilityForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="fg full">
                <button className="btn-primary" onClick={addLiability}>Add Liability</button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>Liabilities</h3>
            <div className="stack">
              {liabilities.length ? liabilities.map((item) => (
                <div key={item.id} className="net-item">
                  <div className="split-row">
                    <strong>{item.name}</strong>
                    <span style={{ color: "var(--expense)" }}>{fmtINR(item.value)}</span>
                  </div>
                  <p>{item.type}</p>
                </div>
              )) : <p>No liabilities added yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Settings({
  budget,
  budgetInput,
  setBudgetInput,
  onSaveBudget,
  darkMode,
  setDarkMode,
  user,
  logout,
  aiConfig,
  setAiConfig,
  notificationsEnabled,
  setNotificationsEnabled,
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Appearance, budgets, AI configuration, and account preferences.</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <p>Switch between dark and light mode. Your preference is saved automatically.</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{darkMode ? "Dark mode" : "Light mode"}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setDarkMode((v) => !v)}>
            <div className={`tt-track ${darkMode ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Monthly Budget</h3>
        <p>Budget warnings are used by the dashboard and smart notifications system.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly limit…" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {!!budget && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text3)" }}>Current: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtINR(Number(budget))}</span></div>}
      </div>

      <div className="settings-section">
        <h3>Smart Notifications</h3>
        <p>Warn about budget overruns, low savings, and unusual transactions.</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{notificationsEnabled ? "Enabled" : "Disabled"}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setNotificationsEnabled((v) => !v)}>
            <div className={`tt-track ${notificationsEnabled ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>AI Configuration</h3>
        <p>Use on-device insights by default, or connect Anthropic Claude / an OpenRouter free model for richer narrative analysis.</p>
        <div className="form-grid">
          <div className="fg">
            <label className="fl">Provider</label>
            <select className="fs" value={aiConfig.provider} onChange={(e) => setAiConfig((s) => ({ ...s, provider: e.target.value }))}>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openrouter">OpenRouter Free Model</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">API Key</label>
            <input className="fi" type="password" placeholder="Paste API key…" value={aiConfig.apiKey} onChange={(e) => setAiConfig((s) => ({ ...s, apiKey: e.target.value }))} />
          </div>
          <div className="fg">
            <label className="fl">Claude Model</label>
            <input className="fi" placeholder="claude-3-5-haiku-latest" value={aiConfig.model} onChange={(e) => setAiConfig((s) => ({ ...s, model: e.target.value }))} />
          </div>
          <div className="fg">
            <label className="fl">Free Model</label>
            <input className="fi" placeholder="meta-llama/llama-3.3-8b-instruct:free" value={aiConfig.freeModel} onChange={(e) => setAiConfig((s) => ({ ...s, freeModel: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Account</h3>
        <p>Signed in as <strong style={{ color: "var(--text)" }}>{user?.email || user?.phoneNumber || "Google User"}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("finwise-theme") !== "light");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("Food & Dining");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [recurring, setRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [expenses, setExpenses] = useState([]);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [budget, setBudget] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [goals, setGoals] = useState([]);
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [aiConfig, setAiConfig] = useState({
    provider: "anthropic",
    apiKey: "",
    model: "claude-3-5-haiku-latest",
    freeModel: "meta-llama/llama-3.3-8b-instruct:free",
  });
  const [aiState, setAiState] = useState({
    loading: false,
    error: "",
    report: null,
    externalText: "",
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(new Date()));
  const toastTimerRef = useRef(null);
  const latestAlertsRef = useRef("");

  useEffect(() => {
    document.body.classList.toggle("light", !darkMode);
    localStorage.setItem("finwise-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => auth.onAuthStateChanged(setUser), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    setGoals(safeJSON(localStorage.getItem(getStorageKey(uid, "goals")), []));
    setAssets(safeJSON(localStorage.getItem(getStorageKey(uid, "assets")), []));
    setLiabilities(safeJSON(localStorage.getItem(getStorageKey(uid, "liabilities")), []));
    setAiConfig((prev) => ({ ...prev, ...safeJSON(localStorage.getItem(getStorageKey(uid, "ai-config")), {}) }));
    const savedBudget = localStorage.getItem(getStorageKey(uid, "budget")) || "";
    setBudget(savedBudget);
    setBudgetInput(savedBudget);
    const savedNotif = localStorage.getItem(getStorageKey(uid, "notifications"));
    setNotificationsEnabled(savedNotif == null ? true : savedNotif === "true");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "goals"), JSON.stringify(goals));
  }, [goals, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "assets"), JSON.stringify(assets));
  }, [assets, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "liabilities"), JSON.stringify(liabilities));
  }, [liabilities, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "ai-config"), JSON.stringify(aiConfig));
  }, [aiConfig, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "budget"), budget);
  }, [budget, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "notifications"), String(notificationsEnabled));
  }, [notificationsEnabled, user]);

  const showToast = useCallback((msg, kind = "success") => {
    setToast({ msg, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const handleLogin = (e, p) => signInWithEmailAndPassword(auth, e, p);
  const handleSignup = (e, p) => createUserWithEmailAndPassword(auth, e, p);
  const handleGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => {
    signOut(auth);
    setActiveTab("dashboard");
  };

  const submitTransaction = async () => {
    if (!amount || Number.isNaN(parseFloat(amount))) return;
    const payload = {
      amount: parseFloat(amount),
      type,
      category,
      note,
      date,
      recurring,
      recurringFrequency: recurring ? recurringFrequency : null,
    };
    try {
      if (editId) {
        await updateDoc(doc(db, "users", user.uid, "expenses", editId), payload);
        showToast("Transaction updated.");
      } else {
        await addDoc(collection(db, "users", user.uid, "expenses"), payload);
        showToast("Transaction added.");
      }
      setAmount("");
      setNote("");
      setType("expense");
      setCategory("Food & Dining");
      setDate(toLocalDateStr(new Date()));
      setRecurring(false);
      setRecurringFrequency("monthly");
      setEditId(null);
      setActiveTab("dashboard");
    } catch {
      showToast("Failed to save transaction.", "error");
    }
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
    showToast("Transaction removed.", "error");
  };

  const editExpense = (e) => {
    setAmount(String(e.amount));
    setType(e.type);
    setCategory(e.category);
    setNote(e.note || "");
    setDate(e.date);
    setRecurring(!!e.recurring);
    setRecurringFrequency(e.recurringFrequency || "monthly");
    setEditId(e.id);
    setActiveTab("add");
  };

  const cancelEdit = () => {
    setEditId(null);
    setAmount("");
    setNote("");
    setRecurring(false);
    setRecurringFrequency("monthly");
    setActiveTab("history");
  };

  const importSingleRecord = useCallback(async (rec) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "expenses"), {
      amount: rec.amount,
      type: rec.type,
      category: rec.category,
      note: rec.note || "",
      date: rec.date,
      recurring: false,
      recurringFrequency: null,
    });
  }, [user]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return { value: toYYYYMM(d), label: monthLabel(toYYYYMM(d)) };
  });

  const recs = selectedMonth === "all" ? expenses : expenses.filter((e) => e.date?.startsWith(selectedMonth));
  const totals = {
    income: sumByType(recs, "income"),
    expense: sumByType(recs, "expense"),
    investment: sumByType(recs, "investment"),
    insurance: sumByType(recs, "insurance"),
  };
  totals.balance = totals.income - totals.expense - totals.investment - totals.insurance;
  totals.savingsRate = totals.income > 0 ? ((totals.income - totals.expense) / totals.income) * 100 : 0;

  const allTimeIncome = sumByType(expenses, "income");
  const allTimeExpense = sumByType(expenses, "expense");
  const allTimeInvestment = sumByType(expenses, "investment");
  const allTimeInsurance = sumByType(expenses, "insurance");
  const trackedCash = allTimeIncome - allTimeExpense - allTimeInvestment - allTimeInsurance;
  const trackedInvestments = allTimeInvestment;
  const manualAssetTotal = assets.reduce((s, x) => s + Number(x.value || 0), 0);
  const liabilityTotal = liabilities.reduce((s, x) => s + Number(x.value || 0), 0);
  const netWorth = trackedCash + trackedInvestments + manualAssetTotal - liabilityTotal;

  const expPieData = buildPie(recs, "expense");
  const invPieData = buildPie(recs, "investment");
  const insPieData = buildPie(recs, "insurance");
  const topCategories = expPieData.slice(0, 5);
  const recurringOutflow = recs.filter((t) => t.recurring && t.type !== "income").reduce((s, t) => s + Number(t.amount || 0), 0);

  const monthRange12 = getMonthRange(12);
  const monthlySeries = monthRange12.map((month) => {
    const items = expenses.filter((e) => e.date?.startsWith(month));
    const income = sumByType(items, "income");
    const expense = sumByType(items, "expense");
    const investment = sumByType(items, "investment");
    const insurance = sumByType(items, "insurance");
    return {
      month,
      label: monthLabel(month),
      income,
      expense,
      investment,
      insurance,
      savings: income - expense,
    };
  });

  const currentMonthIndex = monthRange12.indexOf(selectedMonth);
  const currentMonth = selectedMonth === "all" ? monthRange12.at(-1) : selectedMonth;
  const currentMonthSpend = sumByType(expenses.filter((e) => e.date?.startsWith(currentMonth)), "expense");
  const previousMonth = selectedMonth === "all"
    ? monthRange12.at(-2)
    : monthRange12[Math.max(0, currentMonthIndex - 1)] || monthRange12.at(-2);
  const previousMonthSpend = previousMonth ? sumByType(expenses.filter((e) => e.date?.startsWith(previousMonth)), "expense") : 0;
  const momExpenseDelta = previousMonthSpend > 0 ? ((currentMonthSpend - previousMonthSpend) / previousMonthSpend) * 100 : 0;

  const expenseByCategoryAllTime = {};
  expenses.filter((t) => t.type === "expense").forEach((t) => {
    const key = t.category;
    if (!expenseByCategoryAllTime[key]) expenseByCategoryAllTime[key] = [];
    expenseByCategoryAllTime[key].push(Number(t.amount || 0));
  });
  const unusualTransactions = recs
    .filter((t) => t.type === "expense")
    .filter((t) => {
      const arr = expenseByCategoryAllTime[t.category] || [];
      if (arr.length < 3) return false;
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return t.amount > avg * 1.8;
    })
    .slice(0, 4);

  const budgetNum = parseFloat(budget) || 0;
  const budgetProgress = budgetNum ? Math.min((totals.expense / budgetNum) * 100, 100) : 0;
  const budgetColor = budgetProgress > 90 ? "var(--expense)" : budgetProgress > 70 ? "var(--accent)" : "var(--income)";

  const alerts = [];
  if (budgetNum && totals.expense > budgetNum) alerts.push({ title: "Budget exceeded", body: `You are ${fmtINR(totals.expense - budgetNum)} over the current budget.`, tone: "warn" });
  else if (budgetNum && budgetProgress > 85) alerts.push({ title: "Budget getting tight", body: `${budgetProgress.toFixed(0)}% of the monthly expense budget is already used.`, tone: "info" });
  if (momExpenseDelta > 12) alerts.push({ title: "Spending spike", body: `Expenses are up ${momExpenseDelta.toFixed(1)}% versus the previous month.`, tone: "warn" });
  if (totals.income > 0 && totals.savingsRate < 10) alerts.push({ title: "Savings rate is low", body: "Try protecting savings before discretionary spend expands further.", tone: "warn" });
  if (unusualTransactions.length) alerts.push({ title: "Unusual transactions detected", body: `${unusualTransactions.length} transaction${unusualTransactions.length > 1 ? "s look" : " looks"} materially larger than category norms.`, tone: "warn" });
  if (recurringOutflow > 0 && totals.income > 0 && recurringOutflow > totals.income * 0.35) alerts.push({ title: "Recurring obligations are heavy", body: "Bills and recurring commitments are consuming a large share of monthly income.", tone: "info" });
  if (!alerts.length) alerts.push({ title: "Healthy rhythm", body: "No urgent warnings from budgets, anomalies, or recurring commitments.", tone: "good" });

  useEffect(() => {
    if (!notificationsEnabled) return;
    const serialized = alerts.map((a) => a.title).join("|");
    if (serialized && serialized !== latestAlertsRef.current && alerts[0]?.tone !== "good") {
      latestAlertsRef.current = serialized;
      showToast(alerts[0].title, "warning");
    }
  }, [notificationsEnabled, alerts, showToast]);

  const heatMonths = getMonthRange(6);
  const topHeatCategories = Object.keys(expenseByCategoryAllTime)
    .sort((a, b) => {
      const av = (expenseByCategoryAllTime[a] || []).reduce((x, y) => x + y, 0);
      const bv = (expenseByCategoryAllTime[b] || []).reduce((x, y) => x + y, 0);
      return bv - av;
    })
    .slice(0, 5);
  const heatmap = {
    months: heatMonths,
    rows: topHeatCategories.map((cat) => {
      const amounts = heatMonths.map((m) =>
        expenses
          .filter((e) => e.type === "expense" && e.category === cat && e.date?.startsWith(m))
          .reduce((s, e) => s + Number(e.amount || 0), 0)
      );
      const max = Math.max(...amounts, 1);
      return {
        category: cat,
        values: amounts.map((amount) => ({ amount, intensity: amount / max })),
      };
    }),
  };

  const topTrendCats = topHeatCategories.slice(0, 4);
  const categoryTrendSeries = heatMonths.map((month) => {
    const base = { month, label: monthLabel(month) };
    topTrendCats.forEach((cat) => {
      base[cat] = expenses
        .filter((e) => e.type === "expense" && e.category === cat && e.date?.startsWith(month))
        .reduce((s, e) => s + Number(e.amount || 0), 0);
    });
    return base;
  });

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const yearTotals = (year) => {
    const items = expenses.filter((e) => e.date?.startsWith(String(year)));
    const income = sumByType(items, "income");
    const expense = sumByType(items, "expense");
    const investment = sumByType(items, "investment");
    const insurance = sumByType(items, "insurance");
    return { income, expense, investment, insurance, savings: income - expense };
  };
  const currentYearTotals = yearTotals(currentYear);
  const previousYearTotals = yearTotals(previousYear);
  const deltaLabel = (cur, prev) => {
    if (!prev && !cur) return "—";
    if (!prev) return "+100%";
    const delta = ((cur - prev) / prev) * 100;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
  };
  const yoyComparison = {
    current: currentYearTotals,
    previous: previousYearTotals,
    incomeDelta: deltaLabel(currentYearTotals.income, previousYearTotals.income),
    expenseDelta: deltaLabel(currentYearTotals.expense, previousYearTotals.expense),
    investDelta: deltaLabel(currentYearTotals.investment, previousYearTotals.investment),
    savingsDelta: deltaLabel(currentYearTotals.savings, previousYearTotals.savings),
    expenseUp: currentYearTotals.expense > previousYearTotals.expense,
  };

  const heuristicReport = buildHeuristicReport({
    income: totals.income,
    expense: totals.expense,
    investment: totals.investment,
    insurance: totals.insurance,
    topCategories,
    momExpenseDelta,
    savingsRate: totals.savingsRate,
    recurringOutflow,
    unusualTransactions,
    netWorth,
  });

  const runAIInsights = async () => {
    setAiState((s) => ({ ...s, loading: true, error: "", externalText: "", report: heuristicReport }));
    try {
      const context = {
        selectedMonth,
        totals,
        topCategories,
        recurringOutflow,
        unusualTransactions,
        monthlySeries: monthlySeries.slice(-6),
        yoyComparison,
        netWorth,
      };
      const externalText = aiConfig.apiKey ? await runExternalAI(aiConfig, context) : "";
      setAiState({ loading: false, error: "", externalText, report: heuristicReport });
      showToast("Insights refreshed.");
    } catch (e) {
      setAiState({ loading: false, error: e.message || "AI request failed", externalText: "", report: heuristicReport });
      showToast("AI request failed. Using local insights.", "warning");
    }
  };

  useEffect(() => {
    if (!aiState.report && expenses.length) setAiState((s) => ({ ...s, report: heuristicReport }));
  }, [expenses]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = recs
    .filter((e) => (filterType === "all" ? true : e.type === filterType))
    .filter((e) => (recurringOnly ? !!e.recurring : true))
    .filter((e) =>
      !filterCategory ? true : e.category === filterCategory
    )
    .filter((e) => {
      if (!search) return true;
      const needle = search.toLowerCase();
      return (
        e.category.toLowerCase().includes(needle) ||
        (e.note || "").toLowerCase().includes(needle) ||
        String(e.amount).includes(needle)
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const exportCSV = () => {
    const headers = ["Date", "Type", "Category", "Amount", "Note", "Recurring", "Frequency"];
    const rows = filtered.map((e) => [e.date, e.type, e.category, e.amount, e.note || "", e.recurring ? "yes" : "no", e.recurringFrequency || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `finwise-${selectedMonth}-transactions.csv`;
    a.click();
    showToast("CSV exported.");
  };

  const exportAnalyticsPdf = () => {
    const ok = exportPdfReport({
      title: "Finwise Financial Report",
      sections: [
        { title: "Executive Summary", body: heuristicReport.summary },
        { title: "Top Savings Opportunities", body: heuristicReport.opportunities },
        { title: "Anomalies", body: heuristicReport.anomalies.length ? heuristicReport.anomalies : ["No unusual transactions flagged."] },
        { title: "Investment Guidance", body: heuristicReport.investmentIdeas },
        { title: "Action Plan", body: heuristicReport.tips },
      ],
    });
    if (ok) showToast("PDF report opened for print/export.");
  };

  if (!user) {
    return (
      <>
        <style>{CSS}</style>
        <LoginPage onLogin={handleLogin} onSignup={handleSignup} onGoogle={handleGoogle} />
      </>
    );
  }

  const NAV = [
    { id: "dashboard", icon: "◉", label: "Overview" },
    { id: "ai", icon: "✦", label: "AI Insights" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "goals", icon: "◎", label: "Goals" },
    { id: "wealth", icon: "⬢", label: "Net Worth" },
    { id: "add", icon: "＋", label: "Add" },
    { id: "history", icon: "≡", label: "History" },
    { id: "import", icon: "⬆", label: "Import" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];

  const MOBILE_NAV = [
    { id: "dashboard", icon: "◉", label: "Home" },
    { id: "ai", icon: "✦", label: "AI" },
    { id: "add", fab: true },
    { id: "history", icon: "≡", label: "History" },
    { id: "goals", icon: "◎", label: "Goals" },
    { id: "settings", icon: "⚙", label: "More" },
  ];

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="wordmark">◈ Finwise</div>
            <div className="tagline">AI Finance Tracker</div>
          </div>
          {NAV.map((item) => (
            <div key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <span className="ni">{item.icon}</span>{item.label}
            </div>
          ))}
          <div className="sidebar-spacer" />
          <div style={{ padding: "0 8px 8px" }}>
            <div className="theme-row" onClick={() => setDarkMode((v) => !v)}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)" }}>{darkMode ? "Dark theme" : "Light theme"}</span>
              <div className={`tt-track ${darkMode ? "on" : ""}`}>
                <div className="tt-thumb" />
              </div>
            </div>
          </div>
          <div className="sidebar-footer">
            <div className="user-row">
              <div className="user-avatar">{(user?.email || user?.phoneNumber || "U")[0].toUpperCase()}</div>
              <div className="user-email">{user?.email || user?.phoneNumber}</div>
            </div>
            <button className="logout-btn" onClick={logout}>Sign Out</button>
          </div>
        </aside>

        <main className="main">
          <div className="content">
            {activeTab === "dashboard" && (
              <Dashboard
                months={months}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                totals={totals}
                budgetNum={budgetNum}
                budgetProgress={budgetProgress}
                budgetColor={budgetColor}
                expPieData={expPieData}
                invPieData={invPieData}
                insPieData={insPieData}
                monthlySeries={monthlySeries}
                alerts={alerts}
                topCategories={topCategories}
                recurringOutflow={recurringOutflow}
                netWorth={netWorth}
                unusualTransactions={unusualTransactions}
              />
            )}
            {activeTab === "ai" && (
              <AIInsights
                report={aiState.report}
                aiState={aiState}
                onGenerate={runAIInsights}
                aiConfig={aiConfig}
                topCategories={topCategories}
                unusualTransactions={unusualTransactions}
                totals={totals}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsReports
                monthlySeries={monthlySeries}
                yoyComparison={yoyComparison}
                categoryTrendSeries={categoryTrendSeries}
                heatmap={heatmap}
                onExportPdf={exportAnalyticsPdf}
                onExportCsv={exportCSV}
              />
            )}
            {activeTab === "goals" && <GoalsTargets goals={goals} setGoals={setGoals} />}
            {activeTab === "wealth" && (
              <NetWorthTracker
                assets={assets}
                setAssets={setAssets}
                liabilities={liabilities}
                setLiabilities={setLiabilities}
                trackedCash={trackedCash}
                trackedInvestments={trackedInvestments}
                netWorth={netWorth}
              />
            )}
            {activeTab === "add" && (
              <AddForm
                amount={amount}
                setAmount={setAmount}
                type={type}
                setType={setType}
                category={category}
                setCategory={setCategory}
                note={note}
                setNote={setNote}
                date={date}
                setDate={setDate}
                editId={editId}
                onSubmit={submitTransaction}
                onCancel={cancelEdit}
                recurring={recurring}
                setRecurring={setRecurring}
                recurringFrequency={recurringFrequency}
                setRecurringFrequency={setRecurringFrequency}
              />
            )}
            {activeTab === "history" && (
              <History
                filtered={filtered}
                search={search}
                setSearch={setSearch}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                filterType={filterType}
                setFilterType={setFilterType}
                recurringOnly={recurringOnly}
                setRecurringOnly={setRecurringOnly}
                onEdit={editExpense}
                onDelete={deleteExpense}
                onExport={exportCSV}
                months={months}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
              />
            )}
            {activeTab === "import" && <ImportPage onImport={importSingleRecord} showToast={showToast} />}
            {activeTab === "settings" && (
              <Settings
                budget={budget}
                budgetInput={budgetInput}
                setBudgetInput={setBudgetInput}
                onSaveBudget={() => {
                  setBudget(budgetInput);
                  showToast("Budget saved.");
                }}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                user={user}
                logout={logout}
                aiConfig={aiConfig}
                setAiConfig={setAiConfig}
                notificationsEnabled={notificationsEnabled}
                setNotificationsEnabled={setNotificationsEnabled}
              />
            )}
          </div>
        </main>

        <nav className="bottom-nav">
          <div className="bnav-items">
            {MOBILE_NAV.map((item) =>
              item.fab ? (
                <div key="add" className="bnav-item" onClick={() => setActiveTab("add")}>
                  <button className="bnav-fab">+</button>
                </div>
              ) : (
                <div key={item.id} className={`bnav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
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
