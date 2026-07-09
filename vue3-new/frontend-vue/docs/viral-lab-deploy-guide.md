# 爆款实验室部署指南

## 本地启动

后端：

```bash
cd backend
npm install
cp .env.example .env
export RUNNINGHUB_API_KEY=your_runninghub_key
node server.js
```

前端：

```bash
cd vue3-new/frontend-vue
npm install
cp .env.example .env
npm run dev
```

本地开发时 `VITE_API_BASE_URL` 可以留空，Vite 会通过 `vite.config.js` 里的 `server.proxy` 把 `/api` 和 `/generated` 转发到 `http://localhost:3000`。该 proxy 只作用于本地 Vite dev server，不会随前端静态产物部署到线上。

## 前端环境变量

前端只配置后端访问地址，不配置 RunningHub API Key。

```env
VITE_API_BASE_URL=https://your-backend.example.com
```

线上构建后，前端请求会变成：

```text
https://your-backend.example.com/api/video-to-text
https://your-backend.example.com/api/generate-video
```

如果 `VITE_API_BASE_URL` 为空，则仍请求 `/api/video-to-text` 和 `/api/generate-video`，适合本地代理或同域部署。

## 后端环境变量

后端必须读取环境变量中的 RunningHub Key，不要把真实 Key 写入前端代码或提交到仓库。

```env
RUNNINGHUB_API_KEY=your_runninghub_key
PORT=3000
FRONTEND_ORIGIN=https://your-frontend.example.com
CORS_ORIGINS=http://localhost:5173,https://your-preview.example.com
```

说明：

- `RUNNINGHUB_API_KEY`：必填，后端调用 RunningHub 使用。
- `PORT`：部署平台通常会自动注入，未设置时默认 `3000`。
- `FRONTEND_ORIGIN`：允许跨域访问后端的正式前端域名。
- `CORS_ORIGINS`：可选，逗号分隔，适合增加预览域名或多个部署域名。
- `RUNNINGHUB_SKILL_DIR`、SAM 相关变量仅在对应接口需要时配置。

如果后端缺少 `RUNNINGHUB_API_KEY`，接口会返回：

```text
后端未配置 RunningHub API Key
```

## 部署后验证

1. 打开线上前端页面，确认浏览器控制台没有 CORS 错误。
2. 在 Demo 或测试台上传一个小视频，点击 video-to-text 测试，确认请求到线上后端的 `/api/video-to-text`。
3. 生成 Prompt 后点击生成视频，确认请求到线上后端的 `/api/generate-video`。
4. 如果返回 `videoUrl` 或 `/generated/...`，页面应能直接播放视频；前后端分开部署时，前端会把相对视频地址补成后端域名。
5. 如果接口失败，页面应显示中文错误信息，后端日志应能看到对应接口调用。
