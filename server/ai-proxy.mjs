import { createServer } from "node:http";
import {
  loadLocalEnv,
  healthPayload,
  resolveViewerAccess,
  runProvider,
} from "./ai-runtime.mjs";
import {
  refreshMarketHoldings,
  searchMarketInstruments,
  fetchUsdInrFx,
} from "./market-runtime.mjs";
import {
  deleteVaultAttachment,
  fetchVaultAttachment,
  uploadVaultAttachment,
} from "./vault-runtime.mjs";

loadLocalEnv();

const PORT = Number(process.env.AI_PROXY_PORT || 8787);
const HOST = process.env.AI_PROXY_HOST || "127.0.0.1";

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5_500_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
    req.on("error", reject);
  });

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/api/ai/health") {
    const access = await resolveViewerAccess(req.headers.authorization || "");
    json(res, 200, healthPayload({ includeSensitive: access.isAdmin, viewerRole: access.viewerRole }));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/api/market/search")) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const kind = url.searchParams.get("kind") || "stock";
      const q = url.searchParams.get("q") || "";
      const results = await searchMarketInstruments(kind, q);
      json(res, 200, { ok: true, results });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Market search failed" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/market/refresh") {
    try {
      const body = await readBody(req);
      const payload = await refreshMarketHoldings(body.holdings || []);
      json(res, 200, { ok: true, ...payload });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Market refresh failed" });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/market/fx") {
    try {
      const fx = await fetchUsdInrFx();
      json(res, 200, { ok: true, ...fx });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "FX fetch failed" });
    }
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

  if (req.method === "POST" && req.url === "/api/vault/upload") {
    try {
      const body = await readBody(req);
      const attachment = await uploadVaultAttachment({
        authHeader: req.headers.authorization || "",
        userId: body.userId || "",
        docId: body.docId || "",
        attachmentId: body.attachmentId || "",
        fileName: body.fileName || "",
        contentType: body.contentType || "",
        dataUrl: body.dataUrl || "",
      });
      json(res, 200, { ok: true, attachment });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Vault upload failed" });
    }
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/api/vault/file")) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const payload = await fetchVaultAttachment({
        authHeader: req.headers.authorization || "",
        userId: url.searchParams.get("userId") || "",
        pathname: url.searchParams.get("pathname") || "",
      });
      res.writeHead(200, {
        "content-type": payload.blob?.contentType || payload.headers.get("content-type") || "application/octet-stream",
        "content-disposition": payload.headers.get("content-disposition") || "inline",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type,authorization",
      });
      res.end(payload.buffer);
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Vault file could not be opened" });
    }
    return;
  }

  if (req.method === "DELETE" && req.url === "/api/vault/file") {
    try {
      const body = await readBody(req);
      await deleteVaultAttachment({
        authHeader: req.headers.authorization || "",
        userId: body.userId || "",
        pathname: body.pathname || "",
      });
      json(res, 200, { ok: true });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message || "Vault file could not be deleted" });
    }
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`AI proxy listening on http://${HOST}:${PORT}`);
});
