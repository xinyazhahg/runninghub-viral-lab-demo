# outputs-clean 项目结构

## 目录结构

```
outputs-clean/
├── react-old/              # 旧版前端（原生 HTML + JS）
│   ├── index.html
│   ├── script.js
│   ├── styles.css
│   ├── assets/
│   └── README.md
│
├── vue3-new/               # Vue3 新版前端
│   └── frontend-vue/
│       ├── src/
│       ├── package.json
│       ├── vite.config.js
│       └── README.md
│
├── backend/                # 后端服务
│   ├── server.js
│   ├── uploads/
│   ├── package.json
│   └── README.md
│
└── README.md               # 本文件
```

## 启动方式

### 后端

```bash
cd backend
npm install
node server.js
```

访问：http://localhost:3000

### 旧版前端

不需要单独启动，由后端 Express 托管。

启动后端后直接访问：http://localhost:3000

### Vue3 前端

```bash
cd vue3-new/frontend-vue
npm install
npm run dev
```

访问：http://localhost:5173

> ⚠️ Vue3 前端需要后端同时运行。Vite 会把 `/api` 和 `/generated` 请求代理到 `http://localhost:3000`。

## 后续修改指南

### 改 Vue3 页面

进入 `vue3-new/frontend-vue/src/` 目录：

| 想改什么 | 打开哪个文件 |
|----------|-------------|
| 页面整体结构 | `src/App.vue` |
| 上传视频区域 | `src/components/UploadNode_上传视频节点.vue` |
| 拆解进度/结果 | `src/components/AnalysisNode_视频拆解节点.vue` |
| 替换面板/生成按钮 | `src/components/ReplacePanel_上传替换定制面板.vue` |
| 替换项卡片 | `src/components/CustomItemCard_替换项卡片.vue` |
| 生成结果展示 | `src/components/ResultCard_生成结果卡片.vue` |
| 素材选择弹窗 | `src/components/AssetModal_素材替换弹窗.vue` |
| 参数调整弹窗 | `src/components/ParamModal_参数调整弹窗.vue` |
| 全局状态/业务逻辑 | `src/composables/useApp_页面状态管理.js` |
| 接口请求 | `src/api/runninghubApi_接口请求.js` |
| 样式 | `src/styles/global.css` |

### 改后端接口

进入 `backend/` 目录，修改 `server.js`。

### 参考旧版实现

查看 `react-old/` 目录下的 `index.html`、`script.js`、`styles.css`。

## 不应该改的文件

| 文件 | 原因 |
|------|------|
| `react-old/*` | 旧版前端，只读参考 |
| `backend/server.js` 中的现有接口 | 不要改 `/api/video-to-text`、`/api/generate-video` 的逻辑 |
