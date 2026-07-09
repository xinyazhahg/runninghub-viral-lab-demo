---
name: film-breakdown
description: 视频拆解 Skill：将参考视频、视频描述或 RunningHub video-to-text 结果拆解为镜头结构、主体、动作、场景、元素、字幕和可替换内容 buckets；为爆款实验室后续 replacement-slot-planner 和 film-recompose 提供结构化输入。领域 Skill。
metadata: {"openclaw":{"emoji":"🎞️"}, "planF":{"phase":["A","B"],"media":["video","text"]}}
user-invocable: true
---

# Skill: film-breakdown

## Contract

### Input

- **Required**: videoSource 或 videoRawContext 或 videoToTextResult
- **Optional**: assetManifest、duration、fps、platformHint、breakdownDepth、dryRun

### Output

- **Format**: thinking + **必须** `creative-doc(type=film-breakdown-plan)`
- **Schema**: videoSummary、shots、buckets、textResult、riskNotice、nextAction
- **Validation**:
  - 没有视频来源、视频描述或 video-to-text 结果 → request input
  - 不能识别镜头 → 输出 partial breakdown，不编造
  - 没有字幕 → 输出“本视频未识别到任何文字”
  - 不得生成最终视频 Prompt
  - 不得调用真实视频生成模型
  - 不得消耗额度

### Concurrency

- safe: true
- conflictsWith: runninghub, film-recompose, replacement-slot-planner, viral-lab-orchestrator
- handoff to: replacement-slot-planner, viral-lab-orchestrator, runninghub
- usedBy: viral-lab-orchestrator

### Prompt Strategy

- `[skill:film_breakdown/shot]`
- `[skill:film_breakdown/bucket]`
- `[skill:film_breakdown/text]`
- `[skill:film_breakdown/dry_run]`

---

## 一、角色定位

`film-breakdown` 是爆款实验室的视频拆解主入口。

它负责把参考视频、视频描述或 RunningHub video-to-text 结果拆成结构化内容，供后续生成可替换项和重组 Prompt 使用。

它只做视频拆解，不做用户替换选择，不生成最终视频 Prompt，也不调用 RunningHub 出片。

---

## 二、触发标签与关键词

### 显式触发词

- 视频拆解
- 拉片拆解
- 分镜拆解
- 镜头拆解
- 拆出主体
- 拆出场景
- 拆出元素
- 拆出字幕
- video-to-text 结果整理
- 参考视频分析
- 爆款实验室视频理解

### 隐式触发语句

- “帮我拆一下这个视频。”
- “这个视频有哪些镜头？”
- “把视频里的主体、场景、元素拆出来。”
- “这个视频有哪些可以替换的东西？”
- “把 RunningHub 的 video-to-text 结果整理成镜头结构。”
- “把这个视频描述整理成 shots 和 buckets。”

---

## 三、输入类型

| 输入 | 说明 |
|---|---|
| videoSource | 视频 URL、本地路径、RunningHub outputUrl |
| assetManifest | 素材标准化后的清单 |
| videoRawContext | 视频原始描述或用户提供的视频说明 |
| videoToTextResult | RunningHub video-to-text 的结果 |
| dryRun | 没有真实视频时，用文本模拟拆解 |

---

## 四、输出结构

本 Skill 输出：

```text
creative-doc(type=film-breakdown-plan)
```

必须包含：

| 字段 | 说明 |
|---|---|
| videoSummary | 视频整体摘要 |
| shots | 镜头列表 |
| buckets | 主体、场景、元素、文字聚合 |
| textResult | 字幕 / 文字识别结果 |
| riskNotice | 识别风险 |
| nextAction | 下一步建议 |

---

## 五、shots 结构

每个镜头建议包含：

| 字段 | 说明 |
|---|---|
| shotId | 镜头 ID |
| start | 开始时间 |
| end | 结束时间 |
| subject | 主体 |
| action | 动作 |
| scene | 场景 |
| elements | 元素 |
| text | 字幕 / 贴纸 / 屏幕文字 |
| camera | 景别、机位、镜头运动 |
| rhythm | 节奏 |
| evidenceFrame | 证据帧，如有 |

