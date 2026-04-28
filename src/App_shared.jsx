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

// ─── Timezone-safe helpers (fixes IST UTC+5:30 month shift) ──────────────────
const toYYYYMM = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

// ─── Constants ────────────────────────────────────────────────────────────────
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

const CATEGORY_ICONS = {
  // Income
  "Salary":"💼","Freelance":"💻","Business":"📊","Rental Income":"🏘️",
  "Dividend":"💹","Interest":"🏦","Bonus":"🎯","Pension":"👴",
  "Capital Gain":"📈","Gift":"🎁","Other Income":"✨",
  // Expense
  "Food & Dining":"🍽️","Transport":"🚌","Shopping":"🛍️","Utilities & Bills":"📄",
  "Healthcare":"💊","Entertainment":"🎬","EMI / Loan":"🏠","Education":"📚",
  "Personal Care":"💆","Subscriptions":"📱","Home & Rent":"🏡","Groceries":"🛒",
  "Fuel":"⛽","Clothing":"👗","Travel":"✈️","Eating Out":"🍜","Other Expense":"📦",
  // Investment
  "Stocks — NSE/BSE":"📉","Mutual Fund — Equity":"📈","Mutual Fund — Debt":"📊",
  "Mutual Fund — Hybrid":"⚖️","Index Fund / ETF":"🗂️","PPF":"🏛️","EPF / PF":"🏢",
  "NPS":"🪙","Fixed Deposit":"🔒","Recurring Deposit":"🔄","Bonds / Debentures":"📋",
  "Sovereign Gold Bond":"🥇","Gold / Silver Physical":"🏅","REIT / InvIT":"🏗️",
  "Real Estate":"🏠","Cryptocurrency":"₿","ULIP":"💎","Other Investment":"🧩",
  // Insurance
  "Term Life Insurance":"🛡️","LIC Endowment":"🏛️","LIC Money Back":"💰",
  "LIC Jeevan Anand":"🌟","ULIP Insurance":"💎","Whole Life Insurance":"♾️",
  "Health Insurance — Individual":"👤","Health Insurance — Family":"👨‍👩‍👧",
  "Critical Illness Cover":"🏥","Personal Accident":"🩹","Car Insurance":"🚗",
  "Two-Wheeler Insurance":"🏍️","Home / Property Insurance":"🏡",
  "Travel Insurance":"🌍","PLI (Postal Life Insurance)":"📮","Rural PLI":"🌾",
  "PMJJBY":"📜","PMSBY":"🛟","Marine Insurance":"⚓","Fire Insurance":"🔥",
  "Other Insurance":"📑",
};

const TYPE_META = {
  income:     { color:"var(--income)",   dim:"var(--income-dim)",   label:"Income",     icon:"📥", sign:"+" },
  expense:    { color:"var(--expense)",  dim:"var(--expense-dim)",  label:"Expense",    icon:"📤", sign:"-" },
  investment: { color:"var(--invest)",   dim:"var(--invest-dim)",   label:"Investment", icon:"📊", sign:"→" },
  insurance:  { color:"var(--insure)",   dim:"var(--insure-dim)",   label:"Insurance",  icon:"🛡️", sign:"→" },
};

const PIE_COLORS  = ["#C8A96E","#E8C870","#A07850","#D4B896","#F0DEB4","#8A6840","#C4A87E","#B89060"];
const INV_COLORS  = ["#818CF8","#A78BFA","#C084FC","#E879F9","#F472B6","#FB7185","#7DD3FC","#6EE7B7","#FCD34D","#A3E635"];
const INS_COLORS  = ["#FB923C","#F97316","#FDBA74","#FED7AA","#FCA5A5","#FCD34D","#86EFAC","#93C5FD","#C4B5FD","#F9A8D4"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Market data ──────────────────────────────────────────────────────────────
// Trending NSE (Nifty 50 heavyweights)
const TRENDING_NSE = [
  { symbol:"RELIANCE.NS",   name:"Reliance Industries", sector:"Energy" },
  { symbol:"TCS.NS",        name:"Tata Consultancy",    sector:"IT" },
  { symbol:"HDFCBANK.NS",   name:"HDFC Bank",           sector:"Banking" },
  { symbol:"INFY.NS",       name:"Infosys",             sector:"IT" },
  { symbol:"ICICIBANK.NS",  name:"ICICI Bank",          sector:"Banking" },
  { symbol:"SBIN.NS",       name:"State Bank of India", sector:"Banking" },
  { symbol:"BHARTIARTL.NS", name:"Bharti Airtel",       sector:"Telecom" },
  { symbol:"ITC.NS",        name:"ITC",                 sector:"FMCG" },
  { symbol:"LT.NS",         name:"Larsen & Toubro",     sector:"Infra" },
  { symbol:"KOTAKBANK.NS",  name:"Kotak Mahindra Bank", sector:"Banking" },
  { symbol:"WIPRO.NS",      name:"Wipro",               sector:"IT" },
  { symbol:"AXISBANK.NS",   name:"Axis Bank",           sector:"Banking" },
];
// Trending BSE
const TRENDING_BSE = [
  { symbol:"TATAMOTORS.BO", name:"Tata Motors",         sector:"Auto" },
  { symbol:"BAJFINANCE.BO", name:"Bajaj Finance",       sector:"Finance" },
  { symbol:"MARUTI.BO",     name:"Maruti Suzuki",       sector:"Auto" },
  { symbol:"SUNPHARMA.BO",  name:"Sun Pharma",          sector:"Pharma" },
  { symbol:"POWERGRID.BO",  name:"Power Grid",          sector:"Utilities" },
  { symbol:"NTPC.BO",       name:"NTPC",                sector:"Utilities" },
  { symbol:"HCLTECH.BO",    name:"HCL Technologies",    sector:"IT" },
  { symbol:"ULTRACEMCO.BO", name:"UltraTech Cement",    sector:"Cement" },
];
// Trending US
const TRENDING_US = [
  { symbol:"AAPL",   name:"Apple",       sector:"Tech" },
  { symbol:"MSFT",   name:"Microsoft",   sector:"Tech" },
  { symbol:"GOOGL",  name:"Alphabet",    sector:"Tech" },
  { symbol:"AMZN",   name:"Amazon",      sector:"E-com" },
  { symbol:"NVDA",   name:"Nvidia",      sector:"Chips" },
  { symbol:"META",   name:"Meta",        sector:"Social" },
  { symbol:"TSLA",   name:"Tesla",       sector:"EV" },
  { symbol:"BRK-B",  name:"Berkshire",   sector:"Finance" },
];
// Market indices
const INDICES = [
  { symbol:"^NSEI",  name:"Nifty 50",    unit:"pts" },
  { symbol:"^BSESN", name:"Sensex",      unit:"pts" },
  { symbol:"^DJI",   name:"Dow Jones",   unit:"pts" },
  { symbol:"^GSPC",  name:"S&P 500",     unit:"pts" },
  { symbol:"^IXIC",  name:"Nasdaq",      unit:"pts" },
];
// Commodities
const COMMODITY_SYMBOLS = [
  { symbol:"GC=F",     name:"Gold",       unit:"USD/oz" },
  { symbol:"SI=F",     name:"Silver",     unit:"USD/oz" },
  { symbol:"CL=F",     name:"Crude Oil",  unit:"USD/bbl" },
  { symbol:"USDINR=X", name:"USD/INR",    unit:"₹" },
  { symbol:"EURINR=X", name:"EUR/INR",    unit:"₹" },
];
const CRYPTO_IDS = [
  { id:"bitcoin",       name:"Bitcoin",  symbol:"BTC" },
  { id:"ethereum",      name:"Ethereum", symbol:"ETH" },
  { id:"binancecoin",   name:"BNB",      symbol:"BNB" },
  { id:"ripple",        name:"XRP",      symbol:"XRP" },
  { id:"solana",        name:"Solana",   symbol:"SOL" },
  { id:"matic-network", name:"Polygon",  symbol:"MATIC" },
];

const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e7)  return "₹" + (n/1e7).toFixed(2) + " Cr";
  if (n >= 1e5)  return "₹" + (n/1e5).toFixed(2) + " L";
  if (n >= 1000) return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits:2 });
  return "₹" + n.toFixed(2);
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}

/* ── Dark theme (default) ── */
:root{
  --bg:#09090B;--surface:#0F0F13;--card:#17171D;--card2:#1C1C24;--card-hover:#1E1E26;
  --border:#24242E;--border-l:#32323E;
  --accent:#C8A96E;--accent-dim:rgba(200,169,110,.12);--accent-h:#D4BC8A;
  --income:#34D399;--income-dim:rgba(52,211,153,.1);
  --expense:#F87171;--expense-dim:rgba(248,113,113,.1);
  --invest:#818CF8;--invest-dim:rgba(129,140,248,.12);
  --insure:#FB923C;--insure-dim:rgba(251,146,60,.12);
  --text:#EEEAE4;--text2:#9A9590;--text3:#52524E;
  --shadow:0 2px 12px rgba(0,0,0,.6);
  --r:16px;--rx:7px;
}

