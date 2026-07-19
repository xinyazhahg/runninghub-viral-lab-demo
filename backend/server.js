const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const { createProjectAssetService } = require("./services/projectAssetService");
const { createTaskResultService } = require("./services/taskResultService");
const { createPromptModelService } = require("./services/promptModelService");
const { createDirectorAgentService } = require("./services/directorAgentService");
const { createPromptGeneratorService } = require("./services/promptGeneratorService");
const { createBillingService } = require("./services/billingService");
const { createAnalyticsService } = require("./services/analyticsService");
const { createAdminService, createRequireAdmin } = require("./services/adminService");
const { createRequireAuth } = require("./services/authService");
const { buildFinalGenerationConfig, buildPersistedGenerationConfig, buildGenerationTaskInput } = require("./lib/generationConfig");
const { normalizeMultipartFilename } = require("./lib/filenameEncoding");
const { evaluateGenerationFinalization } = require("./lib/resultFinalization");
const {
  selectTemplateType, buildPromptSnapshot, buildConfirmedPromptSnapshot,
  buildSeedancePrompt, promptGenerationDuration, validatePromptImageMappings,
} = require("./lib/promptBuilder");
const { buildPromptAssetBindings, orderAssetsForSeedance } = require("./lib/promptAssetBindings");
const {
  replacementPurpose, physicalAssetType, assetPurpose,
  isReplacementAsset, isReferenceAsset, normalizePhysicalMimeType, normalizeReferencePurpose,
} = require('./lib/assetTypes');
const { validateModelSelection, validatePromptModelSelection } = require("./lib/modelConfig");
const { resolveSourceVideoDuration } = require("./lib/promptAgentJson");
const { calculateCreditCost, failureChargeRatio, numeric } = require("./lib/billingRules");
const { ERROR_DEFINITIONS, appError, normalizeError } = require("./lib/errorCodes");
const { createLogger } = require("./lib/logger");
const { createStabilityService } = require("./services/stabilityService");
const { createCoreSkillService } = require("./services/coreSkillService");
const { deliverGeneratedResult } = require("./lib/resultDelivery");
const { refineBreakdown } = require("./lib/breakdownRefiner");
const { BREAKDOWN_VERSION: FINE_BREAKDOWN_VERSION, legacyToFineBreakdown, normalizeFineBreakdown } = require('./lib/fineVideoBreakdown');
const {
  DEFAULT_RUNNINGHUB_GEMINI_MODEL, callRunningHubGeminiVideoUnderstanding,
  normalizeUnderstandingResponse,
} = require('./services/videoUnderstandingService');
const {
  SEEDANCE_2_MODEL_ID, SEEDANCE_2_ENDPOINT, quoteSeedanceProviderCost,
  sanitizeSeedancePayload, buildSeedancePayload, seedanceSubmissionError, selectSeedanceVideoResult,
} = require("./lib/seedance2");
const FFMPEG_PATH = process.env.FFMPEG_PATH || require("ffmpeg-static");
const FFPROBE_PATH = process.env.FFPROBE_PATH || require("ffprobe-static").path;
for (const binaryPath of [FFMPEG_PATH, FFPROBE_PATH]) {
  try {
    if (binaryPath && fs.existsSync(binaryPath)) fs.chmodSync(binaryPath, 0o755);
  } catch (error) {
    console.warn("媒体工具权限初始化失败：", binaryPath, error.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createLogger();
const SERVER_STARTED_AT = Date.now();
const RECOVERY_WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://viral-lab-frontend.onrender.com",
];
const configuredOrigins = [
  process.env.FRONTEND_ORIGIN,
  ...(process.env.CORS_ORIGINS || "").split(","),
]
  .filter(Boolean)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);

function normalizeOrigin(origin) {
  return typeof origin === "string" ? origin.trim().replace(/\/$/, "") : "";
}

function isOriginAllowed(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  return !normalizedOrigin || allowedOrigins.has(normalizedOrigin);
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Idempotency-Key"],
  optionsSuccessStatus: 204,
};

function applyCorsHeaders(req, res) {
  const origin = normalizeOrigin(req.headers.origin);
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Content-Type,Authorization,X-Request-ID,X-Idempotency-Key"
  );
  return true;
}

// uploads 目录：优先用环境变量，默认用 backend 目录下的 uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
function normalizeUploadedFile(req, file, callback) {
  file.originalname = normalizeMultipartFilename(file.originalname);
  callback(null, true);
}

const upload = multer({ dest: UPLOADS_DIR, fileFilter: normalizeUploadedFile });
const ORIGINAL_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
const REPLACEMENT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const REFERENCE_ASSET_MAX_BYTES = 500 * 1024 * 1024;

function runSingleUpload(fieldName, maxBytes, allowedMimePrefix) {
  const allowedMimePrefixes = (Array.isArray(allowedMimePrefix) ? allowedMimePrefix : [allowedMimePrefix]).filter(Boolean);
  const middleware = multer({
    storage: multer.memoryStorage(), limits: { fileSize: maxBytes }, fileFilter: normalizeUploadedFile,
  }).single(fieldName);
  return (req, res, next) => middleware(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return sendApiError(res, 413, 'FILE_TOO_LARGE', `文件大小不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
    if (error) return sendApiError(res, 500, 'ASSET_UPLOAD_FAILED', `文件上传失败：${error.message}`);
    if (!req.file) return sendApiError(res, 400, "没有收到上传文件");
    const uploadedMimeType = String(req.file.mimetype || '').split(';')[0].trim().toLowerCase();
    const genericBinaryMime = !uploadedMimeType || ['application/octet-stream', 'binary/octet-stream', 'application/mp4'].includes(uploadedMimeType);
    logger.info({
      requestId: req.requestId, userId: req.user?.id, projectId: req.params?.projectId,
      action: 'asset_upload.multipart_received', status: 'received',
      metadata: {
        fieldName: req.file.fieldname, originalname: req.file.originalname,
        mimetype: uploadedMimeType, contentType: req.headers['content-type'],
        assetType: req.body?.assetType || req.body?.referenceType || null,
        purpose: req.body?.purpose || null, formFields: Object.keys(req.body || {}),
        allowedMimePrefixes,
      },
    });
    if (allowedMimePrefixes.length && !genericBinaryMime && !allowedMimePrefixes.some((prefix) => uploadedMimeType.startsWith(prefix))) {
      logger.warn({
        requestId: req.requestId, userId: req.user?.id, projectId: req.params?.projectId,
        action: 'asset_upload.mime_rejected', status: 'failed', errorCode: 'FILE_TYPE_NOT_SUPPORTED',
        metadata: { fieldName: req.file.fieldname, originalname: req.file.originalname, mimetype: uploadedMimeType, allowedMimePrefixes },
      });
      return sendApiError(res, 415, 'FILE_TYPE_NOT_SUPPORTED', '仅支持指定的图片、视频或音频文件');
    }
    if (!req.file.size || req.file.size > maxBytes) {
      return sendApiError(res, 413, 'FILE_TOO_LARGE', `文件大小不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
    }
    return next();
  });
}

function projectAssetService() {
  return createProjectAssetService();
}

function taskResultService() {
  return createTaskResultService();
}

function promptModelService() {
  return createPromptModelService();
}

function directorAgentService() {
  return createDirectorAgentService({ logger });
}

function promptGeneratorService() {
  return createPromptGeneratorService({ logger });
}

function billingService() {
  return createBillingService();
}

function analyticsService() {
  return createAnalyticsService();
}

function coreSkillService() {
  return createCoreSkillService({ logger });
}

function recordAnalytics(event) {
  analyticsService().record(event).catch((error) => console.warn("埋点写入失败：", event.eventName, error.message));
}

function storagePathFromSignedUrl(value) {
  if (!/^https?:\/\//i.test(value || '')) return value || '';
  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/sign/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return '';
    const bucketAndPath = url.pathname.slice(markerIndex + marker.length).split('/');
    if (bucketAndPath.length < 2) return '';
    return bucketAndPath.slice(1).map(decodeURIComponent).join('/');
  } catch {
    return '';
  }
}

async function materializeResult(result) {
  if (!result?.video_url) return result;
  const storagePath = storagePathFromSignedUrl(result.video_url);
  // 外部历史地址保持兼容；Supabase 私有签名地址必须按稳定路径重新签发。
  if (!storagePath && /^https?:\/\//i.test(result.video_url)) return result;
  const asset = await projectAssetService().signedAsset({ storage_path: storagePath });
  return { ...result, storage_path: storagePath, signed_url: asset.signed_url, video_url: asset.signed_url };
}

// 旧版前端静态托管：指向同级 react-old 目录
const LEGACY_FRONTEND_DIR = process.env.LEGACY_FRONTEND_DIR || path.join(__dirname, "..", "react-old");

app.use((req, res, next) => {
  if (!applyCorsHeaders(req, res)) {
    return res.status(403).json({
      ok: false,
      error: `CORS origin not allowed: ${req.headers.origin}`,
      message: `CORS origin not allowed: ${req.headers.origin}`,
    });
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});
app.use(cors(corsOptions));
app.use((err, req, res, next) => {
  console.error("CORS 中间件错误：", err);
  if (res.headersSent) return next(err);
  if (!applyCorsHeaders(req, res)) {
    return res.status(403).json({
      ok: false,
      error: `CORS origin not allowed: ${req.headers.origin}`,
      message: `CORS origin not allowed: ${req.headers.origin}`,
    });
  }
  return sendApiError(res, 500, "CORS 配置异常");
});
app.use(express.json());
app.use((req, res, next) => {
  const supplied = String(req.headers['x-request-id'] || '').trim();
  const requestId = /^[A-Za-z0-9_.:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.locals.requestId = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  const started = Date.now();
  req.requestStartedAt = started;
  res.on('finish', () => logger.info({
    requestId, userId: req.user?.id, action: `${req.method} ${req.path}`,
    durationMs: Date.now() - started, status: String(res.statusCode), metadata: {},
  }));
  next();
});
app.use(express.static(LEGACY_FRONTEND_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/generated", express.static("/tmp/openclaw/rh-output"));
app.use("/assets", express.static(path.join(LEGACY_FRONTEND_DIR, "assets")));

app.get("/api/live", (req, res) => res.json({ ok: true, status: 'live', uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000), requestId: req.requestId }));

app.get("/api/ready", async (req, res) => {
  const stability = createStabilityService();
  const [database, storage, worker] = await Promise.all([stability.checkDatabase(), stability.checkStorage(), stability.workerState()]);
  const ok = database.ok && storage.ok && worker.ok;
  res.status(ok ? 200 : 503).json({ ok, status: ok ? 'ready' : 'not_ready', checks: { database, storage, recoveryWorker: worker, modelService: { ok: !!process.env.RUNNINGHUB_API_KEY, configured: !!process.env.RUNNINGHUB_API_KEY } }, requestId: req.requestId });
});

app.get("/api/health", async (req, res) => {
  const stability = createStabilityService();
  const [database, storage, worker] = await Promise.all([stability.checkDatabase(), stability.checkStorage(), stability.workerState()]);
  res.json({
    ok: true,
    service: "viral-lab-backend",
    time: new Date().toISOString(),
    requestId: req.requestId,
    checks: { process: { ok: true }, database, storage, recoveryWorker: worker, modelService: { ok: !!process.env.RUNNINGHUB_API_KEY } },
  });
});

app.use("/api", createRequireAuth());

const rateWindows = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  const key = `${req.user.id}:${req.path.startsWith('/projects/original-video') || req.path.includes('/assets/replacement') ? 'upload' : 'general'}`;
  const limit = key.endsWith(':upload') ? 20 : 180;
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) rateWindows.set(key, { count: 1, resetAt: now + 60000 });
  else if (++current.count > limit) return sendApiError(res, 429, 'MODEL_RATE_LIMITED', '请求过于频繁，请稍后重试');
  return next();
});

app.get("/api/me", async (req, res) => {
  const admin = await createAdminService().getAdmin(req.user.id).catch(() => null);
  res.json({ ok: true, user: { id: req.user.id, email: req.user.email || "", createdAt: req.user.created_at, isAdmin: !!admin, adminRole: admin?.role || null } });
});

app.post("/api/analytics/events", async (req, res) => {
  try {
    const outcome = await analyticsService().recordBatch(req.user.id, req.body?.events);
    return res.status(202).json({ ok: true, ...outcome });
  } catch (error) {
    return sendApiError(res, 500, `埋点写入失败：${error.message}`);
  }
});

const requireAdmin = createRequireAdmin();
app.get("/api/admin/analytics/overview", requireAdmin, async (req, res) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 86400000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return sendApiError(res, 400, "时间范围无效");
    const filters = { from: from.toISOString(), to: to.toISOString(), modelId: String(req.query.modelId || ''), taskStatus: String(req.query.taskStatus || '') };
    const data = await analyticsService().overview(filters);
    return res.json({ ok: true, data, filters });
  } catch (error) {
    return sendApiError(res, 500, `读取运营指标失败：${error.message}`);
  }
});

app.get("/api/admin/analytics/tasks", requireAdmin, async (req, res) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 86400000);
    const data = await analyticsService().listTasks({
      from: from.toISOString(), to: to.toISOString(), modelId: String(req.query.modelId || ''),
      taskStatus: String(req.query.taskStatus || ''), page: req.query.page, pageSize: req.query.pageSize,
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendApiError(res, 500, `读取任务明细失败：${error.message}`);
  }
});

app.get('/api/admin/stability/status', requireAdmin, async (req, res) => {
  try {
    const stability = createStabilityService();
    const [data, database, storage, worker] = await Promise.all([stability.recentStatus(), stability.checkDatabase(), stability.checkStorage(), stability.workerState()]);
    return res.json({ ok: true, data: { ...data, health: { process: { ok: true }, database, storage, recoveryWorker: worker, modelService: { ok: !!process.env.RUNNINGHUB_API_KEY } } } });
  }
  catch (error) { return sendApiError(res, 500, 'DATABASE_ERROR', `读取稳定性状态失败：${error.message}`); }
});

app.post('/api/admin/stability/storage-scan', requireAdmin, async (req, res) => {
  try {
    const outcome = await createStabilityService().scanStorage();
    logger.info({ requestId: req.requestId, userId: req.user.id, action: 'storage.audit.scan', status: 'success', metadata: outcome });
    return res.json({ ok: true, outcome });
  } catch (error) {
    logger.error({ requestId: req.requestId, userId: req.user.id, action: 'storage.audit.scan', status: 'failed', errorCode: 'STORAGE_ERROR', errorMessage: error.message });
    return sendApiError(res, 503, 'STORAGE_ERROR', `Storage巡检失败：${error.message}`);
  }
});

app.post('/api/admin/stability/storage-audits/:auditId/resolve', requireAdmin, async (req, res) => {
  try {
    const action = String(req.body?.action || '');
    const audit = await createStabilityService().resolveStorageAudit(req.params.auditId, action);
    if (!audit) return sendApiError(res, 404, 'ASSET_NOT_FOUND', 'Storage异常记录不存在或已处理');
    logger.info({ requestId: req.requestId, userId: req.user.id, action: 'storage.audit.resolve', status: 'success', metadata: { auditId: audit.id, resolution: action, storagePath: audit.storage_path } });
    return res.json({ ok: true, audit });
  } catch (error) {
    logger.error({ requestId: req.requestId, userId: req.user.id, action: 'storage.audit.resolve', status: 'failed', errorCode: 'STORAGE_ERROR', errorMessage: error.message, metadata: { auditId: req.params.auditId } });
    return sendApiError(res, 503, 'STORAGE_ERROR', `Storage异常处理失败：${error.message}`);
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const projects = await projectAssetService().listProjects(req.user.id);
    return res.json({ ok: true, projects });
  } catch (error) {
    return sendApiError(res, 500, `读取我的作品失败：${error.message}`);
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const project = await projectAssetService().createProject({ name: req.body?.name, userId: req.user.id });
    recordAnalytics({ eventName: "create_project", userId: req.user.id, projectId: project.id, properties: {} });
    return res.status(201).json({ ok: true, project });
  } catch (error) {
    return sendApiError(res, error.statusCode || 500, `创建 Project 失败：${error.message}`);
  }
});

