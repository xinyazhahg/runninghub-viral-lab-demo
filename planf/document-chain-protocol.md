# Document Chain Protocol

> 文档链的通用约束。所有支持 Deep Mode 的领域 Skill 都必须遵守本协议。

## 一、文档链是什么

文档链是复杂创意任务的渐进深化管线。每一份文档是前一份的结构化展开，也是后一份的输入约束。文档链结束后，进入标准的 `C -> D` 执行阶段。

文档链不是 Agent 自由发挥的散文，而是由领域 Skill 在 `skill-registry.yaml` 的 `deepMode.documentChain` 中预先声明的结构化模板。

## 二、通用约束

1. **每轮只产出一个 `creative-doc`**（硬规则，下面单列一节）
2. 每个 `creative-doc` 必须附带 checkpoint
3. 用户确认后继续下一个文档
4. 用户可以在任何 checkpoint 说"直接做"跳出文档链
5. 用户可以在任何 checkpoint 说"你来定"跳过当前阶段
6. 文档链最多 4 个阶段（防止无限深化）
7. 文档链阶段只输出 `creative-doc`，不输出 `workflow-json` 或 `form-fields`
8. 文档链不是展示分析能力的舞台，是帮用户做决策的工具

### 二.A 阶段门禁（Phase Gating）— 硬红线

> **⛔ 一轮消息中绝对不允许出现 2 个及以上 `creative-doc` fence。**
>
> 即使"剧本"和"资产注册表"看起来属于同一个主题，也必须分成 2 轮独立交付：
>
> 1. 第一轮：输出第 N 阶段的 `creative-doc`（含 checkpoint 按钮）
> 2. 等用户点"确认，继续下一步"（或等价的文字确认）
> 3. 第二轮：才允许输出第 N+1 阶段的 `creative-doc`
>
> **典型违规**（以 `video-sop` 为例，都是真实 badcase）：
>
> - ❌ 在同一条回复里同时放 Phase 3&4 的"剧本 creative-doc" + Phase 5 的"资产注册表 creative-doc"
> - ❌ 把多个阶段塞进一个 `creative-doc` 的多个 section（"一个文档两个 checkpoint"也不行）
> - ❌ 用户说"继续 / 开始"就**顺势打包**后面几个阶段一次交付
>
> **前端已对违规做红色横幅警告**：一轮出现多个 `creative-doc` 时，用户会看到"Agent 违反了阶段门禁"的提示以及"让 Agent 回到单阶段交付"的按钮。**出现这条横幅 = 你这一轮一定是违规了**。
>
> **即使用户说"继续 / 开始 / 直接做"也不允许跳过阶段门禁**——用户的口令只能触发**下一轮**单独交付下一个阶段，不能被解释为"把剩下所有阶段一次交付"。如果用户明确说"跳过文档链直接上生产"，才走 § 六 的降级路径，进入 `C -> D`。

## 三、文档间的数据传递

- 每个文档的结构化输出存入 `thinking` 中的累积 brief
- 后一个文档必须引用前一个文档的关键决策
- 最终文档的输出作为增强版 handoff-brief 传给 `C -> D`
- 增强版 handoff-brief 中应包含：
  - 标准 handoff-brief 的所有字段
  - `assetRegistry`：角色、场景、道具的一致性锚点
  - `clipTable`（如有）：片段列表和时长

## 四、跨文档一致性

- 角色/场景/道具的描述一旦在某个文档中确定，后续文档不能自相矛盾
- 如果用户在 checkpoint 修改了某个角色/场景描述，后续文档必须同步更新
- 最终文档必须包含 `assetRegistry`（资产注册表）
- `assetRegistry` 会传递给 `prompter` / `video-prompt` 确保跨节点一致性

## 五、资产注册表结构

```
{
  "characters": [
    {
      "name": "女主",
      "appearance": "亚洲面孔，28岁，齐肩棕色直发，眉眼柔和",
      "costume": "浅灰色棉质居家服",
      "clips": [1, 2, 3, 4, 5, 6, 7]
    }
  ],
  "scenes": [
    {
      "name": "卧室-窗边",
      "description": "现代简约卧室窗边，米白色墙面，人字纹浅棕色木地板",
      "clips": [1, 2, 3, 4, 5, 7]
    }
  ],
  "props": [
    {
      "name": "高遮光奶茶色窗帘",
      "description": "奶茶色加厚雪尼尔面料，垂坠感强，褶皱整齐均匀",
      "clips": [1, 2, 3, 4, 5, 6, 7]
    }
  ]
}
```

