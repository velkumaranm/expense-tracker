import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");

if (existsSync(ENV_PATH)) {
  const raw = readFileSync(ENV_PATH, "utf8");
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

const PORT = Number(process.env.AI_PROXY_PORT || 8787);
const HOST = process.env.AI_PROXY_HOST || "127.0.0.1";

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
    req.on("error", reject);
  });

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
      messages: [{ role: "user", content: promptType === "query" ? buildQueryPrompt({ context, question, history }) : buildPrompt(context) }],
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
      model: freeModel || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-8b-instruct:free",
      messages: [{ role: "user", content: promptType === "query" ? buildQueryPrompt({ context, question, history }) : buildPrompt(context) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenRouter request failed");
  return data?.choices?.[0]?.message?.content || "";
}

async function callOpenAI({ model, context, promptType = "insights", question, history }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
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

async function runProvider(provider, payload) {
  if (provider === "openrouter") return callOpenRouter(payload);
  if (provider === "openai") return callOpenAI(payload);
  return callAnthropic(payload);
}

function detectLikelyOpenAIKeyInOpenRouterSlot() {
  const key = process.env.OPENROUTER_API_KEY || "";
  return key.startsWith("sk-");
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/api/ai/health") {
    json(res, 200, {
      ok: true,
      proxyUrl: `http://${HOST}:${PORT}`,
      providers: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
      warnings: {
        likelyOpenAIKeyStoredAsOpenRouter: !process.env.OPENAI_API_KEY && detectLikelyOpenAIKeyInOpenRouterSlot(),
      },
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/ai/insights") {
    try {
      const body = await readBody(req);
      const provider = body.provider || "anthropic";
      const payload = { model: body.model, freeModel: body.freeModel, context: body.context || {} };
      const text = await runProvider(provider, payload);
      json(res, 200, { ok: true, text });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Proxy request failed" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/ai/query") {
    try {
      const body = await readBody(req);
      const provider = body.provider || "anthropic";
      const payload = {
        model: body.model,
        freeModel: body.freeModel,
        context: body.context || {},
        question: body.question || "",
        history: body.history || [],
        promptType: "query",
      };
      const text = await runProvider(provider, payload);
      json(res, 200, { ok: true, text });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Proxy query failed" });
    }
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`AI proxy listening on http://${HOST}:${PORT}`);
});
