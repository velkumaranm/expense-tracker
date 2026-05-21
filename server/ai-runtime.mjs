import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let envLoaded = false;
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyCkPhOoeRA02YiP-Eql-Zi-kZmP53LFrfA";
const ADMIN_EMAILS = String(process.env.FINWISE_ADMIN_EMAILS || "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export function loadLocalEnv() {
  if (envLoaded) return;
  envLoaded = true;

  [".env.local", ".env"].forEach((fileName) => {
    const envPath = resolve(process.cwd(), fileName);
    if (!existsSync(envPath)) return;

    const raw = readFileSync(envPath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env) || !process.env[key]) process.env[key] = value;
    });
  });
}

function buildProxyUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://${process.env.AI_PROXY_HOST || "127.0.0.1"}:${process.env.AI_PROXY_PORT || 8787}`;
}

function decodeJwtPayload(token = "") {
  try {
    const [, payload] = token.split(".");
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

async function lookupFirebaseUser(idToken) {
  if (!idToken || !FIREBASE_WEB_API_KEY) return null;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.users?.[0] || null;
}

export async function resolveViewerAccess(authHeader = "") {
  const match = String(authHeader || "").match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1];
  if (!idToken) return { isAdmin: false, viewerRole: "user", email: "" };

  const lookupUser = await lookupFirebaseUser(idToken);
  if (!lookupUser) return { isAdmin: false, viewerRole: "user", email: "" };

  const payloadClaims = decodeJwtPayload(idToken);
  const email = String(
    lookupUser.email || payloadClaims?.email || ""
  ).trim().toLowerCase();
  const tokenRole = payloadClaims?.role;
  const tokenAdmin = payloadClaims?.admin === true;

  let customClaims = {};
  try {
    customClaims = lookupUser.customAttributes ? JSON.parse(lookupUser.customAttributes) : {};
  } catch {
    customClaims = {};
  }

  const isAdmin = Boolean(
    tokenAdmin ||
      tokenRole === "admin" ||
      customClaims?.admin === true ||
      customClaims?.role === "admin" ||
      (email && ADMIN_EMAILS.includes(email))
  );
  return {
    isAdmin,
    viewerRole: isAdmin ? "admin" : "user",
    email,
    uid: String(lookupUser.localId || payloadClaims?.user_id || payloadClaims?.sub || "").trim(),
  };
}

export async function isAdminRequest(authHeader = "") {
  const result = await resolveViewerAccess(authHeader);
  return result.isAdmin;
}

export function healthPayload({ includeSensitive = false, viewerRole = "user" } = {}) {
  const fullProviders = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
  const fullMarketProviders = {
    alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
    twelveData: Boolean(process.env.TWELVE_DATA_API_KEY),
    finnhub: Boolean(process.env.FINNHUB_API_KEY),
  };
  const base = {
    ok: true,
    viewerRole,
    aiEnabled: Object.values(fullProviders).some(Boolean),
    marketEnabled: Object.values(fullMarketProviders).some(Boolean),
  };

  if (!includeSensitive) return base;

  return {
    ...base,
    proxyUrl: buildProxyUrl(),
    providers: fullProviders,
    marketProviders: fullMarketProviders,
    warnings: {
      likelyOpenAIKeyStoredAsOpenRouter:
        !process.env.OPENAI_API_KEY && (process.env.OPENROUTER_API_KEY || "").startsWith("sk-"),
    },
  };
}

const LANGUAGE_NAMES = {
  en: "English",
  ta: "Tamil",
  ml: "Malayalam",
  kn: "Kannada",
  te: "Telugu",
  hi: "Hindi",
};

function languageInstruction(context = {}) {
  const code = context.language || "en";
  if (code === "en") return "Write the entire answer in English.";
  const languageName = LANGUAGE_NAMES[code] || code;
  return `Write the entire answer in ${languageName}. Do not mix in another Indian language. Keep only app names, ticker symbols, financial product acronyms, and user-entered category names unchanged.`;
}

const buildPrompt = (context) =>
  `You are a personal finance analyst. Analyze this structured data and return concise, actionable recommendations with sections: Overview, Risks, Savings Opportunities, Investments, Insurance, and Next Actions. ${languageInstruction(context)}\n\n${JSON.stringify(
    context,
    null,
    2
  )}`;

const buildQueryPrompt = ({ context, question, history = [] }) =>
  `You are Finwise AI, a practical and thoughtful personal finance assistant. Answer the user's question using the structured financial data below. Be specific, concise, and actionable. If the data is incomplete, say so clearly. ${languageInstruction(context)}\n\nContext:\n${JSON.stringify(
    context,
    null,
    2
  )}\n\nRecent conversation:\n${JSON.stringify(history, null, 2)}\n\nUser question:\n${question}`;

async function callAnthropic({ model, context, promptType = "insights", question, history }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content:
            promptType === "query"
              ? buildQueryPrompt({ context, question, history })
              : buildPrompt(context),
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Anthropic request failed");
  return data?.content?.map((x) => x.text).join("\n\n") || "";
}

async function callOpenRouter({ freeModel, context, promptType = "insights", question, history }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: freeModel || process.env.OPENROUTER_MODEL || "openrouter/free",
      messages: [
        {
          role: "user",
          content:
            promptType === "query"
              ? buildQueryPrompt({ context, question, history })
              : buildPrompt(context),
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenRouter request failed");
  return data?.choices?.[0]?.message?.content || "";
}

async function callOpenAI({ model, context, promptType = "insights", question, history }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content:
            promptType === "query"
              ? buildQueryPrompt({ context, question, history })
              : buildPrompt(context),
        },
      ],
      temperature: 0.5,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenAI request failed");
  return data?.choices?.[0]?.message?.content || "";
}

export async function runProvider(provider, payload) {
  if (provider === "openrouter") return callOpenRouter(payload);
  if (provider === "openai") return callOpenAI(payload);
  return callAnthropic(payload);
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function parseRequestJson(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export function sendNodeJson(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
  res.end(JSON.stringify(body));
}