app.get("/api/projects/:projectId", async (req, res) => {
  try {
    const project = await projectAssetService().getProject(req.params.projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    const [tasks, rawResults, prompts] = await Promise.all([
      taskResultService().listProjectTasks(project.id, req.user.id),
      taskResultService().listProjectResults(project.id, req.user.id),
      promptModelService().listProjectPrompts(project.id, req.user.id),
    ]);
    const clientTasks = tasks.map((task) => {
      if (task.task_type !== 'video_to_text' || task.status !== 'success') return task;
      const breakdownOutput = materializeBreakdownOutput(task.output_data || {}, {
        requestId: req.requestId, userId: req.user.id, projectId: project.id, taskId: task.id,
      });
      return {
        ...task,
        output_data: {
          normalized_breakdown: breakdownOutput.normalizedBreakdown,
          model_name: breakdownOutput.modelName,
          model_version: breakdownOutput.modelVersion,
          breakdown_version: breakdownOutput.breakdownVersion,
          provider: breakdownOutput.provider,
          fallback: breakdownOutput.fallback,
          estimated_cost: breakdownOutput.estimatedCost,
          elapsed_ms: breakdownOutput.elapsedMs,
        },
      };
    });
    const promptsByResult = new Map(prompts.map((item) => [item.result_id, item]));
    const results = await Promise.all(rawResults.map(async (result) => ({
      ...await materializeResult(result), prompt_version: promptsByResult.get(result.id) || null,
    })));
    return res.json({ ok: true, project, assets: project.assets || [], tasks: clientTasks, results, prompts });
  } catch (error) {
    return sendApiError(res, 500, `读取 Project 失败：${error.message}`);
  }
});

app.delete("/api/projects/:projectId", async (req, res) => {
  try {
    const outcome = await projectAssetService().deleteProject(req.params.projectId, req.user.id);
    if (!outcome.deleted) return res.json({ ok: true, deleted: true, idempotent: true, warnings: [] });
    recordAnalytics({ eventName: "delete_project", userId: req.user.id, properties: { deleted_project_id: req.params.projectId } });
    return res.json({ ok: true, deleted: true, warnings: outcome.warnings });
  } catch (error) {
    return sendApiError(res, 500, `删除 Project 失败：${error.message}`);
  }
});

app.post("/api/projects/original-video", runSingleUpload("video", ORIGINAL_VIDEO_MAX_BYTES, "video/"), async (req, res) => {
  const service = projectAssetService();
  let project;
  let createdProject = false;
  try {
    const requestedProjectId = String(req.body?.projectId || "").trim();
    if (requestedProjectId) {
      project = await service.getProject(requestedProjectId, req.user.id);
      if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    } else {
      project = await service.createProject({ name: req.body?.name || req.file.originalname, userId: req.user.id });
      createdProject = true;
    }
    const asset = await service.uploadAsset({
      projectId: project.id, userId: req.user.id, file: req.file,
      assetType: "video", purpose: 'source_video',
    });
    project = await service.setOriginalAsset(project.id, asset.id, req.user.id);
    logger.info({
      requestId: req.requestId, userId: req.user.id, projectId: project.id,
      action: 'video_analysis.source_upload_completed', status: 'success',
      durationMs: Date.now() - req.requestStartedAt,
      metadata: { bytes: req.file.size, storage: 'supabase' },
    });
    if (createdProject) recordAnalytics({ eventName: "create_project", userId: req.user.id, projectId: project.id, properties: { source: "original_video_upload" } });
    recordAnalytics({ eventName: "upload_original_video_success", userId: req.user.id, projectId: project.id, properties: { file_size: req.file.size, mime_type: req.file.mimetype } });
    return res.status(200).json({ ok: true, project, asset });
  } catch (error) {
    logger.error({
      requestId: req.requestId, userId: req.user?.id, projectId: project?.id || null,
      action: 'video_analysis.source_upload_failed', status: 'failed',
      errorCode: error.code || 'ASSET_UPLOAD_FAILED', errorMessage: error.message,
      metadata: {
        stack: error.stack || null,
        supabaseCode: error.code || null,
        supabaseMessage: error.message || null,
        supabaseDetails: error.details || null,
        supabaseHint: error.hint || null,
      },
    });
    if (createdProject && project?.id) await service.deleteProject(project.id, req.user.id).catch(() => {});
    return sendApiError(res, error.statusCode || 500, `原视频持久化失败：${error.message}`);
  }
});

app.post("/api/projects/:projectId/assets/replacement", runSingleUpload("image", REPLACEMENT_IMAGE_MAX_BYTES, "image/"), async (req, res) => {
  try {
    const service = projectAssetService();
    const project = await service.getProject(req.params.projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    const asset = await service.uploadAsset({
      projectId: project.id, userId: req.user.id, file: req.file, assetType: "image",
      replacementType: String(req.body?.replacementType || "").trim(),
      purpose: replacementPurpose(String(req.body?.replacementType || "").trim()),
    });
    recordAnalytics({ eventName: "upload_replacement_asset", userId: req.user.id, projectId: project.id, properties: { replacement_type: asset.replacement_type, file_size: req.file.size } });
    return res.status(201).json({ ok: true, asset });
  } catch (error) {
    return sendApiError(res, error.statusCode || 500, `替换素材持久化失败：${error.message}`);
  }
});

app.post("/api/projects/:projectId/assets/reference", runSingleUpload("file", REFERENCE_ASSET_MAX_BYTES, ["image/", "video/", "audio/"]), async (req, res) => {
  try {
    const assetType = String(req.body?.assetType || req.body?.referenceType || "").trim();
    req.file.mimetype = normalizePhysicalMimeType(assetType, req.file.mimetype || req.body?.mimeType, req.file.originalname);
    logger.info({
      requestId: req.requestId, userId: req.user.id, projectId: req.params.projectId,
      action: 'reference_asset.request_normalized', status: 'validated',
      metadata: {
        fieldName: req.file.fieldname, originalname: req.file.originalname,
        mimetype: req.file.mimetype, assetType,
        purpose: normalizeReferencePurpose(req.body?.purpose, assetType),
      },
    });
    const service = projectAssetService();
    const project = await service.getProject(req.params.projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    const asset = await service.uploadAsset({
      projectId: project.id, userId: req.user.id, file: req.file,
      assetType,
      purpose: normalizeReferencePurpose(req.body?.purpose, assetType),
      assetRef: String(req.body?.assetRef || '').trim() || null,
      targetPlaceholderId: String(req.body?.targetPlaceholderId || '').trim() || null,
      confidence: req.body?.confidence,
    });
    logger.info({
      requestId: req.requestId, userId: req.user.id, projectId: project.id,
      action: 'reference_asset.upload_completed', status: 'success',
      metadata: { assetType: asset.asset_type, purpose: asset.purpose, mimeType: asset.mime_type, bytes: req.file.size },
    });
    return res.status(200).json({ ok: true, asset });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    const errorCode = statusCode === 415 ? 'FILE_TYPE_NOT_SUPPORTED' : null;
    logger.error({
      requestId: req.requestId, userId: req.user?.id, projectId: req.params.projectId,
      action: 'reference_asset.upload_failed', status: 'failed',
      errorCode: error.code || errorCode || 'ASSET_UPLOAD_FAILED', errorMessage: error.message,
      metadata: {
        stack: error.stack || null,
        databaseCode: error.code || null,
        databaseDetails: error.details || null,
        databaseHint: error.hint || null,
      },
    });
    return errorCode
      ? sendApiError(res, statusCode, errorCode, `参考素材持久化失败：${error.message}`)
      : sendApiError(res, statusCode, `参考素材持久化失败：${error.message}`);
  }
});

app.patch("/api/projects/:projectId/assets/:assetId/binding", async (req, res) => {
  try {
    const service = projectAssetService();
    const project = await service.getProject(req.params.projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    const currentAsset = project.assets.find((asset) => asset.id === req.params.assetId);
    if (!currentAsset || !isReferenceAsset(currentAsset)) return sendApiError(res, 404, 'ASSET_NOT_FOUND', '参考素材不存在');
    const asset = await service.updateAssetBinding(project.id, currentAsset.id, req.user.id, {
      purpose: normalizeReferencePurpose(req.body?.purpose, physicalAssetType(currentAsset)),
      assetRef: req.body?.assetRef || currentAsset.asset_ref,
      targetPlaceholderId: req.body?.targetPlaceholderId,
      confidence: req.body?.confidence,
    });
    if (!asset) return sendApiError(res, 404, 'ASSET_NOT_FOUND', '参考素材不存在');
    return res.json({ ok: true, asset });
  } catch (error) {
    return sendApiError(res, error.statusCode || 500, `参考素材用途保存失败：${error.message}`);
  }
});

app.delete("/api/projects/:projectId/assets/:assetId", async (req, res) => {
  try {
    const deleted = await projectAssetService().deleteAsset(req.params.projectId, req.params.assetId, req.user.id);
    if (!deleted) return sendApiError(res, 404, "Asset 不存在");
    recordAnalytics({ eventName: "remove_replacement_asset", userId: req.user.id, projectId: req.params.projectId, properties: { asset_id: req.params.assetId } });
    return res.json({ ok: true, deleted: true });
  } catch (error) {
    return sendApiError(res, error.statusCode || 500, `删除 Asset 失败：${error.message}`);
  }
});

app.get("/api/projects/:projectId/tasks", async (req, res) => {
  try {
    const project = await projectAssetService().getProject(req.params.projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    const tasks = await taskResultService().listProjectTasks(project.id, req.user.id);
    const clientTasks = tasks.map((task) => {
      if (task.task_type !== 'video_to_text' || task.status !== 'success') return task;
      const breakdownOutput = materializeBreakdownOutput(task.output_data || {}, {
        requestId: req.requestId, userId: req.user.id, projectId: project.id, taskId: task.id,
      });
      return { ...task, output_data: {
        normalized_breakdown: breakdownOutput.normalizedBreakdown,
        model_name: breakdownOutput.modelName,
        model_version: breakdownOutput.modelVersion,
        breakdown_version: breakdownOutput.breakdownVersion,
        provider: breakdownOutput.provider,
        fallback: breakdownOutput.fallback,
        estimated_cost: breakdownOutput.estimatedCost,
        elapsed_ms: breakdownOutput.elapsedMs,
      } };
    });
    return res.json({ ok: true, tasks: clientTasks });
  } catch (error) {
    return sendApiError(res, 500, `读取项目任务失败：${error.message}`);
  }
});

app.get("/api/tasks/:taskId", async (req, res) => {
  try {
    const task = await taskResultService().getTask(req.params.taskId, req.user.id);
    if (!task) return sendApiError(res, 404, "Task 不存在");
    const result = task.status === "success" && task.task_type === "generate_video"
      ? await taskResultService().getResultByTask(task.id, req.user.id) : null;
    const safeResult = result ? await materializeResult(result) : null;
    if (safeResult) safeResult.prompt_version = await promptModelService().getPromptByResult(result.id, req.user.id);
    return res.json(publicPersistedTask(task, safeResult));
  } catch (error) {
    return sendApiError(res, 500, `读取 Task 失败：${error.message}`);
  }
});

app.get("/api/projects/:projectId/results", async (req, res) => {
  try {
    const project = await projectAssetService().getProject(req.params.projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
    const [results, prompts] = await Promise.all([
      taskResultService().listProjectResults(project.id, req.user.id),
      promptModelService().listProjectPrompts(project.id, req.user.id),
    ]);
    const promptsByResult = new Map(prompts.map((item) => [item.result_id, item]));
    return res.json({ ok: true, results: await Promise.all(results.map(async (result) => ({
      ...await materializeResult(result), prompt_version: promptsByResult.get(result.id) || null,
    }))) });
  } catch (error) {
    return sendApiError(res, 500, `读取项目结果失败：${error.message}`);
  }
});

app.post("/api/tasks/:taskId/retry", async (req, res) => {
  try {
    const task = await taskResultService().getTask(req.params.taskId, req.user.id);
    if (!task) return sendApiError(res, 404, "Task 不存在");
    if (task.task_type !== "generate_video") return sendApiError(res, 409, "仅视频生成任务支持重新生成");
    if (!["failed", "timeout"].includes(task.status)) return sendApiError(res, 409, "只有失败或超时任务可以重新生成");
    const updated = await taskResultService().updateTask(task.id, { retry_count: Number(task.retry_count || 0) + 1 });
    return res.json({ ok: true, retry: true, projectId: task.project_id, task: updated, inputData: task.input_data });
  } catch (error) {
    return sendApiError(res, 500, `准备重新生成失败：${error.message}`);
  }
});

const RUNNINGHUB_SKILL_DIR =
  process.env.RUNNINGHUB_SKILL_DIR ||
  path.join(os.homedir(), "Documents/ii/workspace-penguin/skills/runninghub");

const RH_BASE = "https://www.runninghub.cn/openapi/v2";
const RH_POLL_ENDPOINT = "/query";
const RH_UPLOAD_ENDPOINT = "/media/upload/binary";
const RH_VIDEO_TO_TEXT_ENDPOINT = "rhart-text-g-25-flash/video-to-text";
const RH_MAX_POLL_SECONDS = 1200;
const RH_POLL_INTERVAL_MS = 5000;
const LEGACY_VIDEO_ENDPOINT = "bytedance/seedance-2.0-global-fast/multimodal-video";
const generationTasks = new Map();
const videoToTextTasks = new Map();

function videoToTextTaskElapsed(task) {
  const finishedAt = task.finishedAt || Date.now();
  return Math.max(0, Math.floor((finishedAt - task.startedAt) / 1000));
}

function publicVideoToTextTask(task) {
  const base = {
    ok: true,
    taskId: task.taskId,
    status: task.status,
    startedAt: task.startedAt,
    elapsed: videoToTextTaskElapsed(task),
  };
  if (task.status === "success") return { ...base, result: task.result, rawResult: task.rawResult };
  if (task.status === "failed") return { ...base, error: task.error };
  return base;
}

function generationTaskElapsed(task) {
  const finishedAt = task.finishedAt || Date.now();
  return Math.max(0, Math.floor((finishedAt - task.startedAt) / 1000));
}

function parseGenerationOutput(stdout) {
  const outputFile = stdout.match(/OUTPUT_FILE:\s*([^\r\n]+)/)?.[1]?.trim() || "";
  const cost = stdout.match(/COST:\s*([^\r\n]+)/)?.[1]?.trim() || "";
  const videoUrl = outputFile
    ? `/generated/${encodeURIComponent(path.basename(outputFile))}`
    : "";
  return { outputFile, cost, videoUrl };
}

function publicGenerationTask(taskId, task) {
  const elapsed = generationTaskElapsed(task);
  const base = { ok: true, taskId, status: task.status, startedAt: task.startedAt, elapsed };
  if (task.status === "success") {
    return {
      ...base,
      videoUrl: task.videoUrl,
      outputFile: task.outputFile,
      cost: task.cost,
      result: task.result,
      finalPrompt: task.finalPrompt,
      config: task.config,
    };
  }
  if (task.status === "failed") return { ...base, error: task.error };
  return base;
}

function publicPersistedTask(task, result) {
  const startedAt = task.started_at ? new Date(task.started_at).getTime() : Date.now();
  const finishedAt = task.finished_at ? new Date(task.finished_at).getTime() : Date.now();
  const base = {
    ok: true,
    taskId: task.id,
    externalTaskId: task.external_task_id,
    projectId: task.project_id,
    taskType: task.task_type,
    status: task.status,
    stage: task.stage,
    startedAt,
    elapsed: Math.max(0, Math.floor((finishedAt - startedAt) / 1000)),
    inputData: task.input_data || {},
    config: task.input_data?.generation_config || task.input_data?.config || result?.model_params || {},
    modelParams: result?.model_params || null,
  };
  if (task.status === "success") {
    const breakdownOutput = task.task_type === "video_to_text"
      ? materializeBreakdownOutput(task.output_data || {}, { userId: task.user_id, projectId: task.project_id, taskId: task.id })
      : null;
    const videoToTextResult = breakdownOutput?.normalizedBreakdown || task.output_data;
    return {
      ...base,
      result: videoToTextResult,
      ...(breakdownOutput ? {
        normalizedBreakdown: breakdownOutput.normalizedBreakdown,
        modelName: breakdownOutput.modelName,
        modelVersion: breakdownOutput.modelVersion,
        breakdownVersion: breakdownOutput.breakdownVersion,
        estimatedCost: breakdownOutput.estimatedCost,
        understandingElapsedMs: breakdownOutput.elapsedMs,
        fallback: breakdownOutput.fallback,
      } : {}),
      videoUrl: result?.video_url || task.output_data?.videoUrl || "",
      finalPrompt: result?.prompt || task.output_data?.finalPrompt || "",
      cost: result?.cost || task.output_data?.cost || "",
      providerCost: result?.provider_cost ?? task.output_data?.providerCost ?? null,
      creditCost: result?.credit_cost ?? task.output_data?.creditCost ?? null,
      config: result?.model_params || task.input_data?.generation_config || task.output_data?.config || {},
      version: result?.version || null,
      promptVersion: result?.prompt_version || null,
    };
  }
  if (["failed", "timeout", "cancelled"].includes(task.status)) {
    const errorCode = task.error_code || "TASK_FAILED";
    return { ...base, error: task.error_message || "任务失败", code: errorCode, errorCode };
  }
  return base;
}

function cancelledTaskError() {
  const error = new Error("任务已取消，不创建生成结果");
  error.code = "TASK_CANCELLED";
  return error;
}

async function checkGenerationFinalization(taskId, userId) {
  const persistedTask = await taskResultService().getTask(taskId, userId);
  const existingResult = persistedTask
    ? await taskResultService().getResultByTask(taskId, userId)
    : null;
  const decision = evaluateGenerationFinalization(persistedTask, existingResult);
  if (decision.action === "missing") {
    const error = new Error("生成任务不存在或无权访问");
    error.code = "TASK_NOT_FOUND";
    throw error;
  }
  if (decision.action === "cancelled") throw cancelledTaskError();
  if (decision.action === "timeout") throw appError('TASK_TIMEOUT', '任务已超时，忽略迟到的第三方成功结果');
  return { persistedTask, existingResult };
}

async function releaseFailedTaskBilling(taskId, userId, providerCost = 0, { forceFullRefund = false } = {}) {
  const persistedTask = await taskResultService().getTask(taskId, userId);
  if (!persistedTask || persistedTask.billing_status === 'not_required') return null;
  const quote = persistedTask.input_data?.billing_quote || {};
  const settings = await billingService().getSettings().catch(() => ({ default_failure_charge_ratio: 0.2 }));
  const ratio = forceFullRefund ? 0 : failureChargeRatio({
    externalTaskId: persistedTask.external_task_id,
    costRule: quote.costRule || {},
    defaultRatio: settings.default_failure_charge_ratio,
  });
  const outcome = await billingService().releaseTask({ taskId, userId, chargeRatio: ratio, providerCost: numeric(providerCost) });
  if (Number(outcome?.refund || 0) > 0) {
    recordAnalytics({
      eventName: "points_refunded", userId, projectId: persistedTask.project_id, taskId,
      modelId: persistedTask.input_data?.config?.model_id || null,
      properties: { refunded_cost: Number(outcome.refund), actual_cost: Number(outcome.actual_credit_cost || 0) },
    });
  }
  return outcome;
}

function parseJsonFormField(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function validateVideoConfig(input = {}) {
  const requestedModel = String(input.model || SEEDANCE_2_MODEL_ID).trim();
  if (requestedModel !== SEEDANCE_2_MODEL_ID) {
    const error = new Error('当前仅支持 Seedance 2.0，不能创建可灵模型新任务');
    error.code = 'MODEL_UNAVAILABLE';
    throw error;
  }
  const modelRecord = await promptModelService().getActiveModel(requestedModel);
  const config = validateModelSelection(modelRecord, input);
  config.inputVideoDuration = Number(input.inputVideoDuration);
  config.generateAudio = true;
  return config;
}

async function quoteGeneration(finalGenerationConfig, inputVideoDuration) {
  if (!process.env.RUNNINGHUB_API_KEY) throw new Error("后端未配置 RunningHub API Key");
  if (finalGenerationConfig.model.costRule?.enabled !== true) {
    const error = new Error("计费配置未初始化，请执行004和005 migration");
    error.code = "BILLING_CONFIG_NOT_READY";
    throw error;
  }
  const quote = quoteSeedanceProviderCost({ ...finalGenerationConfig, inputVideoDuration });
  const creditCost = calculateCreditCost({
    costRule: finalGenerationConfig.model.costRule, providerCost: quote.providerCost,
    duration: finalGenerationConfig.duration, resolution: finalGenerationConfig.resolution,
    aspectRatio: finalGenerationConfig.ratio,
  });
  return { ...quote, creditCost, costRule: finalGenerationConfig.model.costRule };
}

function seedanceResponseSnapshot(response = {}) {
  const bodyText = Buffer.isBuffer(response.body) ? response.body.toString('utf8') : String(response.body || '');
  let bodyJson = null;
  try { bodyJson = bodyText ? JSON.parse(bodyText) : null; } catch {}
  const headers = response.headers || {};
  return {
    httpStatus: response.statusCode ?? null,
    headers,
    body: bodyJson ?? bodyText,
    bodyText,
    requestId: bodyJson?.requestId || bodyJson?.request_id || headers['x-request-id'] || headers['request-id'] || null,
    errorCode: bodyJson?.errorCode ?? bodyJson?.error_code ?? bodyJson?.code ?? null,
    errorMessage: bodyJson?.errorMessage ?? bodyJson?.error_message ?? bodyJson?.message ?? bodyJson?.msg ?? null,
    traceId: bodyJson?.traceId || bodyJson?.trace_id || headers['x-trace-id'] || headers['trace-id'] || null,
  };
}

function printSeedanceResponse(localRequestId, response) {
  const snapshot = seedanceResponseSnapshot(response);
  console.error('[Seedance upstream response]', JSON.stringify({
    localRequestId,
    httpStatus: snapshot.httpStatus,
    responseHeaders: snapshot.headers,
    responseBody: snapshot.body,
    requestId: snapshot.requestId,
    errorCode: snapshot.errorCode,
    errorMessage: snapshot.errorMessage,
    traceId: snapshot.traceId,
  }));
  return snapshot;
}

function seedancePayloadForLog(payload = {}) {
  const redactUrl = (value) => {
    try {
      const url = new URL(value);
      if (url.search) url.search = '?[SIGNED_QUERY_REDACTED]';
      return url.toString();
    } catch {
      return value;
    }
  };
  return {
    ...payload,
    imageUrls: (payload.imageUrls || []).map(redactUrl),
    videoUrls: (payload.videoUrls || []).map(redactUrl),
    audioUrls: (payload.audioUrls || []).map(redactUrl),
  };
}

function rawSeedanceResponseError(snapshot = {}) {
  const rawMessage = snapshot.errorMessage
    || (typeof snapshot.body === 'string' ? snapshot.body : JSON.stringify(snapshot.body));
  const error = new Error(rawMessage || 'SeeDance response did not include taskId');
  error.name = 'SeedanceUpstreamResponseError';
  error.code = String(snapshot.errorCode ?? `HTTP_${snapshot.httpStatus ?? 'UNKNOWN'}`);
  error.statusCode = snapshot.httpStatus ?? null;
  error.responseHeaders = snapshot.headers || {};
  error.responseBody = snapshot.body;
  error.requestId = snapshot.requestId || null;
  error.traceId = snapshot.traceId || null;
  error.upstreamErrorCode = snapshot.errorCode ?? null;
  error.upstreamErrorMessage = snapshot.errorMessage ?? null;
  error.preserveUpstream = true;
  return error;
}

async function runSeedance2Generation({ imagePath, imageUrls, videoUrls = [], audioUrls = [], prompt, config, outputFile, requestId, onSubmitted, onRetry }) {
  const uploadedImageUrl = imagePath ? await uploadFileToRunningHub(process.env.RUNNINGHUB_API_KEY, imagePath) : '';
  const payload = sanitizeSeedancePayload(buildSeedancePayload({
    prompt, resolution: config.resolution, duration: config.duration, ratio: config.ratio,
    imageUrls: [...(imageUrls || []), uploadedImageUrl], videoUrls, audioUrls,
  }));
  if (process.env.NODE_ENV !== 'production') {
    console.info('[Seedance 2.0] 请求字段：', Object.keys(payload).sort());
  }
  console.error('[Seedance upstream request]', JSON.stringify({
    localRequestId: requestId || null,
    endpoint: `${RH_BASE}/${SEEDANCE_2_ENDPOINT}`,
    payload: seedancePayloadForLog(payload),
  }));
  let submitted;
  let upstreamSnapshot = null;
  try {
    submitted = await postRunningHubJson(
      process.env.RUNNINGHUB_API_KEY, `${RH_BASE}/${SEEDANCE_2_ENDPOINT}`, payload, 120000,
      (response) => { upstreamSnapshot = printSeedanceResponse(requestId, response); }
    );
  } catch (requestError) {
    if (upstreamSnapshot) Object.assign(requestError, rawSeedanceResponseError(upstreamSnapshot));
    console.error('[Seedance upstream exception stack]', requestError.stack);
    throw requestError;
  }
  const externalTaskId = submitted.taskId;
  if (!externalTaskId) {
    const error = rawSeedanceResponseError(upstreamSnapshot || {
      body: submitted,
      errorCode: submitted?.errorCode ?? submitted?.code ?? null,
      errorMessage: submitted?.errorMessage ?? submitted?.message ?? submitted?.msg ?? null,
      requestId: submitted?.requestId ?? submitted?.request_id ?? null,
      traceId: submitted?.traceId ?? submitted?.trace_id ?? null,
    });
    console.error('[Seedance upstream exception stack]', error.stack);
    throw error;
  }
  if (onSubmitted) await onSubmitted(externalTaskId);
  const final = submitted.status === 'SUCCESS' && submitted.results
    ? submitted
    : await pollRunningHubTask(process.env.RUNNINGHUB_API_KEY, externalTaskId, null, onRetry);
  const resultUrl = selectSeedanceVideoResult(final.results);
  await downloadRemoteFile(resultUrl, outputFile);
  const cost = final.usage?.consumeMoney ?? final.usage?.thirdPartyConsumeMoney ?? '';
  return `TASK_ID:${externalTaskId}\nOUTPUT_FILE:${outputFile}\nCOST:${cost}`;
}

function getErrorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  return err.message || fallback;
}

function inferErrorCode(status, message = '') {
  if (status === 401) return 'AUTH_INVALID';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 404 && /project/i.test(message)) return 'PROJECT_NOT_FOUND';
  if (status === 404 && /task|任务/i.test(message)) return 'TASK_NOT_FOUND';
  if (status === 413 || /大小|too large/i.test(message)) return 'FILE_TOO_LARGE';
  if (status === 415 || /文件类型|仅支持/i.test(message)) return 'FILE_TYPE_NOT_SUPPORTED';
  if (status === 429) return 'MODEL_RATE_LIMITED';
  if (status === 402 || /余额不足|积分不足/i.test(message)) return 'BALANCE_INSUFFICIENT';
  if (status === 409 && /取消/i.test(message)) return 'TASK_CANCELLED';
  if (status === 409) return 'TASK_STATE_INVALID';
  if (/signed|签名|播放地址/i.test(message)) return 'SIGNED_URL_FAILED';
  if (/storage|bucket|对象存储/i.test(message)) return 'STORAGE_ERROR';
  if (/database|数据库/i.test(message)) return 'DATABASE_ERROR';
  return status >= 500 ? 'INTERNAL_ERROR' : 'TASK_STATE_INVALID';
}

function classifyModelError(error) {
  if (error?.code && ERROR_DEFINITIONS[error.code]) return error.code;
  const message = String(error?.message || error || '');
  if (/rate.?limit|too many|HTTP 429|频繁|限流/i.test(message)) return 'MODEL_RATE_LIMITED';
  if (/content|safety|moderation|审核|违规|敏感/i.test(message)) return 'MODEL_CONTENT_REJECTED';
  if (/未返回|结果无效|invalid result|output.*missing/i.test(message)) return 'MODEL_RESULT_INVALID';
  if (/超时|timeout/i.test(message)) return 'TASK_TIMEOUT';
  return 'MODEL_REQUEST_FAILED';
}

function sendApiError(res, status, errorOrCode, messageOrDetails, maybeDetails) {
  if (res.headersSent) return;
  const explicitCode = typeof errorOrCode === 'string' && ERROR_DEFINITIONS[errorOrCode] ? errorOrCode : null;
  const message = explicitCode
    ? (typeof messageOrDetails === 'string' ? messageOrDetails : ERROR_DEFINITIONS[explicitCode][1])
    : (errorOrCode || '后端服务异常');
  const details = explicitCode ? maybeDetails : messageOrDetails;
  const code = explicitCode || inferErrorCode(status, message);
  logger.error({ requestId: res.locals.requestId, action: 'api.error', status: String(status), errorCode: code, errorMessage: message, metadata: details || {} });
  const publicMessage = /column\s+[^\s]+\s+does not exist|relation\s+[^\s]+\s+does not exist|schema cache/i.test(String(message))
    ? '素材信息加载失败，请稍后重试'
    : message;
  res.status(status).json({
    ok: false,
    error: code,
    code,
    message: publicMessage,
    requestId: res.locals.requestId,
    ...(details ? { details } : {}),
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
    }[ext] || "application/octet-stream"
  );
}

function requestBuffer(method, urlString, body, headers, timeoutMs, onResponse) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: timeoutMs || 60000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (onResponse) onResponse({ statusCode: response.statusCode, headers: response.headers, body: buffer });
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const err = new Error(buffer.toString("utf8") || `HTTP ${response.statusCode}`);
            err.statusCode = response.statusCode;
            err.body = buffer.toString("utf8");
            reject(err);
            return;
          }
          resolve(buffer);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("请求超时")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postRunningHubJson(apiKey, url, payload, timeoutMs, onResponse) {
  const body = Buffer.from(JSON.stringify(payload));
  const buffer = await requestBuffer(
    "POST",
    url,
    body,
    {
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
      Authorization: `Bearer ${apiKey}`,
    },
    timeoutMs || 60000,
    onResponse
  );
  return JSON.parse(buffer.toString("utf8"));
}

async function uploadFileToRunningHub(apiKey, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`上传文件不存在：${filePath}`);
  }

  const boundary = `----ViralLabRunningHub${Date.now().toString(16)}`;
  const filename = path.basename(filePath);
  const file = fs.readFileSync(filePath);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentTypeFor(filePath)}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, file, tail]);
  const buffer = await requestBuffer(
    "POST",
    `${RH_BASE}${RH_UPLOAD_ENDPOINT}`,
    body,
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    120000
  );
  const json = JSON.parse(buffer.toString("utf8"));
  if (json.code === 0 && json.data?.download_url) {
    return json.data.download_url;
  }
  throw new Error(`视频上传失败：${JSON.stringify(json)}`);
}

