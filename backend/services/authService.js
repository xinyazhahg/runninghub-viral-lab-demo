const { getSupabaseClient } = require("../lib/supabase");
const { createLogger } = require('../lib/logger');

const logger = createLogger();

function extractBearerToken(header = "") {
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function createAuthService({ client = getSupabaseClient() } = {}) {
  async function verifyAccessToken(accessToken) {
    if (!accessToken) return { user: null, error: null };
    const { data, error } = await client.auth.getUser(accessToken);
    return { user: error ? null : data?.user || null, error: error || null };
  }

  async function getUser(accessToken) {
    return (await verifyAccessToken(accessToken)).user;
  }
  return { getUser, verifyAccessToken };
}

function isExpiredAuthError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return status === 401 || status === 403 || /jwt.*expired|invalid.*jwt|user.*not.*found|refresh.*token/i.test(text);
}

function createRequireAuth({ serviceFactory = () => createAuthService() } = {}) {
  return async function requireAuth(req, res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) return res.status(401).json({ ok: false, error: "AUTH_REQUIRED", code: "AUTH_REQUIRED", message: "请先登录后继续操作", requestId: res.locals?.requestId });
      const service = serviceFactory();
      const verification = typeof service.verifyAccessToken === 'function'
        ? await service.verifyAccessToken(token)
        : { user: await service.getUser(token), error: null };
      if (verification.error && isExpiredAuthError(verification.error)) {
        logger.warn({
          requestId: res.locals?.requestId, action: 'auth.upstream_rejected', status: 'failed',
          errorCode: 'AUTH_EXPIRED', errorMessage: verification.error.message,
          metadata: { upstreamStatus: Number(verification.error.status || verification.error.statusCode || 0) || null },
        });
        return res.status(401).json({ ok: false, error: "AUTH_EXPIRED", code: "AUTH_EXPIRED", message: "登录已过期，请重新登录", requestId: res.locals?.requestId });
      }
      if (!verification.user) return res.status(401).json({ ok: false, error: "AUTH_INVALID", code: "AUTH_INVALID", message: "登录状态无效或已过期", requestId: res.locals?.requestId });
      req.user = verification.user;
      req.accessToken = token;
      return next();
    } catch (error) {
      const code = isExpiredAuthError(error) ? 'AUTH_EXPIRED' : 'AUTH_INVALID';
      return res.status(401).json({ ok: false, error: code, code, message: code === 'AUTH_EXPIRED' ? "登录已过期，请重新登录" : "身份验证失败，请重新登录", requestId: res.locals?.requestId });
    }
  };
}

module.exports = { createAuthService, createRequireAuth, extractBearerToken, isExpiredAuthError };
