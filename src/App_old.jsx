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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = ["Salary","Freelance","Business","Investment","Rental","Gift","Other"];
const EXPENSE_CATEGORIES = ["Food","Travel","Shopping","Bills","Health","Entertainment","EMI"];

const CATEGORY_ICONS = {
  Food:"🍽️", Travel:"✈️", Shopping:"🛍️", Bills:"📄", Health:"💊",
  Entertainment:"🎬", EMI:"🏠", Salary:"💼", Freelance:"💻",
  Business:"📊", Investment:"💰", Rental:"🏘️", Gift:"🎁", Other:"✨",
};

const PIE_COLORS = ["#C8A96E","#E8C870","#A07850","#D4B896","#F0DEB4","#8A6840","#C4A87E","#B89060"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Global Styles ────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #09090B;
    --surface: #0F0F13;
    --card: #17171D;
    --card-hover: #1E1E26;
    --border: #24242E;
    --border-light: #32323E;
    --accent: #C8A96E;
    --accent-dim: rgba(200,169,110,0.12);
    --accent-hover: #D4BC8A;
    --income: #34D399;
    --income-dim: rgba(52,211,153,0.1);
    --expense: #F87171;
    --expense-dim: rgba(248,113,113,0.1);
    --text: #EEEAE4;
    --text-secondary: #9A9590;
    --text-muted: #52524E;
    --shadow: 0 4px 24px rgba(0,0,0,0.5);
    --shadow-lg: 0 12px 48px rgba(0,0,0,0.7);
    --radius: 16px;
    --radius-sm: 10px;
    --radius-xs: 7px;
  }

  html, body { height: 100%; }
  body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; }
  #root { height: 100%; }
  input, select, button, textarea { font-family: 'Outfit', sans-serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
  @keyframes toastIn { from { opacity:0; transform:translateX(110%); } to { opacity:1; transform:translateX(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

  /* ── Shell ── */
  .app-shell { display:flex; height:100vh; overflow:hidden; }

  /* ── Sidebar ── */
  .sidebar {
    width:220px; flex-shrink:0;
    background:var(--surface);
    border-right:1px solid var(--border);
    display:flex; flex-direction:column;
    padding:20px 0; gap:2px;
    overflow:hidden;
  }
  .sidebar-logo {
    padding:0 20px 20px;
    border-bottom:1px solid var(--border);
    margin-bottom:8px;
  }
  .sidebar-logo .wordmark {
    font-family:'Cormorant Garamond',serif;
    font-size:20px; font-weight:700;
    color:var(--accent); letter-spacing:0.3px;
    display:flex; align-items:center; gap:8px;
  }
  .sidebar-logo .tagline {
    font-size:10px; color:var(--text-muted);
    text-transform:uppercase; letter-spacing:1.2px;
    margin-top:3px; font-weight:500;
  }
  .nav-item {
    display:flex; align-items:center; gap:10px;
    padding:10px 14px; margin:0 8px;
    border-radius:var(--radius-xs);
    cursor:pointer; color:var(--text-secondary);
    font-size:13px; font-weight:500;
    transition:all 0.18s;
    border:1px solid transparent;
  }
  .nav-item:hover { color:var(--text); background:var(--card); }
  .nav-item.active { color:var(--accent); background:var(--accent-dim); border-color:rgba(200,169,110,0.2); }
  .nav-item .ni { font-size:16px; width:20px; text-align:center; }
  .sidebar-spacer { flex:1; }
  .sidebar-footer { padding:16px 8px 0; border-top:1px solid var(--border); }
  .user-row { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-bottom:6px; }
  .user-avatar {
    width:32px; height:32px; border-radius:50%;
    background:var(--accent-dim); border:1px solid var(--accent);
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:700; color:var(--accent); flex-shrink:0;
  }
  .user-email { font-size:11px; color:var(--text-muted); truncate; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .logout-btn {
    display:flex; align-items:center; gap:8px;
    width:100%; padding:9px 12px;
    background:none; border:1px solid var(--border);
    border-radius:var(--radius-xs);
    color:var(--text-secondary); font-size:12px; font-weight:500;
    cursor:pointer; transition:all 0.18s;
  }
  .logout-btn:hover { color:var(--expense); border-color:rgba(248,113,113,0.4); background:var(--expense-dim); }

  /* ── Main ── */
  .main { flex:1; overflow-y:auto; background:var(--bg); }
  .content { padding:32px; max-width:860px; margin:0 auto; animation:fadeIn 0.35s ease; }

  /* ── Page Header ── */
  .page-header { margin-bottom:28px; display:flex; justify-content:space-between; align-items:flex-end; }
  .page-header h1 { font-family:'Cormorant Garamond',serif; font-size:30px; font-weight:700; color:var(--text); }
  .page-header p { font-size:13px; color:var(--text-muted); margin-top:3px; }

  /* ── Summary Cards ── */
  .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:22px; }
  .summary-card {
    background:var(--card); border:1px solid var(--border);
    border-radius:var(--radius); padding:18px 20px;
    transition:border-color 0.2s, transform 0.2s;
    animation:fadeIn 0.4s ease;
  }
  .summary-card:hover { border-color:var(--border-light); transform:translateY(-1px); }
  .summary-card .sc-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px; }
  .summary-card .sc-value { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:700; }
  .summary-card .sc-value.balance { color:var(--accent); }
  .summary-card .sc-value.income { color:var(--income); }
  .summary-card .sc-value.expense { color:var(--expense); }
  .summary-card .sc-sub { font-size:11px; color:var(--text-muted); margin-top:5px; }
  .summary-card .sc-icon { font-size:24px; margin-bottom:10px; }

  /* ── Month Strip ── */
  .month-strip { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; margin-bottom:22px; scrollbar-width:none; }
  .month-strip::-webkit-scrollbar { display:none; }
  .month-chip {
    padding:5px 14px; border-radius:99px; font-size:12px; font-weight:500;
    border:1px solid var(--border); background:none; color:var(--text-muted);
    cursor:pointer; transition:all 0.18s; white-space:nowrap; flex-shrink:0;
  }
  .month-chip:hover { color:var(--text); border-color:var(--border-light); }
  .month-chip.active { background:var(--accent-dim); color:var(--accent); border-color:rgba(200,169,110,0.35); }

  /* ── Budget Bar ── */
  .budget-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:18px 20px; margin-bottom:20px; }
  .budget-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .budget-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); }
  .budget-amounts { font-size:13px; font-weight:500; }
  .budget-bar-track { height:5px; background:var(--border); border-radius:99px; overflow:hidden; }
  .budget-bar-fill { height:100%; border-radius:99px; transition:width 1s cubic-bezier(0.34,1.56,0.64,1); }
  .budget-footer { display:flex; justify-content:space-between; margin-top:7px; font-size:11px; color:var(--text-muted); }

  /* ── Charts ── */
  .charts-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:22px; }
  .chart-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:20px; }
  .chart-card.wide { grid-column:1/-1; }
  .chart-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:16px; }
  .pie-row { display:flex; align-items:center; gap:16px; }
  .pie-legend { display:flex; flex-direction:column; gap:7px; flex:1; }
  .pie-legend-item { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--text-secondary); }
  .pie-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .pie-legend-val { margin-left:auto; font-weight:500; font-size:11px; }

  /* ── Form ── */
  .form-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:28px; }
  .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .form-group { display:flex; flex-direction:column; gap:6px; }
  .form-group.full { grid-column:1/-1; }
  .form-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-muted); }
  .form-input, .form-select {
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--radius-xs); padding:11px 13px;
    color:var(--text); font-size:14px; width:100%;
    outline:none; transition:border-color 0.18s, box-shadow 0.18s;
    -webkit-appearance:none; appearance:none;
  }
  .form-select {
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B6B6B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 12px center; padding-right:32px;
  }
  .form-input:focus, .form-select:focus { border-color:rgba(200,169,110,0.5); box-shadow:0 0 0 3px rgba(200,169,110,0.08); }
  .form-input::placeholder { color:var(--text-muted); }
  .type-toggle { display:grid; grid-template-columns:1fr 1fr; border:1px solid var(--border); border-radius:var(--radius-xs); overflow:hidden; }
  .type-btn { padding:11px; text-align:center; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.18s; color:var(--text-muted); border:none; background:var(--surface); }
  .type-btn.active.expense { background:var(--expense-dim); color:var(--expense); }
  .type-btn.active.income { background:var(--income-dim); color:var(--income); }
  .btn-primary {
    background:var(--accent); color:#1A1208;
    border:none; border-radius:var(--radius-xs);
    padding:13px 28px; font-size:14px; font-weight:600;
    cursor:pointer; transition:all 0.18s; width:100%;
    margin-top:4px; letter-spacing:0.2px;
  }
  .btn-primary:hover { background:var(--accent-hover); transform:translateY(-1px); box-shadow:0 6px 20px rgba(200,169,110,0.25); }
  .btn-primary:active { transform:translateY(0); }
  .btn-secondary {
    background:none; border:1px solid var(--border); border-radius:var(--radius-xs);
    padding:12px 20px; font-size:13px; font-weight:500;
    color:var(--text-secondary); cursor:pointer; transition:all 0.18s; width:100%; margin-top:4px;
  }
  .btn-secondary:hover { border-color:var(--border-light); color:var(--text); }

  /* ── Transactions ── */
  .tx-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
  .tx-toolbar h3 { font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:700; }
  .tx-controls { display:flex; align-items:center; gap:8px; }
  .search-wrap { position:relative; }
  .search-icon { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:13px; pointer-events:none; }
  .search-input {
    background:var(--card); border:1px solid var(--border); border-radius:99px;
    padding:8px 14px 8px 32px; color:var(--text); font-size:13px;
    width:180px; outline:none; transition:all 0.18s;
  }
  .search-input:focus { border-color:rgba(200,169,110,0.4); width:220px; }
  .search-input::placeholder { color:var(--text-muted); }
  .filter-strip { display:flex; gap:6px; overflow-x:auto; margin-bottom:14px; padding-bottom:2px; scrollbar-width:none; }
  .filter-strip::-webkit-scrollbar { display:none; }
  .filter-chip {
    padding:4px 12px; border-radius:99px; font-size:11px; font-weight:500;
    border:1px solid var(--border); background:none; color:var(--text-muted);
    cursor:pointer; transition:all 0.16s; white-space:nowrap; flex-shrink:0;
  }
  .filter-chip:hover { color:var(--text); border-color:var(--border-light); }
  .filter-chip.active { background:var(--accent-dim); color:var(--accent); border-color:rgba(200,169,110,0.3); }
  .tx-list { display:flex; flex-direction:column; gap:6px; }
  .tx-item {
    background:var(--card); border:1px solid var(--border);
    border-radius:var(--radius-xs);
    padding:13px 15px; display:flex; align-items:center; gap:12px;
    transition:all 0.18s; animation:fadeIn 0.3s ease;
  }
  .tx-item:hover { border-color:var(--border-light); background:var(--card-hover); }
  .tx-icon { width:38px; height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0; }
  .tx-icon.expense { background:var(--expense-dim); }
  .tx-icon.income { background:var(--income-dim); }
  .tx-info { flex:1; min-width:0; }
  .tx-cat { font-size:13px; font-weight:600; color:var(--text); }
  .tx-note { font-size:11px; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tx-meta { text-align:right; flex-shrink:0; }
  .tx-amount { font-size:14px; font-weight:600; font-variant-numeric:tabular-nums; }
  .tx-amount.income { color:var(--income); }
  .tx-amount.expense { color:var(--expense); }
  .tx-date { font-size:10px; color:var(--text-muted); margin-top:2px; }
  .tx-actions { display:flex; gap:5px; opacity:0; transition:opacity 0.18s; }
  .tx-item:hover .tx-actions { opacity:1; }
  .tx-btn {
    background:var(--surface); border:1px solid var(--border); border-radius:5px;
    padding:4px 9px; font-size:10px; font-weight:600; cursor:pointer;
    color:var(--text-secondary); transition:all 0.14s; text-transform:uppercase; letter-spacing:0.4px;
  }
  .tx-btn:hover { color:var(--text); border-color:var(--border-light); }
  .tx-btn.del:hover { color:var(--expense); border-color:rgba(248,113,113,0.4); background:var(--expense-dim); }
  .empty-state { text-align:center; padding:48px 24px; color:var(--text-muted); }
  .empty-state .es-icon { font-size:36px; margin-bottom:12px; }
  .empty-state p { font-size:13px; }

  /* ── Export btn ── */
  .icon-btn {
    display:flex; align-items:center; gap:6px;
    background:none; border:1px solid var(--border); border-radius:var(--radius-xs);
    padding:7px 13px; font-size:12px; font-weight:500;
    color:var(--text-secondary); cursor:pointer; transition:all 0.18s;
  }
  .icon-btn:hover { color:var(--accent); border-color:rgba(200,169,110,0.35); background:var(--accent-dim); }

  /* ── Settings ── */
  .settings-section { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:24px; margin-bottom:14px; }
  .settings-section h3 { font-size:15px; font-weight:600; color:var(--text); margin-bottom:4px; }
  .settings-section p { font-size:12px; color:var(--text-muted); margin-bottom:16px; }
  .setting-row { display:flex; align-items:center; gap:12px; }
  .setting-input { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-xs); padding:11px 13px; color:var(--text); font-size:14px; outline:none; transition:border-color 0.18s; }
  .setting-input:focus { border-color:rgba(200,169,110,0.5); }
  .setting-input::placeholder { color:var(--text-muted); }
  .btn-save { background:var(--accent); color:#1A1208; border:none; border-radius:var(--radius-xs); padding:11px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.18s; }
  .btn-save:hover { background:var(--accent-hover); }
  .danger-btn { background:none; border:1px solid rgba(248,113,113,0.3); border-radius:var(--radius-xs); padding:11px 20px; font-size:13px; font-weight:500; color:var(--expense); cursor:pointer; transition:all 0.18s; }
  .danger-btn:hover { background:var(--expense-dim); border-color:rgba(248,113,113,0.6); }

  /* ── Bottom Nav ── */
  .bottom-nav { display:none; position:fixed; bottom:0; left:0; right:0; background:var(--surface); border-top:1px solid var(--border); z-index:200; padding-bottom:env(safe-area-inset-bottom,0px); }
  .bnav-items { display:flex; justify-content:space-around; }
  .bnav-item { display:flex; flex-direction:column; align-items:center; gap:3px; padding:10px 8px; cursor:pointer; color:var(--text-muted); font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.6px; transition:color 0.18s; min-width:60px; }
  .bnav-item .bnav-icon { font-size:20px; }
  .bnav-item.active { color:var(--accent); }
  .bnav-fab { background:var(--accent); border:none; border-radius:50%; width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer; color:#1A1208; box-shadow:0 4px 16px rgba(200,169,110,0.4); transition:transform 0.18s; margin-top:-12px; }
  .bnav-fab:hover { transform:scale(1.08); }

  /* ── Toast ── */
  .toast { position:fixed; top:20px; right:20px; background:var(--card); border:1px solid var(--border); border-radius:var(--radius-xs); padding:11px 18px; font-size:13px; z-index:9999; animation:toastIn 0.3s ease; box-shadow:var(--shadow-lg); display:flex; align-items:center; gap:8px; }
  .toast.success { border-color:rgba(52,211,153,0.4); color:var(--income); }
  .toast.error { border-color:rgba(248,113,113,0.4); color:var(--expense); }
  .toast.warning { border-color:rgba(200,169,110,0.4); color:var(--accent); }

  /* ── Login ── */
  .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); padding:20px; position:relative; overflow:hidden; }
  .login-bg { position:absolute; inset:0; background:radial-gradient(ellipse 60% 50% at 50% 0%, rgba(200,169,110,0.07) 0%, transparent 70%); pointer-events:none; }
  .login-card { width:100%; max-width:380px; background:var(--card); border:1px solid var(--border); border-radius:20px; padding:36px; animation:slideUp 0.45s ease; position:relative; z-index:1; }
  .login-logo { font-family:'Cormorant Garamond',serif; font-size:26px; font-weight:700; color:var(--accent); text-align:center; margin-bottom:4px; }
  .login-tagline { font-size:12px; color:var(--text-muted); text-align:center; margin-bottom:28px; letter-spacing:0.3px; }
  .auth-tabs { display:grid; grid-template-columns:1fr 1fr; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-xs); padding:3px; margin-bottom:22px; }
  .auth-tab { padding:9px; text-align:center; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; color:var(--text-muted); transition:all 0.18s; border:none; background:none; }
  .auth-tab.active { background:var(--card); color:var(--text); }
  .auth-error { background:var(--expense-dim); border:1px solid rgba(248,113,113,0.3); border-radius:var(--radius-xs); padding:10px 14px; font-size:12px; color:var(--expense); margin-bottom:14px; }
  .google-btn { width:100%; padding:12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-xs); color:var(--text); font-size:13px; font-weight:500; cursor:pointer; transition:all 0.18s; display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; }
  .google-btn:hover { border-color:var(--border-light); background:var(--card-hover); }
  .divider { display:flex; align-items:center; gap:10px; margin:14px 0; color:var(--text-muted); font-size:11px; }
  .divider::before,.divider::after { content:''; flex:1; height:1px; background:var(--border); }

  /* ── Responsive ── */
  @media (max-width:768px) {
    .sidebar { display:none; }
    .bottom-nav { display:block; }
    .content { padding:20px 14px 88px; }
    .summary-grid { grid-template-columns:1fr 1fr; }
    .summary-card:first-child { grid-column:1/-1; }
    .summary-card .sc-value { font-size:22px; }
    .charts-row { grid-template-columns:1fr; }
    .form-grid { grid-template-columns:1fr; }
    .form-group.full { grid-column:1; }
    .page-header { flex-direction:column; align-items:flex-start; gap:4px; }
    .page-header h1 { font-size:24px; }
    .tx-controls { width:100%; }
    .search-input { width:100%; }
    .search-input:focus { width:100%; }
    .toast { top:auto; bottom:80px; right:12px; left:12px; }
    .pie-row { flex-direction:column; }
  }