async function pollRunningHubTask(apiKey, taskId, onPoll, onRetry) {
  const url = `${RH_BASE}${RH_POLL_ENDPOINT}`;
  let elapsed = 0;
  let consecutiveFailures = 0;

  while (elapsed < RH_MAX_POLL_SECONDS) {
    await new Promise((resolve) => setTimeout(resolve, RH_POLL_INTERVAL_MS));
    elapsed += RH_POLL_INTERVAL_MS / 1000;

    try {
      const json = await postRunningHubJson(apiKey, url, { taskId }, 30000);
      consecutiveFailures = 0;
      if (onPoll) await onPoll(json);

      if (json.status === "SUCCESS") {
        return json;
      }
      if (json.status === "FAILED") {
        if (String(json.errorCode ?? json.code ?? '') === '1007') {
          throw seedanceSubmissionError(json);
        }
        const taskError = new Error(`任务失败：${json.errorMessage || JSON.stringify(json)}`);
        taskError.nonRetryable = true;
        throw taskError;
      }
    } catch (err) {
      if (err.nonRetryable) {
        throw err;
      }
      consecutiveFailures += 1;
      if (onRetry) await onRetry(err, consecutiveFailures);
      if (consecutiveFailures >= 5) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 1000 * (2 ** (consecutiveFailures - 1))) + Math.floor(Math.random() * 250)));
    }
  }

  throw new Error(`任务轮询超时（${RH_MAX_POLL_SECONDS}s）`);
}

function formatRunningHubTextResult(finalResult) {
  const results = finalResult.results || [];
  const firstResult = results[0] || {};
  const textResult = firstResult.text || firstResult.content || firstResult.output || "";
  if (!textResult) {
    throw new Error(`未获取到 video-to-text 文本结果：${JSON.stringify(finalResult)}`);
  }

  const usage = finalResult.usage || {};
  const lines = [textResult];
  const consumeMoney = usage.consumeMoney || usage.thirdPartyConsumeMoney;
  const taskCostTime = usage.taskCostTime;
  if (consumeMoney != null) lines.push(`COST:¥${consumeMoney}`);
  if (taskCostTime && String(taskCostTime) !== "0") lines.push(`DURATION:${taskCostTime}s`);
  return lines.join("\n");
}

async function runVideoToTextDirect(apiKey, videoPath, prompt, onSubmitted, onPoll, onRetry) {
  const videoUrl = await uploadFileToRunningHub(apiKey, videoPath);
  const submitResult = await postRunningHubJson(
    apiKey,
    `${RH_BASE}/${RH_VIDEO_TO_TEXT_ENDPOINT}`,
    {
      prompt,
      videoUrl,
    },
    60000
  );

  const taskId = submitResult.taskId;
  if (!taskId) {
    throw new Error(`未获取到 video-to-text taskId：${JSON.stringify(submitResult)}`);
  }
  if (onSubmitted) await onSubmitted(taskId, submitResult);

  const finalResult =
    submitResult.status === "SUCCESS" && submitResult.results
      ? submitResult
      : await pollRunningHubTask(apiKey, taskId, onPoll, onRetry);

  return finalResult;
}

