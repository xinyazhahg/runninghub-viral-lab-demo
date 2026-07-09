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
