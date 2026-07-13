const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMultipartFilename } = require("../lib/filenameEncoding");

test("recovers UTF-8 Chinese filenames decoded as latin1", () => {
  assert.equal(normalizeMultipartFilename("æµè¯.mp4"), "测试.mp4");
  assert.equal(normalizeMultipartFilename("å¥¥å©å¥¥.jpg"), "奥利奥.jpg");
});

test("keeps valid Chinese, English, and numeric filenames unchanged", () => {
  for (const filename of ["测试.mp4", "video.mp4", "2026-07-13.mp4", "video_测试_01.mp4"]) {
    assert.equal(normalizeMultipartFilename(filename), filename);
  }
});

test("does not replace a filename when latin1 bytes are not valid UTF-8", () => {
  assert.equal(normalizeMultipartFilename("café.mp4"), "café.mp4");
});
