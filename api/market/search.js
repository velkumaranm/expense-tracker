import { loadLocalEnv, sendNodeJson } from "../../server/ai-runtime.mjs";
import { searchMarketInstruments } from "../../server/market-runtime.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  if (req.method !== "GET") return sendNodeJson(res, { ok: false, error: "Method not allowed" }, 405);
  try {
    const kind = req.query?.kind || "stock";
    const q = req.query?.q || "";
    const results = await searchMarketInstruments(kind, q);
    return sendNodeJson(res, { ok: true, results }, 200);
  } catch (error) {
    return sendNodeJson(res, { ok: false, error: error.message || "Market search failed" }, 500);
  }
}
