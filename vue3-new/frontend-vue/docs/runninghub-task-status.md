# RunningHub Task Status Follow-up

当前前端的 `/api/generate-video` 调用仍按现有同步接口工作：提交请求后等待后端直接返回生成结果或错误。

后续若要启用真正的任务轮询，需要补充一个后端任务状态查询接口，例如：

- `GET /api/generate-video/status?taskId=...`
- 返回字段建议包含 `taskId`、`status`、`cost`、`videoUrl`、`error`
- 前端可每 3-5 秒轮询一次，直到 `success`、`failed` 或 `timeout`

当前版本已在前端保留生成中状态、耗时显示、taskId 展示位和 5 分钟超时提示。
