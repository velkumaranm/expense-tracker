import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
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
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Timezone-safe date helpers ────────────────────────────────────────────────
// BUGFIX: toISOString() converts to UTC. In India (IST = UTC+5:30), local
// midnight is 6:30 PM previous day UTC — so April becomes "2026-03".
// Use local date parts instead.
const toYYYYMM = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES     = ["Salary","Freelance","Business","Rental","Gift","Other"];
const EXPENSE_CATEGORIES    = ["Food","Travel","Shopping","Bills","Health","Entertainment","EMI"];
const INVESTMENT_CATEGORIES = ["LIC","Mutual Fund","Stocks","PPF","PF","NPS","ULIP","PLI","Term Insurance","Other"];

const CATEGORY_ICONS = {
  Food:"🍽️", Travel:"✈️", Shopping:"🛍️", Bills:"📄", Health:"💊",
  Entertainment:"🎬", EMI:"🏠",
  Salary:"💼", Freelance:"💻", Business:"📊", Rental:"🏘️", Gift:"🎁", Other:"✨",
  LIC:"🛡️", "Mutual Fund":"📈", Stocks:"📉", PPF:"🏦", PF:"🏛️",
  NPS:"🪙", ULIP:"💎", PLI:"📮", "Term Insurance":"📋",
};

const TYPE_META = {
  expense:    { color:"var(--expense)",  dim:"var(--expense-dim)",  label:"Expense",    icon:"📤" },
  income:     { color:"var(--income)",   dim:"var(--income-dim)",   label:"Income",     icon:"📥" },
  investment: { color:"var(--invest)",   dim:"var(--invest-dim)",   label:"Investment", icon:"📊" },
};