async function runFineVideoUnderstanding({
  videoPath, videoUrl, requestId = '', projectId = '', taskId = '', userId = '',
  onFallbackSubmitted, onFallbackPoll, onFallbackRetry,
}) {
  if (!process.env.RUNNINGHUB_API_KEY) {
    throw Object.assign(new Error('未配置 RUNNINGHUB_API_KEY'), { code: 'MODEL_UNAVAILABLE' });
  }
  const model = process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_RUNNINGHUB_GEMINI_MODEL;
  logger.info({
    requestId, userId, projectId, taskId,
    action: 'video_understanding.provider_selected', status: 'started', modelName: model,
    metadata: { provider: 'runninghub_llm', fallback: false },
  });
  const totalStartedAt = Date.now();
  const uploadStartedAt = Date.now();
  let runningHubVideoUrl;
  try {
    runningHubVideoUrl = await uploadFileToRunningHub(process.env.RUNNINGHUB_API_KEY, videoPath);
  } catch (error) {
    const uploadElapsedMs = Date.now() - uploadStartedAt;
    logger.error({
      requestId, userId, projectId, taskId,
      action: 'video_understanding.video_upload_completed', status: 'failed', modelName: model,
      durationMs: uploadElapsedMs, errorCode: error.code || classifyModelError(error),
      errorMessage: error.message, metadata: { provider: 'runninghub' },
    });
    logger.error({
      requestId, userId, projectId, taskId,
      action: 'video_understanding.total_completed', status: 'failed', modelName: model,
      durationMs: Date.now() - totalStartedAt, errorCode: error.code || classifyModelError(error),
      errorMessage: error.message, metadata: { uploadElapsedMs, geminiElapsedMs: 0 },
    });
    throw error;
  }
  const uploadElapsedMs = Date.now() - uploadStartedAt;
  logger.info({
    requestId, userId, projectId, taskId,
    action: 'video_understanding.video_upload_completed', status: 'success', modelName: model,
    durationMs: uploadElapsedMs, metadata: { provider: 'runninghub' },
  });
  const geminiStartedAt = Date.now();
  let output;
  try {
    output = await callRunningHubGeminiVideoUnderstanding({
      apiKey: process.env.RUNNINGHUB_API_KEY,
      model,
      videoUrl: runningHubVideoUrl,
      baseUrl: process.env.RUNNINGHUB_LLM_BASE_URL,
      requestId,
    });
  } catch (error) {
    const geminiElapsedMs = error.elapsedMs || Date.now() - geminiStartedAt;
    logger.error({
      requestId, userId, projectId, taskId,
      action: 'video_understanding.gemini_completed', status: 'failed', modelName: model,
      durationMs: geminiElapsedMs, errorCode: error.code || classifyModelError(error),
      errorMessage: error.message, metadata: { provider: 'runninghub_llm' },
    });
    logger.error({
      requestId, userId, projectId, taskId,
      action: 'video_understanding.total_completed', status: 'failed', modelName: model,
      durationMs: Date.now() - totalStartedAt, errorCode: error.code || classifyModelError(error),
      errorMessage: error.message, metadata: { uploadElapsedMs, geminiElapsedMs },
    });
    throw error;
  }
  logger.info({
    requestId, userId, projectId, taskId,
    action: 'video_understanding.response_shape', status: 'received', modelName: model,
    metadata: { provider: output.provider, ...output.responseShape },
  });
  logger.info({
    requestId, userId, projectId, taskId,
    action: 'video_understanding.provider_completed', status: 'success', modelName: output.modelName,
    durationMs: output.elapsedMs, metadata: { provider: output.provider, fallback: false },
  });
  const totalElapsedMs = Date.now() - totalStartedAt;
  logger.info({
    requestId, userId, projectId, taskId,
    action: 'video_understanding.total_completed', status: 'success', modelName: output.modelName,
    durationMs: totalElapsedMs,
    metadata: { uploadElapsedMs, geminiElapsedMs: output.elapsedMs },
  });
  return { ...output, timings: { uploadElapsedMs, geminiElapsedMs: output.elapsedMs, totalElapsedMs } };
}

function getRunningHubRunner() {
  const bundledScriptPath = path.join(__dirname, "scripts", "runninghub.js");
  if (fs.existsSync(bundledScriptPath)) {
    return {
      cwd: __dirname,
      script: "scripts/runninghub.js",
    };
  }

  const skillScriptPath = path.join(RUNNINGHUB_SKILL_DIR, "scripts", "runninghub.js");
  if (fs.existsSync(skillScriptPath)) {
    return {
      cwd: RUNNINGHUB_SKILL_DIR,
      script: "scripts/runninghub.js",
    };
  }

  throw new Error(
    `未找到 RunningHub 调用脚本：请确认已部署 backend/scripts/runninghub.js，或配置 RUNNINGHUB_SKILL_DIR。已检查 ${bundledScriptPath} 和 ${skillScriptPath}`
  );
}

function runRunningHubScript(args, label, onStdout) {
  return new Promise((resolve, reject) => {
    let child;
    let stdout = "";
    let stderr = "";

    try {
      const runner = getRunningHubRunner();
      const runnerArgs = [runner.script, ...args.slice(1)];
      child = spawn("node", runnerArgs, {
        cwd: runner.cwd,
        env: process.env,
      });
    } catch (err) {
      reject(new Error(getErrorMessage(err, `${label} 启动失败`)));
      return;
    }

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      if (onStdout) onStdout(text);
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(new Error(getErrorMessage(err, `${label} 进程启动失败`)));
    });

    child.on("close", (code) => {
      console.log(`${label} 进程结束，code =`, code);
      console.log("stdout 前 500 字：", stdout.slice(0, 500));
      console.log("stderr 前 500 字：", stderr.slice(0, 500));

      if (code !== 0) {
        reject(new Error(stderr || stdout || `${label} 失败，退出码 ${code}`));
        return;
      }

      resolve(stdout);
    });
  });
}

function runMediaCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    };
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      finish(reject, new Error(`${label}超时`));
    }, 15000);
    child.stdout?.on("data", (data) => { stdout += data.toString(); });
    child.stderr?.on("data", (data) => { stderr += data.toString(); });
    child.on("error", (error) => finish(reject, error));
    child.on("close", (code) => {
      if (code === 0) finish(resolve, stdout);
      else finish(reject, new Error(`${label}失败：${stderr.slice(-800) || `退出码 ${code}`}`));
    });
  });
}

