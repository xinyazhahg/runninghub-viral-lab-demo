const crypto = require("crypto");
const path = require("path");
const { getSupabaseClient, getStorageBucket } = require("../lib/supabase");
const { normalizeMultipartFilename } = require("../lib/filenameEncoding");
const { appError } = require("../lib/errorCodes");
const { createLogger } = require("../lib/logger");
const logger = createLogger();

const PROJECT_STATUSES = new Set(["draft", "analyzing", "customizing", "completed", "error"]);
const REPLACEMENT_TYPES = new Set(["subject", "scene", "element"]);

function sanitizeFilename(filename) {
  const extension = path.extname(filename || "").toLowerCase();
  const allowedExtensions = new Set([".mp4", ".mov", ".webm", ".jpg", ".jpeg", ".png", ".webp"]);
  return `${crypto.randomUUID()}${allowedExtensions.has(extension) ? extension : ""}`;
}

function assertReplacementType(value) {
  if (!REPLACEMENT_TYPES.has(value)) {
    const error = new Error("replacementType 必须是 subject、scene 或 element");
    error.statusCode = 400;
    throw error;
  }
}

function createProjectAssetService({ client = getSupabaseClient(), bucket = getStorageBucket() } = {}) {
  async function signedAsset(asset) {
    if (!asset?.storage_path) return asset;
    const { data, error } = await client.storage.from(bucket).createSignedUrl(asset.storage_path, 3600);
    if (error) throw appError('SIGNED_URL_FAILED', `无法签发文件地址：${error.message}`, { retryable: true });
    return {
      ...asset,
      original_filename: normalizeMultipartFilename(asset.original_filename),
      public_url: data.signedUrl,
      signed_url: data.signedUrl,
    };
  }

  async function createProject({ name, userId, status = "draft" }) {
    if (!PROJECT_STATUSES.has(status)) throw new Error("项目状态无效");
    const normalizedName = normalizeMultipartFilename(name);
    const { data, error } = await client.from("projects")
      .insert({ name: String(normalizedName || "未命名项目").trim() || "未命名项目", user_id: userId, status }).select("*").single();
    if (error) throw error;
    return data;
  }

  async function getProject(projectId, userId) {
    let projectQuery = client.from("projects").select("*").eq("id", projectId);
    if (userId) projectQuery = projectQuery.eq("user_id", userId);
    const { data: project, error: projectError } = await projectQuery.maybeSingle();
    if (projectError) throw projectError;
    if (!project) return null;
    const { data: assets, error: assetsError } = await client.from("assets")
      .select("*").eq("project_id", projectId).eq("status", "active")
      .order("created_at", { ascending: true });
    if (assetsError) throw assetsError;
    return {
      ...project,
      name: normalizeMultipartFilename(project.name),
      assets: await Promise.all((assets || []).map(signedAsset)),
    };
  }

  async function uploadAsset({ projectId, userId, file, assetType, replacementType = null, sourceTaskId = null }) {
    if (!file?.buffer?.length) throw new Error("上传文件为空");
    if (assetType === "replacement_image") assertReplacementType(replacementType);
    if (assetType === "result_video" && sourceTaskId) {
      const { data: existing, error: existingError } = await client.from("assets").select("*").eq("source_task_id", sourceTaskId).eq("asset_type", "result_video").maybeSingle();
      if (existingError) throw existingError;
      if (existing) return { ...await signedAsset(existing), idempotent: true };
    }
    const originalFilename = normalizeMultipartFilename(file.originalname);
    const storagePath = `${projectId}/${assetType}/${sanitizeFilename(originalFilename)}`;
    const storage = client.storage.from(bucket);
    const { error: uploadError } = await storage.upload(storagePath, file.buffer, {
      contentType: file.mimetype, upsert: false,
    });
    if (uploadError) throw uploadError;
    const record = {
      project_id: projectId, user_id: userId, asset_type: assetType, replacement_type: replacementType,
      original_filename: originalFilename, mime_type: file.mimetype, file_size: file.size,
      storage_path: storagePath, public_url: null, status: "active", source_task_id: sourceTaskId,
    };
    const { data, error: insertError } = await client.from("assets").insert(record).select("*").single();
    if (insertError) {
      await storage.remove([storagePath]).catch(() => {});
      if (insertError.code === '23505' && sourceTaskId) {
        const { data: existing, error: existingError } = await client.from("assets").select("*").eq("source_task_id", sourceTaskId).eq("asset_type", "result_video").single();
        if (!existingError && existing) return { ...await signedAsset(existing), idempotent: true };
      }
      throw insertError;
    }
    return signedAsset(data);
  }

  async function setOriginalAsset(projectId, assetId, userId) {
    let query = client.from("projects")
      .update({ original_asset_id: assetId, status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  }

  async function deleteAsset(projectId, assetId, userId) {
    let query = client.from("assets").select("*").eq("id", assetId).eq("project_id", projectId);
    if (userId) query = query.eq("user_id", userId);
    const { data: asset, error: findError } = await query.maybeSingle();
    if (findError) throw findError;
    if (!asset) return false;
    const { error: storageError } = await client.storage.from(bucket).remove([asset.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await client.from("assets").delete().eq("id", assetId);
    if (deleteError) throw deleteError;
    return true;
  }

  async function listProjects(userId) {
    const { data: projects, error } = await client.from("projects").select("*")
      .eq("user_id", userId).order("updated_at", { ascending: false });
    if (error) throw error;
    if (!projects?.length) return [];

    // 按用户一次性读取列表所需数据，避免每个项目分别发起 Asset/Result/Task 查询。
    const projectIds = projects.map((project) => project.id);
    const [
      { data: assets, error: assetError },
      { data: results, error: resultError },
      { data: tasks, error: taskError },
    ] = await Promise.all([
      client.from("assets").select("id,project_id,storage_path").in("project_id", projectIds)
        .eq("user_id", userId).eq("status", "active"),
      client.from("results").select("project_id,version,video_url").in("project_id", projectIds)
        .eq("user_id", userId).order("version", { ascending: false }),
      client.from("tasks").select("project_id,status,stage,created_at").in("project_id", projectIds)
        .eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    if (assetError) throw assetError;
    if (resultError) throw resultError;
    if (taskError) throw taskError;

    const assetsByProject = new Map();
    const resultsByProject = new Map();
    const latestTaskByProject = new Map();
    for (const asset of assets || []) {
      if (!assetsByProject.has(asset.project_id)) assetsByProject.set(asset.project_id, []);
      assetsByProject.get(asset.project_id).push(asset);
    }
    for (const result of results || []) {
      if (!resultsByProject.has(result.project_id)) resultsByProject.set(result.project_id, []);
      resultsByProject.get(result.project_id).push(result);
    }
    for (const task of tasks || []) {
      if (!latestTaskByProject.has(task.project_id)) latestTaskByProject.set(task.project_id, task);
    }

    return Promise.all(projects.map(async (project) => {
      const projectAssets = assetsByProject.get(project.id) || [];
      const projectResults = resultsByProject.get(project.id) || [];
      const latestTask = latestTaskByProject.get(project.id);
      const original = projectAssets.find((asset) => asset.id === project.original_asset_id);
      const latestResult = projectResults[0];
      let latestVideoUrl = "";
      if (latestResult?.video_url) {
        if (/^https?:\/\//i.test(latestResult.video_url)) latestVideoUrl = latestResult.video_url;
        else latestVideoUrl = (await signedAsset({ storage_path: latestResult.video_url })).signed_url;
      }
      let originalVideoUrl = "";
      // 结果封面存在时不再为原视频重复签发 URL。
      if (!latestVideoUrl && original?.storage_path) {
        originalVideoUrl = (await signedAsset(original)).signed_url;
      }
      return {
        ...project,
        name: normalizeMultipartFilename(project.name),
        status: ["created", "queued", "analyzing", "generating"].includes(latestTask?.status)
          ? latestTask.status
          : projectResults.length ? "completed" : latestTask?.status || project.status,
        original_video_url: originalVideoUrl,
        latest_result_url: latestVideoUrl,
        version_count: projectResults.length,
      };
    }));
  }

  async function deleteProject(projectId, userId) {
    const { data: project, error: projectError } = await client.from("projects").select("id")
      .eq("id", projectId).eq("user_id", userId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return { deleted: false, warnings: [] };
    const warnings = [];
    const { data: allAssets, error: assetError } = await client.from("assets").select("storage_path")
      .eq("project_id", projectId).eq("user_id", userId);
    if (assetError) throw assetError;
    if (allAssets?.length) {
      const { error } = await client.storage.from(bucket).remove(allAssets.map((asset) => asset.storage_path));
      if (error) {
        warnings.push(`对象存储清理失败：${error.message}`);
        logger.error({ userId, projectId, action: 'storage.project_cleanup', status: 'failed', errorCode: 'STORAGE_ERROR', errorMessage: error.message });
        for (const asset of allAssets) {
          await client.from('storage_audits').insert({ audit_type: 'cleanup_failed', storage_path: asset.storage_path, details: { project_id: projectId } }).then(() => {}, () => {});
        }
      }
    }
    let deleteQuery = client.from("projects").delete().eq("id", projectId);
    if (userId) deleteQuery = deleteQuery.eq("user_id", userId);
    const { error } = await deleteQuery;
    if (error) throw error;
    return { deleted: true, warnings };
  }

  return { createProject, getProject, listProjects, uploadAsset, setOriginalAsset, deleteAsset, deleteProject, signedAsset };
}

module.exports = { createProjectAssetService, assertReplacementType, sanitizeFilename };