const PIE_COLORS  = ["#C8A96E","#E8C870","#A07850","#D4B896","#F0DEB4","#8A6840","#C4A87E","#B89060"];
const INV_COLORS  = ["#818CF8","#A78BFA","#C084FC","#E879F9","#F472B6","#FB7185","#7DD3FC","#6EE7B7","#FCD34D"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  :root {
    --bg:#09090B; --surface:#0F0F13; --card:#17171D; --card-hover:#1E1E26;
    --border:#24242E; --border-light:#32323E;
    --accent:#C8A96E; --accent-dim:rgba(200,169,110,0.12); --accent-hover:#D4BC8A;
    --income:#34D399; --income-dim:rgba(52,211,153,0.1);
    --expense:#F87171; --expense-dim:rgba(248,113,113,0.1);
    --invest:#818CF8; --invest-dim:rgba(129,140,248,0.12);
    --text:#EEEAE4; --text-secondary:#9A9590; --text-muted:#52524E;
    --radius:16px; --radius-xs:7px;
  }

  html,body{height:100%;}
  body{background:var(--bg);color:var(--text);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;}
  #root{height:100%;}
  input,select,button{font-family:'Outfit',sans-serif;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}

  @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateX(110%);}to{opacity:1;transform:translateX(0);}}

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
  .content{padding:32px;max-width:900px;margin:0 auto;animation:fadeIn 0.35s ease;}

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

  /* Summary Cards */
  .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
  .summary-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;transition:border-color 0.2s,transform 0.2s;animation:fadeIn 0.4s ease;}
  .summary-card:hover{border-color:var(--border-light);transform:translateY(-1px);}
  .sc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:var(--text-muted);margin-bottom:8px;}
  .sc-value{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;}
  .sc-value.balance{color:var(--accent);}
  .sc-value.income{color:var(--income);}
  .sc-value.expense{color:var(--expense);}
  .sc-value.investment{color:var(--invest);}
  .sc-sub{font-size:10px;color:var(--text-muted);margin-top:4px;}

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
  .type-toggle{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid var(--border);border-radius:var(--radius-xs);overflow:hidden;}
  .type-btn{padding:11px 6px;text-align:center;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.18s;color:var(--text-muted);border:none;background:var(--surface);}
  .type-btn.active.expense{background:var(--expense-dim);color:var(--expense);}
  .type-btn.active.income{background:var(--income-dim);color:var(--income);}
  .type-btn.active.investment{background:var(--invest-dim);color:var(--invest);}
  .btn-primary{background:var(--accent);color:#1A1208;border:none;border-radius:var(--radius-xs);padding:13px 28px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.18s;width:100%;margin-top:4px;}
  .btn-primary:hover{background:var(--accent-hover);transform:translateY(-1px);box-shadow:0 6px 20px rgba(200,169,110,0.25);}
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
  .tx-list{display:flex;flex-direction:column;gap:6px;}
  .tx-item{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xs);padding:13px 15px;display:flex;align-items:center;gap:12px;transition:all 0.18s;animation:fadeIn 0.3s ease;}
  .tx-item:hover{border-color:var(--border-light);background:var(--card-hover);}
  .tx-icon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
  .tx-icon.expense{background:var(--expense-dim);}
  .tx-icon.income{background:var(--income-dim);}
  .tx-icon.investment{background:var(--invest-dim);}
  .tx-info{flex:1;min-width:0;}
  .tx-cat{font-size:13px;font-weight:600;color:var(--text);}
  .tx-note{font-size:11px;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .tx-badge{display:inline-block;padding:1px 7px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-left:6px;}
  .tx-badge.expense{background:var(--expense-dim);color:var(--expense);}
  .tx-badge.income{background:var(--income-dim);color:var(--income);}
  .tx-badge.investment{background:var(--invest-dim);color:var(--invest);}
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
  .bnav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 6px;cursor:pointer;color:var(--text-muted);font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;transition:color 0.18s;min-width:0;flex:1;}
  .bnav-item .bnav-icon{font-size:18px;}
  .bnav-item.active{color:var(--accent);}
  .bnav-fab{background:var(--accent);border:none;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;color:#1A1208;box-shadow:0 4px 16px rgba(200,169,110,0.4);transition:transform 0.18s;margin-top:-10px;}
  .bnav-fab:hover{transform:scale(1.08);}

  /* Toast */
  .toast{position:fixed;top:20px;right:20px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xs);padding:11px 18px;font-size:13px;z-index:9999;animation:toastIn 0.3s ease;box-shadow:0 12px 48px rgba(0,0,0,0.7);display:flex;align-items:center;gap:8px;}
  .toast.success{border-color:rgba(52,211,153,0.4);color:var(--income);}
  .toast.error{border-color:rgba(248,113,113,0.4);color:var(--expense);}
  .toast.warning{border-color:rgba(200,169,110,0.4);color:var(--accent);}

  /* Login */
  .login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:hidden;}
  .login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(200,169,110,0.07) 0%,transparent 70%);pointer-events:none;}
  .login-card{width:100%;max-width:380px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px;animation:slideUp 0.45s ease;position:relative;z-index:1;}
  .login-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:var(--accent);text-align:center;margin-bottom:4px;}
  .login-tagline{font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:28px;}
  .auth-tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:3px;margin-bottom:22px;}
  .auth-tab{padding:9px;text-align:center;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-muted);transition:all 0.18s;border:none;background:none;}
  .auth-tab.active{background:var(--card);color:var(--text);}
  .auth-error{background:var(--expense-dim);border:1px solid rgba(248,113,113,0.3);border-radius:var(--radius-xs);padding:10px 14px;font-size:12px;color:var(--expense);margin-bottom:14px;}
  .google-btn{width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
  .google-btn:hover{border-color:var(--border-light);background:var(--card-hover);}
  .divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--text-muted);font-size:11px;}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border);}
  .fg{display:flex;flex-direction:column;gap:6px;}
  .fl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted);}

  /* Responsive */
  @media(max-width:768px){
    .sidebar{display:none;}
    .bottom-nav{display:block;}
    .content{padding:20px 14px 90px;}
    .summary-grid{grid-template-columns:1fr 1fr;}
    .summary-card:first-child{grid-column:1/-1;}
    .sc-value{font-size:20px!important;}
    .charts-row{grid-template-columns:1fr;}
    .form-grid{grid-template-columns:1fr;}
    .form-group.full{grid-column:1;}
    .page-header h1{font-size:24px;}
    .search-input{width:100%;}
    .search-input:focus{width:100%;}
    .toast{top:auto;bottom:80px;right:12px;left:12px;}
    .pie-row{flex-direction:column;}
    .inv-grid{grid-template-columns:1fr 1fr;}
  }
