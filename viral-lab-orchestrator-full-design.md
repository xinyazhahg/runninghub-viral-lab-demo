---
name: viral-lab-orchestrator
description: 爆款实验室总控 Skill：负责从视频素材接入、视频拆解、可替换项规划、用户替换选择、Prompt 重组、RunningHub / 视频模型生成到结果返回与二次优化的完整流程调度；不直接承担单点模型能力，而是编排子 Skill 和工具完成爆款视频重制链路。领域 Skill。
metadata: {"openclaw":{"emoji":"🧪"}, "planF":{"phase":["A","B","C"],"media":["video","image","text"]}}
user-invocable: true
---

# Skill: viral-lab-orchestrator

## Contract

### Input

- **Required**: userGoal（用户想要改造 / 复刻 / 重制 / 二创的视频目标）
- **Optional**: videoSource（upload / url / rh-output-url / local-path / node-id）、assetManifest、filmBreakdown、replacementSlots、userSelection、generatedPrompt、generationResult、targetModel、aspectRatio、duration、styleHint、platformHint
- **Validation**:
  - **只需要调用 RunningHub API / 单独生成图片视频** → `runninghub`
  - **只需要文章配图 / 解释图** → `material-illustration`
  - **只需要完整海报** → `poster`
  - **只需要小红书卡片 / 社交图文排版** → `social-organic-surface` 或 `social-carousel`
  - **用户没有视频 / 没有视频描述 / 没有可用素材来源** → 先要求补充视频素材或使用 dry run 测试数据
  - **用户要求直接抄袭原视频、复刻真人身份、搬运平台内容** → reject 或提醒需要改造成原创表达

### Output

- **Format**: thinking + **必须** `creative-doc(type=viral-lab-plan)`；用户确认后再进入 `workflow-json` 或调用实际生成工具（同轮不得共发多个主 `creative-doc`）
- **Schema**: currentStage、nextAction、nextSkill、requiredInput、assetPlan、breakdownPlan、replacementPlan、promptPlan、generationPlan、resultPlan、riskNotice、handoffTarget
- **Validation**:
  - 未完成素材标准化就进入视频拆解 → reject
  - 未完成视频拆解就生成替换项 → reject
  - 用户未确认替换选择就进入最终生成 → reject
  - 未说明模型、素材、时长或比例等关键参数就调用真实生成 → reject
  - 生成任务可能消耗额度但未获得用户确认 → reject
  - 输出混淆“拆解结果”“替换项”“最终 Prompt”“生成结果” → reject

### Concurrency

- safe: false
- conflictsWith: runninghub, material-illustration, social-organic-surface, social-carousel, poster, ecom-image, ad-creative, youtube-thumbnail
- handoff to: runninghub, prompter, engineer, material-illustration
- orchestrates: asset-normalizer, film-breakdown, replacement-slot-planner, film-recompose, runninghub

### Prompt Strategy

- `[skill:viral_lab/orchestrate]`
- `[skill:viral_lab/asset]`
- `[skill:viral_lab/breakdown]`
- `[skill:viral_lab/replacement]`
- `[skill:viral_lab/recompose]`
- `[skill:viral_lab/generate]`
- `[skill:viral_lab/retry]`

---

## 一、角色定位

`viral-lab-orchestrator` 是爆款实验室的总控 Skill。

它不负责亲自完成所有单点能力，而是负责把爆款实验室的完整链路串起来：

```text
视频进入
→ 素材标准化
→ 视频拆解
→ 可替换项规划
→ 用户替换选择
→ Prompt 重组
→ 调用视频生成模型
→ 返回结果
→ 二次优化

---

## 二、触发标签与关键词

### 显式触发词

当用户明确提到以下关键词时，优先考虑触发本 Skill：

- 爆款实验室
- 爆款视频
- 视频重制
- 视频复刻
- 拉片复刻
- 视频改造
- 素材替换
- 替换主体
- 替换场景
- 替换元素
- 参考视频生成
- 视频拆解
- 视频重组
- 生成同款视频
- RunningHub 视频生成
- 可灵视频生成

### 隐式触发语句

当用户没有明确说“爆款实验室”，但表达了以下意图时，也可以触发本 Skill：

- “我上传一个视频，帮我拆一下。”
- “把这个视频里的主体换成另一个。”
- “根据这个参考视频生成新视频。”
- “保留这个视频的镜头结构，但换素材。”
- “拆出视频里的主体、场景、元素和字幕。”
- “帮我把用户选择翻译成视频生成 Prompt。”
- “调用 RunningHub / 可灵生成视频。”
- “生成后我还想重新改造。”
- “我想做一个视频拉片复刻流程。”
- “这个视频我想换人、换场景、换道具。”

### 不应触发的情况

以下情况不应直接触发本 Skill，应转交给其他 Skill 或要求用户补充信息：

| 用户需求 | 处理方式 |
|---|---|
| 只想调用 RunningHub 生成图片 / 视频 | handoff 到 `runninghub` |
| 只想做文章配图 / 解释图 | handoff 到 `material-illustration` |
| 只想做海报 | handoff 到 `poster` |
| 只想做小红书图文 / 社交卡片 | handoff 到 `social-organic-surface` 或 `social-carousel` |
| 没有视频、没有视频描述、没有素材来源 | 先要求用户补充视频素材或使用 dry run 测试数据 |
| 要求完整搬运、抄袭、照搬他人视频 | reject，并建议改成原创改造方案 |

### 触发判断原则

本 Skill 只在用户意图涉及“视频拆解 + 替换 + 重组 + 生成”的完整或半完整链路时触发。

如果用户只是单点需求，例如单独生成视频、单独写 Prompt、单独做图文排版，不应由本 Skill 直接处理，而应交给对应子 Skill。

---

## 三、产品边界

### 本 Skill 负责什么

`viral-lab-orchestrator` 是爆款实验室的流程总控，负责把多个视频处理能力串成完整链路。

它主要负责：

| 能力 | 说明 |
|---|---|
| 流程调度 | 判断用户当前处于哪一步，决定下一步调用哪个 Skill |
| 状态管理 | 记录素材、拆解结果、替换选择、Prompt、生成结果 |
| 子 Skill 编排 | 调度素材接入、视频拆解、替换规划、Prompt 重组、模型生成等能力 |
| 跳步拦截 | 防止未上传视频就拆解、未拆解就生成、未确认就出片 |
| 异常处理 | 处理缺素材、缺参数、任务失败、生成失败、结果不可播放等情况 |
| 结果回流 | 把生成结果返回给前端，并支持二次优化 |
| 二次优化 | 在保留前序数据的基础上支持重新改造、换主体、换场景、换风格 |

### 本 Skill 不负责什么

本 Skill 不直接承担底层模型能力，也不做与爆款实验室主链路无关的内容生产。

| 不负责内容 | 处理方式 |
|---|---|
| 直接调用 RunningHub API | handoff 到 `runninghub` |
| 单独生成图片 / 视频 / 音频 / 3D | handoff 到 `runninghub` 或对应生成类 Skill |
| 文章配图 / 解释图 | handoff 到 `material-illustration` |
| 小红书图文 / 社交卡片排版 | handoff 到 `social-organic-surface` 或 `social-carousel` |
| 完整海报设计 | handoff 到 `poster` |
| 电商商品图 | handoff 到 `ecom-image` |
| 广告投放素材 | handoff 到 `ad-creative` |
| 人像写真 / 真实摄影修图 | reject 或 handoff 到图像编辑类 Skill |
| 完整抄袭 / 搬运参考视频 | reject，并建议改成原创改造方案 |

### 与子 Skill 的关系

本 Skill 是总控，不是所有能力的替代品。

推荐关系如下：

```text
viral-lab-orchestrator
├── asset-normalizer
├── film-breakdown
├── replacement-slot-planner
├── film-recompose
└── runninghub

---

## 四、核心流程阶段

爆款实验室主流程分为 8 个阶段。

| 阶段 | stage | 说明 | 主要输出 |
|---|---|---|---|
| 1 | `intake` | 接收用户视频或视频来源 | videoSource |
| 2 | `normalize` | 统一素材格式 | asset-manifest |
| 3 | `breakdown` | 拆解视频镜头、主体、动作、场景、元素、字幕 | film-breakdown |
| 4 | `slot-plan` | 生成前端可展示的可替换项 | replacement-slots |
| 5 | `user-selection` | 接收用户选择的替换内容和新素材 | user-selection |
| 6 | `recompose` | 根据原视频结构和用户选择重组 Prompt | film-recompose |
| 7 | `generate` | 调用 RunningHub / 可灵等模型生成视频 | generation-result |
| 8 | `result-review` | 返回生成结果，并支持二次优化 | result-review |

### 阶段流转