function parseBreakdownJson(value) {
  if (value && typeof value === "object") return value;
  const text = String(value || "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

function breakdownList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeBreakdownTerm(value) {
  return String(value || "").toLowerCase().replace(/[\s的、一只一个个]/g, "");
}

function mergeSimilarTerms(values, limit = Infinity) {
  const result = [];
  for (const value of values) {
    const normalized = normalizeBreakdownTerm(value);
    if (!normalized) continue;
    const duplicate = result.some((existing) => {
      const other = normalizeBreakdownTerm(existing);
      return normalized === other || normalized.includes(other) || other.includes(normalized);
    });
    if (!duplicate) result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function canonicalSubject(value) {
  const text = String(value || "").trim();
  if (/(狗|犬)/.test(text)) return "小狗";
  if (/(猫|猫咪)/.test(text)) return "小猫";
  if (/^(人物|人类|一个人|一名男子|一名女子)$/.test(text)) return "人物";
  return text;
}

const CONCRETE_OBJECT_WORDS = [
  "沙发", "桌子", "茶几", "椅子", "床", "柜子", "电视", "路灯", "车辆", "汽车", "自行车",
  "手机", "杯子", "瓶子", "背包", "玩具", "牵引绳", "狗绳", "胸背带", "食物", "商品", "道具",
];
const ENVIRONMENT_WORDS = [
  "客厅", "卧室", "厨房", "餐厅", "房间", "室内", "户外", "森林", "街道", "公园", "广场",
  "商场", "办公室", "教室", "海边", "山林", "草原", "庭院", "小路", "道路", "城市", "乡村",
];
const MEANINGLESS_ELEMENT_WORDS = [
  "画面", "镜头", "场景", "背景", "主体", "人物", "动作", "节奏", "光影", "阴影", "天空", "地面",
  "墙面", "道路", "小路", "草地", "路面", "石砖地", "铺设路面",
];
const LOW_VALUE_SCENES = new Set(["背景", "画面", "场景", "环境", "未识别", "未知", "暂无"]);

function containsAnyTerm(value, words) {
  const text = String(value || "");
  return words.some((word) => text.includes(word));
}

function canonicalElement(value) {
  const text = String(value || "").trim();
  const matched = CONCRETE_OBJECT_WORDS.find((word) => text.includes(word));
  return matched || text;
}

function canonicalScene(value) {
  const text = String(value || "").trim();
  if (/(小路|小径|道路|路面|石板路|石砖路|石砖地|步道)/.test(text)) return "户外小路";
  return text;
}

function cleanBreakdownForResponse(value) {
  const data = parseBreakdownJson(value);
  if (!data) return value;
  const overview = data.overview || {};
  const subjects = mergeSimilarTerms(
    breakdownList(overview.replaceableSubjects).map(canonicalSubject)
  );
  const rawScenes = breakdownList(overview.replaceableScenes).map(canonicalScene);
  const movedObjects = rawScenes.filter((item) => containsAnyTerm(item, CONCRETE_OBJECT_WORDS));
  const scenes = mergeSimilarTerms(rawScenes.filter((item) =>
    !containsAnyTerm(item, CONCRETE_OBJECT_WORDS) && !LOW_VALUE_SCENES.has(item)
  ));
  const subjectTerms = subjects.map(normalizeBreakdownTerm);
  const elements = mergeSimilarTerms([
    ...breakdownList(overview.replaceableElements),
    ...movedObjects,
  ].map(canonicalElement).filter((item) => {
    if (containsAnyTerm(item, MEANINGLESS_ELEMENT_WORDS)) return false;
    const normalized = normalizeBreakdownTerm(canonicalSubject(item));
    return !subjectTerms.some((subject) =>
      normalized === subject || normalized.includes(subject) || subject.includes(normalized)
    );
  }), 5);

  return {
    ...data,
    overview: {
      ...overview,
      replaceableSubjects: subjects,
      replaceableScenes: scenes,
      replaceableElements: elements,
    },
  };
}

const CURRENT_BREAKDOWN_VERSION = 2;

function breakdownFieldSnapshot(value) {
  const data = parseBreakdownJson(value) || {};
  const stages = Array.isArray(data.actionStages) && data.actionStages.length
    ? data.actionStages
    : (Array.isArray(data.shots) ? data.shots : []);
  return {
    scenes: breakdownList(data.overview?.replaceableScenes),
    elements: breakdownList(data.overview?.replaceableElements),
    stageScenes: stages.map((stage) => String(stage?.scene || '')).filter(Boolean),
    stageElements: stages.flatMap((stage) => breakdownList(stage?.elements)),
  };
}

function buildBreakdownVersions(rawBreakdown, existingCleanedBreakdown = null, existingFinalBreakdown = null, logContext = {}) {
  const parsedRaw = parseBreakdownJson(rawBreakdown) || rawBreakdown;
  const cleanedBreakdown = parseBreakdownJson(existingCleanedBreakdown)
    || cleanBreakdownForResponse(parsedRaw);
  // 即使数据库已有旧 finalBreakdown，也按当前版本再次清洗，防止旧清洗规则残留。
  const finalSource = parseBreakdownJson(existingFinalBreakdown) || cleanedBreakdown;
  const finalBreakdown = finalSource && typeof finalSource === 'object'
    ? refineBreakdown(finalSource)
    : finalSource;
  logger.info({
    ...logContext,
    action: 'breakdown.raw_cleaned_final',
    status: 'success',
    metadata: {
      breakdownVersion: CURRENT_BREAKDOWN_VERSION,
      raw: breakdownFieldSnapshot(parsedRaw),
      cleaned: breakdownFieldSnapshot(cleanedBreakdown),
      final: breakdownFieldSnapshot(finalBreakdown),
    },
  });
  return { rawBreakdown: parsedRaw, cleanedBreakdown, finalBreakdown, breakdownVersion: CURRENT_BREAKDOWN_VERSION };
}

function materializeBreakdownOutput(outputData = {}, logContext = {}) {
  if (outputData.normalized_breakdown) {
    return {
      rawUnderstandingResult: outputData.raw_understanding_result,
      normalizedBreakdown: normalizeFineBreakdown(outputData.normalized_breakdown, {
        modelName: outputData.model_name,
        modelVersion: outputData.model_version,
      }),
      modelName: outputData.model_name,
      modelVersion: outputData.model_version,
      breakdownVersion: FINE_BREAKDOWN_VERSION,
      provider: outputData.provider,
      fallback: Boolean(outputData.fallback),
      usage: outputData.usage || {}, estimatedCost: outputData.estimated_cost ?? null,
      elapsedMs: outputData.elapsed_ms ?? null,
    };
  }
  const rawBreakdown = outputData.rawBreakdown ?? outputData.rawResult ?? outputData.result ?? outputData.finalBreakdown;
  const versions = buildBreakdownVersions(
    rawBreakdown,
    outputData.cleanedBreakdown ?? outputData.cleanedResult,
    outputData.breakdownVersion === CURRENT_BREAKDOWN_VERSION ? outputData.finalBreakdown : null,
    logContext,
  );
  const previews = outputData.finalBreakdown?.previews || outputData.result?.previews;
  if (previews && versions.finalBreakdown && typeof versions.finalBreakdown === 'object') {
    versions.finalBreakdown = { ...versions.finalBreakdown, previews };
  }
  return {
    rawUnderstandingResult: versions.rawBreakdown,
    normalizedBreakdown: legacyToFineBreakdown(versions.finalBreakdown, {
      modelName: 'legacy-video-to-text', modelVersion: `breakdown-v${versions.breakdownVersion}`,
    }),
    modelName: 'legacy-video-to-text', modelVersion: `breakdown-v${versions.breakdownVersion}`,
    breakdownVersion: FINE_BREAKDOWN_VERSION, provider: 'legacy_migration', fallback: true,
    usage: {}, estimatedCost: null, elapsedMs: null,
  };
}

function parseVideoTime(value) {
  const first = String(value || "").split(/[-–—]/)[0].trim();
  const parts = first.split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function parseVideoTimeRange(value) {
  const parts = String(value || "").split(/[-–—]/);
  return {
    start: parseVideoTime(parts[0]),
    end: parts.length > 1 ? parseVideoTime(parts[1]) : null,
  };
}

async function probeVideo(filePath) {
  const stdout = await runMediaCommand(FFPROBE_PATH, [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration", "-of", "json", filePath,
  ], "ffprobe");
  const data = JSON.parse(stdout);
  return {
    duration: Math.max(1, Number(data.format?.duration) || 1),
    width: Number(data.streams?.[0]?.width) || 0,
    height: Number(data.streams?.[0]?.height) || 0,
  };
}

async function sourceVideoHasAudio(filePath) {
  const stdout = await runMediaCommand(FFPROBE_PATH, [
    "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type",
    "-of", "json", filePath,
  ], "原视频音轨检测");
  const data = JSON.parse(stdout);
  return Array.isArray(data.streams) && data.streams.some((stream) => stream.codec_type === "audio");
}

async function mergeOriginalAudio(generatedVideoPath, sourceVideoPath, finalOutputPath, clipStart, clipEnd) {
  if (!sourceVideoPath || !fs.existsSync(sourceVideoPath)) {
    console.log("[generate-video] 未找到原视频文件，返回无音频生成视频");
    return generatedVideoPath;
  }
  try {
    const hasAudio = await sourceVideoHasAudio(sourceVideoPath);
    if (!hasAudio) {
      console.log("[generate-video] 原视频没有音轨，返回无音频生成视频");
      return generatedVideoPath;
    }
    const generatedInfo = await probeVideo(generatedVideoPath);
    const start = Math.max(0, Number(clipStart) || 0);
    const requestedEnd = Number(clipEnd);
    const segmentDuration = Number.isFinite(requestedEnd) && requestedEnd > start
      ? requestedEnd - start
      : generatedInfo.duration;
    const sourceAudioDuration = Math.max(0.05, Math.min(segmentDuration, generatedInfo.duration));
    console.log(
      `[generate-video] 音频同步区间：${start.toFixed(3)}s-${(start + sourceAudioDuration).toFixed(3)}s，` +
      `AI 视频时长：${generatedInfo.duration.toFixed(3)}s`
    );
    await runMediaCommand(FFMPEG_PATH, [
      "-i", generatedVideoPath,
      "-ss", start.toFixed(3),
      "-t", sourceAudioDuration.toFixed(3),
      "-i", sourceVideoPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-af", "apad",
      "-t", generatedInfo.duration.toFixed(3),
      "-movflags", "+faststart",
      "-y", finalOutputPath,
    ], "原视频音频合并");
    console.log("[generate-video] 原视频音频合并完成：", finalOutputPath);
    return finalOutputPath;
  } catch (error) {
    console.error("[generate-video] 原视频音频合并失败，返回无音频版本：", error);
    try {
      if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
    } catch {}
    return generatedVideoPath;
  }
}

function previewItems(data) {
  const overview = data.overview || {};
  const list = (value) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  return [
    ...list(data.subjects?.length ? data.subjects : overview.replaceableSubjects).slice(0, 2).map((name) => ({ type: "subject", name })),
    ...list(data.scenes?.length ? data.scenes : overview.replaceableScenes).slice(0, 2).map((name) => ({ type: "scene", name })),
    ...list(data.elements?.length ? data.elements : overview.replaceableElements).slice(0, 4).map((name) => ({ type: "element", name })),
  ];
}

function findPreviewShot(item, shots) {
  return shots.find((shot) => JSON.stringify(shot).includes(item.name)) || null;
}

function findBoundingBox(item, shot) {
  const objects = Array.isArray(shot?.objects) ? shot.objects : [];
  const candidates = [shot?.boundingBox, shot?.bbox, shot?.box, ...objects
    .filter((object) => String(object?.name || object?.label || "").includes(item.name))
    .map((object) => object.boundingBox || object.bbox || object.box)];
  return candidates.find((box) => Array.isArray(box) && box.length >= 4) || null;
}

function cropFilter(item, bbox, videoInfo) {
  if (item.type === "scene") return "scale='min(720,iw)':-2";
  if (bbox && videoInfo.width && videoInfo.height) {
    let [x, y, width, height] = bbox.map(Number);
    if ([x, y, width, height].every(Number.isFinite)) {
      if (Math.max(x, y, width, height) <= 1) {
        x *= videoInfo.width; width *= videoInfo.width;
        y *= videoInfo.height; height *= videoInfo.height;
      }
      x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
      width = Math.max(2, Math.min(videoInfo.width - x, Math.floor(width)));
      height = Math.max(2, Math.min(videoInfo.height - y, Math.floor(height)));
      return `crop=${width}:${height}:${x}:${y},scale=480:-2`;
    }
  }
  const ratio = item.type === "subject" ? 0.62 : 0.48;
  return `crop=trunc(iw*${ratio}/2)*2:trunc(ih*${ratio}/2)*2:(iw-ow)/2:(ih-oh)/2,scale=480:-2`;
}

async function generateBreakdownPreviews(result, videoPath, taskId) {
  const data = parseBreakdownJson(result);
  if (!data) return result;
  const videoInfo = await probeVideo(videoPath);
  const shots = Array.isArray(data.shots) ? data.shots : [];
  const items = previewItems(data);
  const outputDir = path.join("/tmp/openclaw/rh-output/previews", taskId);
  fs.mkdirSync(outputDir, { recursive: true });
  const previews = { subjects: [], scenes: [], elements: [] };
  const usedSceneTimes = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const shot = findPreviewShot(item, shots);
    const hasNumericStart = shot?.startTime !== null && shot?.startTime !== undefined && Number.isFinite(Number(shot.startTime));
    const parsedTime = hasNumericStart ? Number(shot.startTime) : parseVideoTime(shot?.time);
    let time = Math.min(videoInfo.duration - 0.05, Math.max(0, parsedTime ?? ((index + 1) / (items.length + 1)) * videoInfo.duration));
    if (item.type === "scene") {
      if (usedSceneTimes.some((used) => Math.abs(used - time) < 0.25)) {
        const sceneIndex = usedSceneTimes.length + 1;
        time = Math.min(videoInfo.duration - 0.05, (sceneIndex / 3) * videoInfo.duration);
      }
      usedSceneTimes.push(time);
    }
    const outputName = `${item.type}-${index}.jpg`;
    const outputPath = path.join(outputDir, outputName);
    try {
      const bbox = findBoundingBox(item, shot);
      await runMediaCommand(FFMPEG_PATH, [
        "-ss", time.toFixed(3), "-i", videoPath, "-frames:v", "1",
        "-vf", cropFilter(item, bbox, videoInfo), "-q:v", "3", "-y", outputPath,
      ], "FFmpeg 截帧");
      const record = {
        name: item.name,
        time,
        ...((shot?.time || hasNumericStart) ? { timeRange: shot.time || `${shot.startTime}-${shot.endTime}` } : {}),
        ...(bbox ? { boundingBox: bbox } : {}),
        [`${item.type}PreviewUrl`]: `/generated/previews/${taskId}/${outputName}`,
      };
      if (item.type === "subject") record.subjectTime = time;
      if (item.type === "element") record.elementTime = time;
      if (item.type === "scene") {
        const range = hasNumericStart
          ? { start: Number(shot.startTime), end: Number.isFinite(Number(shot.endTime)) ? Number(shot.endTime) : null }
          : parseVideoTimeRange(shot?.time);
        record.sceneStartTime = range.start ?? time;
        record.sceneEndTime = range.end ?? Math.min(videoInfo.duration, time + 1);
      }
      previews[`${item.type}s`].push(record);
    } catch (error) {
      console.warn(`预览生成失败 ${item.type}/${item.name}:`, error.message);
    }
  }
  return { ...data, previews };
}

const DEFAULT_PROMPT = `
请拆解用户上传的视频，并只返回严格 JSON，不要 Markdown，不要解释。

返回结构：
{
  "overview": {
    "referenceVideo": "一句话概括视频内容",
    "shotCount": 0,
    "replaceableSubjects": [],
    "replaceableScenes": [],
    "replaceableElements": [],
    "replaceableText": []
  },
  "shots": [
    {
      "id": "shot1",
      "title": "镜头1｜简短标题",
      "time": "00:00-00:03",
      "description": "画面描述",
      "people": "人物/主体",
      "scene": "主要场景",
      "elements": [],
      "replaceable": [],
      "suggestKeep": [],
      "action": "动作",
      "expressions": "表情变化",
      "emotion": "情绪及变化",
      "dialogue": "语音识别到的对白或旁白；未执行或失败时写对白尚未识别",
      "sound": "环境声、动作声和音乐信息",
      "camera": "镜头结构",
      "rhythm": "节奏"
    }
  ]
}

规则：
1. replaceableSubjects 只返回可单独替换的人、动物、角色，不要返回情侣、伴侣、夫妻、新人、两人、一对、组合、人群等关系词。
2. replaceableScenes 只返回主要空间/场景，数量接近镜头数，通常 3-4 个；不要把树木、灯光、草地、门窗、远处背景等细节当场景。
3. replaceableElements 只返回对画面主题、用户改造意图或生成结果有明显影响的关键视觉元素，数量控制在 3-6 个。优先返回画面中心、面积较大、辨识度高、主体正在使用或互动的物体。不要返回背景杂物、重复物品、同义词重复项、体积很小的细节、线缆、支架、边角、光线、阴影、墙面、桌面、地面等低价值元素。若多个名称指向同一物体，只保留一个最通用名称。
4. 如果没有文字或字幕，replaceableText 返回空数组。
5. 不要编造视频中不存在的内容。
6. 物理镜头没有切换时，如果对白说话人、关键动作、表情、情绪或主体状态明显变化，在shots中按动作阶段分别输出；必须沿用可确认时间，没有可靠时间时time写未确认时间，禁止平均分配。
7. 字幕和对白分开判断；没有字幕不代表没有对白。语音识别未执行或失败时dialogue写对白尚未识别，禁止写无明确台词或旁白。
`;

app.post("/api/video-to-text", upload.single("video"), async (req, res) => {
  try {
    console.log("收到视频拆解请求：", req.file?.originalname, req.file?.size);
    if (!process.env.RUNNINGHUB_API_KEY) {
      return sendApiError(res, 503, 'MODEL_UNAVAILABLE', "模型服务尚未配置");
    }

    if (!req.file) {
      return sendApiError(res, 400, "没有收到视频文件");
    }
    logger.info({
      requestId: req.requestId, userId: req.user.id,
      action: 'video_analysis.request_upload_received', status: 'success',
      durationMs: Date.now() - req.requestStartedAt,
      metadata: { bytes: req.file.size },
    });

    const prompt = req.body.prompt || DEFAULT_PROMPT;
    const projectId = String(req.body.projectId || "").trim();
    if (!projectId) return sendApiError(res, 400, "缺少 projectId");
    const ownedProject = await projectAssetService().getProject(projectId, req.user.id);
    if (!ownedProject) return sendApiError(res, 404, "Project 不存在或无权访问");
    const videoPath = path.resolve(req.file.path);
    if (!fs.existsSync(videoPath)) {
      return sendApiError(res, 500, `上传视频文件不存在：${videoPath}`);
    }

    const persistedTask = await taskResultService().createTask({
      projectId,
      userId: req.user.id,
      taskType: "video_to_text",
      status: "analyzing",
      stage: "selecting_understanding_provider",
      inputData: {
        prompt,
        originalAssetId: String(req.body.originalAssetId || "").trim(),
        originalVideoUrl: String(req.body.originalVideoUrl || "").trim(),
        originalVideoPath: ownedProject.assets?.find((asset) => asset.id === ownedProject.original_asset_id)?.storage_path || "",
        requestId: req.requestId,
        understandingProvider: 'runninghub_llm',
        understandingModel: process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_RUNNINGHUB_GEMINI_MODEL,
      },
      idempotencyKey: String(req.body.idempotencyKey || req.headers['x-idempotency-key'] || '').trim() || null,
    });
    const taskId = persistedTask.id;
    if (persistedTask.idempotent) {
      logger.info({ requestId: req.requestId, userId: req.user.id, projectId, taskId, action: 'task.video_analysis.duplicate', status: persistedTask.status, errorCode: 'TASK_DUPLICATE' });
      return res.status(200).json({ ok: true, status: persistedTask.status, taskId, idempotent: true });
    }
    recordAnalytics({ eventName: "video_analysis_start", userId: req.user.id, projectId, taskId, properties: {} });
    const task = {
      taskId,
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
      elapsed: 0,
      videoPath,
      result: null,
      rawResult: null,
      error: "",
    };
    videoToTextTasks.set(taskId, task);

    console.log("开始后台执行视频理解，本地 taskId:", taskId, "provider: runninghub_llm", "model:", process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_RUNNINGHUB_GEMINI_MODEL);
    res.status(202).json({ ok: true, status: "running", taskId });

    coreSkillService().execute('video_understanding', {
      project_id: projectId, task_id: taskId, video_path: videoPath, prompt,
      original_asset_id: String(req.body.originalAssetId || '').trim() || null,
    }, {
      requestId: req.requestId, userId: req.user.id, projectId, taskId,
      skillName: 'video_understanding', modelName: process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_RUNNINGHUB_GEMINI_MODEL,
    }, () => runFineVideoUnderstanding({
      videoPath,
      videoUrl: String(req.body.originalVideoUrl || '').trim(),
      requestId: req.requestId,
      userId: req.user.id,
      projectId,
      taskId,
      onFallbackSubmitted: async (externalTaskId) => taskResultService().updateTask(taskId, {
        external_task_id: externalTaskId,
        status: "analyzing",
        stage: "fallback_analyzing",
      }),
      onFallbackPoll: async () => taskResultService().updateTask(taskId, { status: "analyzing", stage: "fallback_polling" }),
      onFallbackRetry: async (retryError, attempt) => {
        await taskResultService().updateTask(taskId, { retry_count: attempt, stage: 'polling_retry' });
        logger.warn({ requestId: req.requestId, userId: req.user.id, projectId, taskId, action: 'model.poll.retry', status: 'retrying', errorCode: 'MODEL_REQUEST_FAILED', errorMessage: retryError.message, metadata: { attempt } });
      }
    }))
      .then(async (understanding) => {
        task.rawResult = understanding.rawUnderstandingResult;
        let normalizedBreakdown = understanding.normalizedBreakdown;
        try {
          normalizedBreakdown = await generateBreakdownPreviews(normalizedBreakdown, videoPath, taskId);
        } catch (error) {
          console.warn("video-to-text 预览生成整体失败，继续返回拆解结果：", error.message);
        }
        task.status = "success";
        task.finishedAt = Date.now();
        task.elapsed = videoToTextTaskElapsed(task);
        task.result = normalizedBreakdown;
        await taskResultService().updateTask(taskId, {
          status: "success",
          stage: "completed",
          output_data: {
            raw_understanding_result: understanding.rawUnderstandingResult,
            normalized_breakdown: normalizedBreakdown,
            model_name: understanding.modelName,
            model_version: understanding.modelVersion,
            breakdown_version: FINE_BREAKDOWN_VERSION,
            provider: understanding.provider,
            fallback: Boolean(understanding.fallback),
            usage: understanding.usage,
            estimated_cost: understanding.estimatedCost,
            elapsed_ms: understanding.elapsedMs,
            timings: understanding.timings || null,
          },
          error_code: null,
          error_message: null,
        });
        logger.info({
          requestId: req.requestId, userId: req.user.id, projectId, taskId,
          action: 'video_analysis.task_completed', status: 'success',
          durationMs: task.finishedAt - task.startedAt,
          metadata: understanding.timings || { geminiElapsedMs: understanding.elapsedMs },
        });
        recordAnalytics({ eventName: "video_analysis_success", userId: req.user.id, projectId, taskId, properties: { generation_time: task.elapsed } });
        console.log("video-to-text 后台任务成功：", taskId, "provider:", understanding.provider, "model:", understanding.modelName);
      })
      .catch(async (err) => {
        const errorCode = err.code || classifyModelError(err);
        const timedOut = errorCode === 'VIDEO_ANALYSIS_TIMEOUT' || /\u8d85\u65f6|timeout/i.test(getErrorMessage(err, ''));
        task.status = timedOut ? "timeout" : "failed";
        task.finishedAt = Date.now();
        task.elapsed = videoToTextTaskElapsed(task);
        const detailedError = getErrorMessage(err, "未知错误");
        task.error = errorCode === 'VIDEO_ANALYSIS_TIMEOUT'
          ? '视频分析超时，请重新尝试'
          : err.code === 'MODEL_RESULT_INVALID'
            ? '视频拆解结果格式异常，请重新拆解。'
            : '视频拆解失败，请稍后重试。';
        await taskResultService().updateTask(taskId, {
          status: timedOut ? "timeout" : "failed",
          stage: "failed",
          error_code: errorCode,
          error_message: detailedError,
        }).catch((persistError) => console.error("video-to-text 失败状态持久化失败：", persistError));
        logger.error({
          requestId: req.requestId, userId: req.user.id, projectId, taskId,
          action: 'video_analysis.task_completed', status: timedOut ? 'timeout' : 'failed',
          durationMs: task.finishedAt - task.startedAt,
          errorCode, errorMessage: detailedError, metadata: {},
        });
        recordAnalytics({ eventName: "video_analysis_failed", userId: req.user.id, projectId, taskId, properties: { error_code: errorCode, error_message: detailedError } });
        logger.error({
          requestId: req.requestId, userId: req.user.id, projectId, taskId,
          action: 'video_understanding.failed', status: 'failed',
          errorCode, errorMessage: detailedError,
          modelName: err.model || process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_RUNNINGHUB_GEMINI_MODEL,
          metadata: { provider: err.provider || 'runninghub_llm', responseType: err.responseType || null, responseSummary: err.responseSummary || null },
        });
        console.error("video-to-text 后台任务失败：", taskId, err);
      });
  } catch (err) {
    console.error("video-to-text 失败：", err);
    const code = classifyModelError(err);
    return sendApiError(res, ERROR_DEFINITIONS[code][0], code, `视频拆解失败：${getErrorMessage(err, "未知错误")}`);
  }
});

app.get("/api/video-to-text-status", async (req, res) => {
  const taskId = typeof req.query.taskId === "string" ? req.query.taskId.trim() : "";
  if (!taskId) return sendApiError(res, 400, "缺少 taskId");
  try {
    const task = await taskResultService().getTask(taskId, req.user.id);
    if (!task || task.task_type !== "video_to_text") return sendApiError(res, 404, "未找到视频拆解任务");
    const payload = publicPersistedTask(task);
    if (task.error_code === 'MODEL_RESULT_INVALID') {
      payload.error = '视频拆解结果格式异常，请重新拆解。';
    }
    if (task.status === "success") {
      const breakdownOutput = materializeBreakdownOutput(task.output_data || {}, {
        requestId: req.requestId, userId: req.user.id, projectId: task.project_id, taskId: task.id,
      });
      payload.result = breakdownOutput.normalizedBreakdown;
      payload.normalizedBreakdown = breakdownOutput.normalizedBreakdown;
      payload.modelName = breakdownOutput.modelName;
      payload.modelVersion = breakdownOutput.modelVersion;
      payload.breakdownVersion = breakdownOutput.breakdownVersion;
      payload.estimatedCost = breakdownOutput.estimatedCost;
      payload.understandingElapsedMs = breakdownOutput.elapsedMs;
      payload.fallback = breakdownOutput.fallback;
    }
    return res.json(payload);
  } catch (error) {
    return sendApiError(res, 500, `查询视频拆解任务失败：${error.message}`);
  }
});

app.get("/api/generate-config", async (req, res) => {
  try {
    const models = await promptModelService().listActiveModels();
    if (!models.length) return sendApiError(res, 503, "没有启用中的模型配置，请在model_configs中启用至少一个模型");
    const compatibilityFallback = models.some((item) => item._source === 'compatibility_fallback');
    return res.json({
      ok: true,
      models: models.map((item) => ({
        id: item.model_id, label: item.model_name, provider: item.provider,
        durations: item.supported_durations, ratios: item.supported_ratios,
        resolutions: item.supported_resolutions, capability: item.capability,
      })),
      ratios: [...new Set(models.flatMap((item) => item.supported_ratios || []))],
      resolutions: [...new Set(models.flatMap((item) => item.supported_resolutions || []))],
      durations: [...new Set(models.flatMap((item) => item.supported_durations || []))],
      source: compatibilityFallback ? 'compatibility_fallback' : 'database',
      warning: compatibilityFallback ? '数据库尚未执行004 migration；当前仅展示兼容模型，生成与计费保持禁用。' : '',
    });
  } catch (error) {
    return sendApiError(res, 500, `读取模型配置失败：${error.message}`);
  }
});

app.get("/api/billing/account", async (req, res) => {
  try {
    const account = await billingService().getAccount(req.user.id);
    if (!account) return sendApiError(res, 404, "积分账户不存在，请联系管理员初始化");
    return res.json({ ok: true, account });
  } catch (error) {
    return sendApiError(res, 500, `读取积分账户失败：${error.message}`);
  }
});

app.get("/api/billing/transactions", async (req, res) => {
  try {
    const transactions = await billingService().listTransactions(req.user.id, req.query.limit);
    return res.json({ ok: true, transactions });
  } catch (error) {
    return sendApiError(res, 500, `读取积分流水失败：${error.message}`);
  }
});

app.post("/api/generate-price", async (req, res) => {
  try {
    const validatedConfig = await validateVideoConfig(req.body);
    const finalGenerationConfig = buildFinalGenerationConfig(validatedConfig);
    const [quote, account] = await Promise.all([
      quoteGeneration(finalGenerationConfig, validatedConfig.inputVideoDuration),
      billingService().getAccount(req.user.id),
    ]);
    res.json({
      ok: true,
      estimatedPrice: quote.providerCost,
      estimatedCredits: quote.creditCost,
      currency: quote.currency,
      balance: Number(account?.balance || 0),
      frozenBalance: Number(account?.frozen_balance || 0),
      sufficient: Number(account?.balance || 0) >= quote.creditCost,
    });
  } catch (err) {
    return sendApiError(res, 400, `暂时无法计算本次生成费用：${getErrorMessage(err, "请稍后重试")}`);
  }
});

app.post('/api/generate-prompt', async (req, res) => {
  try {
    const projectId = String(req.body.projectId || '').trim();
    if (!projectId) return sendApiError(res, 400, '缺少 projectId');
    const project = await projectAssetService().getProject(projectId, req.user.id);
    if (!project) return sendApiError(res, 404, 'Project 不存在或已失效');

    const breakdown = req.body.videoAnalysis || req.body.normalizedBreakdown || req.body.breakdown || null;
    const replacements = Array.isArray(req.body.replacements) ? req.body.replacements : [];
    const projectAssets = new Map((project.assets || []).map((asset) => [asset.id, asset]));
    const requestedAssets = Array.isArray(req.body.assets) ? req.body.assets : [];
    const referenceAssetIds = Array.isArray(req.body.referenceAssetIds) && req.body.referenceAssetIds.length
      ? req.body.referenceAssetIds
      : requestedAssets.map((asset) => asset?.assetId || asset?.id).filter(Boolean);
    const referenceAssets = referenceAssetIds.map((id) => projectAssets.get(id))
      .filter(isReferenceAsset)
      .map((asset) => ({
        id: asset.id, assetId: asset.id, type: physicalAssetType(asset), purpose: assetPurpose(asset),
        assetRef: asset.asset_ref || '', targetPlaceholderId: asset.target_placeholder_id || '',
        confidence: Number(asset.confidence),
        name: asset.original_filename || '', url: asset.public_url || asset.signed_url || '',
        storagePath: asset.storage_path || '', asset_type: asset.asset_type,
        public_url: asset.public_url, signed_url: asset.signed_url,
      }));
    if (referenceAssets.length !== referenceAssetIds.length) {
      return sendApiError(res, 400, 'ASSET_NOT_FOUND', '部分参考素材不存在或无权访问');
    }
    const submittedReplacements = replacements.filter((item) => {
      const asset = projectAssets.get(item?.asset_id);
      return isReplacementAsset(asset);
    });
    if (!submittedReplacements.length) {
      return sendApiError(res, 400, 'ASSET_NOT_FOUND', '请至少替换 1 个主体、场景或元素，并上传对应参考图片');
    }

    const submittedGenerationConfig = req.body.generationConfig && typeof req.body.generationConfig === 'object'
      ? req.body.generationConfig
      : {};
    const sourceDuration = resolveSourceVideoDuration({ source: req.body.source, videoAnalysis: breakdown });
    const requestedModelId = String(req.body.model || submittedGenerationConfig.modelId || SEEDANCE_2_MODEL_ID).trim();
    const modelRecord = await promptModelService().getActiveModel(requestedModelId);
    const promptModelConfig = validatePromptModelSelection(modelRecord, {
      aspectRatio: req.body.aspectRatio || submittedGenerationConfig.aspectRatio,
      resolution: req.body.resolution || submittedGenerationConfig.resolution,
    });
    const templateType = selectTemplateType(submittedReplacements);
    const [template, previousPrompt] = await Promise.all([
      promptModelService().getActiveTemplate(templateType),
      promptModelService().getLatestProjectPrompt(projectId, req.user.id),
    ]);
    const userRequirement = String(req.body.userRequirement ?? req.body.extraPrompt ?? '');
    const assetBindings = buildPromptAssetBindings(submittedReplacements, referenceAssets);
    const generationConfig = {
      modelId: promptModelConfig.model.id, modelName: promptModelConfig.model.label,
      aspectRatio: promptModelConfig.ratio,
      resolution: promptModelConfig.resolution,
    };
    const source = { videoDuration: sourceDuration };
    const requestContext = req.body.context && typeof req.body.context === 'object' ? req.body.context : {};
    const agentContext = {
      projectId,
      previousCreativePlan: requestContext.previousCreativePlan || previousPrompt?.model_params?.director?.creativePlan || null,
      previousPrompt: requestContext.previousPrompt || previousPrompt?.generated_prompt || '',
      generationCount: Number(requestContext.generationCount) || Number(previousPrompt?.version) || 0,
      history: Array.isArray(requestContext.history) ? requestContext.history : [],
      userPreference: requestContext.userPreference && typeof requestContext.userPreference === 'object' ? requestContext.userPreference : {},
    };
    const logContext = { requestId: req.requestId, userId: req.user.id, projectId };
    let creativePlan = null;
    let promptResult = null;
    let directorResult = null;
    let creativePlanSource = 'director_agent';
    let promptSource = 'seedance_prompt_generator';
    try {
      directorResult = await directorAgentService().generate({
        source, videoAnalysis: breakdown, replacements: submittedReplacements, assets: referenceAssets,
        userRequirement, generationConfig, context: agentContext, assetBindings,
      }, logContext);
      creativePlan = directorResult.creativePlan;
      promptResult = await promptGeneratorService().generate({ source, creativePlan, assetBindings, generationConfig }, logContext);
      promptSource = promptResult.mode;
    } catch (directorError) {
      creativePlanSource = 'buildSeedancePrompt_fallback';
      promptSource = 'buildSeedancePrompt_fallback';
      logger.warn({ ...logContext, action: 'generate_prompt.director_fallback', status: 'fallback', errorCode: directorError.code || 'MODEL_RESULT_INVALID', errorMessage: directorError.message });
      const fallback = buildSeedancePrompt({
        breakdown, replacements: submittedReplacements, referenceAssets,
        duration: sourceDuration, ratio: promptModelConfig.ratio,
        audioReferenceSupported: true,
      });
      promptResult = {
        finalPrompt: fallback.prompt,
        references: fallback.assetBindings.map((item) => item.reference),
        negativeConstraints: [], warnings: [`Director Agent 调用失败，已回退固定 Prompt：${directorError.code || 'MODEL_RESULT_INVALID'}`],
        mode: 'buildSeedancePrompt_fallback', attempts: 2,
      };
    }
    const promptSnapshot = buildPromptSnapshot({
      template, breakdown, replacements: submittedReplacements,
      userRequirement, modelId: promptModelConfig.model.id,
      modelParams: {
        source_duration: sourceDuration,
        aspect_ratio: promptModelConfig.ratio,
        resolution: promptModelConfig.resolution,
        model_id: promptModelConfig.model.id,
        model_name: promptModelConfig.model.label,
        model_provider: promptModelConfig.model.provider || '',
        model_endpoint: promptModelConfig.model.endpoint || '',
        director: { creativePlan, source: creativePlanSource },
      },
      previous: previousPrompt, generatedPromptOverride: promptResult.finalPrompt,
    });
    const warnings = [...new Set([...(directorResult?.warnings || []), ...(promptResult.warnings || [])])];
    const mappings = assetBindings.map((binding) => ({
      ...binding,
      group: binding.purposeLabel || binding.purpose,
      name: binding.targetPlaceholderId || binding.purposeLabel || binding.purpose,
    }));
    return res.json({
      success: true,
      creativePlan: creativePlan || {},
      finalPrompt: promptSnapshot.generated_prompt,
      assetBindings,
      references: promptResult.references || [],
      negativeConstraints: promptResult.negativeConstraints || [],
      warnings,
      source: { creativePlan: creativePlanSource, prompt: promptSource },
      // Compatibility fields consumed by the current front-end flow.
      ok: true,
      prompt: promptSnapshot.generated_prompt,
      automaticPrompt: promptSnapshot.generated_prompt,
      promptStatus: 'draft',
      promptSource: 'system_generated',
      mappings,
      duration: sourceDuration,
      sourceDuration,
      segments: creativePlan?.timeline || [],
    });
  } catch (err) {
    console.error('generate-prompt 失败：', err);
    return sendApiError(res, 400, 'TASK_STATE_INVALID', getErrorMessage(err, '生成 Prompt 失败'));
  }
});

app.post("/api/generate-video", upload.single("image"), async (req, res) => {
  try {
  if (!process.env.RUNNINGHUB_API_KEY) {
    return sendApiError(res, 503, 'MODEL_UNAVAILABLE', "模型服务尚未配置");
  }

  if (!req.file) {
    return sendApiError(res, 400, "没有收到生成图片");
  }

  const breakdown = parseJsonFormField(req.body.breakdown, null);
  const replacements = parseJsonFormField(req.body.replacements, null);
  const validatedConfig = await validateVideoConfig(req.body);
  const finalGenerationConfig = buildFinalGenerationConfig(validatedConfig);
  const projectId = String(req.body.projectId || "").trim();
  if (!projectId) return sendApiError(res, 400, "缺少 projectId");
  const project = await projectAssetService().getProject(projectId, req.user.id);
  if (!project) return sendApiError(res, 404, "Project 不存在或已失效");
  const submittedReplacements = Array.isArray(replacements) ? replacements : [];
  const referenceAssetIds = parseJsonFormField(req.body.referenceAssetIds, []);
  const projectAssets = new Map((project.assets || []).map((asset) => [asset.id, asset]));
  const validReplacementAssets = submittedReplacements.map((item) => projectAssets.get(item?.asset_id))
    .filter(isReplacementAsset);
  if (!validReplacementAssets.length || validReplacementAssets.length !== submittedReplacements.length) {
    return sendApiError(res, 400, 'ASSET_NOT_FOUND', '请至少替换 1 个主体、场景或元素，并上传对应参考图片');
  }
  const validReferenceAssets = (Array.isArray(referenceAssetIds) ? referenceAssetIds : [])
    .map((id) => projectAssets.get(id))
    .filter(isReferenceAsset);
  if (validReferenceAssets.length !== (Array.isArray(referenceAssetIds) ? referenceAssetIds.length : 0)) {
    return sendApiError(res, 400, 'ASSET_NOT_FOUND', '部分参考素材不存在或无权访问');
  }
  const submittedPromptStatus = String(req.body.promptStatus || '').trim();
  if (submittedPromptStatus === 'stale') {
    return sendApiError(res, 409, 'TASK_STATE_INVALID', '素材或生成配置已变化，请重新生成 Prompt。');
  }
  const submittedPrompt = String(req.body.prompt || '').trim();
  if (!submittedPrompt) return sendApiError(res, 400, 'TASK_STATE_INVALID', '请先生成并确认 Prompt。');
  const templateType = selectTemplateType(submittedReplacements);
  const [template, previousPrompt] = await Promise.all([
    promptModelService().getActiveTemplate(templateType),
    promptModelService().getLatestProjectPrompt(projectId, req.user.id),
  ]);
  const clipStart = Math.max(0, Number(req.body.clipStart) || 0);
  const requestedClipEnd = Number(req.body.clipEnd);
  const clipEnd = Number.isFinite(requestedClipEnd) && requestedClipEnd > clipStart
    ? requestedClipEnd
    : clipStart + finalGenerationConfig.duration;
  const billingQuote = await quoteGeneration(finalGenerationConfig, validatedConfig.inputVideoDuration);
  const persistedGenerationConfig = buildPersistedGenerationConfig(finalGenerationConfig, {
    clipStart, clipEnd,
    generateAudio: true,
    inputVideoDuration: validatedConfig.inputVideoDuration,
    estimatedBillingSeconds: billingQuote.estimatedBillingSeconds,
  });
  const promptSnapshot = buildConfirmedPromptSnapshot({
    template, finalPrompt: submittedPrompt,
    automaticPrompt: String(req.body.automaticPrompt || submittedPrompt).trim(),
    promptSource: req.body.promptSource,
    editedAt: req.body.editedAt || null,
    replacements: submittedReplacements,
    userRequirement: req.body.extraPrompt || '',
    modelId: finalGenerationConfig.model.id,
    modelParams: persistedGenerationConfig,
    previous: previousPrompt,
  });
  const prompt = promptSnapshot.generated_prompt;
  if (!prompt.trim()) return sendApiError(res, 400, "生成Prompt不能为空");
  const embeddedPromptDuration = promptGenerationDuration(prompt);
  if (embeddedPromptDuration !== null && embeddedPromptDuration !== finalGenerationConfig.duration) {
    logger.info({
      requestId: req.requestId, userId: req.user.id, projectId,
      action: 'generation.prompt_target_duration_mismatch', status: 'accepted',
      metadata: { promptDuration: embeddedPromptDuration, targetDuration: finalGenerationConfig.duration },
    });
  }
  validatePromptImageMappings(prompt, validReplacementAssets.length + validReferenceAssets.filter((asset) => physicalAssetType(asset) === 'image').length, { requiredCount: validReplacementAssets.length });
  const imagePath = path.resolve(req.file.path);
  if (!fs.existsSync(imagePath)) {
    return sendApiError(res, 500, `上传图片文件不存在：${imagePath}`);
  }
  const persistedTask = await taskResultService().createTask({
    projectId,
    userId: req.user.id,
    taskType: "generate_video",
    status: "created",
    stage: "billing_pending",
    inputData: buildGenerationTaskInput({
      prompt, breakdown, replacements, extraPrompt: req.body.extraPrompt || "",
      sourceVideoTaskId: String(req.body.sourceVideoTaskId || "").trim(),
      sourceVideoUrl: project.assets?.find((asset) => asset.id === project.original_asset_id)?.public_url || "",
      sourceVideoStoragePath: project.assets?.find((asset) => asset.id === project.original_asset_id)?.storage_path || "",
      generationConfig: persistedGenerationConfig, clipStart, clipEnd, promptSnapshot, billingQuote,
      promptDuration: embeddedPromptDuration,
    }),
    idempotencyKey: String(req.body.idempotencyKey || req.headers['x-idempotency-key'] || '').trim() || null,
  });
  const taskId = persistedTask.id;
  if (persistedTask.idempotent) {
    const existingResult = await taskResultService().getResultByTask(taskId, req.user.id).catch(() => null);
    logger.info({ requestId: req.requestId, userId: req.user.id, projectId, taskId, action: 'task.generation.duplicate', status: persistedTask.status, errorCode: 'TASK_DUPLICATE' });
    return res.status(200).json({ ok: true, status: persistedTask.status, taskId, idempotent: true, result: existingResult ? await materializeResult(existingResult) : null });
  }
  recordAnalytics({ eventName: "generation_submit", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: { duration: finalGenerationConfig.duration, resolution: finalGenerationConfig.resolution, aspect_ratio: finalGenerationConfig.ratio, model_name: finalGenerationConfig.model.label, prompt_length: prompt.length, template_type: templateType, estimated_cost: billingQuote.creditCost } });
  let freezeOutcome;
  try {
    freezeOutcome = await billingService().freezeTask({
      taskId, userId: req.user.id, creditCost: billingQuote.creditCost, providerCost: billingQuote.providerCost,
    });
  } catch (billingError) {
    const insufficient = /INSUFFICIENT_CREDITS/i.test(billingError.message || "");
    await taskResultService().updateTask(taskId, {
      status: "cancelled", stage: "billing_rejected",
      error_code: insufficient ? "BALANCE_INSUFFICIENT" : "POINTS_FREEZE_FAILED",
      error_message: insufficient ? "积分余额不足" : `积分冻结失败：${billingError.message}`,
    }).catch(() => {});
    recordAnalytics({ eventName: insufficient ? "insufficient_balance" : "generation_cancelled", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: { error_code: insufficient ? "BALANCE_INSUFFICIENT" : "POINTS_FREEZE_FAILED" } });
    return sendApiError(res, insufficient ? 402 : 500, insufficient ? 'BALANCE_INSUFFICIENT' : 'POINTS_FREEZE_FAILED', insufficient ? "积分余额不足，无法提交生成任务" : `积分冻结失败：${billingError.message}`);
  }
  await taskResultService().updateTask(taskId, { status: "queued", stage: "queued" });
  recordAnalytics({ eventName: "points_frozen", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: { estimated_cost: billingQuote.creditCost } });
  recordAnalytics({ eventName: "generation_queued", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: {} });
  const generatedOutputFile = path.join("/tmp/openclaw/rh-output", `${taskId}-video.mp4`);
  const sourceVideoTaskId = String(req.body.sourceVideoTaskId || "").trim();
  const generationAssetBindings = buildPromptAssetBindings(submittedReplacements, validReferenceAssets);
  const {
    imageUrls: seedanceImageUrls,
    videoUrls: seedanceVideoUrls,
    audioUrls: seedanceAudioUrls,
  } = orderAssetsForSeedance(generationAssetBindings, [...validReplacementAssets, ...validReferenceAssets]);
  const task = {
    status: "running",
    startedAt: Date.now(),
    finishedAt: null,
    elapsed: 0,
    videoUrl: "",
    outputFile: "",
    cost: "",
    error: "",
    result: null,
    finalPrompt: prompt,
    sourceVideoTaskId,
    sourceVideoPath: "",
    sourceVideoAddress: sourceVideoTaskId ? `/api/video-to-text-status?taskId=${sourceVideoTaskId}` : "",
    clipStart,
    clipEnd,
    generatedDuration: finalGenerationConfig.duration,
    config: persistedGenerationConfig,
    billingQuote,
  };
  generationTasks.set(taskId, task);

  console.log("收到视频生成请求：", req.file?.originalname, req.file?.size, "本地 taskId:", taskId);
  console.log("[generate-video] final prompt:", prompt);
  let lastPersistedRetryAttempt = 0;
  await taskResultService().updateTask(taskId, { status: "generating", stage: "submitting" });
  recordAnalytics({ eventName: "generation_started", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: {} });
  res.status(202).json({
    ok: true, status: "running", taskId,
    estimatedCredits: billingQuote.creditCost,
    balance: freezeOutcome?.balance,
    frozenBalance: freezeOutcome?.frozen_balance,
  });
  const providerExecutor = () => runSeedance2Generation({
      imagePath: '', imageUrls: seedanceImageUrls, videoUrls: seedanceVideoUrls, audioUrls: seedanceAudioUrls, prompt, config: finalGenerationConfig,
      outputFile: generatedOutputFile, requestId: req.requestId,
      onSubmitted: async (externalTaskId) => {
        await taskResultService().updateTask(taskId, {
          external_task_id: externalTaskId, status: 'generating', stage: 'polling',
        });
      },
      onRetry: async (_error, attempt) => {
        lastPersistedRetryAttempt = Math.max(lastPersistedRetryAttempt, attempt);
        await taskResultService().updateTask(taskId, { retry_count: attempt, stage: 'polling_retry' });
      },
    });
  coreSkillService().execute('video_generation', {
    project_id: projectId, task_id: taskId, image_path: imagePath, prompt,
    model_id: finalGenerationConfig.model.id, model_endpoint: finalGenerationConfig.model.endpoint,
    duration: finalGenerationConfig.duration, aspect_ratio: finalGenerationConfig.ratio, resolution: finalGenerationConfig.resolution,
    source_video_storage_path: persistedTask.input_data?.sourceVideoStoragePath || null,
  }, {
    requestId: req.requestId, userId: req.user.id, projectId, taskId,
    skillName: 'video_generation', modelName: persistedGenerationConfig.model_name,
  }, providerExecutor)
    .then(async (stdout) => {
      const parsed = parseGenerationOutput(stdout);
      if (!parsed.outputFile || !parsed.videoUrl) {
        throw new Error("RunningHub 生成完成但未返回输出视频文件");
      }
      const outputFile = parsed.outputFile;
      const videoUrl = `/generated/${encodeURIComponent(path.basename(outputFile))}`;
      const finalResult = stdout.replace(
        /OUTPUT_FILE:\s*[^\r\n]+/,
        `OUTPUT_FILE:${outputFile}`
      );
      task.status = "success";
      task.finishedAt = Date.now();
      task.elapsed = generationTaskElapsed(task);
      task.videoUrl = videoUrl;
      task.outputFile = outputFile;
      task.cost = parsed.cost;
      task.result = finalResult;
      const actualProviderCost = numeric(billingQuote.providerCost);
      const actualCreditCost = calculateCreditCost({
        costRule: billingQuote.costRule, providerCost: actualProviderCost,
        duration: persistedGenerationConfig.duration, resolution: persistedGenerationConfig.resolution,
        aspectRatio: persistedGenerationConfig.aspect_ratio,
      });
      const beforeUpload = await checkGenerationFinalization(taskId, req.user.id);
      if (beforeUpload.existingResult) {
        await billingService().settleTask({
          taskId, userId: req.user.id, creditCost: actualCreditCost, providerCost: actualProviderCost,
        });
        await taskResultService().updateTask(taskId, { status: "success", stage: "completed", error_code: null, error_message: null });
        task.videoUrl = beforeUpload.existingResult.video_url;
        console.log("[generate-video] Result 已存在，跳过重复收口：", taskId);
        return;
      }
      const { asset: resultAsset, result: persistedResult } = await deliverGeneratedResult({
        uploadAsset: () => projectAssetService().uploadAsset({
          projectId, userId: req.user.id, assetType: "video", purpose: 'generated_video', sourceTaskId: taskId,
          file: {
            originalname: `${taskId}.mp4`, mimetype: "video/mp4",
            size: fs.statSync(outputFile).size, buffer: fs.readFileSync(outputFile),
          },
        }),
        createResult: (asset) => taskResultService().createResult({
          projectId, userId: req.user.id, taskId, videoUrl: asset.storage_path, prompt,
          modelName: persistedGenerationConfig.model_name, modelParams: persistedGenerationConfig,
          duration: persistedGenerationConfig.duration, cost: parsed.cost, promptSnapshot,
          providerCost: actualProviderCost, creditCost: actualCreditCost,
        }),
        settleBilling: async () => {
          try {
            await billingService().settleTask({
              taskId, userId: req.user.id, creditCost: actualCreditCost, providerCost: actualProviderCost,
            });
          } catch (billingError) {
            throw appError('POINTS_CHARGE_FAILED', `积分结算失败：${billingError.message}`);
          }
        },
        markSuccess: ({ asset, result }) => taskResultService().updateTask(taskId, {
          status: "success", stage: "completed",
          output_data: {
            videoUrl: asset.storage_path, assetId: asset.id, finalPrompt: prompt, cost: parsed.cost,
            providerCost: actualProviderCost, creditCost: actualCreditCost,
            config: task.config, version: result.version,
          },
          error_code: null, error_message: null,
        }),
        deleteResult: () => taskResultService().deleteResultByTask(taskId, req.user.id),
        deleteAsset: (asset) => projectAssetService().deleteAsset(projectId, asset.id, req.user.id),
      });
      recordAnalytics({ eventName: "points_charged", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: { actual_cost: actualCreditCost, provider_cost: actualProviderCost } });
      recordAnalytics({ eventName: "generation_success", userId: req.user.id, projectId, taskId, resultId: persistedResult.id, modelId: finalGenerationConfig.model.id, properties: { duration: persistedGenerationConfig.duration, resolution: persistedGenerationConfig.resolution, aspect_ratio: persistedGenerationConfig.aspect_ratio, model_name: persistedGenerationConfig.model_name, generation_time: task.elapsed, actual_cost: actualCreditCost, version: persistedResult.version } });
      task.videoUrl = resultAsset.public_url;
      console.log("generate-video 后台任务成功：", taskId, outputFile);
    })
    .catch(async (err) => {
      const currentTask = await taskResultService().getTask(taskId, req.user.id).catch(() => null);
      if (currentTask?.status === "cancelled" || err.code === "TASK_CANCELLED") {
        await releaseFailedTaskBilling(taskId, req.user.id, task.cost).catch((error) => {
          console.error("cancelled Task 积分处理失败：", taskId, error.message);
        });
        task.status = "cancelled";
        task.error = "任务已取消";
        console.log("generate-video 完成回调已忽略 cancelled Task：", taskId);
        return;
      }
      task.status = "failed";
      task.finishedAt = Date.now();
      task.elapsed = generationTaskElapsed(task);
      task.error = getErrorMessage(err, "RunningHub 视频生成失败");
      const timedOut = /超时|timeout/i.test(task.error);
      const upstreamErrorCode = err.upstreamErrorCode ?? err.code ?? classifyModelError(err);
      await releaseFailedTaskBilling(taskId, req.user.id, task.cost, {
        forceFullRefund: !currentTask?.external_task_id
          || ['storage_upload', 'result_create', 'billing_settle', 'task_complete'].includes(err.deliveryStage),
      }).catch((error) => {
        console.error("失败 Task 积分退款失败：", taskId, error.message);
      });
      await taskResultService().updateTask(taskId, {
        status: timedOut ? "timeout" : "failed",
        stage: "failed",
        error_code: timedOut ? "TASK_TIMEOUT" : String(upstreamErrorCode),
        error_message: task.error,
      }).catch((persistError) => console.error("generate-video 失败状态持久化失败：", persistError));
      recordAnalytics({ eventName: timedOut ? "generation_timeout" : "generation_failed", userId: req.user.id, projectId, taskId, modelId: finalGenerationConfig.model.id, properties: { error_code: timedOut ? "TASK_TIMEOUT" : String(upstreamErrorCode), error_message: task.error, generation_time: task.elapsed } });
      console.error("generate-video 后台任务失败：", taskId, err);
    });
  } catch (err) {
    console.error("generate-video 失败：", err);
    const message = getErrorMessage(err, "RunningHub 视频生成失败");
    const code = message.includes('所选') ? 'TASK_STATE_INVALID' : classifyModelError(err);
    return sendApiError(res, message.includes("所选") ? 400 : ERROR_DEFINITIONS[code][0], code, message);
  }
});

app.get("/api/generate-status", async (req, res) => {
  const taskId = typeof req.query.taskId === "string" ? req.query.taskId.trim() : "";
  if (!taskId) return sendApiError(res, 400, "缺少 taskId");
  try {
    const task = await taskResultService().getTask(taskId, req.user.id);
    if (!task || task.task_type !== "generate_video") return sendApiError(res, 404, "未找到生成任务");
    const result = task.status === "success" ? await taskResultService().getResultByTask(task.id, req.user.id) : null;
    const safeResult = result ? await materializeResult(result) : null;
    if (safeResult) safeResult.prompt_version = await promptModelService().getPromptByResult(result.id, req.user.id);
    return res.json(publicPersistedTask(task, safeResult));
  } catch (error) {
    return sendApiError(res, 500, `查询生成任务失败：${error.message}`);
  }
});

app.get("/api/download-video", async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId.trim() : "";
    const version = typeof req.query.version === "string" ? req.query.version.trim() : "";
    if (!projectId) return sendApiError(res, 400, "缺少 projectId");
    if (!/^V\d+$/.test(version)) return sendApiError(res, 400, "版本号无效");
    const project = await projectAssetService().getProject(projectId, req.user.id);
    if (!project) return sendApiError(res, 404, "Project 不存在或无权访问");
    const results = await taskResultService().listProjectResults(projectId, req.user.id);
    const result = results.find((item) => Number(item.version) === Number(version.slice(1)));
    if (!result) return sendApiError(res, 404, "生成版本不存在");
    const safeResult = await materializeResult(result);
    const response = await fetch(safeResult.video_url);
    if (!response.ok) return sendApiError(res, 502, `读取生成视频失败：HTTP ${response.status}`);
    res.setHeader("Content-Type", response.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`爆款实验室_${version}.mp4`)}`);
    return res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    return sendApiError(res, 500, getErrorMessage(err, "视频导出失败"));
  }
});

// ============================================================
// /api/extract-element-preview — SAM 抠图预览
// ============================================================

/** 上传图片到 RunningHub，返回 download_url */
function uploadImageToRunningHub(apiKey, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = `----Boundary${Date.now().toString(16)}`;
    const filename = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const head = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: image/png\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, fileBuffer, tail]);

    const url = new URL(`${RH_BASE}/media/upload/binary`);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        timeout: 120000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            const json = JSON.parse(raw);
            if (json.code === 0 && json.data && json.data.download_url) {
              resolve(json.data.download_url);
            } else {
              reject(new Error(`上传失败: ${raw}`));
            }
          } catch {
            reject(new Error(`上传响应解析失败: ${raw}`));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("上传超时")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** 提交 RunningHub 工作流任务，返回 taskId */
function submitWorkflow(apiKey, workflowId, nodeInfoList) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      addMetadata: true,
      nodeInfoList,
      instanceType: "default",
      usePersonalQueue: "false",
    });
    const url = new URL(`${RH_BASE}/run/workflow/${workflowId}`);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            const json = JSON.parse(raw);
            if (json.taskId) {
              resolve(json.taskId);
            } else {
              reject(new Error(`未拿到 taskId: ${raw}`));
            }
          } catch {
            reject(new Error(`工作流提交响应解析失败: ${raw}`));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("提交工作流超时")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/** 轮询工作流结果 */
function pollWorkflowResult(apiKey, taskId, maxSeconds = 300, intervalMs = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${RH_BASE}/query`);
    const payload = JSON.stringify({ taskId });
    let elapsed = 0;

    const tick = () => {
      if (elapsed >= maxSeconds) {
        reject(new Error(`轮询超时 (${maxSeconds}s)`));
        return;
      }
      const req = https.request(
        {
          method: "POST",
          hostname: url.hostname,
          path: url.pathname,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 30000,
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            try {
              const json = JSON.parse(raw);
              if (json.status === "SUCCESS") {
                resolve(json);
              } else if (json.status === "FAILED") {
                reject(new Error(`任务失败: ${json.errorMessage || raw}`));
              } else {
                elapsed += intervalMs / 1000;
                setTimeout(tick, intervalMs);
              }
            } catch {
              elapsed += intervalMs / 1000;
              setTimeout(tick, intervalMs);
            }
          });
        }
      );
      req.on("timeout", () => {
        elapsed += intervalMs / 1000;
        setTimeout(tick, intervalMs);
      });
      req.on("error", (err) => {
        elapsed += intervalMs / 1000;
        setTimeout(tick, intervalMs);
      });
      req.write(payload);
      req.end();
    };
    setTimeout(tick, intervalMs);
  });
}

