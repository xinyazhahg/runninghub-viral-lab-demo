const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPersistedGenerationConfig } = require("../lib/generationConfig");

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
