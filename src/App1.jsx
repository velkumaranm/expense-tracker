import { useState, useEffect, useCallback, useRef } from "react";
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
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc,
} from "firebase/firestore";
import {
  PieChart, Pie, Cell,
  AreaChart, Area,
  BarChart, Bar, Legend,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Timezone-safe helpers ─────────────────────────────────────────────────────
const toYYYYMM = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN");

// ─── Categories ────────────────────────────────────────────────────────────────
const INCOME_CATEGORIES = [
  "Salary", "Freelance", "Business Profit", "Rental Income", "Dividend",
  "Interest Income", "Capital Gains", "Gift", "Bonus / Incentive",
  "Pension", "Agricultural Income", "Side Income", "Other",
];

const EXPENSE_CATEGORIES = [
  "Food & Dining", "Groceries", "Transportation", "Fuel", "Travel",
  "Shopping", "Clothing", "Bills & Utilities", "Electricity", "Water",
  "Internet", "Mobile Recharge", "Health & Medical", "Medicines",
  "Doctor Consultation", "Entertainment", "OTT Subscriptions",
  "Education", "Books", "EMI - Home Loan", "EMI - Car Loan",
  "Personal Loan EMI", "Rent", "Maintenance", "Personal Care",
  "Kids Expenses", "Gym / Fitness", "Charity / Donation",
  "Home Appliances", "Repairs", "Gifts Given", "Other Expense",
];

const INVESTMENT_CATEGORIES = [
  "Stocks - NSE", "Stocks - BSE", "US Stocks",
  "MF - Equity Large Cap", "MF - Equity Mid Cap", "MF - Equity Small Cap",
  "MF - ELSS (Tax Saving)", "MF - Flexi Cap", "MF - Sectoral / Thematic",
  "MF - Debt / Liquid", "MF - Hybrid / Balanced",
  "Index Fund", "ETF - Equity", "ETF - Gold", "ETF - International",
  "PPF", "EPF / PF", "VPF",
  "NPS Tier I", "NPS Tier II",
  "SSY (Sukanya Samriddhi)", "SCSS (Senior Citizen)",
  "NSC", "KVP (Kisan Vikas Patra)",
  "FD (Fixed Deposit)", "RD (Recurring Deposit)",
  "Corporate Bonds", "Government Securities (G-Sec)", "T-Bills",
  "SGB (Sovereign Gold Bond)", "Physical Gold / Jewellery",
  "REITs", "InvITs",
  "Crypto (Bitcoin/Altcoins)",
  "Real Estate / Plot",
  "Angel Investing / Startup",
];

const INSURANCE_CATEGORIES = [
  "Term Life Insurance",
  "Whole Life Insurance",
  "LIC - Endowment Plan",
  "LIC - Money Back Plan",
  "LIC - Jeevan Anand",
  "LIC - Jeevan Labh",
  "LIC - New Endowment Plan",
  "Group Life Insurance (Employer)",
  "Keyman Insurance",
  "ULIP",
  "PLI (Postal Life Insurance)",
  "RPLI (Rural Postal Life Insurance)",
  "Health Insurance - Individual",
  "Health Insurance - Family Floater",
  "Top-Up / Super Top-Up Health Plan",
  "Critical Illness Insurance",
  "Personal Accident Insurance",
  "Hospital Daily Cash Plan",
  "Vehicle Insurance - Car (Comprehensive)",
  "Vehicle Insurance - Car (Third Party)",
  "Vehicle Insurance - Two Wheeler",
  "Vehicle Insurance - Commercial",
  "Home / Property Insurance",
  "Travel Insurance",
  "Cyber Insurance",
  "Business / Shop Insurance",
  "Crop Insurance (PMFBY)",
  "Marine / Cargo Insurance",
];

const CAT_ICONS = {
  // Income
  "Salary":"💼","Freelance":"💻","Business Profit":"📊","Rental Income":"🏘️",
  "Dividend":"💰","Interest Income":"🏦","Capital Gains":"📈","Gift":"🎁",
  "Bonus / Incentive":"🏆","Pension":"👴","Agricultural Income":"🌾","Side Income":"💡","Other":"✨",
  // Expense
  "Food & Dining":"🍽️","Groceries":"🛒","Transportation":"🚗","Fuel":"⛽","Travel":"✈️",
  "Shopping":"🛍️","Clothing":"👗","Bills & Utilities":"📄","Electricity":"⚡","Water":"💧",
  "Internet":"🌐","Mobile Recharge":"📱","Health & Medical":"💊","Medicines":"💊",
  "Doctor Consultation":"👨‍⚕️","Entertainment":"🎬","OTT Subscriptions":"📺",
  "Education":"📚","Books":"📖","EMI - Home Loan":"🏠","EMI - Car Loan":"🚙",
  "Personal Loan EMI":"💳","Rent":"🔑","Maintenance":"🔧","Personal Care":"✂️",
  "Kids Expenses":"👶","Gym / Fitness":"🏋️","Charity / Donation":"❤️",
  "Home Appliances":"🏠","Repairs":"🔨","Gifts Given":"🎀","Other Expense":"💸",
  // Investment
  "Stocks - NSE":"📉","Stocks - BSE":"📊","US Stocks":"🇺🇸",
  "MF - Equity Large Cap":"🏛️","MF - Equity Mid Cap":"🏢","MF - Equity Small Cap":"🏪",
  "MF - ELSS (Tax Saving)":"💎","MF - Flexi Cap":"🔄","MF - Sectoral / Thematic":"🏭",
  "MF - Debt / Liquid":"💧","MF - Hybrid / Balanced":"⚖️",
  "Index Fund":"📊","ETF - Equity":"📈","ETF - Gold":"🥇","ETF - International":"🌍",
  "PPF":"🏦","EPF / PF":"🏛️","VPF":"🏛️","NPS Tier I":"🪙","NPS Tier II":"🥈",
  "SSY (Sukanya Samriddhi)":"👧","SCSS (Senior Citizen)":"👴","NSC":"📮",
  "KVP (Kisan Vikas Patra)":"📬","FD (Fixed Deposit)":"🔒","RD (Recurring Deposit)":"🔄",
  "Corporate Bonds":"📜","Government Securities (G-Sec)":"🇮🇳","T-Bills":"📝",
  "SGB (Sovereign Gold Bond)":"🥇","Physical Gold / Jewellery":"🪙",
  "REITs":"🏗️","InvITs":"⚡","Crypto (Bitcoin/Altcoins)":"₿",
  "Real Estate / Plot":"🏡","Angel Investing / Startup":"🚀",
  // Insurance
  "Term Life Insurance":"🛡️","Whole Life Insurance":"🛡️",
  "LIC - Endowment Plan":"📋","LIC - Money Back Plan":"💰",
  "LIC - Jeevan Anand":"🌟","LIC - Jeevan Labh":"✨",
  "LIC - New Endowment Plan":"📋","Group Life Insurance (Employer)":"👥",
  "Keyman Insurance":"🔑","ULIP":"💎","PLI (Postal Life Insurance)":"📮",
  "RPLI (Rural Postal Life Insurance)":"📮",
  "Health Insurance - Individual":"💊","Health Insurance - Family Floater":"👨‍👩‍👧‍👦",
  "Top-Up / Super Top-Up Health Plan":"➕","Critical Illness Insurance":"❤️‍🔥",
  "Personal Accident Insurance":"🦺","Hospital Daily Cash Plan":"🏥",
  "Vehicle Insurance - Car (Comprehensive)":"🚗","Vehicle Insurance - Car (Third Party)":"🚙",
  "Vehicle Insurance - Two Wheeler":"🏍️","Vehicle Insurance - Commercial":"🚛",
  "Home / Property Insurance":"🏠","Travel Insurance":"✈️",
  "Cyber Insurance":"🔐","Business / Shop Insurance":"🏢",
  "Crop Insurance (PMFBY)":"🌾","Marine / Cargo Insurance":"⚓",
};

const TYPE_META = {
  expense:   { color:"var(--expense)",  dim:"var(--expense-dim)",  label:"Expense",   icon:"📤" },
  income:    { color:"var(--income)",   dim:"var(--income-dim)",   label:"Income",    icon:"📥" },
  investment:{ color:"var(--invest)",   dim:"var(--invest-dim)",   label:"Invest",    icon:"📈" },
  insurance: { color:"var(--insure)",   dim:"var(--insure-dim)",   label:"Insurance", icon:"🛡️" },
};

const PIE_COLORS = ["#C8A96E","#E8C870","#A07850","#D4B896","#F0DEB4","#8A6840","#C4A87E","#B89060","#E8A86E","#D4906E"];
const INV_COLORS = ["#818CF8","#A78BFA","#C084FC","#E879F9","#F472B6","#FB7185","#7DD3FC","#6EE7B7","#FCD34D","#34D399","#60A5FA"];
const INS_COLORS = ["#F59E0B","#EF4444","#F97316","#FBBF24","#EAB308","#DC2626","#EA580C","#D97706","#92400E","#78350F"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
  :root {
    --bg:#09090B; --surface:#0F0F13; --card:#17171D; --card-hover:#1E1E26;
    --border:#24242E; --border-light:#32323E;
    --accent:#C8A96E; --accent-dim:rgba(200,169,110,0.12); --accent-hover:#D4BC8A;
    --income:#34D399; --income-dim:rgba(52,211,153,0.1);
    --expense:#F87171; --expense-dim:rgba(248,113,113,0.1);
    --invest:#818CF8; --invest-dim:rgba(129,140,248,0.12);
    --insure:#F59E0B; --insure-dim:rgba(245,158,11,0.1);
    --text:#EEEAE4; --text-secondary:#9A9590; --text-muted:#52524E;
    --radius:16px; --radius-xs:7px;
  }
  html,body{height:100%;}
  body{background:var(--bg);color:var(--text);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;}
  #root{height:100%;}
  input,select,button,textarea{font-family:'Outfit',sans-serif;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateX(110%);}to{opacity:1;transform:translateX(0);}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  .app-shell{display:flex;height:100vh;overflow:hidden;}

  /* Sidebar */
  .sidebar{width:220px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0;gap:2px;overflow:hidden;}
  .sidebar-logo{padding:0 20px 20px;border-bottom:1px solid var(--border);margin-bottom:8px;}
  .sidebar-logo .wordmark{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:var(--accent);letter-spacing:0.3px;display:flex;align-items:center;gap:8px;}
  .sidebar-logo .tagline{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.2px;margin-top:3px;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:0 8px;border-radius:var(--radius-xs);cursor:pointer;color:var(--text-secondary);font-size:13px;font-weight:500;transition:all 0.18s;border:1px solid transparent;}
  .nav-item:hover{color:var(--text);background:var(--card);}
  .nav-item.active{color:var(--accent);background:var(--accent-dim);border-color:rgba(200,169,110,0.2);}
  .nav-item .ni{font-size:16px;width:20px;text-align:center;}
  .sidebar-spacer{flex:1;}
  .sidebar-footer{padding:16px 8px 0;border-top:1px solid var(--border);}
  .user-row{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;}
  .user-avatar{width:32px;height:32px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent);flex-shrink:0;}
  .user-email{font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .logout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:1px solid var(--border);border-radius:var(--radius-xs);color:var(--text-secondary);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.18s;}
  .logout-btn:hover{color:var(--expense);border-color:rgba(248,113,113,0.4);background:var(--expense-dim);}

  /* Main */
  .main{flex:1;overflow-y:auto;background:var(--bg);}
  .content{padding:32px;max-width:940px;margin:0 auto;animation:fadeIn 0.35s ease;}

  /* Page Header */
  .page-header{margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;}
  .page-header h1{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:700;}
  .page-header p{font-size:13px;color:var(--text-muted);margin-top:3px;}

  /* Month Strip */
  .month-strip{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:22px;scrollbar-width:none;}
  .month-strip::-webkit-scrollbar{display:none;}
  .month-chip{padding:5px 14px;border-radius:99px;font-size:12px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;transition:all 0.18s;white-space:nowrap;flex-shrink:0;}
  .month-chip:hover{color:var(--text);border-color:var(--border-light);}
  .month-chip.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,0.35);}
  .month-chip.all-chip.active{background:rgba(129,140,248,0.12);color:var(--invest);border-color:rgba(129,140,248,0.35);}

  /* Market Ticker */
  .market-ticker{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:16px;overflow-x:auto;scrollbar-width:none;}
  .market-ticker::-webkit-scrollbar{display:none;}
  .ticker-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);flex-shrink:0;}
  .ticker-divider{width:1px;height:20px;background:var(--border);flex-shrink:0;}
  .ticker-item{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;min-width:72px;}
  .ticker-name{font-size:9px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
  .ticker-price{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;}
  .ticker-change{font-size:10px;font-weight:500;}
  .ticker-up{color:var(--income);}
  .ticker-down{color:var(--expense);}
  .ticker-loading{animation:pulse 1.5s ease infinite;color:var(--text-muted);font-size:12px;}
  .ticker-refresh{margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;flex-shrink:0;padding:2px 6px;border-radius:4px;transition:color 0.15s;}
  .ticker-refresh:hover{color:var(--accent);}

  /* Summary Cards */
  .summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px;}
  .summary-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
  .summary-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;transition:border-color 0.2s,transform 0.2s;animation:fadeIn 0.4s ease;}
  .summary-card:hover{border-color:var(--border-light);transform:translateY(-1px);}
  .sc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:var(--text-muted);margin-bottom:8px;}
  .sc-value{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;line-height:1;}
  .sc-value.balance{color:var(--accent);}
  .sc-value.income{color:var(--income);}
  .sc-value.expense{color:var(--expense);}
  .sc-value.investment{color:var(--invest);}
  .sc-value.insurance{color:var(--insure);}
  .sc-sub{font-size:10px;color:var(--text-muted);margin-top:5px;}

  /* Budget */
  .budget-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;margin-bottom:20px;}
  .budget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .budget-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);}
  .budget-bar-track{height:5px;background:var(--border);border-radius:99px;overflow:hidden;}
  .budget-bar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(0.34,1.56,0.64,1);}
  .budget-footer{display:flex;justify-content:space-between;margin-top:7px;font-size:11px;color:var(--text-muted);}

  /* Charts */
  .charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px;}
  .chart-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;}
  .chart-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:16px;}
  .pie-row{display:flex;align-items:center;gap:14px;}
  .pie-legend{display:flex;flex-direction:column;gap:7px;flex:1;overflow:hidden;}
  .pie-legend-item{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text-secondary);}
  .pie-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .pie-legend-val{margin-left:auto;font-weight:600;font-size:11px;white-space:nowrap;}

  /* Investment grid */
  .inv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;}
  .inv-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xs);padding:14px 16px;transition:border-color 0.18s,transform 0.18s;}
  .inv-card:hover{border-color:rgba(129,140,248,0.35);transform:translateY(-1px);}
  .inv-card-icon{font-size:22px;margin-bottom:8px;}
  .inv-card-name{font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;}
  .inv-card-amount{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;}
  .inv-card-sub{font-size:10px;color:var(--text-muted);margin-top:2px;}

  /* Insurance card */
  .ins-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xs);padding:14px 16px;transition:border-color 0.18s,transform 0.18s;}
  .ins-card:hover{border-color:rgba(245,158,11,0.35);transform:translateY(-1px);}
  .ins-card-icon{font-size:22px;margin-bottom:8px;}
  .ins-card-name{font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;}
  .ins-card-amount{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:var(--insure);}
  .ins-card-sub{font-size:10px;color:var(--text-muted);margin-top:2px;}

  /* Form */
  .form-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:28px;}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .form-group{display:flex;flex-direction:column;gap:6px;}
  .form-group.full{grid-column:1/-1;}
  .form-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted);}
  .form-input,.form-select{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:11px 13px;color:var(--text);font-size:14px;width:100%;outline:none;transition:border-color 0.18s,box-shadow 0.18s;-webkit-appearance:none;appearance:none;}
  .form-select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B6B6B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;}
  .form-input:focus,.form-select:focus{border-color:rgba(200,169,110,0.5);box-shadow:0 0 0 3px rgba(200,169,110,0.08);}
  .form-input::placeholder{color:var(--text-muted);}
  .form-select option{background:var(--card);}

  /* 4-type toggle (2x2 grid) */
  .type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
  .type-btn{padding:11px 10px;text-align:center;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.18s;color:var(--text-muted);border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--surface);display:flex;align-items:center;justify-content:center;gap:6px;}
  .type-btn:hover{color:var(--text);border-color:var(--border-light);}
  .type-btn.active.expense{background:var(--expense-dim);color:var(--expense);border-color:rgba(248,113,113,0.4);}
  .type-btn.active.income{background:var(--income-dim);color:var(--income);border-color:rgba(52,211,153,0.4);}
  .type-btn.active.investment{background:var(--invest-dim);color:var(--invest);border-color:rgba(129,140,248,0.4);}
  .type-btn.active.insurance{background:var(--insure-dim);color:var(--insure);border-color:rgba(245,158,11,0.4);}

  .btn-primary{background:var(--accent);color:#1A1208;border:none;border-radius:var(--radius-xs);padding:13px 28px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.18s;width:100%;margin-top:4px;}
  .btn-primary:hover{background:var(--accent-hover);transform:translateY(-1px);box-shadow:0 6px 20px rgba(200,169,110,0.25);}
  .btn-primary:disabled{opacity:0.55;cursor:not-allowed;transform:none;}
  .btn-secondary{background:none;border:1px solid var(--border);border-radius:var(--radius-xs);padding:12px 20px;font-size:13px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all 0.18s;width:100%;margin-top:4px;}
  .btn-secondary:hover{border-color:var(--border-light);color:var(--text);}

  /* Transactions */
  .tx-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;}
  .tx-toolbar h3{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;}
  .search-wrap{position:relative;}
  .search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none;}
  .search-input{background:var(--card);border:1px solid var(--border);border-radius:99px;padding:8px 14px 8px 32px;color:var(--text);font-size:13px;width:180px;outline:none;transition:all 0.18s;}
  .search-input:focus{border-color:rgba(200,169,110,0.4);width:220px;}
  .search-input::placeholder{color:var(--text-muted);}
  .filter-strip{display:flex;gap:6px;overflow-x:auto;margin-bottom:14px;padding-bottom:2px;scrollbar-width:none;}
  .filter-strip::-webkit-scrollbar{display:none;}
  .filter-chip{padding:4px 12px;border-radius:99px;font-size:11px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;transition:all 0.16s;white-space:nowrap;flex-shrink:0;}
  .filter-chip:hover{color:var(--text);border-color:var(--border-light);}
  .filter-chip.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,0.3);}
  .filter-chip.active.inv-chip{background:var(--invest-dim);color:var(--invest);border-color:rgba(129,140,248,0.3);}
  .filter-chip.active.ins-chip{background:var(--insure-dim);color:var(--insure);border-color:rgba(245,158,11,0.3);}
  .tx-list{display:flex;flex-direction:column;gap:6px;}
  .tx-item{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xs);padding:13px 15px;display:flex;align-items:center;gap:12px;transition:all 0.18s;animation:fadeIn 0.3s ease;}
  .tx-item:hover{border-color:var(--border-light);background:var(--card-hover);}
  .tx-icon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
  .tx-icon.expense{background:var(--expense-dim);}
  .tx-icon.income{background:var(--income-dim);}
  .tx-icon.investment{background:var(--invest-dim);}
  .tx-icon.insurance{background:var(--insure-dim);}
  .tx-info{flex:1;min-width:0;}
  .tx-cat{font-size:13px;font-weight:600;color:var(--text);}
  .tx-note{font-size:11px;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .tx-badge{display:inline-block;padding:1px 7px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-left:6px;}
  .tx-badge.expense{background:var(--expense-dim);color:var(--expense);}
  .tx-badge.income{background:var(--income-dim);color:var(--income);}
  .tx-badge.investment{background:var(--invest-dim);color:var(--invest);}
  .tx-badge.insurance{background:var(--insure-dim);color:var(--insure);}
  .tx-actions{display:flex;gap:5px;opacity:0;transition:opacity 0.18s;}
  .tx-item:hover .tx-actions{opacity:1;}
  .tx-btn{background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:4px 9px;font-size:10px;font-weight:600;cursor:pointer;color:var(--text-secondary);transition:all 0.14s;text-transform:uppercase;letter-spacing:0.4px;}
  .tx-btn:hover{color:var(--text);border-color:var(--border-light);}
  .tx-btn.del:hover{color:var(--expense);border-color:rgba(248,113,113,0.4);background:var(--expense-dim);}
  .tx-meta{text-align:right;flex-shrink:0;}
  .tx-amount{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;}
  .tx-amount.income{color:var(--income);}
  .tx-amount.expense{color:var(--expense);}
  .tx-amount.investment{color:var(--invest);}
  .tx-amount.insurance{color:var(--insure);}
  .tx-date{font-size:10px;color:var(--text-muted);margin-top:2px;}
  .empty-state{text-align:center;padding:48px 24px;color:var(--text-muted);}
  .empty-state .es-icon{font-size:36px;margin-bottom:12px;}

  /* Settings */
  .settings-section{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:14px;}
  .settings-section h3{font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px;}
  .settings-section p{font-size:12px;color:var(--text-muted);margin-bottom:16px;}
  .setting-row{display:flex;align-items:center;gap:12px;}
  .setting-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:11px 13px;color:var(--text);font-size:14px;outline:none;transition:border-color 0.18s;}
  .setting-input:focus{border-color:rgba(200,169,110,0.5);}
  .setting-input::placeholder{color:var(--text-muted);}
  .btn-save{background:var(--accent);color:#1A1208;border:none;border-radius:var(--radius-xs);padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;}
  .btn-save:hover{background:var(--accent-hover);}
  .danger-btn{background:none;border:1px solid rgba(248,113,113,0.3);border-radius:var(--radius-xs);padding:11px 20px;font-size:13px;font-weight:500;color:var(--expense);cursor:pointer;transition:all 0.18s;}
  .danger-btn:hover{background:var(--expense-dim);border-color:rgba(248,113,113,0.6);}

  /* Icon button */
  .icon-btn{display:flex;align-items:center;gap:6px;background:none;border:1px solid var(--border);border-radius:var(--radius-xs);padding:7px 13px;font-size:12px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all 0.18s;}
  .icon-btn:hover{color:var(--accent);border-color:rgba(200,169,110,0.35);background:var(--accent-dim);}

  /* Bottom Nav */
  .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);z-index:200;padding-bottom:env(safe-area-inset-bottom,0px);}
  .bnav-items{display:flex;justify-content:space-around;}
  .bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;cursor:pointer;color:var(--text-muted);font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;transition:color 0.18s;min-width:0;flex:1;}
  .bnav-item .bnav-icon{font-size:17px;}
  .bnav-item.active{color:var(--accent);}
  .bnav-fab{background:var(--accent);border:none;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;color:#1A1208;box-shadow:0 4px 16px rgba(200,169,110,0.4);transition:transform 0.18s;margin-top:-10px;}
  .bnav-fab:hover{transform:scale(1.08);}

  /* Toast */
  .toast{position:fixed;top:20px;right:20px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xs);padding:11px 18px;font-size:13px;z-index:9999;animation:toastIn 0.3s ease;box-shadow:0 12px 48px rgba(0,0,0,0.7);display:flex;align-items:center;gap:8px;}
  .toast.success{border-color:rgba(52,211,153,0.4);color:var(--income);}
  .toast.error{border-color:rgba(248,113,113,0.4);color:var(--expense);}
  .toast.warning{border-color:rgba(200,169,110,0.4);color:var(--accent);}

  /* Login */
  .login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:hidden;}
  .login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(200,169,110,0.07) 0%,transparent 70%);pointer-events:none;}
  .login-card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px;animation:slideUp 0.45s ease;position:relative;z-index:1;}
  .login-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:var(--accent);text-align:center;margin-bottom:4px;}
  .login-tagline{font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:24px;}
  .auth-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:3px;margin-bottom:20px;}
  .auth-tab{padding:8px 4px;text-align:center;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-muted);transition:all 0.18s;border:none;background:none;}
  .auth-tab.active{background:var(--card);color:var(--text);}
  .auth-error{background:var(--expense-dim);border:1px solid rgba(248,113,113,0.3);border-radius:var(--radius-xs);padding:10px 14px;font-size:12px;color:var(--expense);margin-bottom:14px;}
  .auth-success{background:var(--income-dim);border:1px solid rgba(52,211,153,0.3);border-radius:var(--radius-xs);padding:10px 14px;font-size:12px;color:var(--income);margin-bottom:14px;}
  .google-btn{width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
  .google-btn:hover{border-color:var(--border-light);background:var(--card-hover);}
  .divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--text-muted);font-size:11px;}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border);}
  .fg{display:flex;flex-direction:column;gap:6px;}
  .fl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted);}
  .forgot-link{font-size:11px;color:var(--text-muted);cursor:pointer;text-align:right;margin-top:-10px;margin-bottom:8px;transition:color 0.15s;}
  .forgot-link:hover{color:var(--accent);}
  .phone-prefix{background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:var(--radius-xs) 0 0 var(--radius-xs);padding:11px 12px;color:var(--text);font-size:14px;font-weight:500;white-space:nowrap;}
  .phone-input{border-radius:0 var(--radius-xs) var(--radius-xs) 0!important;}
  .otp-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;}
  .otp-cell{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:12px 0;color:var(--text);font-size:18px;font-weight:700;text-align:center;outline:none;transition:border-color 0.18s;}
  .otp-cell:focus{border-color:rgba(200,169,110,0.5);box-shadow:0 0 0 3px rgba(200,169,110,0.08);}
  #recaptcha-container{display:none;}

  /* Modal overlay */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease;}
  .modal-box{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:28px;width:100%;max-width:380px;animation:slideUp 0.3s ease;}
  .modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;margin-bottom:6px;}
  .modal-sub{font-size:12px;color:var(--text-muted);margin-bottom:20px;}
  .modal-close{float:right;background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;line-height:1;}

  /* Responsive */
  @media(max-width:900px){
    .summary-grid{grid-template-columns:repeat(3,1fr);}
    .summary-grid .summary-card:first-child{grid-column:1/-1;}
  }
  @media(max-width:768px){
    .sidebar{display:none;}
    .bottom-nav{display:block;}
    .content{padding:20px 14px 90px;}
    .summary-grid{grid-template-columns:1fr 1fr;}
    .summary-grid .summary-card:first-child{grid-column:1/-1;}
    .summary-grid-4{grid-template-columns:1fr 1fr;}
    .summary-grid-4 .summary-card:first-child{grid-column:1/-1;}
    .sc-value{font-size:18px!important;}
    .charts-row{grid-template-columns:1fr;}
    .form-grid{grid-template-columns:1fr;}
    .form-group.full{grid-column:1;}
    .page-header h1{font-size:24px;}
    .search-input{width:100%;}
    .search-input:focus{width:100%;}
    .toast{top:auto;bottom:80px;right:12px;left:12px;}
    .pie-row{flex-direction:column;}
    .inv-grid{grid-template-columns:1fr 1fr;}
    .market-ticker{gap:10px;}
  }
