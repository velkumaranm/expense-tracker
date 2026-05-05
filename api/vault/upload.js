import { sendNodeJson } from "../../server/ai-runtime.mjs";
import { uploadVaultAttachment } from "../../server/vault-runtime.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendNodeJson(res, {}, 204);
  if (req.method !== "POST") return sendNodeJson(res, { ok: false, error: "Method not allowed" }, 405);
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const attachment = await uploadVaultAttachment({
      authHeader: req.headers.authorization || "",
      userId: body.userId || "",
      docId: body.docId || "",
      attachmentId: body.attachmentId || "",
      fileName: body.fileName || "",
      contentType: body.contentType || "",
      dataUrl: body.dataUrl || "",
    });
    return sendNodeJson(res, { ok: true, attachment }, 200);
  } catch (error) {
    return sendNodeJson(res, { ok: false, error: error.message || "Vault upload failed" }, 500);
  }
}
