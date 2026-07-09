---
name: viral-lab-orchestrator
description: 爆款实验室总控 Skill：负责视频素材接入、视频拆解、可替换项规划、用户替换选择、Prompt 重组、RunningHub / 视频模型生成、结果返回与二次优化的流程调度；不直接执行底层模型调用。领域 Skill。
metadata: {"openclaw":{"emoji":"🧪"}, "planF":{"phase":["A","B","C"],"media":["video","image","text"]}}
user-invocable: true
---

# Skill: viral-lab-orchestrator

## Contract

### Input

- **Required**: userGoal（用户想要对参考视频做什么改造）
- **Optional**: videoSource、assetManifest、filmBreakdown、replacementSlots、userSelection、filmRecompose、generationResult、targetModel、aspectRatio、duration、styleHint、platformHint

### Output

- **Format**: thinking + **必须** `creative-doc(type=viral-lab-plan)`
- **Schema**: currentStage、userGoal、availableInput、missingInput、nextAction、nextSkill、requiredInput、riskNotice、canGenerate、handoffTarget
- **Validation**:
  - 没有视频来源，不进入视频拆解。
  - 没有拆解结果，不生成可替换项。
  - 用户未选择替换内容，不生成最终 Prompt。
  - 用户未确认，不调用 RunningHub 或任何真实生成任务。
  - 可能消耗额度时，必须先提示并获得确认。

### Concurrency

- safe: false
- conflictsWith: runninghub, material-illustration, social-organic-surface, social-carousel, poster, ecom-image, ad-creative
- handoff to: runninghub, material-illustration, prompter, engineer
- orchestrates: asset-normalizer, film-breakdown, replacement-slot-planner, film-recompose, runninghub

### Prompt Strategy

- `[skill:viral_lab/orchestrate]`
- `[skill:viral_lab/intake]`
- `[skill:viral_lab/breakdown]`
- `[skill:viral_lab/replacement]`
- `[skill:viral_lab/recompose]`
- `[skill:viral_lab/generate]`
- `[skill:viral_lab/result_review]`

---

## 一、角色定位

`viral-lab-orchestrator` 是爆款实验室的总控 Skill。

它负责把爆款实验室主链路串起来：

- 视频进入
- 素材标准化
- 视频拆解
- 可替换项规划
- 用户替换选择
- Prompt 重组
- 调用视频生成
- 结果返回
- 二次优化

本 Skill 不直接调用底层模型，也不直接执行 RunningHub API。  
需要真实生成时，必须 handoff 到 `runninghub`。

---

## 二、触发标签与关键词

### 显式触发词

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

- “我上传一个视频，帮我拆一下。”
- “保留这个视频的镜头结构，但换素材。”
- “拆出视频里的主体、场景、元素和字幕。”
- “把这个视频里的主体换成另一个。”
- “根据这个参考视频生成新视频。”
- “帮我把用户选择翻译成视频生成 Prompt。”
- “生成后我还想重新改造。”

---

## 三、产品边界

### 本 Skill 负责

| 能力 | 说明 |
|---|---|
| 流程调度 | 判断当前处于哪一步，决定下一步 |
| 状态管理 | 记录素材、拆解、替换、Prompt、生成结果 |
| 子 Skill 编排 | 调度拆解、替换、重组、生成等能力 |
| 跳步拦截 | 防止未上传就拆解、未确认就生成 |
| 结果回流 | 返回生成结果，并支持二次优化 |
| 异常处理 | 处理缺素材、缺参数、任务失败、视频不可播放 |

### 本 Skill 不负责

| 不负责内容 | 处理方式 |
|---|---|
| 直接调用 RunningHub API | handoff 到 `runninghub` |
| 单独生成图片 / 视频 / 音频 / 3D | handoff 到 `runninghub` |
| 文章配图 / 解释图 | handoff 到 `material-illustration` |
| 小红书图文 / 社交卡片排版 | handoff 到 `social-organic-surface` 或 `social-carousel` |
| 完整海报设计 | handoff 到 `poster` |
| 电商商品图 | handoff 到 `ecom-image` |
| 广告投放素材 | handoff 到 `ad-creative` |
| 完整搬运 / 抄袭参考视频 | reject，并建议改成原创改造方案 |

---

## 四、核心流程阶段

| 阶段 | stage | 说明 | 下一步 |
|---|---|---|---|
| 1 | intake | 接收视频或视频来源 | normalize |
| 2 | normalize | 统一素材格式 | breakdown |
| 3 | breakdown | 拆解视频镜头和内容 | slot-plan |
| 4 | slot-plan | 生成可替换项 | user-selection |
| 5 | user-selection | 接收用户替换选择 | recompose |
| 6 | recompose | 重组逐镜头 Prompt | generate |
| 7 | generate | 调用模型生成视频 | result-review |
| 8 | result-review | 返回结果并支持二次优化 | 等待用户下一步 |

