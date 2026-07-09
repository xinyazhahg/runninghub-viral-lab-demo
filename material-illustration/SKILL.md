---
name: material-illustration
description: 材料插图 / 解释型配图：将文章、笔记、图表截图、产品说明、工作汇报、教学材料、人文观点等材料转化为带中文短标签的中心解释图；不负责完整社交卡片、PPT 页面或公众号封面排版。领域 Skill。
metadata: {"openclaw":{"emoji":"🧩"}, "planF":{"phase":["A","B"],"media":["image"]}}
user-invocable: true
---

# Skill: material-illustration

## Contract

### Input

- **Required**: materialContent（文章、笔记、产品说明、工作汇报、教学材料、图表数据或截图说明等需要被视觉化的材料）
- **Optional**: targetUse（article / social-card / ppt / doc）、imageTypeHint（concept / process / chart / education / humanities / work-report / system）、aspectRatio、styleHint、labelLanguage、outputCount、referenceHint
- **Validation**:
  - **完整社交卡片排版 / 小红书卡片排版** → `social-organic-surface` 或 `social-carousel`
  - **完整 PPT 页面结构 / 演示文稿设计** → PPT / slides 相关 Skill
  - **完整海报设计** → `poster`
  - **电商主图 / 商品图** → `ecom-image`
  - **广告投放素材** → `ad-creative`
  - **真实照片修图 / 人像写真** → reject 或 handoff 到对应图像编辑类 Skill
  - **严格科研级数据制图** → reject 或提醒需使用真实图表工具

### Output

- **Format**: thinking + **必须** `creative-doc(type=material-illustration-plan)`；用户确认后再装配 `workflow-json` 或交给图像生成工作流（同轮不得共发多个主 `creative-doc`）
- **Schema**: materialSummary、detectedImageType、coreConcepts、visualStructure、labelPlan、composition、visualStyle、promptPlan、referenceNeed、chartDataPolicy、qaChecklist、handoffTarget
- **Validation**:
  - 图内无任何解释性标签且用户任务是解释概念 / 流程 / 数据 → reject
  - 图内塞长文案、大段说明、密集图例 → reject
  - 中文标签乱码、错字、指向错误对象 → reject
  - 图表数据、坐标、单位、排名被编造或篡改 → reject
  - Prompt 暴露 Skill 名称、内部模式、生成流程 → reject
  - 成品出现无关 Logo、水印、假 UI、手机界面、社交平台界面 → reject

### Concurrency

- safe: false
- conflictsWith: poster, ecom-image, ad-creative, brand-designer, brochure, social-carousel, social-organic-surface, youtube-thumbnail
- handoff to: prompter, engineer, social-organic-surface, social-carousel, poster, slides

### Prompt Strategy

- `[skill:material_illustration/concept]`
- `[skill:material_illustration/process]`
- `[skill:material_illustration/chart]`
- `[skill:material_illustration/education]`
- `[skill:material_illustration/humanities]`
- `[skill:material_illustration/reference]`

---

## 一、角色定位

面向文章、笔记、图表截图、产品说明、工作汇报、教学材料、人文观点等材料，生成一张或多张 **带中文短标签的中心解释图**。

本 Skill 只负责 **配图层 / 中心图层**，不负责完整社交卡片、完整 PPT 页面、公众号封面、海报、电商主图或广告投放素材。

它的目标不是生成一张单纯好看的装饰图，而是把抽象概念、流程、机制、系统关系、图表数据或人文意象，转化为读者能一眼看懂的解释型视觉资产。

---

## 二、触发标签与关键词

**显式关键词**：材料插图、文章配图、带字配图、解释图、图解插画、概念拆解图、流程图解、机制图、系统图、图表美化、数据图美化、3D 图表、汇报配图、内容配图、教学配图、人文配图、中心图、PPT 中心图。

**隐式关键词**：  
“把这段话画成图”、“这段产品说明太抽象了”、“帮我做一张机制图”、“把这个流程讲清楚”、“给这篇文章配一张图”、“把这张图表重新画好看一点”、“这个概念冷门，先查一下再画”、“做一张能放进小红书 / PPT / 文档里的解释图”。

---

## 三、适用与不适用范围

### 适用

