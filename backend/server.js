const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

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
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

function applyCorsHeaders(req, res) {
  const origin = normalizeOrigin(req.headers.origin);
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Content-Type,Authorization"
  );
  return true;
}

// uploads 目录：优先用环境变量，默认用 backend 目录下的 uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
const upload = multer({ dest: UPLOADS_DIR });

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
app.use(express.static(LEGACY_FRONTEND_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/generated", express.static("/tmp/openclaw/rh-output"));
app.use("/assets", express.static(path.join(LEGACY_FRONTEND_DIR, "assets")));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "viral-lab-backend",
    time: new Date().toISOString(),
  });
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
  if (task.status === "success") return { ...base, result: task.result };
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
    };
  }
  if (task.status === "failed") return { ...base, error: task.error };
  return base;
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

function promptList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function uniquePromptList(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function samePromptConcept(left, right) {
  const normalize = (value) => String(value || "")
    .toLowerCase()
    .replace(/小狗|泰迪犬|宠物犬|犬只/g, "狗")
    .replace(/小猫|猫咪/g, "猫")
    .replace(/小径|道路|路面|石板路|石砖路|铺设路面|石砖地|地面/g, "小路")
    .replace(/[\s的、]/g, "");
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function buildFinalGenerationPrompt(breakdown, replacements, extraPrompt, fallbackPrompt) {
  if (!breakdown || typeof breakdown !== "object" || !Array.isArray(replacements)) {
    return fallbackPrompt || "根据参考图生成一段动态视频，保持真实镜头质感。";
  }

  const overview = breakdown.overview || {};
  const shots = Array.isArray(breakdown.shots) ? breakdown.shots : [];
  const changed = replacements.filter((item) => item && item.group && item.original && item.replacement);
  const changedGroups = new Set(changed.map((item) => item.group));
  const changedOriginals = changed.map((item) => String(item.original).trim());
  const remaining = (values) => promptList(values).filter((item) =>
    !changedOriginals.some((original) => samePromptConcept(item, original))
  );
  const subjects = remaining(overview.replaceableSubjects || breakdown.replaceableSubjects);
  const scenes = remaining(overview.replaceableScenes || breakdown.replaceableScenes);
  const elements = remaining(overview.replaceableElements || breakdown.replaceableElements);
  const actions = uniquePromptList(shots.map((shot) => shot?.action));
  const perspectives = uniquePromptList(shots.map((shot) =>
    shot?.cameraPerspective || shot?.perspective || shot?.cameraAngle
  ));
  const cameraMovements = uniquePromptList(shots.map((shot) =>
    shot?.cameraMovement || shot?.movement || shot?.camera
  ));
  const compositions = uniquePromptList(shots.map((shot) =>
    shot?.composition || shot?.framing || shot?.description
  ));

  const replacementText = changed.length
    ? changed.map((item) => `${item.group}“${item.original}”替换为“${item.replacement}”`).join("；")
    : "不替换任何未明确选择的内容，仅按用户要求进行必要调整";
  const describe = (label, values, fallback) =>
    `${label}：${values.length ? values.join("、") : fallback}`;
  const preserveLines = [
    describe("未替换主体", subjects, changedGroups.has("主体") ? "除已选主体外的其他主体与主体关系" : "原视频全部主体"),
    describe("未替换场景", scenes, changedGroups.has("场景") ? "除已选场景外的空间和环境" : "原视频全部场景"),
    describe("动作与运动节奏", actions, "严格沿用原视频动作方向、速度和节奏"),
    describe("镜头视角", perspectives, "严格沿用原视频镜头角度和观察视角"),
    describe("镜头运动", cameraMovements, "严格沿用原视频运镜方式、镜头顺序和推进节奏"),
    describe("画面构图", compositions, "严格沿用原视频主体位置、景别和空间关系"),
    describe("未替换关键元素", elements, changedGroups.has("元素") ? "除已选元素外的其他原有物体" : "原视频全部关键元素"),
  ];

  const userText = String(extraPrompt || "").trim();
  return [
    "【本次替换】",
    `仅执行以下替换：${replacementText}。`,
    "",
    "【必须保持的原视频内容】",
    ...preserveLines,
    "",
    "【生成约束】",
    "只修改用户明确选择的内容，所有未选择内容保持原视频不变。不要重新设计未被替换的主体、场景或元素。不要改变动作方向、运动节奏、镜头角度、镜头运动、画面构图、景别和空间关系。不要新增无关人物、动物、物体、文字、字幕、水印或标志，不要删除未选择替换的内容。保持画面真实自然、前后镜头一致。",
    ...(userText ? ["", "【用户额外要求】", userText] : []),
  ].join("\n");
}

function getErrorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  return err.message || fallback;
}

function sendApiError(res, status, error, details) {
  if (res.headersSent) return;
  const message = error || "后端服务异常";
  res.status(status).json({
    ok: false,
    error: message,
    message,
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

function requestBuffer(method, urlString, body, headers, timeoutMs) {
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

async function postRunningHubJson(apiKey, url, payload, timeoutMs) {
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
    timeoutMs || 60000
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

async function pollRunningHubTask(apiKey, taskId) {
  const url = `${RH_BASE}${RH_POLL_ENDPOINT}`;
  let elapsed = 0;
  let consecutiveFailures = 0;

  while (elapsed < RH_MAX_POLL_SECONDS) {
    await new Promise((resolve) => setTimeout(resolve, RH_POLL_INTERVAL_MS));
    elapsed += RH_POLL_INTERVAL_MS / 1000;

    try {
      const json = await postRunningHubJson(apiKey, url, { taskId }, 30000);
      consecutiveFailures = 0;

      if (json.status === "SUCCESS") {
        return json;
      }
      if (json.status === "FAILED") {
        const taskError = new Error(`任务失败：${json.errorMessage || JSON.stringify(json)}`);
        taskError.nonRetryable = true;
        throw taskError;
      }
    } catch (err) {
      if (err.nonRetryable) {
        throw err;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures >= 5) {
        throw err;
      }
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

async function runVideoToTextDirect(apiKey, videoPath, prompt) {
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

  const finalResult =
    submitResult.status === "SUCCESS" && submitResult.results
      ? submitResult
      : await pollRunningHubTask(apiKey, taskId);

  return formatRunningHubTextResult(finalResult);
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

function runRunningHubScript(args, label) {
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
      stdout += data.toString();
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
`;

app.post("/api/video-to-text", upload.single("video"), (req, res) => {
  try {
    console.log("收到视频拆解请求：", req.file?.originalname, req.file?.size);
    if (!process.env.RUNNINGHUB_API_KEY) {
      return sendApiError(res, 500, "后端未配置 RunningHub API Key");
    }

    if (!req.file) {
      return sendApiError(res, 400, "没有收到视频文件");
    }

    const prompt = req.body.prompt || DEFAULT_PROMPT;
    const videoPath = path.resolve(req.file.path);
    if (!fs.existsSync(videoPath)) {
      return sendApiError(res, 500, `上传视频文件不存在：${videoPath}`);
    }

    const taskId = crypto.randomUUID();
    const task = {
      taskId,
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
      elapsed: 0,
      result: null,
      error: "",
    };
    videoToTextTasks.set(taskId, task);

    console.log("开始后台执行 RunningHub video-to-text，本地 taskId:", taskId);
    res.status(202).json({ ok: true, status: "running", taskId });

    runVideoToTextDirect(process.env.RUNNINGHUB_API_KEY, videoPath, prompt)
      .then((result) => {
        task.status = "success";
        task.finishedAt = Date.now();
        task.elapsed = videoToTextTaskElapsed(task);
        task.result = result;
        console.log("video-to-text 后台任务成功：", taskId);
      })
      .catch((err) => {
        task.status = "failed";
        task.finishedAt = Date.now();
        task.elapsed = videoToTextTaskElapsed(task);
        task.error = `RunningHub video-to-text 调用失败：${getErrorMessage(err, "未知错误")}`;
        console.error("video-to-text 后台任务失败：", taskId, err);
      });
  } catch (err) {
    console.error("video-to-text 失败：", err);
    return sendApiError(res, 500, `RunningHub video-to-text 调用失败：${getErrorMessage(err, "未知错误")}`);
  }
});

app.get("/api/video-to-text-status", (req, res) => {
  const taskId = typeof req.query.taskId === "string" ? req.query.taskId.trim() : "";
  if (!taskId) return sendApiError(res, 400, "缺少 taskId");
  const task = videoToTextTasks.get(taskId);
  if (!task) return sendApiError(res, 404, "未找到视频拆解任务");
  task.elapsed = videoToTextTaskElapsed(task);
  return res.json(publicVideoToTextTask(task));
});

app.post("/api/generate-video", upload.single("image"), (req, res) => {
  try {
  if (!process.env.RUNNINGHUB_API_KEY) {
    return sendApiError(res, 500, "后端未配置 RunningHub API Key");
  }

  if (!req.file) {
    return sendApiError(res, 400, "没有收到生成图片");
  }

  const breakdown = parseJsonFormField(req.body.breakdown, null);
  const replacements = parseJsonFormField(req.body.replacements, null);
  const prompt = buildFinalGenerationPrompt(
    breakdown,
    replacements,
    req.body.extraPrompt,
    req.body.prompt
  );
  const duration = req.body.duration || "10";
  const aspectRatio = req.body.aspectRatio || "9:16";
  const imagePath = path.resolve(req.file.path);
  if (!fs.existsSync(imagePath)) {
    return sendApiError(res, 500, `上传图片文件不存在：${imagePath}`);
  }

  const taskId = crypto.randomUUID();
  const outputFile = path.join("/tmp/openclaw/rh-output", `${taskId}.mp4`);
  const args = [
  "scripts/runninghub.js",
  "--endpoint",
  "bytedance/seedance-2.0-global-fast/multimodal-video",
  "--prompt",
  prompt,
  "--image",
  imagePath,
  "--output",
  outputFile,
  "--param",
  "resolution=720p",
  "--param",
  `duration=${duration || "5"}`,
  "--param",
  `ratio=${aspectRatio || "adaptive"}`,
  "--param",
  "generateAudio=false",
  "--param",
  "realPersonMode=true"
];

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
  };
  generationTasks.set(taskId, task);

  console.log("收到视频生成请求：", req.file?.originalname, req.file?.size, "本地 taskId:", taskId);
  console.log("[generate-video] final prompt:", prompt);
  res.status(202).json({ ok: true, status: "running", taskId });

  runRunningHubScript(args, `RunningHub image-to-video ${taskId}`)
    .then((stdout) => {
      const parsed = parseGenerationOutput(stdout);
      if (!parsed.outputFile || !parsed.videoUrl) {
        throw new Error("RunningHub 生成完成但未返回输出视频文件");
      }
      task.status = "success";
      task.finishedAt = Date.now();
      task.elapsed = generationTaskElapsed(task);
      task.videoUrl = parsed.videoUrl;
      task.outputFile = parsed.outputFile;
      task.cost = parsed.cost;
      task.result = stdout;
      console.log("generate-video 后台任务成功：", taskId, parsed.outputFile);
    })
    .catch((err) => {
      task.status = "failed";
      task.finishedAt = Date.now();
      task.elapsed = generationTaskElapsed(task);
      task.error = getErrorMessage(err, "RunningHub 视频生成失败");
      console.error("generate-video 后台任务失败：", taskId, err);
    });
  } catch (err) {
    console.error("generate-video 失败：", err);
    return sendApiError(res, 500, getErrorMessage(err, "RunningHub 视频生成失败"));
  }
});

app.get("/api/generate-status", (req, res) => {
  const taskId = typeof req.query.taskId === "string" ? req.query.taskId.trim() : "";
  if (!taskId) return sendApiError(res, 400, "缺少 taskId");
  const task = generationTasks.get(taskId);
  if (!task) return sendApiError(res, 404, "未找到生成任务");
  task.elapsed = generationTaskElapsed(task);
  return res.json(publicGenerationTask(taskId, task));
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

app.use((err, req, res, next) => {
  console.error("后端接口未捕获错误：", err);
  if (res.headersSent) {
    return next(err);
  }
  return sendApiError(res, 500, getErrorMessage(err, "后端接口异常"));
});

app.listen(PORT, () => {
  console.log(`爆款实验室服务已启动：http://localhost:${PORT}`);
});