/* ── Light theme ── */
body.light{
  --bg:#F4F1EC;--surface:#FDFBF7;--card:#FFFFFF;--card2:#F9F6F0;--card-hover:#F0EDE6;
  --border:#E2DDD5;--border-l:#CCC7BE;
  --accent:#A07840;--accent-dim:rgba(160,120,64,.1);--accent-h:#8B6530;
  --income:#059669;--income-dim:rgba(5,150,105,.1);
  --expense:#DC2626;--expense-dim:rgba(220,38,38,.1);
  --invest:#4F46E5;--invest-dim:rgba(79,70,229,.1);
  --insure:#C2410C;--insure-dim:rgba(194,65,12,.1);
  --text:#1C1A17;--text2:#6B6560;--text3:#A09890;
  --shadow:0 2px 12px rgba(0,0,0,.1);
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

/* Sidebar */
.sidebar{width:224px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0;gap:1px;overflow:hidden;transition:background .25s,border-color .25s;}
.sidebar-logo{padding:0 20px 18px;border-bottom:1px solid var(--border);margin-bottom:6px;}
.wordmark{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:8px;}
.tagline{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1.4px;margin-top:3px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 13px;margin:0 7px;border-radius:var(--rx);cursor:pointer;color:var(--text2);font-size:12.5px;font-weight:500;transition:all .18s;border:1px solid transparent;}
.nav-item:hover{color:var(--text);background:var(--card);}
.nav-item.active{color:var(--accent);background:var(--accent-dim);border-color:rgba(200,169,110,.2);}
body.light .nav-item.active{border-color:rgba(160,120,64,.25);}
.nav-item .ni{font-size:15px;width:20px;text-align:center;}
.sidebar-spacer{flex:1;}
.sidebar-footer{padding:14px 8px 0;border-top:1px solid var(--border);}
.user-row{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:5px;}
.user-avatar{width:30px;height:30px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent);flex-shrink:0;}
.user-email{font-size:10.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.logout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:1px solid var(--border);border-radius:var(--rx);color:var(--text2);font-size:11.5px;font-weight:500;cursor:pointer;transition:all .18s;}
.logout-btn:hover{color:var(--expense);border-color:rgba(248,113,113,.4);background:var(--expense-dim);}

/* Theme toggle */
.theme-toggle{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin:0 8px 6px;border-radius:var(--rx);border:1px solid var(--border);cursor:pointer;transition:all .18s;}
.theme-toggle:hover{background:var(--card);border-color:var(--border-l);}
.theme-toggle-label{font-size:11px;font-weight:500;color:var(--text2);}
.theme-toggle-track{width:32px;height:17px;border-radius:99px;background:var(--border);position:relative;transition:background .2s;flex-shrink:0;}
.theme-toggle-track.on{background:var(--accent);}
.theme-toggle-thumb{width:13px;height:13px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s;}
.theme-toggle-track.on .theme-toggle-thumb{left:17px;}

/* Main */
.main{flex:1;overflow-y:auto;background:var(--bg);transition:background .25s;}
.content{padding:30px 32px;max-width:960px;margin:0 auto;animation:fadeIn .3s ease;}

/* Page header */
.page-header{margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;}
.page-header h1{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:700;}
.page-header p{font-size:12px;color:var(--text3);margin-top:2px;}

/* Month strip */
.month-strip{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;margin-bottom:20px;scrollbar-width:none;}
.month-strip::-webkit-scrollbar{display:none;}
.month-chip{padding:5px 14px;border-radius:99px;font-size:11.5px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;transition:all .17s;white-space:nowrap;flex-shrink:0;}
.month-chip:hover{color:var(--text);border-color:var(--border-l);}
.month-chip.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,.35);}
.month-chip.alltime{border-style:dashed;}

/* Summary grid */
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:18px;}
.summary-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:15px 17px;transition:all .2s;animation:fadeIn .4s ease;box-shadow:var(--shadow);}
.summary-card:hover{border-color:var(--border-l);transform:translateY(-1px);}
.sc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:var(--text3);margin-bottom:7px;}
.sc-value{font-family:'Cormorant Garamond',serif;font-size:23px;font-weight:700;line-height:1;}
.sc-value.balance{color:var(--accent);}
.sc-value.income{color:var(--income);}
.sc-value.expense{color:var(--expense);}
.sc-value.investment{color:var(--invest);}
.sc-value.insurance{color:var(--insure);}
.sc-sub{font-size:9.5px;color:var(--text3);margin-top:4px;}

/* Budget */
.budget-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;margin-bottom:18px;box-shadow:var(--shadow);}
.budget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;}
.budget-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);}
.budget-track{height:4px;background:var(--border);border-radius:99px;overflow:hidden;}
.budget-fill{height:100%;border-radius:99px;transition:width .9s cubic-bezier(.34,1.56,.64,1);}
.budget-footer{display:flex;justify-content:space-between;margin-top:6px;font-size:10.5px;color:var(--text3);}

/* Charts */
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;}
.chart-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;box-shadow:var(--shadow);}
.chart-card.wide{grid-column:1/-1;}
.chart-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:14px;}
.pie-row{display:flex;align-items:center;gap:12px;}
.pie-legend{display:flex;flex-direction:column;gap:6px;flex:1;overflow:hidden;}
.pie-legend-item{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text2);}
.pie-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.pie-legend-val{margin-left:auto;font-weight:600;font-size:10.5px;white-space:nowrap;}

/* Form */
.form-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:26px;box-shadow:var(--shadow);}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;}
.fg{display:flex;flex-direction:column;gap:5px;}
.fg.full{grid-column:1/-1;}
.fl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;color:var(--text3);}
.fi,.fs{background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:10px 12px;color:var(--text);font-size:13.5px;width:100%;outline:none;transition:border-color .18s,box-shadow .18s;-webkit-appearance:none;appearance:none;}
.fs{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%235A5A5A' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:30px;}
.fi:focus,.fs:focus{border-color:rgba(200,169,110,.5);box-shadow:0 0 0 3px rgba(200,169,110,.07);}
.fi::placeholder{color:var(--text3);}

/* Type toggle */
.type-toggle{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid var(--border);border-radius:var(--rx);overflow:hidden;}
.type-btn{padding:10px 4px;text-align:center;cursor:pointer;font-size:11px;font-weight:500;transition:all .17s;color:var(--text3);border:none;background:var(--surface);}
.type-btn.active.expense{background:var(--expense-dim);color:var(--expense);}
.type-btn.active.income{background:var(--income-dim);color:var(--income);}
.type-btn.active.investment{background:var(--invest-dim);color:var(--invest);}
.type-btn.active.insurance{background:var(--insure-dim);color:var(--insure);}
.btn-primary{background:var(--accent);color:#FFF8EE;border:none;border-radius:var(--rx);padding:12px 24px;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .18s;width:100%;margin-top:3px;}
.btn-primary:hover{background:var(--accent-h);transform:translateY(-1px);box-shadow:0 5px 18px rgba(200,169,110,.25);}
body.light .btn-primary{color:#fff;}
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
.tx-item{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:12px 14px;display:flex;align-items:center;gap:11px;transition:all .17s;animation:fadeIn .28s ease;box-shadow:var(--shadow);}
.tx-item:hover{border-color:var(--border-l);background:var(--card-hover);}
.tx-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
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
.tx-amount{font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums;}
.tx-amount.income{color:var(--income);}
.tx-amount.expense{color:var(--expense);}
.tx-amount.investment{color:var(--invest);}
.tx-amount.insurance{color:var(--insure);}
.tx-date{font-size:9.5px;color:var(--text3);margin-top:2px;}
.empty-state{text-align:center;padding:44px 24px;color:var(--text3);}
.empty-state .es-icon{font-size:34px;margin-bottom:10px;}
.empty-state p{font-size:12.5px;}

/* Markets */
.market-tabs{display:flex;gap:5px;margin-bottom:18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;width:fit-content;flex-wrap:wrap;}
.market-tab{padding:7px 14px;border-radius:5px;font-size:11.5px;font-weight:500;cursor:pointer;color:var(--text3);transition:all .17s;border:none;background:none;white-space:nowrap;}
.market-tab.active{background:var(--card);color:var(--text);box-shadow:0 1px 6px rgba(0,0,0,.2);}
.market-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;}
.mkt-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:12px 14px;transition:all .18s;box-shadow:var(--shadow);}
.mkt-card:hover{border-color:var(--border-l);transform:translateY(-1px);}
.mkt-card.index-card{border-color:rgba(200,169,110,.2);background:var(--accent-dim);}
.mkt-name{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mkt-symbol{font-size:9px;color:var(--text3);margin-bottom:7px;}
.mkt-sector{display:inline-block;padding:1px 7px;border-radius:99px;font-size:8.5px;font-weight:600;background:var(--border);color:var(--text3);margin-bottom:7px;}
.mkt-price{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:700;color:var(--text);}
.mkt-change{font-size:10px;font-weight:600;margin-top:3px;}
.mkt-change.up{color:var(--income);}
.mkt-change.down{color:var(--expense);}
.mkt-loading{font-size:10px;color:var(--text3);animation:pulse2 1.2s infinite;margin-top:8px;}
.refresh-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
.refresh-bar p{font-size:11px;color:var(--text3);}
.spinner{width:13px;height:13px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;}
.stock-search-bar{display:flex;gap:8px;margin-bottom:8px;}
.stock-search{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:9px 13px;color:var(--text);font-size:13px;outline:none;transition:border-color .18s;}
.stock-search:focus{border-color:rgba(200,169,110,.4);}
.stock-search::placeholder{color:var(--text3);}
.search-hint{font-size:10.5px;color:var(--text3);margin-bottom:14px;}
.mf-search-row{display:flex;gap:8px;margin-bottom:14px;}
.mf-search{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:9px 13px;color:var(--text);font-size:13px;outline:none;transition:border-color .18s;}
.mf-search:focus{border-color:rgba(200,169,110,.4);}
.mf-search::placeholder{color:var(--text3);}
.mf-results{display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto;}
.mf-item{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;animation:fadeIn .25s ease;box-shadow:var(--shadow);}
.mf-item-name{font-size:12px;font-weight:500;color:var(--text);flex:1;}
.mf-nav{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:700;color:var(--invest);}
.mf-date{font-size:9.5px;color:var(--text3);margin-top:2px;text-align:right;}
.market-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin:16px 0 8px;}

/* Settings */
.settings-section{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:22px;margin-bottom:12px;box-shadow:var(--shadow);}
.settings-section h3{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;}
.settings-section p{font-size:11.5px;color:var(--text3);margin-bottom:14px;line-height:1.5;}
.setting-row{display:flex;align-items:center;gap:10px;}
.setting-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:10px 12px;color:var(--text);font-size:13.5px;outline:none;transition:border-color .18s;}
.setting-input:focus{border-color:rgba(200,169,110,.5);}
.setting-input::placeholder{color:var(--text3);}
.btn-save{background:var(--accent);color:#FFF8EE;border:none;border-radius:var(--rx);padding:10px 18px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .18s;}
body.light .btn-save{color:#fff;}
.btn-save:hover{background:var(--accent-h);}
.danger-btn{background:none;border:1px solid rgba(248,113,113,.3);border-radius:var(--rx);padding:10px 18px;font-size:12.5px;font-weight:500;color:var(--expense);cursor:pointer;transition:all .18s;}
.danger-btn:hover{background:var(--expense-dim);border-color:rgba(248,113,113,.6);}

/* Icon button */
.icon-btn{display:flex;align-items:center;gap:5px;background:none;border:1px solid var(--border);border-radius:var(--rx);padding:6px 12px;font-size:11.5px;font-weight:500;color:var(--text2);cursor:pointer;transition:all .18s;}
.icon-btn:hover{color:var(--accent);border-color:rgba(200,169,110,.35);background:var(--accent-dim);}

/* Portfolio cards */
.portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;}
.port-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rx);padding:13px 15px;transition:border-color .18s,transform .18s;}
.port-card:hover{transform:translateY(-1px);}
.port-icon{font-size:20px;margin-bottom:7px;}
.port-name{font-size:10.5px;font-weight:600;color:var(--text2);margin-bottom:3px;}
.port-amt{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:700;}
.port-sub{font-size:9.5px;color:var(--text3);margin-top:2px;}