app.post("/api/extract-element-preview", upload.single("image"), async (req, res) => {
  console.log("收到抠图预览请求：", req.file?.originalname, req.file?.size);

  // 1. 校验环境变量
  const requiredVars = [
    "RUNNINGHUB_API_KEY",
    "RUNNINGHUB_SAM_WORKFLOW_ID",
    "SAM_IMAGE_NODE_ID",
    "SAM_TEXT_NODE_ID",
  ];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    if (missing.includes("RUNNINGHUB_API_KEY")) {
      return res.status(500).json({
        ok: false,
        message: "后端未配置 RunningHub API Key",
      });
    }
    return res.status(500).json({
      ok: false,
      message: `缺少环境变量: ${missing.join(", ")}，请先在 .env 或终端中配置`,
    });
  }

  const apiKey = process.env.RUNNINGHUB_API_KEY;
  const workflowId = process.env.RUNNINGHUB_SAM_WORKFLOW_ID;
  const imageNodeId = process.env.SAM_IMAGE_NODE_ID;
  const imageFieldName = process.env.SAM_IMAGE_FIELD_NAME || "image";
  const textNodeId = process.env.SAM_TEXT_NODE_ID;
  const textFieldName = process.env.SAM_TEXT_FIELD_NAME || "text";

  // 2. 校验输入
  if (!req.file) {
    return res.status(400).json({ ok: false, message: "没有收到图片文件" });
  }
  const target = req.body.target;
  if (!target) {
    return res.status(400).json({ ok: false, message: "缺少 target 参数（要抠的元素名称）" });
  }

  const imagePath = path.resolve(req.file.path);

  try {
    // 3. 上传图片到 RunningHub
    console.log("正在上传图片到 RunningHub...");
    const imageUrl = await uploadImageToRunningHub(apiKey, imagePath);
    console.log("图片上传完成:", imageUrl);

    // 4. 提交 SAM 工作流
    console.log("正在提交 SAM 抠图工作流...");
    const nodeInfoList = [
      {
        nodeId: imageNodeId,
        fieldName: imageFieldName,
        fieldValue: imageUrl,
      },
      {
        nodeId: textNodeId,
        fieldName: textFieldName,
        fieldValue: target,
      },
    ];
    const taskId = await submitWorkflow(apiKey, workflowId, nodeInfoList);
    console.log("工作流已提交, taskId:", taskId);

    // 5. 轮询结果
    console.log("开始轮询抠图结果...");
    const result = await pollWorkflowResult(apiKey, taskId);
    console.log("抠图完成, results:", JSON.stringify(result.results?.slice(0, 1)));

    // 6. 提取输出图片 URL
    const results = result.results || [];
    const firstResult = results[0] || {};
    const previewUrl = firstResult.url || firstResult.outputUrl || null;

    res.json({
      ok: true,
      previewUrl,
      raw: result,
    });
  } catch (err) {
    console.error("抠图预览失败:", err.message);
    res.status(500).json({
      ok: false,
      message: err.message || "抠图预览失败",
    });
  }
});

