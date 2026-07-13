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
  async function createProject({ name, status = "draft" }) {
    if (!PROJECT_STATUSES.has(status)) throw new Error("项目状态无效");
    const { data, error } = await client.from("projects")
      .insert({ name: String(name || "未命名项目").trim() || "未命名项目", status }).select("*").single();
    if (error) throw error;
    return data;
  }

  async function getProject(projectId) {
    const { data: project, error: projectError } = await client.from("projects")
      .select("*").eq("id", projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return null;
    const { data: assets, error: assetsError } = await client.from("assets")
      .select("*").eq("project_id", projectId).eq("status", "active")
      .order("created_at", { ascending: true });
    if (assetsError) throw assetsError;
    return { ...project, assets: assets || [] };
  }

  async function uploadAsset({ projectId, file, assetType, replacementType = null }) {
    if (!file?.buffer?.length) throw new Error("上传文件为空");
    if (assetType === "replacement_image") assertReplacementType(replacementType);
    const storagePath = `${projectId}/${assetType}/${sanitizeFilename(file.originalname)}`;
    const storage = client.storage.from(bucket);
    const { error: uploadError } = await storage.upload(storagePath, file.buffer, {
      contentType: file.mimetype, upsert: false,
    });
    if (uploadError) throw uploadError;
    const publicUrl = storage.getPublicUrl(storagePath).data.publicUrl;
    const record = {
      project_id: projectId, asset_type: assetType, replacement_type: replacementType,
      original_filename: file.originalname, mime_type: file.mimetype, file_size: file.size,
      storage_path: storagePath, public_url: publicUrl, status: "active",
    };
    const { data, error: insertError } = await client.from("assets").insert(record).select("*").single();
    if (insertError) {
      await storage.remove([storagePath]).catch(() => {});
      throw insertError;
    }
    return data;
  }

  async function setOriginalAsset(projectId, assetId) {
    const { data, error } = await client.from("projects")
      .update({ original_asset_id: assetId, status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", projectId).select("*").single();
    if (error) throw error;
    return data;
  }

  async function deleteAsset(projectId, assetId) {
    const { data: asset, error: findError } = await client.from("assets")
      .select("*").eq("id", assetId).eq("project_id", projectId).maybeSingle();
    if (findError) throw findError;
    if (!asset) return false;
    const { error: storageError } = await client.storage.from(bucket).remove([asset.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await client.from("assets").delete().eq("id", assetId);
    if (deleteError) throw deleteError;
    return true;
  }

  async function deleteProject(projectId) {
    const project = await getProject(projectId);
    if (project?.assets?.length) {
      await client.storage.from(bucket).remove(project.assets.map((asset) => asset.storage_path)).catch(() => {});
    }
    await client.from("projects").delete().eq("id", projectId);
  }

  return { createProject, getProject, uploadAsset, setOriginalAsset, deleteAsset, deleteProject };
}

module.exports = { createProjectAssetService, assertReplacementType, sanitizeFilename };
