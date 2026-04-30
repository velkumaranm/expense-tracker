import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import LoginPage from "./components/LoginPage";
import { CSS } from "./styles/appStyles";
import {
  answerLocalFinanceQuestion,
  buildHeuristicReport,
  getAIBackendHealth,
  requestAIInsights,
  requestAIQuery,
} from "./lib/ai";
import {
  buildPie,
  fmtINR,
  getMonthRange,
  getStorageKey,
  monthLabel,
  safeJSON,
  sumByType,
  toLocalDateStr,
  toYYYYMM,
} from "./lib/utils";

const Dashboard = lazy(() => import("./components/Dashboard"));
const AddForm = lazy(() => import("./components/AddForm"));
const History = lazy(() => import("./components/History"));
const ImportPage = lazy(() => import("./components/ImportPage"));
const AIInsights = lazy(() => import("./components/AIInsights"));
const AnalyticsReports = lazy(() => import("./components/AnalyticsReports"));
const GoalsTargets = lazy(() => import("./components/GoalsTargets"));
const NetWorthTracker = lazy(() => import("./components/NetWorthTracker"));
const Settings = lazy(() => import("./components/Settings"));

const LIVE_MARKET_CATEGORIES = new Set([
  "Stocks — NSE/BSE",
  "Stocks — US",
  "Mutual Fund — Equity",
  "Mutual Fund — Debt",
  "Mutual Fund — Hybrid",
  "Index Fund / ETF",
]);

