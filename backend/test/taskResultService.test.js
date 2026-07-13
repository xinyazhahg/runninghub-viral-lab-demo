const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createTaskResultService, INCOMPLETE_STATUSES } = require("../services/taskResultService");

test("createTask persists the project, type, input, and start time", async () => {
  let inserted;
  const client = {
    from(table) {
      assert.equal(table, "tasks");
      return {
        insert(payload) {
          inserted = payload;
          return { select() { return { single: async () => ({ data: { id: "task-1", ...payload }, error: null }) }; } };
        },
      };
    },
  };
  const service = createTaskResultService({ client });
  const task = await service.createTask({
    projectId: "project-1",
    taskType: "generate_video",
    status: "created",
    inputData: { prompt: "test" },
  });
  assert.equal(task.id, "task-1");
  assert.equal(inserted.project_id, "project-1");
  assert.equal(inserted.task_type, "generate_video");
  assert.deepEqual(inserted.input_data, { prompt: "test" });
  assert.match(inserted.started_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("terminal task update automatically persists finished_at", async () => {
  let updated;
  const client = {
    from(table) {
      assert.equal(table, "tasks");
      return {
        update(payload) {
          updated = payload;
          return {
            eq(field, value) {
              assert.equal(field, "id");
              assert.equal(value, "task-1");
              return { select() { return { single: async () => ({ data: payload, error: null }) }; } };
            },
          };
        },
      };
    },
  };
  const service = createTaskResultService({ client });
  await service.updateTask("task-1", { status: "failed", error_message: "provider failed" });
  assert.equal(updated.error_message, "provider failed");
  assert.match(updated.finished_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.updated_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("createResult delegates atomic version allocation to the database RPC", async () => {
  let rpcName;
  let rpcPayload;
  const client = {
    async rpc(name, payload) {
      rpcName = name;
      rpcPayload = payload;
      return { data: { id: "result-1", version: 3 }, error: null };
    },
  };
  const service = createTaskResultService({ client });
  const result = await service.createResult({
    projectId: "project-1",
    taskId: "task-3",
    videoUrl: "https://cdn.example/v3.mp4",
    prompt: "prompt",
    modelName: "model",
    modelParams: { duration: 10 },
    duration: 10,
    cost: "1.2",
  });
  assert.equal(rpcName, "create_project_result");
  assert.equal(rpcPayload.p_project_id, "project-1");
  assert.equal(rpcPayload.p_task_id, "task-3");
  assert.deepEqual(rpcPayload.p_model_params, { duration: 10 });
  assert.equal(result.version, 3);
});

test("migration enforces one result per task and one version per project", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/002_task_result.sql"),
    "utf8"
  );
  assert.match(migration, /unique \(project_id, version\)/i);
  assert.match(migration, /unique \(task_id\)/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /create_project_result/i);
  assert.deepEqual(INCOMPLETE_STATUSES, ["created", "queued", "analyzing", "generating"]);
});
