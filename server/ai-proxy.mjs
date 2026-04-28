import { createServer } from "node:http";

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

async function callAnthropic({ model, context }) {
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
      messages: [{ role: "user", content: buildPrompt(context) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Anthropic request failed");
  return data?.content?.map((x) => x.text).join("\n\n") || "";
}

async function callOpenRouter({ freeModel, context }) {
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
      messages: [{ role: "user", content: buildPrompt(context) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenRouter request failed");
  return data?.choices?.[0]?.message?.content || "";
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
      },
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/ai/insights") {
    try {
      const body = await readBody(req);
      const provider = body.provider || "anthropic";
      const payload = { model: body.model, freeModel: body.freeModel, context: body.context || {} };
      const text = provider === "openrouter" ? await callOpenRouter(payload) : await callAnthropic(payload);
      json(res, 200, { ok: true, text });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Proxy request failed" });
    }
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`AI proxy listening on http://${HOST}:${PORT}`);
});