## 六、文档链的降级

- 如果用户在第一个 checkpoint 就说"直接做" → 降级为标准道或快速道，用已有信息生成首版
- 如果用户在中间 checkpoint 说"直接做" → 用已完成文档的信息作为 brief，跳入 `C -> D`
- 如果没有匹配的领域 Skill 声明 Deep Mode → 自动降级为标准道
- 降级时不丢弃已完成的文档信息

## 七、checkpoint 的用户响应

| 用户行为 | Agent 响应 |
|---------|-----------|
| "确认" / "没问题" / "继续" | 进入下一个文档阶段 |
| "这块改一下xxx" | 修改当前文档后重新输出 |
| "你来定" | 跳过当前文档，用默认值继续 |
| "直接做" / "不用这么详细" | 终止文档链，用已有信息进入 `C -> D` |
| 具体修改意见 | 针对性修改后重新输出当前文档 |

## 八、文档链的触发条件

文档链不是默认行为，必须同时满足：

1. Analyst 复杂度评分达到领域 Skill 的 `deepMode.triggerThreshold`
2. 匹配的领域 Skill 声明了 `deepMode.enabled: true`
3. 用户没有显式说"直接做"

或者：

- 用户显式要求"帮我详细策划" / "出完整方案" / "分镜设计"（跳过评分直接触发）

## 九、领域 Skill 如何声明 Deep Mode

在 `SKILL.md` 中新增 `Deep Mode` 章节，包含：

1. 触发条件
2. 文档链模板（每个阶段的名称、输出结构、checkpoint 文案）
3. 引用的 reference 文件

详见 `authoring/skill-template.md` 中的 Deep Mode 模板。

## 十、`creative-doc` 输出格式

文档链的每个阶段输出一个 `creative-doc` 协议块：

````markdown
```creative-doc
{
  "type": "strategy",
  "title": "产品广告策略",
  "domain": "marketing-video",
  "phase": 1,
  "totalPhases": 3,
  "checkpoint": true,
  "checkpointPrompt": "对这个策略方向满意吗？确认后进入脚本创作~",
  "sections": [
    {
      "heading": "广告类型",
      "layout": "key-value",
      "data": {
        "广告类型": "产品硬广(强转化)",
        "目标受众": "有居家装修需求的业主、租房人群"
      }
    },
    {
      "heading": "情节弧线",
      "layout": "timeline",
      "data": [
        {"beat": "激发事件", "description": "正午阳光晃眼，睡不着"},
        {"beat": "冲突", "description": "普通窗帘遮不住光"},
        {"beat": "解决", "description": "换上高遮光窗帘"},
        {"beat": "证据", "description": "亮度仪测试+投影效果"},
        {"beat": "行动", "description": "引导购买"}
      ]
    }
  ]
}
```
````

### 10.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 文档类型，由领域 Skill 的 `deepMode.documentChain` 定义 |
| `title` | string | 是 | 文档标题 |
| `domain` | string | 是 | 来源领域 Skill 名称 |
| `phase` | number | 是 | 当前阶段编号（从 1 开始） |
| `totalPhases` | number | 是 | 文档链总阶段数 |
| `checkpoint` | boolean | 是 | 是否需要用户确认 |
| `checkpointPrompt` | string | 是 | 确认引导文案 |
| `sections` | array | 是 | 文档内容区块列表 |

### 10.2 `sections` 的 layout 类型（封闭集合 — 禁止自创）

> **⛔ 硬规则：layout 只允许下表中的 8 个值。前端渲染器对未知 layout 没有任何兜底，写了不在表中的值会导致该 section 完全不渲染、数据丢失。**
>
> **绝对不要发明** `scene-list`、`asset-registry`、`cards`、`options`、`markdown`、`image`、`code`、`steps`、`comparison`、`summary` 等自定义值。

