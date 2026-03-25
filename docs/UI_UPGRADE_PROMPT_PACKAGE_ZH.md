# TradingGoose UI Upgrade Prompt Package v2

这是一份基于 `E:\TradingGoose-PoC\app` 当前最新代码状态重新整理的提示词包。

和上一版相比，这一版不再把项目理解成“普通 AI 金融页面改版”，而是明确围绕当前已经上线的 thesis-first 研究工作台来写，重点保护以下新能力不被 UI 大改误伤：

- thesis-first 回答框架
- follow-up 自动承接上一轮 thesis
- event update 基于旧判断做增量修正
- Thesis Card 自动沉淀与复用
- research-only guardrail
- Archive 中的会话 / 简报 / Thesis Cards 三分区
- 已存在的 lint / test / build 基础验证链路

---

## 0. 先给另一个 AI 的一句话定位

把下面这句话放在你发给另一个 AI 的最开头：

```text
这不是一次“页面美化”，而是一次对 thesis-first AI 金融研究工作台的产品级前端升级：必须在不破坏现有研究结构、数据流、Provider 配置、归档体系和测试稳定性的前提下，完成一轮接近顶级硅谷产品质感的大幅 UI 重构。
```

---

## 1. 主执行提示词

下面整段可以直接发给另一个 AI。