async function downloadRemoteFile(url, outputPath) {
  if (!url) return "";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载持久化原视频失败：HTTP ${response.status}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  return outputPath;
}

async function recoverVideoToTextTask(task) {
  const skillResult = await coreSkillService().execute('video_understanding', {
    project_id: task.project_id, task_id: task.id,
    video_path: task.input_data?.originalVideoPath || task.input_data?.originalVideoUrl || 'recovery-source',
    prompt: task.input_data?.prompt || DEFAULT_PROMPT, original_asset_id: task.input_data?.originalAssetId || null,
  }, {
    userId: task.user_id, projectId: task.project_id, taskId: task.id,
    externalTaskId: task.external_task_id, skillName: 'video_understanding', modelName: RH_VIDEO_TO_TEXT_ENDPOINT,
  }, async () => {
  const final = await pollRunningHubTask(process.env.RUNNINGHUB_API_KEY, task.external_task_id, async () => {
    await taskResultService().updateTask(task.id, { status: "analyzing", stage: "polling_after_restart" });
  }, async (retryError, attempt) => {
    await taskResultService().updateTask(task.id, { retry_count: Number(task.retry_count || 0) + attempt, stage: 'recovery_polling_retry' });
    logger.warn({ taskId: task.id, userId: task.user_id, projectId: task.project_id, externalTaskId: task.external_task_id, action: 'task.recovery.poll_retry', status: 'retrying', errorCode: 'MODEL_REQUEST_FAILED', errorMessage: retryError.message, metadata: { attempt } });
  });
  const rawResult = normalizeUnderstandingResponse(final, {
    provider: 'runninghub_fallback', model: RH_VIDEO_TO_TEXT_ENDPOINT,
    requestId: task.input_data?.requestId || `recovery:${task.id}`,
  });
  const cleanedLegacy = refineBreakdown(cleanBreakdownForResponse(rawResult));
  return {
    rawUnderstandingResult: rawResult,
    normalizedBreakdown: legacyToFineBreakdown(cleanedLegacy, {
      modelName: RH_VIDEO_TO_TEXT_ENDPOINT, modelVersion: 'legacy-fallback',
    }),
    modelName: RH_VIDEO_TO_TEXT_ENDPOINT,
    modelVersion: 'legacy-fallback',
    provider: 'runninghub_fallback', fallback: true,
    usage: {}, estimatedCost: null, elapsedMs: null,
  };
  });
  const rawResult = skillResult.rawUnderstandingResult;
  let normalizedBreakdown = skillResult.normalizedBreakdown;
  let originalVideoUrl = task.input_data?.originalVideoUrl;
  if (task.input_data?.originalVideoPath) {
    originalVideoUrl = (await projectAssetService().signedAsset({ storage_path: task.input_data.originalVideoPath })).signed_url;
  }
  if (originalVideoUrl) {
    try {
      const videoPath = await downloadRemoteFile(
        originalVideoUrl,
        path.join("/tmp/openclaw/rh-recovery", `${task.id}-source.mp4`)
      );
      normalizedBreakdown = await generateBreakdownPreviews(normalizedBreakdown, videoPath, task.id);
    } catch (error) {
      console.warn("恢复拆解任务预览生成失败，保留文字拆解结果：", error.message);
    }
  }
  await taskResultService().updateTask(task.id, {
    status: "success", stage: "completed", output_data: {
      raw_understanding_result: rawResult,
      normalized_breakdown: normalizedBreakdown,
      model_name: RH_VIDEO_TO_TEXT_ENDPOINT,
      model_version: 'legacy-fallback',
      breakdown_version: FINE_BREAKDOWN_VERSION,
      provider: 'runninghub_fallback', fallback: true,
      usage: {}, estimated_cost: null,
    },
    error_code: null, error_message: null,
  });
}

