# backend 后端服务

Express 后端，提供 API 接口和静态资源托管。

## 文件说明

- `server.js` — 后端入口，所有 API 接口都在这里
- `package.json` — 依赖配置
- `package-lock.json` — 依赖锁定
- `uploads/` — 上传文件临时目录
- `node_modules/` — 依赖包

## 现有接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/video-to-text` | POST | 视频拆解 |
| `/api/generate-video` | POST | 视频生成 |
| `/api/extract-element-preview` | POST | SAM3 抠图（开发中） |
| `/generated/*` | GET | 生成文件访问 |
| `/uploads/*` | GET | 上传文件访问 |
| `/api/projects` | POST | 创建持久化 Project |
| `/api/projects/original-video` | POST | 创建/更新 Project 并持久化原视频 Asset |
| `/api/projects/:projectId` | GET | 获取 Project 和 Asset 列表 |
| `/api/projects/:projectId/assets/replacement` | POST | 上传替换图片 Asset |
| `/api/projects/:projectId/assets/:assetId` | DELETE | 删除替换素材 Asset |
| `/api/me` | GET | 获取当前登录用户 |
| `/api/projects` | GET | 获取当前用户的作品列表 |
| `/api/projects/:projectId` | DELETE | 删除本人项目及关联数据、存储对象 |
| `/api/projects/:projectId/tasks` | GET | 获取项目任务列表 |
| `/api/tasks/:taskId` | GET | 获取单个持久化任务状态 |
| `/api/projects/:projectId/results` | GET | 获取项目结果版本列表 |
| `/api/tasks/:taskId/retry` | POST | 校验失败任务并记录重试次数 |

## Project + Asset 持久化

1. 在 Supabase SQL Editor 依次执行 `supabase/migrations/001_project_asset.sql`、`002_task_result.sql` 和 `003_user_ownership.sql`。
2. 在后端环境配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`。
3. Service Role Key 仅允许出现在后端，不能放入任何 `VITE_` 环境变量。

默认 Bucket 名为 `viral-lab-assets`，migration 会创建公开 Bucket。数据库表启用 RLS，第一轮仅由后端 Service Role 访问。

## Task + Result 持久化

- `tasks` 保存视频拆解和视频生成的内部任务 ID、第三方任务 ID、状态、阶段、输入输出、失败原因及时间信息。
- `results` 保存生成视频、Prompt、模型参数和项目内版本号。
- `create_project_result` 数据库函数在同一 Project 内原子分配版本号，并通过唯一约束避免重复 Result。
- 服务启动时会扫描未完成任务；存在 `external_task_id` 的任务继续查询第三方状态，尚未取得第三方任务 ID 的中断任务会记录为失败并保留明确原因。
- 进程内 Map 仅作为运行期缓存，任务查询、刷新恢复和历史版本均以数据库为准。

## 用户系统与数据隔离

- 除 `/api/health` 外，所有 `/api` 请求都需要 Supabase Auth Access Token：`Authorization: Bearer <token>`。
- 后端通过 Supabase Auth `getUser` 验证 Token，并使用验证后的用户 ID 查询数据，不读取前端传入的 `user_id`。
- `projects`、`assets`、`tasks`、`results` 均带 `user_id`，子对象由数据库触发器继承 Project 所有者。
- RLS 使用 `auth.uid() = user_id` 隔离不同用户。
- Storage Bucket 在第三轮迁移后为私有；后端按用户归属验证后签发一小时有效的访问地址。
- 迁移前已有且无法确认所有者的 Project 会保留空 `user_id`，普通用户不可访问。管理员确认所有者后应手动回填 Project，子对象可再次执行迁移中的同步语句完成归属。

## 启动方式

```bash
cd backend
npm install
node server.js
```

访问：http://localhost:3000

## 静态资源说明

后端同时托管旧版前端（`react-old/`）的静态文件：
- `http://localhost:3000/` → `react-old/index.html`
- `http://localhost:3000/styles.css` → `react-old/styles.css`
- `http://localhost:3000/script.js` → `react-old/script.js`
- `http://localhost:3000/assets/*` → `react-old/assets/*`

Vue3 开发服务器的 `/api` 和 `/generated` 请求会代理到这里。

## 注意

- **不要修改现有接口逻辑**
- 新增接口直接在 `server.js` 里加
- `uploads/` 目录会自动创建，不用手动管