`;

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1C1C22", border:"1px solid #32323E", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#EEEAE4" }}>
      <div style={{ color:"#9A9590", marginBottom:3 }}>Day {label}</div>
      <div style={{ color: payload[0].value >= 0 ? "#34D399" : "#F87171", fontWeight:600 }}>
        {payload[0].value >= 0 ? "+" : ""}₹{Math.abs(payload[0].value).toLocaleString("en-IN")}
      </div>
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1C1C22", border:"1px solid #32323E", borderRadius:8, padding:"8px 12px", fontSize:12 }}>
      <div style={{ color:"#EEEAE4", fontWeight:600 }}>{payload[0].name}</div>
      <div style={{ color:"#C8A96E" }}>₹{payload[0].value.toLocaleString("en-IN")}</div>
    </div>
  );
};

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function Dashboard({ income, expense, balance, budget, budgetProgress, budgetColor, pieData, trendData, months, selectedMonth, setSelectedMonth }) {
  const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN");
  const budgetNum = parseFloat(budget) || 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your financial overview</p>
        </div>
      </div>

      {/* Month strip */}
      <div className="month-strip">
        {months.map((m) => (
          <button key={m.value} className={`month-chip ${selectedMonth === m.value ? "active" : ""}`} onClick={() => setSelectedMonth(m.value)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="sc-label">Net Balance</div>
          <div className={`sc-value balance`}>{balance >= 0 ? fmt(balance) : "-" + fmt(balance)}</div>
          <div className="sc-sub">{selectedMonth}</div>
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
      </div>

      {/* Budget progress */}
      {budgetNum > 0 && (
        <div className="budget-card">
          <div className="budget-header">
            <span className="budget-title">Monthly Budget</span>
            <span className="budget-amounts" style={{ color: budgetColor, fontSize:13, fontWeight:600 }}>
              {fmt(expense)} / {fmt(budgetNum)}
            </span>
          </div>
          <div className="budget-bar-track">
            <div className="budget-bar-fill" style={{ width:`${budgetProgress}%`, background:budgetColor }} />
          </div>
          <div className="budget-footer">
            <span>{budgetProgress.toFixed(0)}% used</span>
            <span style={{ color: budgetNum - expense > 0 ? "var(--income)" : "var(--expense)" }}>
              {budgetNum - expense > 0 ? fmt(budgetNum - expense) + " remaining" : fmt(expense - budgetNum) + " over budget"}
            </span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Expense Breakdown</div>
          {pieData.length > 0 ? (
            <div className="pie-row">
              <PieChart width={130} height={130}>
                <Pie data={pieData} dataKey="value" cx={60} cy={60} innerRadius={35} outerRadius={58} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
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
          ) : (
            <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text-muted)", fontSize:12 }}>No expense data</div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-title">Daily Cash Flow</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData} margin={{ top:5, right:5, left:-30, bottom:0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8A96E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C8A96E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize:10, fill:"#52524E" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"#52524E" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#C8A96E" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text-muted)", fontSize:12 }}>No trend data</div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Add/Edit Tab ──────────────────────────────────────────────────────────────

function AddForm({ amount, setAmount, type, setType, category, setCategory, note, setNote, date, setDate, editId, onSubmit, onCancel }) {
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit Transaction" : "Add Transaction"}</h1>
          <p>{editId ? "Update the details below" : "Record a new income or expense"}</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-grid">
          <div className="form-group full">
            <label className="form-label">Type</label>
            <div className="type-toggle">
              <button className={`type-btn ${type === "expense" ? "active expense" : ""}`} onClick={() => { setType("expense"); setCategory("Food"); }}>
                📤 Expense
              </button>
              <button className={`type-btn ${type === "income" ? "active income" : ""}`} onClick={() => { setType("income"); setCategory("Salary"); }}>
                📥 Income
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
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

// ─── History Tab ───────────────────────────────────────────────────────────────

function History({ filtered, search, setSearch, filterCategory, setFilterCategory, onEdit, onDelete, onExport, months, selectedMonth, setSelectedMonth }) {
  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const fmt = (n) => "₹" + n.toLocaleString("en-IN");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>{filtered.length} record{filtered.length !== 1 ? "s" : ""} found</p>
        </div>
        <button className="icon-btn" onClick={onExport}>
          ↓ Export CSV
        </button>
      </div>

      <div className="month-strip">
        {months.map((m) => (
          <button key={m.value} className={`month-chip ${selectedMonth === m.value ? "active" : ""}`} onClick={() => setSelectedMonth(m.value)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="tx-toolbar">
        <div className="tx-controls">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="filter-strip">
        <button className={`filter-chip ${!filterCategory ? "active" : ""}`} onClick={() => setFilterCategory("")}>All</button>
        {allCats.map((c) => (
          <button key={c} className={`filter-chip ${filterCategory === c ? "active" : ""}`} onClick={() => setFilterCategory(filterCategory === c ? "" : c)}>
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      <div className="tx-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">📭</div>
            <p>No transactions found</p>
          </div>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="tx-item">
              <div className={`tx-icon ${e.type}`}>{CATEGORY_ICONS[e.category] || "💸"}</div>
              <div className="tx-info">
                <div className="tx-cat">{e.category}</div>
                <div className="tx-note">{e.note || <span style={{ fontStyle:"italic" }}>No note</span>}</div>
              </div>
              <div className="tx-actions">
                <button className="tx-btn" onClick={() => onEdit(e)}>Edit</button>
                <button className="tx-btn del" onClick={() => onDelete(e.id)}>Delete</button>
              </div>
              <div className="tx-meta">
                <div className={`tx-amount ${e.type}`}>
                  {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                </div>
                <div className="tx-date">{e.date}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function Settings({ budget, budgetInput, setBudgetInput, onSaveBudget, user, logout }) {
  return (
    <>
      <div className="page-header">
        <div><h1>Settings</h1><p>Manage your preferences</p></div>
      </div>

      <div className="settings-section">
        <h3>💰 Monthly Budget</h3>
        <p>Set a spending limit and get alerts when you exceed it.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly budget..." value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {budget && (
          <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)" }}>
            Current budget: <span style={{ color:"var(--accent)", fontWeight:600 }}>₹{parseFloat(budget).toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>👤 Account</h3>
        <p>Signed in as <strong style={{ color:"var(--text)" }}>{user?.email}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>

      <div className="settings-section">
        <h3>📊 About</h3>
        <p>Smart Finance Tracker — Premium Edition</p>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:8, lineHeight:1.8 }}>
          Track income & expenses • Category breakdown • Budget alerts • CSV export • Multi-month view
        </div>
      </div>
    </>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────

function LoginPage({ email, setEmail, password, setPassword, authMode, setAuthMode, authError, loading, onLogin, onSignup, onGoogle }) {
  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">Smart money. Clear picture.</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>Sign In</button>
          <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => setAuthMode("signup")}>Sign Up</button>
        </div>

        {authError && <div className="auth-error">{authError}</div>}

        <div className="form-group" style={{ marginBottom:12 }}>
          <label className="form-label">Email</label>
          <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom:16 }}>
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? onLogin() : onSignup())} />
        </div>

        <button className="btn-primary" onClick={authMode === "login" ? onLogin : onSignup} disabled={loading}>
          {loading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div className="divider">or</div>
        <button className="google-btn" onClick={onGoogle}>
          <span>G</span> Continue with Google
        </button>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [expenses, setExpenses] = useState([]);
  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [budget, setBudget] = useState(localStorage.getItem("budget") || "");
  const [budgetInput, setBudgetInput] = useState(localStorage.getItem("budget") || "");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.toISOString().slice(0, 7));

  // Auth listener
  useEffect(() => auth.onAuthStateChanged(setUser), []);

  // Firestore listener
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  // Budget sync
  useEffect(() => { localStorage.setItem("budget", budget); }, [budget]);

  // Budget alert
  useEffect(() => {
    if (!budget || expenses.length === 0) return;
    const monthExp = expenses
      .filter((e) => e.type === "expense" && e.date?.startsWith(selectedMonth))
      .reduce((s, e) => s + e.amount, 0);
    if (monthExp > parseFloat(budget)) showToast("⚠️ Monthly budget exceeded!", "warning");
  }, [expenses]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Auth actions
  const login = async () => {
    setAuthError(""); setAuthLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError(e.message.replace("Firebase: ", "")); }
    finally { setAuthLoading(false); }
  };

  const signup = async () => {
    setAuthError(""); setAuthLoading(true);
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError(e.message.replace("Firebase: ", "")); }
    finally { setAuthLoading(false); }
  };

  const googleLogin = async () => {
    setAuthError("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { setAuthError(e.message); }
  };

  const logout = () => { signOut(auth); setActiveTab("dashboard"); };

  // CRUD
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

  // Computed data
  const monthExpenses = expenses.filter((e) => e.date?.startsWith(selectedMonth));
  const income = monthExpenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expense = monthExpenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = income - expense;

  const categoryTotals = {};
  monthExpenses.filter((e) => e.type === "expense").forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

  const trend = {};
  monthExpenses.forEach((e) => {
    const day = e.date?.split("-")[2];
    if (day) trend[day] = (trend[day] || 0) + (e.type === "income" ? e.amount : -e.amount);
  });
  const trendData = Object.entries(trend).sort((a, b) => +a[0] - +b[0]).map(([day, amount]) => ({ day: +day, amount }));

  const filtered = monthExpenses
    .filter((e) =>
      (!search || e.note?.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCategory || e.category === filterCategory)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const budgetNum = parseFloat(budget) || 0;
  const budgetProgress = budgetNum ? Math.min((expense / budgetNum) * 100, 100) : 0;
  const budgetColor = budgetProgress > 90 ? "var(--expense)" : budgetProgress > 70 ? "var(--accent)" : "var(--income)";

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: d.toISOString().slice(0, 7), label: MONTH_NAMES[d.getMonth()] + " '" + String(d.getFullYear()).slice(2) };
  });

  const exportCSV = () => {
    const headers = ["Date", "Type", "Category", "Amount", "Note"];
    const rows = filtered.map((e) => [e.date, e.type, e.category, e.amount, e.note || ""]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${selectedMonth}.csv`;
    a.click();
    showToast("✓ CSV exported");
  };

  // ── Render ──

  if (!user) {
    return (
      <>
        <style>{CSS}</style>
        <LoginPage
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          authMode={authMode} setAuthMode={setAuthMode}
          authError={authError} loading={authLoading}
          onLogin={login} onSignup={signup} onGoogle={googleLogin}
        />
      </>
    );
  }

  const NAV = [
    { id: "dashboard", icon: "◉", label: "Overview" },
    { id: "add",       icon: "＋", label: "Add" },
    { id: "history",   icon: "≡",  label: "History" },
    { id: "settings",  icon: "◎",  label: "Settings" },
  ];

  return (
    <>
      <style>{CSS}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="app-shell">
        {/* ── Desktop Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="wordmark">◈ Finwise</div>
            <div className="tagline">Smart Finance Tracker</div>
          </div>

          {NAV.map((item) => (
            <div key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <span className="ni">{item.icon}</span>
              {item.label}
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

        {/* ── Main Content ── */}
        <main className="main">
          <div className="content">
            {activeTab === "dashboard" && (
              <Dashboard
                income={income} expense={expense} balance={balance}
                budget={budget} budgetProgress={budgetProgress} budgetColor={budgetColor}
                pieData={pieData} trendData={trendData}
                months={months} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              />
            )}

            {activeTab === "add" && (
              <AddForm
                amount={amount} setAmount={setAmount}
                type={type} setType={setType}
                category={category} setCategory={setCategory}
                note={note} setNote={setNote}
                date={date} setDate={setDate}
                editId={editId}
                onSubmit={submitTransaction}
                onCancel={cancelEdit}
              />
            )}

            {activeTab === "history" && (
              <History
                filtered={filtered}
                search={search} setSearch={setSearch}
                filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                onEdit={editExpense} onDelete={deleteExpense} onExport={exportCSV}
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

        {/* ── Mobile Bottom Nav ── */}
        <nav className="bottom-nav">
          <div className="bnav-items">
            {NAV.map((item) =>
              item.id === "add" ? (
                <div key={item.id} className="bnav-item" onClick={() => setActiveTab("add")}>
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
