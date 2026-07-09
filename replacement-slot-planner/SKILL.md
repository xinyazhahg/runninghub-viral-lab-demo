---
name: replacement-slot-planner
description: 可替换项规划 Skill：将 film-breakdown 输出的 shots 和 buckets 转化为前端可展示、用户可选择、可上传替换素材的替换卡片；用于爆款实验室主体、场景、元素、文字等替换配置。领域 Skill。
metadata: {"openclaw":{"emoji":"🧩"}, "planF":{"phase":["A","B"],"media":["video","image","text"]}}
user-invocable: true
---

# Skill: replacement-slot-planner

## Contract

### Input

- **Required**: filmBreakdown 或 shots + buckets
- **Optional**: userGoal、platformHint、replacementPolicy、maxSlots、dryRun

### Output

- **Format**: thinking + **必须** `creative-doc(type=replacement-slots-plan)`
- **Schema**: sourceSummary、slots、hiddenItems、riskNotice、nextAction
- **Validation**:
  - 没有 shots 或 buckets → request film-breakdown
  - 没有可替换内容 → 输出 no_replaceable_slots，不编造
  - 不得生成最终视频 Prompt
  - 不得调用 RunningHub
  - 不得替用户做选择
  - 不得把字幕归入普通元素

### Concurrency

- safe: true
- conflictsWith: film-breakdown, film-recompose, runninghub, viral-lab-orchestrator
- handoff to: film-recompose, viral-lab-orchestrator
- usedBy: viral-lab-orchestrator

### Prompt Strategy

- `[skill:replacement_slot/subject]`
- `[skill:replacement_slot/scene]`
- `[skill:replacement_slot/element]`
- `[skill:replacement_slot/text]`
- `[skill:replacement_slot/filter]`

---

## 一、角色定位

`replacement-slot-planner` 是爆款实验室的可替换项规划 Skill。

它接收 `film-breakdown` 输出的镜头拆解结果，将其中的主体、场景、元素、文字整理成用户能看懂、能选择、能上传替换素材的前端卡片。

本 Skill 不负责重新拆解视频，不生成最终视频 Prompt，也不调用模型出片。

---

## 二、触发标签与关键词

### 显式触发词

- 可替换项
- 替换卡片
- 主体替换
- 场景替换
- 元素替换
- 字幕替换
- 替换规划
- replacement slots
- buckets 转卡片
- 生成替换项

### 隐式触发语句

- “把这些 buckets 变成用户能选的卡片。”
- “把视频拆解结果整理成可替换项。”
- “哪些主体、场景、元素可以让用户替换？”
- “给前端生成替换项列表。”
- “把字幕单独列出来，不要混进元素里。”

---

## 三、输入结构

推荐输入来自 `film-breakdown`：