/* Import */
.import-dropzone{border:2px dashed var(--border);border-radius:var(--r);padding:40px 24px;text-align:center;cursor:pointer;transition:all .2s;background:var(--card);}
.import-dropzone:hover{border-color:var(--accent);background:var(--accent-dim);}

/* Bottom nav */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);z-index:200;padding-bottom:env(safe-area-inset-bottom,0px);}
.bnav-items{display:flex;justify-content:space-around;}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 5px;cursor:pointer;color:var(--text3);font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;transition:color .17s;min-width:0;flex:1;}
.bnav-item .bnav-icon{font-size:17px;}
.bnav-item.active{color:var(--accent);}
.bnav-fab{background:var(--accent);border:none;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:19px;cursor:pointer;color:#1A1208;box-shadow:0 4px 14px rgba(200,169,110,.4);transition:transform .18s;margin-top:-10px;}
.bnav-fab:hover{transform:scale(1.09);}

/* Toast */
.toast{position:fixed;top:20px;right:20px;background:var(--card2);border:1px solid var(--border);border-radius:var(--rx);padding:10px 16px;font-size:12.5px;z-index:9999;animation:toastIn .28s ease;box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;align-items:center;gap:7px;max-width:320px;}
.toast.success{border-color:rgba(52,211,153,.4);color:var(--income);}
.toast.error{border-color:rgba(248,113,113,.4);color:var(--expense);}
.toast.warning{border-color:rgba(200,169,110,.4);color:var(--accent);}

/* Login */
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:hidden;}
.login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(200,169,110,.08) 0%,transparent 70%);pointer-events:none;}
.login-card{width:100%;max-width:390px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:34px;animation:slideUp .42s ease;position:relative;z-index:1;box-shadow:var(--shadow);}
.login-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:var(--accent);text-align:center;margin-bottom:3px;}
.login-tagline{font-size:11.5px;color:var(--text3);text-align:center;margin-bottom:24px;}
.auth-method-tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;margin-bottom:18px;}
.auth-method-tab{padding:8px;text-align:center;border-radius:5px;cursor:pointer;font-size:12.5px;font-weight:500;color:var(--text3);transition:all .17s;border:none;background:none;}
.auth-method-tab.active{background:var(--card);color:var(--text);}
.signin-tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;margin-bottom:18px;}
.signin-tab{padding:7px;text-align:center;border-radius:5px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text3);transition:all .17s;border:none;background:none;}
.signin-tab.active{background:var(--card);color:var(--text);}
.auth-error{background:var(--expense-dim);border:1px solid rgba(248,113,113,.3);border-radius:var(--rx);padding:9px 13px;font-size:11.5px;color:var(--expense);margin-bottom:13px;}
.auth-success{background:var(--income-dim);border:1px solid rgba(52,211,153,.3);border-radius:var(--rx);padding:9px 13px;font-size:11.5px;color:var(--income);margin-bottom:13px;}
.google-btn{width:100%;padding:11px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer;transition:all .17s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:9px;}
.google-btn:hover{border-color:var(--border-l);background:var(--card-hover);}
.divider{display:flex;align-items:center;gap:9px;margin:12px 0;color:var(--text3);font-size:10.5px;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border);}
.forgot-link{font-size:11px;color:var(--accent);cursor:pointer;text-align:right;margin-top:-4px;margin-bottom:10px;display:block;}
.forgot-link:hover{text-decoration:underline;}
.otp-inputs{display:flex;gap:8px;margin-bottom:14px;}
.otp-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:12px;color:var(--text);font-size:20px;font-weight:700;text-align:center;outline:none;transition:border-color .18s;letter-spacing:4px;}
.otp-input:focus{border-color:rgba(200,169,110,.5);}
.phone-prefix{background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:var(--rx) 0 0 var(--rx);padding:10px 12px;color:var(--text2);font-size:13.5px;display:flex;align-items:center;}
.phone-input{flex:1;background:var(--surface);border:1px solid var(--border);border-left:none;border-radius:0 var(--rx) var(--rx) 0;padding:10px 12px;color:var(--text);font-size:13.5px;outline:none;transition:border-color .18s;}
.phone-input:focus{border-color:rgba(200,169,110,.5);}
.phone-row{display:flex;margin-bottom:14px;}
.resend-link{font-size:11px;color:var(--accent);cursor:pointer;text-align:center;margin-top:8px;display:block;}
.resend-link:hover{text-decoration:underline;}