| layout | 说明 | 数据字段 | 适用场景 |
|--------|------|---------|---------|
| `key-value` | 两列键值网格 | `data: { "键": "值" }` | 策略属性、角色属性、配置概览 |
| `timeline` | 竖向时间轴 | `data: [{ beat: "标题", description: "描述" }]` | 情节弧线、叙事节拍、制作流程 |
| `table` | 标准表格 | `data: [{ 列名: 值 }]`（对象数组，自动提取表头） | Clip 编排表、资产注册表 |
| `list` | 无序/有序列表 | `data: ["项目1", "项目2"]`；加 `ordered: true` 切有序 | 角色清单、素材清单、检查项 |
| `text` | 纯文本段落 | `content: "字符串"` | 大纲、概要、描述、说明 |
| `highlight` | 高亮提示块 | `content: "高亮文本"` | 重要提醒、关键决策摘要 |
| `screenplay` | 剧本/分场脚本 | `data: [{ scene, setting, duration?, action?, dialogue?, character?, emotion?, notes? }]` | 分场脚本、广告脚本、短片剧本 |
| `storyboard` | 分镜面板 | `data: [{ shot, camera?, duration?, description, audio?, transition?, thumbnail? }]`；可选 `columns`（默认 3） | 分镜板、镜头规划、Shot 列表 |

#### `screenplay` 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scene` | number | 是 | 场景序号 |
| `setting` | string | 是 | 场景标头（INT./EXT. + 地点 + 时间） |
| `duration` | string | 否 | 预估时长 |
| `action` | string | 否 | 动作/画面描述 |
| `dialogue` | string | 否 | 对白或旁白 |
| `character` | string | 否 | 说话人（有 dialogue 时建议填写） |
| `emotion` | string | 否 | 情绪关键词 |
| `notes` | string | 否 | 导演备注（镜头、色调等） |

#### `storyboard` 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `shot` | string | 是 | 镜号（如 S001） |
| `camera` | string | 否 | 运镜/景别（如「全景-推」「特写」） |
| `duration` | string | 否 | 该镜头时长 |
| `description` | string | 是 | 画面描述 |
| `audio` | string | 否 | 声音/音效描述 |
| `transition` | string | 否 | 转场方式（淡入、硬切等） |
| `thumbnail` | string | 否 | 预览图 URL（可选，无则显示占位） |

section 级可设 `columns`（整数，默认 3），控制面板列数。

#### 常见内容如何用已有 layout 表达

| 你想表达的东西 | 正确做法 | 示例 |
|-------------|---------|------|
| 场景列表（含子字段） | `layout: "screenplay"` | `data: [{"scene":1,"setting":"INT. 卧室 - 清晨","action":"女主睁眼","duration":"5s"}]` |
| 分镜板（镜头网格） | `layout: "storyboard"` | `data: [{"shot":"S001","camera":"全景","description":"卧室全景"}]` |
| 简单场景/Clip 表 | `layout: "table"` | `data: [{"场景":"卧室","时长":"5s","动作":"起床","情绪":"慵懒"}]` |
| 资产注册表 | `layout: "table"` | `data: [{"名称":"女主","类型":"角色","外观":"齐肩棕发","出现片段":"1,2,3"}]` |
| 用户可选方案 | **不设 layout**，写 `options` 字段 | `{"heading":"方案选择","options":[{"id":"A","label":"方案A","desc":"..."}]}` |

> **⛔ `option.id` 硬约束**：`option.id` 只能写 **单字母（A/B/C）或单个数字（1/2/3）**，最多 2 个字符。`direction_1` / `option_a` / `theme-dark` 这种 snake_case 或长字符串一律禁止——前端徽章只有 24×24px，长 ID 会被换行成 "dire / ctio / n_1" 这种畸形显示。真实语义请写在 `label` / `desc` 里。`id` 仅供用户点击回传时定位，**不是给人看的字段**。
| 信息卡片 | **不设 layout**，`content` 写对象数组 | `{"heading":"角色卡","content":[{"名称":"女主","年龄":"28","造型":"..."}]}` |

> **options 与 cards 注意**：前端通过检测 `section.options` 数组或 `section.content` 对象数组自动渲染为可点击选项卡 / 卡片。**不需要也不应该设置 `layout` 字段**——设了反而走错渲染分支。

### 10.3 内容字段允许使用 Markdown（RunningHub 产品约定）