| 类型 | 说明 |
|------|------|
| 概念拆解图 | 一个概念由哪些部分组成 |
| 流程图解 | 输入、步骤、判断、输出 |
| 循环机制图 | 增长循环、反馈回路、迭代飞轮 |
| 产品机制图 | 产品流程、功能逻辑、权限机制、API 结构 |
| 系统架构图 | 模块、依赖、层级、组织关系 |
| 工作汇报图 | 项目进展、风险分流、决策、下周计划 |
| 数据图表美化 | 柱状图、折线图、甘特图、桑基图、热力图、漏斗图、累计流图 |
| 教学材料配图 | 小学科学、中学物理、生物、化学、地理机制 |
| 人文观点图 | 历史路线、文学意象、哲学概念、社会学隐喻 |
| 参考辅助图 | 冷门概念、专业术语、模型、品牌、科学装置、历史物件 |

### 不适用

| 不适用任务 | 处理方式 |
|------------|----------|
| 完整小红书卡片排版 | handoff 到 `social-organic-surface` 或 `social-carousel` |
| 完整 PPT 页面设计 | handoff 到 slides / PPT 相关 Skill |
| 完整海报设计 | handoff 到 `poster` |
| 电商主图 / 商品图 | handoff 到 `ecom-image` |
| 广告投放素材 | handoff 到 `ad-creative` |
| 人像写真 / 真实摄影修图 | reject 或 handoff 到图像编辑类 Skill |
| 长文海报排版 | reject，建议拆成中心图 + 外层排版 |
| 严格科研级数据图 | reject，建议使用真实图表工具制图 |

---

## 四、图片类型与内部路由

| 输入材料 | 推荐图型 | 说明 |
|----------|----------|------|
| 抽象概念 | concept-diagram | 拆成核心组成、关系和标签 |
| 产品说明 | process / mechanism | 展示产品如何运转 |
| 业务流程 | pipeline | 从输入到输出的流程图 |
| Agent / 反馈机制 | cycle | 闭环、循环、迭代 |
| 系统结构 | layer-stack / architecture | 展示模块层级和依赖 |
| 工作汇报 | work-report-grid | 进展、风险、决策、下周 |
| 两个方案 | before-after / comparison | 前后对比或左右对比 |
| 图表截图 | chart-redraw | 抽取数据语义后重画 |
| 教学知识 | scientific-mechanism | 展示部件、方向、力、反应、结构 |
| 历史 / 文学 / 哲学 | text-scene / humanities-map | 意象 + 结构 + 少量标签 |
| 冷门概念 / 品牌 / 科学装置 | reference-assisted | 先查参考，再统一风格出图 |

默认由 Agent 自己判断图型，不让用户先选择内部模式。只有关键信息缺失，并且会显著影响结果时，才用一句自然语言提问，并给出推荐默认值。

---

## 五、尺寸与比例

| 使用场景 | 推荐比例 | 说明 |
|----------|----------|------|
| 文章 / 文档中心图 | `16:9` 或 `1.9:1` | 适合宽图解释 |
| 社交卡片中心图 | `4:5` 或 `1:1` | 外层卡片需给图足够面积 |
| PPT 中心插图 | `16:9` 或 `4:3` | 作为页面主体或右侧图示 |
| 教学机制图 | `16:9` 或 `4:5` | 保证部件和标签清楚 |
| 图表美化 | `16:9` 或 `1.9:1` | 保证标题、坐标、数据可读 |
| Story / 竖屏封面中心图 | `9:16` | 关键信息放中竖安全区 |

尺寸写入方案时使用 `aspectRatio` 枚举，不在 Prompt 中写死过多平台术语。

---

## 六、图内中文标签政策

| 规则 | 标准 |
|------|------|
| 标签长度 | 理想 2–5 个汉字，6 个字通常是上限 |
| 标签数量 | 单图建议 3–5 个；复杂图最多不超过 8 个 |
| 标签内容 | 具体、口语、指向对象；避免抽象阶段名 |
| 标签位置 | 必须在图内，靠近对应对象或箭头 |
| 标签样式 | 白色标注板、干净留白区、高对比、水平排布 |
| 长解释 | 放到外层卡片、正文、Markdown、PPT 文本，不塞进图里 |
| 错字 / 乱码 | 不交付，优先缩短标签并重新生成 |
| 标签外贴 | 不合格；不要用 HTML 在图外贴一圈标签冒充图内标注 |

推荐标签示例：

- 用户提示
- AI 执行
- 结果检查
- 下一轮
- 上传视频
- 内容理解
- 素材替换
- 生成结果

