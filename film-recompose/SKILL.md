---
name: film-recompose
description: 视频 Prompt 重组 Skill：基于 film-breakdown 的镜头拆解结果、replacement-slot-planner 的可替换项，以及用户的替换选择，生成保留原视频结构的新视频 Prompt；用于爆款实验室生成前的 Prompt 重组阶段。领域 Skill。
metadata: {"openclaw":{"emoji":"🎬"}, "planF":{"phase":["B","C"],"media":["video","text"]}}
user-invocable: true
---

# Skill: film-recompose

## Contract

### Input

- **Required**: filmBreakdown、replacementSlots、userSelection
- **Optional**: targetModel、aspectRatio、duration、styleHint、platformHint、generationSettings、dryRun

### Output

- **Format**: thinking + **必须** `creative-doc(type=film-recompose-plan)`
- **Schema**: sourceSummary、globalPrompt、shotPrompts、modelHints、lockedOriginal、replacedItems、riskNotice、nextAction
- **Validation**:
  - 没有 filmBreakdown → request film-breakdown
  - 没有 replacementSlots → request replacement-slot-planner
  - 没有 userSelection → request user selection
  - 用户未确认替换选择 → 不进入最终生成
  - 不调用 RunningHub
  - 不消耗额度
  - 不擅自添加用户未选择的替换项

### Concurrency

- safe: true
- conflictsWith: film-breakdown, replacement-slot-planner, runninghub, viral-lab-orchestrator
- handoff to: runninghub, viral-lab-orchestrator, prompter
- usedBy: viral-lab-orchestrator

### Prompt Strategy

- `[skill:film_recompose/global]`
- `[skill:film_recompose/shot]`
- `[skill:film_recompose/lock_original]`
- `[skill:film_recompose/subject_swap]`
- `[skill:film_recompose/style]`

---

## 一、角色定位

`film-recompose` 是爆款实验室的 Prompt 重组 Skill。

它负责根据原视频拆解结果和用户替换选择，生成新的逐镜头 Prompt 或全局视频 Prompt。

它的核心目标是：

> 保留参考视频的镜头结构和未替换内容，只重写用户明确选择替换的部分。

本 Skill 不调用 RunningHub，不执行真实生成，不消耗额度。

---

## 二、触发标签与关键词

### 显式触发词

- Prompt 重组
- 视频 Prompt
- 逐镜头 Prompt
- 替换后 Prompt
- 重组视频指令
- 根据替换项生成 Prompt
- film-recompose
- 爆款实验室 Prompt

### 隐式触发语句

- “把用户选择翻译成视频生成 Prompt。”
- “根据拆解结果和替换项生成新视频 Prompt。”
- “保留原视频镜头结构，只替换主体。”
- “把这个 replacementSlots 和 userSelection 组合成 Prompt。”
- “没选的内容保持原样，选中的内容写进 Prompt。”

---

## 三、输入结构

推荐输入来自：

- `film-breakdown`
- `replacement-slot-planner`
- 用户替换选择

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

## 四、输出结构

本 Skill 输出：

```text
creative-doc(type=film-recompose-plan)
```

必须包含：

| 字段 | 说明 |
|---|---|
| sourceSummary | 输入内容摘要 |
| globalPrompt | 全局视频 Prompt |
| shotPrompts | 逐镜头 Prompt |
| modelHints | 模型参数建议 |
| lockedOriginal | 保持原样的内容 |
| replacedItems | 已替换内容 |
| riskNotice | 风险提示 |
| nextAction | 下一步建议 |

---

## 五、Prompt 重组原则

- 保留用户未选择替换的原始内容。
- 用户选择替换的主体、场景、元素、文字必须写入 Prompt。
- 镜头结构尽量沿用参考视频，包括镜头顺序、动作节奏、构图和镜头运动。
- 不凭空新增参考视频没有的信息。
- 不把内部字段名暴露给用户。
- 不把用户未确认的替换项写进最终 Prompt。
- 如果替换内容影响多个镜头，要在所有相关镜头里保持一致。
- 如果模型需要单段 Prompt，可以把逐镜头 Prompt 合并为 globalPrompt。
- 如果模型支持分镜 Prompt，应保留 shotPrompts 结构。
- 字幕 / 贴纸文字替换应单独说明，不要混入普通元素。

---

## 六、shotPrompts 结构

每个镜头 Prompt 建议包含：

| 字段 | 说明 |
|---|---|
| shotId | 对应原视频镜头 |
| prompt | 该镜头的新视频描述 |
| duration | 镜头时长 |
| lockedOriginal | 保留原视频不变的内容 |
| replaced | 已替换的内容类型 |
| sourceShot | 对应原镜头摘要 |

