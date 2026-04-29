import {
  loadLocalEnv,
  healthPayload,
  sendNodeJson,
} from "../../server/ai-runtime.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  return sendNodeJson(res, healthPayload(), 200);
}
