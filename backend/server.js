const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredOrigins = [
  process.env.FRONTEND_ORIGIN,
  ...(process.env.CORS_ORIGINS || "").split(","),
]
  .filter(Boolean)
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);

// uploads 目录：优先用环境变量，默认用 backend 目录下的 uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
const upload = multer({ dest: UPLOADS_DIR });

// 旧版前端静态托管：指向同级 react-old 目录
const LEGACY_FRONTEND_DIR = process.env.LEGACY_FRONTEND_DIR || path.join(__dirname, "..", "react-old");

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
}));
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
    console.log("收到视频拆解请求：", req.file?.originalname, req.file?.size);
  if (!process.env.RUNNINGHUB_API_KEY) {
    return res.status(500).json({
      ok: false,
      message: "后端未配置 RunningHub API Key",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      ok: false,
      message: "没有收到视频文件",
    });
  }

  const prompt = req.body.prompt || DEFAULT_PROMPT;
  const videoPath = path.resolve(req.file.path);

  const args = [
    "scripts/runninghub.js",
    "--endpoint",
    "rhart-text-g-25-flash/video-to-text",
    "--prompt",
    prompt,
    "--video",
    videoPath,
  ];
console.log("开始调用 RunningHub video-to-text...");
  const child = spawn("node", args, {
    cwd: RUNNINGHUB_SKILL_DIR,
    env: process.env,
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  child.on("close", (code) => {
    console.log("RunningHub 进程结束，code =", code);
console.log("stdout 前 300 字：", stdout.slice(0, 300));
console.log("stderr 前 300 字：", stderr.slice(0, 300));
    if (code !== 0) {
      return res.status(500).json({
        ok: false,
        message: "RunningHub 视频拆解失败",
        error: stderr || stdout,
      });
    }

    res.json({
      ok: true,
      result: stdout,
    });
  });
});

app.post("/api/generate-video", upload.single("image"), (req, res) => {
  if (!process.env.RUNNINGHUB_API_KEY) {
    return res.status(500).json({
      ok: false,
      message: "后端未配置 RunningHub API Key",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      ok: false,
      message: "没有收到生成图片",
    });
  }

  const prompt = req.body.prompt || "根据参考图生成一段动态视频，保持真实镜头质感。";
  const duration = req.body.duration || "10";
  const aspectRatio = req.body.aspectRatio || "9:16";
  const imagePath = path.resolve(req.file.path);

 const args = [
  "scripts/runninghub.js",
  "--endpoint",
  "bytedance/seedance-2.0-global-fast/multimodal-video",
  "--prompt",
  prompt,
  "--image",
  imagePath,
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

  console.log("收到视频生成请求：", req.file?.originalname, req.file?.size);
  console.log("开始调用 RunningHub image-to-video...");

  const child = spawn("node", args, {
    cwd: RUNNINGHUB_SKILL_DIR,
    env: process.env,
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  child.on("close", (code) => {
    console.log("RunningHub 生视频进程结束，code =", code);
    console.log("stdout 前 500 字：", stdout.slice(0, 500));
    console.log("stderr 前 500 字：", stderr.slice(0, 500));

    if (code !== 0) {
      return res.status(500).json({
        ok: false,
        message: "RunningHub 视频生成失败",
        error: stderr || stdout,
      });
    }

    res.json({
      ok: true,
      result: stdout,
    });
  });
});

// ============================================================
// /api/extract-element-preview — SAM 抠图预览
// ============================================================

const RH_BASE = "https://www.runninghub.cn/openapi/v2";

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

app.listen(PORT, () => {
  console.log(`爆款实验室服务已启动：http://localhost:${PORT}`);
});