/* Responsive */
@media(max-width:768px){
  .sidebar{display:none;}
  .bottom-nav{display:block;}
  .content{padding:18px 14px 88px;}
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
  .toast{top:auto;bottom:82px;right:12px;left:12px;}
  .pie-row{flex-direction:column;}
  .market-grid{grid-template-columns:1fr 1fr;}
  .portfolio-grid{grid-template-columns:1fr 1fr;}
  .market-tabs{width:100%;}
}
@media(max-width:420px){
  .market-grid{grid-template-columns:1fr 1fr;}
  .portfolio-grid{grid-template-columns:1fr;}
}
`;

// ─── Tooltip components ───────────────────────────────────────────────────────
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

// ─── MonthStrip ───────────────────────────────────────────────────────────────
function MonthStrip({ months, selectedMonth, setSelectedMonth }) {
  return (
    <div className="month-strip">
      <button className={`month-chip alltime ${selectedMonth === "all" ? "active" : ""}`} onClick={() => setSelectedMonth("all")}>
        All Time
      </button>
      {months.map((m) => (
        <button key={m.value} className={`month-chip ${selectedMonth === m.value ? "active" : ""}`}
          onClick={() => setSelectedMonth(m.value)}>{m.label}
        </button>
      ))}
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onSignup, onGoogle, onPhoneLogin }) {
  const [authTab, setAuthTab]       = useState("email");    // email | phone
  const [signTab, setSignTab]       = useState("signin");   // signin | signup
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [phone, setPhone]           = useState("");
  const [otp, setOtp]               = useState("");
  const [step, setStep]             = useState("phone");    // phone | otp
  const [confirmation, setConf]     = useState(null);
  const [forgot, setForgot]         = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");
  const [success, setSuccess]       = useState("");

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
      setSuccess("✓ Reset link sent! Check your email inbox.");
    } catch (e) { setErr(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  const sendOTP = async () => {
    if (!phone || phone.length < 10) { setErr("Enter a valid 10-digit mobile number"); return; }
    setErr(""); setLoading(true);
    try {
      if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, window.recaptchaVerifier);
      setConf(result);
      setStep("otp");
      setSuccess("OTP sent to +91-" + phone);
    } catch (e) { setErr(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length < 4) { setErr("Enter the OTP"); return; }
    setErr(""); setLoading(true);
    try {
      await confirmation.confirm(otp);
    } catch (e) { setErr("Invalid OTP. Please try again."); }
    finally { setLoading(false); }
  };

  if (forgot) return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Reset your password</div>
        {err && <div className="auth-error">{err}</div>}
        {success && <div className="auth-success">{success}</div>}
        {!success && <>
          <div className="fg" style={{ marginBottom:14 }}>
            <label className="fl">Email Address</label>
            <input className="fi" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleForgot()} />
          </div>
          <button className="btn-primary" onClick={handleForgot} disabled={loading}>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </>}
        <button className="btn-secondary" onClick={() => { setForgot(false); setErr(""); setSuccess(""); }}>
          ← Back to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="login-page">
      <div id="recaptcha-container" />
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Smart money. Clear picture.</div>

        <div className="auth-method-tabs">
          <button className={`auth-method-tab ${authTab==="email" ? "active" : ""}`} onClick={() => { setAuthTab("email"); setErr(""); setSuccess(""); }}>📧 Email</button>
          <button className={`auth-method-tab ${authTab==="phone" ? "active" : ""}`} onClick={() => { setAuthTab("phone"); setErr(""); setSuccess(""); }}>📱 Mobile OTP</button>
        </div>

        {err && <div className="auth-error">{err}</div>}
        {success && <div className="auth-success">{success}</div>}

        {authTab === "email" ? (
          <>
            <div className="signin-tabs">
              <button className={`signin-tab ${signTab==="signin"?"active":""}`} onClick={() => setSignTab("signin")}>Sign In</button>
              <button className={`signin-tab ${signTab==="signup"?"active":""}`} onClick={() => setSignTab("signup")}>Sign Up</button>
            </div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="fg" style={{ marginBottom:4 }}>
              <label className="fl">Password</label>
              <input className="fi" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()} />
            </div>
            {signTab === "signin" && (
              <span className="forgot-link" onClick={() => { setForgot(true); setErr(""); }}>Forgot password?</span>
            )}
            <button className="btn-primary" onClick={handleEmail} disabled={loading} style={{ marginTop:10 }}>
              {loading ? "Please wait…" : signTab === "signin" ? "Sign In" : "Create Account"}
            </button>
            <div className="divider">or</div>
            <button className="google-btn" onClick={onGoogle}><span style={{ fontWeight:700 }}>G</span> Continue with Google</button>
          </>
        ) : (
          <>
            {step === "phone" ? (
              <>
                <div className="fg" style={{ marginBottom:14 }}>
                  <label className="fl">Mobile Number (India +91)</label>
                  <div className="phone-row">
                    <div className="phone-prefix">🇮🇳 +91</div>
                    <input className="phone-input" type="tel" placeholder="9876543210" maxLength={10}
                      value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g,""))}
                      onKeyDown={(e) => e.key === "Enter" && sendOTP()} />
                  </div>
                </div>
                <button className="btn-primary" onClick={sendOTP} disabled={loading}>
                  {loading ? "Sending OTP…" : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize:12, color:"var(--text3)", marginBottom:12 }}>
                  Enter the 6-digit OTP sent to +91-{phone}
                </p>
                <div className="fg" style={{ marginBottom:14 }}>
                  <label className="fl">One-Time Password</label>
                  <input className="otp-input" type="tel" maxLength={6} placeholder="------"
                    value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g,""))}
                    onKeyDown={(e) => e.key === "Enter" && verifyOTP()} />
                </div>
                <button className="btn-primary" onClick={verifyOTP} disabled={loading}>
                  {loading ? "Verifying…" : "Verify OTP"}
                </button>
                <span className="resend-link" onClick={() => { setStep("phone"); setOtp(""); setErr(""); setSuccess(""); }}>
                  ← Change number / Resend
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ income, expense, investment, insurance, balance, budget, budgetProgress, budgetColor,
  expPieData, invPieData, insPieData, trendData, months, selectedMonth, setSelectedMonth }) {
  const fmt = (n) => fmtINR(n);
  const budgetNum = parseFloat(budget) || 0;

  return (
    <>
      <div className="page-header">
        <div><h1>Dashboard</h1>
          <p>{selectedMonth === "all" ? "All-time financial summary" : "Monthly overview — " + selectedMonth}</p>
        </div>
      </div>
      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      {/* 5 Summary Cards */}
      <div className="summary-grid" style={{ gridTemplateColumns:"repeat(5,1fr)" }}>
        <div className="summary-card" style={{ gridColumn:"1 / span 2" }}>
          <div className="sc-label">Net Balance</div>
          <div className="sc-value balance">{balance >= 0 ? fmt(balance) : "-" + fmtINR(Math.abs(balance))}</div>
          <div className="sc-sub">Income − Expense</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Income</div>
          <div className="sc-value income">{fmt(income)}</div>
          <div className="sc-sub">earned</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Expense</div>
          <div className="sc-value expense">{fmt(expense)}</div>
          <div className="sc-sub">spent</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Invested</div>
          <div className="sc-value investment">{fmt(investment)}</div>
          <div className="sc-sub">deployed</div>
        </div>
      </div>
      <div className="summary-grid" style={{ gridTemplateColumns:"repeat(4,1fr)", marginTop:-6 }}>
        <div className="summary-card">
          <div className="sc-label">Insurance Premium</div>
          <div className="sc-value insurance">{fmt(insurance)}</div>
          <div className="sc-sub">paid</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Savings Rate</div>
          <div className="sc-value" style={{ color: income > 0 && (income - expense) / income > 0 ? "var(--income)" : "var(--expense)" }}>
            {income > 0 ? (((income - expense) / income) * 100).toFixed(1) + "%" : "—"}
          </div>
          <div className="sc-sub">of income saved</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Investment Rate</div>
          <div className="sc-value" style={{ color:"var(--invest)" }}>
            {income > 0 ? ((investment / income) * 100).toFixed(1) + "%" : "—"}
          </div>
          <div className="sc-sub">of income invested</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Outflow</div>
          <div className="sc-value" style={{ color:"var(--text2)" }}>
            {fmt(expense + investment + insurance)}
          </div>
          <div className="sc-sub">exp + inv + ins</div>
        </div>
      </div>

      {/* Budget Bar */}
      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="budget-title">Monthly Expense Budget</span>
            <span style={{ color:budgetColor, fontSize:12.5, fontWeight:600 }}>{fmt(expense)} / {fmt(budgetNum)}</span>
          </div>
          <div className="budget-track">
            <div className="budget-fill" style={{ width:`${budgetProgress}%`, background:budgetColor }} />
          </div>
          <div className="budget-footer">
            <span>{budgetProgress.toFixed(0)}% used</span>
            <span style={{ color: budgetNum-expense > 0 ? "var(--income)" : "var(--expense)" }}>
              {budgetNum-expense > 0 ? fmt(budgetNum-expense) + " remaining" : fmtINR(expense-budgetNum) + " over budget"}
            </span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-row">
        {/* Expense pie */}
        <div className="chart-card">
          <div className="chart-title">Expense Breakdown</div>
          {expPieData.length > 0 ? (
            <div className="pie-row">
              <PieChart width={112} height={112}>
                <Pie data={expPieData} dataKey="value" cx={52} cy={52} innerRadius={30} outerRadius={50} paddingAngle={2}>
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

        {/* Daily Cash Flow */}
        <div className="chart-card">
          <div className="chart-title">Daily Cash Flow</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={148}>
              <AreaChart data={trendData} margin={{ top:4, right:4, left:-32, bottom:0 }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8A96E" stopOpacity={0.28} />
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

        {/* Investment pie */}
        {invPieData.length > 0 && (
          <div className="chart-card">
            <div className="chart-title" style={{ color:"var(--invest)" }}>Investment Allocation</div>
            <div className="pie-row">
              <PieChart width={112} height={112}>
                <Pie data={invPieData} dataKey="value" cx={52} cy={52} innerRadius={30} outerRadius={50} paddingAngle={2}>
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

        {/* Insurance pie */}
        {insPieData.length > 0 && (
          <div className="chart-card">
            <div className="chart-title" style={{ color:"var(--insure)" }}>Insurance Premiums</div>
            <div className="pie-row">
              <PieChart width={112} height={112}>
                <Pie data={insPieData} dataKey="value" cx={52} cy={52} innerRadius={30} outerRadius={50} paddingAngle={2}>
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

// ─── AddForm ──────────────────────────────────────────────────────────────────
function AddForm({ amount, setAmount, type, setType, category, setCategory, note, setNote, date, setDate, editId, onSubmit, onCancel }) {
  const getCats = (t) => t === "income" ? INCOME_CATEGORIES : t === "investment" ? INVESTMENT_CATEGORIES : t === "insurance" ? INSURANCE_CATEGORIES : EXPENSE_CATEGORIES;
  const getDefault = (t) => t === "income" ? "Salary" : t === "investment" ? "Stocks — NSE/BSE" : t === "insurance" ? "Term Life Insurance" : "Food & Dining";
  const changeType = (t) => { setType(t); setCategory(getDefault(t)); };

  return (
    <>
      <div className="page-header">
        <div><h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>Record income, expense, investment or insurance</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="fg full">
            <label className="fl">Transaction Type</label>
            <div className="type-toggle">
              {["expense","income","investment","insurance"].map((t) => (
                <button key={t} className={`type-btn ${type===t ? "active "+t : ""}`} onClick={() => changeType(t)}>
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
            <label className="fl">Note (optional)</label>
            <input className="fi" type="text" placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
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

// ─── History ──────────────────────────────────────────────────────────────────
function History({ filtered, search, setSearch, filterCategory, setFilterCategory, filterType, setFilterType,
  onEdit, onDelete, onExport, months, selectedMonth, setSelectedMonth }) {
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES, ...INSURANCE_CATEGORIES];

  return (
    <>
      <div className="page-header">
        <div><h1>Transactions</h1><p>{filtered.length} record{filtered.length!==1?"s":""}</p></div>
        <button className="icon-btn" onClick={onExport}>↓ CSV</button>
      </div>
      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {["all","expense","income","investment","insurance"].map((t) => (
            <button key={t} className={`filter-chip ${filterType===t ? "active"+(t==="investment"?" inv-chip":t==="insurance"?" ins-chip":"") : ""}`}
              onClick={() => setFilterType(t)}>
              {t==="all" ? "All" : TYPE_META[t]?.icon+" "+TYPE_META[t]?.label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filter-strip">
        <button className={`filter-chip ${!filterCategory?"active":""}`} onClick={() => setFilterCategory("")}>All Categories</button>
        {allCats.map((c) => (
          <button key={c} className={`filter-chip ${filterCategory===c?"active":""}`} onClick={() => setFilterCategory(filterCategory===c?"":c)}>
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">📭</div><p>No transactions found</p></div>
          : filtered.map((e) => (
            <div key={e.id} className="tx-item">
              <div className={`tx-icon ${e.type}`}>{CATEGORY_ICONS[e.category] || "💸"}</div>
              <div className="tx-info">
                <div className="tx-cat">
                  {e.category}
                  <span className={`tx-badge ${e.type}`}>{TYPE_META[e.type]?.label || e.type}</span>
                </div>
                <div className="tx-note">{e.note || <span style={{ fontStyle:"italic" }}>No note</span>}</div>
              </div>
              <div className="tx-actions">
                <button className="tx-btn" onClick={() => onEdit(e)}>Edit</button>
                <button className="tx-btn del" onClick={() => onDelete(e.id)}>Delete</button>
              </div>
              <div className="tx-meta">
                <div className={`tx-amount ${e.type}`}>{TYPE_META[e.type]?.sign || ""}₹{e.amount.toLocaleString("en-IN")}</div>
                <div className="tx-date">{e.date}</div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ─── Markets Tab ──────────────────────────────────────────────────────────────

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
  for (const ep of ["v8","v7"]) {
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

function PriceCard({ name, symbol, price, changePct, change, unit, sector, isIndex, error }) {
  const up = (changePct ?? 0) >= 0;
  return (
    <div className={`mkt-card${isIndex ? " index-card" : ""}`}>
      <div className="mkt-name" title={name}>{name}</div>
      <div className="mkt-symbol">{symbol}</div>
      {sector && <div className="mkt-sector">{sector}</div>}
      {error ? (
        <div style={{ fontSize:11, color:"var(--text3)", marginTop:6 }}>Rate limited · Retry in 15 min</div>
      ) : price == null ? (
        <div className="mkt-loading">Fetching…</div>
      ) : (
        <>
          <div className="mkt-price">
            {!unit || unit === "₹" || unit === "pts" ? "" : ""}
            {price?.toLocaleString("en-IN", { maximumFractionDigits: price > 1000 ? 0 : 2 })}
            {unit && unit !== "₹" ? <span style={{ fontSize:9.5, color:"var(--text3)", marginLeft:3 }}>{unit}</span> : ""}
          </div>
          {changePct != null && (
            <div className={`mkt-change ${up ? "up" : "down"}`}>
              {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
              {change != null && <span style={{ opacity:.6, marginLeft:4, fontWeight:400 }}>({change >= 0?"+":""}{change.toFixed(1)})</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Markets() {
  const [mktTab, setMktTab]         = useState("stocks");
  const [stockTab, setStockTab]     = useState("nse");  // nse | bse | us
  const [indices, setIndices]       = useState([]);
  const [nseStocks, setNseStocks]   = useState([]);
  const [bseStocks, setBseStocks]   = useState([]);
  const [usStocks, setUsStocks]     = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [crypto, setCrypto]         = useState([]);
  const [mfQuery, setMfQuery]       = useState("");
  const [mfResults, setMfResults]   = useState([]);
  const [mfLoading, setMfLoading]   = useState(false);
  // Stock search
  const [stockQuery, setStockQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  // State
  const [loading, setLoading]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [fetchErr, setFetchErr]     = useState(false);
  const timer = useRef(null);

  const loadBatch = useCallback(async (stocks, setter) => {
    const symbols = stocks.map(s => s.symbol).join(",");
    const quotes = await fetchYahooQuotes(symbols);
    if (!quotes) { setter(stocks.map(s => ({ ...s, error:true }))); return false; }
    setter(stocks.map(s => {
      const q = quotes.find(q => q.symbol === s.symbol);
      return { ...s, price:q?.regularMarketPrice, change:q?.regularMarketChange, changePct:q?.regularMarketChangePercent };
    }));
    return true;
  }, []);

  const fetchCrypto = useCallback(async () => {
    try {
      const ids = CRYPTO_IDS.map(c => c.id).join(",");
      const data = await fetchDirect(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr&include_24hr_change=true`, 11000
      );
      setCrypto(CRYPTO_IDS.map(c => ({ ...c, price:data[c.id]?.inr, changePct:data[c.id]?.inr_24h_change })));
    } catch {
      try {
        const ids = CRYPTO_IDS.map(c => c.id).join(",");
        const data = await fetchDirect(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=${ids}&per_page=10&page=1&price_change_percentage=24h`, 11000
        );
        setCrypto(CRYPTO_IDS.map(c => {
          const coin = data?.find(d => d.id === c.id);
          return { ...c, price:coin?.current_price, changePct:coin?.price_change_percentage_24h };
        }));
      } catch { setCrypto(CRYPTO_IDS.map(c => ({ ...c, error:true }))); }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true); setFetchErr(false);
    const [r1, r2, r3, r4] = await Promise.allSettled([
      loadBatch(INDICES, setIndices),
      loadBatch(TRENDING_NSE, setNseStocks),
      loadBatch(TRENDING_BSE, setBseStocks),
      loadBatch(TRENDING_US, setUsStocks),
    ]);
    await Promise.allSettled([
      loadBatch(COMMODITY_SYMBOLS, setCommodities),
      fetchCrypto(),
    ]);
    const anyFailed = [r1,r2,r3,r4].some(r => r.status === "rejected" || r.value === false);
    if (anyFailed) setFetchErr(true);
    setLastUpdate(new Date());
    setLoading(false);
  }, [loadBatch, fetchCrypto]);

  useEffect(() => {
    refreshAll();
    timer.current = setInterval(refreshAll, 15 * 60 * 1000); // 15 minutes
    return () => clearInterval(timer.current);
  }, [refreshAll]);

  // Search any stock (NSE suffix .NS, BSE .BO, or bare for US)
  const searchStock = async () => {
    const q = stockQuery.trim();
    if (!q) return;
    setSearching(true); setSearchResults([]);
    // Build symbols to try: raw, .NS, .BO variants
    const trySymbols = [];
    const upper = q.toUpperCase();
    if (upper.endsWith(".NS") || upper.endsWith(".BO")) { trySymbols.push(upper); }
    else {
      trySymbols.push(upper);           // US or index
      trySymbols.push(upper + ".NS");   // NSE
      trySymbols.push(upper + ".BO");   // BSE
    }
    const quotes = await fetchYahooQuotes(trySymbols.join(","));
    if (quotes?.length) {
      setSearchResults(quotes.filter(q => q.regularMarketPrice != null).map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        sector: q.sector || (q.symbol.endsWith(".NS") ? "NSE" : q.symbol.endsWith(".BO") ? "BSE" : "US"),
      })));
    }
    setSearching(false);
  };

  const searchMF = async () => {
    if (!mfQuery.trim()) return;
    setMfLoading(true);
    try {
      const list = await fetchDirect(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(mfQuery)}`, 12000);
      const top = (list || []).slice(0, 8);
      const navs = await Promise.allSettled(top.map(async f => {
        const d = await fetchDirect(`https://api.mfapi.in/mf/${f.schemeCode}/latest`, 8000);
        return { code:f.schemeCode, name:f.schemeName, nav:d?.data?.[0]?.nav, date:d?.data?.[0]?.date };
      }));
      setMfResults(navs.map((r,i) => r.status === "fulfilled" ? r.value : { code:top[i]?.schemeCode, name:top[i]?.schemeName, nav:null }));
    } catch { setMfResults([]); }
    finally { setMfLoading(false); }
  };

  const activeStocks = stockTab === "nse" ? nseStocks : stockTab === "bse" ? bseStocks : usStocks;

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
        <p style={{ fontSize:11, color:"var(--text3)" }}>
          {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString("en-IN")} · Auto-refreshes every 15 min` : "Loading live data…"}
        </p>
        {fetchErr && <span style={{ fontSize:10.5, color:"var(--insure)" }}>⚠ Some data rate-limited — will retry</span>}
      </div>

      {/* Global Indices always visible */}
      <div className="market-section-title">Global Indices</div>
      <div className="market-grid" style={{ gridTemplateColumns:"repeat(5,1fr)", marginBottom:18 }}>
        {indices.map(s => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol} price={s.price} changePct={s.changePct} change={s.change} unit={s.unit} isIndex error={s.error} />)}
      </div>

      <div className="market-tabs">
        {[["stocks","📊 Stocks"],["mf","📈 Mutual Funds"],["crypto","₿ Crypto"],["commodities","🥇 Commodities"]].map(([id,label]) => (
          <button key={id} className={`market-tab ${mktTab===id?"active":""}`} onClick={() => setMktTab(id)}>{label}</button>
        ))}
      </div>

      {mktTab === "stocks" && (
        <>
          {/* Stock search */}
          <div className="stock-search-bar">
            <input className="stock-search" placeholder="Search any stock: e.g. INFY, INFY.NS, INFY.BO, AAPL, TSLA…"
              value={stockQuery} onChange={e => setStockQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchStock()} />
            <button className="btn-primary" style={{ width:"auto", margin:0, padding:"9px 18px" }} onClick={searchStock} disabled={searching}>
              {searching ? "…" : "Search"}
            </button>
          </div>
          <div className="search-hint">
            💡 Add <strong>.NS</strong> for NSE (e.g. RELIANCE.NS) · <strong>.BO</strong> for BSE (e.g. RELIANCE.BO) · No suffix for US (e.g. AAPL)
          </div>

          {searchResults.length > 0 && (
            <>
              <div className="market-section-title">Search Results</div>
              <div className="market-grid" style={{ marginBottom:18 }}>
                {searchResults.map(s => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol} price={s.price} changePct={s.changePct} change={s.change} unit="₹" sector={s.sector} error={s.error} />)}
              </div>
            </>
          )}

          {/* Trending tabs: NSE / BSE / US */}
          <div className="market-section-title">Trending</div>
          <div style={{ display:"flex", gap:5, marginBottom:12 }}>
            {[["nse","🇮🇳 NSE"],["bse","🏛 BSE"],["us","🇺🇸 US"]].map(([id,label]) => (
              <button key={id} style={{ padding:"5px 14px", borderRadius:99, fontSize:11.5, fontWeight:500, border:"1px solid var(--border)", background: stockTab===id ? "var(--accent-dim)" : "none", color: stockTab===id ? "var(--accent)" : "var(--text3)", cursor:"pointer", transition:"all .15s" }}
                onClick={() => setStockTab(id)}>{label}</button>
            ))}
          </div>
          <div className="market-grid">
            {activeStocks.map(s => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol.replace(/\.(NS|BO)$/,"")} price={s.price} changePct={s.changePct} change={s.change} unit="₹" sector={s.sector} error={s.error} />)}
          </div>
        </>
      )}

      {mktTab === "mf" && (
        <>
          <div className="mf-search-row">
            <input className="mf-search" placeholder="Search mutual fund (e.g. HDFC Midcap, SBI Bluechip, Axis ELSS)…"
              value={mfQuery} onChange={e => setMfQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchMF()} />
            <button className="btn-primary" style={{ width:"auto", margin:0 }} onClick={searchMF} disabled={mfLoading}>
              {mfLoading ? "…" : "Search"}
            </button>
          </div>
          {mfResults.length === 0
            ? <div className="empty-state"><div className="es-icon">📈</div><p>Search a fund to see latest NAV · Data from AMFI via mfapi.in</p></div>
            : <div className="mf-results">
                {mfResults.map(f => (
                  <div key={f.code} className="mf-item">
                    <div className="mf-item-name">{f.name}</div>
                    <div>
                      <div className="mf-nav">{f.nav ? "₹" + parseFloat(f.nav).toFixed(4) : "—"}</div>
                      <div className="mf-date">{f.date || ""}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>
      )}

      {mktTab === "crypto" && (
        <div className="market-grid">
          {crypto.map(c => <PriceCard key={c.id} name={c.name} symbol={c.symbol} price={c.price} changePct={c.changePct} unit="INR" error={c.error} />)}
        </div>
      )}

      {mktTab === "commodities" && (
        <div className="market-grid">
          {commodities.map(c => <PriceCard key={c.symbol} name={c.name} symbol={c.symbol} price={c.price} changePct={c.changePct} change={c.change} unit={c.unit} error={c.error} />)}
        </div>
      )}

      <div style={{ marginTop:18, padding:"10px 14px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--rx)", fontSize:10.5, color:"var(--text3)", lineHeight:1.7 }}>
        ⚠️ Stocks & Commodities: Yahoo Finance public API (may be ~15 min delayed) · Crypto: CoinGecko (live INR) · MF NAV: mfapi.in (official AMFI) · Not investment advice.
      </div>
    </>
  );
}

async function fetchWithFallback(targetUrl, timeoutMs = 9000) {
  for (const proxyFn of PROXIES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(proxyFn(targetUrl), { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      return JSON.parse(text);
    } catch { clearTimeout(timer); /* try next proxy */ }
  }
  throw new Error("All proxies failed");
}

async function fetchDirect(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch (e) { clearTimeout(timer); throw e; }
}

function Markets() {
  const [mktTab, setMktTab]           = useState("stocks");
  const [stocks, setStocks]           = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [crypto, setCrypto]           = useState([]);
  const [mfQuery, setMfQuery]         = useState("");
  const [mfResults, setMfResults]     = useState([]);
  const [mfLoading, setMfLoading]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [stocksErr, setStocksErr]     = useState(false);
  const [commsErr, setCommsErr]       = useState(false);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const refreshTimer = useRef(null);

  const fetchYahooQuotes = async (symbols) => {
    // Try v8 first, then v7 as fallback
    for (const endpoint of ["v8","v7"]) {
      try {
        const url = `https://query1.finance.yahoo.com/${endpoint}/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`;
        const data = await fetchWithFallback(url, 10000);
        const quotes = data?.quoteResponse?.result;
        if (quotes?.length) return quotes;
      } catch {}
    }
    // Try query2 as last resort
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${symbols}`;
      const data = await fetchWithFallback(url, 10000);
      return data?.quoteResponse?.result || [];
    } catch {}
    return null; // signal error
  };

  const fetchStocks = useCallback(async () => {
    setStocksErr(false);
    const symbols = NSE_STOCKS.map(s => s.symbol).join(",");
    const quotes = await fetchYahooQuotes(symbols);
    if (quotes === null) {
      setStocksErr(true);
      setStocks(NSE_STOCKS.map(s => ({ ...s, error: true })));
    } else {
      setStocks(NSE_STOCKS.map(s => {
        const q = quotes.find(q => q.symbol === s.symbol);
        return { ...s, price: q?.regularMarketPrice, change: q?.regularMarketChange, changePct: q?.regularMarketChangePercent };
      }));
    }
  }, []);

  const fetchCommodities = useCallback(async () => {
    setCommsErr(false);
    const symbols = COMMODITY_SYMBOLS.map(s => s.symbol).join(",");
    const quotes = await fetchYahooQuotes(symbols);
    if (quotes === null) {
      setCommsErr(true);
      setCommodities(COMMODITY_SYMBOLS.map(s => ({ ...s, error: true })));
    } else {
      setCommodities(COMMODITY_SYMBOLS.map(s => {
        const q = quotes.find(q => q.symbol === s.symbol);
        return { ...s, price: q?.regularMarketPrice, change: q?.regularMarketChange, changePct: q?.regularMarketChangePercent };
      }));
    }
  }, []);

  const fetchCrypto = useCallback(async () => {
    try {
      const ids = CRYPTO_IDS.map(c => c.id).join(",");
      // CoinGecko is CORS-safe, no proxy needed
      const data = await fetchDirect(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr&include_24hr_change=true`,
        10000
      );
      setCrypto(CRYPTO_IDS.map(c => ({
        ...c, price: data[c.id]?.inr, changePct: data[c.id]?.inr_24h_change,
      })));
    } catch {
      // Try CoinGecko v3 demo endpoint
      try {
        const ids = CRYPTO_IDS.map(c => c.id).join(",");
        const data = await fetchDirect(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=${ids}&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h`,
          10000
        );
        setCrypto(CRYPTO_IDS.map(c => {
          const coin = data?.find(d => d.id === c.id);
          return { ...c, price: coin?.current_price, changePct: coin?.price_change_percentage_24h };
        }));
      } catch { setCrypto(CRYPTO_IDS.map(c => ({ ...c, error: true }))); }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([fetchStocks(), fetchCommodities(), fetchCrypto()]);
    setLastUpdate(new Date());
    setLoading(false);
  }, [fetchStocks, fetchCommodities, fetchCrypto]);

  useEffect(() => {
    refreshAll();
    refreshTimer.current = setInterval(refreshAll, 90000); // 90s to avoid rate limits
    return () => clearInterval(refreshTimer.current);
  }, [refreshAll]);

  const searchMF = async () => {
    if (!mfQuery.trim()) return;
    setMfLoading(true);
    try {
      // mfapi.in is CORS-safe (AMFI official data)
      const list = await fetchDirect(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(mfQuery)}`, 12000);
      const top = (list || []).slice(0, 8);
      const navs = await Promise.allSettled(top.map(async (f) => {
        const d = await fetchDirect(`https://api.mfapi.in/mf/${f.schemeCode}/latest`, 8000);
        return { code: f.schemeCode, name: f.schemeName, nav: d?.data?.[0]?.nav, date: d?.data?.[0]?.date };
      }));
      setMfResults(navs.map((r, i) => r.status === "fulfilled" ? r.value : { code: top[i]?.schemeCode, name: top[i]?.schemeName, nav: null }));
    } catch { setMfResults([]); }
    finally { setMfLoading(false); }
  };

  const PriceCard = ({ name, symbol, price, changePct, change, unit, error }) => {
    const up = (changePct ?? 0) >= 0;
    return (
      <div className="mkt-card">
        <div className="mkt-name">{name}</div>
        <div className="mkt-symbol">{symbol || unit}</div>
        {error ? (
          <>
            <div className="mkt-price" style={{ fontSize:12, color:"var(--text3)" }}>Rate limited</div>
            <div style={{ fontSize:10, color:"var(--text3)", marginTop:3 }}>Try refreshing in 30s</div>
          </>
        ) : price == null ? (
          <div className="mkt-loading">Fetching…</div>
        ) : (
          <>
            <div className="mkt-price">
              {unit === "₹" || !unit ? "₹" : ""}{price?.toLocaleString("en-IN", { maximumFractionDigits:2 })}
              {unit && unit !== "₹" ? <span style={{ fontSize:10, color:"var(--text3)", marginLeft:4 }}>{unit}</span> : ""}
            </div>
            {changePct != null && (
              <div className={`mkt-change ${up?"up":"down"}`}>
                {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                {change != null ? <span style={{ opacity:.6, marginLeft:4 }}>({change >= 0?"+":""}{change.toFixed(2)})</span> : ""}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Live Markets</h1><p>Real-time NSE stocks, MF NAV, crypto & commodities</p></div>
      </div>

      <div className="refresh-bar">
        <p>{lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString("en-IN")} · Auto-refreshes every 60s` : "Fetching live data…"}</p>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {loading && <div className="spinner" />}
          <button className="icon-btn" onClick={refreshAll}>↻ Refresh</button>
        </div>
      </div>

      <div className="market-tabs">
        {[["stocks","📊 NSE Stocks"],["mf","📈 Mutual Funds"],["crypto","₿ Crypto"],["commodities","🥇 Commodities"]].map(([id,label]) => (
          <button key={id} className={`market-tab ${mktTab===id?"active":""}`} onClick={() => setMktTab(id)}>{label}</button>
        ))}
      </div>

      {mktTab === "stocks" && (
        <div className="market-grid">
          {stocks.map((s) => <PriceCard key={s.symbol} name={s.name} symbol={s.symbol.replace(".NS","")} price={s.price} changePct={s.changePct} change={s.change} unit="₹" error={s.error} />)}
        </div>
      )}

      {mktTab === "mf" && (
        <>
          <div className="mf-search-row">
            <input className="mf-search" placeholder="Search any mutual fund (e.g. HDFC, Axis, SBI Bluechip)…"
              value={mfQuery} onChange={(e) => setMfQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMF()} />
            <button className="btn-primary" style={{ width:"auto", margin:0 }} onClick={searchMF} disabled={mfLoading}>
              {mfLoading ? "…" : "Search"}
            </button>
          </div>
          {mfResults.length === 0 ? (
            <div className="empty-state"><div className="es-icon">📈</div><p>Search for a fund to see the latest NAV</p></div>
          ) : (
            <div className="mf-results">
              {mfResults.map((f) => (
                <div key={f.code} className="mf-item">
                  <div className="mf-item-name">{f.name}</div>
                  <div>
                    <div className="mf-nav">{f.nav ? "₹" + parseFloat(f.nav).toFixed(4) : "—"}</div>
                    <div className="mf-date">{f.date || ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mktTab === "crypto" && (
        <div className="market-grid">
          {crypto.map((c) => <PriceCard key={c.id} name={c.name} symbol={c.symbol} price={c.price} changePct={c.changePct} unit="INR" error={c.error} />)}
        </div>
      )}

      {mktTab === "commodities" && (
        <div className="market-grid">
          {commodities.map((c) => <PriceCard key={c.symbol} name={c.name} symbol={c.symbol} price={c.price} changePct={c.changePct} change={c.change} unit={c.unit} error={c.error} />)}
        </div>
      )}

      {(stocksErr || commsErr) && (
        <div style={{ marginTop:14, padding:"10px 14px", background:"rgba(248,113,113,.08)", border:"1px solid rgba(248,113,113,.2)", borderRadius:"var(--rx)", fontSize:11, color:"var(--text2)" }}>
          ⚠️ Yahoo Finance API is rate-limiting requests. Data will retry automatically in 90 seconds, or click Refresh. CoinGecko (crypto) and mfapi.in (MF NAV) are unaffected.
        </div>
      )}
      <div style={{ marginTop:14, padding:"11px 15px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--rx)", fontSize:10.5, color:"var(--text3)", lineHeight:1.7 }}>
        ⚠️ Market data sourced from Yahoo Finance public API (stocks/commodities — may be 15 min delayed), CoinGecko (crypto — live INR), and mfapi.in (MF NAV — official AMFI). Prices are indicative only. Not investment advice.
      </div>
    </>
  );
}

// ─── Import Component ─────────────────────────────────────────────────────────
const ALL_CATS = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
  insurance: INSURANCE_CATEGORIES,
};
const VALID_TYPES = ["income","expense","investment","insurance"];

function normalizeDate(raw) {
  if (!raw) return null;
  raw = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  // MM/DD/YYYY
  const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
  return null;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const cells = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else { cur += c; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g,""));
  const rows = lines.slice(1).filter(l => l.trim()).map(l => parseRow(l));
  return { headers, rows };
}

function autoMapColumns(headers) {
  const map = { date:-1, type:-1, category:-1, amount:-1, note:-1 };
  headers.forEach((h, i) => {
    if (["date","dt","transactiondate","txdate","txndate"].includes(h)) map.date = i;
    else if (["type","txtype","transactiontype","category_type","kind"].includes(h)) map.type = i;
    else if (["category","cat","subcategory"].includes(h)) map.category = i;
    else if (["amount","amt","value","price","inr","rs","rupees"].includes(h)) map.amount = i;
    else if (["note","notes","description","desc","remarks","memo"].includes(h)) map.note = i;
  });
  return map;
}

function ImportPage({ onImport, showToast }) {
  const [step, setStep]           = useState("upload");  // upload | map | preview | importing | done
  const [csvData, setCsvData]     = useState(null);
  const [colMap, setColMap]       = useState({ date:-1, type:-1, category:-1, amount:-1, note:-1 });
  const [parsed, setParsed]       = useState([]);
  const [errors, setErrors]       = useState([]);
  const [progress, setProgress]   = useState(0);
  const [imported, setImported]   = useState(0);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, rows } = parseCSV(text);
      if (!headers.length) { showToast("Could not parse file — check format", "error"); return; }
      const autoMap = autoMapColumns(headers);
      setCsvData({ headers, rows });
      setColMap(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const rows = csvData.rows;
    const result = []; const errs = [];
    rows.forEach((row, i) => {
      const rawDate = colMap.date >= 0 ? row[colMap.date] : "";
      const rawType = colMap.type >= 0 ? row[colMap.type]?.toLowerCase().trim() : "expense";
      const rawCat  = colMap.category >= 0 ? row[colMap.category]?.trim() : "";
      const rawAmt  = colMap.amount >= 0 ? row[colMap.amount] : "0";
      const rawNote = colMap.note >= 0 ? row[colMap.note] : "";

      const date   = normalizeDate(rawDate);
      const amount = parseFloat(rawAmt?.replace(/[^0-9.]/g,"") || "0");
      const type   = VALID_TYPES.includes(rawType) ? rawType : "expense";
      // Try to match category to known list, else use first of type
      const knownCats = ALL_CATS[type] || EXPENSE_CATEGORIES;
      const category = knownCats.find(c => c.toLowerCase() === rawCat.toLowerCase()) || knownCats[0];

      const rowErrors = [];
      if (!date) rowErrors.push("invalid date");
      if (isNaN(amount) || amount <= 0) rowErrors.push("invalid amount");
      if (rowErrors.length) errs.push(`Row ${i+2}: ${rowErrors.join(", ")}`);

      result.push({ date: date || toLocalDateStr(new Date()), type, category, amount: isNaN(amount) ? 0 : amount, note: rawNote, valid: rowErrors.length === 0 });
    });
    setParsed(result);
    setErrors(errs);
    setStep("preview");
  };

  const runImport = async () => {
    setStep("importing");
    const valid = parsed.filter(r => r.valid);
    let done = 0;
    for (const rec of valid) {
      await onImport(rec);
      done++;
      setProgress(Math.round((done / valid.length) * 100));
      setImported(done);
    }
    setStep("done");
    showToast(`✓ Imported ${done} transaction${done !== 1 ? "s" : ""}`, "success");
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
          <div className="import-dropzone" onDragOver={(e)=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
            onDrop={(e)=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}
            style={{ borderColor: dragOver ? "var(--accent)" : undefined, background: dragOver ? "var(--accent-dim)" : undefined }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={(e) => handleFile(e.target.files[0])} />
            <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:5 }}>Drop your CSV file here</div>
            <div style={{ fontSize:12, color:"var(--text3)" }}>or click to browse — supports .csv and .txt</div>
          </div>

          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--rx)", padding:"18px 20px", marginTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px", color:"var(--text3)", marginBottom:10 }}>Expected CSV Format</div>
            <div style={{ fontFamily:"monospace", fontSize:12, color:"var(--text2)", background:"var(--surface)", padding:"10px 14px", borderRadius:"var(--rx)", lineHeight:1.9 }}>
              Date,Type,Category,Amount,Note<br/>
              2026-04-15,expense,Food &amp; Dining,450,Lunch at office<br/>
              2026-04-16,income,Salary,75000,April salary<br/>
              2026-04-17,investment,PPF,5000,Monthly PPF<br/>
              2026-04-18,insurance,Term Life Insurance,1200,HDFC Life premium
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:10, lineHeight:1.7 }}>
              • <strong>Date</strong>: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY<br/>
              • <strong>Type</strong>: income / expense / investment / insurance<br/>
              • <strong>Category</strong>: any known category (or closest match is auto-selected)<br/>
              • <strong>Amount</strong>: number only, no ₹ symbol<br/>
              • <strong>Note</strong>: optional
            </div>
          </div>

          <div style={{ marginTop:14, display:"flex", gap:10, flexWrap:"wrap" }}>
            <button className="btn-primary" style={{ width:"auto" }} onClick={() => {
              const csv = "Date,Type,Category,Amount,Note\n2026-04-15,expense,Food & Dining,450,Sample lunch\n2026-04-16,income,Salary,75000,Monthly salary";
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
              a.download = "finwise_import_template.csv"; a.click();
            }}>⬇ Download Template</button>
          </div>
        </>
      )}

      {step === "map" && csvData && (
        <>
          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"22px", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:4 }}>
              Found {csvData.rows.length} row{csvData.rows.length !== 1 ? "s" : ""} with {csvData.headers.length} columns
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginBottom:18 }}>Map your CSV columns to the correct fields:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {Object.keys(colMap).map(field => (
                <div key={field} className="fg">
                  <label className="fl">{field.charAt(0).toUpperCase()+field.slice(1)}</label>
                  <select className="fs" value={colMap[field]} onChange={e => setColMap(m => ({...m, [field]: parseInt(e.target.value)}))}>
                    <option value={-1}>— Skip —</option>
                    {csvData.headers.map((h, i) => (
                      <option key={i} value={i}>{h} (col {i+1})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:12 }}>
              Preview (first row): {csvData.rows[0]?.join(" | ")}
            </div>
          </div>
          <button className="btn-primary" onClick={buildPreview}>Preview {csvData.rows.length} Rows →</button>
        </>
      )}

      {step === "preview" && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <div style={{ background:"var(--income-dim)", border:"1px solid rgba(52,211,153,.3)", borderRadius:"var(--rx)", padding:"8px 14px", fontSize:12, color:"var(--income)", fontWeight:600 }}>
              ✓ {validCount} valid
            </div>
            {errors.length > 0 && (
              <div style={{ background:"var(--expense-dim)", border:"1px solid rgba(248,113,113,.3)", borderRadius:"var(--rx)", padding:"8px 14px", fontSize:12, color:"var(--expense)", fontWeight:600 }}>
                ✗ {errors.length} will be skipped
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div style={{ background:"var(--card)", border:"1px solid rgba(248,113,113,.2)", borderRadius:"var(--rx)", padding:"12px 16px", marginBottom:14, fontSize:11, color:"var(--text3)", lineHeight:1.8 }}>
              {errors.slice(0,5).map((e,i) => <div key={i}>⚠ {e}</div>)}
              {errors.length > 5 && <div>…and {errors.length-5} more</div>}
            </div>
          )}

          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--r)", overflow:"hidden", marginBottom:16 }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                    {["","Date","Type","Category","Amount","Note"].map(h => (
                      <th key={h} style={{ padding:"9px 13px", textAlign:"left", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.8px", color:"var(--text3)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0,20).map((r, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)", opacity: r.valid ? 1 : 0.4 }}>
                      <td style={{ padding:"8px 13px" }}>{r.valid ? "✓" : "✗"}</td>
                      <td style={{ padding:"8px 13px", color:"var(--text2)" }}>{r.date}</td>
                      <td style={{ padding:"8px 13px" }}>
                        <span className={`tx-badge ${r.type}`}>{TYPE_META[r.type]?.label || r.type}</span>
                      </td>
                      <td style={{ padding:"8px 13px", color:"var(--text)" }}>{CATEGORY_ICONS[r.category] || ""} {r.category}</td>
                      <td style={{ padding:"8px 13px", color: r.type==="income" ? "var(--income)" : "var(--expense)", fontWeight:600 }}>₹{r.amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding:"8px 13px", color:"var(--text3)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > 20 && (
              <div style={{ padding:"9px 14px", fontSize:11, color:"var(--text3)", borderTop:"1px solid var(--border)" }}>
                Showing 20 of {parsed.length} rows
              </div>
            )}
          </div>

          {validCount > 0
            ? <button className="btn-primary" onClick={runImport}>⬆ Import {validCount} Transaction{validCount !== 1 ? "s" : ""}</button>
            : <div style={{ fontSize:13, color:"var(--text3)", padding:"12px 0" }}>No valid rows to import. Go back and check your column mapping.</div>
          }
        </>
      )}

      {step === "importing" && (
        <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"32px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⬆</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:16 }}>Importing {imported} / {validCount}…</div>
          <div style={{ background:"var(--border)", borderRadius:99, height:6, overflow:"hidden", maxWidth:300, margin:"0 auto" }}>
            <div style={{ height:"100%", borderRadius:99, background:"var(--accent)", width:`${progress}%`, transition:"width .3s ease" }} />
          </div>
          <div style={{ fontSize:11, color:"var(--text3)", marginTop:10 }}>{progress}%</div>
        </div>
      )}

      {step === "done" && (
        <div style={{ background:"var(--card)", border:"1px solid rgba(52,211,153,.3)", borderRadius:"var(--r)", padding:"32px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--income)", marginBottom:8 }}>Import Complete!</div>
          <div style={{ fontSize:13, color:"var(--text3)", marginBottom:20 }}>
            {imported} transaction{imported !== 1 ? "s" : ""} imported successfully.
            {errors.length > 0 ? ` ${errors.length} row${errors.length!==1?"s":""} skipped due to errors.` : ""}
          </div>
          <button className="btn-primary" style={{ width:"auto" }} onClick={reset}>Import More</button>
        </div>
      )}
    </>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings({ budget, budgetInput, setBudgetInput, onSaveBudget, user, logout }) {
  return (
    <>
      <div className="page-header"><div><h1>Settings</h1><p>Manage preferences</p></div></div>
      <div className="settings-section">
        <h3>💰 Monthly Expense Budget</h3>
        <p>Set a spending cap. Only expenses count — investments & insurance are tracked separately and won't trigger this alert.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly limit…" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {budget && <div style={{ marginTop:9, fontSize:11.5, color:"var(--text3)" }}>Budget: <span style={{ color:"var(--accent)", fontWeight:600 }}>₹{parseFloat(budget).toLocaleString("en-IN")}</span></div>}
      </div>
      <div className="settings-section">
        <h3>👤 Account</h3>
        <p>Signed in as <strong style={{ color:"var(--text)" }}>{user?.phoneNumber || user?.email || "Google User"}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>
      <div className="settings-section">
        <h3>📋 Finwise Premium — Feature List</h3>
        <p>Everything you have access to:</p>
        <div style={{ fontSize:11.5, color:"var(--text3)", lineHeight:2 }}>
          ✓ Income, Expense, Investment & Insurance tracking<br />
          ✓ 70+ categorised transaction types<br />
          ✓ All-time + monthly filter with correct IST timezone<br />
          ✓ Live NSE/BSE stock prices (Yahoo Finance)<br />
          ✓ Mutual Fund NAV search (AMFI via mfapi.in)<br />
          ✓ Crypto prices in INR (CoinGecko)<br />
          ✓ Gold, Silver, Crude Oil, USD/INR rates<br />
          ✓ Email / Google / Phone OTP login<br />
          ✓ Forgot password reset via email<br />
          ✓ Budget alert with animated progress bar<br />
          ✓ Savings rate & investment rate KPIs<br />
          ✓ Expense, Investment & Insurance pie charts<br />
          ✓ CSV export per period<br />
          ✓ Responsive desktop + mobile web
        </div>
      </div>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]           = useState(null);
  const [amount, setAmount]       = useState("");
  const [type, setType]           = useState("expense");
  const [category, setCategory]   = useState("Food & Dining");
  const [note, setNote]           = useState("");
  const [date, setDate]           = useState(toLocalDateStr(new Date()));
  const [expenses, setExpenses]   = useState([]);
  const [editId, setEditId]       = useState(null);
  const [search, setSearch]                 = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType]         = useState("all");
  const [budget, setBudget]           = useState(localStorage.getItem("budget") || "");
  const [budgetInput, setBudgetInput] = useState(localStorage.getItem("budget") || "");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast]         = useState(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(now));

  useEffect(() => auth.onAuthStateChanged(setUser), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setExpenses(snap.docs.map((d) => ({ id:d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => { localStorage.setItem("budget", budget); }, [budget]);

  useEffect(() => {
    if (!budget || expenses.length === 0) return;
    const exp = expenses.filter((e) => e.type==="expense" && e.date?.startsWith(toYYYYMM(now))).reduce((s,e) => s+e.amount, 0);
    if (exp > parseFloat(budget)) showToast("⚠️ Monthly budget exceeded!", "warning");
  }, [expenses]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogin  = (e, p) => signInWithEmailAndPassword(auth, e, p);
  const handleSignup = (e, p) => createUserWithEmailAndPassword(auth, e, p);
  const handleGoogle = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { throw e; } };
  const logout = () => { signOut(auth); setActiveTab("dashboard"); };

  const submitTransaction = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    const data = { amount: parseFloat(amount), type, category, note, date };
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

  // ── Computed ──
  const recs = selectedMonth === "all" ? expenses : expenses.filter((e) => e.date?.startsWith(selectedMonth));

  const income     = recs.filter(e=>e.type==="income"    ).reduce((s,e)=>s+e.amount, 0);
  const expense    = recs.filter(e=>e.type==="expense"   ).reduce((s,e)=>s+e.amount, 0);
  const investment = recs.filter(e=>e.type==="investment").reduce((s,e)=>s+e.amount, 0);
  const insurance  = recs.filter(e=>e.type==="insurance" ).reduce((s,e)=>s+e.amount, 0);
  const balance    = income - expense;

  const buildPie = (type, colors) => {
    const totals = {};
    recs.filter(e=>e.type===type).forEach(e => { totals[e.category]=(totals[e.category]||0)+e.amount; });
    return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({ name, value }));
  };
  const expPieData = buildPie("expense",  PIE_COLORS);
  const invPieData = buildPie("investment",INV_COLORS);
  const insPieData = buildPie("insurance", INS_COLORS);

  const trend = {};
  recs.filter(e=>e.type!=="investment"&&e.type!=="insurance").forEach(e=>{
    const day = e.date?.split("-")[2]; if(!day) return;
    trend[day]=(trend[day]||0)+(e.type==="income"?e.amount:-e.amount);
  });
  const trendData = Object.entries(trend).sort((a,b)=>+a[0]-+b[0]).map(([day,amount])=>({day:+day,amount}));

  const filtered = recs
    .filter(e =>
      (filterType==="all"||e.type===filterType) &&
      (!search || e.note?.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCategory || e.category===filterCategory)
    )
    .sort((a,b) => new Date(b.date)-new Date(a.date));

  const budgetNum      = parseFloat(budget)||0;
  const budgetProgress = budgetNum ? Math.min((expense/budgetNum)*100,100) : 0;
  const budgetColor    = budgetProgress>90?"var(--expense)":budgetProgress>70?"var(--accent)":"var(--income)";

  // Month strip — local date helpers prevent IST UTC shift bug
  const months = Array.from({length:12},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return { value:toYYYYMM(d), label:MONTH_NAMES[d.getMonth()]+" '"+String(d.getFullYear()).slice(2) };
  });

  const exportCSV = () => {
    const headers = ["Date","Type","Category","Amount","Note"];
    const rows = filtered.map(e=>[e.date,e.type,e.category,e.amount,e.note||""]);
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `finwise-${selectedMonth}.csv`; a.click();
    showToast("✓ CSV exported");
  };

  // ── Login ──
  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginPage onLogin={handleLogin} onSignup={handleSignup} onGoogle={handleGoogle} />
    </>
  );

  const NAV = [
    { id:"dashboard", icon:"◉",  label:"Overview"  },
    { id:"add",       icon:"＋",  label:"Add"       },
    { id:"history",   icon:"≡",   label:"History"   },
    { id:"markets",   icon:"📈",  label:"Markets"   },
    { id:"settings",  icon:"◎",  label:"Settings"  },
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
            <div key={item.id} className={`nav-item ${activeTab===item.id?"active":""}`} onClick={() => setActiveTab(item.id)}>
              <span className="ni">{item.icon}</span>{item.label}
            </div>
          ))}
          <div className="sidebar-spacer" />
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
              <Dashboard income={income} expense={expense} investment={investment} insurance={insurance} balance={balance}
                budget={budget} budgetProgress={budgetProgress} budgetColor={budgetColor}
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
            {activeTab === "markets" && <Markets />}
            {activeTab === "settings" && (
              <Settings budget={budget} budgetInput={budgetInput} setBudgetInput={setBudgetInput}
                onSaveBudget={() => { setBudget(budgetInput); showToast("✓ Budget saved"); }}
                user={user} logout={logout} />
            )}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          <div className="bnav-items">
            {NAV.map(item =>
              item.id === "add" ? (
                <div key="add" className="bnav-item" onClick={() => setActiveTab("add")}>
                  <button className="bnav-fab">+</button>
                </div>
              ) : (
                <div key={item.id} className={`bnav-item ${activeTab===item.id?"active":""}`} onClick={() => setActiveTab(item.id)}>
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
