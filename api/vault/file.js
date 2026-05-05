import { sendNodeJson } from "../../server/ai-runtime.mjs";
import {
  deleteVaultAttachment,
  fetchVaultAttachment,
} from "../../server/vault-runtime.mjs";

function withCors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
}

export default async function handler(req, res) {
  withCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    try {
      const payload = await fetchVaultAttachment({
        authHeader: req.headers.authorization || "",
        userId: String(req.query?.userId || ""),
        pathname: String(req.query?.pathname || ""),
      });
      res.setHeader("content-type", payload.blob?.contentType || payload.headers.get("content-type") || "application/octet-stream");
      res.setHeader("content-disposition", payload.headers.get("content-disposition") || "inline");
      return res.status(200).send(payload.buffer);
    } catch (error) {
      return sendNodeJson(res, { ok: false, error: error.message || "Vault file could not be opened" }, 500);
    }
  }

  if (req.method === "DELETE") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      await deleteVaultAttachment({
        authHeader: req.headers.authorization || "",
        userId: body.userId || "",
        pathname: body.pathname || "",
      });
      return sendNodeJson(res, { ok: true }, 200);
    } catch (error) {
      return sendNodeJson(res, { ok: false, error: error.message || "Vault file could not be deleted" }, 500);
    }
  }

  return sendNodeJson(res, { ok: false, error: "Method not allowed" }, 405);
}
