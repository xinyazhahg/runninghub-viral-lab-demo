# Handoff Brief Contract

> 跨 Skill 交接使用两层结构化格式：上游 `【Intent Brief】` 由 analyst 输出（见 analyst SKILL.md），下游 `【Prompt Pack】` 由 prompter / video-prompt / story-ref-gen / reverse-engineer，以及显式 Seedance 兼容链路中的 seedance-prompter 输出。目标是让每一层交接都有**固定字段、逐节点声明**，下游不需要"读散文猜意图"。

## 一、`【Prompt Pack】` — C 阶段 → D 阶段的结构化交接

所有 C 阶段 Skill（prompter / video-prompt / story-ref-gen / reverse-engineer，以及显式 Seedance 兼容链路中的 seedance-prompter）完成提示词创作后，**必须**在 `thinking` 中输出一个格式固定的 `【Prompt Pack】`，供 engineer（D 阶段）直接消费。

### 1.1 标准结构

```thinking
【Prompt Pack】
action: create | modify
outputProtocol: workflow-json | canvas-command
workflowName: [工作流标题]
executionStage: [character-sheet | storyboard | image | video | reverse | edit]
nodes:
  - index: 1 | title: [节点标题] | subType: [text-image / image-image / text-video / ...] | content: [完整提示词] | agentNodeType: [character / illustration / video_clip / ...] | aspectRatio: [16:9 / 9:16 / 3:4 / 4:3 / 1:1] | duration: [4s ~ 15s，仅视频节点按需] | editAction: [canvas-capabilities.yaml 中 image-image 允许的 editAction，默认 redraw]
  - index: 2 | title: ... | subType: ... | content: ... | agentNodeType: ... | aspectRatio: ... | duration: ...
edges:
  - source: [真实节点ID或本批节点index] | target: [本批节点index]
notes:
  - [执行提醒或短项结构化提示，如"sourceNodeId=node-xxx" / "mode=text2video"]
selfCheck:
  - [可选自检项；仅供上游 Skill 记录，不作为 Engineer 的组装输入]
```

### 1.2 字段说明

| 字段 | 必填 | 封闭枚举 | 说明 |
|------|------|---------|------|
| `action` | 是 | `create` / `modify` | 新建工作流 or 修改已有节点 |
| `outputProtocol` | 是 | `workflow-json` / `canvas-command` | Engineer 应输出的协议类型 |
| `workflowName` | 是 | — | 工作流名称 |
| `executionStage` | 是 | `character-sheet` / `storyboard` / `image` / `video` / `reverse` / `edit` | 当前执行阶段 |
| `nodes[].index` | 是 | — | 节点序号（从 1 开始） |
| `nodes[].title` | 是 | — | 节点标题 |
| `nodes[].subType` | 是 | canvas-capabilities.yaml 中的合法值 | 节点子类型 |
| `nodes[].content` | 是 | — | 完整提示词（video-hd 除外） |
| `nodes[].agentNodeType` | 是 | AGENTS.md 中定义的枚举 | 功能角色标签 |
| `nodes[].aspectRatio` | 可选 | `16:9` / `9:16` / `3:4` / `4:3` / `1:1` | 比例，省略用默认值 |
| `nodes[].duration` | 可选 | `4s` ~ `15s` | 仅视频节点按需填写；省略时用客户端默认，长视频拆成多个节点 |
| `nodes[].editAction` | 条件 | canvas-capabilities.yaml 中 `image-image.editActions` | image-image 必填；增量重绘默认 `redraw` |
| `edges[].source` | 条件 | — | 真实节点 ID（`node-xxx`）或本批节点 index |
| `edges[].target` | 条件 | — | 本批节点 index |
| `notes[]` | 可选 | — | 给 Engineer 的执行提醒或短项结构化提示 |
| `selfCheck[]` | 可选 | — | C 阶段 Skill 的自检附录；Engineer 忽略，不写入协议块 |

### 1.3 增强结构（文档链/多轮流水线产出）

文档链或漫剧流水线完成后，Prompt Pack 应追加资产注册表和 Clip 编排表：