> **定位**：`creative-doc` = **结构化骨架 + MD 增强的内容字段**。骨架字段保持纯值以保证前端路由 / 表格 / 徽章 / checkpoint 按钮等交互不丢失；"给人看"的文本字段可以写 Markdown，前端会渲染加粗、斜体、行内代码、链接、列表、引用、表格等。

#### 10.3.1 允许写 Markdown 的"内容字段"清单

| 所在 layout / 位置 | 字段 | 支持范围 |
|---|---|---|
| `text` / `highlight` | `content` | **完整 Markdown**（标题、列表、引用、代码块、表格、链接、图片） |
| `screenplay` 每场 | `action` / `dialogue` / `notes` | **行内 Markdown**（加粗、斜体、`代码`、链接、删除线） |
| `storyboard` 每镜 | `description` / `audio` | 行内 Markdown |
| `timeline` 每拍 | `description` | 行内 Markdown |
| `list` 每项 | 字符串项 / `item.text` | 行内 Markdown |
| `key-value` | 每个 value | 行内 Markdown |
| `table` | 每个字符串单元格 | 行内 Markdown（不影响表头与列对齐） |
| 选项 | `option.desc` / `option.description` | 行内 Markdown |
| 卡片（`content` 对象数组） | 每个 value | 行内 Markdown |
| 文档级 | `checkpointPrompt` / 字符串型 `checkpoint` | 行内 Markdown |

"行内 Markdown" = 至多写一段话内部可识别的语法：`**加粗**`、`*斜体*`、`` `代码` ``、`[文字](url)`、`~~删除~~`。不要写多段、标题、独立代码块。需要多段落时改用 `text` / `highlight` section。

#### 10.3.2 禁止写 Markdown 的"骨架字段"

以下字段必须保持**纯字符串 / 枚举 / 数字**，写入任何 Markdown 符号都视为协议违规（前端**不会**解析并可能造成状态错配）：

- `type`、`domain`、`layout`、`phase`、`totalPhases`、`checkpoint`（boolean 形态）
- section 的 `heading`、`ordered`、`columns`
- `screenplay` 的 `scene`（序号）、`setting`（场景标头）、`duration`、`character`、`emotion`
- `storyboard` 的 `shot`（镜号）、`camera`、`duration`、`transition`、`thumbnail`
- `timeline` 的 `beat`（节拍名）
- `table` 的列名（对象 key）
- `option.id`、`option.label`（标题保持纯文本以免破坏按钮样式）
- `assetRegistry` 里的 `name`、`clips`、状态枚举（`to_generate` / `confirmed` / `generated` 等）

#### 10.3.3 推荐写法与反例

**推荐**：

```json
{
  "layout": "screenplay",
  "data": [
    {
      "scene": 1,
      "setting": "INT. 卧室 - 清晨",
      "duration": "5s",
      "action": "**女主**缓缓睁眼，窗外阳光过曝打在脸上；`特写-眼睛`，情绪递进。",
      "dialogue": "今天一定要换窗帘了…",
      "character": "女主",
      "notes": "参考镜：`S002-reference.jpg`，色温偏暖"
    }
  ]
}
```

**反例**（不要这样写）：

```json
{
  "layout": "screenplay",
  "data": [
    {
      "scene": "**第一场**",
      "setting": "## INT. 卧室 - 清晨",
      "action": "女主缓缓睁眼"
    }
  ]
}
```

骨架字段（`scene` / `setting`）用了 Markdown，会破坏场景编号、标头样式，甚至导致后续阶段按场景定位失败。

#### 10.3.4 长文内容的出口

Skill 如果需要输出"成段的文档性内容"（例如完整大纲、风格说明、创作笔记），优先：

1. 拆分为多个 `layout: "text"` 或 `layout: "highlight"` section，并给每段一个明确的 `heading`；
2. 在 section 的 `content` 里使用完整 Markdown（含列表 / 代码块 / 表格）；
3. **不要**改协议去输出"裸 Markdown 文件"，那样会丢失 `checkpoint` / `options` / 阶段路由等 RunningHub 产品所需的互动能力。

### 10.4 客户端对 `creative-doc` 的处理

1. 按 `sections` 顺序渲染各区块
2. 如果 `checkpoint == true`，在文档末尾渲染确认区
3. 确认区提供三个选项：确认继续 / 调整 / 跳过后续直接生产
4. 用户的选择作为下一轮消息发送给 Agent
5. 显示进度指示器：`phase / totalPhases`

