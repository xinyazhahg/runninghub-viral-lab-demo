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
      if (!user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED", message: "登录状态无效或已过期" });
      req.user = user;
      req.accessToken = token;
      return next();
    } catch (error) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED", message: `身份验证失败：${error.message}` });
    }
  };
}

module.exports = { createAuthService, createRequireAuth, extractBearerToken };