```json
{
  "filmBreakdown": {
    "shots": [
      {
        "shotId": "shot_01",
        "subject": ["人物"],
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

## 四、输出结构

本 Skill 输出：

```text
creative-doc(type=replacement-slots-plan)
```

必须包含：

| 字段 | 说明 |
|---|---|
| sourceSummary | 输入拆解结果摘要 |
| slots | 可替换项列表 |
| hiddenItems | 被过滤或不建议展示的内容 |
| riskNotice | 风险提示 |
| nextAction | 下一步建议 |

---

## 五、slot 结构

每个可替换项建议包含：

| 字段 | 说明 |
|---|---|
| slotId | 替换项唯一 ID |
| type | subject / scene / element / text / style / duration |
| label | 展示给用户看的自然语言标签 |
| sourceShotIds | 来源镜头 |
| replaceable | 是否建议替换 |
| suggestedInput | 推荐用户提供什么类型输入 |
| priority | high / medium / low / hidden |
| displayHint | 前端展示说明 |

示例：

```json
{
  "slotId": "subject_01",
  "type": "subject",
  "label": "人物",
  "sourceShotIds": ["shot_01"],
  "replaceable": true,
  "suggestedInput": "image",
  "priority": "high",
  "displayHint": "可替换为人物、动物、商品或角色素材"
}
```

---

## 六、替换类型

| 类型 | 说明 | 推荐输入 |
|---|---|---|
| subject | 人、动物、商品、主要角色 | 图片 / 描述 / 素材 |
| scene | 厨房、街道、草地、房间等空间环境 | 图片 / 描述 |
| element | 道具、衣服、球、包、饮料等物件 | 图片 / 描述 |
| text | 字幕、标题、贴纸文字、屏幕文字 | 文案 |
| style | 风格、光影、色调、氛围 | 文本选择 |
| duration | 时长、片段范围 | 时间选择 |

---

## 七、规划规则

- 优先展示主体、商品、核心场景、核心道具。
- 文本类必须单独归入 `text`，不要混入 `element`。
- 同名或高度相似项应合并，避免前端卡片重复。
- 每个 slot 必须能追溯到对应镜头。
- 过滤弱价值元素，如“天空”“地面”“墙面”“普通背景”。
- 过滤敏感关系推断类标签，如“情侣”“夫妻”“父子”，除非用户明确提供。
- 标签要自然、短、易懂，不要输出“主体1”“元素2”这种内部名。
- 不要替用户决定最终替换内容，只生成候选项。

---

## 八、优先级规则

| 优先级 | 说明 |
|---|---|
| high | 主体、商品、核心角色等强替换价值内容 |
| medium | 场景、重要道具、服装、背景物 |
| low | 字幕、贴纸文字、弱元素 |
| hidden | 不建议展示给用户的低价值项 |

---

## 九、前端对应

本 Skill 输出对应爆款实验室页面中的：

- 主体替换卡片
- 场景替换卡片
- 元素替换卡片
- 字幕 / 文字替换卡片
- 上传新素材
- 恢复原始
- 已替换状态
- 保留原始状态

---

## 十、本 Skill 不做什么

- 不重新拆解视频。
- 不生成最终视频 Prompt。
- 不调用 RunningHub。
- 不执行真实替换。
- 不替用户选择替换项。
- 不进行视频合成。
- 不清空上游 filmBreakdown。

---

## 十一、Handoff 规则

| 场景 | 下一步 |
|---|---|
| 已生成 replacementSlots | handoff 到 `film-recompose` |
| 需要继续完整爆款实验室流程 | handoff 到 `viral-lab-orchestrator` |
| 缺少 filmBreakdown | handoff 到 `film-breakdown` |
| 用户要求直接生成视频 | handoff 到 `viral-lab-orchestrator`，并提示需要确认 |

---

## 十二、输出示例

```json
{
  "type": "replacement-slots-plan",
  "sourceSummary": "视频包含人物、厨房场景、桌子、蛋糕和字幕“今日甜品”。",
  "slots": [
    {
      "slotId": "subject_01",
      "type": "subject",
      "label": "人物",
      "sourceShotIds": ["shot_01"],
      "replaceable": true,
      "suggestedInput": "image",
      "priority": "high"
    },
    {
      "slotId": "scene_01",
      "type": "scene",
      "label": "厨房",
      "sourceShotIds": ["shot_01"],
      "replaceable": true,
      "suggestedInput": "image",
      "priority": "medium"
    },
    {
      "slotId": "text_01",
      "type": "text",
      "label": "今日甜品",
      "sourceShotIds": ["shot_01"],
      "replaceable": true,
      "suggestedInput": "text",
      "priority": "low"
    }
  ],
  "hiddenItems": [],
  "nextAction": "handoff_to_film_recompose_after_user_selection"
}
```

---

## 十三、自检清单

交付前检查：

- 是否有 slots。
- slot 是否能追溯到 sourceShotIds。
- 主体、场景、元素、文字是否分开。
- 字幕是否单独归入 text。
- 是否过滤低价值元素。
- 是否合并重复项。
- 是否避免敏感关系推断。
- 是否没有生成最终 Prompt。
- 是否没有调用真实模型。
- 是否没有替用户做最终选择。

---

## 十四、输出约束

- 单轮仅输出一个主 `creative-doc(type=replacement-slots-plan)`。
- 不调用真实视频生成模型。
- 不消耗额度。
- 不生成 film-recompose Prompt。
- 不直接进入 RunningHub 出片。
- 不替用户选择替换项。
- 如果缺少 filmBreakdown，应要求先完成视频拆解。
- 如果没有可替换项，应明确返回 no_replaceable_slots。