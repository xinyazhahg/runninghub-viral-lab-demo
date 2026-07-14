const { getSupabaseClient } = require('../lib/supabase');

function createAdminService({ client = getSupabaseClient() } = {}) {
  async function getAdmin(userId) {
    const { data, error } = await client.from('admin_users').select('user_id,role,status').eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (error) throw error;
    return data;
  }
  return { getAdmin };
}

function createRequireAdmin({ serviceFactory = () => createAdminService() } = {}) {
  return async function requireAdmin(req, res, next) {
    try {
      const admin = await serviceFactory().getAdmin(req.user.id);
      if (!admin) return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: '仅管理员可访问运营后台' });
      req.admin = admin;
      return next();
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'ADMIN_CHECK_FAILED', message: `管理员权限验证失败：${error.message}` });
    }
  };
}

module.exports = { createAdminService, createRequireAdmin };
