import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let envLoaded = false;

export function loadLocalEnv() {
  if (envLoaded) return;
  envLoaded = true;

  const envPath = resolve(process.cwd(), ".env");
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
}

export function healthPayload() {
  return {
    ok: true,
    proxyUrl: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://${process.env.AI_PROXY_HOST || "127.0.0.1"}:${process.env.AI_PROXY_PORT || 8787}`,
    providers: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    warnings: {
      likelyOpenAIKeyStoredAsOpenRouter:
        !process.env.OPENAI_API_KEY && (process.env.OPENROUTER_API_KEY || "").startsWith("sk-"),
    },
  };
}

const buildPrompt = (context) =>
  `You are a personal finance analyst. Analyze this structured data and return concise, actionable recommendations with sections: Overview, Risks, Savings Opportunities, Investments, Insurance, and Next Actions.\n\n${JSON.stringify(
    context,
    null,
    2
  )}`;

const buildQueryPrompt = ({ context, question, history = [] }) =>
  `You are Finwise AI, a practical and thoughtful personal finance assistant. Answer the user's question using the structured financial data below. Be specific, concise, and actionable. If the data is incomplete, say so clearly.\n\nContext:\n${JSON.stringify(
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
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(body));
}
