const { createClient } = require("@supabase/supabase-js");

let client;

function getSupabaseClient() {
  if (client) return client;
  const url = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) {
    const error = new Error("后端未配置 Supabase 持久化环境变量");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function getStorageBucket() {
  return String(process.env.SUPABASE_STORAGE_BUCKET || "viral-lab-assets").trim();
}

module.exports = { getSupabaseClient, getStorageBucket };
