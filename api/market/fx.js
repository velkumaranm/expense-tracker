import { loadLocalEnv, sendNodeJson } from "../../server/ai-runtime.mjs";
import { fetchUsdInrFx } from "../../server/market-runtime.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  if (req.method !== "GET") return sendNodeJson(res, { ok: false, error: "Method not allowed" }, 405);
  try {
    const payload = await fetchUsdInrFx();
    return sendNodeJson(res, { ok: true, ...payload }, 200);
  } catch (error) {
    return sendNodeJson(res, { ok: false, error: error.message || "FX fetch failed" }, 500);
  }
}
