const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createAuthService, createRequireAuth, extractBearerToken } = require("../services/authService");

test("Bearer token parser rejects non-Bearer credentials", () => {
  assert.equal(extractBearerToken("Bearer access-token"), "access-token");
  assert.equal(extractBearerToken("Basic abc"), "");
  assert.equal(extractBearerToken(""), "");
});

test("auth service resolves the current user from Supabase Auth", async () => {
  const client = { auth: { getUser: async (token) => ({ data: { user: { id: `user-${token}` } }, error: null }) } };
  const user = await createAuthService({ client }).getUser("one");
  assert.equal(user.id, "user-one");
});

test("auth middleware returns 401 without a valid user", async () => {
  const middleware = createRequireAuth({ serviceFactory: () => ({ getUser: async () => null }) });
  const req = { headers: {} };
  const response = {};
  const res = {
    status(code) { response.status = code; return this; },
    json(payload) { response.payload = payload; return this; },
  };
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  assert.equal(response.status, 401);
  assert.equal(response.payload.error, "UNAUTHORIZED");
  assert.equal(nextCalled, false);
});

test("user ownership migration defines RLS and private storage", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/003_user_ownership.sql"), "utf8");
  for (const table of ["projects", "assets", "tasks", "results"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} add column if not exists user_id`, "i"));
    assert.match(sql, new RegExp(`create policy ${table}_owner_all`, "i"));
  }
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /update storage\.buckets set public = false/i);
  assert.match(sql, /inherit_project_user_id/i);
});