流程：

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

## 五、阶段规则

### 1. intake：视频接入

目标：确认用户是否提供了可用视频来源。

可接受输入：

- 本地上传视频
- 视频 URL
- RunningHub outputUrl
- RH 历史作品
- node-id
- dry run 测试数据
- 视频描述

规则：

- 有可用视频来源 → 进入 `normalize`
- 只有文字描述 → 只能 dry run，不做真实视频拆解
- 没有视频来源 → 要求用户上传视频或提供 URL
- 用户要求照搬他人视频 → reject，并建议原创改造

---

### 2. normalize：素材标准化

推荐子 Skill：`asset-normalizer`

目标：把不同来源的视频统一成 `assetManifest`。

输出应包含：

- assetId
- sourceType
- videoUrl / localPath
- duration
- format
- status
- metadata

规则：

- `assetManifest.status = ready` 才能进入 `breakdown`
- 视频不可访问，不进入下一步
- 视频格式不支持，要求用户重新上传
- 本阶段不拆视频、不生成 Prompt、不调用模型

---

### 3. breakdown：视频拆解

推荐子 Skill：`film-breakdown`

目标：拆解视频镜头和可替换内容。

输出应包含：

- shots
- buckets
- summary

每个 shot 建议包含：

- shotId
- start
- end
- subject
- action
- scene
- elements
- text
- camera
- evidenceFrame

规则：

- 主体、动作、场景、元素、文字要分开。
- 字幕 / 贴纸 / 屏幕文字进入 `text`。
- 过滤低价值元素，如天空、地面、普通背景。
- 不推断情侣、夫妻、亲密关系等敏感关系。
- 没有字幕时返回“本视频未识别到任何文字”。
- 有 `shots` 和 `buckets` 才能进入 `slot-plan`。

---

### 4. slot-plan：可替换项规划

推荐子 Skill：`replacement-slot-planner`

目标：把拆解结果转成前端可展示、用户可选择的替换卡片。

替换类型：

| 类型 | 说明 |
|---|---|
| subject | 人、动物、商品、主要角色 |
| scene | 厨房、街道、草地、房间等空间环境 |
| element | 道具、衣服、球、包、饮料等物件 |
| text | 字幕、标题、贴纸文字、屏幕文字 |
| style | 风格、光影、色调、氛围 |
| duration | 时长、片段范围 |

规则：

- 优先展示主体、商品、核心场景、核心道具。
- 合并重复或高度相似的项。
- 每个 slot 必须能追溯到对应镜头。
- 文本类单独归入 `text`。
- 低价值内容可隐藏或标记为不建议替换。
- 生成 `replacementSlots` 后进入 `user-selection`。

---

### 5. user-selection：用户替换选择

目标：接收用户选择的替换项、新素材和生成设置。

输入可能包括：

- selectedSlots
- uploadedAssets
- replacementLabel
- styleChanges
- generationSettings

规则：

- 用户未选择任何替换项 → 不进入 `recompose`
- 选择替换但缺少素材 → 要求补充素材
- 用户只改比例 / 清晰度 → 记录为 generationSettings
- 用户修改选择 → 更新 userSelection，不重新拆解视频
- 用户恢复原始 → 从 selectedSlots 移除，加入 lockedSlots

---

### 6. recompose：Prompt 重组

推荐子 Skill：`film-recompose`

目标：根据视频拆解和用户选择生成新视频 Prompt。

规则：

- 保留用户未替换的原始内容。
- 用户选择替换的主体、场景、元素、文字必须写进 Prompt。
- 尽量沿用参考视频镜头结构、动作节奏、构图和镜头运动。
- 不新增大量参考视频没有的信息。
- 不把内部字段名暴露给用户。
- 不把未确认替换项写进最终 Prompt。
- 可复用 `video-prompt` 的 Prompt 写作策略。
- 生成 Prompt 后，必须等待用户确认，不直接进入真实生成。

---

### 7. generate：视频生成

推荐子 Skill：`runninghub`

目标：调用 RunningHub / 可灵 / 视频模型生成最终视频。

真实生成前必须确认：

- Prompt 已生成
- 用户已确认
- 替换素材齐全
- 模型明确
- 时长明确
- 比例明确
- 已提示可能消耗额度
- 内容合规

规则：

