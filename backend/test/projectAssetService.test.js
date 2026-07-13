const test = require("node:test");
const assert = require("node:assert/strict");
const { assertReplacementType, sanitizeFilename, createProjectAssetService } = require("../services/projectAssetService");

test("replacement type only accepts supported values", () => {
  assert.doesNotThrow(() => assertReplacementType("subject"));
  assert.doesNotThrow(() => assertReplacementType("scene"));
  assert.doesNotThrow(() => assertReplacementType("element"));
  assert.throws(() => assertReplacementType("text"), /subject、scene 或 element/);
});

test("storage filename keeps only a safe extension", () => {
  assert.match(sanitizeFilename("人物照片.PNG"), /^[0-9a-f-]+\.png$/);
  assert.match(sanitizeFilename("../../evil.exe<script>"), /^[0-9a-f-]+$/);
});

test("database insert failure removes uploaded orphan object", async () => {
  const removed = [];
  const storage = {
    upload: async () => ({ error: null }),
    getPublicUrl: (storagePath) => ({ data: { publicUrl: `https://cdn.example/${storagePath}` } }),
    remove: async (paths) => { removed.push(...paths); return { error: null }; },
  };
  const client = {
    storage: { from: () => storage },
    from(table) {
      assert.equal(table, "assets");
      return {
        insert() {
          return { select() { return { single: async () => ({ data: null, error: new Error("db failed") }) }; } };
        },
      };
    },
  };
  const service = createProjectAssetService({ client, bucket: "test" });
  await assert.rejects(() => service.uploadAsset({
    projectId: "project-1",
    file: { originalname: "subject.png", mimetype: "image/png", size: 3, buffer: Buffer.from("abc") },
    assetType: "replacement_image",
    replacementType: "subject",
  }), /db failed/);
  assert.equal(removed.length, 1);
  assert.match(removed[0], /^project-1\/replacement_image\//);
});

test("storage failure never inserts an asset row", async () => {
  let databaseTouched = false;
  const client = {
    storage: { from: () => ({
      upload: async () => ({ error: new Error("storage failed") }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }) },
    from() { databaseTouched = true; return {}; },
  };
  const service = createProjectAssetService({ client, bucket: "test" });
  await assert.rejects(() => service.uploadAsset({
    projectId: "project-1",
    file: { originalname: "source.mp4", mimetype: "video/mp4", size: 3, buffer: Buffer.from("abc") },
    assetType: "original_video",
  }), /storage failed/);
  assert.equal(databaseTouched, false);
});