export default function App() {
  const emailActionSettings = {
    url: window.location.origin,
    handleCodeInApp: true,
  };
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
  const [holdings, setHoldings] = useState([]);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState([]);
  const [aiConfig, setAiConfig] = useState({
    provider: "openrouter",
    model: "openrouter/free",
    freeModel: "openrouter/free",
  });
  const [backendHealth, setBackendHealth] = useState({
    providers: { anthropic: false, openrouter: false, openai: false },
    marketProviders: { alphaVantage: false },
    proxyUrl: "http://127.0.0.1:8787",
  });
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [askLoading, setAskLoading] = useState(false);
  const [aiState, setAiState] = useState({
    loading: false,
    error: "",
    report: null,
    externalText: "",
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(new Date()));
  const toastTimerRef = useRef(null);
  const latestAlertsRef = useRef("");
  const profileReadyRef = useRef(false);
  const lastProfileSerializedRef = useRef("");

  useEffect(() => {
    document.body.classList.toggle("light", !darkMode);
    localStorage.setItem("finwise-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => auth.onAuthStateChanged(setUser), []);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => {
      const msg = e?.message?.replace("Firebase: ", "") || "OAuth sign-in failed";
      setToast({ msg, kind: "error" });
    });
  }, []);

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const finishEmailLinkSignIn = async () => {
      try {
        let email = window.localStorage.getItem("finwise-email-link");
        if (!email) {
          email = window.prompt("Enter the same email address you used for the sign-in link") || "";
        }
        if (!email) {
          throw new Error("Email link sign-in needs the same email address used when the link was requested.");
        }
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem("finwise-email-link");
        window.history.replaceState({}, document.title, window.location.pathname);
        setToast({ msg: "Magic link accepted. You are signed in.", kind: "success" });
      } catch (e) {
        const msg = e?.message?.replace("Firebase: ", "") || "Email link sign-in failed";
        setToast({ msg, kind: "error" });
      }
    };

    finishEmailLinkSignIn();
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "expenses"), (snap) =>
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => {
    getAIBackendHealth().then(setBackendHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const profileRef = doc(db, "users", uid, "meta", "appState");
    profileReadyRef.current = false;
    return onSnapshot(profileRef, async (snap) => {
      const localFallback = {
        goals: safeJSON(localStorage.getItem(getStorageKey(uid, "goals")), []),
        assets: safeJSON(localStorage.getItem(getStorageKey(uid, "assets")), []),
        liabilities: safeJSON(localStorage.getItem(getStorageKey(uid, "liabilities")), []),
        holdings: safeJSON(localStorage.getItem(getStorageKey(uid, "holdings")), []),
        portfolioSnapshots: safeJSON(localStorage.getItem(getStorageKey(uid, "portfolio-snapshots")), []),
        aiConfig: { provider: "openrouter", model: "openrouter/free", freeModel: "openrouter/free", ...safeJSON(localStorage.getItem(getStorageKey(uid, "ai-config")), {}) },
        budget: localStorage.getItem(getStorageKey(uid, "budget")) || "",
        notificationsEnabled: (() => {
          const savedNotif = localStorage.getItem(getStorageKey(uid, "notifications"));
          return savedNotif == null ? true : savedNotif === "true";
        })(),
      };

      const data = snap.exists()
        ? {
            ...localFallback,
            ...snap.data(),
            aiConfig: { ...localFallback.aiConfig, ...(snap.data()?.aiConfig || {}) },
          }
        : localFallback;

      setGoals(Array.isArray(data.goals) ? data.goals : []);
      setAssets(Array.isArray(data.assets) ? data.assets : []);
      setLiabilities(Array.isArray(data.liabilities) ? data.liabilities : []);
      setHoldings(Array.isArray(data.holdings) ? data.holdings : []);
      setPortfolioSnapshots(Array.isArray(data.portfolioSnapshots) ? data.portfolioSnapshots : []);
      setAiConfig(data.aiConfig || localFallback.aiConfig);
      setBudget(data.budget || "");
      setBudgetInput(data.budget || "");
      setNotificationsEnabled(data.notificationsEnabled !== false);

      lastProfileSerializedRef.current = JSON.stringify({
        goals: Array.isArray(data.goals) ? data.goals : [],
        assets: Array.isArray(data.assets) ? data.assets : [],
        liabilities: Array.isArray(data.liabilities) ? data.liabilities : [],
        holdings: Array.isArray(data.holdings) ? data.holdings : [],
        portfolioSnapshots: Array.isArray(data.portfolioSnapshots) ? data.portfolioSnapshots : [],
        aiConfig: data.aiConfig || localFallback.aiConfig,
        budget: data.budget || "",
        notificationsEnabled: data.notificationsEnabled !== false,
      });
      profileReadyRef.current = true;

      if (!snap.exists()) {
        await setDoc(profileRef, {
          goals: Array.isArray(data.goals) ? data.goals : [],
          assets: Array.isArray(data.assets) ? data.assets : [],
          liabilities: Array.isArray(data.liabilities) ? data.liabilities : [],
          holdings: Array.isArray(data.holdings) ? data.holdings : [],
          portfolioSnapshots: Array.isArray(data.portfolioSnapshots) ? data.portfolioSnapshots : [],
          aiConfig: data.aiConfig || localFallback.aiConfig,
          budget: data.budget || "",
          notificationsEnabled: data.notificationsEnabled !== false,
        });
      }
    });
  }, [user]);

  const profileState = useMemo(() => ({
    goals,
    assets,
    liabilities,
    holdings,
    portfolioSnapshots,
    aiConfig,
    budget,
    notificationsEnabled,
  }), [goals, assets, liabilities, holdings, portfolioSnapshots, aiConfig, budget, notificationsEnabled]);

  useEffect(() => {
    if (!user || !profileReadyRef.current) return;
    const nextSerialized = JSON.stringify(profileState);
    if (nextSerialized === lastProfileSerializedRef.current) return;
    lastProfileSerializedRef.current = nextSerialized;
    setDoc(doc(db, "users", user.uid, "meta", "appState"), profileState, { merge: true }).catch(() => {});
  }, [profileState, user]);

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
    localStorage.setItem(getStorageKey(user.uid, "holdings"), JSON.stringify(holdings));
  }, [holdings, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "portfolio-snapshots"), JSON.stringify(portfolioSnapshots));
  }, [portfolioSnapshots, user]);
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
  const handleSignup = async (e, p) => {
    const cred = await createUserWithEmailAndPassword(auth, e, p);
    if (cred.user && !cred.user.emailVerified) {
      await sendEmailVerification(cred.user, emailActionSettings);
    }
    return cred;
  };
  const signInWithProvider = async (provider) => {
    const useRedirect = window.matchMedia?.("(max-width: 768px)")?.matches;
    if (useRedirect) {
      await signInWithRedirect(auth, provider);
      return;
    }
    await signInWithPopup(auth, provider);
  };
  const handleGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithProvider(provider);
  };
  const logout = () => {
    signOut(auth);
    setActiveTab("dashboard");
  };
  const handleSendEmailLink = async (email) => {
    window.localStorage.setItem("finwise-email-link", email);
    await sendSignInLinkToEmail(auth, email, emailActionSettings);
  };
  const handleSendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error("You need to be signed in.");
    await sendEmailVerification(auth.currentUser, emailActionSettings);
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  };
  const handleSendPasswordReset = async () => {
    if (!auth.currentUser?.email) throw new Error("This account does not have an email address on file.");
    await sendPasswordResetEmail(auth, auth.currentUser.email);
  };
  const handleChangeEmail = async (nextEmail) => {
    if (!auth.currentUser) throw new Error("You need to be signed in.");
    await verifyBeforeUpdateEmail(auth.currentUser, nextEmail, emailActionSettings);
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

  const editExpense = (item) => {
    setAmount(String(item.amount));
    setType(item.type);
    setCategory(item.category);
    setNote(item.note || "");
    setDate(item.date);
    setRecurring(!!item.recurring);
    setRecurringFrequency(item.recurringFrequency || "monthly");
    setEditId(item.id);
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
  const allTimeMarketInvestment = expenses
    .filter((item) => item.type === "investment" && LIVE_MARKET_CATEGORIES.has(item.category))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const nonMarketInvestment = Math.max(0, allTimeInvestment - allTimeMarketInvestment);
  const liveHoldingsValue = holdings.reduce(
    (sum, item) =>
      sum +
      Number(
        item.currentValue ||
        item.investedValue ||
        (Number(item.units || 0) * Number(item.costPerUnit || 0))
      ),
    0
  );
  const portfolioInvestedValue = holdings.reduce(
    (sum, item) => sum + Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)),
    0
  );
  const portfolioGainLoss = liveHoldingsValue - portfolioInvestedValue;
  const trackedCash = allTimeIncome - allTimeExpense - allTimeInvestment - allTimeInsurance;
  const trackedInvestments = nonMarketInvestment + (holdings.length ? liveHoldingsValue : allTimeMarketInvestment);
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
      let externalText = "";
      if (backendHealth?.providers?.[aiConfig.provider]) {
        const response = await requestAIInsights({
          provider: aiConfig.provider,
          model: aiConfig.model,
          freeModel: aiConfig.freeModel,
          context: {
            selectedMonth,
            totals,
            topCategories,
            recurringOutflow,
            unusualTransactions,
            monthlySeries: monthlySeries.slice(-6),
            yoyComparison,
            netWorth,
            portfolio: {
              holdingsCount: holdings.length,
              currentValue: liveHoldingsValue,
              investedValue: portfolioInvestedValue,
              gainLoss: portfolioGainLoss,
            },
          },
        });
        externalText = response.text || "";
      }
      setAiState({ loading: false, error: "", externalText, report: heuristicReport });
      showToast("Insights refreshed.");
    } catch (e) {
      setAiState({ loading: false, error: e.message || "AI request failed", externalText: "", report: heuristicReport });
      showToast("AI request failed. Using local insights.", "warning");
    }
  };

  const askAIQuestion = async (question) => {
    const context = {
      selectedMonth,
      totals,
      topCategories,
      recurringOutflow,
      unusualTransactions,
      monthlySeries: monthlySeries.slice(-6),
      yoyComparison,
      netWorth,
      portfolio: {
        holdingsCount: holdings.length,
        currentValue: liveHoldingsValue,
        investedValue: portfolioInvestedValue,
        gainLoss: portfolioGainLoss,
      },
    };
    const userMsg = { id: crypto.randomUUID(), role: "user", text: question, mode: "question" };
    setAiChatMessages((prev) => [...prev, userMsg]);
    setAskLoading(true);
    try {
      let answer = "";
      let mode = "local";
      if (backendHealth?.providers?.[aiConfig.provider]) {
        const result = await requestAIQuery({
          provider: aiConfig.provider,
          model: aiConfig.model,
          freeModel: aiConfig.freeModel,
          context,
          question,
          history: aiChatMessages.slice(-6),
        });
        answer = result.text || "";
        mode = aiConfig.provider;
      } else {
        answer = answerLocalFinanceQuestion(question, context, heuristicReport);
      }
      setAiChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: answer, mode },
      ]);
    } catch (e) {
      const answer = answerLocalFinanceQuestion(question, context, heuristicReport);
      setAiChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: answer, mode: "local-fallback" },
      ]);
      showToast(e.message || "AI question failed. Using local answer.", "warning");
    } finally {
      setAskLoading(false);
    }
  };

  useEffect(() => {
    if (!aiState.report && expenses.length) {
      setAiState((s) => ({ ...s, report: heuristicReport }));
    }
  }, [aiState.report, expenses.length, heuristicReport]);

  const filtered = recs
    .filter((e) => (filterType === "all" ? true : e.type === filterType))
    .filter((e) => (recurringOnly ? !!e.recurring : true))
    .filter((e) => (!filterCategory ? true : e.category === filterCategory))
    .filter((e) => {
      if (!search) return true;
      const needle = search.toLowerCase();
      return e.category.toLowerCase().includes(needle) || (e.note || "").toLowerCase().includes(needle) || String(e.amount).includes(needle);
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
    const html = `<!doctype html><html><head><title>Finwise Financial Report</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:28px;margin:0 0 6px}h2{font-size:16px;margin:24px 0 8px}p,li{font-size:13px;line-height:1.6;color:#333}ul{padding-left:18px}.meta{color:#666;font-size:12px;margin-bottom:18px}</style></head><body><h1>Finwise Financial Report</h1><div class="meta">Generated on ${new Date().toLocaleString()}</div>${[
      { title: "Executive Summary", body: heuristicReport.summary },
      { title: "Top Savings Opportunities", body: heuristicReport.opportunities },
      { title: "Anomalies", body: heuristicReport.anomalies.length ? heuristicReport.anomalies : ["No unusual transactions flagged."] },
      { title: "Investment Guidance", body: heuristicReport.investmentIdeas },
      { title: "Action Plan", body: heuristicReport.tips },
    ].map((section) => `<h2>${section.title}</h2><ul>${section.body.map((x) => `<li>${x}</li>`).join("")}</ul>`).join("")}</body></html>`;
    const win = window.open("", "_blank", "width=1080,height=860");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    showToast("PDF report opened for print/export.");
  };

  if (!user) {
    return (
      <>
        <style>{CSS}</style>
        <LoginPage onLogin={handleLogin} onSignup={handleSignup} onGoogle={handleGoogle} onSendEmailLink={handleSendEmailLink} />
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
    { id: "more", icon: "⚙", label: "More", more: true },
  ];

  const MOBILE_MORE_ITEMS = [
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "wealth", icon: "⬢", label: "Net Worth" },
    { id: "import", icon: "⬆", label: "Import" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];

  const tabLoadingFallback = (
    <div className="section-card tab-loading-card">
      <h3>Loading View</h3>
      <p>Preparing the next workspace...</p>
    </div>
  );

  const renderActiveTab = () => {
    if (activeTab === "dashboard") {
      return (
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
          goals={goals}
          totalTransactions={expenses.length}
          assetCount={assets.length + holdings.length}
          liabilityCount={liabilities.length}
          onJumpToAdd={() => setActiveTab("add")}
          onJumpToImport={() => setActiveTab("import")}
          onJumpToGoals={() => setActiveTab("goals")}
          onJumpToNetWorth={() => setActiveTab("wealth")}
        />
      );
    }
    if (activeTab === "ai") {
      return (
        <AIInsights
          report={aiState.report}
          aiState={aiState}
          onGenerate={runAIInsights}
          aiConfig={aiConfig}
          backendHealth={backendHealth}
          topCategories={topCategories}
          unusualTransactions={unusualTransactions}
          totals={totals}
          chatMessages={aiChatMessages}
          onAskQuestion={askAIQuestion}
          onClearChat={() => setAiChatMessages([])}
          askLoading={askLoading}
        />
      );
    }
    if (activeTab === "analytics") {
      return (
        <AnalyticsReports
          monthlySeries={monthlySeries}
          yoyComparison={yoyComparison}
          categoryTrendSeries={categoryTrendSeries}
          heatmap={heatmap}
          onExportPdf={exportAnalyticsPdf}
          onExportCsv={exportCSV}
        />
      );
    }
    if (activeTab === "goals") return <GoalsTargets goals={goals} setGoals={setGoals} />;
    if (activeTab === "wealth") {
      return (
        <NetWorthTracker
          assets={assets}
          setAssets={setAssets}
          liabilities={liabilities}
          setLiabilities={setLiabilities}
          trackedCash={trackedCash}
          trackedInvestments={trackedInvestments}
          netWorth={netWorth}
          holdings={holdings}
          setHoldings={setHoldings}
          snapshots={portfolioSnapshots}
          setSnapshots={setPortfolioSnapshots}
          marketProviders={backendHealth.marketProviders}
          showToast={showToast}
        />
      );
    }
    if (activeTab === "add") {
      return (
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
      );
    }
    if (activeTab === "history") {
      return (
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
      );
    }
    if (activeTab === "import") return <ImportPage onImport={importSingleRecord} showToast={showToast} />;
    if (activeTab === "settings") {
      return (
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
          backendHealth={backendHealth}
          onSendVerificationEmail={handleSendVerificationEmail}
          onSendPasswordReset={handleSendPasswordReset}
          onChangeEmail={handleChangeEmail}
        />
      );
    }
    return null;
  };

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
            <Suspense fallback={tabLoadingFallback}>
              {renderActiveTab()}
            </Suspense>
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
                <div
                  key={item.id}
                  className={`bnav-item ${activeTab === item.id || (item.more && MOBILE_MORE_ITEMS.some((x) => x.id === activeTab)) ? "active" : ""}`}
                  onClick={() => item.more ? setMobileMenuOpen(true) : setActiveTab(item.id)}
                >
                  <span className="bnav-icon">{item.icon}</span>
                  {item.label}
                </div>
              )
            )}
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="mobile-more-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <h3>More</h3>
                  <p style={{ marginBottom: 0 }}>Quick access to the rest of your finance workspace.</p>
                </div>
                <button className="icon-btn" onClick={() => setMobileMenuOpen(false)}>Close</button>
              </div>
              <div className="mobile-more-grid">
                {MOBILE_MORE_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    className={`mobile-more-item ${activeTab === item.id ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="mobile-more-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