示例：

```json
{
  "shotId": "shot_01",
  "duration": 3.2,
  "prompt": "镜头1：在厨房场景中，一只可卡布幼犬走向镜头，桌上有蛋糕，镜头轻微推进，保持原视频的中景构图。",
  "lockedOriginal": ["scene", "camera", "motion"],
  "replaced": ["subject"],
  "sourceShot": "原镜头为人物在厨房走向镜头。"
}
```

---

## 七、globalPrompt 规则

`globalPrompt` 用于整段视频的整体描述。

应包含：

- 视频整体风格
- 替换后的核心主体
- 保留的原视频结构
- 场景和动作关系
- 时长和比例建议
- 模型参数提示

示例：

```text
生成一段 9:16 竖屏视频，整体风格温暖、真实、生活方式感。参考视频结构保持不变：主体从厨房场景中走向镜头，并展示桌上的蛋糕。将原主体“人物”替换为“可卡布幼犬”，保留厨房场景、镜头推进和慢节奏展示方式。
```

---

## 八、modelHints 规则

`modelHints` 用于给生成执行层提供参数建议。

```json
{
  "model": "kling-v3.0-pro/image-to-video",
  "duration": 10,
  "aspectRatio": "9:16",
  "mode": "image-to-video"
}
```

规则：

- 如果用户已指定模型，优先使用用户指定模型。
- 如果未指定模型，可建议默认视频生成模型。
- 如果用户未指定时长，沿用原视频时长或给出推荐。
- 如果用户未指定比例，沿用原视频比例或默认 9:16。
- 不在本阶段真实调用模型。

---

## 九、本 Skill 不做什么

- 不调用 RunningHub。
- 不提交真实生成任务。
- 不消耗额度。
- 不重新拆解视频。
- 不重新生成 replacementSlots。
- 不替用户选择替换项。
- 不擅自修改用户未确认的内容。
- 不输出最终生成结果。
- 不做结果页展示。

---

## 十、Handoff 规则

| 场景 | 下一步 |
|---|---|
| Prompt 已生成且用户确认 | handoff 到 `runninghub` |
| 用户未确认生成 | 停留当前阶段，请求确认 |
| 缺少 filmBreakdown | handoff 到 `film-breakdown` |
| 缺少 replacementSlots | handoff 到 `replacement-slot-planner` |
| 缺少 userSelection | handoff 到 `viral-lab-orchestrator` 等待用户选择 |
| 用户要求继续完整流程 | handoff 到 `viral-lab-orchestrator` |

---

## 十一、输出示例

```json
{
  "type": "film-recompose-plan",
  "sourceSummary": "原视频为人物在厨房走向镜头并展示蛋糕。",
  "globalPrompt": "生成一段 9:16 竖屏视频，整体风格温暖、真实、生活方式感。参考视频结构保持不变：主体从厨房场景中走向镜头，并展示桌上的蛋糕。将原主体“人物”替换为“可卡布幼犬”，保留厨房场景、镜头推进和慢节奏展示方式。",
  "shotPrompts": [
    {
      "shotId": "shot_01",
      "duration": 3.2,
      "prompt": "镜头1：在厨房场景中，一只可卡布幼犬走向镜头，桌上有蛋糕，镜头轻微推进，保持原视频的中景构图。",
      "lockedOriginal": ["scene", "camera", "motion"],
      "replaced": ["subject"]
    }
  ],
  "modelHints": {
    "model": "kling-v3.0-pro/image-to-video",
    "duration": 10,
    "aspectRatio": "9:16"
  },
  "nextAction": "confirm_before_runninghub_generation"
}
```

---

## 十二、自检清单

交付前检查：

- 是否读取了 filmBreakdown。
- 是否读取了 replacementSlots。
- 是否读取了 userSelection。
- 用户选择的替换项是否写入 Prompt。
- 未选择替换的内容是否保持原样。
- 是否保留原视频镜头结构。
- 是否没有新增大量原视频没有的信息。
- 是否没有暴露内部字段名。
- 是否没有调用 RunningHub。
- 是否提示真实生成前需要用户确认。

---

## 十三、输出约束

- 单轮仅输出一个主 `creative-doc(type=film-recompose-plan)`。
- 不调用真实视频生成模型。
- 不消耗额度。
- 不直接进入 RunningHub 出片。
- 不修改未确认的替换内容。
- 不重新拆解视频。
- 不重新生成可替换项。
- 如果缺少 userSelection，应要求用户先确认替换选择。
- 真实生成必须 handoff 到 `runninghub`。