```text
intake
↓
normalize
↓
breakdown
↓
slot-plan
↓
user-selection
↓
recompose
↓
generate
↓
result-review

---

## 五、阶段 1：视频接入（intake）

### 推荐子 Skill

- 暂不单独依赖子 Skill
- 后续可交给 `asset-normalizer` 处理素材标准化
- 当前阶段由 `viral-lab-orchestrator` 负责判断用户是否已经提供可用视频来源

### 目标

接收用户提供的视频素材或视频来源，判断是否具备进入爆款实验室流程的基本条件。

本阶段的重点是确认：

- 用户是否已经提供参考视频；
- 视频来源是否明确；
- 用户想对视频做什么改造；
- 是否可以进入素材标准化阶段。

本阶段只负责“接收和判断视频来源”，不负责拆解视频、不生成替换项、不生成 Prompt，也不调用真实生成模型。

---

### 可接受输入

| 输入类型 | 说明 |
|---|---|
| 本地上传视频 | 用户上传的 mp4 / mov 等视频文件 |
| 视频 URL | 用户提供的公开视频链接 |
| RH 历史作品 | RunningHub 历史作品或结果链接 |
| RunningHub outputUrl | RunningHub 生成结果地址 |
| node-id | 工作流节点产物 ID |
| dry run 数据 | 用于本地测试的模拟视频数据 |
| 视频描述 | 用户没有视频时，可作为流程模拟输入，但不能替代真实视频拆解 |

---

### 输入字段

```json
{
  "videoSource": {
    "sourceType": "upload | url | rh-output-url | local-path | node-id | dry-run | text-description",
    "value": "视频地址、文件路径、节点 ID 或测试数据",
    "metadata": {
      "filename": "example.mp4",
      "duration": 12.5,
      "format": "mp4",
      "width": 1080,
      "height": 1920
    }
  },
  "userGoal": "用户希望如何改造这个视频"
}
```

---

### 输出

如果用户已经提供可用视频来源，则进入 `normalize` 阶段。

```json
{
  "currentStage": "intake",
  "nextStage": "normalize",
  "videoSource": {
    "sourceType": "upload",
    "value": "example.mp4",
    "status": "received",
    "metadata": {
      "filename": "example.mp4",
      "duration": 12.5,
      "format": "mp4"
    }
  },
  "nextAction": "normalize_asset"
}
```

如果用户没有提供视频来源，则停留在 `intake` 阶段，并要求用户补充视频。

```json
{
  "currentStage": "intake",
  "status": "blocked",
  "reason": "missing_video_source",
  "message": "要进入爆款实验室流程，需要先上传参考视频、提供 RunningHub outputUrl，或选择使用 dry run 测试数据。",
  "nextAction": "request_video_source"
}
```

---

### 判断规则

| 情况 | 处理 |
|---|---|
| 用户已上传视频 | 进入 `normalize` |
| 用户提供 RunningHub outputUrl | 进入 `normalize` |
| 用户提供 RH 历史作品 | 进入 `normalize` |
| 用户提供本地视频路径 | 检查路径是否可用，可用则进入 `normalize` |
| 用户提供 node-id | 尝试解析对应产物，解析成功后进入 `normalize` |
| 用户提供公开视频 URL | 检查是否可访问，可访问则进入 `normalize` |
| 用户只提供文字描述 | 可进入 dry run 流程模拟，但不进入真实视频拆解 |
| 用户没有提供任何视频来源 | 要求用户上传视频或提供视频 URL |
| 用户要求直接照搬某平台视频 | reject，并建议改成原创改造方案 |

---

### 用户提示建议

如果用户没有提供视频，可以提示：

```text
要进入爆款实验室流程，我需要先拿到一个参考视频。你可以上传本地视频、提供 RunningHub outputUrl，或者先用 dry run 测试数据跑一遍流程。
```

如果用户只提供文字描述，可以提示：

```text
目前只有文字描述，可以先做流程模拟和 Prompt 方案，但无法完成真实的视频拆解。要跑通完整链路，需要上传参考视频或提供视频链接。
```

如果用户提供的是不可访问链接，可以提示：

```text
当前视频链接无法访问，请重新上传视频，或提供一个可访问的 RunningHub outputUrl。
```

---

### 本阶段不做什么

- 不拆分镜头。
- 不识别主体。
- 不识别动作。
- 不识别场景。
- 不识别元素。
- 不识别字幕。
- 不生成可替换项。
- 不生成最终视频 Prompt。
- 不调用 RunningHub 真实生成任务。
- 不消耗模型额度。
- 不判断视频是否“爆款”。
- 不执行任何真实视频改造。

---

### 进入下一阶段条件

进入 `normalize` 阶段必须满足以下条件之一：

- 已存在可访问的视频文件；
- 已存在可访问的视频 URL；
- 已存在可访问的 RunningHub outputUrl；
- 已存在可解析的 RH 历史作品；
- 已存在可解析的 node-id；
- 用户明确选择使用 dry run 测试数据。

同时还需要满足：

- 用户目标与视频改造、替换、重制、复刻或二创相关；
- 当前任务不属于单纯图片生成、社交卡片排版、海报设计等其他 Skill 范围；
- 没有明显的抄袭、搬运、违规复刻风险。

---

### 失败返回示例

当用户没有提供视频来源时：

```json
{
  "currentStage": "intake",
  "status": "failed",
  "reason": "missing_video_source",
  "message": "当前缺少参考视频。请上传视频、提供视频 URL，或选择 dry run 测试数据。",
  "nextAction": "request_video_source"
}
```

当视频链接不可访问时：

```json
{
  "currentStage": "intake",
  "status": "failed",
  "reason": "video_url_unavailable",
  "message": "当前视频链接不可访问，请重新上传视频或提供可访问的 RunningHub outputUrl。",
  "nextAction": "request_new_video_source"
}
```

当用户只提供文字描述时：

```json
{
  "currentStage": "intake",
  "status": "dry-run-only",
  "reason": "text_description_only",
  "message": "当前只有文字描述，可以模拟流程和生成 Prompt 方案，但不能完成真实视频拆解。",
  "nextAction": "confirm_dry_run"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "intake",
  "status": "success",
  "nextStage": "normalize",
  "nextSkill": "asset-normalizer",
  "reason": "已接收到可用视频来源，可以进入素材标准化阶段。"
}
```

---

### 与后续阶段的关系

`intake` 阶段只确认视频来源是否存在。

如果成功，下一步进入：

```text
intake
↓
normalize
```

如果失败，则停留在当前阶段，直到用户补充可用素材。

本阶段不允许直接跳到：

- `breakdown`
- `slot-plan`
- `recompose`
- `generate`

除非已有上游状态数据，并且总控确认前置阶段已经完成。

## 六、阶段 2：素材标准化（normalize）

### 推荐子 Skill

- `asset-normalizer`

### 目标

将不同来源的视频素材统一整理成后续流程可读取的标准素材清单。

用户的视频来源可能是本地上传、RunningHub outputUrl、RH 历史作品、公开视频 URL、node-id 或 dry run 数据。后续的视频拆解、替换规划和视频生成流程不应该分别适配所有来源，因此需要先统一成一个标准结构。

本阶段只负责“素材标准化”，不负责拆解视频、不生成可替换项、不生成 Prompt，也不调用真实生成模型。

---

### 输入来源

| 输入类型 | 说明 |
|---|---|
| 本地上传视频 | 用户上传的 mp4 / mov 等视频文件 |
| 视频 URL | 用户提供的公开视频链接 |
| RH 历史作品 | RunningHub 历史作品或结果链接 |
| RunningHub outputUrl | RunningHub 生成结果地址 |
| local-path | 本地视频路径 |
| node-id | RunningHub 或工作流节点产物 ID |
| dry run 数据 | 用于本地测试的模拟视频数据 |
| text-description | 用户只提供文字描述时的临时模拟输入 |

---

### 输入字段

```json
{
  "videoSource": {
    "sourceType": "upload | url | rh-output-url | local-path | node-id | dry-run | text-description",
    "value": "视频地址、文件路径、节点 ID 或测试数据",
    "metadata": {
      "filename": "example.mp4",
      "duration": 12.5,
      "format": "mp4",
      "width": 1080,
      "height": 1920
    }
  },
  "userGoal": "用户希望如何改造这个视频"
}
```

---

### 输出字段

输出为标准素材清单：

```json
{
  "assetManifest": {
    "assetId": "asset_001",
    "sourceType": "upload",
    "videoUrl": "https://example.com/video.mp4",
    "localPath": "/local/path/example.mp4",
    "duration": 12.5,
    "format": "mp4",
    "status": "ready",
    "metadata": {
      "filename": "example.mp4",
      "size": "20MB",
      "width": 1080,
      "height": 1920
    }
  },
  "currentStage": "normalize",
  "nextStage": "breakdown",
  "nextAction": "call_film_breakdown"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `assetManifest` | 标准化后的素材清单 |
| `assetId` | 当前素材的唯一标识 |
| `sourceType` | 素材来源类型，例如上传、URL、RunningHub 结果、本地路径等 |
| `videoUrl` | 可访问的视频地址 |
| `localPath` | 本地文件路径，如有 |
| `duration` | 视频时长 |
| `format` | 视频格式，例如 mp4 / mov |
| `status` | 素材状态，`ready` 表示可进入下一阶段 |
| `metadata` | 文件名、大小、宽高等补充信息 |
| `currentStage` | 当前阶段 |
| `nextStage` | 下一阶段 |
| `nextAction` | 下一步动作 |

---

### 校验规则

| 情况 | 处理 |
|---|---|
| 视频路径可访问 | 标记为 `ready`，进入 `breakdown` |
| 视频路径不可访问 | 返回错误，要求用户重新上传或更换链接 |
| 视频格式不支持 | 要求用户上传 mp4 / mov 等可处理格式 |
| 视频时长缺失 | 尝试读取元信息；无法读取时提示用户确认 |
| `sourceType` 不明确 | 根据链接、文件名或上下文判断；仍不明确时询问用户 |
| 用户只给文字描述 | 标记为 `dry-run`，仅允许流程模拟 |
| RunningHub outputUrl 可访问 | 标记为 `ready`，进入 `breakdown` |
| RH 历史作品可解析 | 转换为标准 `assetManifest` |
| node-id 可解析 | 转换为对应产物地址或本地路径 |
| node-id 无法解析 | 提示用户补充对应产物地址或重新选择素材 |
| 素材大小过大 | 提醒可能影响拆解速度，必要时建议压缩或裁剪 |
| 视频时长过长 | 建议用户选择片段或先裁剪后进入拆解 |

---

### 本阶段不做什么

- 不拆分镜头。
- 不识别主体。
- 不识别动作。
- 不识别场景。
- 不识别元素。
- 不识别字幕。
- 不生成可替换项。
- 不生成视频 Prompt。
- 不调用 RunningHub 真实生成任务。
- 不消耗模型额度。
- 不判断视频内容是否适合“爆款”。
- 不执行任何视频改造。

---

### 进入下一阶段条件

进入 `breakdown` 阶段必须满足：

- `assetManifest.status = ready`
- 已存在可访问的视频地址、本地路径或测试数据；
- 视频来源可供后续视频理解 / 拆解使用；
- 用户目标与视频改造、替换、重制或复刻相关；
- 当前任务没有被判断为其他 Skill 的职责范围。

---

### 失败返回示例

当视频地址不可访问时：

```json
{
  "currentStage": "normalize",
  "status": "failed",
  "reason": "video_url_unavailable",
  "message": "当前视频地址不可访问，请重新上传视频或提供可访问的 RunningHub outputUrl。",
  "nextAction": "request_new_video_source"
}
```

当视频格式不支持时：

```json
{
  "currentStage": "normalize",
  "status": "failed",
  "reason": "unsupported_video_format",
  "message": "当前视频格式暂不支持，请上传 mp4 或 mov 格式的视频。",
  "nextAction": "request_supported_video"
}
```

当 node-id 无法解析时：

```json
{
  "currentStage": "normalize",
  "status": "failed",
  "reason": "node_id_unresolved",
  "message": "当前 node-id 无法解析为可用视频素材，请补充对应产物地址或重新选择素材。",
  "nextAction": "request_asset_reference"
}
```

当用户只提供文字描述时：

```json
{
  "currentStage": "normalize",
  "status": "dry-run-only",
  "reason": "text_description_only",
  "message": "当前只有文字描述，可以模拟流程和生成 Prompt 方案，但不能完成真实视频拆解。",
  "nextAction": "confirm_dry_run"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "normalize",
  "status": "success",
  "nextStage": "breakdown",
  "nextSkill": "film-breakdown",
  "reason": "素材已标准化，可以进入视频拆解阶段。"
}
```

---

### 与前后阶段的关系

`normalize` 阶段的前置阶段是：

```text
intake
```

`normalize` 阶段的后续阶段是：

```text
breakdown
```

完整关系：

```text
intake
↓
normalize
↓
breakdown
```

如果素材标准化失败，流程不能继续进入 `breakdown`，必须先补齐或更换视频来源。

---

### 过程记录建议

本阶段建议记录以下信息：

```json
{
  "stage": "normalize",
  "inputSourceType": "upload",
  "assetId": "asset_001",
  "status": "ready",
  "nextStage": "breakdown",
  "createdAt": "timestamp"
}
```

记录目的：

- 方便后续追踪素材来源；
- 方便二次优化时复用原始素材；
- 避免重新改造时丢失原视频信息；
- 方便排查生成失败是否与素材不可访问有关。

## 七、阶段 3：视频拆解（breakdown）

### 推荐子 Skill

- `film-breakdown`

### 当前可用替代

如果 `film-breakdown` 尚未接入，可以先通过 `runninghub` 的 video-to-text / 视频理解能力获得原始视频描述，再由总控临时整理成简化版 `film-breakdown`。

### 目标

对参考视频进行内容理解，拆出镜头结构和可替换内容，为后续替换规划提供基础数据。

本阶段是爆款实验室的核心前置能力。

它需要回答的问题包括：

- 这个视频有几个镜头？
- 每个镜头从几秒到几秒？
- 每个镜头里的主体是谁 / 是什么？
- 主体在做什么动作？
- 场景在哪里？
- 有哪些可替换的元素？
- 有没有字幕、标题、贴纸文字或屏幕文字？
- 哪些内容适合展示给用户做替换？

---

### 输入

```json
{
  "assetManifest": {
    "assetId": "asset_001",
    "sourceType": "upload",
    "videoUrl": "https://example.com/video.mp4",
    "duration": 12.5,
    "format": "mp4",
    "status": "ready"
  }
}
```

---

### 输出

```json
{
  "filmBreakdown": {
    "shots": [
      {
        "shotId": "shot_01",
        "start": 0,
        "end": 3.2,
        "subject": ["人物"],
        "action": ["走向镜头"],
        "scene": ["厨房"],
        "elements": ["桌子", "蛋糕"],
        "text": ["今日甜品"],
        "camera": "中景，镜头轻微推进",
        "rhythm": "慢节奏展示",
        "evidenceFrame": "frame_001.jpg"
      }
    ],
    "buckets": {
      "subjects": ["人物"],
      "scenes": ["厨房"],
      "elements": ["桌子", "蛋糕"],
      "texts": ["今日甜品"]
    },
    "summary": "视频展示人物在厨房中走向镜头并展示蛋糕。"
  },
  "currentStage": "breakdown",
  "nextStage": "slot-plan",
  "nextAction": "call_replacement_slot_planner"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `filmBreakdown` | 视频拆解总结果 |
| `shots` | 镜头列表 |
| `shotId` | 镜头唯一标识 |
| `start` | 镜头开始时间 |
| `end` | 镜头结束时间 |
| `subject` | 镜头里的主要主体 |
| `action` | 主体动作 |
| `scene` | 场景 |
| `elements` | 可替换或有视觉价值的元素 |
| `text` | 字幕、标题、贴纸文字、屏幕文字 |
| `camera` | 景别、机位、镜头运动 |
| `rhythm` | 镜头节奏 |
| `evidenceFrame` | 证据帧，用于前端展示和人工确认 |
| `buckets` | 按主体、场景、元素、文字聚合后的分类结果 |
| `summary` | 视频整体摘要 |

---

### 拆解维度

| 维度 | 说明 |
|---|---|
| 镜头 | 按时间段拆分视频结构 |
| 主体 | 人、动物、商品、主要角色 |
| 动作 | 主体动作，例如走路、挥手、展示商品 |
| 场景 | 厨房、街道、草地、房间、办公室等 |
| 元素 | 服装、道具、商品、背景物、器具等 |
| 文字 | 字幕、标题、贴纸文案、屏幕文字 |
| 镜头语言 | 景别、机位、运动、转场 |
| 节奏 | 快慢、停顿、节拍、镜头切换 |
| 证据帧 | 每个镜头对应的关键帧 |

---

### 拆解规则

- 每个镜头必须有 `shotId`、`start`、`end`。
- 主体、动作、场景、元素、文字要分开，不混在同一个字段里。
- 字幕、贴纸文案、屏幕文字必须进入 `text` 类。
- 不要把字幕误归为普通元素。
- 无意义元素需要过滤，例如“天空”“地面”“普通背景”等弱价值项。
- 不要推断敏感关系或亲密关系，例如“情侣”“夫妻”“父子”，除非用户明确提供。
- 不要输出带有歧义或不适合前端展示的关系类标签。
- 同一主体在多个镜头中出现时，应保持命名一致。
- 拆解结果要服务于后续替换，不追求过度细碎。
- 如果识别不出字幕，应返回“本视频未识别到任何文字”，不要编造字幕。
- 如果镜头数量无法精确判断，应返回估计结果并标记置信度。
- 如果视频质量过低，应返回可用拆解结果和质量风险提示。

---

### 可替换内容识别原则

| 类型 | 应识别 | 不应优先识别 |
|---|---|---|
| 主体 | 人、动物、商品、主要角色 | 背景中模糊路人 |
| 场景 | 厨房、街道、卧室、草地、办公室 | 天空、地面、普通墙面 |
| 元素 | 衣服、包、球、饮料、食物、道具 | 无视觉价值的小物件 |
| 文字 | 字幕、标题、贴纸、屏幕字 | 模糊不可读文字 |
| 动作 | 跑步、跳舞、展示、挥手、转身 | 无明确意义的微动作 |

---

### 本阶段不做什么

- 不让用户选择替换项。
- 不生成前端替换卡片。
- 不生成最终视频 Prompt。
- 不调用视频生成模型。
- 不执行真实视频改造。
- 不进行二次优化。
- 不直接决定哪些内容一定要替换。
- 不消耗视频生成额度。

---

### 进入下一阶段条件

进入 `slot-plan` 阶段必须满足：

- 已存在 `filmBreakdown.shots`；
- 已存在 `filmBreakdown.buckets`；
- 至少识别出一种可替换类型：`subject`、`scene`、`element` 或 `text`；
- 拆解结果能追溯到对应镜头；
- 当前拆解结果可用于前端展示或替换规划。

---

### 失败返回示例

当视频无法拆解时：

```json
{
  "currentStage": "breakdown",
  "status": "failed",
  "reason": "video_understanding_failed",
  "message": "当前视频无法完成有效拆解，请更换视频或提供更清晰的素材。",
  "nextAction": "request_new_video"
}
```

当视频质量较低但仍可部分拆解时：

```json
{
  "currentStage": "breakdown",
  "status": "partial_success",
  "reason": "low_video_quality",
  "message": "当前视频画质较低，已生成可用的初步拆解结果，但部分元素可能不准确。",
  "nextAction": "continue_with_warning"
}
```

当没有识别到字幕时：

```json
{
  "currentStage": "breakdown",
  "status": "success",
  "textResult": "本视频未识别到任何文字",
  "nextStage": "slot-plan"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "breakdown",
  "status": "success",
  "nextStage": "slot-plan",
  "nextSkill": "replacement-slot-planner",
  "reason": "视频拆解已完成，可以生成可替换项。"
}
```

---

### 与前后阶段的关系

`breakdown` 阶段的前置阶段是：

```text
normalize
```

`breakdown` 阶段的后续阶段是：

```text
slot-plan
```

完整关系：

```text
normalize
↓
breakdown
↓
slot-plan
```

如果视频拆解失败，不能进入 `slot-plan`。

---

## 八、阶段 4：可替换项规划（slot-plan）

### 推荐子 Skill

- `replacement-slot-planner`

### 目标

将视频拆解结果转化为前端可展示、用户可选择、可上传替换素材的替换卡片。

本阶段解决的问题是：`filmBreakdown` 是结构化拆解数据，但用户不能直接操作这些原始字段。需要把主体、场景、元素、文字等内容整理成清晰、可理解、可选择的替换项。

本阶段是爆款实验室从“系统自动分析”进入“用户主动改造”的前置步骤。

---

### 输入

```json
{
  "filmBreakdown": {
    "shots": [
      {
        "shotId": "shot_01",
        "start": 0,
        "end": 3.2,
        "subject": ["人物"],
        "action": ["走向镜头"],
        "scene": ["厨房"],
        "elements": ["桌子", "蛋糕"],
        "text": ["今日甜品"]
      }
    ],
    "buckets": {
      "subjects": ["人物"],
      "scenes": ["厨房"],
      "elements": ["桌子", "蛋糕"],
      "texts": ["今日甜品"]
    }
  }
}
```

---

### 输出

```json
{
  "replacementSlots": {
    "slots": [
      {
        "slotId": "subject_01",
        "type": "subject",
        "label": "人物",
        "sourceShotIds": ["shot_01"],
        "replaceable": true,
        "suggestedInput": "image",
        "priority": "high",
        "displayHint": "可替换为人物、动物、商品或角色素材"
      },
      {
        "slotId": "scene_01",
        "type": "scene",
        "label": "厨房",
        "sourceShotIds": ["shot_01"],
        "replaceable": true,
        "suggestedInput": "image",
        "priority": "medium",
        "displayHint": "可替换为新的场景图片或描述"
      },
      {
        "slotId": "text_01",
        "type": "text",
        "label": "今日甜品",
        "sourceShotIds": ["shot_01"],
        "replaceable": true,
        "suggestedInput": "text",
        "priority": "low",
        "displayHint": "可修改字幕或贴纸文案"
      }
    ]
  },
  "currentStage": "slot-plan",
  "nextStage": "user-selection",
  "nextAction": "wait_user_selection"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `replacementSlots` | 可替换项总结果 |
| `slots` | 可替换项列表 |
| `slotId` | 替换项唯一标识 |
| `type` | 替换类型 |
| `label` | 给用户展示的自然语言标签 |
| `sourceShotIds` | 该替换项来自哪些镜头 |
| `replaceable` | 是否建议用户替换 |
| `suggestedInput` | 推荐用户提供的输入类型 |
| `priority` | 替换优先级 |
| `displayHint` | 前端展示提示 |

---

### 替换类型

| 类型 | 说明 | 推荐输入 |
|---|---|---|
| `subject` | 人、动物、商品、主要角色 | 图片 / 描述 / 素材 |
| `scene` | 厨房、街道、草地、房间等空间环境 | 图片 / 描述 |
| `element` | 道具、衣服、球、包、饮料等可替换物 | 图片 / 描述 |
| `text` | 字幕、标题、贴纸文字、屏幕文字 | 文案 |
| `style` | 风格、光影、色调、氛围 | 文本选择 |
| `duration` | 时长、片段范围 | 时间选择 |

---

### 规划规则

- 优先保留高价值替换项，如主体、商品、核心场景、核心道具。
- 过滤弱价值元素，如“天空”“地面”“墙面”“普通背景”。
- 文本类单独归入 `text`，不要混入 `element`。
- 同名或高度相似项应合并，避免前端卡片重复。
- 每个 slot 必须能追溯到对应镜头。
- `replaceable = false` 的内容可以展示为“已识别但不建议替换”。
- 对用户理解成本高的字段要改成自然语言标签。
- 标签应短、清楚、可展示，不要使用内部字段名。
- 不要输出“主体1”“元素2”这类用户不理解的标签。
- 不要展示敏感关系推断类标签。

---

### 前端对应

本阶段输出对应爆款实验室页面中的：

- 主体替换卡片
- 场景替换卡片
- 元素替换卡片
- 字幕 / 文字替换卡片
- 上传新素材
- 恢复原始
- 已替换状态
- 保留原始状态

---

### 优先级规则

| 优先级 | 说明 |
|---|---|
| high | 主体、商品、核心角色等强替换价值内容 |
| medium | 场景、重要道具、服装、背景物 |
| low | 字幕、贴纸文字、弱元素 |
| hidden | 不建议展示给用户的低价值项 |

---

### 本阶段不做什么

- 不执行真实替换。
- 不生成最终视频 Prompt。
- 不调用 RunningHub。
- 不判断生成质量。
- 不进行真实视频合成。
- 不清空视频拆解结果。
- 不擅自替用户选择替换项。

---

### 进入下一阶段条件

进入 `user-selection` 阶段必须满足：

- 已生成 `replacementSlots.slots`；
- 至少有一个可替换项；
- 前端已经向用户展示替换项；
- 等待用户选择或上传替换素材。

---

### 失败返回示例

当没有可替换项时：

```json
{
  "currentStage": "slot-plan",
  "status": "failed",
  "reason": "no_replaceable_slots",
  "message": "当前视频未识别到适合替换的主体、场景、元素或文字。",
  "nextAction": "request_new_video_or_manual_input"
}
```

当拆解结果缺失 buckets 时：

```json
{
  "currentStage": "slot-plan",
  "status": "failed",
  "reason": "missing_buckets",
  "message": "当前视频拆解结果缺少可替换分类，无法生成替换卡片。",
  "nextAction": "rerun_breakdown"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "slot-plan",
  "status": "success",
  "nextStage": "user-selection",
  "reason": "已生成可替换项，等待用户选择替换内容。"
}
```

---

### 与前后阶段的关系

`slot-plan` 阶段的前置阶段是：

```text
breakdown
```

`slot-plan` 阶段的后续阶段是：

```text
user-selection
```

完整关系：

```text
breakdown
↓
slot-plan
↓
user-selection
```

如果没有可替换项，不能进入 `user-selection`。

---

## 九、阶段 5：用户替换选择（user-selection）

### 推荐子 Skill

- 暂不单独依赖子 Skill
- 当前阶段由 `viral-lab-orchestrator` 负责接收和校验用户选择
- 后续可将文字替换分支交给 `text-overlay-replace`

### 目标

接收用户选择的替换项，以及对应的新素材、文案或配置。

这是用户从“系统自动拆解”进入“主动改造”的关键阶段。

本阶段的核心是把用户的选择整理成后续 Prompt 重组可以读取的结构化数据。

---

### 输入

```json
{
  "replacementSlots": {
    "slots": [
      {
        "slotId": "subject_01",
        "type": "subject",
        "label": "人物",
        "replaceable": true
      }
    ]
  },
  "userChoice": {
    "selectedSlots": [
      {
        "slotId": "subject_01",
        "replacementLabel": "可卡布幼犬",
        "replacementAsset": "image_001"
      }
    ],
    "uploadedAssets": [
      {
        "assetId": "image_001",
        "type": "image",
        "url": "https://example.com/dog.png"
      }
    ]
  }
}
```

---

### 输出

```json
{
  "userSelection": {
    "selectedSlots": [
      {
        "slotId": "subject_01",
        "type": "subject",
        "originalLabel": "人物",
        "replacementLabel": "可卡布幼犬",
        "replacementAsset": "image_001",
        "sourceShotIds": ["shot_01"]
      }
    ],
    "lockedSlots": ["scene_01", "text_01"],
    "styleChanges": {
      "styleHint": "温暖、生活方式、真实感"
    },
    "generationSettings": {
      "duration": 10,
      "aspectRatio": "9:16"
    }
  },
  "currentStage": "user-selection",
  "nextStage": "recompose",
  "nextAction": "call_film_recompose"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `userSelection` | 用户替换选择总结果 |
| `selectedSlots` | 用户选择替换的项目 |
| `slotId` | 对应 replacementSlots 中的替换项 ID |
| `type` | 替换类型 |
| `originalLabel` | 原始内容标签 |
| `replacementLabel` | 替换后的内容标签 |
| `replacementAsset` | 用户上传的新素材 |
| `sourceShotIds` | 替换影响的镜头 |
| `lockedSlots` | 用户选择保留原样的内容 |
| `styleChanges` | 风格调整 |
| `generationSettings` | 生成设置，如时长、比例等 |

---

### 用户可操作内容

| 操作 | 说明 |
|---|---|
| 替换主体 | 将原视频中的人、动物、商品替换为新素材 |
| 替换场景 | 将原视频场景换成用户指定场景 |
| 替换元素 | 替换服装、道具、商品、背景物 |
| 替换文字 | 修改字幕、标题、贴纸文案 |
| 调整风格 | 修改整体光影、氛围、视觉风格 |
| 调整比例 | 选择 9:16、1:1、16:9 等 |
| 调整时长 | 选择生成时长或保留片段 |
| 恢复原始 | 取消某个替换项，恢复参考视频原始内容 |

---

### 拦截规则

| 情况 | 处理 |
|---|---|
| 用户未选择任何替换项 | 不进入 `recompose`，提示选择至少一项 |
| 用户选择替换但未上传素材 | 要求补充素材或文字描述 |
| 用户只改比例 / 清晰度 | 不需要复杂替换流程，可直接记录为 `generationSettings` |
| 用户选择了不存在的 `slotId` | 返回错误并要求重新选择 |
| 用户上传素材无法访问 | 提示重新上传 |
| 用户要求替换为违规内容 | reject 或要求改成合规内容 |
| 用户要求恢复原始 | 将对应 slot 从 `selectedSlots` 移除，加入 `lockedSlots` |
| 用户修改已选内容 | 更新对应 slot，不重新拆解视频 |
| 用户只改风格 | 保留已有 replacementSlots，仅更新 `styleChanges` |

---

### 本阶段不做什么

- 不直接修改视频。
- 不直接生成最终视频。
- 不调用 RunningHub。
- 不重新拆解视频。
- 不清空已有拆解结果。
- 不擅自替用户选择替换项。
- 不把未确认的替换内容写进最终 Prompt。

---

### 进入下一阶段条件

进入 `recompose` 阶段必须满足：

- 用户至少确认一个替换项或生成设置；
- 所选替换项能对应到 `replacementSlots`；
- 需要素材的替换项已提供素材或描述；
- 用户确认可以进入 Prompt 重组；
- 当前选择没有被校验规则拦截。

---

### 失败返回示例

当用户没有选择任何替换项时：

```json
{
  "currentStage": "user-selection",
  "status": "blocked",
  "reason": "no_selected_slots",
  "message": "请先选择至少一个要替换的主体、场景、元素或文字。",
  "nextAction": "wait_user_selection"
}
```

当用户选择了替换项但缺少素材时：

```json
{
  "currentStage": "user-selection",
  "status": "blocked",
  "reason": "missing_replacement_asset",
  "message": "你选择了替换主体，但还没有上传新素材。请上传图片或补充文字描述。",
  "nextAction": "request_replacement_asset"
}
```

当用户选择了不存在的 slotId 时：

```json
{
  "currentStage": "user-selection",
  "status": "failed",
  "reason": "invalid_slot_id",
  "message": "当前替换项不存在，请重新选择。",
  "nextAction": "refresh_replacement_slots"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "user-selection",
  "status": "success",
  "nextStage": "recompose",
  "nextSkill": "film-recompose",
  "reason": "用户已确认替换选择，可以进入 Prompt 重组阶段。"
}
```

---

### 与前后阶段的关系

`user-selection` 阶段的前置阶段是：

```text
slot-plan
```

`user-selection` 阶段的后续阶段是：

```text
recompose
```

完整关系：

```text
slot-plan
↓
user-selection
↓
recompose
```

如果用户修改选择，不需要重新进入 `breakdown` 或 `slot-plan`，应基于已有结果更新 `userSelection`。

## 十、阶段 6：Prompt 重组（recompose）

### 推荐子 Skill

- `film-recompose`

### 当前可用替代

如果 `film-recompose` 尚未接入，可由 `viral-lab-orchestrator` 根据 `filmBreakdown + replacementSlots + userSelection` 临时生成简化逐镜头 Prompt。

如果后续存在 `video-prompt`，可复用其 Prompt 写作策略，但本阶段仍以 `film-recompose` 作为爆款实验室主链路节点。

### 目标

根据原视频拆解结果和用户替换选择，重组为可交给视频生成模型使用的新视频 Prompt。

本阶段是爆款实验室从“拆解和选择”进入“生成执行”的关键节点。

它需要做到：

- 保留原视频的镜头结构；
- 保留用户没有替换的内容；
- 替换用户明确选择的主体、场景、元素或文字；
- 生成可被视频模型理解的 Prompt；
- 为 RunningHub / 可灵等生成模型提供必要参数。

---

### 输入

```json
{
  "filmBreakdown": {
    "shots": [
      {
        "shotId": "shot_01",
        "start": 0,
        "end": 3.2,
        "subject": ["人物"],
        "action": ["走向镜头"],
        "scene": ["厨房"],
        "elements": ["桌子", "蛋糕"],
        "text": ["今日甜品"],
        "camera": "中景，镜头轻微推进"
      }
    ]
  },
  "replacementSlots": {
    "slots": [
      {
        "slotId": "subject_01",
        "type": "subject",
        "label": "人物",
        "sourceShotIds": ["shot_01"]
      }
    ]
  },
  "userSelection": {
    "selectedSlots": [
      {
        "slotId": "subject_01",
        "type": "subject",
        "originalLabel": "人物",
        "replacementLabel": "可卡布幼犬",
        "replacementAsset": "image_001",
        "sourceShotIds": ["shot_01"]
      }
    ],
    "generationSettings": {
      "duration": 10,
      "aspectRatio": "9:16"
    }
  }
}
```

---

### 输出

```json
{
  "filmRecompose": {
    "globalPrompt": "整体视频风格：温暖生活方式，真实自然，镜头节奏保持参考视频结构。",
    "shotPrompts": [
      {
        "shotId": "shot_01",
        "prompt": "镜头1：在厨房场景中，一只可卡布幼犬走向镜头，桌上有蛋糕，镜头轻微推进，保持原视频的中景构图。",
        "lockedOriginal": ["scene", "camera", "motion"],
        "replaced": ["subject"],
        "duration": 3.2
      }
    ],
    "modelHints": {
      "model": "kling-v3.0-pro/image-to-video",
      "duration": 10,
      "aspectRatio": "9:16"
    }
  },
  "currentStage": "recompose",
  "nextStage": "generate",
  "nextAction": "confirm_before_generation"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `filmRecompose` | Prompt 重组结果 |
| `globalPrompt` | 全局视频风格和整体说明 |
| `shotPrompts` | 逐镜头 Prompt |
| `shotId` | 对应原视频镜头 |
| `prompt` | 单个镜头的新视频描述 |
| `lockedOriginal` | 保留原视频不变的内容 |
| `replaced` | 已替换的内容类型 |
| `duration` | 当前镜头时长 |
| `modelHints` | 模型参数建议 |
| `model` | 推荐视频生成模型 |
| `aspectRatio` | 视频比例 |
| `nextAction` | 下一步动作 |

---

### Prompt 重组规则

- 保留用户未选择替换的原始内容。
- 用户选择替换的主体、场景、元素、文字必须写入 Prompt。
- 镜头结构尽量沿用参考视频，包括镜头顺序、动作节奏、构图和主要运动关系。
- 不要凭空新增大量参考视频没有的信息。
- 不要把内部字段名暴露给用户。
- 不要把用户未确认的替换项写进最终 Prompt。
- 如果替换内容影响多个镜头，要在所有相关镜头里保持一致。
- 如果模型需要单段 Prompt，可以将逐镜头 Prompt 合并成全局 Prompt。
- 如果模型支持分镜 Prompt，应保留 `shotPrompts` 结构。
- 字幕 / 贴纸文字替换应单独说明，不要混入普通元素。
- 风格变化应作为全局描述，不要破坏镜头内容结构。
- 时长变化应影响 `modelHints.duration`，但不应随意改变原镜头顺序。

---

### Prompt 输出要求

Prompt 应包含：

| 内容 | 说明 |
|---|---|
| 主体 | 当前视频中的主要角色或替换后的主体 |
| 动作 | 主体动作 |
| 场景 | 所在环境 |
| 镜头 | 景别、运动、构图 |
| 节奏 | 快慢、转场、镜头顺序 |
| 替换内容 | 用户明确选择替换的内容 |
| 保留内容 | 未替换、需要锁定的原视频内容 |
| 风格 | 用户要求或默认视觉风格 |
| 模型参数 | 时长、比例、模型建议 |

---

### 和 `video-prompt` 的关系

`video-prompt` 更偏通用视频 Prompt 生成能力。

`film-recompose` 更贴近爆款实验室，因为它需要基于参考视频的镜头拆解和用户替换选择，生成逐镜头新视频 Prompt。

推荐关系：

```text
film-recompose
└── 可复用 video-prompt 的 Prompt 写作策略
```

也就是说：

- `video-prompt` 可以作为 Prompt 写作策略来源；
- `film-recompose` 负责结合拆解结果和用户选择；
- 爆款实验室主链路优先使用 `film-recompose`。

---

### 真实生成前确认

本阶段结束后，不应直接进入真实生成。

必须先确认：

- 用户是否认可 Prompt；
- 替换素材是否齐全；
- 模型是否明确；
- 时长是否明确；
- 比例是否明确；
- 是否会消耗额度；
- 是否允许调用 RunningHub / 可灵执行生成。

---

### 本阶段不做什么

- 不调用真实视频生成。
- 不消耗额度。
- 不提交 RunningHub 任务。
- 不改变用户未确认的替换内容。
- 不清空前序拆解结果。
- 不重新拆解视频。
- 不擅自添加用户没有选择的替换项。
- 不做结果页展示。

---

### 进入下一阶段条件

进入 `generate` 阶段必须满足：

- 已生成 `filmRecompose.globalPrompt` 或 `filmRecompose.shotPrompts`；
- 用户已确认 Prompt 或确认进入生成；
- 已明确模型、时长、比例、替换素材等关键参数；
- 已提示可能消耗额度；
- 当前 Prompt 没有缺失关键素材；
- 当前 Prompt 不包含违规、侵权或抄袭导向内容。

---

### 失败返回示例

当用户选择和拆解结果无法对应时：

```json
{
  "currentStage": "recompose",
  "status": "failed",
  "reason": "selection_not_match_breakdown",
  "message": "当前用户选择无法对应到视频拆解结果，请重新选择替换项。",
  "nextAction": "return_to_user_selection"
}
```

当缺少替换素材时：

```json
{
  "currentStage": "recompose",
  "status": "blocked",
  "reason": "missing_replacement_asset",
  "message": "当前替换项缺少素材，无法生成最终 Prompt。",
  "nextAction": "request_replacement_asset"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "recompose",
  "status": "success",
  "nextStage": "generate",
  "nextSkill": "runninghub",
  "reason": "已完成 Prompt 重组，等待用户确认后可进入视频生成阶段。"
}
```

---

### 与前后阶段的关系

`recompose` 阶段的前置阶段是：

```text
user-selection
```

`recompose` 阶段的后续阶段是：

```text
generate
```

完整关系：

```text
user-selection
↓
recompose
↓
generate
```

---

## 十一、阶段 7：视频生成（generate）

### 推荐子 Skill

- `runninghub`

### 目标

调用 RunningHub / 可灵 / 视频生成模型，根据重组后的 Prompt 和用户替换素材生成最终视频。

本阶段是爆款实验室从“方案和 Prompt”进入“真实生成”的执行阶段。

### 输入

```json
{
  "filmRecompose": {
    "globalPrompt": "整体视频风格说明",
    "shotPrompts": [],
    "modelHints": {
      "model": "kling-v3.0-pro/image-to-video",
      "duration": 10,
      "aspectRatio": "9:16"
    }
  },
  "replacementAssets": [
    {
      "assetId": "image_001",
      "type": "image",
      "url": "https://example.com/dog.png"
    }
  ],
  "generationConfirm": {
    "userConfirmed": true,
    "allowCreditCost": true
  }
}
```

---

### 输出

```json
{
  "generationResult": {
    "taskId": "task_001",
    "status": "success",
    "videoUrl": "https://example.com/output.mp4",
    "coverUrl": "https://example.com/cover.jpg",
    "duration": 10,
    "model": "kling-v3.0-pro/image-to-video",
    "createdAt": "timestamp"
  },
  "currentStage": "generate",
  "nextStage": "result-review",
  "nextAction": "review_generation_result"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `generationResult` | 视频生成结果 |
| `taskId` | RunningHub / 模型任务 ID |
| `status` | 任务状态 |
| `videoUrl` | 最终视频地址 |
| `coverUrl` | 视频封面 |
| `duration` | 生成视频时长 |
| `model` | 使用的视频模型 |
| `createdAt` | 生成时间 |
| `nextStage` | 下一阶段 |
| `nextAction` | 下一步动作 |

---

### 生成前必须确认

调用真实生成前，必须确认：

| 项 | 标准 |
|---|---|
| Prompt | 已生成最终 Prompt |
| 用户确认 | 用户明确允许进入生成 |
| 素材 | 替换素材可访问 |
| 模型 | 已明确使用哪个模型 / 工作流 |
| 时长 | 已明确生成时长 |
| 比例 | 已明确视频比例 |
| 额度 | 已提醒可能消耗额度 |
| 合规 | 不涉及直接抄袭、违规替换或不当内容 |

---

### 调用规则

- 真实生成必须 handoff 到 `runninghub`。
- 本 Skill 不直接调用 RunningHub API。
- 本 Skill 不直接提交模型任务。
- 如果只是测试流程，应停留在方案层，不进入真实生成。
- 如果用户说“不要消耗额度”，不得进入真实生成。
- 如果模型参数缺失，应先补齐参数。
- 如果替换素材不可访问，应回到 `user-selection` 补充素材。

---

### 失败情况

| 失败类型 | 处理 |
|---|---|
| RunningHub 任务提交失败 | 返回失败原因，允许重试 |
| 任务超时 | 查询任务状态，提示等待或重试 |
| 视频 URL 为空 | 检查任务结果，不进入结果页 |
| 视频不可播放 | 进入 result-review 的失败分支 |
| 模型报错 | 返回模型错误信息，并建议修改 Prompt 或素材 |
| 额度不足 | 停止生成，提示用户处理额度问题 |
| 素材失效 | 返回 user-selection 补充素材 |
| 参数缺失 | 返回 recompose 或 generate 确认阶段 |

---

### 本阶段不做什么

- 不重新拆解视频。
- 不重新生成替换项。
- 不擅自修改用户确认过的 Prompt。
- 不在未确认的情况下消耗额度。
- 不把失败结果当成成功结果交付。
- 不清空前序数据。
- 不做完整结果页交互，只返回生成结果数据。

---

### 进入下一阶段条件

进入 `result-review` 阶段必须满足：

- 已获得 `generationResult`；
- `generationResult.status = success`；
- 已获得可访问的 `videoUrl`；
- 生成视频可用于预览或播放。

---

### 失败返回示例

当用户未确认生成时：

```json
{
  "currentStage": "generate",
  "status": "blocked",
  "reason": "user_not_confirmed",
  "message": "真实生成可能消耗额度，请确认是否继续。",
  "nextAction": "request_generation_confirmation"
}
```

当 RunningHub 生成失败时：

```json
{
  "currentStage": "generate",
  "status": "failed",
  "reason": "runninghub_generation_failed",
  "message": "RunningHub 生成任务失败，请检查模型参数、素材和 Prompt。",
  "nextAction": "retry_or_return_to_recompose"
}
```

当视频结果为空时：

```json
{
  "currentStage": "generate",
  "status": "failed",
  "reason": "empty_video_url",
  "message": "生成任务没有返回可用视频地址，不能进入结果页。",
  "nextAction": "check_task_status"
}
```

---

### 成功进入下一阶段示例

```json
{
  "currentStage": "generate",
  "status": "success",
  "nextStage": "result-review",
  "nextSkill": "viral-lab-orchestrator",
  "reason": "视频生成成功，可以进入结果查看和二次优化阶段。"
}
```

---

### 与前后阶段的关系

`generate` 阶段的前置阶段是：

```text
recompose
```

`generate` 阶段的后续阶段是：

```text
result-review
```

完整关系：

```text
recompose
↓
generate
↓
result-review
```

---

## 十二、阶段 8：结果返回与二次优化（result-review）

### 推荐子 Skill

- 暂不单独依赖子 Skill
- 当前阶段由 `viral-lab-orchestrator` 负责结果检查和二次优化调度
- 后续可拆成 `video-result-review` 或 `viral-lab-result-review`

### 目标

返回生成视频结果，并支持用户基于已有数据继续修改。

本阶段是爆款实验室闭环的最后一步，也是二次优化的入口。

它需要做到：

- 判断视频是否生成成功；
- 判断视频是否可播放；
- 返回结果页需要展示的数据；
- 记录已经应用的替换项；
- 支持用户重新改造；
- 二次优化时不清空前序拆解和选择。

---

### 输入

```json
{
  "generationResult": {
    "taskId": "task_001",
    "status": "success",
    "videoUrl": "https://example.com/output.mp4",
    "coverUrl": "https://example.com/cover.jpg",
    "duration": 10,
    "model": "kling-v3.0-pro/image-to-video"
  },
  "filmBreakdown": {},
  "replacementSlots": {},
  "userSelection": {},
  "filmRecompose": {}
}
```

---

### 输出

```json
{
  "resultReview": {
    "status": "success",
    "canPlay": true,
    "videoUrl": "https://example.com/output.mp4",
    "coverUrl": "https://example.com/cover.jpg",
    "appliedChanges": ["subject_01"],
    "retainedOriginal": ["scene_01", "text_01"],
    "availableNextActions": ["重新改造", "换主体", "换场景", "换风格", "重新生成"]
  },
  "currentStage": "result-review",
  "nextAction": "wait_user_next_action"
}
```

---

### 字段说明

| 字段 | 说明 |
|---|---|
| `resultReview` | 结果检查和二次优化入口数据 |
| `status` | 当前结果状态 |
| `canPlay` | 视频是否可播放 |
| `videoUrl` | 最终视频地址 |
| `coverUrl` | 视频封面 |
| `appliedChanges` | 已应用的替换项 |
| `retainedOriginal` | 保留原始内容的项目 |
| `availableNextActions` | 用户可继续执行的操作 |
| `currentStage` | 当前阶段 |
| `nextAction` | 下一步动作 |

---

### 结果检查规则

| 检查项 | 标准 |
|---|---|
| 任务状态 | `generationResult.status = success` |
| 视频地址 | `videoUrl` 必须存在 |
| 可播放性 | 视频应可预览或可播放 |
| 替换记录 | 应能展示哪些内容已替换 |
| 原始保留 | 应能展示哪些内容保持原样 |
| 二次优化 | 应能基于已有数据继续改造 |
| 状态保留 | 不清空 `filmBreakdown`、`replacementSlots`、`userSelection` |
| 失败提示 | 如果失败，应说明原因和下一步建议 |

---

### 用户可继续操作

| 操作 | 说明 |
|---|---|
| 重新改造 | 回到替换选择阶段，保留拆解数据 |
| 换主体 | 更新 `userSelection.selectedSlots` 中的 subject |
| 换场景 | 更新 scene 类型 slot |
| 换元素 | 更新 element 类型 slot |
| 换文字 | 更新 text 类型 slot |
| 换风格 | 更新 `styleChanges` |
| 重新生成 | 保留 Prompt 和素材，重新调用 RunningHub |
| 恢复原始 | 移除某个替换项，加入 lockedSlots |
| 导出 / 保存 | 保存生成结果 |

---

### 二次优化规则

- 用户点击重新改造时，不应清空全部状态。
- 如果只修改替换项，应回到 `user-selection`。
- 如果只修改 Prompt 或风格，应回到 `recompose`。
- 如果只重新生成，应回到 `generate`。
- 如果视频生成失败，应优先检查任务状态和结果 URL。
- 二次优化必须基于已有 `filmBreakdown` 和 `replacementSlots`，不要重新拆解视频。
- 只有用户明确要求“重新上传视频”时，才回到 `intake`。

---

### 失败情况处理

| 情况 | 处理 |
|---|---|
| 视频 URL 为空 | 不进入成功结果页，检查任务状态 |
| 视频不可播放 | 返回失败原因，允许重试生成 |
| 任务状态失败 | 展示失败原因，回到 generate 或 recompose |
| 用户不满意结果 | 根据修改范围回到 user-selection / recompose / generate |
| 前序数据丢失 | 提示无法二次优化，建议重新开始流程 |
| 替换记录缺失 | 尝试从 userSelection 恢复 appliedChanges |

---

### 本阶段不做什么

- 不重新拆解视频。
- 不清空用户选择。
- 不擅自重新调用 RunningHub。
- 不把失败视频当作成功视频展示。
- 不跳回 intake，除非用户明确要求重新上传视频。
- 不丢弃 Prompt、拆解结果和替换记录。

---

### 失败返回示例

当视频不可播放时：

```json
{
  "currentStage": "result-review",
  "status": "failed",
  "reason": "video_unplayable",
  "message": "生成视频暂时无法播放，请检查结果地址或重新生成。",
  "nextAction": "check_task_or_regenerate"
}
```

当前序数据丢失时：

```json
{
  "currentStage": "result-review",
  "status": "failed",
  "reason": "missing_previous_state",
  "message": "当前缺少视频拆解或替换选择记录，无法进行二次优化。",
  "nextAction": "restart_from_breakdown"
}
```

---

### 成功完成示例

```json
{
  "currentStage": "result-review",
  "status": "success",
  "canPlay": true,
  "videoUrl": "https://example.com/output.mp4",
  "availableNextActions": ["重新改造", "重新生成", "导出保存"],
  "message": "视频已生成成功，可预览、保存或继续二次优化。"
}
```

---

### 与前后阶段的关系

`result-review` 阶段的前置阶段是：

```text
generate
```

如果用户继续优化，可能回到：

```text
user-selection
recompose
generate
```

完整关系：

```text
generate
↓
result-review
↙        ↓        ↘
user-selection  recompose  generate
```

## 十三、第一阶段接入计划

### 当前已完成

| Skill | 状态 | 说明 |
|---|---|---|
| `material-illustration` | 已接入 | 练手成功，已验证 OpenClaw 可读取和调用 |
| `runninghub` | 已接入 | 已验证 OpenClaw 可读取；真实生成前需要用户确认 |

### 第一阶段建议接入 Skill

第一阶段目标不是接入所有 Skill，而是先跑通爆款实验室的最小闭环。

建议接入顺序如下：

| 顺序 | Skill | 目的 | 状态 |
|---|---|---|---|
| 1 | `viral-lab-orchestrator` | 建立爆款实验室总控流程 | 当前正在创建 |
| 2 | `film-breakdown` | 视频拆解主入口 | 待接入 / 待创建 |
| 3 | `replacement-slot-planner` | 生成可替换项 | 待接入 / 待创建 |
| 4 | `film-recompose` | 重组逐镜头 Prompt | 待接入 / 待创建 |
| 5 | `asset-normalizer` | 补齐素材标准化 | 待接入 / 待创建 |
| 6 | `runninghub` | 执行真实生成 | 已接入 |

### 第一阶段最小链路

```text
viral-lab-orchestrator
↓
asset-normalizer
↓
film-breakdown
↓
replacement-slot-planner
↓
film-recompose
↓
runninghub
↓
result-review
```

### 为什么第一阶段不接入所有 Skill

第一阶段目标是验证主链路是否能跑通，而不是堆叠所有能力。

如果一次性接入太多 Skill，容易出现：

- Skill 职责重叠；
- 中间协议过多；
- 输入输出衔接不稳定；
- Agent 不知道该调用哪个 Skill；
- 测试失败时难以定位问题；
- 主流程还没稳定，增强能力反而增加复杂度。

### 第一阶段只验证什么

第一阶段只验证以下内容：

| 验证项 | 说明 |
|---|---|
| 总控能否判断阶段 | 用户处于 intake / breakdown / generate 等哪一步 |
| 能否拦截跳步 | 未上传视频不能直接拆解，未确认不能直接生成 |
| 能否生成流程方案 | 输出 `viral-lab-plan` |
| 能否 handoff 到 runninghub | 真实生成交给 `runninghub` |
| 能否保留状态 | 二次优化时不清空 breakdown / selection |
| 能否处理缺失输入 | 缺视频、缺素材、缺 Prompt 时给出下一步 |

### 后续增强 Skill

以下 Skill 暂时不进入第一阶段主链路，后续根据需要再接入。

| Skill | 后续定位 |
|---|---|
| `video-shot-breakdown` | 作为 `film-breakdown` 内部镜头拆解能力 |
| `shot-element-taxonomy` | 作为 `film-breakdown` 内部四类元素分类能力 |
| `text-overlay-replace` | 作为 `replacement-slot-planner` 的文字替换分支 |
| `viral-subject-swap` | 作为 `film-recompose` 的主体替换策略 |
| `viral-action-replicate` | 作为 `film-recompose` 的动作复刻策略 |
| `seedance-prompt-expander` | 作为 `film-recompose` 的风格 / 光影 / 天气扩写策略 |
| `shots-timing` | 后续用于精细控制镜头时长 |
| `shots-assembly` | 后续用于复杂分镜重组 |
| `storyboard-master` | 后续用于更强分镜方案生成 |
| `video-prompt` | 可作为 `film-recompose` 的 Prompt 写作策略来源 |

### 接入原则

- 每接入一个 Skill，就单独测试一次。
- 不一次性安装大量 Skill。
- 优先接入主链路必须能力。
- 每个 Skill 必须有清晰输入输出。
- 接入后要在 OpenClaw「技能」页确认状态为 ready。
- 测试时先只输出方案，不调用真实生成。
- 涉及 RunningHub 真实任务时，必须先要求用户确认。

---

## 十四、测试用例

### 测试 1：只输出流程方案

#### 用户输入

```text
用 viral-lab-orchestrator，帮我规划“上传视频后拆解、提取可替换项、用户替换主体、生成新视频”的流程。只输出方案，不调用真实模型。
```

#### 期望结果

应输出 `creative-doc(type=viral-lab-plan)`，包含：

- 当前阶段；
- 用户目标；
- 已有输入；
- 缺失输入；
- 下一步动作；
- 推荐调用 Skill；
- 阶段输出结构；
- 风险提示；
- 是否需要用户确认；
- 是否允许进入真实生成。

#### 不应发生

- 不应调用 RunningHub；
- 不应提交真实生成任务；
- 不应消耗额度；
- 不应直接生成视频。

---

### 测试 2：素材不足拦截

#### 用户输入

```text
帮我直接生成一个同款视频。
```

#### 期望结果

应提示用户缺少参考视频，并要求补充：

- 本地上传视频；
- RunningHub outputUrl；
- RH 历史作品；
- 视频 URL；
- dry run 测试数据。

#### 期望输出示例

```json
{
  "currentStage": "intake",
  "status": "blocked",
  "reason": "missing_video_source",
  "message": "要进入爆款实验室流程，需要先上传参考视频、提供 RunningHub outputUrl，或选择使用 dry run 测试数据。",
  "nextAction": "request_video_source"
}
```

#### 不应发生

- 不应直接进入 `breakdown`；
- 不应直接进入 `generate`；
- 不应调用 RunningHub。

---

### 测试 3：未确认不生成

#### 用户输入

```text
这是拆解结果，我想把人物换成小狗，你直接生成吧。
```

#### 期望结果

应先确认：

- 替换素材是否已提供；
- Prompt 是否已生成；
- 模型是否明确；
- 时长是否明确；
- 比例是否明确；
- 是否会消耗额度；
- 用户是否确认继续生成。

#### 期望输出示例

```json
{
  "currentStage": "generate",
  "status": "blocked",
  "reason": "generation_requires_confirmation",
  "message": "真实生成可能消耗额度。请确认替换素材、模型、时长、比例和最终 Prompt 后再继续。",
  "nextAction": "request_generation_confirmation"
}
```

#### 不应发生

- 不应未经确认直接生成；
- 不应跳过 Prompt 重组；
- 不应消耗额度。

---

### 测试 4：二次优化

#### 用户输入

```text
这个结果不行，把主体再换成猫，场景不变。
```

#### 前置条件

已存在：

- `filmBreakdown`
- `replacementSlots`
- `userSelection`
- `filmRecompose`
- `generationResult`

#### 期望结果

应复用已有前序数据，只更新主体替换项。

#### 期望流程

```text
result-review
↓
user-selection
↓
recompose
↓
generate
```

#### 不应发生

- 不应重新上传视频；
- 不应重新拆解视频；
- 不应清空已有替换项；
- 不应丢失原始场景信息。

---

### 测试 5：只做 RunningHub 单点任务

#### 用户输入

```text
用 RunningHub 帮我生成一个 9:16 视频。
```

#### 期望结果

应 handoff 到 `runninghub`，而不是由本 Skill 接管完整爆款实验室流程。

#### 期望处理

```json
{
  "currentStage": "handoff",
  "handoffTarget": "runninghub",
  "reason": "用户只需要单独调用 RunningHub 生成任务，不涉及视频拆解、替换规划和 Prompt 重组。"
}
```

---

### 测试 6：只做解释图

#### 用户输入

```text
帮我把爆款实验室流程画成一张解释图。
```

#### 期望结果

应 handoff 到 `material-illustration`。

#### 期望处理

```json
{
  "currentStage": "handoff",
  "handoffTarget": "material-illustration",
  "reason": "用户需要流程解释图，不是执行爆款实验室视频生成链路。"
}
```

---

## 十五、输出结构（creative-doc 建议字段）

### 输出格式要求

本 Skill 在方案阶段必须输出：

```text
creative-doc(type=viral-lab-plan)
```

真实生成前必须先输出方案，不得直接调用 RunningHub。

### 建议字段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "intake",
  "userGoal": "用户想要完成的视频改造目标",
  "availableInput": {
    "videoSource": null,
    "assetManifest": null,
    "filmBreakdown": null,
    "replacementSlots": null,
    "userSelection": null,
    "filmRecompose": null,
    "generationResult": null
  },
  "missingInput": ["videoSource"],
  "nextAction": "request_video_source",
  "nextSkill": null,
  "requiredInput": ["upload video", "RunningHub outputUrl", "dry run data"],
  "riskNotice": [
    "缺少参考视频，不能进入真实视频拆解。",
    "真实生成可能消耗额度，需用户确认。"
  ],
  "canGenerate": false,
  "handoffTarget": null
}
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `type` | 固定为 `viral-lab-plan` |
| `currentStage` | 当前流程阶段 |
| `userGoal` | 用户目标 |
| `availableInput` | 当前已有输入 |
| `missingInput` | 当前缺失的输入 |
| `nextAction` | 下一步动作 |
| `nextSkill` | 推荐调用的下一个 Skill |
| `requiredInput` | 进入下一阶段所需材料 |
| `riskNotice` | 风险提示 |
| `canGenerate` | 是否允许进入真实生成 |
| `handoffTarget` | 如需转交，写明目标 Skill |

### 阶段输出示例

#### intake 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "intake",
  "nextAction": "request_video_source",
  "nextSkill": null,
  "requiredInput": ["video upload", "video url", "RunningHub outputUrl"],
  "canGenerate": false
}
```

#### normalize 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "normalize",
  "nextAction": "call_asset_normalizer",
  "nextSkill": "asset-normalizer",
  "requiredInput": ["videoSource"],
  "canGenerate": false
}
```

#### breakdown 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "breakdown",
  "nextAction": "call_film_breakdown",
  "nextSkill": "film-breakdown",
  "requiredInput": ["assetManifest"],
  "canGenerate": false
}
```

#### slot-plan 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "slot-plan",
  "nextAction": "call_replacement_slot_planner",
  "nextSkill": "replacement-slot-planner",
  "requiredInput": ["filmBreakdown"],
  "canGenerate": false
}
```

#### user-selection 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "user-selection",
  "nextAction": "wait_user_selection",
  "nextSkill": null,
  "requiredInput": ["replacementSlots", "user replacement choice"],
  "canGenerate": false
}
```

#### recompose 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "recompose",
  "nextAction": "call_film_recompose",
  "nextSkill": "film-recompose",
  "requiredInput": ["filmBreakdown", "replacementSlots", "userSelection"],
  "canGenerate": false
}
```

#### generate 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "generate",
  "nextAction": "handoff_to_runninghub_after_confirmation",
  "nextSkill": "runninghub",
  "requiredInput": ["filmRecompose", "replacementAssets", "generationConfirmation"],
  "canGenerate": true
}
```