`;

// ─── Market Data Hook ──────────────────────────────────────────────────────────
function useMarketData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Yahoo Finance v7 - NIFTY50, SENSEX, Gold Futures, USD/INR
      const symbols = "^NSEI,^BSESN,GC=F,USDINR=X";
      const res = await window.fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`,
        { headers: { "Accept": "application/json" } }
      );
      if (!res.ok) throw new Error("non-200");
      const json = await res.json();
      const map = {};
      (json.quoteResponse?.result || []).forEach((q) => {
        map[q.symbol] = {
          price: q.regularMarketPrice,
          change: +(q.regularMarketChange || 0).toFixed(2),
          pct: +(q.regularMarketChangePercent || 0).toFixed(2),
        };
      });
      setData(map);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  return { data, loading, error, refresh: load };
}

// ─── Market Ticker Bar ─────────────────────────────────────────────────────────
function MarketTicker({ marketData, loading, error, onRefresh }) {
  const items = [
    { sym: "^NSEI",     label: "NIFTY 50",     prefix: "" },
    { sym: "^BSESN",    label: "SENSEX",        prefix: "" },
    { sym: "GC=F",      label: "GOLD",          prefix: "$" },
    { sym: "USDINR=X",  label: "USD/INR",       prefix: "₹" },
  ];

  return (
    <div className="market-ticker">
      <span className="ticker-label">Live</span>
      <div className="ticker-divider" />
      {loading && Object.keys(marketData).length === 0 ? (
        <span className="ticker-loading">Fetching market data…</span>
      ) : error && Object.keys(marketData).length === 0 ? (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Market data unavailable (CORS proxy needed for live prices)
        </span>
      ) : (
        items.map(({ sym, label, prefix }) => {
          const d = marketData[sym];
          if (!d) return null;
          const up = d.pct >= 0;
          return (
            <div key={sym} className="ticker-item">
              <span className="ticker-name">{label}</span>
              <span className={`ticker-price ${up ? "ticker-up" : "ticker-down"}`}>
                {prefix}{d.price?.toLocaleString("en-IN", { maximumFractionDigits: sym === "USDINR=X" ? 2 : 0 })}
              </span>
              <span className={`ticker-change ${up ? "ticker-up" : "ticker-down"}`}>
                {up ? "▲" : "▼"} {Math.abs(d.pct).toFixed(2)}%
              </span>
            </div>
          );
        })
      )}
      <button className="ticker-refresh" onClick={onRefresh} title="Refresh market data">↻</button>
    </div>
  );
}

