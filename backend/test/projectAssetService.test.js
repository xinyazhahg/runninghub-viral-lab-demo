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
  let insertedRecord;
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
          insertedRecord = arguments[0];
          return { select() { return { single: async () => ({ data: null, error: new Error("db failed") }) }; } };
        },
      };
    },
  };
  const service = createProjectAssetService({ client, bucket: "test" });
  await assert.rejects(() => service.uploadAsset({
    projectId: "project-1",
    file: { originalname: "subject.png", mimetype: "image/png", size: 3, buffer: Buffer.from("abc") },
    assetType: "image",
    purpose: "character_reference",
    replacementType: "subject",
  }), /db failed/);
  assert.equal(insertedRecord.asset_type, "image");
  assert.equal(insertedRecord.purpose, "character_reference");
  assert.equal(removed.length, 1);
  assert.match(removed[0], /^project-1\/image\//);
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
    assetType: "video",
    purpose: "source_video",
  }), /storage failed/);
  assert.equal(databaseTouched, false);
});

test("source video retries with the legacy assets schema when reference columns are absent", async () => {
  const records = [];
  const storage = {
    upload: async () => ({ error: null }),
    createSignedUrl: async (storagePath) => ({ data: { signedUrl: `https://signed.example/${storagePath}` }, error: null }),
    remove: async () => ({ error: null }),
  };
  const client = {
    storage: { from: () => storage },
    from(table) {
      assert.equal(table, "assets");
      return {
        insert(record) {
          records.push(record);
          return { select() { return { single: async () => records.length === 1
            ? ({ data: null, error: { code: "PGRST204", message: "Could not find the 'asset_ref' column of 'assets' in the schema cache" } })
            : ({ data: { id: "asset-source", ...record }, error: null }) }; } };
        },
      };
    },
  };
  const service = createProjectAssetService({ client, bucket: "test" });
  const asset = await service.uploadAsset({
    projectId: "project-1", userId: "user-1",
    file: { originalname: "source.mp4", mimetype: "video/mp4", size: 3, buffer: Buffer.from("abc") },
    assetType: "video", purpose: "source_video",
  });
  assert.equal(records[0].asset_type, "video");
  assert.equal(records[0].purpose, "source_video");
  assert.equal(records[1].asset_type, "original_video");
  assert.equal("purpose" in records[1], false);
  assert.equal("asset_ref" in records[1], false);
  assert.equal(asset.asset_type, "original_video");
});

test("project lookup always scopes authenticated requests by user_id", async () => {
  const filters = [];
  const query = {
    select() { return this; },
    eq(field, value) { filters.push([field, value]); return this; },
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const client = { from(table) { assert.equal(table, "projects"); return query; } };
  const service = createProjectAssetService({ client, bucket: "test" });
  const project = await service.getProject("project-a", "user-b");
  assert.equal(project, null);
  assert.deepEqual(filters, [["id", "project-a"], ["user_id", "user-b"]]);
});

test("reference image, video and audio persist physical types and complete bindings", async () => {
  const records = [];
  const storage = {
    upload: async () => ({ error: null }),
    createSignedUrl: async (storagePath) => ({ data: { signedUrl: `https://signed.example/${storagePath}` }, error: null }),
  };
  const client = {
    storage: { from: () => storage },
    from(table) {
      assert.equal(table, "assets");
      return {
        insert(record) {
          records.push(record);
          return { select() { return { single: async () => ({ data: { id: `asset-${records.length}`, ...record }, error: null }) }; } };
        },
      };
    },
  };
  const service = createProjectAssetService({ client, bucket: "test" });
  const inputs = [
    ["image", "character_reference", "@图片1", "subject_01", "image/png", "subject.png"],
    ["video", "action_reference", "@视频1", "subject_01", "video/mp4", "motion.mp4"],
    ["audio", "audio_reference", "@音频1", "", "audio/mpeg", "voice.mp3"],
  ];
  for (const [assetType, purpose, assetRef, targetPlaceholderId, mimetype, originalname] of inputs) {
    await service.uploadAsset({
      projectId: "project-1", userId: "user-1",
      file: { originalname, mimetype, size: 3, buffer: Buffer.from("abc") },
      assetType, purpose, assetRef, targetPlaceholderId, confidence: 0.9,
    });
  }
  assert.deepEqual(records.map((item) => item.asset_type), ["image", "video", "audio"]);
  assert.deepEqual(records.map((item) => item.purpose), ["character_reference", "action_reference", "audio_reference"]);
  assert.deepEqual(records.map((item) => item.asset_ref), ["@图片1", "@视频1", "@音频1"]);
  assert.equal(records[0].target_placeholder_id, "subject_01");
  assert.equal(records[0].confidence, 0.9);
});