async function recoverGenerationTask(task) {
  const initialCheck = await checkGenerationFinalization(task.id, task.user_id);
  if (initialCheck.existingResult) {
    await taskResultService().updateTask(task.id, {
      status: "success", stage: "completed", error_code: null, error_message: null,
    });
    return;
  }
  const config = task.input_data?.config || {};
  const generatedOutputFile = path.join("/tmp/openclaw/rh-output", `${task.id}-video.mp4`);
  const finalOutputFile = path.join("/tmp/openclaw/rh-output", `${task.id}.mp4`);
  const isSeedance2 = config.model_id === SEEDANCE_2_MODEL_ID || config.model === SEEDANCE_2_MODEL_ID;
  const args = [
    "scripts/runninghub.js", "--resume-task-id", task.external_task_id,
    "--endpoint", config.model_endpoint || LEGACY_VIDEO_ENDPOINT, "--output", generatedOutputFile,
  ];
  await taskResultService().updateTask(task.id, { status: "generating", stage: "polling_after_restart" });
  let recoveryOutput = '';
  let recoveryRetryUpdate = Promise.resolve();
  const recoveryRetryBase = Number(task.retry_count || 0);
  let recoveryRetryAttempt = recoveryRetryBase;
  const recoveryExecutor = isSeedance2
    ? async () => {
      const final = await pollRunningHubTask(process.env.RUNNINGHUB_API_KEY, task.external_task_id, null, async (_error, attempt) => {
        const nextAttempt = recoveryRetryBase + attempt;
        recoveryRetryAttempt = Math.max(recoveryRetryAttempt, nextAttempt);
        await taskResultService().updateTask(task.id, { retry_count: nextAttempt, stage: 'recovery_polling_retry' });
      });
      const resultUrl = selectSeedanceVideoResult(final.results);
      await downloadRemoteFile(resultUrl, generatedOutputFile);
      const cost = final.usage?.consumeMoney ?? final.usage?.thirdPartyConsumeMoney ?? '';
      return `TASK_ID:${task.external_task_id}\nOUTPUT_FILE:${generatedOutputFile}\nCOST:${cost}`;
    }
    : () => runRunningHubScript(args, `恢复 RunningHub image-to-video ${task.id}`, (text) => {
      recoveryOutput += text;
      const matches = [...recoveryOutput.matchAll(/RETRY_ATTEMPT:(\d+)/g)];
      const attempt = recoveryRetryBase + Number(matches.at(-1)?.[1] || 0);
      if (attempt > recoveryRetryAttempt) {
        recoveryRetryAttempt = attempt;
        recoveryRetryUpdate = recoveryRetryUpdate.then(() => taskResultService().updateTask(task.id, { retry_count: attempt, stage: 'recovery_polling_retry' })).then(() => logger.warn({ taskId: task.id, userId: task.user_id, projectId: task.project_id, externalTaskId: task.external_task_id, action: 'task.recovery.poll_retry', status: 'retrying', errorCode: 'MODEL_REQUEST_FAILED', metadata: { attempt } })).catch(() => {});
      }
    });
  const stdout = await coreSkillService().execute('video_generation', {
    project_id: task.project_id, task_id: task.id, image_path: null,
    prompt: task.input_data?.prompt || '', model_id: config.model_id || config.model || 'legacy',
    model_endpoint: config.model_endpoint || LEGACY_VIDEO_ENDPOINT, duration: Number(config.duration) || 10,
    aspect_ratio: config.aspect_ratio || config.ratio || '9:16', resolution: config.resolution || '720p',
    source_video_storage_path: task.input_data?.sourceVideoStoragePath || null,
    resume_external_task_id: task.external_task_id,
  }, {
    userId: task.user_id, projectId: task.project_id, taskId: task.id,
    externalTaskId: task.external_task_id, skillName: 'video_generation', modelName: config.model_name || config.modelLabel || config.model || 'legacy',
  }, recoveryExecutor);
  await recoveryRetryUpdate;
  const parsed = parseGenerationOutput(stdout);
  if (!parsed.outputFile) throw new Error("恢复生成任务后未返回输出视频文件");
  const billingQuote = task.input_data?.billing_quote || {};
  const actualProviderCost = isSeedance2
    ? numeric(billingQuote.providerCost)
    : numeric(parsed.cost, billingQuote.providerCost || 0);
  const actualCreditCost = task.billing_status === 'frozen' ? calculateCreditCost({
    costRule: billingQuote.costRule || {}, providerCost: actualProviderCost,
    duration: config.duration, resolution: config.resolution,
    aspectRatio: config.aspect_ratio || config.ratio,
  }) : 0;
  let sourceVideoPath = "";
  try {
    let sourceVideoUrl = task.input_data?.sourceVideoUrl;
    if (task.input_data?.sourceVideoStoragePath) {
      sourceVideoUrl = (await projectAssetService().signedAsset({ storage_path: task.input_data.sourceVideoStoragePath })).signed_url;
    }
    sourceVideoPath = await downloadRemoteFile(
      sourceVideoUrl,
      path.join("/tmp/openclaw/rh-recovery", `${task.id}-source.mp4`)
    );
  } catch (error) {
    console.warn("恢复任务原视频下载失败，将保留无音频结果：", error.message);
  }
  const outputFile = isSeedance2
    ? parsed.outputFile
    : await mergeOriginalAudio(
      parsed.outputFile, sourceVideoPath, finalOutputFile,
      Number(task.input_data?.clipStart) || 0,
      Number(task.input_data?.clipEnd) || Number(config.duration) || 10
    );
  await checkGenerationFinalization(task.id, task.user_id);
  const beforeDelivery = await checkGenerationFinalization(task.id, task.user_id);
  if (beforeDelivery.existingResult) {
    if (task.billing_status === 'frozen') {
      await billingService().settleTask({
        taskId: task.id, userId: task.user_id, creditCost: actualCreditCost, providerCost: actualProviderCost,
      });
    }
    await taskResultService().updateTask(task.id, { status: "success", stage: "completed", error_code: null, error_message: null });
    return;
  }
  await deliverGeneratedResult({
    uploadAsset: () => projectAssetService().uploadAsset({
      projectId: task.project_id, userId: task.user_id, assetType: "video", purpose: 'generated_video', sourceTaskId: task.id,
      file: {
        originalname: `${task.id}.mp4`, mimetype: "video/mp4",
        size: fs.statSync(outputFile).size, buffer: fs.readFileSync(outputFile),
      },
    }),
    createResult: (asset) => taskResultService().createResult({
      projectId: task.project_id, userId: task.user_id, taskId: task.id, videoUrl: asset.storage_path,
      prompt: task.input_data?.prompt || "", modelName: config.model_name || config.modelLabel || config.model || "",
      modelParams: config, duration: Number(config.duration) || null, cost: parsed.cost,
      promptSnapshot: task.input_data?.prompt_snapshot || null,
      providerCost: actualProviderCost, creditCost: actualCreditCost,
    }),
    settleBilling: () => task.billing_status === 'frozen'
      ? billingService().settleTask({ taskId: task.id, userId: task.user_id, creditCost: actualCreditCost, providerCost: actualProviderCost })
      : Promise.resolve(),
    markSuccess: ({ asset, result }) => taskResultService().updateTask(task.id, {
      status: "success", stage: "completed",
      output_data: {
        videoUrl: asset.storage_path, assetId: asset.id, finalPrompt: task.input_data?.prompt || "",
        cost: parsed.cost, providerCost: actualProviderCost, creditCost: actualCreditCost,
        config, version: result.version,
      },
      error_code: null, error_message: null,
    }),
    deleteResult: () => taskResultService().deleteResultByTask(task.id, task.user_id),
    deleteAsset: (asset) => projectAssetService().deleteAsset(task.project_id, asset.id, task.user_id),
  });
}

async function recoverIncompleteTasks() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RUNNINGHUB_API_KEY) return;
  const stability = createStabilityService();
  let recoveredCount = 0;
  let failedCount = 0;
  await stability.setWorkerState({ worker_id: RECOVERY_WORKER_ID, status: 'scanning', last_started_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString(), metadata: {} }).catch(() => {});
  const tasks = await taskResultService().listIncompleteTasks();
  for (const task of tasks) {
    const claimed = await taskResultService().claimRecovery(task.id, RECOVERY_WORKER_ID).catch((error) => {
      logger.error({ taskId: task.id, userId: task.user_id, projectId: task.project_id, action: 'task.recovery.claim', status: 'failed', errorCode: 'DATABASE_ERROR', errorMessage: error.message });
      return false;
    });
    if (!claimed) {
      logger.info({ taskId: task.id, userId: task.user_id, projectId: task.project_id, action: 'task.recovery.skip_locked', status: 'skipped' });
      continue;
    }
    if (!task.external_task_id) {
      await releaseFailedTaskBilling(task.id, task.user_id, 0, { forceFullRefund: true }).catch(() => {});
      await taskResultService().updateTask(task.id, {
        status: "failed", stage: "restart_recovery_failed",
        error_code: "MISSING_EXTERNAL_TASK_ID",
        error_message: "服务重启前第三方任务尚未成功提交，请重新执行。",
      });
      failedCount += 1;
      logger.warn({ taskId: task.id, userId: task.user_id, projectId: task.project_id, action: 'task.recovery.missing_external_id', status: 'failed', errorCode: 'TASK_STATE_INVALID' });
      continue;
    }
    const recover = task.task_type === "video_to_text" ? recoverVideoToTextTask : recoverGenerationTask;
    logger.info({ taskId: task.id, userId: task.user_id, projectId: task.project_id, externalTaskId: task.external_task_id, action: 'task.recovery.start', status: 'running' });
    await recover(task).then(() => {
      recoveredCount += 1;
      logger.info({ taskId: task.id, userId: task.user_id, projectId: task.project_id, externalTaskId: task.external_task_id, action: 'task.recovery.complete', status: 'success' });
    }).catch(async (error) => {
      failedCount += 1;
      const currentTask = await taskResultService().getTask(task.id, task.user_id).catch(() => null);
      if (currentTask?.status === "cancelled" || error.code === "TASK_CANCELLED") {
        await releaseFailedTaskBilling(task.id, task.user_id).catch(() => {});
        console.log("重启恢复已忽略 cancelled Task：", task.id);
        return;
      }
      const timedOut = /超时|timeout/i.test(error.message || "");
      await releaseFailedTaskBilling(task.id, task.user_id, 0, {
        forceFullRefund: ['storage_upload', 'result_create', 'billing_settle', 'task_complete'].includes(error.deliveryStage),
      }).catch((billingError) => {
        console.error("恢复失败 Task 积分退款失败：", task.id, billingError.message);
      });
      await taskResultService().updateTask(task.id, {
        status: timedOut ? "timeout" : "failed", stage: "restart_recovery_failed",
        error_code: timedOut ? "TASK_TIMEOUT" : error.code || "RECOVERY_FAILED",
        error_message: getErrorMessage(error, "任务恢复失败"),
      }).catch(() => {});
      logger.error({ taskId: task.id, userId: task.user_id, projectId: task.project_id, externalTaskId: task.external_task_id, action: 'task.recovery.complete', status: 'failed', errorCode: timedOut ? 'TASK_TIMEOUT' : error.code || 'MODEL_REQUEST_FAILED', errorMessage: error.message });
    });
  }
  await stability.setWorkerState({ worker_id: RECOVERY_WORKER_ID, status: 'idle', last_completed_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString(), recovered_count: recoveredCount, failed_count: failedCount, metadata: { scanned: tasks.length } }).catch(() => {});
}

app.use((err, req, res, next) => {
  console.error("后端接口未捕获错误：", err);
  if (res.headersSent) {
    return next(err);
  }
  return sendApiError(res, 500, getErrorMessage(err, "后端接口异常"));
});

app.listen(PORT, () => {
  console.log(`爆款实验室服务已启动：http://localhost:${PORT}`);
  recoverIncompleteTasks().catch((error) => console.error("未完成任务恢复扫描失败：", error));
});
