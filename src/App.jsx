import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "./firebase";
import {
  browserLocalPersistence,
  browserSessionPersistence,
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
  setPersistence,
  verifyBeforeUpdateEmail,
  getIdTokenResult,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
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
  convertAmount,
  annualizedRecurringAmount,
  fmtINR,
  getMonthRange,
  goalId,
  getStorageKey,
  monthLabel,
  nextRecurringDate,
  safeJSON,
  sumByType,
  toLocalDateStr,
  toYYYYMM,
} from "./lib/utils";
import { fetchMarketFx } from "./lib/market";
import { I18nProvider, getTranslation } from "./lib/i18n";
import { ALL_CATS } from "./lib/constants";
import {
  authenticateWithLocalPasskey,
  createLocalPasskey,
  getStoredPasskeys,
  isPasskeySupported,
  removeLocalPasskey,
} from "./lib/passkey";

const Dashboard = lazy(() => import("./components/Dashboard"));
const AddForm = lazy(() => import("./components/AddForm"));
const History = lazy(() => import("./components/History"));
const ImportPage = lazy(() => import("./components/ImportPage"));
const AIInsights = lazy(() => import("./components/AIInsights"));
const AnalyticsReports = lazy(() => import("./components/AnalyticsReports"));
const GoalsTargets = lazy(() => import("./components/GoalsTargets"));
const NetWorthTracker = lazy(() => import("./components/NetWorthTracker"));
const Settings = lazy(() => import("./components/Settings"));
const DocumentsVault = lazy(() => import("./components/DocumentsVault"));
const TimelineView = lazy(() => import("./components/TimelineView"));

const LIVE_MARKET_CATEGORIES = new Set([
  "Stocks — NSE/BSE",
  "Stocks — US",
  "Mutual Fund — Equity",
  "Mutual Fund — Debt",
  "Mutual Fund — Hybrid",
  "Index Fund / ETF",
]);

const DEFAULT_PLANNER_STATE = {
  emergencyFundMonths: 6,
  currentEmergencyFund: "",
  monthlyHouseholdExpense: "",
  currentAge: 30,
  retirementAge: 58,
  currentRetirementCorpus: "",
  monthlyRetirementContribution: "",
  expectedReturn: 10,
  inflationRate: 6,
  loanPrincipal: "",
  loanRate: "",
  loanRemainingMonths: "",
  emiAmount: "",
  annualIncome: "",
  currentInvestableAssets: "",
  monthlyGoalContribution: "",
  fireMultiple: 25,
  dependents: "",
  currentInsuranceCover: "",
  totalLiabilities: "",
  coverMultiplier: 12,
  primaryAllocationMode: "balanced",
};

const DEFAULT_ONBOARDING_STATE = {
  profileType: "salary",
  householdMode: "personal",
  primaryFocus: "wealth",
  wizardStep: 0,
  demoSeeded: false,
};

function portfolioHoldingsSignature(items = []) {
  return JSON.stringify(
    [...items]
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        symbol: item.symbol || "",
        schemeCode: item.schemeCode || "",
        quoteSymbol: item.quoteSymbol || "",
        units: Number(item.units || 0),
        costPerUnit: Number(item.costPerUnit || 0),
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  );
}

function sanitizePortfolioSnapshots(holdings = [], snapshots = []) {
  const currentSignature = portfolioHoldingsSignature(holdings);
  return (Array.isArray(snapshots) ? snapshots : [])
    .filter((item) => item && item.signature && item.signature === currentSignature)
    .slice(0, 30);
}

function readHoldingBackup(uid) {
  if (!uid) return { holdings: [], portfolioSnapshots: [] };
  return {
    holdings: safeJSON(localStorage.getItem(getStorageKey(uid, "holdings-backup")), []),
    portfolioSnapshots: safeJSON(localStorage.getItem(getStorageKey(uid, "portfolio-snapshots-backup")), []),
  };
}

function sortRecordsById(items = []) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) =>
    String(a?.id || "").localeCompare(String(b?.id || ""))
  );
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined));
}

function normalizeHoldingRecord(item = {}) {
  return cleanObject({
    ...item,
    id: String(item.id || goalId()),
    attachments: undefined,
  });
}

function normalizeVaultDocRecord(item = {}) {
  return cleanObject({
    ...item,
    id: String(item.id || goalId()),
    attachments: Array.isArray(item.attachments)
      ? item.attachments.map((file) => cleanObject(file))
      : [],
  });
}

function normalizeCollectionRecord(item = {}) {
  return cleanObject({
    ...item,
    id: String(item.id || goalId()),
  });
}

