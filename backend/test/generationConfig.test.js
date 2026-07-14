const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPersistedGenerationConfig, buildGenerationTaskInput } = require("../lib/generationConfig");

function config(duration) {
  return {
    duration: String(duration), ratio: "9:16", resolution: "720p",
    model: { id: "kling-v3-pro", label: "可灵 v3.0 Pro" },
  };
}

test("persists a submitted 4s generation without falling back to 10s", () => {
  const persisted = buildPersistedGenerationConfig(config(4), { clipStart: "1" });
  assert.equal(persisted.duration, 4);
  assert.equal(persisted.clip_start, 1);
  assert.equal(persisted.clip_end, 5);
  assert.equal(persisted.aspect_ratio, "9:16");
  assert.equal(persisted.model_name, "可灵 v3.0 Pro");
});

test("persists a submitted 10s generation and explicit clip range", () => {
  const persisted = buildPersistedGenerationConfig(config(10), { clipStart: "2", clipEnd: "8" });
  assert.equal(persisted.duration, 10);
  assert.equal(persisted.clip_start, 2);
  assert.equal(persisted.clip_end, 8);
  assert.equal(persisted.resolution, "720p");
  assert.equal(persisted.model_id, "kling-v3-pro");
});

test("persists the complete canonical Task input and replacement Asset references", () => {
  const generationConfig = buildPersistedGenerationConfig(config(4), { clipStart: 0, clipEnd: 4 });
  const replacements = [{
    group: "主体", replacement: "模特.png", asset_id: "asset-1",
    storage_path: "project/replacement_image/asset-1.png",
  }];
  const input = buildGenerationTaskInput({
    prompt: "最终生成 Prompt", replacements, extraPrompt: "保持镜头稳定",
    sourceVideoTaskId: "task-source", sourceVideoStoragePath: "project/original_video/source.mp4",
    generationConfig, clipStart: 0, clipEnd: 4,
  });
  assert.equal(input.duration, 4);
  assert.equal(input.aspect_ratio, "9:16");
  assert.equal(input.resolution, "720p");
  assert.equal(input.model_name, "可灵 v3.0 Pro");
  assert.deepEqual(input.model_params, generationConfig);
  assert.equal(input.prompt, "最终生成 Prompt");
  assert.equal(input.extra_prompt, "保持镜头稳定");
  assert.deepEqual(input.replacement_assets, replacements);
  assert.equal(input.replacement_assets[0].asset_id, "asset-1");
});
