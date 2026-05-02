export const CSS = `
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
.sidebar{width:240px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:22px 0;overflow-y:auto;overflow-x:hidden}
.sidebar-logo{padding:0 20px 18px;border-bottom:1px solid var(--border);margin-bottom:8px}
.wordmark{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--accent)}
.tagline{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.6px;margin-top:3px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:0 8px;border-radius:var(--rx);cursor:pointer;color:var(--text2);font-size:12.5px;font-weight:500;transition:all .18s;border:1px solid transparent}
.nav-item:hover{background:var(--card);color:var(--text)}
.nav-item.active{background:var(--accent-dim);color:var(--accent);border-color:rgba(200,169,110,.24)}
.nav-item .ni{width:18px;text-align:center}
.sidebar-spacer{flex:1}
.sidebar-footer{padding:14px 8px 0;border-top:1px solid var(--border);position:sticky;bottom:0;background:var(--surface)}
.user-row{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px}
.user-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--accent-dim);border:1px solid var(--accent);color:var(--accent);font-weight:700;flex-shrink:0}
.user-email{font-size:10.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logout-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 12px;background:none;border:1px solid var(--border);border-radius:var(--rx);color:var(--text2);font-size:11.5px;font-weight:500;cursor:pointer;transition:all .18s}
.logout-btn:hover{color:var(--expense);border-color:rgba(248,113,113,.4);background:var(--expense-dim)}
.main{flex:1;overflow-y:auto;background:var(--bg)}
.content{padding:28px 30px 90px;max-width:1180px;margin:0 auto;animation:fadeIn .28s ease}
.content > *{min-width:0}
.page-header{margin-bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.page-header h1{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700}
.page-header p{font-size:12px;color:var(--text3);margin-top:2px}
.month-strip,.filter-strip{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px}
.month-strip{margin-bottom:18px}
.month-chip,.filter-chip,.pill,.mini-btn{padding:6px 13px;border-radius:999px;font-size:11px;font-weight:500;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;white-space:nowrap;transition:all .16s}
.month-chip:hover,.filter-chip:hover,.pill:hover,.mini-btn:hover{border-color:var(--border-l);color:var(--text)}
.month-chip.active,.filter-chip.active,.pill.active{background:var(--accent-dim);border-color:rgba(200,169,110,.32);color:var(--accent)}
.summary-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;margin-bottom:14px;align-items:stretch}
.summary-card,.chart-card,.form-card,.settings-section,.section-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);min-width:0}
.summary-card{padding:16px 18px;transition:all .18s;display:flex;flex-direction:column;justify-content:flex-start;min-height:124px}
.summary-card:hover,.chart-card:hover,.section-card:hover{border-color:var(--border-l);transform:translateY(-1px)}
.summary-span-4{grid-column:span 4}.summary-span-3{grid-column:span 3}.summary-span-6{grid-column:span 6}.summary-span-12{grid-column:span 12}
.sc-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:7px}
.sc-value{font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:700;line-height:1.05}
.sc-sub{font-size:10.5px;color:var(--text3);margin-top:6px;line-height:1.45}
.budget-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:17px 18px;margin-bottom:16px;box-shadow:var(--shadow)}
.budget-header,.split-row,.tx-toolbar,.section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.budget-track,.progress-track{height:7px;background:var(--border);border-radius:999px;overflow:hidden}
.budget-fill,.progress-fill{height:100%;border-radius:999px}
.charts-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;margin-bottom:16px;align-items:stretch;grid-auto-flow:row dense}
.chart-span-7{grid-column:span 7}.chart-span-6{grid-column:span 6}.chart-span-5{grid-column:span 5}.chart-span-4{grid-column:span 4}.chart-span-12{grid-column:span 12}
.chart-card{padding:18px;display:flex;flex-direction:column;justify-content:flex-start;height:100%}
.chart-title{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:14px}
.pie-row{display:flex;align-items:center;gap:12px}
.pie-legend{display:flex;flex-direction:column;gap:7px;flex:1}
.pie-legend-item{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text2)}
.pie-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.pie-legend-val{margin-left:auto;font-weight:600;white-space:nowrap}
.two-col{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:12px;align-items:start}
.three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}
.insight-list{display:grid;gap:10px}
.insight-item,.alert-item,.net-item,.goal-card,.tx-item,.table-row{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 14px}
.insight-item strong,.alert-item strong,.goal-card strong{display:block;font-size:12.5px;color:var(--text);margin-bottom:4px}
.insight-item p,.alert-item p,.goal-card p,.muted{font-size:11.5px;color:var(--text3);line-height:1.55}
.alert-item.warn{border-color:rgba(248,113,113,.28)}.alert-item.info{border-color:rgba(200,169,110,.28)}.alert-item.good{border-color:rgba(52,211,153,.28)}
.prompt-card{cursor:pointer;transition:border-color .18s,transform .18s}
.prompt-card:hover{border-color:var(--border-l);transform:translateY(-1px)}
.onboarding-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:stretch}
.planner-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
.mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:stretch}
.mini-card{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px}
.mini-card .v{font-size:20px;font-family:'Cormorant Garamond',serif;font-weight:700}
.mini-card .k{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:5px}
.mini-stat{background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px 12px;display:grid;gap:4px}
.mini-stat span{font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:var(--text3)}
.mini-stat strong{font-size:12.5px;color:var(--text);margin:0}
.portfolio-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:16px;align-items:start}
.portfolio-panel{background:var(--card2);border:1px solid var(--border);border-radius:16px;padding:14px;min-width:0}
.portfolio-result{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 12px;color:var(--text);text-align:left;cursor:pointer;transition:border-color .18s,transform .18s}
.portfolio-result:hover{border-color:var(--border-l);transform:translateY(-1px)}
.portfolio-result strong{display:block;font-size:12.5px;color:var(--text);margin-bottom:3px}
.portfolio-result p{font-size:10.5px;color:var(--text3);line-height:1.45}
.portfolio-item{background:var(--card2);border:1px solid var(--border);border-radius:16px;padding:14px}
.portfolio-main{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.portfolio-figures{text-align:right}
.portfolio-number{font-size:22px;font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--text)}
.portfolio-subgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px;align-items:stretch}
.portfolio-actions{display:flex;align-items:stretch}
.portfolio-actions .tx-btn{width:100%}
.portfolio-snapshot-grid{display:grid;grid-template-columns:1fr;gap:10px}
.portfolio-snapshot-empty{display:flex;align-items:center;justify-content:center;min-height:100%;padding:14px;border:1px dashed var(--border);border-radius:14px;background:var(--surface)}
.timeline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.timeline-item{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:12px;align-items:start;padding:12px 0;border-bottom:1px solid var(--border)}
.timeline-item:last-child{border-bottom:none}
.timeline-date{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);padding-top:3px}
.timeline-body strong{display:block;font-size:12.5px;color:var(--text);margin-bottom:2px}
.vault-upload-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px}
.vault-upload-btn{position:relative;overflow:hidden}
.vault-file-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--card2)}
.form-card{padding:24px;display:flex;flex-direction:column}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
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
.stack > *{min-width:0}
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
.settings-section,.section-card{padding:20px;margin-bottom:12px;display:flex;flex-direction:column;justify-content:flex-start}
.settings-section h3,.section-card h3{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px}
.settings-section p{font-size:11.5px;color:var(--text3);line-height:1.55;margin-bottom:14px}
.tab-loading-card{min-height:220px;display:grid;align-content:center;justify-items:start}
.setting-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.account-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.status-pill{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid var(--border);font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.status-pill.verified{background:var(--income-dim);border-color:rgba(52,211,153,.28);color:var(--income)}
.status-pill.pending{background:var(--accent-dim);border-color:rgba(200,169,110,.26);color:var(--accent)}
.status-pill.neutral{background:var(--card2);color:var(--text2)}
.account-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
.account-card{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px;display:grid;gap:10px;height:100%}
.account-card strong{font-size:12.5px;color:var(--text)}
.account-card p{margin:0;font-size:11.5px;color:var(--text3);line-height:1.55}
.account-card-wide{grid-column:1/-1}
.passkey-list{display:grid;gap:10px;margin-top:14px}
.passkey-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.theme-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin:0 8px 6px;border-radius:var(--rx);border:1px solid var(--border);cursor:pointer}
.tt-track{width:34px;height:18px;border-radius:999px;background:var(--border-l);position:relative;transition:background .2s;flex-shrink:0}
.tt-track.on{background:var(--accent)}.tt-thumb{width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s}.tt-track.on .tt-thumb{left:18px}
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);z-index:200;padding-bottom:env(safe-area-inset-bottom,0)}
.bnav-items{display:flex;justify-content:space-around}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;color:var(--text3);font-size:8px;font-weight:600;text-transform:uppercase;cursor:pointer;flex:1}
.bnav-item.active{color:var(--accent)}.bnav-icon{font-size:16px}.bnav-fab{background:var(--accent);width:42px;height:42px;border-radius:50%;color:#fff;box-shadow:0 8px 22px rgba(200,169,110,.35);margin-top:-11px;cursor:pointer}
.mobile-more-overlay{display:none}
.mobile-account-card{display:none}
.toast{position:fixed;top:20px;right:20px;background:var(--card2);border:1px solid var(--border);border-radius:var(--rx);padding:10px 16px;font-size:12.5px;z-index:9999;animation:toastIn .28s ease;box-shadow:0 10px 40px rgba(0,0,0,.4);max-width:360px}
.toast.success{border-color:rgba(52,211,153,.4);color:var(--income)}.toast.error{border-color:rgba(248,113,113,.4);color:var(--expense)}.toast.warning{border-color:rgba(200,169,110,.4);color:var(--accent)}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px;position:relative;overflow:auto}
.login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(200,169,110,.08) 0%,transparent 70%)}
.login-card{width:100%;max-width:460px;max-height:calc(100vh - 40px);overflow:auto;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px;animation:slideUp .4s ease;position:relative;z-index:1;box-shadow:var(--shadow)}
.login-logo{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:var(--accent);text-align:center;margin-bottom:3px}
.login-tagline{font-size:11.5px;color:var(--text3);text-align:center;margin-bottom:22px}
.login-quick-panel{display:grid;gap:12px;background:var(--card2);border:1px solid var(--border);border-radius:18px;padding:16px;margin-bottom:16px}
.login-quick-copy strong{display:block;font-size:13px;color:var(--text);margin-bottom:4px}
.login-quick-copy p{font-size:11.5px;color:var(--text3);line-height:1.55}
.login-quick-actions{display:grid;grid-template-columns:1fr;gap:10px}
.login-quick-btn{margin-top:0!important}
.login-passkey-note{font-size:11px;color:var(--text3);line-height:1.55}
.tab2{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:3px;margin-bottom:16px}
.tab2-btn{padding:8px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text3);background:none}
.tab2-btn.active{background:var(--card);color:var(--text)}
.auth-error,.auth-ok{border-radius:var(--rx);padding:9px 13px;font-size:11.5px;margin-bottom:13px}
.auth-error{background:var(--expense-dim);border:1px solid rgba(248,113,113,.3);color:var(--expense)}
.auth-ok{background:var(--income-dim);border:1px solid rgba(52,211,153,.3);color:var(--income)}
.magic-header{margin-bottom:12px}
.magic-header strong{display:block;font-size:13px;color:var(--text);margin-bottom:4px}
.magic-header p{font-size:11.5px;color:var(--text3);line-height:1.55}
.magic-link-badge{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);background:var(--accent-dim);border:1px solid rgba(200,169,110,.24);border-radius:999px;padding:6px 10px;margin-bottom:10px}
.magic-checklist{display:grid;gap:8px;margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card2);border:1px solid var(--border)}
.magic-check-item{display:flex;align-items:flex-start;gap:9px;font-size:11.5px;color:var(--text2);line-height:1.55}
.magic-check-item strong{color:var(--text);word-break:break-word}
.magic-check-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);margin-top:6px;flex-shrink:0}
.google-btn{width:100%;padding:11px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer;margin-top:9px}
.divider{display:flex;align-items:center;gap:9px;margin:12px 0;color:var(--text3);font-size:10.5px}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}
.forgot-link,.resend-link{font-size:11px;color:var(--accent);cursor:pointer;display:block}
.forgot-link{text-align:right;margin-top:-4px;margin-bottom:10px}
.goal-card-premium{display:grid;gap:10px}
.goal-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.goal-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch}
.otp-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--rx);padding:14px;color:var(--text);font-size:22px;font-weight:700;text-align:center;letter-spacing:6px;margin-bottom:14px}
.phone-row{display:flex;margin-bottom:14px}.phone-pre{background:var(--surface);border:1px solid var(--border);border-right:none;border-radius:var(--rx) 0 0 var(--rx);padding:10px 12px;color:var(--text2);display:flex;align-items:center}.phone-inp{flex:1;background:var(--surface);border:1px solid var(--border);border-left:none;border-radius:0 var(--rx) var(--rx) 0;padding:10px 12px;color:var(--text);outline:none}
.heat-grid{display:grid;gap:7px}.heat-row{display:grid;grid-template-columns:140px repeat(6,minmax(0,1fr));gap:7px;align-items:center}.heat-cell{min-height:32px;border-radius:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text2);padding:4px 6px;text-align:center}
.stat-line{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--text2);padding:8px 0;border-bottom:1px solid var(--border)}
.stat-line:last-child{border-bottom:none}
.ai-layout{display:grid;gap:14px}
.ai-main-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:12px;align-items:start}
.ai-main-col{display:grid;gap:12px;align-content:start;min-width:0}
.ai-chat-shell{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:12px;align-items:start}
.ai-chat-card{padding:0;overflow:hidden}
.ai-chat-head{padding:15px 18px 10px;border-bottom:1px solid var(--border)}
.ai-chat-sub{margin-top:4px;font-size:11px;color:var(--text3);line-height:1.45;max-width:62ch}
.prompt-strip{display:flex;gap:8px;overflow-x:auto;padding-top:10px}
.prompt-chip{padding:7px 11px;border-radius:999px;border:1px solid var(--border);background:var(--card2);color:var(--text2);font-size:11px;white-space:nowrap;cursor:pointer;transition:all .16s}
.prompt-chip:hover{border-color:var(--border-l);color:var(--text)}
.ai-chat-body{padding:14px 18px;display:grid;gap:10px;height:420px;overflow-y:auto;background:linear-gradient(180deg,rgba(200,169,110,.03),transparent 18%)}
.ai-chat-compose{padding:14px 18px 18px;border-top:1px solid var(--border);display:grid;gap:10px;background:var(--card)}
.ai-chat-empty{padding:24px;border:1px dashed var(--border);border-radius:14px;color:var(--text3);font-size:12px;background:var(--card2)}
.ai-message{max-width:min(88%,720px);display:grid;gap:6px}
.ai-message.user{justify-self:end}
.ai-message.assistant{justify-self:start}
.ai-message-meta{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.7px}
.ai-message.user .ai-message-meta{justify-content:flex-end}
.ai-bubble{padding:12px 14px;border-radius:16px;line-height:1.65;font-size:12.5px;white-space:pre-wrap;word-break:break-word;border:1px solid var(--border);background:var(--card2);color:var(--text)}
.ai-message.user .ai-bubble{background:var(--accent-dim);border-color:rgba(200,169,110,.28)}
.insight-list.compact{gap:8px}
.insight-item.compact{padding:12px 14px}
.insight-item.compact p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ai-message.assistant .ai-bubble{background:var(--card2)}
.ai-ask-card{display:grid;gap:8px}
.ai-ask-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.ai-side-stack{display:grid;gap:12px}
.ai-insights-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ai-takeaways-card{grid-column:1/-1}
.takeaway-stack{display:grid;gap:12px;max-height:420px;overflow-y:auto;padding-right:6px}
.takeaway-row{padding:0 0 12px;border-bottom:1px solid var(--border)}
.takeaway-row:last-child{padding-bottom:0;border-bottom:none}
.takeaway-row strong{display:block;margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);text-align:left}
.takeaway-inline-list{margin:0;padding-left:0;list-style:none;display:grid;gap:8px}
.takeaway-inline-list li{color:var(--text);font-size:12.5px;line-height:1.7;text-align:left}
@media(max-width:1380px){
  .chart-span-4{grid-column:span 6}
}
@media(max-width:1180px){
  .sidebar{width:220px}
  .content{padding:24px 22px 90px}
}
@media(max-width:900px){
  .summary-span-4,.summary-span-3,.summary-span-6,.chart-span-7,.chart-span-6,.chart-span-5,.chart-span-4{grid-column:span 12}
  .two-col,.three-col,.mini-grid,.heat-row,.ai-main-grid,.ai-chat-shell,.ai-insights-grid,.account-grid,.goal-metrics,.onboarding-grid,.planner-grid,.portfolio-grid,.portfolio-subgrid,.timeline-grid{grid-template-columns:1fr}
}
@media(max-width:768px){
  .sidebar{display:none}.bottom-nav{display:block}.content{padding:16px 14px 92px}
  .summary-grid,.charts-grid,.form-grid{grid-template-columns:1fr}
  .summary-span-4,.summary-span-3,.summary-span-6,.summary-span-12,.chart-span-7,.chart-span-6,.chart-span-5,.chart-span-4,.chart-span-12{grid-column:span 1}
  .type-toggle{grid-template-columns:1fr 1fr}.pie-row{flex-direction:column}
  .tx-actions{opacity:1}.toast{top:auto;bottom:84px;right:12px;left:12px}
  .ai-chat-body{height:360px;padding:14px}
  .ai-chat-head{padding:16px 14px 10px}
  .ai-message{max-width:100%}
  .login-page{padding:16px}
  .login-card{padding:22px 18px 18px;border-radius:18px;max-width:100%}
  .login-logo{font-size:26px}
  .login-tagline{margin-bottom:18px}
  .login-quick-panel{padding:14px}
  .passkey-row{flex-direction:column;align-items:stretch}
  .timeline-item{grid-template-columns:1fr}
  .mobile-more-overlay{display:flex;position:fixed;inset:0;background:rgba(9,9,11,.42);backdrop-filter:blur(8px);z-index:300;align-items:flex-end}
  .mobile-more-sheet{width:100%;background:var(--card);border-top-left-radius:20px;border-top-right-radius:20px;border:1px solid var(--border);border-bottom:none;padding:18px 14px calc(20px + env(safe-area-inset-bottom,0));box-shadow:0 -12px 40px rgba(0,0,0,.18)}
  .mobile-more-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mobile-more-item{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:grid;justify-items:start;gap:6px;color:var(--text);font-size:12px;font-weight:600}
  .mobile-more-item.active{border-color:rgba(200,169,110,.34);background:var(--accent-dim);color:var(--accent)}
  .mobile-more-icon{font-size:18px}
  .mobile-account-card{display:grid;gap:10px;background:var(--card2);border:1px solid var(--border);border-radius:16px;padding:14px;margin-top:12px}
  .mobile-account-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
}
`;