示例：

```json
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
```

---

## 六、buckets 结构

`buckets` 用于把逐镜头内容聚合成可替换项候选。

```json
{
  "subjects": ["人物"],
  "scenes": ["厨房"],
  "elements": ["桌子", "蛋糕"],
  "texts": ["今日甜品"]
}
```

### buckets 分类规则

| 类型 | 说明 |
|---|---|
| subjects | 人、动物、商品、主要角色 |
| scenes | 厨房、街道、草地、房间等空间 |
| elements | 道具、衣服、球、包、饮料等物件 |
| texts | 字幕、标题、贴纸文字、屏幕文字 |

---

## 七、拆解规则

- 镜头必须按视频时间顺序输出。
- 每个镜头必须有 `shotId`。
- 如果能识别时间段，应输出 `start` 和 `end`。
- 主体、动作、场景、元素、文字必须分开。
- 字幕、贴纸、屏幕文字必须进入 `text` 或 `texts`。
- 不要把字幕混入普通元素。
- 不要过度细分无价值元素。
- 不要输出“天空”“地面”“背景”等弱价值替换项，除非它们是视频核心内容。
- 不要推断敏感身份或关系，例如“情侣”“夫妻”“父子”，除非用户明确提供。
- 同一主体跨镜头出现时，命名应保持一致。
- 识别不确定时，给出 `riskNotice`，不要编造。

---

## 八、文字 / 字幕规则

| 情况 | 输出 |
|---|---|
| 识别到字幕 | 放入对应 shot.text 和 buckets.texts |
| 没有字幕 | 输出“本视频未识别到任何文字” |
| 字幕模糊 | 标记为低置信度 |
| 屏幕文字 | 归入 text，不归入 element |
| 贴纸文案 | 归入 text，不归入 element |

---

## 九、本 Skill 不做什么

- 不生成前端替换卡片。
- 不接收用户替换选择。
- 不生成最终视频 Prompt。
- 不调用 RunningHub 出片。
- 不判断视频能不能爆。
- 不做完整视频重制。
- 不清空或修改上游素材信息。

---

## 十、Handoff 规则

| 场景 | 下一步 |
|---|---|
| 已生成 shots 和 buckets | handoff 到 `replacement-slot-planner` |
| 需要继续完整爆款实验室流程 | handoff 到 `viral-lab-orchestrator` |
| 需要先做 video-to-text | handoff 到 `runninghub` |
| 用户要求直接生成视频 | handoff 到 `viral-lab-orchestrator` 或 `runninghub`，并提醒需要确认 |

---

## 十一、输出示例

```json
{
  "type": "film-breakdown-plan",
  "videoSummary": "视频展示一个人物在厨房中走向镜头，并展示桌上的蛋糕。",
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
  ],
  "buckets": {
    "subjects": ["人物"],
    "scenes": ["厨房"],
    "elements": ["桌子", "蛋糕"],
    "texts": ["今日甜品"]
  },
  "textResult": "识别到文字：今日甜品",
  "nextAction": "handoff_to_replacement_slot_planner"
}
```

---

## 十二、自检清单

交付前检查：

- 是否有视频摘要。
- 是否有 shots。
- shots 是否按时间顺序。
- 主体、动作、场景、元素、文字是否分开。
- 字幕是否单独归入 text。
- buckets 是否可用于后续生成替换项。
- 是否过滤了低价值元素。
- 是否避免了关系推断和敏感身份推断。
- 如果无法完整拆解，是否给出风险说明。
- 是否没有生成最终 Prompt 或调用真实模型。

---

## 十三、输出约束

- 单轮仅输出一个主 `creative-doc(type=film-breakdown-plan)`。
- 不调用真实视频生成模型。
- 不消耗额度。
- 不生成 replacement-slots。
- 不生成 film-recompose Prompt。
- 不直接进入 RunningHub 出片。
- 如果缺少视频来源或视频描述，应要求用户补充。
- 如果只是 dry run，必须明确标记为流程模拟。