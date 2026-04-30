import { loadLocalEnv, sendNodeJson } from "../../server/ai-runtime.mjs";
import { refreshMarketHoldings } from "../../server/market-runtime.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  if (req.method !== "POST") return sendNodeJson(res, { ok: false, error: "Method not allowed" }, 405);
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const payload = await refreshMarketHoldings(body.holdings || []);
    return sendNodeJson(res, { ok: true, ...payload }, 200);
  } catch (error) {
    return sendNodeJson(res, { ok: false, error: error.message || "Market refresh failed" }, 500);
  }
}
