const crypto = require('crypto');
const { getSupabaseClient, getStorageBucket } = require('../lib/supabase');

function createStabilityService({ client = getSupabaseClient(), bucket = getStorageBucket() } = {}) {
  async function checkDatabase() {
    const started = Date.now();
    const { error } = await client.from('projects').select('id', { head: true, count: 'exact' }).limit(1);
    return { ok: !error, durationMs: Date.now() - started, error: error?.message || null };
  }
  async function checkStorage() {
    const started = Date.now();
    const { error } = await client.storage.from(bucket).list('', { limit: 1 });
    return { ok: !error, durationMs: Date.now() - started, error: error?.message || null };
  }
  async function workerState() {
    const { data, error } = await client.from('worker_status').select('*').eq('worker_name', 'task-recovery').maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: !data || data.status !== 'failed', data };
  }
  async function setWorkerState(patch) {
    const { error } = await client.from('worker_status').upsert({ worker_name: 'task-recovery', ...patch }, { onConflict: 'worker_name' });
    if (error) throw error;
  }
  async function recentStatus() {
    const [{ data: logs }, { data: audits }, { data: tasks }] = await Promise.all([
      client.from('system_logs').select('*').in('level', ['warn','error']).order('timestamp', { ascending: false }).limit(30),
      client.from('storage_audits').select('*', { count: 'exact' }).eq('status', 'open').order('detected_at', { ascending: false }).limit(30),
      client.from('tasks').select('id,project_id,status,stage,retry_count,error_code,error_message,created_at,updated_at').in('status', ['failed','timeout']).order('updated_at', { ascending: false }).limit(30),
    ]);
    return { logs: logs || [], storageAudits: audits || [], tasks: tasks || [] };
  }
  async function scanStorage() {
    const { data: assets, error } = await client.from('assets').select('id,storage_path,status').neq('status', 'deleted');
    if (error) throw error;
    const dbPaths = new Map((assets || []).map((asset) => [asset.storage_path, asset]));
    const storagePaths = new Set();
    const storage = client.storage.from(bucket);
    const { data: projects, error: rootError } = await storage.list('', { limit: 1000 });
    if (rootError) throw rootError;
    for (const project of projects || []) {
      if (!project.name) continue;
      const { data: types, error: typeError } = await storage.list(project.name, { limit: 100 });
      if (typeError) throw typeError;
      for (const type of types || []) {
        const prefix = `${project.name}/${type.name}`;
        const { data: files, error: fileError } = await storage.list(prefix, { limit: 1000 });
        if (fileError) throw fileError;
        for (const file of files || []) if (file.name) storagePaths.add(`${prefix}/${file.name}`);
      }
    }
    const findings = [
      ...[...dbPaths].filter(([path]) => !storagePaths.has(path)).map(([path, asset]) => ({ audit_type: 'missing_file', asset_id: asset.id, storage_path: path })),
      ...[...storagePaths].filter((path) => !dbPaths.has(path)).map((path) => ({ audit_type: 'orphan_file', asset_id: null, storage_path: path })),
    ];
    for (const finding of findings) {
      const { data: existing } = await client.from('storage_audits').select('id').eq('audit_type', finding.audit_type).eq('storage_path', finding.storage_path).eq('status', 'open').maybeSingle();
      if (!existing) {
        const { error: insertError } = await client.from('storage_audits').insert(finding);
        if (insertError && insertError.code !== '23505') throw insertError;
      }
    }
    return { scanId: crypto.randomUUID(), databaseFiles: dbPaths.size, storageFiles: storagePaths.size, missing: findings.filter((x) => x.audit_type === 'missing_file').length, orphaned: findings.filter((x) => x.audit_type === 'orphan_file').length };
  }
  async function resolveStorageAudit(auditId, action) {
    const { data: audit, error } = await client.from('storage_audits').select('*').eq('id', auditId).eq('status', 'open').maybeSingle();
    if (error) throw error;
    if (!audit) return null;
    if (action === 'delete_orphan') {
      if (audit.audit_type !== 'orphan_file') throw new Error('只有孤儿文件可以直接清理');
      const { error: removeError } = await client.storage.from(bucket).remove([audit.storage_path]);
      if (removeError) throw removeError;
    } else if (action === 'mark_asset_failed') {
      if (!audit.asset_id) throw new Error('该异常没有关联Asset');
      const { error: assetError } = await client.from('assets').update({ status: 'failed' }).eq('id', audit.asset_id);
      if (assetError) throw assetError;
    } else if (action !== 'ignore') throw new Error('不支持的Storage异常处理动作');
    const status = action === 'ignore' ? 'ignored' : 'resolved';
    const { data: resolved, error: updateError } = await client.from('storage_audits').update({ status, resolved_at: new Date().toISOString(), details: { ...(audit.details || {}), resolution_action: action } }).eq('id', audit.id).select('*').single();
    if (updateError) throw updateError;
    return resolved;
  }
  return { checkDatabase, checkStorage, workerState, setWorkerState, recentStatus, scanStorage, resolveStorageAudit };
}

module.exports = { createStabilityService };
