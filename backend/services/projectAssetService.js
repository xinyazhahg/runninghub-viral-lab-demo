const crypto = require("crypto");
const path = require("path");
const { getSupabaseClient, getStorageBucket } = require("../lib/supabase");

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
    if (error) throw error;
    return { ...asset, public_url: data.signedUrl, signed_url: data.signedUrl };
  }

  async function createProject({ name, userId, status = "draft" }) {
    if (!PROJECT_STATUSES.has(status)) throw new Error("项目状态无效");
    const { data, error } = await client.from("projects")
      .insert({ name: String(name || "未命名项目").trim() || "未命名项目", user_id: userId, status }).select("*").single();
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
    return { ...project, assets: await Promise.all((assets || []).map(signedAsset)) };
  }

  async function uploadAsset({ projectId, userId, file, assetType, replacementType = null }) {
    if (!file?.buffer?.length) throw new Error("上传文件为空");
    if (assetType === "replacement_image") assertReplacementType(replacementType);
    const storagePath = `${projectId}/${assetType}/${sanitizeFilename(file.originalname)}`;
    const storage = client.storage.from(bucket);
    const { error: uploadError } = await storage.upload(storagePath, file.buffer, {
      contentType: file.mimetype, upsert: false,
    });
    if (uploadError) throw uploadError;
    const record = {
      project_id: projectId, user_id: userId, asset_type: assetType, replacement_type: replacementType,
      original_filename: file.originalname, mime_type: file.mimetype, file_size: file.size,
      storage_path: storagePath, public_url: null, status: "active",
    };
    const { data, error: insertError } = await client.from("assets").insert(record).select("*").single();
    if (insertError) {
      await storage.remove([storagePath]).catch(() => {});
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
    return Promise.all((projects || []).map(async (project) => {
      const [
        { data: assets, error: assetError },
        { data: results, error: resultError, count: resultCount },
        { data: tasks, error: taskError },
      ] = await Promise.all([
        client.from("assets").select("*").eq("project_id", project.id).eq("status", "active").order("created_at", { ascending: true }),
        client.from("results").select("*", { count: "exact" }).eq("project_id", project.id)
          .order("version", { ascending: false }).limit(1),
        client.from("tasks").select("status,stage").eq("project_id", project.id).order("created_at", { ascending: false }).limit(1),
      ]);
      if (assetError) throw assetError;
      if (resultError) throw resultError;
      if (taskError) throw taskError;
      const signedAssets = await Promise.all((assets || []).map(signedAsset));
      const original = signedAssets.find((asset) => asset.id === project.original_asset_id);
      const latestResult = results?.[0];
      let latestVideoUrl = "";
      if (latestResult?.video_url) {
        if (/^https?:\/\//i.test(latestResult.video_url)) latestVideoUrl = latestResult.video_url;
        else latestVideoUrl = (await signedAsset({ storage_path: latestResult.video_url })).signed_url;
      }
      return {
        ...project,
        status: ["created", "queued", "analyzing", "generating"].includes(tasks?.[0]?.status)
          ? tasks[0].status
          : results?.length ? "completed" : tasks?.[0]?.status || project.status,
        original_video_url: original?.signed_url || "",
        latest_result_url: latestVideoUrl,
        version_count: Number(resultCount || 0),
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
        console.error("删除 Project 时对象存储清理失败：", projectId, error);
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