#### result-review 阶段

```json
{
  "type": "viral-lab-plan",
  "currentStage": "result-review",
  "nextAction": "wait_user_next_action",
  "nextSkill": null,
  "requiredInput": ["generationResult"],
  "canGenerate": false
}
```

---

## 十六、输出约束

### 总体约束

- 单轮仅输出一个主 `creative-doc(type=viral-lab-plan)`。
- 本 Skill 是流程总控，不直接承担底层模型调用。
- 未经用户确认，不调用真实生成任务。
- 涉及额度消耗时，必须提醒用户确认。
- 不与完整排版类 Skill 同轮输出多个主方案。
- 不把内部阶段字段直接作为用户可见文案展示。
- 不把失败状态当作成功状态交付。
- 不清空前序状态，除非用户明确要求重新开始。

### 阶段约束

| 阶段 | 约束 |
|---|---|
| intake | 没有视频来源，不进入 normalize |
| normalize | 没有 assetManifest，不进入 breakdown |
| breakdown | 没有 filmBreakdown，不进入 slot-plan |
| slot-plan | 没有 replacementSlots，不进入 user-selection |
| user-selection | 用户未选择或未确认，不进入 recompose |
| recompose | 没有最终 Prompt，不进入 generate |
| generate | 未确认模型、素材、时长、比例和额度，不调用 RunningHub |
| result-review | 没有可播放 videoUrl，不展示成功结果 |