```thinking
【Prompt Pack (Enhanced)】
... 标准字段 ...

assetRegistry:
  - name: [资产名]
    kind: [character / scene / prop / product]
    provenance: [user_subject / user_ref_image / to_generate]
    subjectTag: [若有则保留 <subject>主体名称</subject>]
    coreVersion: [主体版本描述]
    variants: [稳定可复用版本]
    clips: [出现的 Clip 编号列表]

clipTable:
  - clipId: 1 | duration: 13s | scene: [场景] | shotIds: [1,2,3] | description: [片段概述] | assets: [角色A, 场景B]
  - clipId: 2 | duration: 13s | scene: [场景] | shotIds: [4,5,6] | description: [片段概述] | assets: [角色A, 道具C]

referenceBindings:
  - clipId: 1 | assets: [角色A, 场景B] | nodeIds: [node-1, node-2]

audioPlan:
  voiceOver: [如有]
  dialogue: [如有]
  bgmIntent: [如有]
```

## 二、`【Prompt Blocker】` — C 阶段阻断时的标准输出

当 C 阶段 Skill 无法安全推进时，输出标准阻断格式：

```thinking
【Prompt Blocker】
reason: [阻断原因]
missing:
  - [缺失项1]
  - [缺失项2]
suggestedAction: ask-user | retry-with-context
```

## 三、使用原则

- 每个 `nodes[]` 条目必须**逐字段声明**，不允许省略 `agentNodeType` 或 `subType`
- `content` 是完整提示词，不是摘要或占位符
- `edges[].source` 引用画布已有节点时，必须使用真实 `node-xxx` ID
- `edges[].target` 使用本批 `nodes[].index` 值（数字）
- `notes[]` 只放短项执行提醒或结构化提示（如 `sourceNodeId=node-xxx`、`mode=text2video`），不放长解释
- 视频节点如显式声明 `duration`，必须使用字符串格式 `4s` ~ `15s`；不确定时省略，交给客户端默认
- 同一轮如果输出 `creative-doc` 或 `form-fields`，**不同时输出 `【Prompt Pack】`**
- `editAction` 仅在 `subType=image-image` 时填写，取值以 `canvas-capabilities.yaml` 为准；未明确擦除 / 扩图 / 增强等特殊操作时默认 `redraw`
- `assetRegistry` 必须保留 `provenance`，避免参考主体与普通参考图混淆
- `clipTable` 中的时长必须基于 `timing-rules.md` 的计算规则，并使用与视频节点一致的字符串格式（如 `7s`、`13s`）
- 视频链若已有参考节点，必须补 `referenceBindings`
- 有配音 / 旁白 / 配乐意图时，必须补 `audioPlan`
- `selfCheck[]` 只作为上游 Skill 的自检附录，不能替代 `nodes` / `edges` / `notes` 这些 canonical 交接字段

## 四、常见错误

| 错误 | 问题 |
|------|------|
| nodes 里漏了 `agentNodeType` | Engineer 不知道节点功能角色，客户端无法智能连线 |
| nodes 里漏了 `subType` | Engineer 要猜节点类型 |
| `content` 写了摘要而非完整 prompt | Engineer 被迫自己发明 prompt |
| `edges` 缺 source | Engineer 猜不到该连哪个上游节点 |
| image-image 漏了 `editAction` | Engineer Post-check 一定 reject |
| `assetRegistry` 描述太笼统 | 跨 Clip 一致性无法保障 |
| `clipTable` 缺时长 | Engineer 不知道该怎么切分视频节点 |
| 漏了 `referenceBindings` | Engineer 不知道视频节点该连哪些参考资产 |
| 漏了 `provenance` | 前端无法区分参考主体与普通参考图 |
| 编辑任务没写真实节点锚点 | Engineer 不知道 source 是谁 |
| **写了 `toolsType`** | **⛔ 严重错误**——`toolsType` 会覆盖 `subType` 的模型查找路径，导致节点选错模型列表。图片编辑只用 `editAction`，视频高清用 `subType: "video-hd"`，永远不碰 `toolsType` |

## 五、与 `【Intent Brief】` 的关系

```
用户消息 → analyst 输出【Intent Brief】→ C阶段 Skill 输出【Prompt Pack】→ engineer 消费 Prompt Pack 组装协议块
```

`【Intent Brief】` 定义"做什么、走哪条路"，`【Prompt Pack】` 定义"每个节点具体写什么、怎么连"。两者共同构成 PlanF 的**双层结构化交接契约**。