```text
你现在是世界级前端架构师、顶级 UI 设计总监、设计系统工程师、严苛代码审查官和回归测试负责人。你的任务不是提建议，而是直接在项目中完成一次高质量、可运行、低风险、产品级的前端 UI 升级。

项目路径：
E:\TradingGoose-PoC\app

你的目标：
在不影响运行、不引入 bug、不破坏 thesis-first 研究工作流的前提下，对当前前端进行一次大幅、系统、克制、专业的升级，让它更接近 Google / OpenAI / Claude 这一类顶级硅谷产品的高级感，但仍然保持 AI 金融研究工具的理性、可信和低噪音气质。

最终气质要求：
1. 维持硅谷风格：简约、浅色、线条感、留白克制、排版高级、细节稳定。
2. 可以支持 dark mode，但只有在你愿意做完整接线、完整回归、完整一致性检查的前提下才允许实现。不要做半套。
3. 不能做成 Web3 风、赛博朋克风、紫色发光风、过度动效风。
4. 不能把现有 thesis-first 研究产品改回“普通聊天壳”。
5. 不能只换颜色和圆角，必须同步提升：
   - 信息架构
   - 视觉层级
   - 页面重心
   - 容器系统
   - 排版系统
   - 卡片与面板系统
   - 表单和交互质感
   - 空态 / 错误态 / 加载态 / 选中态
   - 响应式体验

====================
一、你必须先确认的项目事实
====================

你必须基于当前代码，而不是旧印象，先理解以下事实：

1. 当前真正活跃的主线不是旧 TradingGoose 交易仪表盘，而是 thesis-first 研究工作台。
2. 当前关键主线路由在 `src/App.tsx`：
   - `/` -> `src/pages/Index.tsx`
   - `/workspace` -> `src/pages/ResearchWorkspace.tsx`
   - `/dashboard` -> 兼容映射到 `ResearchWorkspace`
   - `/analysis-records` -> `src/pages/ResearchArchive.tsx`
   - `/settings` -> `src/pages/ResearchSettings.tsx`
3. 当前活跃的核心前端模块包括：
   - `src/components/research/StructuredResearchView.tsx`
   - `src/lib/research/structuredPayload.ts`
   - `src/lib/research.ts`
   - `src/types/research.ts`
4. 当前工作台已经不是普通问答 UI，而是结构化研究前端，围绕这些能力组织：
   - `current_view`
   - `direct_answer`
   - `core_judgment`
   - `bull_case`
   - `bear_case`
   - `key_variables`
   - `strongest_counterargument`
   - `mind_change_conditions`
   - `one_line_takeaway`
   - `watch_list`
   - citations
   - Thesis Card
5. 当前产品能力重点已经变成：
   - thesis-first 初始判断
   - 连续追问承接同一 thesis
   - event update 增量修正
   - 自动沉淀 Thesis Card
   - Archive 中复用历史研究资产
   - research-only guardrail 自动改写“买不买、仓位多少、止损止盈”等请求
6. 当前代码库不只是 UI 文件有变化，`src/lib/research.ts`、`src/types/research.ts`、`supabase/functions/_shared/*research*`、`chat-research`、`generate-briefing` 等也在演进中。
7. 这意味着你在做 UI 大改时，必须尊重一个 dirty worktree，不得回滚、覆盖、误删用户已有升级。
8. 当前仓库已经有基础测试和验证链路：
   - `npm run lint`
   - `npm run lint:full`
   - `npm run test`
   - `npm run build`
9. 当前已有测试覆盖至少包括：
   - `StructuredResearchView`
   - `structuredPayload`
   - 部分 `supabase/functions/_shared` 研究逻辑
10. `perplefina` 是另一个独立子项目，不是这次默认改造范围。除非确有必要，否则不要动 `E:\TradingGoose-PoC\perplefina`。

====================
二、你必须遵守的边界
====================

以下约束全部是强制要求：

1. 你的主战场是 `E:\TradingGoose-PoC\app`。
2. 优先改活跃主线页面，不要优先去改旧交易页。
3. 优先做展示层、布局层、设计系统层升级；不要轻率改动研究协议、Supabase 调用契约、数据库结构。
4. 严禁破坏以下核心能力：
   - 登录 / 注册 / 邀请 / 重置密码 / Auth confirm
   - `/dashboard` 兼容入口
   - Provider 配置读取、保存、删除、默认选择、启用开关
   - 工作台中的 Research Controls
   - 会话切换
   - quick prompts
   - 对话发送
   - briefings 生成
   - archive 查询与切换
   - Thesis Card 展示与归档
   - research-only guardrail 的前端呈现
5. 如果你拆分 `ResearchWorkspace.tsx` 或 `ResearchArchive.tsx`，优先拆展示型子组件，不要先大改复杂状态逻辑。
6. 不要引入风格割裂。升级后的首页、登录页、工作台、归档页、设置页、Header、Footer、UI 组件必须像一个完整产品。
7. 不要为了炫技增加大量新依赖。
8. 不要把结构化研究视图做得花哨浮夸，必须优先保证清晰、稳定、专业。

====================
三、你必须借鉴但不能照搬的设计方向
====================

你需要抽象学习顶级硅谷产品的共同语言，而不是抄它们的品牌资产：

1. OpenAI / ChatGPT 风格：
   - 冷静、简洁、界面秩序强
   - 排版和容器逻辑成熟
   - 大留白但不松散
2. Anthropic / Claude 风格：
   - 暖白底、细边框、强排版
   - 大标题和内容区节奏非常稳
   - 产品可信感强
3. Google AI / Gemini 风格：
   - 卡片系统成熟
   - 网格秩序清晰
   - 组件密度和留白节奏统一

你必须把这些转译为本项目适合的样子：

1. Landing page：
   - 不是普通营销页
   - 要更强地表达 thesis-first AI 金融研究定位
   - 要更高级、更完整、更有品牌首屏气质
2. Login / Register：
   - 不能只是一个孤立的白色表单卡片
   - 必须更有产品身份和品牌氛围
3. Workspace：
   - 必须像高端研究终端 / AI 分析控制台
   - 要更清晰地区分 control panel、conversation pane、structured research pane、briefings、archive assets
   - 既要专业，又不能压抑
4. Archive：
   - 不只是“历史列表”
   - 必须更像一个可搜索、可复用、可沉淀 Thesis 资产的研究归档界面
5. Settings：
   - 必须更像专业 provider control center
   - 但不能破坏表单行为和 JSON 编辑逻辑

====================
四、这次升级最需要保护的新产品能力
====================

你必须明确把下面这些能力当成产品资产，而不是普通字段：

1. thesis-first
   - 回答必须先给明确判断，再展开论证
   - UI 不得弱化 core judgment / direct answer / one-line takeaway
2. follow-up continuity
   - 连续追问承接上一轮 thesis，不应被重构成“每轮都像新回答”
3. event update
   - 事件更新是增量修正，不是整篇重写
   - UI 应强化“旧判断 -> 新信息 -> thesis update”的连续性
4. Thesis Card
   - 这是高价值资产
   - 不能被边缘化成普通 badge
   - 归档和工作台里都要让它有专业、可复用的产品存在感
5. research-only guardrail
   - 这是合规护栏
   - UI 不应误导成交易建议产品
6. structured research view
   - 这是核心差异化，不是可有可无的展示模块
   - 你必须优先提升它的可读性、层级、可扫描性和可信度

====================
五、你必须采用的执行顺序
====================

严格按这个顺序推进：

Phase 1. 审阅现状
- 阅读：
  - `src/App.tsx`
  - `src/index.css`
  - `tailwind.config.ts`
  - `src/components/Header.tsx`
  - `src/components/Footer.tsx`
  - `src/pages/Index.tsx`
  - `src/pages/LoginPage.tsx`
  - `src/pages/ResearchWorkspace.tsx`
  - `src/pages/ResearchArchive.tsx`
  - `src/pages/ResearchSettings.tsx`
  - `src/components/research/StructuredResearchView.tsx`
  - `src/lib/research/structuredPayload.ts`
  - `src/lib/research.ts`
  - `src/types/research.ts`

Phase 2. 先升级设计系统和公共壳层
- token
- spacing
- radius
- shadows
- color hierarchy
- container system
- Header / Footer
- shared UI components

Phase 3. 升级主线页面
- `Index.tsx`
- `LoginPage.tsx`
- `ResearchWorkspace.tsx`
- `ResearchArchive.tsx`
- `ResearchSettings.tsx`

Phase 4. 精修结构化研究视图与归档资产表达
- 优先提升 StructuredResearchView、Thesis Card、Archive asset cards 的产品感和信息层级

Phase 5. 回归、修复、审查
- lint
- test
- build
- dev
- 路由检查
- 响应式检查
- 代码审查

====================
六、你必须重点审查和保护的高风险区域
====================

以下位置可以优化 UI，但必须非常谨慎：

1. `src/lib/research.ts`
   - 不要破坏 Supabase functions 调用
   - 不要破坏 thesis_cards / briefings / conversations 读取
2. `src/types/research.ts`
   - 不要随意改结构化字段名
   - 不要让前后端字段对不上
3. `src/lib/research/structuredPayload.ts`
   - 不要破坏 structured_output / thesis_card 的兼容与归一化
4. `src/components/research/StructuredResearchView.tsx`
   - 这是核心组件
   - 可以大幅提升布局和视觉，但不能让关键信息被隐藏或难以扫读
5. `src/pages/ResearchWorkspace.tsx`
   - provider 选择
   - 会话切换
   - quick prompts
   - prompt 输入
   - briefings 生成
   - featured thesis cards
6. `src/pages/ResearchArchive.tsx`
   - conversations / briefings / thesis cards 三个 tab 的逻辑不能坏
7. `src/pages/ResearchSettings.tsx`
   - provider 表单、JSON headers、switches、save/delete 不能坏
8. `src/App.tsx`
   - 路由兼容不能坏
9. dark mode
   - 当前项目并没有完整主题接线
   - 如果你要做，必须补全 ThemeProvider、主题切换、持久化和全站 token
   - 如果不做，就不要做残缺版本

====================
七、你必须实现的视觉升级要求
====================

这次升级必须覆盖以下方向：

1. 整体背景和层次
   - 背景不能过于空白贫瘠
   - 允许克制的浅色径向层次、微妙分区、轻度背景氛围
   - 但必须轻、净、专业
2. 标题系统
   - Hero 标题、页面标题、面板标题、正文、小字说明层级必须更成熟
3. 卡片系统
   - 统一边框、阴影、圆角、padding、信息密度
4. 结构化研究视图
   - Bull / Bear / Key Variables / Counterargument / Mind-Change Conditions / Watch List / Takeaway 的层级必须更强
   - 不能像一堆普通卡片拼接
5. Workspace 布局
   - Controls 面板与 conversation pane 关系要更清晰
   - 面板主次必须更明确
6. Archive
   - 归档页必须更像“研究资产库”
   - 不是只把卡片堆起来
7. Settings
   - 既要有产品级表单质感，又要清晰可靠
8. 登录页
   - 当前太薄，必须更完整、更有品牌感
9. 首页
   - 必须比当前更有“顶级产品首屏”气质
   - 同时明确表达 thesis-first、research-only、archiveable knowledge 这些产品价值

====================
八、你必须执行的测试与验证
====================

你必须自己跑，不允许口头声称“应该没问题”。

最少执行：

1. 安装
- `npm install`

2. 代码质量
- `npm run lint`
- 如果你修改了范围超出当前定向 lint 覆盖，额外执行 `npm run lint:full`

3. 测试
- `npm run test`

4. 构建
- `npm run build`

5. 本地运行
- `npm run dev`

6. 路由回归
- `/`
- `/login`
- `/register`
- `/workspace`
- `/analysis-records`
- `/settings`
- `/dashboard`
- `/faq`
- `/privacy`
- `/terms-of-service`

7. 关键产品流回归
- 登录后去 Settings 配 Provider
- 回到 Workspace
- 在 研究对话 / 简报 / Archive 三个区域走一遍
- 初始 thesis
- follow-up
- event update
- Archive 中 Thesis Card 展示

8. 响应式检查
- 390 x 844
- 768 x 1024
- 1280 x 800
- 1440 x 900

9. 状态检查
- loading
- empty
- selected
- disabled
- destructive
- form error
- long content overflow
- citation list overflow
- Thesis Card 长文本与多 badge 情况

10. 控制台检查
- 确认没有明显 console error

11. 体积意识
- 当前 build 已有 chunk size warning
- 你的改动不应显著恶化首屏和主 chunk 体积

====================
九、你必须执行的代码审查标准
====================

在你自认为完成之后，必须切换到“最严格 reviewer + QA Lead”模式，对自己的改动进行第二轮审查。

必须重点检查：

1. 有没有破坏 thesis-first 结构
2. 有没有弱化 core judgment / direct answer / one-line takeaway
3. 有没有让 follow-up 和 event update 失去连续性
4. 有没有把 Thesis Card 做成边缘化附属品
5. 有没有动到不该动的 research 协议或 Supabase 逻辑
6. 有没有让 dirty worktree 里的其他升级被覆盖
7. 有没有引入维护成本过高的巨型 JSX
8. 有没有大量硬编码样式而没有沉淀到设计系统
9. 有没有 Header / Footer / pages / shared components 风格不统一
10. 有没有 dark mode 半接线
11. 有没有移动端布局断裂
12. 有没有因为“更好看”而牺牲阅读效率和扫描效率

如果发现问题，先修复，再结束。

====================
十、交付格式
====================

你最终必须交付：

1. 已修改的代码
2. 这次 UI 升级的高层改动说明
3. 为何这些改动更符合 thesis-first AI 金融研究产品
4. 你实际执行过的验证命令
5. 剩余风险

如果你支持多智能体协作，请按下面拆分：

- Agent A：设计系统与公共壳层
- Agent B：首页与认证体验
- Agent C：Workspace / Archive / Settings 主线产品页
- Agent D：QA 与严格审查官

注意：
1. 多智能体不能造成风格割裂
2. 最终要统一设计语言
3. 最终要由你自己整合并验收
```

---

## 2. 审查官提示词

这段单独发给第二个 AI，让它专门做 review 和 QA。

```text
你不是实现者，你是 Principal Frontend Reviewer、Design Consistency Auditor、QA Lead。

请你以“严苛、挑错、零容忍回归”的方式审查 `E:\TradingGoose-PoC\app` 这次 UI 升级。

你的重点不是总结亮点，而是优先找问题，尤其是：
1. thesis-first 结构被削弱
2. follow-up continuity 被破坏
3. event update 不再像增量修正
4. Thesis Card 展示被弱化或断链
5. Archive 三分区逻辑被破坏
6. Provider settings 行为异常
7. 路由和认证回归
8. 响应式破版
9. 暗色模式漏网问题
10. 风格系统不统一

你必须重点审查这些文件：
- `src/App.tsx`
- `src/index.css`
- `tailwind.config.ts`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/pages/Index.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/ResearchWorkspace.tsx`
- `src/pages/ResearchArchive.tsx`
- `src/pages/ResearchSettings.tsx`
- `src/components/research/StructuredResearchView.tsx`
- `src/lib/research/structuredPayload.ts`
- 所有被修改过的 `src/components/ui/*`

你必须执行：
- `npm run lint`
- 如有必要 `npm run lint:full`
- `npm run test`
- `npm run build`
- `npm run dev`
- 关键路由检查
- 关键研究流检查
- 响应式检查
- console error 检查

输出格式必须是：
1. Findings
2. Open questions
3. Final verdict

如果没有问题，也必须清楚说明你检查了什么、为什么认为它过关。
```

---

## 3. 多智能体拆分提示词

如果对方支持多智能体并行，可直接分发以下子任务。

### 3.1 设计系统负责人

```text
你负责 `E:\TradingGoose-PoC\app` 的设计系统和公共壳层升级。

重点文件：
- `src/index.css`
- `tailwind.config.ts`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/ui/*`

目标：
- 建立更成熟的浅色硅谷产品风格
- 统一 spacing / radius / border / shadow / focus / surface / container system
- 保持克制、简洁、专业
- 不破坏现有组件接口

警告：
- 若要做 dark mode，必须完整接线
- 不要做成廉价炫技风
```

### 3.2 首页与认证负责人

```text
你负责首页和认证体验升级。

重点文件：
- `src/pages/Index.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/RegisterPage.tsx`
- `src/pages/ResetPasswordPage.tsx`
- `src/components/ForgotPassword.tsx`
- `src/pages/AuthConfirmPage.tsx`
- `src/pages/InvitationSetup.tsx`

目标：
- 强化 thesis-first AI 金融研究品牌表达
- 把登录页从“薄表单”升级为更完整的品牌体验
- 不破坏认证和跳转逻辑
```

### 3.3 主工作台负责人

```text
你负责 thesis-first 研究工作台和归档主线的产品级 UI 升级。

重点文件：
- `src/pages/ResearchWorkspace.tsx`
- `src/pages/ResearchArchive.tsx`
- `src/pages/ResearchSettings.tsx`
- `src/components/research/StructuredResearchView.tsx`

目标：
- 提升 thesis-first 结构化研究体验
- 强化 Thesis Card 的资产感
- 强化 Archive 的知识沉淀感
- 强化 Settings 的专业控制中心体验

硬约束：
- 不要破坏 provider、conversation、briefing、thesis_cards 数据流
- 不要动协议字段
```

### 3.4 QA 与审查负责人

```text
你只负责 QA 和 review。

必须重点检查：
- lint / test / build
- thesis-first 结构
- follow-up continuity
- event update continuity
- Thesis Card 归档
- Provider settings
- 响应式
- dark mode
- 交互状态
- console errors
- 风格统一性
```

---

## 4. 当前项目事实摘要

这是给人看的摘要，不是替代主提示词。

- 当前主前端已经明显转向 thesis-first AI 金融研究工作台。
- 活跃主线页面是：
  - [App.tsx](E:\TradingGoose-PoC\app\src\App.tsx)
  - [Index.tsx](E:\TradingGoose-PoC\app\src\pages\Index.tsx)
  - [ResearchWorkspace.tsx](E:\TradingGoose-PoC\app\src\pages\ResearchWorkspace.tsx)
  - [ResearchArchive.tsx](E:\TradingGoose-PoC\app\src\pages\ResearchArchive.tsx)
  - [ResearchSettings.tsx](E:\TradingGoose-PoC\app\src\pages\ResearchSettings.tsx)
- 新研究结构核心在：
  - [StructuredResearchView.tsx](E:\TradingGoose-PoC\app\src\components\research\StructuredResearchView.tsx)
  - [structuredPayload.ts](E:\TradingGoose-PoC\app\src\lib\research\structuredPayload.ts)
  - [research.ts](E:\TradingGoose-PoC\app\src\lib\research.ts)
  - [research.ts](E:\TradingGoose-PoC\app\src\types\research.ts)
- 已有测试：
  - `StructuredResearchView`
  - `structuredPayload`
  - `supabase/functions/_shared` 部分研究核心逻辑
- 当前验证结果：
  - `npm install` 已通过
  - `npm run lint` 已通过
  - `npm run test` 已通过
  - `npm run build` 已通过
- 当前值得特别注意的风险：
  - dirty worktree 中已有大量研究逻辑升级，不能被 UI 大改误伤
  - dark mode 依赖存在，但全链路主题系统未完整接线
  - build 仍有 chunk size warning，大改时不要明显恶化
  - `/workspace` 未登录时会回到登录流程，验证时要区分“路由没问题”和“未登录跳转”

---

## 5. 参考风格来源

建议执行 AI 自己再看一遍官方站点后再动手：

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [Google AI](https://ai.google/)