// ─── Tooltips ──────────────────────────────────────────────────────────────────
const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background: "#1C1C22", border: "1px solid #32323E", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#9A9590", marginBottom: 3 }}>Day {label}</div>
      <div style={{ color: v >= 0 ? "#34D399" : "#F87171", fontWeight: 600 }}>
        {v >= 0 ? "+" : ""}₹{Math.abs(v).toLocaleString("en-IN")}
      </div>
    </div>
  );
};

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C1C22", border: "1px solid #32323E", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#EEEAE4", fontWeight: 600 }}>{payload[0].name}</div>
      <div style={{ color: "#C8A96E" }}>₹{payload[0].value.toLocaleString("en-IN")}</div>
    </div>
  );
};

const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C1C22", border: "1px solid #32323E", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#9A9590", marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.fill, fontWeight: 600 }}>
          {p.name}: ₹{(p.value || 0).toLocaleString("en-IN")}
        </div>
      ))}
    </div>
  );
};

// ─── Month Strip ───────────────────────────────────────────────────────────────
function MonthStrip({ months, selectedMonth, setSelectedMonth }) {
  return (
    <div className="month-strip">
      {months.map((m) => (
        <button
          key={m.value}
          className={`month-chip ${m.value === "all" ? "all-chip" : ""} ${selectedMonth === m.value ? "active" : ""}`}
          onClick={() => setSelectedMonth(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({
  income, expense, investment, insurance, balance,
  budget, budgetProgress, budgetColor,
  pieData, invPieData, insPieData, trendData,
  allMonthlyData, selectedMonth,
  months, setSelectedMonth,
  marketData, marketLoading, marketError, onMarketRefresh,
}) {
  const isAll = selectedMonth === "all";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{isAll ? "All-time financial overview" : "Monthly financial overview"}</p>
        </div>
      </div>

      <MarketTicker marketData={marketData} loading={marketLoading} error={marketError} onRefresh={onMarketRefresh} />

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      {/* 5-card summary */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="sc-label">Net Balance</div>
          <div className={`sc-value balance`} style={{ color: balance >= 0 ? "var(--income)" : "var(--expense)" }}>
            {balance >= 0 ? fmt(balance) : "-" + fmt(balance)}
          </div>
          <div className="sc-sub">Income − Expenses</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Income</div>
          <div className="sc-value income">{fmt(income)}</div>
          <div className="sc-sub">{isAll ? "all time" : "this period"}</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Expense</div>
          <div className="sc-value expense">{fmt(expense)}</div>
          <div className="sc-sub">{isAll ? "all time" : "this period"}</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Invested</div>
          <div className="sc-value investment">{fmt(investment)}</div>
          <div className="sc-sub">{isAll ? "all time" : "this period"}</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Insurance</div>
          <div className="sc-value insurance">{fmt(insurance)}</div>
          <div className="sc-sub">premiums {isAll ? "all time" : "this period"}</div>
        </div>
      </div>

      {/* Budget bar (only in monthly view) */}
      {!isAll && parseFloat(budget) > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="budget-title">Monthly Expense Budget</span>
            <span style={{ color: budgetColor, fontSize: 13, fontWeight: 600 }}>
              {fmt(expense)} / {fmt(parseFloat(budget))}
            </span>
          </div>
          <div className="budget-bar-track">
            <div className="budget-bar-fill" style={{ width: `${budgetProgress}%`, background: budgetColor }} />
          </div>
          <div className="budget-footer">
            <span>{budgetProgress.toFixed(0)}% used</span>
            <span style={{ color: parseFloat(budget) - expense > 0 ? "var(--income)" : "var(--expense)" }}>
              {parseFloat(budget) - expense > 0
                ? fmt(parseFloat(budget) - expense) + " remaining"
                : fmt(expense - parseFloat(budget)) + " over budget"}
            </span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-row">
        {/* Expense breakdown pie */}
        <div className="chart-card">
          <div className="chart-title">Expense Breakdown</div>
          {pieData.length > 0 ? (
            <div className="pie-row">
              <PieChart width={120} height={120}>
                <Pie data={pieData} dataKey="value" cx={55} cy={55} innerRadius={32} outerRadius={52} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div className="pie-legend">
                {pieData.slice(0, 6).map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val">₹{item.value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 12 }}>No expense data</div>
          )}
        </div>

        {/* Daily cash flow OR monthly bar chart */}
        {isAll ? (
          <div className="chart-card">
            <div className="chart-title">Monthly Overview (Last 12 Months)</div>
            {allMonthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={155}>
                <BarChart data={allMonthlyData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#52524E" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#52524E" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTip />} />
                  <Bar dataKey="income" name="Income" fill="#34D399" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#F87171" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 12 }}>No data</div>
            )}
          </div>
        ) : (
          <div className="chart-card">
            <div className="chart-title">Daily Cash Flow</div>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={155}>
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8A96E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C8A96E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#52524E" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#52524E" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AreaTip />} />
                  <Area type="monotone" dataKey="amount" stroke="#C8A96E" strokeWidth={2} fill="url(#ag)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 12 }}>No trend data</div>
            )}
          </div>
        )}

        {/* Investment portfolio pie */}
        {invPieData.length > 0 && (
          <div className="chart-card" style={{ gridColumn: "1/-1" }}>
            <div className="chart-title">Investment Portfolio Breakdown</div>
            <div className="pie-row">
              <PieChart width={140} height={140}>
                <Pie data={invPieData} dataKey="value" cx={65} cy={65} innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {invPieData.map((_, i) => <Cell key={i} fill={INV_COLORS[i % INV_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 24px", flex: 1 }}>
                {invPieData.map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: INV_COLORS[i % INV_COLORS.length] }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val" style={{ color: INV_COLORS[i % INV_COLORS.length] }}>
                      ₹{item.value.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Insurance pie */}
        {insPieData.length > 0 && (
          <div className="chart-card" style={{ gridColumn: "1/-1" }}>
            <div className="chart-title">Insurance Premium Breakdown</div>
            <div className="pie-row">
              <PieChart width={140} height={140}>
                <Pie data={insPieData} dataKey="value" cx={65} cy={65} innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {insPieData.map((_, i) => <Cell key={i} fill={INS_COLORS[i % INS_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 24px", flex: 1 }}>
                {insPieData.map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: INS_COLORS[i % INS_COLORS.length] }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    <span className="pie-legend-val" style={{ color: INS_COLORS[i % INS_COLORS.length] }}>
                      ₹{item.value.toLocaleString("en-IN")}
                    </span>
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

// ─── Add / Edit Form ───────────────────────────────────────────────────────────
function AddForm({ amount, setAmount, type, setType, category, setCategory, note, setNote, date, setDate, editId, onSubmit, onCancel }) {
  const catMap = {
    expense: EXPENSE_CATEGORIES,
    income: INCOME_CATEGORIES,
    investment: INVESTMENT_CATEGORIES,
    insurance: INSURANCE_CATEGORIES,
  };
  const cats = catMap[type] || EXPENSE_CATEGORIES;

  const defaultCat = {
    expense: "Food & Dining",
    income: "Salary",
    investment: "Stocks - NSE",
    insurance: "Term Life Insurance",
  };

  const changeType = (t) => {
    setType(t);
    setCategory(defaultCat[t]);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>{editId ? "Update the details below" : "Record income, expense, investment or insurance"}</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="form-group full">
            <label className="form-label">Type</label>
            <div className="type-toggle">
              <button className={`type-btn ${type === "expense" ? "active expense" : ""}`} onClick={() => changeType("expense")}>
                📤 Expense
              </button>
              <button className={`type-btn ${type === "income" ? "active income" : ""}`} onClick={() => changeType("income")}>
                📥 Income
              </button>
              <button className={`type-btn ${type === "investment" ? "active investment" : ""}`} onClick={() => changeType("investment")}>
                📈 Investment
              </button>
              <button className={`type-btn ${type === "insurance" ? "active insurance" : ""}`} onClick={() => changeType("insurance")}>
                🛡️ Insurance
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input
              className="form-input"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => (
                <option key={c} value={c}>{(CAT_ICONS[c] || "•") + " " + c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="form-group full" style={{ marginTop: 4 }}>
            <button className="btn-primary" onClick={onSubmit}>
              {editId ? "✓ Update Transaction" : "+ Add Transaction"}
            </button>
            {editId && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── History ───────────────────────────────────────────────────────────────────
function History({
  filtered, search, setSearch, filterCategory, setFilterCategory,
  filterType, setFilterType, onEdit, onDelete, onExport,
  months, selectedMonth, setSelectedMonth,
}) {
  const allCats = [
    ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES,
    ...INVESTMENT_CATEGORIES, ...INSURANCE_CATEGORIES,
  ];

  return (
    <>
      <div className="page-header">
        <div><h1>Transactions</h1><p>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p></div>
        <button className="icon-btn" onClick={onExport}>↓ Export CSV</button>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "expense", "income", "investment", "insurance"].map((t) => (
            <button
              key={t}
              className={`filter-chip ${filterType === t ? "active" + (t === "investment" ? " inv-chip" : t === "insurance" ? " ins-chip" : "") : ""}`}
              onClick={() => setFilterType(t)}
              style={{ textTransform: "capitalize" }}
            >
              {t === "all" ? "All" : (TYPE_META[t]?.icon + " " + TYPE_META[t]?.label)}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-strip">
        <button className={`filter-chip ${!filterCategory ? "active" : ""}`} onClick={() => setFilterCategory("")}>
          All Categories
        </button>
        {allCats.map((c) => (
          <button
            key={c}
            className={`filter-chip ${filterCategory === c ? "active" : ""}`}
            onClick={() => setFilterCategory(filterCategory === c ? "" : c)}
          >
            {CAT_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="es-icon">📭</div><p>No transactions found</p></div>
        ) : filtered.map((e) => (
          <div key={e.id} className="tx-item">
            <div className={`tx-icon ${e.type}`}>{CAT_ICONS[e.category] || "💸"}</div>
            <div className="tx-info">
              <div className="tx-cat">
                {e.category}
                <span className={`tx-badge ${e.type}`}>{TYPE_META[e.type]?.label || e.type}</span>
              </div>
              <div className="tx-note">{e.note || <span style={{ fontStyle: "italic" }}>No note</span>}</div>
            </div>
            <div className="tx-actions">
              <button className="tx-btn" onClick={() => onEdit(e)}>Edit</button>
              <button className="tx-btn del" onClick={() => onDelete(e.id)}>Delete</button>
            </div>
            <div className="tx-meta">
              <div className={`tx-amount ${e.type}`}>
                {e.type === "income" ? "+" : e.type === "investment" ? "→" : e.type === "insurance" ? "🛡" : "−"}
                {fmt(e.amount)}
              </div>
              <div className="tx-date">{e.date}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Investments Tab ───────────────────────────────────────────────────────────
function Investments({ invData, invTotals, marketData, months, selectedMonth, setSelectedMonth }) {
  const total = Object.values(invTotals).reduce((s, v) => s + v, 0);

  return (
    <>
      <div className="page-header">
        <div><h1>Investments</h1><p>Portfolio by instrument</p></div>
      </div>
      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      {/* Market indices mini bar */}
      {Object.keys(marketData).length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "14px 18px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { sym: "^NSEI", label: "NIFTY 50" },
            { sym: "^BSESN", label: "SENSEX" },
          ].map(({ sym, label }) => {
            const d = marketData[sym];
            if (!d) return null;
            const up = d.pct >= 0;
            return (
              <div key={sym}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: up ? "var(--income)" : "var(--expense)", fontFamily: "'Cormorant Garamond', serif" }}>
                  {d.price?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: 11, color: up ? "var(--income)" : "var(--expense)" }}>
                  {up ? "▲" : "▼"} {Math.abs(d.pct).toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="summary-grid-4">
        <div className="summary-card" style={{ gridColumn: "1/-1" }}>
          <div className="sc-label">Total Invested {selectedMonth === "all" ? "(All Time)" : "This Period"}</div>
          <div className="sc-value investment">{fmt(total)}</div>
          <div className="sc-sub">across {Object.keys(invTotals).length} instrument{Object.keys(invTotals).length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {Object.keys(invTotals).length === 0 ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="es-icon">📈</div>
          <p>No investments for this period.<br />Use Add → Investment to track your portfolio.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>By Instrument</div>
          <div className="inv-grid">
            {INVESTMENT_CATEGORIES.filter((c) => invTotals[c] > 0).map((c, i) => (
              <div key={c} className="inv-card">
                <div className="inv-card-icon">{CAT_ICONS[c] || "📊"}</div>
                <div className="inv-card-name">{c}</div>
                <div className="inv-card-amount" style={{ color: INV_COLORS[i % INV_COLORS.length] }}>
                  {fmt(invTotals[c])}
                </div>
                <div className="inv-card-sub">{total > 0 ? ((invTotals[c] / total) * 100).toFixed(1) + "% of portfolio" : ""}</div>
              </div>
            ))}
          </div>

          {invData.length > 0 && (
            <>
              <div style={{ margin: "22px 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>
                Recent Entries
              </div>
              <div className="tx-list">
                {invData.slice(0, 12).map((e) => (
                  <div key={e.id} className="tx-item">
                    <div className="tx-icon investment">{CAT_ICONS[e.category] || "📈"}</div>
                    <div className="tx-info">
                      <div className="tx-cat">{e.category}</div>
                      <div className="tx-note">{e.note || <span style={{ fontStyle: "italic" }}>No note</span>}</div>
                    </div>
                    <div className="tx-meta">
                      <div className="tx-amount investment">→{fmt(e.amount)}</div>
                      <div className="tx-date">{e.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// ─── Insurance Tab ─────────────────────────────────────────────────────────────
function Insurance({ insData, insTotals, months, selectedMonth, setSelectedMonth }) {
  const total = Object.values(insTotals).reduce((s, v) => s + v, 0);

  return (
    <>
      <div className="page-header">
        <div><h1>Insurance</h1><p>Premium tracking &amp; coverage overview</p></div>
      </div>
      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="summary-grid-4">
        <div className="summary-card" style={{ gridColumn: "1/-1" }}>
          <div className="sc-label">Total Premiums {selectedMonth === "all" ? "(All Time)" : "This Period"}</div>
          <div className="sc-value insurance">{fmt(total)}</div>
          <div className="sc-sub">
            {Object.keys(insTotals).length} polic{Object.keys(insTotals).length !== 1 ? "ies" : "y"} tracked
          </div>
        </div>
      </div>

      {Object.keys(insTotals).length === 0 ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="es-icon">🛡️</div>
          <p>No insurance entries for this period.<br />Use Add → Insurance to track your premiums.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>By Policy Type</div>
          <div className="inv-grid">
            {INSURANCE_CATEGORIES.filter((c) => insTotals[c] > 0).map((c, i) => (
              <div key={c} className="ins-card">
                <div className="ins-card-icon">{CAT_ICONS[c] || "🛡️"}</div>
                <div className="ins-card-name">{c}</div>
                <div className="ins-card-amount">{fmt(insTotals[c])}</div>
                <div className="ins-card-sub">{total > 0 ? ((insTotals[c] / total) * 100).toFixed(1) + "% of premiums" : ""}</div>
              </div>
            ))}
          </div>

          {insData.length > 0 && (
            <>
              <div style={{ margin: "22px 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>
                Recent Premiums Paid
              </div>
              <div className="tx-list">
                {insData.slice(0, 12).map((e) => (
                  <div key={e.id} className="tx-item">
                    <div className="tx-icon insurance">{CAT_ICONS[e.category] || "🛡️"}</div>
                    <div className="tx-info">
                      <div className="tx-cat">{e.category}</div>
                      <div className="tx-note">{e.note || <span style={{ fontStyle: "italic" }}>No note</span>}</div>
                    </div>
                    <div className="tx-meta">
                      <div className="tx-amount insurance">🛡{fmt(e.amount)}</div>
                      <div className="tx-date">{e.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// ─── Settings ──────────────────────────────────────────────────────────────────
function Settings({ budget, budgetInput, setBudgetInput, onSaveBudget, user, logout }) {
  return (
    <>
      <div className="page-header"><div><h1>Settings</h1><p>Preferences &amp; account</p></div></div>

      <div className="settings-section">
        <h3>💰 Monthly Expense Budget</h3>
        <p>Set a spending limit. Investments and insurance are tracked separately and won't affect the budget alert.</p>
        <div className="setting-row">
          <input
            className="setting-input"
            type="number"
            placeholder="Enter monthly budget…"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {budget && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            Current: <span style={{ color: "var(--accent)", fontWeight: 600 }}>₹{parseFloat(budget).toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>👤 Account</h3>
        <p>Signed in as <strong style={{ color: "var(--text)" }}>{user?.email || user?.phoneNumber || "User"}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>

      <div className="settings-section">
        <h3>📋 About Finwise</h3>
        <p>Premium Edition — Smart Money. Clear Picture.</p>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 2 }}>
          ✓ 4 types: Income · Expense · Investment · Insurance<br />
          ✓ 30+ investment options · 28+ insurance categories<br />
          ✓ All-Time &amp; monthly filter · Live market data<br />
          ✓ OTP &amp; Email login · Google sign-in<br />
          ✓ Budget alerts · CSV export · IST timezone-safe
        </div>
      </div>
    </>
  );
}

// ─── Forgot Password Modal ─────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!email) return;
    setLoading(true); setErr("");
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">Reset Password</div>
        <div className="modal-sub">Enter your email address and we'll send you a reset link.</div>
        {err && <div className="auth-error">{err}</div>}
        {sent ? (
          <div className="auth-success">✓ Reset link sent! Check your inbox.</div>
        ) : (
          <>
            <div className="fg" style={{ marginBottom: 14 }}>
              <label className="fl">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
            </div>
            <button className="btn-primary" onClick={send} disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────
function LoginPage({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState("login"); // login | signup | phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // OTP states
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const otpRefs = useRef([]);

  const clearError = () => setAuthError("");

  // Email login
  const login = async () => {
    clearError(); setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  // Email signup
  const signup = async () => {
    clearError(); setLoading(true);
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  // Google login
  const googleLogin = async () => {
    clearError();
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { setAuthError(e.message); }
  };

  // Send OTP
  const sendOTP = async () => {
    clearError();
    if (!phone || phone.length < 10) { setAuthError("Enter a valid 10-digit phone number."); return; }
    setLoading(true);
    try {
      // Cleanup previous verifier
      if (window._rcv) { try { window._rcv.clear(); } catch {} }
      window._rcv = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const fullPhone = "+91" + phone.replace(/\D/g, "");
      const result = await signInWithPhoneNumber(auth, fullPhone, window._rcv);
      setConfirmResult(result);
      setOtpSent(true);
    } catch (e) {
      setAuthError(e.message.replace("Firebase: ", ""));
      if (window._rcv) { try { window._rcv.clear(); } catch {} }
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 6) { setAuthError("Enter the 6-digit OTP."); return; }
    clearError(); setLoading(true);
    try { await confirmResult.confirm(code); }
    catch (e) { setAuthError("Invalid OTP. Please try again."); }
    finally { setLoading(false); }
  };

  // OTP input handler
  const handleOtpKey = (i, e) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length > 1) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (!val && e.nativeEvent.inputType === "deleteContentBackward" && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  return (
    <>
      <div id="recaptcha-container" />
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      <div className="login-page">
        <div className="login-bg" />
        <div className="login-card">
          <div className="login-logo">◈ Finwise</div>
          <div className="login-tagline">Smart money. Clear picture.</div>

          <div className="auth-tabs">
            <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => { setAuthMode("login"); clearError(); }}>
              Sign In
            </button>
            <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => { setAuthMode("signup"); clearError(); }}>
              Sign Up
            </button>
            <button className={`auth-tab ${authMode === "phone" ? "active" : ""}`} onClick={() => { setAuthMode("phone"); clearError(); }}>
              📱 OTP
            </button>
          </div>

          {authError && <div className="auth-error">{authError}</div>}

          {/* Email flows */}
          {(authMode === "login" || authMode === "signup") && (
            <>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label className="fl">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="fg" style={{ marginBottom: 6 }}>
                <label className="fl">Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? login() : signup())}
                />
              </div>
              {authMode === "login" && (
                <div className="forgot-link" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </div>
              )}
              <button
                className="btn-primary"
                onClick={authMode === "login" ? login : signup}
                disabled={loading}
                style={{ marginBottom: 4 }}
              >
                {loading ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
              <div className="divider">or</div>
              <button className="google-btn" onClick={googleLogin}>
                <span style={{ fontWeight: 700 }}>G</span> Continue with Google
              </button>
            </>
          )}

          {/* Phone OTP flow */}
          {authMode === "phone" && (
            <>
              {!otpSent ? (
                <>
                  <div className="fg" style={{ marginBottom: 16 }}>
                    <label className="fl">Mobile Number (India)</label>
                    <div style={{ display: "flex" }}>
                      <span className="phone-prefix">🇮🇳 +91</span>
                      <input
                        className="form-input phone-input"
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        onKeyDown={(e) => e.key === "Enter" && sendOTP()}
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <button className="btn-primary" onClick={sendOTP} disabled={loading}>
                    {loading ? "Sending OTP…" : "Send OTP"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, textAlign: "center" }}>
                    OTP sent to +91 {phone} <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => { setOtpSent(false); setOtp(["","","","","",""]); }}>Change</span>
                  </div>
                  <div className="fg" style={{ marginBottom: 16 }}>
                    <label className="fl">Enter OTP</label>
                    <div className="otp-grid" onPaste={handleOtpPaste}>
                      {otp.map((v, i) => (
                        <input
                          key={i}
                          ref={(el) => (otpRefs.current[i] = el)}
                          className="otp-cell"
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={v}
                          onChange={(e) => handleOtpKey(i, e)}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button className="btn-primary" onClick={verifyOTP} disabled={loading}>
                    {loading ? "Verifying…" : "Verify & Sign In"}
                  </button>
                  <button
                    style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginTop: 10, width: "100%", textAlign: "center" }}
                    onClick={sendOTP}
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [amount, setAmount]       = useState("");
  const [type, setType]           = useState("expense");
  const [category, setCategory]   = useState("Food & Dining");
  const [note, setNote]           = useState("");
  const [date, setDate]           = useState(toLocalDateStr(new Date()));
  const [entries, setEntries]     = useState([]);
  const [editId, setEditId]       = useState(null);

  const [search, setSearch]                   = useState("");
  const [filterCategory, setFilterCategory]   = useState("");
  const [filterType, setFilterType]           = useState("all");

  const [budget, setBudget]           = useState(localStorage.getItem("fw_budget") || "");
  const [budgetInput, setBudgetInput] = useState(localStorage.getItem("fw_budget") || "");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast]         = useState(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(now));

  const { data: marketData, loading: marketLoading, error: marketError, refresh: marketRefresh } = useMarketData();

  useEffect(() => auth.onAuthStateChanged((u) => { setUser(u); setAuthChecked(true); }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => { localStorage.setItem("fw_budget", budget); }, [budget]);

  useEffect(() => {
    if (!budget || entries.length === 0 || selectedMonth === "all") return;
    const exp = entries
      .filter((e) => e.type === "expense" && e.date?.startsWith(selectedMonth))
      .reduce((s, e) => s + e.amount, 0);
    if (exp > parseFloat(budget)) showToast("⚠️ Monthly budget exceeded!", "warning");
  }, [entries, selectedMonth]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const logout = () => { signOut(auth); setActiveTab("dashboard"); };

  const submitTransaction = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    const data = { amount: parseFloat(amount), type, category, note, date };
    try {
      if (editId) {
        await updateDoc(doc(db, "users", user.uid, "expenses", editId), data);
        setEditId(null);
        showToast("✓ Transaction updated");
      } else {
        await addDoc(collection(db, "users", user.uid, "expenses"), data);
        showToast("✓ Transaction added");
      }
      setAmount(""); setNote(""); setDate(toLocalDateStr(new Date()));
      setActiveTab("dashboard");
    } catch { showToast("Failed to save", "error"); }
  };

  const deleteEntry = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
    showToast("Transaction removed", "error");
  };

  const editEntry = (e) => {
    setAmount(String(e.amount)); setType(e.type); setCategory(e.category);
    setNote(e.note || ""); setDate(e.date); setEditId(e.id);
    setActiveTab("add");
  };

  const cancelEdit = () => {
    setEditId(null); setAmount(""); setNote("");
    setCategory("Food & Dining"); setType("expense");
    setActiveTab("history");
  };

  // ── Computed ──
  const isAll = selectedMonth === "all";
  const monthRecs = isAll ? entries : entries.filter((e) => e.date?.startsWith(selectedMonth));

  const income     = monthRecs.filter((e) => e.type === "income"    ).reduce((s, e) => s + e.amount, 0);
  const expense    = monthRecs.filter((e) => e.type === "expense"   ).reduce((s, e) => s + e.amount, 0);
  const investment = monthRecs.filter((e) => e.type === "investment").reduce((s, e) => s + e.amount, 0);
  const insurance  = monthRecs.filter((e) => e.type === "insurance" ).reduce((s, e) => s + e.amount, 0);
  const balance    = income - expense;

  // Expense pie
  const expCatTotals = {};
  monthRecs.filter((e) => e.type === "expense").forEach((e) => {
    expCatTotals[e.category] = (expCatTotals[e.category] || 0) + e.amount;
  });
  const pieData = Object.entries(expCatTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // Investment pie
  const invCatTotals = {};
  monthRecs.filter((e) => e.type === "investment").forEach((e) => {
    invCatTotals[e.category] = (invCatTotals[e.category] || 0) + e.amount;
  });
  const invPieData = Object.entries(invCatTotals).map(([name, value]) => ({ name, value }));

  // Insurance pie
  const insCatTotals = {};
  monthRecs.filter((e) => e.type === "insurance").forEach((e) => {
    insCatTotals[e.category] = (insCatTotals[e.category] || 0) + e.amount;
  });
  const insPieData = Object.entries(insCatTotals).map(([name, value]) => ({ name, value }));

  // Daily trend
  const trend = {};
  monthRecs.filter((e) => e.type !== "investment" && e.type !== "insurance").forEach((e) => {
    const day = e.date?.split("-")[2];
    if (day) trend[day] = (trend[day] || 0) + (e.type === "income" ? e.amount : -e.amount);
  });
  const trendData = Object.entries(trend).sort((a, b) => +a[0] - +b[0]).map(([day, amount]) => ({ day: +day, amount }));

  // Monthly overview (last 12 months) for All Time view
  const allMonthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = toYYYYMM(d);
    const recs = entries.filter((e) => e.date?.startsWith(key));
    return {
      month: MONTH_NAMES[d.getMonth()] + " '" + String(d.getFullYear()).slice(2),
      income: recs.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0),
      expense: recs.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
    };
  });

  // Filtered history
  const filtered = monthRecs
    .filter((e) =>
      (filterType === "all" || e.type === filterType) &&
      (!search || e.note?.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCategory || e.category === filterCategory)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const budgetNum      = parseFloat(budget) || 0;
  const budgetProgress = budgetNum ? Math.min((expense / budgetNum) * 100, 100) : 0;
  const budgetColor    = budgetProgress > 90 ? "var(--expense)" : budgetProgress > 70 ? "var(--accent)" : "var(--income)";

  // Month options: "All Time" + last 12 months
  const months = [
    { value: "all", label: "All Time" },
    ...Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return { value: toYYYYMM(d), label: MONTH_NAMES[d.getMonth()] + " '" + String(d.getFullYear()).slice(2) };
    }),
  ];

  const exportCSV = () => {
    const headers = ["Date", "Type", "Category", "Amount", "Note"];
    const rows = filtered.map((e) => [e.date, e.type, e.category, e.amount, e.note || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `finwise-${isAll ? "all" : selectedMonth}.csv`;
    a.click();
    showToast("✓ CSV exported");
  };

  if (!authChecked) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-muted)", fontSize: 14 }}>
          Loading…
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <style>{CSS}</style>
        <LoginPage />
      </>
    );
  }

  const NAV = [
    { id: "dashboard", icon: "◉",  label: "Overview"  },
    { id: "add",       icon: "＋",  label: "Add"       },
    { id: "history",   icon: "≡",   label: "History"   },
    { id: "invest",    icon: "📈",  label: "Invest"    },
    { id: "insure",    icon: "🛡️",  label: "Insure"    },
    { id: "settings",  icon: "◎",  label: "Settings"  },
  ];

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="wordmark">◈ Finwise</div>
            <div className="tagline">Smart Finance Tracker</div>
          </div>
          {NAV.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="ni">{item.icon}</span>{item.label}
            </div>
          ))}
          <div className="sidebar-spacer" />
          <div className="sidebar-footer">
            <div className="user-row">
              <div className="user-avatar">
                {(user.email?.[0] || user.phoneNumber?.[3] || "U").toUpperCase()}
              </div>
              <div className="user-email">{user.email || user.phoneNumber}</div>
            </div>
            <button className="logout-btn" onClick={logout}>⎋ Sign Out</button>
          </div>
        </aside>

        <main className="main">
          <div className="content">
            {activeTab === "dashboard" && (
              <Dashboard
                income={income} expense={expense} investment={investment} insurance={insurance} balance={balance}
                budget={budget} budgetProgress={budgetProgress} budgetColor={budgetColor}
                pieData={pieData} invPieData={invPieData} insPieData={insPieData}
                trendData={trendData} allMonthlyData={allMonthlyData}
                selectedMonth={selectedMonth}
                months={months} setSelectedMonth={setSelectedMonth}
                marketData={marketData} marketLoading={marketLoading} marketError={marketError}
                onMarketRefresh={marketRefresh}
              />
            )}
            {activeTab === "add" && (
              <AddForm
                amount={amount} setAmount={setAmount}
                type={type} setType={setType}
                category={category} setCategory={setCategory}
                note={note} setNote={setNote}
                date={date} setDate={setDate}
                editId={editId} onSubmit={submitTransaction} onCancel={cancelEdit}
              />
            )}
            {activeTab === "history" && (
              <History
                filtered={filtered} search={search} setSearch={setSearch}
                filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                filterType={filterType} setFilterType={setFilterType}
                onEdit={editEntry} onDelete={deleteEntry} onExport={exportCSV}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              />
            )}
            {activeTab === "invest" && (
              <Investments
                invData={monthRecs.filter((e) => e.type === "investment").sort((a, b) => new Date(b.date) - new Date(a.date))}
                invTotals={invCatTotals}
                marketData={marketData}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              />
            )}
            {activeTab === "insure" && (
              <Insurance
                insData={monthRecs.filter((e) => e.type === "insurance").sort((a, b) => new Date(b.date) - new Date(a.date))}
                insTotals={insCatTotals}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              />
            )}
            {activeTab === "settings" && (
              <Settings
                budget={budget} budgetInput={budgetInput} setBudgetInput={setBudgetInput}
                onSaveBudget={() => { setBudget(budgetInput); showToast("✓ Budget saved"); }}
                user={user} logout={logout}
              />
            )}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          <div className="bnav-items">
            {NAV.map((item) =>
              item.id === "add" ? (
                <div key={item.id} className="bnav-item" onClick={() => setActiveTab("add")}>
                  <button className="bnav-fab">+</button>
                </div>
              ) : (
                <div
                  key={item.id}
                  className={`bnav-item ${activeTab === item.id ? "active" : ""}`}
                  onClick={() => setActiveTab(item.id)}
                >
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