`;

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background:"#1C1C22", border:"1px solid #32323E", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#EEEAE4" }}>
      <div style={{ color:"#9A9590", marginBottom:3 }}>Day {label}</div>
      <div style={{ color: v >= 0 ? "#34D399" : "#F87171", fontWeight:600 }}>
        {v >= 0 ? "+" : ""}₹{Math.abs(v).toLocaleString("en-IN")}
      </div>
    </div>
  );
};

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1C1C22", border:"1px solid #32323E", borderRadius:8, padding:"8px 12px", fontSize:12 }}>
      <div style={{ color:"#EEEAE4", fontWeight:600 }}>{payload[0].name}</div>
      <div style={{ color:"#C8A96E" }}>₹{payload[0].value.toLocaleString("en-IN")}</div>
    </div>
  );
};

// ─── Month Strip ──────────────────────────────────────────────────────────────

function MonthStrip({ months, selectedMonth, setSelectedMonth }) {
  return (
    <div className="month-strip">
      {months.map((m) => (
        <button key={m.value} className={`month-chip ${selectedMonth === m.value ? "active" : ""}`}
          onClick={() => setSelectedMonth(m.value)}>{m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ income, expense, investment, balance, budget, budgetProgress, budgetColor,
  pieData, invPieData, trendData, months, selectedMonth, setSelectedMonth }) {
  const fmt = (n) => "₹" + n.toLocaleString("en-IN");
  const budgetNum = parseFloat(budget) || 0;

  return (
    <>
      <div className="page-header">
        <div><h1>Dashboard</h1><p>Your financial overview</p></div>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="summary-grid">
        <div className="summary-card">
          <div className="sc-label">Net Balance</div>
          <div className="sc-value balance">{balance >= 0 ? fmt(balance) : "-₹" + Math.abs(balance).toLocaleString("en-IN")}</div>
          <div className="sc-sub">Income − Expenses</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Income</div>
          <div className="sc-value income">{fmt(income)}</div>
          <div className="sc-sub">this period</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Expense</div>
          <div className="sc-value expense">{fmt(expense)}</div>
          <div className="sc-sub">this period</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Invested</div>
          <div className="sc-value investment">{fmt(investment)}</div>
          <div className="sc-sub">this period</div>
        </div>
      </div>

      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="budget-title">Monthly Expense Budget</span>
            <span style={{ color: budgetColor, fontSize:13, fontWeight:600 }}>
              {fmt(expense)} / {fmt(budgetNum)}
            </span>
          </div>
          <div className="budget-bar-track">
            <div className="budget-bar-fill" style={{ width:`${budgetProgress}%`, background:budgetColor }} />
          </div>
          <div className="budget-footer">
            <span>{budgetProgress.toFixed(0)}% used</span>
            <span style={{ color: budgetNum - expense > 0 ? "var(--income)" : "var(--expense)" }}>
              {budgetNum - expense > 0 ? fmt(budgetNum - expense) + " remaining" : "₹" + Math.abs(budgetNum - expense).toLocaleString("en-IN") + " over budget"}
            </span>
          </div>
        </div>
      )}

      <div className="charts-row">
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
                {pieData.map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span>{item.name}</span>
                    <span className="pie-legend-val">₹{item.value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text-muted)", fontSize:12 }}>No expense data</div>}
        </div>

        <div className="chart-card">
          <div className="chart-title">Daily Cash Flow</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={155}>
              <AreaChart data={trendData} margin={{ top:5, right:5, left:-30, bottom:0 }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C8A96E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C8A96E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize:10, fill:"#52524E" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"#52524E" }} axisLine={false} tickLine={false} />
                <Tooltip content={<AreaTip />} />
                <Area type="monotone" dataKey="amount" stroke="#C8A96E" strokeWidth={2} fill="url(#ag)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text-muted)", fontSize:12 }}>No trend data</div>}
        </div>

        {invPieData.length > 0 && (
          <div className="chart-card" style={{ gridColumn:"1/-1" }}>
            <div className="chart-title">Investment Portfolio Breakdown</div>
            <div className="pie-row">
              <PieChart width={140} height={140}>
                <Pie data={invPieData} dataKey="value" cx={65} cy={65} innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {invPieData.map((_, i) => <Cell key={i} fill={INV_COLORS[i % INV_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px 24px", flex:1 }}>
                {invPieData.map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: INV_COLORS[i % INV_COLORS.length] }} />
                    <span>{item.name}</span>
                    <span className="pie-legend-val" style={{ color: INV_COLORS[i % INV_COLORS.length] }}>₹{item.value.toLocaleString("en-IN")}</span>
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

// ─── Add/Edit Form ────────────────────────────────────────────────────────────

function AddForm({ amount, setAmount, type, setType, category, setCategory, note, setNote, date, setDate, editId, onSubmit, onCancel }) {
  const cats = type === "income" ? INCOME_CATEGORIES : type === "investment" ? INVESTMENT_CATEGORIES : EXPENSE_CATEGORIES;
  const changeType = (t) => { setType(t); setCategory(t === "income" ? "Salary" : t === "investment" ? "LIC" : "Food"); };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>{editId ? "Update the details below" : "Record income, expense or investment"}</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="form-group full">
            <label className="form-label">Type</label>
            <div className="type-toggle">
              <button className={`type-btn ${type==="expense"    ? "active expense"    : ""}`} onClick={() => changeType("expense")}>📤 Expense</button>
              <button className={`type-btn ${type==="income"     ? "active income"     : ""}`} onClick={() => changeType("income")}>📥 Income</button>
              <button className={`type-btn ${type==="investment" ? "active investment" : ""}`} onClick={() => changeType("investment")}>📊 Invest</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c] || "•"} {c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input className="form-input" type="text" placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="form-group full" style={{ marginTop:4 }}>
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
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES];
  const fmt = (n) => "₹" + n.toLocaleString("en-IN");

  return (
    <>
      <div className="page-header">
        <div><h1>Transactions</h1><p>{filtered.length} record{filtered.length!==1?"s":""}</p></div>
        <button className="icon-btn" onClick={onExport}>↓ Export CSV</button>
      </div>

      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="tx-toolbar">
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["all","expense","income","investment"].map((t) => (
            <button key={t} className={`filter-chip ${filterType===t ? "active"+(t==="investment"?" inv-chip":"") : ""}`}
              onClick={() => setFilterType(t)} style={{ textTransform:"capitalize" }}>
              {t==="all" ? "All" : TYPE_META[t]?.icon+" "+TYPE_META[t]?.label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filter-strip">
        <button className={`filter-chip ${!filterCategory ? "active" : ""}`} onClick={() => setFilterCategory("")}>All Categories</button>
        {allCats.map((c) => (
          <button key={c} className={`filter-chip ${filterCategory===c ? "active" : ""}`}
            onClick={() => setFilterCategory(filterCategory===c ? "" : c)}>
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="es-icon">📭</div><p>No transactions found</p></div>
        ) : filtered.map((e) => (
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
              <div className={`tx-amount ${e.type}`}>
                {e.type==="income" ? "+" : e.type==="investment" ? "→" : "-"}{fmt(e.amount)}
              </div>
              <div className="tx-date">{e.date}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Investments Tab ──────────────────────────────────────────────────────────

function Investments({ invData, invTotals, months, selectedMonth, setSelectedMonth }) {
  const fmt = (n) => "₹" + n.toLocaleString("en-IN");
  const total = Object.values(invTotals).reduce((s, v) => s + v, 0);

  return (
    <>
      <div className="page-header">
        <div><h1>Investments</h1><p>Portfolio tracking by instrument</p></div>
      </div>
      <MonthStrip months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

      <div className="summary-grid" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
        <div className="summary-card" style={{ gridColumn:"1/-1" }}>
          <div className="sc-label">Total Invested This Period</div>
          <div className="sc-value investment">{fmt(total)}</div>
          <div className="sc-sub">across {Object.keys(invTotals).length} instrument{Object.keys(invTotals).length!==1?"s":""}</div>
        </div>
      </div>

      {Object.keys(invTotals).length === 0 ? (
        <div className="empty-state" style={{ marginTop:32 }}>
          <div className="es-icon">📊</div>
          <p>No investments for this period.<br />Use Add → Invest to log LIC, MF, Stocks, PPF etc.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom:12, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px", color:"var(--text-muted)" }}>By Instrument</div>
          <div className="inv-grid">
            {INVESTMENT_CATEGORIES.filter((c) => invTotals[c] > 0).map((c, i) => (
              <div key={c} className="inv-card">
                <div className="inv-card-icon">{CATEGORY_ICONS[c]}</div>
                <div className="inv-card-name">{c}</div>
                <div className="inv-card-amount" style={{ color: INV_COLORS[i % INV_COLORS.length] }}>{fmt(invTotals[c])}</div>
                <div className="inv-card-sub">{((invTotals[c]/total)*100).toFixed(1)}% of portfolio</div>
              </div>
            ))}
          </div>

          {invData.length > 0 && (
            <>
              <div style={{ margin:"22px 0 12px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px", color:"var(--text-muted)" }}>Recent Entries</div>
              <div className="tx-list">
                {invData.slice(0, 10).map((e) => (
                  <div key={e.id} className="tx-item">
                    <div className="tx-icon investment">{CATEGORY_ICONS[e.category] || "📊"}</div>
                    <div className="tx-info">
                      <div className="tx-cat">{e.category}</div>
                      <div className="tx-note">{e.note || <span style={{ fontStyle:"italic" }}>No note</span>}</div>
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

// ─── Settings ─────────────────────────────────────────────────────────────────

function Settings({ budget, budgetInput, setBudgetInput, onSaveBudget, user, logout }) {
  return (
    <>
      <div className="page-header"><div><h1>Settings</h1><p>Manage preferences</p></div></div>
      <div className="settings-section">
        <h3>💰 Monthly Expense Budget</h3>
        <p>Set a spending limit. Investments are tracked separately and won't affect the budget alert.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly budget..." value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {budget && <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)" }}>Current: <span style={{ color:"var(--accent)", fontWeight:600 }}>₹{parseFloat(budget).toLocaleString("en-IN")}</span></div>}
      </div>
      <div className="settings-section">
        <h3>👤 Account</h3>
        <p>Signed in as <strong style={{ color:"var(--text)" }}>{user?.email}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>
      <div className="settings-section">
        <h3>📋 About</h3>
        <p>Finwise — Premium Edition</p>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:8, lineHeight:1.9 }}>
          ✓ Income, Expense &amp; Investment tracking<br />
          ✓ LIC, MF, Stocks, PPF, PF, NPS, ULIP, PLI, Term Insurance<br />
          ✓ Multi-month view · Budget alerts · CSV export<br />
          ✓ IST timezone-safe month filtering
        </div>
      </div>
    </>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginPage({ email, setEmail, password, setPassword, authMode, setAuthMode, authError, loading, onLogin, onSignup, onGoogle }) {
  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Smart money. Clear picture.</div>
        <div className="auth-tabs">
          <button className={`auth-tab ${authMode==="login"?"active":""}`} onClick={() => setAuthMode("login")}>Sign In</button>
          <button className={`auth-tab ${authMode==="signup"?"active":""}`} onClick={() => setAuthMode("signup")}>Sign Up</button>
        </div>
        {authError && <div className="auth-error">{authError}</div>}
        <div className="fg" style={{ marginBottom:12 }}>
          <label className="fl">Email</label>
          <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fg" style={{ marginBottom:16 }}>
          <label className="fl">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key==="Enter" && (authMode==="login" ? onLogin() : onSignup())} />
        </div>
        <button className="btn-primary" onClick={authMode==="login" ? onLogin : onSignup} disabled={loading}>
          {loading ? "Please wait…" : authMode==="login" ? "Sign In" : "Create Account"}
        </button>
        <div className="divider">or</div>
        <button className="google-btn" onClick={onGoogle}><span>G</span> Continue with Google</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]               = useState(null);
  const [authMode, setAuthMode]       = useState("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [authError, setAuthError]     = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [amount, setAmount]     = useState("");
  const [type, setType]         = useState("expense");
  const [category, setCategory] = useState("Food");
  const [note, setNote]         = useState("");
  const [date, setDate]         = useState(toLocalDateStr(new Date()));

  const [expenses, setExpenses] = useState([]);
  const [editId, setEditId]     = useState(null);

  const [search, setSearch]                 = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType]         = useState("all");

  const [budget, setBudget]           = useState(localStorage.getItem("budget") || "");
  const [budgetInput, setBudgetInput] = useState(localStorage.getItem("budget") || "");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast]         = useState(null);

  // BUGFIX: use toYYYYMM (local) instead of toISOString() to avoid IST UTC shift
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(now));

  useEffect(() => auth.onAuthStateChanged(setUser), []);

  useEffect(() => {
    if (!user) return;
    // Reuses the existing "expenses" Firestore collection — no migration needed.
    // Investments are simply stored with type:"investment" in the same collection.
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => { localStorage.setItem("budget", budget); }, [budget]);

  useEffect(() => {
    if (!budget || expenses.length === 0) return;
    const exp = expenses
      .filter((e) => e.type === "expense" && e.date?.startsWith(selectedMonth))
      .reduce((s, e) => s + e.amount, 0);
    if (exp > parseFloat(budget)) showToast("⚠️ Monthly budget exceeded!", "warning");
  }, [expenses]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const login = async () => {
    setAuthError(""); setAuthLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError(e.message.replace("Firebase: ","")); }
    finally { setAuthLoading(false); }
  };
  const signup = async () => {
    setAuthError(""); setAuthLoading(true);
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError(e.message.replace("Firebase: ","")); }
    finally { setAuthLoading(false); }
  };
  const googleLogin = async () => {
    setAuthError("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { setAuthError(e.message); }
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
      setAmount(""); setNote(""); setActiveTab("dashboard");
    } catch { showToast("Failed to save", "error"); }
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
    showToast("Transaction removed", "error");
  };

  const editExpense = (e) => {
    setAmount(String(e.amount)); setType(e.type); setCategory(e.category);
    setNote(e.note || ""); setDate(e.date); setEditId(e.id);
    setActiveTab("add");
  };

  const cancelEdit = () => { setEditId(null); setAmount(""); setNote(""); setActiveTab("history"); };

  // ── Computed ──
  const monthRecs  = expenses.filter((e) => e.date?.startsWith(selectedMonth));
  const income     = monthRecs.filter((e) => e.type === "income"    ).reduce((s, e) => s + e.amount, 0);
  const expense    = monthRecs.filter((e) => e.type === "expense"   ).reduce((s, e) => s + e.amount, 0);
  const investment = monthRecs.filter((e) => e.type === "investment").reduce((s, e) => s + e.amount, 0);
  const balance    = income - expense;

  const expCatTotals = {};
  monthRecs.filter((e) => e.type === "expense").forEach((e) => {
    expCatTotals[e.category] = (expCatTotals[e.category] || 0) + e.amount;
  });
  const pieData = Object.entries(expCatTotals).map(([name, value]) => ({ name, value }));

  const invCatTotals = {};
  monthRecs.filter((e) => e.type === "investment").forEach((e) => {
    invCatTotals[e.category] = (invCatTotals[e.category] || 0) + e.amount;
  });
  const invPieData = Object.entries(invCatTotals).map(([name, value]) => ({ name, value }));

  const trend = {};
  monthRecs.filter((e) => e.type !== "investment").forEach((e) => {
    const day = e.date?.split("-")[2];
    if (day) trend[day] = (trend[day] || 0) + (e.type === "income" ? e.amount : -e.amount);
  });
  const trendData = Object.entries(trend).sort((a,b) => +a[0]-+b[0]).map(([day, amount]) => ({ day:+day, amount }));

  const filtered = monthRecs
    .filter((e) =>
      (filterType === "all" || e.type === filterType) &&
      (!search || e.note?.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCategory || e.category === filterCategory)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const budgetNum      = parseFloat(budget) || 0;
  const budgetProgress = budgetNum ? Math.min((expense / budgetNum) * 100, 100) : 0;
  const budgetColor    = budgetProgress > 90 ? "var(--expense)" : budgetProgress > 70 ? "var(--accent)" : "var(--income)";

  // BUGFIX: toYYYYMM uses local date parts — no UTC shift for IST users
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: toYYYYMM(d), label: MONTH_NAMES[d.getMonth()] + " '" + String(d.getFullYear()).slice(2) };
  });

  const exportCSV = () => {
    const headers = ["Date","Type","Category","Amount","Note"];
    const rows = filtered.map((e) => [e.date, e.type, e.category, e.amount, e.note || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `finwise-${selectedMonth}.csv`;
    a.click();
    showToast("✓ CSV exported");
  };

  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginPage email={email} setEmail={setEmail} password={password} setPassword={setPassword}
        authMode={authMode} setAuthMode={setAuthMode} authError={authError} loading={authLoading}
        onLogin={login} onSignup={signup} onGoogle={googleLogin} />
    </>
  );

  const NAV = [
    { id:"dashboard", icon:"◉",  label:"Overview"  },
    { id:"add",       icon:"＋",  label:"Add"       },
    { id:"history",   icon:"≡",   label:"History"   },
    { id:"invest",    icon:"📊",  label:"Invest"    },
    { id:"settings",  icon:"◎",  label:"Settings"  },
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
            <div key={item.id} className={`nav-item ${activeTab===item.id?"active":""}`} onClick={() => setActiveTab(item.id)}>
              <span className="ni">{item.icon}</span>{item.label}
            </div>
          ))}
          <div className="sidebar-spacer" />
          <div className="sidebar-footer">
            <div className="user-row">
              <div className="user-avatar">{user.email?.[0]?.toUpperCase()}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <button className="logout-btn" onClick={logout}>⎋ Sign Out</button>
          </div>
        </aside>

        <main className="main">
          <div className="content">
            {activeTab === "dashboard" && (
              <Dashboard income={income} expense={expense} investment={investment} balance={balance}
                budget={budget} budgetProgress={budgetProgress} budgetColor={budgetColor}
                pieData={pieData} invPieData={invPieData} trendData={trendData}
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
            {activeTab === "invest" && (
              <Investments
                invData={monthRecs.filter((e) => e.type==="investment").sort((a,b) => new Date(b.date)-new Date(a.date))}
                invTotals={invCatTotals}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
            )}
            {activeTab === "settings" && (
              <Settings budget={budget} budgetInput={budgetInput} setBudgetInput={setBudgetInput}
                onSaveBudget={() => { setBudget(budgetInput); showToast("✓ Budget saved"); }}
                user={user} logout={logout} />
            )}
          </div>
        </main>

        <nav className="bottom-nav">
          <div className="bnav-items">
            {NAV.map((item) =>
              item.id === "add" ? (
                <div key={item.id} className="bnav-item" onClick={() => setActiveTab("add")}>
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