function normalizeSnapshotRecord(item = {}) {
  return cleanObject({
    ...item,
    id: String(item.id || item.date || goalId()),
  });
}

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
  const [marketDisplayCurrency, setMarketDisplayCurrency] = useState("INR");
  const [marketFx, setMarketFx] = useState({ usdInr: 83, source: "fallback", asOf: "" });
  const [language, setLanguage] = useState("en");
  const [onboardingState, setOnboardingState] = useState(DEFAULT_ONBOARDING_STATE);
  const [plannerState, setPlannerState] = useState(DEFAULT_PLANNER_STATE);
  const [vaultDocs, setVaultDocs] = useState([]);
  const [aiConfig, setAiConfig] = useState({
    provider: "openrouter",
    model: "openrouter/free",
    freeModel: "openrouter/free",
  });
  const [backendHealth, setBackendHealth] = useState({
    aiEnabled: false,
    marketEnabled: false,
    providers: { anthropic: false, openrouter: false, openai: false },
    marketProviders: { alphaVantage: false, twelveData: false, finnhub: false },
    proxyUrl: "http://127.0.0.1:8787",
  });
  const [userRole, setUserRole] = useState("user");
  const isAdmin = userRole === "admin";
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [askLoading, setAskLoading] = useState(false);
  const [aiState, setAiState] = useState({
    loading: false,
    error: "",
    report: null,
    externalText: "",
    language,
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [lastUndo, setLastUndo] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(new Date()));
  const [passkeyProfiles, setPasskeyProfiles] = useState(() => getStoredPasskeys());
  const [passkeySupported] = useState(() => isPasskeySupported());
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(() =>
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  );
  const t = (key, fallback = "") => getTranslation(language, key, fallback);
  const toastTimerRef = useRef(null);
  const latestAlertsRef = useRef("");
  const profileReadyRef = useRef(false);
  const lastProfileSerializedRef = useRef("");
  const goalsReadyRef = useRef(false);
  const lastGoalsSerializedRef = useRef("");
  const cloudGoalIdsRef = useRef(new Set());
  const legacyGoalsRef = useRef([]);
  const assetsReadyRef = useRef(false);
  const lastAssetsSerializedRef = useRef("");
  const cloudAssetIdsRef = useRef(new Set());
  const legacyAssetsRef = useRef([]);
  const liabilitiesReadyRef = useRef(false);
  const lastLiabilitiesSerializedRef = useRef("");
  const cloudLiabilityIdsRef = useRef(new Set());
  const legacyLiabilitiesRef = useRef([]);
  const snapshotsReadyRef = useRef(false);
  const lastSnapshotsSerializedRef = useRef("");
  const cloudSnapshotIdsRef = useRef(new Set());
  const legacySnapshotsRef = useRef([]);
  const holdingsStateRef = useRef([]);
  const holdingsReadyRef = useRef(false);
  const lastHoldingsSerializedRef = useRef("");
  const cloudHoldingIdsRef = useRef(new Set());
  const legacyHoldingsRef = useRef([]);
  const vaultDocsReadyRef = useRef(false);
  const lastVaultDocsSerializedRef = useRef("");
  const cloudVaultDocIdsRef = useRef(new Set());
  const legacyVaultDocsRef = useRef([]);

  useEffect(() => {
    document.body.classList.toggle("light", !darkMode);
    localStorage.setItem("finwise-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    holdingsStateRef.current = holdings;
  }, [holdings]);

  useEffect(() => auth.onAuthStateChanged(setUser), []);

  useEffect(() => {
    const media = window.matchMedia?.("(display-mode: standalone)");
    const syncInstalled = () => {
      setPwaInstalled(media?.matches || window.navigator.standalone === true);
    };
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    const onInstalled = () => {
      setInstallPromptEvent(null);
      syncInstalled();
      setToast({ msg: "Finwise is ready on this device.", kind: "success" });
    };
    syncInstalled();
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media?.addEventListener?.("change", syncInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener?.("change", syncInstalled);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const syncRole = async () => {
      if (!user) {
        if (!disposed) setUserRole("user");
        return;
      }
      try {
        const tokenResult = await getIdTokenResult(user, true);
        const nextRole =
          tokenResult?.claims?.role === "admin" || tokenResult?.claims?.admin === true
            ? "admin"
            : "user";
        if (!disposed) setUserRole(nextRole);
      } catch {
        if (!disposed) setUserRole("user");
      }
    };
    syncRole();
    return () => {
      disposed = true;
    };
  }, [user]);

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
    if (!user) {
      goalsReadyRef.current = false;
      cloudGoalIdsRef.current = new Set();
      setGoals([]);
      return;
    }
    const uid = user.uid;
    goalsReadyRef.current = false;
    return onSnapshot(collection(db, "users", uid, "goals"), async (snap) => {
      const cloudItems = sortRecordsById(
        snap.docs.map((item) => normalizeCollectionRecord({ id: item.id, ...item.data() }))
      );
      cloudGoalIdsRef.current = new Set(cloudItems.map((item) => item.id));

      let nextItems = cloudItems;
      if (!cloudItems.length) {
        const localFallback = safeJSON(localStorage.getItem(getStorageKey(uid, "goals")), []);
        const strongestLocal = Array.isArray(localFallback) && localFallback.length
          ? localFallback
          : Array.isArray(legacyGoalsRef.current) && legacyGoalsRef.current.length
            ? legacyGoalsRef.current
            : [];
        if (strongestLocal.length) {
          nextItems = sortRecordsById(strongestLocal.map(normalizeCollectionRecord));
          const batch = writeBatch(db);
          nextItems.forEach((item) => {
            const { id, ...payload } = item;
            batch.set(doc(db, "users", uid, "goals", id), payload, { merge: true });
          });
          await batch.commit();
          cloudGoalIdsRef.current = new Set(nextItems.map((item) => item.id));
        }
      }

      lastGoalsSerializedRef.current = JSON.stringify(nextItems);
      goalsReadyRef.current = true;
      setGoals(nextItems);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      assetsReadyRef.current = false;
      cloudAssetIdsRef.current = new Set();
      setAssets([]);
      return;
    }
    const uid = user.uid;
    assetsReadyRef.current = false;
    return onSnapshot(collection(db, "users", uid, "assets"), async (snap) => {
      const cloudItems = sortRecordsById(
        snap.docs.map((item) => normalizeCollectionRecord({ id: item.id, ...item.data() }))
      );
      cloudAssetIdsRef.current = new Set(cloudItems.map((item) => item.id));

      let nextItems = cloudItems;
      if (!cloudItems.length) {
        const localFallback = safeJSON(localStorage.getItem(getStorageKey(uid, "assets")), []);
        const strongestLocal = Array.isArray(localFallback) && localFallback.length
          ? localFallback
          : Array.isArray(legacyAssetsRef.current) && legacyAssetsRef.current.length
            ? legacyAssetsRef.current
            : [];
        if (strongestLocal.length) {
          nextItems = sortRecordsById(strongestLocal.map(normalizeCollectionRecord));
          const batch = writeBatch(db);
          nextItems.forEach((item) => {
            const { id, ...payload } = item;
            batch.set(doc(db, "users", uid, "assets", id), payload, { merge: true });
          });
          await batch.commit();
          cloudAssetIdsRef.current = new Set(nextItems.map((item) => item.id));
        }
      }

      lastAssetsSerializedRef.current = JSON.stringify(nextItems);
      assetsReadyRef.current = true;
      setAssets(nextItems);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      liabilitiesReadyRef.current = false;
      cloudLiabilityIdsRef.current = new Set();
      setLiabilities([]);
      return;
    }
    const uid = user.uid;
    liabilitiesReadyRef.current = false;
    return onSnapshot(collection(db, "users", uid, "liabilities"), async (snap) => {
      const cloudItems = sortRecordsById(
        snap.docs.map((item) => normalizeCollectionRecord({ id: item.id, ...item.data() }))
      );
      cloudLiabilityIdsRef.current = new Set(cloudItems.map((item) => item.id));

      let nextItems = cloudItems;
      if (!cloudItems.length) {
        const localFallback = safeJSON(localStorage.getItem(getStorageKey(uid, "liabilities")), []);
        const strongestLocal = Array.isArray(localFallback) && localFallback.length
          ? localFallback
          : Array.isArray(legacyLiabilitiesRef.current) && legacyLiabilitiesRef.current.length
            ? legacyLiabilitiesRef.current
            : [];
        if (strongestLocal.length) {
          nextItems = sortRecordsById(strongestLocal.map(normalizeCollectionRecord));
          const batch = writeBatch(db);
          nextItems.forEach((item) => {
            const { id, ...payload } = item;
            batch.set(doc(db, "users", uid, "liabilities", id), payload, { merge: true });
          });
          await batch.commit();
          cloudLiabilityIdsRef.current = new Set(nextItems.map((item) => item.id));
        }
      }

      lastLiabilitiesSerializedRef.current = JSON.stringify(nextItems);
      liabilitiesReadyRef.current = true;
      setLiabilities(nextItems);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      snapshotsReadyRef.current = false;
      cloudSnapshotIdsRef.current = new Set();
      setPortfolioSnapshots([]);
      return;
    }
    const uid = user.uid;
    snapshotsReadyRef.current = false;
    return onSnapshot(collection(db, "users", uid, "portfolioSnapshots"), async (snap) => {
      const cloudItems = sortRecordsById(
        snap.docs.map((item) => normalizeSnapshotRecord({ id: item.id, ...item.data() }))
      );
      cloudSnapshotIdsRef.current = new Set(cloudItems.map((item) => item.id));

      let nextItems = cloudItems;
      if (!cloudItems.length) {
        const localFallback = safeJSON(localStorage.getItem(getStorageKey(uid, "portfolio-snapshots")), []);
        const localBackup = readHoldingBackup(uid).portfolioSnapshots;
        const strongestLocal = Array.isArray(localFallback) && localFallback.length
          ? localFallback
          : Array.isArray(localBackup) && localBackup.length
            ? localBackup
            : Array.isArray(legacySnapshotsRef.current) && legacySnapshotsRef.current.length
              ? legacySnapshotsRef.current
              : [];
        if (strongestLocal.length) {
          nextItems = sortRecordsById(
            sanitizePortfolioSnapshots(holdingsStateRef.current, strongestLocal).map(normalizeSnapshotRecord)
          );
          const batch = writeBatch(db);
          nextItems.forEach((item) => {
            const { id, ...payload } = item;
            batch.set(doc(db, "users", uid, "portfolioSnapshots", id), payload, { merge: true });
          });
          await batch.commit();
          cloudSnapshotIdsRef.current = new Set(nextItems.map((item) => item.id));
        }
      }

      const safeSnapshots = sortRecordsById(
        sanitizePortfolioSnapshots(holdingsStateRef.current, nextItems).map(normalizeSnapshotRecord)
      );
      lastSnapshotsSerializedRef.current = JSON.stringify(safeSnapshots);
      snapshotsReadyRef.current = true;
      setPortfolioSnapshots(safeSnapshots);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      holdingsReadyRef.current = false;
      cloudHoldingIdsRef.current = new Set();
      setHoldings([]);
      return;
    }
    const uid = user.uid;
    holdingsReadyRef.current = false;
    return onSnapshot(collection(db, "users", uid, "holdings"), async (snap) => {
      const cloudItems = sortRecordsById(
        snap.docs.map((item) => normalizeHoldingRecord({ id: item.id, ...item.data() }))
      );
      cloudHoldingIdsRef.current = new Set(cloudItems.map((item) => item.id));

      let nextItems = cloudItems;
      if (!cloudItems.length) {
        const localFallback = safeJSON(localStorage.getItem(getStorageKey(uid, "holdings")), []);
        const localBackup = readHoldingBackup(uid).holdings;
        const strongestLocal = Array.isArray(localFallback) && localFallback.length
          ? localFallback
          : Array.isArray(localBackup) && localBackup.length
            ? localBackup
            : Array.isArray(legacyHoldingsRef.current) && legacyHoldingsRef.current.length
              ? legacyHoldingsRef.current
              : [];
        if (strongestLocal.length) {
          nextItems = sortRecordsById(strongestLocal.map(normalizeHoldingRecord));
          const batch = writeBatch(db);
          nextItems.forEach((item) => {
            const { id, ...payload } = item;
            batch.set(doc(db, "users", uid, "holdings", id), payload, { merge: true });
          });
          await batch.commit();
          cloudHoldingIdsRef.current = new Set(nextItems.map((item) => item.id));
        }
      }

      lastHoldingsSerializedRef.current = JSON.stringify(nextItems);
      holdingsReadyRef.current = true;
      setHoldings(nextItems);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      vaultDocsReadyRef.current = false;
      cloudVaultDocIdsRef.current = new Set();
      setVaultDocs([]);
      return;
    }
    const uid = user.uid;
    vaultDocsReadyRef.current = false;
    return onSnapshot(collection(db, "users", uid, "vaultDocs"), async (snap) => {
      const cloudItems = sortRecordsById(
        snap.docs.map((item) => normalizeVaultDocRecord({ id: item.id, ...item.data() }))
      );
      cloudVaultDocIdsRef.current = new Set(cloudItems.map((item) => item.id));

      let nextItems = cloudItems;
      if (!cloudItems.length) {
        const localFallback = safeJSON(localStorage.getItem(getStorageKey(uid, "vault-docs")), []);
        const strongestLocal = Array.isArray(localFallback) && localFallback.length
          ? localFallback
          : Array.isArray(legacyVaultDocsRef.current) && legacyVaultDocsRef.current.length
            ? legacyVaultDocsRef.current
            : [];
        if (strongestLocal.length) {
          nextItems = sortRecordsById(strongestLocal.map(normalizeVaultDocRecord));
          const batch = writeBatch(db);
          nextItems.forEach((item) => {
            const { id, ...payload } = item;
            batch.set(doc(db, "users", uid, "vaultDocs", id), payload, { merge: true });
          });
          await batch.commit();
          cloudVaultDocIdsRef.current = new Set(nextItems.map((item) => item.id));
        }
      }

      lastVaultDocsSerializedRef.current = JSON.stringify(nextItems);
      vaultDocsReadyRef.current = true;
      setVaultDocs(nextItems);
    });
  }, [user]);

  useEffect(() => {
    let disposed = false;
    let timer = null;

    const loadHealth = async () => {
      try {
        const token = user ? await user.getIdToken() : "";
        const next = await getAIBackendHealth(token);
        if (!disposed) {
          setBackendHealth(next);
          if (user) setUserRole(next?.viewerRole === "admin" ? "admin" : "user");
        }
      } catch {
        if (!disposed) {
          timer = window.setTimeout(loadHealth, 5000);
        }
      }
    };

    loadHealth();
    const onFocus = () => loadHealth();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user]);

  useEffect(() => {
    let disposed = false;
    const loadFx = async () => {
      try {
        const data = await fetchMarketFx();
        if (!disposed) {
          setMarketFx({
            usdInr: Number(data?.rate || 83),
            source: data?.source || "fallback",
            asOf: data?.asOf || "",
          });
        }
      } catch {}
    };
    loadFx();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const profileRef = doc(db, "users", uid, "meta", "appState");
    profileReadyRef.current = false;
    return onSnapshot(profileRef, async (snap) => {
      const localFallback = {
        marketDisplayCurrency: localStorage.getItem(getStorageKey(uid, "market-display-currency")) || "INR",
        language: localStorage.getItem(getStorageKey(uid, "language")) || "en",
        onboardingState: { ...DEFAULT_ONBOARDING_STATE, ...safeJSON(localStorage.getItem(getStorageKey(uid, "onboarding")), {}) },
        plannerState: { ...DEFAULT_PLANNER_STATE, ...safeJSON(localStorage.getItem(getStorageKey(uid, "planner-state")), {}) },
        aiConfig: { provider: "openrouter", model: "openrouter/free", freeModel: "openrouter/free", ...safeJSON(localStorage.getItem(getStorageKey(uid, "ai-config")), {}) },
        budget: localStorage.getItem(getStorageKey(uid, "budget")) || "",
        role: localStorage.getItem(getStorageKey(uid, "role")) || "user",
        notificationsEnabled: (() => {
          const savedNotif = localStorage.getItem(getStorageKey(uid, "notifications"));
          return savedNotif == null ? true : savedNotif === "true";
        })(),
      };

      const cloudData = snap.exists() ? snap.data() || {} : {};
      legacyGoalsRef.current = Array.isArray(cloudData.goals) ? cloudData.goals : [];
      legacyAssetsRef.current = Array.isArray(cloudData.assets) ? cloudData.assets : [];
      legacyLiabilitiesRef.current = Array.isArray(cloudData.liabilities) ? cloudData.liabilities : [];
      legacySnapshotsRef.current = Array.isArray(cloudData.portfolioSnapshots) ? cloudData.portfolioSnapshots : [];
      legacyHoldingsRef.current = Array.isArray(cloudData.holdings) ? cloudData.holdings : [];
      legacyVaultDocsRef.current = Array.isArray(cloudData.vaultDocs) ? cloudData.vaultDocs : [];

      const data = snap.exists()
        ? {
          ...localFallback,
          ...cloudData,
          aiConfig: { ...localFallback.aiConfig, ...(cloudData.aiConfig || {}) },
        }
        : localFallback;
      setMarketDisplayCurrency(data.marketDisplayCurrency || "INR");
      setLanguage(data.language || "en");
      setOnboardingState({ ...DEFAULT_ONBOARDING_STATE, ...(data.onboardingState || {}) });
      setPlannerState({ ...DEFAULT_PLANNER_STATE, ...(data.plannerState || {}) });
      setAiConfig(data.aiConfig || localFallback.aiConfig);
      setBudget(data.budget || "");
      setBudgetInput(data.budget || "");
      setNotificationsEnabled(data.notificationsEnabled !== false);
      setUserRole((current) => (current === "admin" ? "admin" : "user"));

      lastProfileSerializedRef.current = JSON.stringify({
        marketDisplayCurrency: data.marketDisplayCurrency || "INR",
        language: data.language || "en",
        onboardingState: { ...DEFAULT_ONBOARDING_STATE, ...(data.onboardingState || {}) },
        plannerState: { ...DEFAULT_PLANNER_STATE, ...(data.plannerState || {}) },
        aiConfig: data.aiConfig || localFallback.aiConfig,
        budget: data.budget || "",
        role: data.role || "user",
        notificationsEnabled: data.notificationsEnabled !== false,
      });
      profileReadyRef.current = true;

      if (!snap.exists()) {
        await setDoc(profileRef, {
          marketDisplayCurrency: data.marketDisplayCurrency || "INR",
          language: data.language || "en",
          onboardingState: { ...DEFAULT_ONBOARDING_STATE, ...(data.onboardingState || {}) },
          plannerState: { ...DEFAULT_PLANNER_STATE, ...(data.plannerState || {}) },
          aiConfig: data.aiConfig || localFallback.aiConfig,
          budget: data.budget || "",
          role: data.role || "user",
          notificationsEnabled: data.notificationsEnabled !== false,
        });
      }
    });
  }, [user]);

  const profileState = useMemo(() => ({
    marketDisplayCurrency,
    language,
    onboardingState,
    plannerState,
    aiConfig,
    budget,
    role: userRole,
    notificationsEnabled,
  }), [marketDisplayCurrency, language, onboardingState, plannerState, aiConfig, budget, userRole, notificationsEnabled]);

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
    if (!user || !goalsReadyRef.current) return;
    const nextItems = sortRecordsById(goals.map(normalizeCollectionRecord));
    const nextSerialized = JSON.stringify(nextItems);
    if (nextSerialized === lastGoalsSerializedRef.current) return;
    lastGoalsSerializedRef.current = nextSerialized;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const batch = writeBatch(db);
    nextItems.forEach((item) => {
      const { id, ...payload } = item;
      batch.set(doc(db, "users", user.uid, "goals", id), payload, { merge: true });
    });
    for (const id of cloudGoalIdsRef.current) {
      if (!nextIds.has(id)) {
        batch.delete(doc(db, "users", user.uid, "goals", id));
      }
    }
    batch.commit().catch(() => {});
  }, [goals, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "assets"), JSON.stringify(assets));
  }, [assets, user]);
  useEffect(() => {
    if (!user || !assetsReadyRef.current) return;
    const nextItems = sortRecordsById(assets.map(normalizeCollectionRecord));
    const nextSerialized = JSON.stringify(nextItems);
    if (nextSerialized === lastAssetsSerializedRef.current) return;
    lastAssetsSerializedRef.current = nextSerialized;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const batch = writeBatch(db);
    nextItems.forEach((item) => {
      const { id, ...payload } = item;
      batch.set(doc(db, "users", user.uid, "assets", id), payload, { merge: true });
    });
    for (const id of cloudAssetIdsRef.current) {
      if (!nextIds.has(id)) {
        batch.delete(doc(db, "users", user.uid, "assets", id));
      }
    }
    batch.commit().catch(() => {});
  }, [assets, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "liabilities"), JSON.stringify(liabilities));
  }, [liabilities, user]);
  useEffect(() => {
    if (!user || !liabilitiesReadyRef.current) return;
    const nextItems = sortRecordsById(liabilities.map(normalizeCollectionRecord));
    const nextSerialized = JSON.stringify(nextItems);
    if (nextSerialized === lastLiabilitiesSerializedRef.current) return;
    lastLiabilitiesSerializedRef.current = nextSerialized;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const batch = writeBatch(db);
    nextItems.forEach((item) => {
      const { id, ...payload } = item;
      batch.set(doc(db, "users", user.uid, "liabilities", id), payload, { merge: true });
    });
    for (const id of cloudLiabilityIdsRef.current) {
      if (!nextIds.has(id)) {
        batch.delete(doc(db, "users", user.uid, "liabilities", id));
      }
    }
    batch.commit().catch(() => {});
  }, [liabilities, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "holdings"), JSON.stringify(holdings));
    if (Array.isArray(holdings) && holdings.length) {
      localStorage.setItem(getStorageKey(user.uid, "holdings-backup"), JSON.stringify(holdings));
    }
  }, [holdings, user]);
  useEffect(() => {
    if (!user || !holdingsReadyRef.current) return;
    const nextItems = sortRecordsById(holdings.map(normalizeHoldingRecord));
    const nextSerialized = JSON.stringify(nextItems);
    if (nextSerialized === lastHoldingsSerializedRef.current) return;
    lastHoldingsSerializedRef.current = nextSerialized;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const batch = writeBatch(db);
    nextItems.forEach((item) => {
      const { id, ...payload } = item;
      batch.set(doc(db, "users", user.uid, "holdings", id), payload, { merge: true });
    });
    for (const id of cloudHoldingIdsRef.current) {
      if (!nextIds.has(id)) {
        batch.delete(doc(db, "users", user.uid, "holdings", id));
      }
    }
    batch.commit().catch(() => {});
  }, [holdings, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "portfolio-snapshots"), JSON.stringify(portfolioSnapshots));
    if (Array.isArray(portfolioSnapshots) && portfolioSnapshots.length) {
      localStorage.setItem(getStorageKey(user.uid, "portfolio-snapshots-backup"), JSON.stringify(portfolioSnapshots));
    }
  }, [portfolioSnapshots, user]);
  useEffect(() => {
    if (!user || !snapshotsReadyRef.current) return;
    const nextItems = sortRecordsById(
      sanitizePortfolioSnapshots(holdingsStateRef.current, portfolioSnapshots).map(normalizeSnapshotRecord)
    );
    const nextSerialized = JSON.stringify(nextItems);
    if (nextSerialized === lastSnapshotsSerializedRef.current) return;
    lastSnapshotsSerializedRef.current = nextSerialized;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const batch = writeBatch(db);
    nextItems.forEach((item) => {
      const { id, ...payload } = item;
      batch.set(doc(db, "users", user.uid, "portfolioSnapshots", id), payload, { merge: true });
    });
    for (const id of cloudSnapshotIdsRef.current) {
      if (!nextIds.has(id)) {
        batch.delete(doc(db, "users", user.uid, "portfolioSnapshots", id));
      }
    }
    batch.commit().catch(() => {});
  }, [portfolioSnapshots, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "market-display-currency"), marketDisplayCurrency);
  }, [marketDisplayCurrency, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "language"), language);
  }, [language, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "onboarding"), JSON.stringify(onboardingState));
  }, [onboardingState, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "planner-state"), JSON.stringify(plannerState));
  }, [plannerState, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "vault-docs"), JSON.stringify(vaultDocs));
  }, [vaultDocs, user]);
  useEffect(() => {
    if (!user || !vaultDocsReadyRef.current) return;
    const nextItems = sortRecordsById(vaultDocs.map(normalizeVaultDocRecord));
    const nextSerialized = JSON.stringify(nextItems);
    if (nextSerialized === lastVaultDocsSerializedRef.current) return;
    lastVaultDocsSerializedRef.current = nextSerialized;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const batch = writeBatch(db);
    nextItems.forEach((item) => {
      const { id, ...payload } = item;
      batch.set(doc(db, "users", user.uid, "vaultDocs", id), payload, { merge: true });
    });
    for (const id of cloudVaultDocIdsRef.current) {
      if (!nextIds.has(id)) {
        batch.delete(doc(db, "users", user.uid, "vaultDocs", id));
      }
    }
    batch.commit().catch(() => {});
  }, [vaultDocs, user]);
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
    localStorage.setItem(getStorageKey(user.uid, "role"), userRole);
  }, [userRole, user]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.uid, "notifications"), String(notificationsEnabled));
  }, [notificationsEnabled, user]);

  const hasPendingVaultSync = vaultDocs.some((item) =>
    (item.attachments || []).some((file) => ["local", "syncing", "error"].includes(file?.syncStatus || ""))
  );

  useEffect(() => {
    const handler = (event) => {
      if (!hasPendingVaultSync) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingVaultSync]);

  const showToast = useCallback((msg, kind = "success") => {
    setToast({ msg, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      } else if (!isTyping && event.key === "/") {
        event.preventDefault();
        setCommandOpen(true);
      } else if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogin = async (e, p, rememberMe = true) => {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, e, p);
  };
  const handleSignup = async (e, p) => {
    const cred = await createUserWithEmailAndPassword(auth, e, p);
    if (cred.user && !cred.user.emailVerified) {
      await sendEmailVerification(cred.user, emailActionSettings);
    }
    return cred;
  };
  const signInWithProvider = async (provider) => {
    await setPersistence(auth, browserLocalPersistence);
    const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
    if (isStandalone) {
      await signInWithRedirect(auth, provider);
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = String(error?.code || "");
      const needsRedirectFallback = [
        "auth/popup-blocked",
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment",
      ].includes(code);
      if (!needsRedirectFallback) throw error;
      await signInWithRedirect(auth, provider);
    }
  };
  const handleGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithProvider(provider);
  };
  const handleCreatePasskey = async (emailOverride) => {
    const email = String(emailOverride || auth.currentUser?.email || "").trim().toLowerCase();
    if (!email) throw new Error("Sign in with an email-based account before creating a passkey on this device.");
    const next = await createLocalPasskey(email);
    setPasskeyProfiles(next);
    return next;
  };
  const handlePasskeyLogin = async (preferredEmail = "") => {
    const match = await authenticateWithLocalPasskey(preferredEmail);
    if (auth.currentUser?.email?.toLowerCase() === match.email) {
      return { mode: "session", email: match.email };
    }
    await handleSendEmailLink(match.email);
    return { mode: "magic-link", email: match.email };
  };
  const handleInstallApp = async () => {
    if (!installPromptEvent) return false;
    installPromptEvent.prompt();
    const outcome = await installPromptEvent.userChoice.catch(() => null);
    if (outcome?.outcome === "accepted") {
      setToast({ msg: "Installing Finwise on this device...", kind: "success" });
      setInstallPromptEvent(null);
      return true;
    }
    setToast({ msg: "Install prompt dismissed.", kind: "warning" });
    return false;
  };
  const handleRemovePasskey = async (email) => {
    const next = removeLocalPasskey(email);
    setPasskeyProfiles(next);
    return next;
  };
  const logout = () => {
    if (hasPendingVaultSync) {
      const proceed = window.confirm("Some vault files are still local or syncing. Sign out anyway?");
      if (!proceed) return;
    }
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
    const removed = expenses.find((item) => item.id === id);
    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
    if (removed) {
      setLastUndo({ type: "delete-expense", affected: [removed], createdAt: Date.now() });
    }
    showToast("Transaction removed. Undo is available.", "error");
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

  const seedDemoWorkspace = useCallback(async () => {
    if (!user || expenses.length) {
      showToast("Demo mode is best started from a fresh account with no transactions yet.", "warning");
      return;
    }
    const demoMonth = new Date();
    demoMonth.setDate(3);
    const shift = (days) => {
      const copy = new Date(demoMonth);
      copy.setDate(copy.getDate() + days);
      return toLocalDateStr(copy);
    };
    const demoTransactions = [
      { amount: 185000, type: "income", category: "Salary", note: "Monthly salary credit", date: shift(-2), recurring: true, recurringFrequency: "monthly" },
      { amount: 42000, type: "expense", category: "Rent", note: "Home rent", date: shift(0), recurring: true, recurringFrequency: "monthly" },
      { amount: 12000, type: "expense", category: "Food & Dining", note: "Family groceries and dining", date: shift(3), recurring: false, recurringFrequency: null },
      { amount: 3500, type: "expense", category: "Subscriptions", note: "Netflix, ChatGPT, music", date: shift(4), recurring: true, recurringFrequency: "monthly" },
      { amount: 18000, type: "expense", category: "EMI / Loan", note: "Car EMI", date: shift(6), recurring: true, recurringFrequency: "monthly" },
      { amount: 15000, type: "investment", category: "Stocks — NSE/BSE", note: "SIP to equities", date: shift(8), recurring: true, recurringFrequency: "monthly" },
      { amount: 12000, type: "investment", category: "Mutual Fund — Equity", note: "Index fund SIP", date: shift(8), recurring: true, recurringFrequency: "monthly" },
      { amount: 1800, type: "insurance", category: "Term Life Insurance", note: "Monthly protection premium", date: shift(10), recurring: true, recurringFrequency: "monthly" },
    ];
    try {
      for (const item of demoTransactions) {
        await addDoc(collection(db, "users", user.uid, "expenses"), item);
      }
      setGoals([
        { id: crypto.randomUUID(), name: "Emergency Fund", category: "Emergency Fund", targetAmount: 300000, currentAmount: 120000, targetDate: shift(180) },
        { id: crypto.randomUUID(), name: "Annual Vacation", category: "Vacation", targetAmount: 150000, currentAmount: 45000, targetDate: shift(240) },
      ]);
      setAssets([{ id: crypto.randomUUID(), name: "Emergency Cash", type: "Cash", value: 120000 }]);
      setLiabilities([{ id: crypto.randomUUID(), name: "Car Loan", type: "Loan", value: 420000 }]);
      setVaultDocs([
        { id: crypto.randomUUID(), title: "Health Insurance Policy", type: "Insurance", issuer: "Insurer", renewalDate: shift(45), reminderDays: 30, reference: "POL12345", note: "Renewal packet demo", attachments: [] },
      ]);
      setPlannerState((prev) => ({
        ...prev,
        monthlyHouseholdExpense: "75000",
        currentEmergencyFund: "120000",
        annualIncome: "2220000",
        currentInvestableAssets: "275000",
        monthlyGoalContribution: "35000",
        currentInsuranceCover: "2500000",
        totalLiabilities: "420000",
        emiAmount: "18000",
      }));
      setOnboardingState((prev) => ({ ...prev, demoSeeded: true, wizardStep: 1 }));
      showToast("Demo mode loaded. Explore the workflows with sample financial data.");
    } catch {
      showToast("Could not load demo mode.", "error");
    }
  }, [user, expenses.length, showToast]);

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
  const holdingCurrency = (item) =>
    String(
      item?.currency ||
      (String(item?.quoteSymbol || item?.symbol || "").toUpperCase().includes(".NS") ? "INR" : "USD")
    ).toUpperCase();
  const allTimeMarketInvestment = expenses
    .filter((item) => item.type === "investment" && LIVE_MARKET_CATEGORIES.has(item.category))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const nonMarketInvestment = Math.max(0, allTimeInvestment - allTimeMarketInvestment);
  const liveHoldingsValue = holdings.reduce(
    (sum, item) =>
      sum +
      convertAmount(
        Number(
          item.currentValue ||
          item.investedValue ||
          (Number(item.units || 0) * Number(item.costPerUnit || 0))
        ),
        holdingCurrency(item),
        "INR",
        marketFx
      ),
    0
  );
  const portfolioInvestedValue = holdings.reduce(
    (sum, item) =>
      sum + convertAmount(
        Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)),
        holdingCurrency(item),
        "INR",
        marketFx
      ),
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
  const recurringBills = expenses.filter((t) => t.type === "expense" && t.recurring);
  const subscriptionRows = recurringBills.filter((t) =>
    t.category === "Subscriptions" || /netflix|spotify|prime|youtube|hotstar|chatgpt|icloud|apple|google one|canva/i.test(`${t.note || ""} ${t.category}`)
  );
  const subscriptionMonthly = subscriptionRows.reduce((sum, item) => sum + annualizedRecurringAmount(item.amount, item.recurringFrequency) / 12, 0);
  const subscriptionAnnual = subscriptionRows.reduce((sum, item) => sum + annualizedRecurringAmount(item.amount, item.recurringFrequency), 0);
  const recurringAnnual = recurringBills.reduce((sum, item) => sum + annualizedRecurringAmount(item.amount, item.recurringFrequency), 0);
  const upcomingBills = recurringBills
    .map((item) => {
      const nextDate = nextRecurringDate(item.date, item.recurringFrequency, new Date());
      return nextDate ? { ...item, nextDate } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.nextDate - b.nextDate)
    .slice(0, 6);

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

  const historicalExpenseAverage = monthlySeries.length
    ? monthlySeries.reduce((sum, month) => sum + Number(month.expense || 0), 0) / monthlySeries.length
    : 0;
  const monthlyExpenseBaseline = Number(plannerState.monthlyHouseholdExpense || totals.expense || historicalExpenseAverage || 0);
  const emergencyTarget = monthlyExpenseBaseline * Number(plannerState.emergencyFundMonths || 0);
  const currentEmergencyFund = Number(plannerState.currentEmergencyFund || 0);
  const emergencyGap = Math.max(emergencyTarget - currentEmergencyFund, 0);
  const emergencyCoverageMonths = monthlyExpenseBaseline > 0 ? currentEmergencyFund / monthlyExpenseBaseline : 0;
  const currentAge = Number(plannerState.currentAge || 0);
  const retirementAge = Number(plannerState.retirementAge || 0);
  const yearsToRetirement = Math.max(retirementAge - currentAge, 0);
  const inflationRate = Number(plannerState.inflationRate || 0) / 100;
  const expectedReturn = Number(plannerState.expectedReturn || 0) / 100;
  const monthlyRate = expectedReturn / 12;
  const monthsToRetirement = yearsToRetirement * 12;
  const currentRetirementCorpus = Number(plannerState.currentRetirementCorpus || 0);
  const monthlyRetirementContribution = Number(plannerState.monthlyRetirementContribution || 0);
  const retirementTarget = monthlyExpenseBaseline > 0
    ? monthlyExpenseBaseline * 12 * 25 * Math.pow(1 + inflationRate, yearsToRetirement)
    : 0;
  const futureCorpus = monthsToRetirement > 0
    ? (currentRetirementCorpus * Math.pow(1 + monthlyRate, monthsToRetirement)) +
      (monthlyRate > 0
        ? monthlyRetirementContribution * ((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate)
        : monthlyRetirementContribution * monthsToRetirement)
    : currentRetirementCorpus;
  const retirementGap = Math.max(retirementTarget - futureCorpus, 0);
  const loanPrincipal = Number(plannerState.loanPrincipal || 0);
  const loanRate = Number(plannerState.loanRate || 0) / 1200;
  const loanRemainingMonths = Number(plannerState.loanRemainingMonths || 0);
  const emiAmount = Number(plannerState.emiAmount || 0);
  const suggestedEmi = loanPrincipal > 0 && loanRemainingMonths > 0
    ? (loanRate > 0
        ? (loanPrincipal * loanRate * Math.pow(1 + loanRate, loanRemainingMonths)) / (Math.pow(1 + loanRate, loanRemainingMonths) - 1)
        : loanPrincipal / loanRemainingMonths)
    : 0;
  const emiStress = totals.income > 0 ? ((emiAmount || suggestedEmi) / totals.income) * 100 : 0;

  const vaultReminderCounts = vaultDocs.reduce(
    (acc, docItem) => {
      if (!docItem.renewalDate) return acc;
      const renewal = new Date(docItem.renewalDate);
      if (Number.isNaN(renewal.getTime())) return acc;
      const daysLeft = Math.ceil((renewal - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) acc.expired += 1;
      else if (daysLeft <= Number(docItem.reminderDays || 30)) acc.dueSoon += 1;
      return acc;
    },
    { dueSoon: 0, expired: 0 }
  );

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
  if (budgetNum && totals.expense > budgetNum) alerts.push({ title: t("dashboard.alertBudgetExceeded", "Budget exceeded"), body: `${t("dashboard.alertOverBudgetPrefix", "You are")} ${fmtINR(totals.expense - budgetNum)} ${t("dashboard.alertOverBudgetSuffix", "over the current budget.")}`, tone: "warn" });
  else if (budgetNum && budgetProgress > 85) alerts.push({ title: t("dashboard.alertBudgetTight", "Budget getting tight"), body: `${budgetProgress.toFixed(0)}% ${t("dashboard.alertBudgetUsed", "of the monthly expense budget is already used.")}`, tone: "info" });
  if (momExpenseDelta > 12) alerts.push({ title: t("dashboard.alertSpendingSpike", "Spending spike"), body: `${t("dashboard.alertExpenseUpPrefix", "Expenses are up")} ${momExpenseDelta.toFixed(1)}% ${t("dashboard.alertExpenseUpSuffix", "versus the previous month.")}`, tone: "warn" });
  if (totals.income > 0 && totals.savingsRate < 10) alerts.push({ title: t("dashboard.alertLowSavings", "Savings rate is low"), body: t("dashboard.alertLowSavingsBody", "Try protecting savings before discretionary spend expands further."), tone: "warn" });
  if (unusualTransactions.length) alerts.push({ title: t("dashboard.alertUnusualTitle", "Unusual transactions detected"), body: `${unusualTransactions.length} ${t("dashboard.alertUnusualBody", "transaction(s) look materially larger than category norms.")}`, tone: "warn" });
  if (recurringOutflow > 0 && totals.income > 0 && recurringOutflow > totals.income * 0.35) alerts.push({ title: t("dashboard.alertRecurringHeavy", "Recurring obligations are heavy"), body: t("dashboard.alertRecurringHeavyBody", "Bills and recurring commitments are consuming a large share of monthly income."), tone: "info" });
  if (!alerts.length) alerts.push({ title: t("dashboard.healthyRhythm", "Healthy rhythm"), body: t("dashboard.healthyRhythmBody", "No urgent warnings from budgets, anomalies, or recurring commitments."), tone: "good" });

  const duplicateTransactionCount = useMemo(() => {
    const seen = new Map();
    expenses.forEach((item) => {
      const key = [
        item.date || "",
        item.type || "",
        item.category || "",
        Number(item.amount || 0).toFixed(2),
        String(item.note || "").trim().toLowerCase(),
      ].join("|");
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    return [...seen.values()].reduce((sum, count) => sum + Math.max(count - 1, 0), 0);
  }, [expenses]);

  const smartRuleSuggestions = useMemo(() => {
    const rules = [
      { type: "expense", category: "Subscriptions", test: /netflix|spotify|prime|hotstar|youtube|icloud|apple|google one|canva|subscription/i },
      { type: "expense", category: "EMI / Loan", test: /\bemi\b|loan|mortgage|repayment/i },
      { type: "expense", category: "Home & Rent", test: /rent|lease|maintenance/i },
      { type: "expense", category: "Fuel", test: /fuel|petrol|diesel|shell|bharat petroleum|indian oil|hpcl/i },
      { type: "expense", category: "Medicines", test: /medicine|pharmacy|apollo pharmacy|medplus|tablet|clinic/i },
      { type: "income", category: "Salary", test: /salary|payroll|wage|monthly pay/i },
      { type: "insurance", category: "Term Life Insurance", test: /term life|life insurance/i },
      { type: "insurance", category: "Health Insurance — Family", test: /health insurance|medical policy|family floater/i },
    ];
    return expenses.flatMap((item) => {
      const haystack = `${item.category || ""} ${item.note || ""}`.toLowerCase();
      const match = rules.find((rule) =>
        rule.type === item.type &&
        item.category !== rule.category &&
        ALL_CATS[item.type]?.includes(rule.category) &&
        rule.test.test(haystack)
      );
      if (!match) return [];
      return [{
        id: item.id,
        date: item.date,
        amount: Number(item.amount || 0),
        note: item.note || "",
        from: item.category,
        to: match.category,
        type: item.type,
      }];
    }).slice(0, 30);
  }, [expenses]);

  const dataConfidence = useMemo(() => {
    const now = Date.now();
    const staleMarketPrices = holdings.filter((item) => {
      if (!["stock", "mutual-fund", "crypto", "commodity"].includes(item.kind)) return false;
      const stamp = item.refreshedAt || item.priceDate || item.lastUpdatedAt || item.updatedAt || "";
      if (!stamp) return true;
      const time = new Date(stamp).getTime();
      if (Number.isNaN(time)) return true;
      return now - time > 3 * 24 * 60 * 60 * 1000;
    }).length;
    const failedVaultUploads = vaultDocs.reduce((sum, item) =>
      sum + (item.attachments || []).filter((file) => file?.syncStatus === "error").length, 0);
    const pendingVaultUploads = vaultDocs.reduce((sum, item) =>
      sum + (item.attachments || []).filter((file) => ["local", "syncing"].includes(file?.syncStatus)).length, 0);
    const missingCategories = expenses.filter((item) => !ALL_CATS[item.type]?.includes(item.category)).length;
    const issues = [
      staleMarketPrices,
      failedVaultUploads,
      pendingVaultUploads,
      missingCategories,
      duplicateTransactionCount,
    ].filter(Boolean).length;
    return {
      score: Math.max(55, 100 - issues * 9 - Math.min(staleMarketPrices, 6) * 2),
      firestore: user ? "Connected" : "Offline",
      lastBackup: expenses[0]?.date || holdings[0]?.refreshedAt || vaultDocs[0]?.renewalDate || "Not available",
      staleMarketPrices,
      failedVaultUploads,
      pendingVaultUploads,
      missingCategories,
      duplicateTransactionCount,
      smartRuleSuggestions: smartRuleSuggestions.length,
    };
  }, [duplicateTransactionCount, expenses, holdings, smartRuleSuggestions.length, user, vaultDocs]);

  const monthlyReview = useMemo(() => {
    const reviewMonth = selectedMonth === "all" ? currentMonth : selectedMonth;
    const label = reviewMonth ? monthLabel(reviewMonth) : monthLabel(toYYYYMM(new Date()));
    const items = expenses.filter((item) => item.date?.startsWith(reviewMonth));
    const monthTotals = {
      income: sumByType(items, "income"),
      expense: sumByType(items, "expense"),
      investment: sumByType(items, "investment"),
      insurance: sumByType(items, "insurance"),
    };
    monthTotals.balance = monthTotals.income - monthTotals.expense - monthTotals.investment - monthTotals.insurance;
    monthTotals.savingsRate = monthTotals.income > 0 ? ((monthTotals.income - monthTotals.expense) / monthTotals.income) * 100 : 0;
    const categoryRows = buildPie(items, "expense").slice(0, 3);
    const goalGap = goals.reduce((sum, goal) => sum + Math.max(Number(goal.targetAmount || 0) - Number(goal.currentAmount || 0), 0), 0);
    return {
      label,
      totals: monthTotals,
      topCategories: categoryRows,
      subscriptionMonthly,
      recurringAnnual,
      goalGap,
      portfolioGainLoss,
      actionCount: alerts.filter((item) => item.tone !== "good").length + smartRuleSuggestions.length,
    };
  }, [alerts, currentMonth, expenses, goals, portfolioGainLoss, recurringAnnual, selectedMonth, smartRuleSuggestions.length, subscriptionMonthly]);

  const applySmartRuleSuggestions = useCallback(async () => {
    if (!user || !smartRuleSuggestions.length) return;
    const suggestionMap = new Map(smartRuleSuggestions.map((item) => [item.id, item]));
    const affected = expenses
      .filter((item) => suggestionMap.has(item.id))
      .map((item) => ({
        id: item.id,
        previousCategory: item.category,
        nextCategory: suggestionMap.get(item.id).to,
      }));
    if (!affected.length) return;
    const batch = writeBatch(db);
    affected.forEach((item) => {
      batch.update(doc(db, "users", user.uid, "expenses", item.id), {
        category: item.nextCategory,
        ruleAppliedAt: new Date().toISOString(),
      });
    });
    await batch.commit();
    setLastUndo({ type: "smart-rules", affected, createdAt: Date.now() });
    showToast(`${affected.length} rule suggestion(s) applied.`, "success");
  }, [expenses, showToast, smartRuleSuggestions, user]);

  const undoLastChange = useCallback(async () => {
    if (!user || !lastUndo?.affected?.length) return;
    const batch = writeBatch(db);
    if (lastUndo.type === "delete-expense") {
      lastUndo.affected.forEach((item) => {
        const { id, ...payload } = item;
        batch.set(doc(db, "users", user.uid, "expenses", id), payload, { merge: true });
      });
    } else {
      lastUndo.affected.forEach((item) => {
        batch.update(doc(db, "users", user.uid, "expenses", item.id), {
          category: item.previousCategory,
          ruleAppliedAt: null,
        });
      });
    }
    await batch.commit();
    setLastUndo(null);
    showToast("Last change was undone.", "success");
  }, [lastUndo, showToast, user]);

  const exportMonthlyReview = useCallback(() => {
    const rows = [
      ["Income", fmtINR(monthlyReview.totals.income)],
      ["Expenses", fmtINR(monthlyReview.totals.expense)],
      ["Investments", fmtINR(monthlyReview.totals.investment)],
      ["Insurance", fmtINR(monthlyReview.totals.insurance)],
      ["Savings rate", monthlyReview.totals.income > 0 ? `${monthlyReview.totals.savingsRate.toFixed(1)}%` : "—"],
      ["Net cash", fmtINR(monthlyReview.totals.balance)],
      ["Goal funding gap", fmtINR(monthlyReview.goalGap)],
      ["Portfolio movement", fmtINR(monthlyReview.portfolioGainLoss)],
    ];
    const html = `<!doctype html><html><head><title>Finwise Monthly Review</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:26px;margin:0 0 4px}p{color:#555}table{border-collapse:collapse;width:100%;margin-top:20px}td{border-bottom:1px solid #ddd;padding:10px 6px;font-size:13px}td:last-child{text-align:right;font-weight:700}li{margin:8px 0;font-size:13px}</style></head><body><h1>Finwise Monthly Review</h1><p>${monthlyReview.label}</p><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table><h2>Top expense areas</h2><ul>${monthlyReview.topCategories.map((item) => `<li>${item.name}: ${fmtINR(item.value)}</li>`).join("") || "<li>No expense data yet.</li>"}</ul></body></html>`;
    const win = window.open("", "_blank", "width=980,height=820");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    showToast("Monthly review opened for PDF export.");
  }, [monthlyReview, showToast]);

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
    language,
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

  const externalAIReady = isAdmin
    ? Boolean(backendHealth?.providers?.[aiConfig.provider])
    : Boolean(backendHealth?.aiEnabled);

  const runAIInsights = async () => {
    setAiState((s) => ({ ...s, loading: true, error: "", externalText: "", report: heuristicReport, language }));
    try {
      let externalText = "";
      if (externalAIReady) {
        const response = await requestAIInsights({
          provider: aiConfig.provider,
          model: aiConfig.model,
          freeModel: aiConfig.freeModel,
          context: {
            language,
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
      setAiState({ loading: false, error: "", externalText, report: heuristicReport, language });
      showToast("Insights refreshed.");
    } catch (e) {
      setAiState({ loading: false, error: e.message || "AI request failed", externalText: "", report: heuristicReport, language });
      showToast("AI request failed. Using local insights.", "warning");
    }
  };

  const askAIQuestion = async (question) => {
    const context = {
      language,
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
      if (externalAIReady) {
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
      setAiState((s) => ({ ...s, report: heuristicReport, language }));
    }
  }, [aiState.report, expenses.length, heuristicReport, language]);

  useEffect(() => {
    setAiState((s) => {
      if (s.language === language) return s;
      return {
        ...s,
        error: "",
        externalText: "",
        report: heuristicReport,
        language,
      };
    });
  }, [language, heuristicReport]);

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
        <LoginPage
          onLogin={handleLogin}
          onSignup={handleSignup}
          onGoogle={handleGoogle}
          onSendEmailLink={handleSendEmailLink}
          onPasskeyLogin={handlePasskeyLogin}
          passkeyProfiles={passkeyProfiles}
          passkeySupported={passkeySupported}
        />
      </>
    );
  }

  const NAV = [
    { id: "dashboard", icon: "◉", label: t("nav.overview", "Overview") },
    { id: "ai", icon: "✦", label: t("nav.ai", "AI Insights") },
    { id: "analytics", icon: "📊", label: t("nav.analytics", "Analytics") },
    { id: "goals", icon: "◎", label: t("nav.goals", "Goals") },
    { id: "wealth", icon: "⬢", label: t("nav.wealth", "Net Worth") },
    { id: "timeline", icon: "◷", label: t("nav.timeline", "Timeline") },
    { id: "vault", icon: "🗂", label: t("nav.vault", "Vault") },
    { id: "add", icon: "＋", label: t("nav.add", "Add") },
    { id: "history", icon: "≡", label: t("nav.history", "History") },
    { id: "import", icon: "⬆", label: t("nav.import", "Import") },
    { id: "settings", icon: "⚙", label: t("nav.settings", "Settings") },
  ];

  const MOBILE_NAV = [
    { id: "dashboard", icon: "◉", label: "Home" },
    { id: "ai", icon: "✦", label: "AI" },
    { id: "add", fab: true },
    { id: "history", icon: "≡", label: t("nav.history", "History") },
    { id: "goals", icon: "◎", label: t("nav.goals", "Goals") },
    { id: "more", icon: "⚙", label: "More", more: true },
  ];

  const MOBILE_MORE_ITEMS = [
    { id: "analytics", icon: "📊", label: t("nav.analytics", "Analytics") },
    { id: "wealth", icon: "⬢", label: t("nav.wealth", "Net Worth") },
    { id: "timeline", icon: "◷", label: t("nav.timeline", "Timeline") },
    { id: "vault", icon: "🗂", label: t("nav.vault", "Vault") },
    { id: "import", icon: "⬆", label: t("nav.import", "Import") },
    { id: "settings", icon: "⚙", label: t("nav.settings", "Settings") },
  ];

  const COMMANDS = [
    { id: "add-expense", title: t("command.addExpense", "Add expense"), subtitle: t("command.addExpenseSub", "Open the transaction form."), action: () => setActiveTab("add") },
    { id: "ask-ai", title: t("command.askAi", "Ask Finwise AI"), subtitle: t("command.askAiSub", "Jump to AI questions and insights."), action: () => setActiveTab("ai") },
    { id: "monthly-review", title: t("command.monthlyReview", "Export monthly review"), subtitle: t("command.monthlyReviewSub", "Open the printable month-end pack."), action: exportMonthlyReview },
    { id: "refresh-holdings", title: t("command.refreshHoldings", "Refresh holdings"), subtitle: t("command.refreshHoldingsSub", "Open market holdings to refresh prices."), action: () => setActiveTab("wealth") },
    { id: "data-health", title: t("command.dataHealth", "Check data health"), subtitle: t("command.dataHealthSub", "Review sync, duplicates, stale prices, and vault uploads."), action: () => setActiveTab("dashboard") },
    { id: "settings", title: t("command.preferences", "Preferences"), subtitle: t("command.preferencesSub", "Language, currency, notifications, and account settings."), action: () => setActiveTab("settings") },
  ];

  const tabLoadingFallback = (
    <div className="section-card tab-loading-card">
      <h3>{t("common.loadingView", "Loading View")}</h3>
      <p>{t("common.preparingWorkspace", "Preparing the next workspace...")}</p>
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
          onboardingState={onboardingState}
          setOnboardingState={setOnboardingState}
          plannerSummary={{
            emergencyTarget,
            emergencyGap,
            emergencyCoverageMonths,
            retirementTarget,
            retirementGap,
            futureCorpus,
            emiAmount: emiAmount || suggestedEmi,
            emiStress,
          }}
          subscriptionSummary={{
            monthly: subscriptionMonthly,
            annual: subscriptionAnnual,
            recurringAnnual,
            recurringCount: recurringBills.length,
            subscriptionCount: subscriptionRows.length,
            upcomingBills,
          }}
          vaultSummary={{
            totalDocs: vaultDocs.length,
            dueSoon: vaultReminderCounts.dueSoon,
            expired: vaultReminderCounts.expired,
          }}
          dataConfidence={dataConfidence}
          monthlyReview={monthlyReview}
          smartRuleSuggestions={smartRuleSuggestions}
          onApplySmartRules={applySmartRuleSuggestions}
          lastUndo={lastUndo}
          onUndo={undoLastChange}
          onExportMonthlyReview={exportMonthlyReview}
          onOpenCommand={() => setCommandOpen(true)}
          onLoadDemo={seedDemoWorkspace}
          onJumpToAdd={() => setActiveTab("add")}
          onJumpToImport={() => setActiveTab("import")}
          onJumpToGoals={() => setActiveTab("goals")}
          onJumpToNetWorth={() => setActiveTab("wealth")}
          onJumpToVault={() => setActiveTab("vault")}
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
          isAdmin={isAdmin}
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
    if (activeTab === "goals") {
      return (
        <GoalsTargets
          goals={goals}
          setGoals={setGoals}
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          totals={totals}
          plannerSummary={{
            emergencyTarget,
            emergencyGap,
            emergencyCoverageMonths,
            retirementTarget,
            retirementGap,
            futureCorpus,
            yearsToRetirement,
            suggestedEmi,
            emiStress,
          }}
        />
      );
    }
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
          marketDisplayCurrency={marketDisplayCurrency}
          setMarketDisplayCurrency={setMarketDisplayCurrency}
          marketFx={marketFx}
          portfolioInvestedValue={portfolioInvestedValue}
          portfolioGainLoss={portfolioGainLoss}
          investmentTransactions={expenses.filter((item) => item.type === "investment")}
          showToast={showToast}
        />
      );
    }
    if (activeTab === "vault") {
      return (
        <DocumentsVault
          docs={vaultDocs}
          setDocs={setVaultDocs}
          showToast={showToast}
          user={user}
        />
      );
    }
    if (activeTab === "timeline") {
      return (
        <TimelineView
          recurringBills={recurringBills}
          goals={goals}
          vaultDocs={vaultDocs}
          holdings={holdings}
          plannerSummary={{ emiAmount: emiAmount || suggestedEmi }}
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
          isAdmin={isAdmin}
          userRole={userRole}
          onSendVerificationEmail={handleSendVerificationEmail}
          onSendPasswordReset={handleSendPasswordReset}
          onChangeEmail={handleChangeEmail}
          language={language}
          setLanguage={setLanguage}
          passkeySupported={passkeySupported}
          passkeyProfiles={passkeyProfiles}
          onCreatePasskey={handleCreatePasskey}
          onRemovePasskey={handleRemovePasskey}
          pwaInstalled={pwaInstalled}
          pwaInstallReady={Boolean(installPromptEvent)}
          onInstallApp={handleInstallApp}
        />
      );
    }
    return null;
  };

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
    <>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="wordmark">◈ Finwise</div>
            <div className="tagline">{t("app.tagline", "AI Finance Tracker")}</div>
          </div>
          {NAV.map((item) => (
            <div key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <span className="ni">{item.icon}</span>{item.label}
            </div>
          ))}
          <div className="sidebar-spacer" />
          <div style={{ padding: "0 8px 8px" }}>
            <div className="theme-row" onClick={() => setDarkMode((v) => !v)}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)" }}>{darkMode ? t("theme.dark", "Dark theme") : t("theme.light", "Light theme")}</span>
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
            <button className="logout-btn" onClick={logout}>{t("auth.signout", "Sign Out")}</button>
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
                  <h3>{t("nav.more", "More")}</h3>
                  <p style={{ marginBottom: 0 }}>{t("nav.mobileMenuHelp", "Quick access to the rest of your finance workspace.")}</p>
                </div>
                <button className="icon-btn" onClick={() => setMobileMenuOpen(false)}>{t("common.close", "Close")}</button>
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
              <div className="mobile-account-card">
                <div className="user-row" style={{ padding: 0, marginBottom: 0 }}>
                  <div className="user-avatar">{(user?.email || user?.phoneNumber || "U")[0].toUpperCase()}</div>
                  <div className="user-email" style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "unset" }}>
                    {user?.email || user?.phoneNumber}
                  </div>
                </div>
                <div className="mobile-account-actions">
                  <div className="theme-row" style={{ margin: 0, flex: 1 }} onClick={() => setDarkMode((v) => !v)}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)" }}>
                      {darkMode ? t("theme.dark", "Dark theme") : t("theme.light", "Light theme")}
                    </span>
                    <div className={`tt-track ${darkMode ? "on" : ""}`}>
                      <div className="tt-thumb" />
                    </div>
                  </div>
                  <button className="logout-btn" style={{ width: "auto", minWidth: 120 }} onClick={logout}>
                    {t("auth.signout", "Sign Out")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {commandOpen && (
          <div className="command-overlay" onClick={() => setCommandOpen(false)}>
            <div className="command-palette" onClick={(e) => e.stopPropagation()}>
              <div className="command-head">
                <div>
                  <h3>{t("command.title", "Command Palette")}</h3>
                  <p>{t("command.subtitle", "Search actions, jump to workspaces, and run monthly review faster.")}</p>
                </div>
                <button className="icon-btn" onClick={() => setCommandOpen(false)}>{t("common.close", "Close")}</button>
              </div>
              <div className="command-list">
                {COMMANDS.map((item) => (
                  <button
                    key={item.id}
                    className="command-item"
                    onClick={() => {
                      item.action();
                      setCommandOpen(false);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </button>
                ))}
              </div>
              <div className="command-foot">
                <span>{t("command.shortcut", "Shortcut")}: ⌘/Ctrl K</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
    </I18nProvider>
  );
}