### Handoff 约束

| 用户需求 | Handoff 目标 |
|---|---|
| 只调用 RunningHub 生成 | `runninghub` |
| 只做解释图 / 流程图 | `material-illustration` |
| 做社交卡片 / 小红书图文 | `social-organic-surface` 或 `social-carousel` |
| 做完整海报 | `poster` |
| 做电商商品图 | `ecom-image` |
| 做广告投放素材 | `ad-creative` |
| 做底层工程实现 | `engineer` |
| 做 Prompt 优化 | `prompter` 或 `film-recompose` |

### 生成安全约束

- 用户未确认前，不调用 RunningHub。
- 用户明确说“不要消耗额度”时，不调用真实生成。
- 用户只是在测试流程时，不调用真实生成。
- 缺少替换素材时，不调用真实生成。
- 缺少视频来源时，不进入拆解。
- 缺少 Prompt 时，不进入生成。
- 可能涉及侵权搬运或完整照抄时，应提醒改成原创改造方案。
- 不生成冒充真实人物、侵犯肖像权或明显不合规内容。

### 二次优化约束

- 二次优化必须尽量复用已有 `filmBreakdown`、`replacementSlots` 和 `userSelection`。
- 用户只换主体时，不重新拆解视频。
- 用户只换风格时，不重新生成替换项。
- 用户只重新生成时，不清空 Prompt 和素材。
- 用户明确要换参考视频时，才回到 `intake`。
- 结果不可播放时，先检查 `generationResult` 和任务状态，不直接要求用户从头开始。

### 文档输出约束

- 输出内容必须清楚区分：阶段、输入、输出、下一步动作。
- 不应混淆 `filmBreakdown`、`replacementSlots`、`userSelection`、`filmRecompose`、`generationResult`。
- 不应在方案阶段输出真实 API 请求。
- 不应在方案阶段暴露敏感 API Key、工作流密钥或内部凭证。
- 不应把用户看不懂的内部字段直接作为前端文案。
- 必须在真实生成前明确提示：需要用户确认后才可继续。

