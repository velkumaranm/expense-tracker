import {
  loadLocalEnv,
  healthPayload,
  resolveViewerAccess,
  sendNodeJson,
} from "../../server/ai-runtime.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  const access = await resolveViewerAccess(req.headers.authorization || "");
  return sendNodeJson(
    res,
    healthPayload({ includeSensitive: access.isAdmin, viewerRole: access.viewerRole }),
    200
  );
}
