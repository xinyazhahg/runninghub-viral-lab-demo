const { getSupabaseClient } = require("../lib/supabase");

function extractBearerToken(header = "") {
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function createAuthService({ client = getSupabaseClient() } = {}) {
  async function getUser(accessToken) {
    if (!accessToken) return null;
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return data.user;
  }
  return { getUser };
}

function createRequireAuth({ serviceFactory = () => createAuthService() } = {}) {
  return async function requireAuth(req, res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      const user = await serviceFactory().getUser(token);
      if (!token) return res.status(401).json({ ok: false, error: "AUTH_REQUIRED", code: "AUTH_REQUIRED", message: "请先登录后继续操作", requestId: res.locals?.requestId });
      if (!user) return res.status(401).json({ ok: false, error: "AUTH_INVALID", code: "AUTH_INVALID", message: "登录状态无效或已过期", requestId: res.locals?.requestId });
      req.user = user;
      req.accessToken = token;
      return next();
    } catch (error) {
      return res.status(401).json({ ok: false, error: "AUTH_INVALID", code: "AUTH_INVALID", message: "身份验证失败，请重新登录", requestId: res.locals?.requestId });
    }
  };
}

module.exports = { createAuthService, createRequireAuth, extractBearerToken };