- 本 Skill 不直接调用 RunningHub API。
- 必须 handoff 到 `runninghub`。
- 用户说“不要消耗额度”时，不执行真实生成。
- 生成失败时返回失败原因和重试建议。
- 获得可播放 videoUrl 后进入 `result-review`。

---

### 8. result-review：结果返回与二次优化

目标：返回生成视频，并支持继续修改。

输出应包含：

- status
- canPlay
- videoUrl
- coverUrl
- appliedChanges
- retainedOriginal
- availableNextActions

二次优化规则：

- 用户重新改造时，不清空全部状态。
- 只换主体 → 回到 `user-selection`
- 只换风格 / Prompt → 回到 `recompose`
- 只重新生成 → 回到 `generate`
- 视频不可播放 → 检查 generationResult 和任务状态
- 只有用户换参考视频时，才回到 `intake`

---

## 六、Handoff 规则

| 用户需求 | Handoff 目标 |
|---|---|
| 只调用 RunningHub 生成 | `runninghub` |
| 做流程解释图 | `material-illustration` |
| 做社交卡片 / 小红书图文 | `social-organic-surface` 或 `social-carousel` |
| 做完整海报 | `poster` |
| 做电商商品图 | `ecom-image` |
| 做广告投放素材 | `ad-creative` |
| 做底层工程实现 | `engineer` |
| 做 Prompt 优化 | `prompter` 或 `film-recompose` |

---

## 七、第一阶段接入计划

### 当前已完成

| Skill | 状态 | 说明 |
|---|---|---|
| `material-illustration` | 已接入 | 已验证 OpenClaw 可读取和调用 |
| `runninghub` | 已接入 | 已验证 OpenClaw 可读取；真实生成前需要用户确认 |

### 第一阶段建议接入

| 顺序 | Skill | 目的 | 状态 |
|---|---|---|---|
| 1 | `viral-lab-orchestrator` | 建立爆款实验室总控流程 | 当前正在创建 |
| 2 | `film-breakdown` | 视频拆解主入口 | 待接入 / 待创建 |
| 3 | `replacement-slot-planner` | 生成可替换项 | 待接入 / 待创建 |
| 4 | `film-recompose` | 重组逐镜头 Prompt | 待接入 / 待创建 |
| 5 | `asset-normalizer` | 补齐素材标准化 | 待接入 / 待创建 |
| 6 | `runninghub` | 执行真实生成 | 已接入 |

---

## 八、测试用例

### 测试 1：只输出流程方案

用户输入：

    用 viral-lab-orchestrator，帮我规划“上传视频后拆解、提取可替换项、用户替换主体、生成新视频”的流程。只输出方案，不调用真实模型。

期望：

- 输出 `creative-doc(type=viral-lab-plan)`
- 不调用 RunningHub
- 不消耗额度
- 明确当前阶段、下一步、缺失输入和推荐 Skill

---

### 测试 2：素材不足拦截

用户输入：

    帮我直接生成一个同款视频。

期望：

- 提醒缺少参考视频
- 要求上传视频、提供视频 URL 或使用 dry run
- 不直接进入生成

---

### 测试 3：未确认不生成

用户输入：

    这是拆解结果，我想把人物换成小狗，你直接生成吧。

期望：

- 先确认替换素材、Prompt、模型、时长、比例和额度
- 不直接调用 RunningHub

---

### 测试 4：二次优化

用户输入：

    这个结果不行，把主体再换成猫，场景不变。

期望：

- 复用已有 breakdown、replacementSlots、userSelection
- 只更新主体替换项
- 不重新拆解视频

---

### 测试 5：只做 RunningHub 单点任务

用户输入：

    用 RunningHub 帮我生成一个 9:16 视频。

期望：

- handoff 到 `runninghub`
- 不进入完整爆款实验室流程

---

## 九、输出结构

本 Skill 在方案阶段必须输出：

    creative-doc(type=viral-lab-plan)

建议字段：

| 字段 | 说明 |
|---|---|
| currentStage | 当前阶段 |
| userGoal | 用户目标 |
| availableInput | 当前已有输入 |
| missingInput | 当前缺失输入 |
| nextAction | 下一步动作 |
| nextSkill | 推荐调用的下一个 Skill |
| requiredInput | 进入下一阶段所需材料 |
| riskNotice | 风险提示 |
| canGenerate | 是否允许进入真实生成 |
| handoffTarget | 如需转交，写明目标 Skill |

---

## 十、输出约束

### 总体约束

- 单轮仅输出一个主 `creative-doc(type=viral-lab-plan)`。
- 本 Skill 是流程总控，不直接承担底层模型调用。
- 未经用户确认，不调用真实生成任务。
- 涉及额度消耗时，必须提醒用户确认。
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