不推荐标签示例：

- 输入阶段
- 执行阶段
- 验证阶段
- 系统整体解决方案流程说明
- 用户在这里输入自己的需求

---

## 七、视觉风格基线

默认视觉系统为 **材料感解释插画**：

| 维度 | 标准 |
|------|------|
| 背景 | 米白 / 白底 / 干净工作室背景 |
| 风格 | 克制 3D、瑞士编辑风、轻材质、空间关系清楚 |
| 线条 | 黑色或深灰细线，用于箭头、标注、关系线 |
| 材质 | 精致灰白材质、轻阴影、柔和摄影棚光 |
| 强调色 | 默认 IKB Blue `#002FA7`，可扩展柠檬黄、柠檬绿、安全橙、石墨黑 |
| 构图 | 主体完整，四周有安全边距，不裁切关键对象和标签 |
| 氛围 | 冷静、清晰、分析感，不做花哨装饰 |
| 字体感 | 中文标签清楚、粗细适中、缩小后仍可读 |

禁止生成：

- 假按钮
- 假点赞 / 假关注 / 假分享
- 手机 UI
- 社交平台界面
- 水印
- 无关英文
- 品牌 Logo
- 提示词内容
- 低清截图感
- 大段文字海报

---

## 八、图表处理规则

图表输入包括图表截图、表格、指标列表、Benchmark 结果、数据说明等。

### 数据优先

遇到图表截图时，只抽取图表语义：

- 图表类型
- 标题和结论
- 横轴、纵轴
- 单位和刻度
- 类别顺序
- 数值、百分比、误差线
- 最高值、最低值、瓶颈、异常点
- 用户希望强调的结论

不要继承原截图中的：

- 糟糕配色
- 过密坐标
- 原始字体
- 拥挤间距
- 模糊背景
- 截图边框
- 无关 UI

目标不是“截图换皮”，而是从数据语义重新设计一张更清楚、更适合传播的材质化图表。

### 精度要求

- 不得编造数据。
- 不得改变排名。
- 不得改错单位。
- 不得把近似值画成确定值。
- 如果数据不完整，应标注需要用户补充，而不是猜。

---

## 九、参考搜索规则

当材料包含冷门概念、品牌、模型、科学装置、历史文化物件、专业术语、地名或视觉上容易画错的对象时，需要先查参考信息或参考图片。

参考搜索只解决三个问题：

1. 这个东西是什么。
2. 哪些结构、部件、流程、图标或视觉线索不能画错。
3. 观众靠什么稳定视觉线索识别它。

参考搜索不用于：

- 抄袭外部画风
- 拼贴来源图片
- 复制水印和低清背景
- 复刻旧 UI
- 伪造历史现场
- 生成真实人物照片

最终输出必须统一转成材料感解释插画风格。

---

## 十、核心工作流

1. **读材料**：阅读用户输入的文章、笔记、截图、数据或说明，找出真正需要被画出来的概念、关系、流程、数据或意象。
2. **判断图型**：自动判断应生成概念图、流程图、循环机制图、图表、人文场景、教育机制图、工作汇报图或参考辅助图。
3. **必要时查参考**：冷门概念、品牌、模型、科学装置、历史物件、专业图标等先补事实和视觉线索。
4. **图表抽语义**：如果输入是图表截图或数据表，只保留图表语义，不复刻原始截图排版。
5. **压缩内容**：把每张图压缩成一句人话解释和 3–5 个图内中文短标签。
6. **选择结构**：Cycle / Pipeline / Hub-and-spoke / Before-after / Layer stack / Data-first scene / Scientific mechanism / Text scene。
7. **生成 Prompt**：写清楚构图、标签、比例、安全区、风格、参考线索和禁止项。
8. **调用图像生成**：交给 imagegen / 图像生成工作流 / 对应模型执行。
9. **质量检查**：检查中文标签、裁切、数据、参考准确性、主体大小、可读性和禁用元素。
10. **修正重试**：若标签错误、数据错误、参考线索误导、不可读、被裁切或风格跑偏，优先重新生成。
11. **交付记录**：记录概念名、最终 Prompt、图片路径、失败版本及原因，方便复用和复盘。

---

## 十一、文件与过程记录

执行任务时，应创建独立任务文件夹，不要把临时资产散落在 Skill 根目录。

推荐结构：