### 10.5 解析规则

- `creative-doc` 必须使用 canonical fence（` ```creative-doc `）
- 无 fallback — 不像 `workflow-json` 那样容错裸 JSON

### 10.6 自检清单（输出 creative-doc 前必须逐条确认）

1. 每个 section 的 `layout` 是否在上面 8 个值中？不在就改
2. 用了 `key-value` → `data` 是否为 `{ 键: 值 }` 对象（不是数组）？
3. 用了 `timeline` → `data` 数组每项是否都有 `beat` + `description`？
4. 用了 `table` → `data` 是否为对象数组、且每项字段名一致？
5. 用了 `list` → `data` 是否为字符串数组？
6. 用了 `text` / `highlight` → `content` 是否为字符串？
7. 用了 `screenplay` → `data` 数组每项是否都有 `scene` + `setting`？
8. 用了 `storyboard` → `data` 数组每项是否都有 `shot` + `description`？
9. 有 `options` 的 section → 是否**没有**设 `layout`？
10. 有 `content` 对象数组的 section → 是否**没有**设 `layout`？
11. JSON 整体是否能 `JSON.parse` 通过（无尾逗号、无注释）？
12. 是否只有一个 `creative-doc` fence？（一轮只能输出一个）
13. 骨架字段（`type` / `layout` / `scene` / `setting` / `shot` / `camera` / `heading` / 表头 / 枚举状态 / `option.id` / `option.label` 等）是否**没有**写任何 Markdown 符号？
14. 需要加粗 / 斜体 / `行内代码` 等排版时，是否只写在 10.3.1 允许的**内容字段**里？
15. `options[].id` 是否都是 **1–2 字符**（A/B/C 或 1/2/3）？出现 `direction_1` / `option_a` / `theme_dark` 等长 ID 必须改成短标签。
16. **字段名硬白名单**（前端 `AgentCreativeDoc.vue` 只识别这套；写错任意一个 = 该 section 静默丢失）：
    - 顶层只允许：`type` / `title` / `domain` / `phase` / `totalPhases` / `checkpoint` / `checkpointPrompt` / `sections`
    - section 顶层只允许：`heading` / `layout` / `data` / `content` / `options` / `ordered`（list 用）/ `columns`（storyboard 用）
    - **禁止字段**（出现就是错）：
      - 顶层 `section`（单数，应为 `sections`）、顶层 `layout`（layout 只能写在 section 上）
      - section 内的 `title`（应为 `heading`）、`items` / `rows` / `headers`（应为 `data`）、`metadata` / `scenes` / `shots`（screenplay/storyboard 都不嵌套，直接铺平到 `data` 数组里）
      - timeline 项里 `time` / `title`（应为 `beat` / `description`）
      - option 里 `text` / `name`（应为 `label`）
      - checkpoint 顶层用对象 `{type, prompt, options}`（应为 boolean `checkpoint: true` + 字符串 `checkpointPrompt`，options 单独作为一个 section 出）
17. **table 数据形态**：必须是**对象数组** `data: [{列名:值}, {列名:值}]`，前端按首行 key 自动提表头；禁止 `headers + rows` 二维数组形式。
18. **storyboard / screenplay 数据形态**：必须**扁平 shot/scene 数组**，禁止"按场景嵌套 shots"或"按层级嵌套 scenes"——前端只对 `data[i]` 单层遍历。

## 十一、约束

1. 不要在文档链中途偷偷输出 `workflow-json`
2. 不要跳过 checkpoint 直接进入下一阶段
3. 不要在一轮里输出多个 `creative-doc`
4. 不要为了显得深度而强行展开文档链
5. 不要在文档链里重复总控、协议或能力矩阵的内容
6. 不要把文档链当成教程或分析报告
7. **不要发明 layout 类型** — 只用 10.2 表中的 8 个值，或不设 layout 让前端自动推断
8. **不要发明协议块类型** — 只用 `workflow-json`、`canvas-command`、`form-fields`、`agent-persona`、`thinking`、`creative-doc`、`progress` 这 7 种 fence
9. **不要在骨架字段写 Markdown**（场景编号、镜号、layout 枚举、状态、列名、option id/label 等）；需要富文本排版时只写在 10.3.1 清单里的内容字段
