import {
  loadLocalEnv,
  runProvider,
  sendNodeJson,
} from "../../server/ai-runtime.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  if (req.method !== "POST") return sendNodeJson(res, { ok: false, error: "Method not allowed" }, 405);
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
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
    return sendNodeJson(res, { ok: true, text }, 200);
  } catch (error) {
    return sendNodeJson(res, { ok: false, error: error.message || "Proxy query failed" }, 500);
  }
}
