# react-old 旧版前端

旧版前端页面，基于原生 HTML + CSS + JavaScript。

## 文件说明

- `index.html` — 页面结构
- `script.js` — 交互逻辑
- `styles.css` — 页面样式
- `assets/` — 静态资源（封面图等）

## 如何访问

旧版不需要单独启动，由后端 Express 托管静态文件。

```bash
cd ../backend
npm install
node server.js
```

访问：http://localhost:3000

后端会自动将 `react-old/` 目录作为静态资源根，直接访问 `http://localhost:3000/` 即可打开旧版页面。

## 注意

- 这个文件夹是旧版前端，**不要在这里改代码**
- 如果需要参考旧版实现，看这里的文件
- 新功能开发请去 `../vue3-new/frontend-vue/`
