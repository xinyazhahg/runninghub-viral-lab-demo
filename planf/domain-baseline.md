# Domain Skill Baseline

> 所有领域 Skill 的共享基线。领域 Skill 只写增量，不重复总控、协议和能力矩阵。

## 一、共同职责

领域 Skill 只负责三件事：

1. 提供领域知识与判断框架
2. 定义本领域最小 blocker 或高价值确认点
3. 给下游 `prompter` / `video-prompt` / `reverse-engineer` / `engineer` 提供增量约束

## 二、不负责的事

领域 Skill 不负责：

- 维护完整路由表
- 维护完整客户端协议
- 维护完整节点能力说明
- 输出 `workflow-json`
- 抢占 `engineer` 的装配职责
- 把自己写成第二个总控

## 三、阶段边界

- 默认归属 `A / B`
- 是否进入 `B`，由 `phase-policy.md` 决定
- 如果信息足够，领域 Skill 应直接输出 brief，不要强行追问
- 允许在首条外显回复里输出 `agent-persona`，但仅限非直出执行轮
- `agent-persona` 只是亮相，不是完成
- 如果总控已经判定可直接执行，领域 Skill 不能让本轮停在 brief
- 不允许在同一轮里同时追问和交付工作流

## 四、Deep Mode 扩展

支持 Deep Mode 的领域 Skill 需要额外遵守：

- 在 `SKILL.md` 中声明 `Deep Mode` 章节
- 在 `skill-registry.yaml` 中声明 `deepMode` 配置
- Deep Mode 阶段输出 `creative-doc` 而不是 `form-fields` 或 `workflow-json`
- Deep Mode 的每个阶段必须附带 checkpoint
- Deep Mode 完成后输出增强版 handoff-brief（含 `assetRegistry`）
- Deep Mode 不改变领域 Skill 在标准道上的行为

### 4.1 Deep Mode 与标准道的关系

同一个领域 Skill 需要同时支持两种模式：

- **标准道**（score < triggerThreshold）：按 PlanC 方式工作，输出 brief 后继续 `C -> D`
- **文档链道**（score >= triggerThreshold）：展开文档链，逐阶段输出 `creative-doc`

这两种模式共享同一套领域知识，但执行深度不同。

## 五、追问规则

只有同时满足以下两点，才允许进入 `form-fields`：

1. 本领域最小 blocker 真的存在，或者存在一次高价值确认点
2. 这些信息无法从用户描述、上传素材、画布上下文或专业默认值中补齐

文档链道不使用 `form-fields`，改用 `creative-doc` 的 checkpoint 机制。

## 六、交接格式

交给下游时，优先使用 `handoff-brief.md` 里的统一结构。

如果来自文档链，使用增强版 handoff-brief（含 `assetRegistry`、`clipTable`）。

## 七、能力边界

- 这里描述的是 RunningHub 画布创作链路
- 图片直接说"图片"
- 视频对外统一叫“视频主链”或“视频 workflow”
- 条件能力必须显式标注为条件使用
- 不要把 OpenClaw 平台原生 Canvas 假设混进来

## 八、推荐章节

每个领域 Skill 默认保留这些核心部分：

1. 角色定位
2. 触发标签
3. 领域 blocker / 高价值确认点
4. 领域知识与默认值
5. 给 Prompt Skill 的增量
6. 给 Engineer 的增量
7. 输出约束
8. **Deep Mode**（如支持）
