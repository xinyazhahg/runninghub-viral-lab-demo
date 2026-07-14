#!/usr/bin/env node
"use strict";

/*
 * RunningHub universal API client for OpenClaw.
 *
 * Node.js adapter for environments where python3 is not available.
 * It intentionally preserves the CLI surface of runninghub.py:
 *   --check
 *   --list [--type T] [--task T]
 *   --info ENDPOINT
 *   --endpoint EP --prompt "..." --image ... --param k=v -o FILE
 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const BASE_URL = "https://www.runninghub.cn/openapi/v2";
const ACCOUNT_STATUS_URL = "https://www.runninghub.cn/uc/openapi/accountStatus";
const POLL_ENDPOINT = "/query";
const UPLOAD_ENDPOINT = "/media/upload/binary";
const MAX_POLL_SECONDS = 1200;
const POLL_INTERVAL_MS = 5000;

const SCRIPT_DIR = __dirname;
const DATA_DIR = path.resolve(SCRIPT_DIR, "..", "data");
const CAPABILITIES_PATH = path.join(DATA_DIR, "capabilities.json");

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(message, extra) {
  const payload = Object.assign({ error: "ERROR", message }, extra || {});
  console.error(JSON.stringify(payload));
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return undefined;
  }
}

function loadCapabilities() {
  const caps = readJson(CAPABILITIES_PATH);
  if (!caps) {
    fail(`capabilities.json not found at ${CAPABILITIES_PATH}`);
  }
  return caps;
}

function findEndpoint(endpoint) {
  return loadCapabilities().endpoints.find((ep) => ep.endpoint === endpoint);
}

function findBestForTask(task) {
  const matches = loadCapabilities().endpoints.filter((ep) => ep.task === task);
  if (!matches.length) return undefined;
  return matches.sort((a, b) => (a.popularity || 99) - (b.popularity || 99))[0];
}

function valueAt(obj, parts) {
  return parts.reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function readKeyFromConfigFile(filePath) {
  const cfg = readJson(filePath);
  if (!cfg) return undefined;

  const entry = valueAt(cfg, ["skills", "entries", "runninghub"]) || {};
  const apiKey = typeof entry.apiKey === "string" ? entry.apiKey.trim() : "";
  if (isUsableKey(apiKey)) return apiKey;

  const envKey = valueAt(entry, ["env", "RUNNINGHUB_API_KEY"]);
  if (typeof envKey === "string" && isUsableKey(envKey.trim())) return envKey.trim();

  const rootEnvKey = valueAt(cfg, ["env", "RUNNINGHUB_API_KEY"]);
  if (typeof rootEnvKey === "string" && isUsableKey(rootEnvKey.trim())) return rootEnvKey.trim();

  return undefined;
}

function isUsableKey(key) {
  return Boolean(
    key &&
      ![
        "your_api_key_here",
        "<your_api_key>",
        "YOUR_API_KEY",
        "RUNNINGHUB_API_KEY",
        "REPLACE_ME_WITH_RUNNINGHUB_API_KEY",
      ].includes(key)
  );
}

function resolveApiKey(providedKey) {
  if (isUsableKey((providedKey || "").trim())) return providedKey.trim();
  if (isUsableKey((process.env.RUNNINGHUB_API_KEY || "").trim())) {
    return process.env.RUNNINGHUB_API_KEY.trim();
  }

  const candidates = [
    path.join(os.homedir(), ".openclaw", "openclaw.json"),
    path.resolve(process.cwd(), "openclaw.json"),
    path.resolve(process.cwd(), "..", "openclaw.json"),
    "/workspace/openclaw_config/openclaw.json",
  ];
  for (const candidate of candidates) {
    const key = readKeyFromConfigFile(candidate);
    if (key) return key;
  }
  return undefined;
}

function keySource(providedKey) {
  if (isUsableKey((providedKey || "").trim())) return "cli";
  if (isUsableKey((process.env.RUNNINGHUB_API_KEY || "").trim())) return "env";
  const candidates = [
    ["config", path.join(os.homedir(), ".openclaw", "openclaw.json")],
    ["workspace_config", "/workspace/openclaw_config/openclaw.json"],
  ];
  for (const [source, candidate] of candidates) {
    if (readKeyFromConfigFile(candidate)) return source;
  }
  return "none";
}

function requireApiKey(providedKey) {
  const key = resolveApiKey(providedKey);
  if (key) return key;
  printJson({
    error: "NO_API_KEY",
    message: "No API key configured",
    steps: [
      "1. Register/login at https://www.runninghub.cn",
      "2. Create API Key at https://www.runninghub.cn/enterprise-api/sharedApi",
      "3. Recharge wallet at https://www.runninghub.cn/vip-rights/4",
      "4. Add it to ~/.openclaw/openclaw.json: skills.entries.runninghub.apiKey",
    ],
  });
  process.exit(1);
}

function requestBuffer(method, urlString, body, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === "http:" ? http : https;
    const req = transport.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: timeoutMs || 60000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error(buffer.toString("utf8") || `HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.body = buffer.toString("utf8");
            reject(err);
            return;
          }
          resolve(buffer);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postJson(url, payload, headers, timeoutMs) {
  const body = Buffer.from(JSON.stringify(payload));
  const finalHeaders = Object.assign(
    {
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
    },
    headers || {}
  );
  try {
    const buffer = await requestBuffer("POST", url, body, finalHeaders, timeoutMs || 60000);
    return JSON.parse(buffer.toString("utf8"));
  } catch (err) {
    let parsed;
    try {
      parsed = JSON.parse(err.body || "");
    } catch (_) {
      parsed = undefined;
    }
    const msg = (parsed && (parsed.msg || parsed.message)) || err.message;
    const lower = String(msg).toLowerCase();
    if (/auth|401|403|token|key/.test(lower)) {
      fail(`API authentication failed: ${msg}`, {
        error: "AUTH_FAILED",
        manage_url: "https://www.runninghub.cn/enterprise-api/sharedApi",
      });
    }
    if (/balance|insufficient|余额|credit/.test(lower)) {
      fail(`Insufficient balance: ${msg}`, {
        error: "INSUFFICIENT_BALANCE",
        recharge_url: "https://www.runninghub.cn/vip-rights/4",
      });
    }
    fail(`API request failed: ${msg}`, { error: "API_ERROR" });
  }
}

async function cmdCheck(apiKeyArg) {
  const key = resolveApiKey(apiKeyArg);
  if (!key) {
    printJson({
      status: "no_key",
      message: "No API key configured",
      steps: [
        "1. Register/login at https://www.runninghub.cn",
        "2. Create API Key at https://www.runninghub.cn/enterprise-api/sharedApi",
        "3. Recharge wallet at https://www.runninghub.cn/vip-rights/4",
        "4. Add it to ~/.openclaw/openclaw.json: skills.entries.runninghub.apiKey",
      ],
    });
    return;
  }

  const keyPrefix = `${key.slice(0, 4)}****`;
  let resp;
  try {
    resp = await postJson(
      ACCOUNT_STATUS_URL,
      { apikey: key },
      { Authorization: `Bearer ${key}` },
      15000
    );
  } catch (err) {
    printJson({
      status: "invalid_key",
      key_prefix: keyPrefix,
      key_source: keySource(apiKeyArg),
      message: "API key is invalid or expired, or network error",
      detail: String(err.message || "").slice(0, 300),
      manage_url: "https://www.runninghub.cn/enterprise-api/sharedApi",
    });
    return;
  }

  if (resp.code !== 0) {
    printJson({
      status: "invalid_key",
      key_prefix: keyPrefix,
      key_source: keySource(apiKeyArg),
      message: resp.msg || "API key verification failed",
      manage_url: "https://www.runninghub.cn/enterprise-api/sharedApi",
    });
    return;
  }

  const data = resp.data || {};
  const balance = data.remainMoney == null ? "0" : String(data.remainMoney);
  const balanceNum = Number(balance) || 0;
  printJson({
    status: balanceNum > 0 ? "ready" : "no_balance",
    key_prefix: keyPrefix,
    key_source: keySource(apiKeyArg),
    balance,
    currency: data.currency || "CNY",
    coins: data.remainCoins == null ? "0" : String(data.remainCoins),
    running_tasks: data.currentTaskCounts == null ? "0" : String(data.currentTaskCounts),
    api_type: data.apiType || "",
    ...(balanceNum > 0 ? {} : { message: "Wallet balance is zero. Recharge required." }),
  });
}

function cmdList(typeFilter, taskFilter) {
  let endpoints = loadCapabilities().endpoints;
  if (typeFilter) endpoints = endpoints.filter((ep) => ep.output_type === typeFilter);
  if (taskFilter) endpoints = endpoints.filter((ep) => ep.task === taskFilter);

  console.log(`Total: ${endpoints.length} endpoints`);
  if (typeFilter) console.log(`Filter: type=${typeFilter}`);
  if (taskFilter) console.log(`Filter: task=${taskFilter}`);
  console.log("");
  for (const ep of endpoints) {
    const name = ep.name_cn || ep.name_en || ep.endpoint;
    const rank = ep.popularity && ep.popularity < 99 ? String(ep.popularity) : "-";
    console.log(
      `  [${String(ep.output_type).padEnd(6)}] ${String(ep.task).padEnd(25)} rank=${rank.padEnd(3)} ${String(ep.endpoint).padEnd(60)} ${name}`
    );
  }
}

function cmdInfo(endpoint) {
  const ep = findEndpoint(endpoint);
  if (!ep) {
    console.error(`Error: endpoint '${endpoint}' not found`);
    console.error("Use --list to see available endpoints.");
    process.exit(1);
  }
  printJson(ep);
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

function imageToDataUri(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:${contentTypeFor(filePath)};base64,${data.toString("base64")}`;
}

async function uploadFile(apiKey, filePath) {
  if (!fs.existsSync(filePath)) fail(`file not found: ${filePath}`);

  const boundary = `----OpenClawRunningHub${Date.now().toString(16)}`;
  const filename = path.basename(filePath);
  const file = fs.readFileSync(filePath);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentTypeFor(filePath)}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, file, tail]);

  const resp = await postMultipart(`${BASE_URL}${UPLOAD_ENDPOINT}`, body, {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": String(body.length),
  });
  if (resp.code === 0 && resp.data && resp.data.download_url) {
    return resp.data.download_url;
  }
  fail(`Upload error: ${JSON.stringify(resp)}`, { error: "UPLOAD_FAILED" });
}

async function postMultipart(url, body, headers) {
  try {
    const buffer = await requestBuffer("POST", url, body, headers, 120000);
    return JSON.parse(buffer.toString("utf8"));
  } catch (err) {
    fail(`Upload failed: ${err.message}`, { error: "UPLOAD_FAILED" });
  }
}

async function resolveMedia(apiKey, mediaPath, forceUpload) {
  if (/^https?:\/\//.test(mediaPath)) return mediaPath;
  const abs = path.resolve(mediaPath);
  if (!fs.existsSync(abs)) fail(`file not found: ${mediaPath}`);
  const size = fs.statSync(abs).size;
  if (forceUpload || size > 5 * 1024 * 1024) return uploadFile(apiKey, abs);
  return imageToDataUri(abs);
}

function coerceParam(value, paramDef) {
  if (!paramDef) return value;
  if (paramDef.type === "BOOLEAN") return /^(true|1|yes)$/i.test(value);
  if (paramDef.type === "INT") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed;
  }
  if (paramDef.type === "FLOAT") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}

async function buildPayload(endpointDef, args, apiKey) {
  const payload = {};
  const extraParams = {};
  for (const param of args.param || []) {
    const idx = param.indexOf("=");
    if (idx === -1) fail(`invalid --param format '${param}', expected key=value`);
    extraParams[param.slice(0, idx)] = param.slice(idx + 1);
  }

  const promptParam = endpointDef.params.find((param) => ["prompt", "text"].includes(param.key));
  if (args.prompt) payload[promptParam ? promptParam.key : "prompt"] = args.prompt;

  const mediaParams = endpointDef.params.filter((param) => ["IMAGE", "VIDEO", "AUDIO"].includes(param.type));
  const imageParams = mediaParams.filter((param) => param.type === "IMAGE");
  if (args.image && args.image.length === 1 && imageParams.length) {
    const param = imageParams[0];
    const forceUpload = endpointDef.output_type === "video";
    const resolved = await resolveMedia(apiKey, args.image[0], forceUpload);
    payload[param.key] = param.multiple ? [resolved] : resolved;
  } else if (args.image && args.image.length > 1) {
    const multiParam = imageParams.find((param) => param.multiple);
    if (multiParam) {
      payload[multiParam.key] = [];
      for (const img of args.image) payload[multiParam.key].push(await resolveMedia(apiKey, img, true));
    } else {
      for (let i = 0; i < Math.min(args.image.length, imageParams.length); i += 1) {
        payload[imageParams[i].key] = await resolveMedia(apiKey, args.image[i], true);
      }
    }
  }

  const videoParam = mediaParams.find((param) => param.type === "VIDEO");
  if (args.video && videoParam) payload[videoParam.key] = await resolveMedia(apiKey, args.video, true);

  const audioParam = mediaParams.find((param) => param.type === "AUDIO");
  if (args.audio && audioParam) payload[audioParam.key] = await resolveMedia(apiKey, args.audio, true);

  for (const [key, value] of Object.entries(extraParams)) {
    const paramDef = endpointDef.params.find((param) => param.key === key);
    payload[key] = coerceParam(value, paramDef);
  }

  for (const param of endpointDef.params) {
    if (payload[param.key] === undefined && param.required && param.default !== undefined) {
      payload[param.key] = param.default;
    }
  }
  return payload;
}

async function pollTask(apiKey, taskId) {
  console.log(`Task ID: ${taskId}`);
  process.stdout.write("Waiting for result");
  const url = `${BASE_URL}${POLL_ENDPOINT}`;

  let elapsed = 0;
  let consecutiveFailures = 0;
  while (elapsed < MAX_POLL_SECONDS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    elapsed += POLL_INTERVAL_MS / 1000;
    let resp;
    try {
      resp = await postJson(url, { taskId }, { Authorization: `Bearer ${apiKey}` }, 30000);
      consecutiveFailures = 0;
    } catch (_) {
      consecutiveFailures += 1;
      process.stdout.write(`\nRETRY_ATTEMPT:${consecutiveFailures}\n`);
      if (consecutiveFailures >= 5) fail("Too many consecutive poll failures");
      const backoffMs = Math.min(8000, 1000 * (2 ** (consecutiveFailures - 1))) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    if (resp.status === "SUCCESS") {
      console.log(` done (${elapsed}s)`);
      return resp;
    }
    if (resp.status === "FAILED") {
      const msg = resp.errorMessage || "Unknown error";
      if (/balance|insufficient|余额|credit/i.test(`${msg} ${resp.errorCode || ""}`)) {
        fail(`Task failed: ${msg}`, {
          error: "INSUFFICIENT_BALANCE",
          recharge_url: "https://www.runninghub.cn/vip-rights/4",
        });
      }
      fail(`Task failed: [${resp.errorCode || ""}] ${msg}`, { error: "TASK_FAILED" });
    }
    process.stdout.write(".");
  }
  fail(`Timeout after ${MAX_POLL_SECONDS}s`);
}

function guessExt(outputType) {
  return { image: "png", video: "mp4", audio: "mp3", "3d": "glb" }[outputType] || "bin";
}

async function downloadFile(urlString, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const url = new URL(urlString);
  const transport = url.protocol === "http:" ? http : https;
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    transport
      .get(urlString, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(outputPath);
          downloadFile(res.headers.location, outputPath).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`download HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
  return path.resolve(outputPath);
}

async function cmdExecute(args) {
  const apiKey = requireApiKey(args.apiKey);
  let endpointDef;
  if (args.endpoint) {
    endpointDef = findEndpoint(args.endpoint);
    if (!endpointDef) fail(`endpoint '${args.endpoint}' not found. Use --list to see available endpoints.`);
  } else if (args.task) {
    endpointDef = findBestForTask(args.task);
    if (!endpointDef) fail(`no endpoint found for task '${args.task}'. Use --list to see available tasks.`);
    console.error(`Auto-selected: ${endpointDef.endpoint} (${endpointDef.name_cn || ""})`);
  } else {
    fail("--endpoint or --task is required");
  }

  const payload = await buildPayload(endpointDef, args, apiKey);
  console.error(`Submitting ${endpointDef.task} to ${endpointDef.endpoint}...`);
  const resp = await postJson(`${BASE_URL}/${endpointDef.endpoint}`, payload, {
    Authorization: `Bearer ${apiKey}`,
  });
  const taskId = resp.taskId;
  if (!taskId) fail(`no taskId in response: ${JSON.stringify(resp)}`);
  console.log(`TASK_ID:${taskId}`);

  const final = resp.status === "SUCCESS" && resp.results ? resp : await pollTask(apiKey, taskId);
  return writeFinalResult(final, endpointDef, args);
}

async function writeFinalResult(final, endpointDef, args) {
  const results = final.results || [];
  if (!results.length) fail("no results in final response");

  const resultItem = results[0];
  const resultUrl = resultItem.url || resultItem.outputUrl;
  const usage = final.usage || {};
  const consumeMoney = usage.consumeMoney || usage.thirdPartyConsumeMoney;
  const taskCostTime = usage.taskCostTime;

  if (!resultUrl) {
    const textResult = resultItem.text || resultItem.content || resultItem.output;
    if (!textResult) fail("No URL or text in results", { error: "TASK_FAILED" });
    console.log(textResult);
    if (consumeMoney != null) console.log(`COST:¥${consumeMoney}`);
    if (taskCostTime && String(taskCostTime) !== "0") console.log(`DURATION:${taskCostTime}s`);
    return;
  }

  const outputTypeExt = resultItem.outputType || "";
  let outputPath = args.output || `/tmp/openclaw/rh-output/result.${outputTypeExt || guessExt(endpointDef.output_type)}`;
  if (outputTypeExt) {
    const parsed = path.parse(outputPath);
    outputPath = path.join(parsed.dir, `${parsed.name}.${outputTypeExt}`);
  }

  console.error("Downloading result to local file...");
  const fullPath = await downloadFile(resultUrl, outputPath);
  console.log(`OUTPUT_FILE:${fullPath}`);
  if (consumeMoney != null) console.log(`COST:¥${consumeMoney}`);
  if (taskCostTime && String(taskCostTime) !== "0") console.log(`DURATION:${taskCostTime}s`);
}

async function cmdResume(args) {
  const apiKey = requireApiKey(args.apiKey);
  const endpointDef = findEndpoint(args.endpoint);
  if (!endpointDef) fail(`endpoint '${args.endpoint}' not found`);
  console.log(`TASK_ID:${args.resumeTaskId}`);
  const final = await pollTask(apiKey, args.resumeTaskId);
  return writeFinalResult(final, endpointDef, args);
}

function parseArgs(argv) {
  const args = { image: [], param: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) fail(`missing value for ${arg}`);
      return argv[i];
    };
    if (arg === "--check") args.check = true;
    else if (arg === "--list") args.list = true;
    else if (arg === "--info") args.info = next();
    else if (arg === "--endpoint" || arg === "-e") args.endpoint = next();
    else if (arg === "--task" || arg === "-t") args.task = next();
    else if (arg === "--prompt" || arg === "-p") args.prompt = next();
    else if (arg === "--image" || arg === "-i") args.image.push(next());
    else if (arg === "--video") args.video = next();
    else if (arg === "--audio") args.audio = next();
    else if (arg === "--param") args.param.push(next());
    else if (arg === "--output" || arg === "-o") args.output = next();
    else if (arg === "--api-key" || arg === "-k") args.apiKey = next();
    else if (arg === "--resume-task-id") args.resumeTaskId = next();
    else if (arg === "--type") args.typeFilter = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else fail(`unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`RunningHub universal API client for OpenClaw

Modes:
  --check                           Check API key and account balance
  --list [--type T] [--task T]      List available endpoints
  --info ENDPOINT                   Show endpoint parameter details
  --endpoint EP [options]           Execute with specific endpoint
  --task TASK [options]             Execute with auto-selected best endpoint

Examples:
  node runninghub.js --check
  node runninghub.js --list --type image
  node runninghub.js --info rhart-image-n-pro/text-to-image
  node runninghub.js --endpoint rhart-image-n-pro/text-to-image --prompt "a cute dog" --output /tmp/dog.png
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.check) return cmdCheck(args.apiKey);
  if (args.list) return cmdList(args.typeFilter, args.task);
  if (args.info) return cmdInfo(args.info);
  if (args.resumeTaskId && args.endpoint) return cmdResume(args);
  if (args.endpoint || args.task) return cmdExecute(args);
  printHelp();
  process.exit(1);
}

main().catch((err) => fail(err.message || String(err)));