```text
local-tests/<slug>/
├── assets/
│   └── generated illustration images
└── PROMPTS.md
每张最终图至少记录：

* Concept name
* Final prompt
* Output image path
* Rejected attempt and reason

如果与其他项目配合，优先使用该项目指定的任务目录。

---

## 十二、反模式

| 反模式 | 处理 |
|--------|------|
| 无字装饰图 | 若任务是解释概念 / 流程 / 数据，则 reject |
| 图内塞长文 | 砍成短标签，长解释放图外 |
| 错字乱码 | 不交付，缩短标签后重生 |
| 标签外贴 | 不合格，标签必须在图内 |
| 小图硬缩放 | 提醒外层排版必须给图足够面积 |
| 假数据 | reject，要求补充真实数据 |
| 截图换皮 | 改为抽取语义后重画 |
| 模式审讯 | Agent 自己判断类型，不让用户先选内部模式 |
| 暴露幕后信息 | Prompt、Skill 名、生成过程不得进入成品 |
| 参考拼贴 | 参考只用于理解，不用于照搬 |
| 假 UI | 禁止生成手机界面、点赞、关注、分享等假元素 |

---

## 十三、自检清单

交付前逐项检查：

| 项 | 标准 |
|----|------|
| 主题 | 是否表达了原材料的核心内容 |
| 图型 | 是否选择了合适的视觉结构 |
| 标签 | 是否包含必要中文短标签 |
| 字数 | 标签是否简短，避免大段文字 |
| 位置 | 标签是否在图内，并指向正确对象 |
| 可读性 | 缩小到社交卡片尺寸后是否仍能看懂 |
| 裁切 | 重要对象和标签是否没有被裁掉 |
| 数据 | 图表数值、单位、排名、坐标是否准确 |
| 参考 | 冷门对象是否画对关键结构和视觉线索 |
| 风格 | 是否符合白底、克制 3D、材料感、统一强调色 |
| 禁用元素 | 是否没有水印、Logo、假 UI、无关英文、提示词泄露 |
| 职责边界 | 是否只做中心图，没有越界做完整排版 |

---

## 十四、输出结构（`creative-doc` 建议字段）

1. **材料摘要** — 一句话说明原材料在讲什么
2. **检测图型** — concept / process / chart / education / humanities / work-report / system
3. **核心概念** — 本次要画出来的 1–4 个概念
4. **视觉结构** — cycle / pipeline / hub / before-after / layer-stack / data-first / scientific / text-scene
5. **中文标签方案** — 标签文本、数量、位置
6. **构图说明** — 主体、箭头、层级、空间关系
7. **视觉风格** — 背景、材质、强调色、光照
8. **Prompt 方案** — 生成图片所需的主要 Prompt
9. **参考需求** — 是否需要查参考、查什么、提取什么
10. **图表数据政策** — 如果是图表，列明保留哪些数据和单位
11. **质检清单** — 交付前重点检查项
12. **Handoff** — 是否交给社交卡片 / PPT / 海报 Skill 做外层排版

---

## 十五、图生 Prompt 禁词与替代表述

### 禁止出现

**平台 / UI 词**：feed、story、reel、post、carousel、like、share、follow、save、sponsored、ad、promoted、profile、follower。

**截图向词**：screenshot、phone screen、mobile mockup、app interface、UI chrome。

**误导性内容**：logo、watermark、brand mark、fake button、notification badge、social media interface。

**幕后信息**：prompt、skill、workflow、internal mode、generation process。

**长文案倾向**：poster text、full paragraph、dense legend、article layout。

### 正确替代表述

- “白底中心解释图”
- “带中文短标签的材料感插画”
- “从左到右的流程关系”
- “无界面元素”
- “图内仅保留 3–5 个短标签”
- “适合作为文章 / PPT / 社交卡片中的中心图”
- “主体完整、四周留白、安全边距充足”

---

## 十六、输出约束

- 单轮仅一个主 `creative-doc`。
- 不与完整排版类 Skill 同轮输出多个主方案。
- 本 Skill 输出中心图方案，不输出完整社交卡片、PPT 页面或海报。
- 图内中文标签错误、图表数据错误、裁切严重、出现假 UI 或水印时，不得交付为最终结果。
- 需要外层排版时，在 handoff 中明确交给 `social-organic-surface`、`social-carousel`、`poster` 或 slides 相关 Skill。
- 元块仅在 `thinking` fence。
- 遵守 `AGENTS.md` 与 `document-chain-protocol.md`。