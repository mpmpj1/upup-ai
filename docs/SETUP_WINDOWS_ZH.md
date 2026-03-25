# TradingGoose PoC Windows 部署指南

这份文档按“小白第一次把真链路跑起来”的顺序写，只覆盖当前最需要的链路：

1. 建一个 Supabase 项目
2. 把数据库补丁跑进去
3. 部署 3 个 Edge Functions
4. 配前端环境变量
5. 登录后保存一个可用的大模型 provider
6. 发送第一条研究问答，确认链路跑通

项目根目录默认是：

```text
E:\TradingGoose-PoC\app
```

## 1. 先准备好这些东西

必需：

- Node.js 20 LTS
- Git
- 一个 Supabase 账号

当前这套“云端 Supabase + 本地前端”的跑法，`Docker Desktop` 不是必须的。只有你后面要跑本地 Supabase 容器或者市场数据 sidecar，才需要 Docker。

官方链接：

- Supabase 控制台: https://app.supabase.com/
- Supabase CLI 文档: https://supabase.com/docs/guides/cli/getting-started
- Supabase Edge Functions 文档: https://supabase.com/docs/guides/functions
- Supabase Edge Functions Secrets 文档: https://supabase.com/docs/guides/functions/secrets
- Supabase SQL Editor 文档: https://supabase.com/docs/guides/database/overview
- Supabase API Keys 文档: https://supabase.com/docs/guides/api/api-keys

## 2. 创建 Supabase 项目

1. 打开 https://app.supabase.com/
2. 登录后点击 `New project`
3. 选择 organization
4. 填项目名，比如 `tradinggoose-poc`
5. 设置数据库密码。这个密码要自己保存好
6. 选离你更近的区域
7. 点击创建，等几分钟

创建好后，你要记住这个项目的 `project ref`。

最简单的看法：

- 打开项目后，浏览器地址通常像这样：

```text
https://app.supabase.com/project/abcdefghijklmno
```

这里的 `abcdefghijklmno` 就是你的 `project ref`。

## 3. 拿到前端和函数要用的 Key

进入 Supabase 项目后：

1. 左下角点 `Settings`
2. 点 `API`

你会看到几项重要信息：

- `Project URL`
- `Publishable key`
- `service_role secret`

这三项分别用于：

- `Project URL`: 前端和函数都要用
- `Publishable key`: 只给前端用
- `service_role secret`: 只给服务端函数用，绝对不要放到前端

## 4. 跑数据库补丁

### 最推荐的新手做法：直接用 Dashboard 的 SQL Editor

你不用在超长 `schema.sql` 里找位置了，直接用我帮你抽出来的这个文件：

```text
E:\TradingGoose-PoC\app\supabase\research_poc_patch.sql
```

这份文件现在已经包含 PoC 需要的最小底座表和函数，适合直接在一个全新的 Supabase 项目里执行。

操作步骤：

1. 打开 Supabase Dashboard
2. 左侧点 `SQL Editor`
3. 点 `New query`
4. 打开本地文件 `E:\TradingGoose-PoC\app\supabase\research_poc_patch.sql`
5. 全选复制进去
6. 点击右上角 `Run`

如果你之前执行过老版本补丁并报错，也不用重建项目，直接重新打开同一个文件，把最新内容整段重新运行即可。

### 如何判断 SQL 跑成功了

跑完以后再执行下面这条检查 SQL：

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'conversations',
    'conversation_messages',
    'briefings',
    'research_runs',
    'citations'
  )
order by table_name;
```

如果返回了这 5 张表，说明数据库这一步就成功了。

## 5. 配前端环境变量

### 5.1 创建 `.env.local`

在项目根目录创建文件：

```text
E:\TradingGoose-PoC\app\.env.local
```

可以直接参考这个示例：

```text
E:\TradingGoose-PoC\app\.env.local.example
```

推荐先写成这样：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
VITE_ENABLE_PUBLIC_REGISTRATION=true
APP_ENV=development
```

解释一下：

- `VITE_SUPABASE_URL`: 就是刚才 `Project URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: 就是刚才的 `Publishable key`
- `VITE_ENABLE_PUBLIC_REGISTRATION=true`: 第一次跑最省事，先允许自己注册
- 后面如果你要改成内测邀请制，再把它改成 `false`

### 5.2 启动前端

在 PowerShell 里执行：

```powershell
cd E:\TradingGoose-PoC\app
npm install
npm run dev
```

启动后通常会看到一个本地地址，常见是：

```text
http://localhost:5173
```

## 6. 部署 Supabase Edge Functions

这一步我们只部署本 PoC 需要的 3 个函数：

- `settings-proxy`
- `chat-research`
- `generate-briefing`

### 6.1 登录 Supabase CLI

在 PowerShell 执行：

```powershell
cd E:\TradingGoose-PoC\app
npx supabase@latest login
```

它通常会让你在浏览器里完成授权。如果命令行提示你粘贴 access token，就按页面指引操作。

### 6.2 把本地项目绑定到你的 Supabase 项目

```powershell
npx supabase@latest link --project-ref 你的project_ref
```

例如：

```powershell
npx supabase@latest link --project-ref abcdefghijklmno
```

### 6.3 设置函数所需 Secrets

#### 先说最重要的结论

在 **云端托管的 Supabase Edge Functions** 里：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

通常是 **Supabase 默认就会提供** 的。

所以你手动必须设置的，重点是：

- `PERPLEFINA_API_URL`
- `MARKET_DATA_ADAPTER_URL`（可选）

如果你以后要在本地用 `supabase functions serve` 调试，再用我放好的示例文件：

```text
E:\TradingGoose-PoC\app\supabase\functions\.env.example
```

#### 云端部署最简单命令

如果你现在已经有可用的 Perplefina 服务地址，执行：

```powershell
npx supabase@latest secrets set PERPLEFINA_API_URL=https://你的-perplefina-地址
```

如果你已经有市场数据 sidecar，再执行：

```powershell
npx supabase@latest secrets set MARKET_DATA_ADAPTER_URL=https://你的-market-data-地址
```

如果你暂时没有 market-data sidecar，可以先不配这一项，系统会自动走降级路线。

#### 如果你想用本地文件一次性管理

你也可以先复制一份：

```text
E:\TradingGoose-PoC\app\supabase\functions\.env.example
```

另存为：

```text
E:\TradingGoose-PoC\app\supabase\functions\.env
```

然后填上真实值，再执行：

```powershell
npx supabase@latest secrets set --env-file .\supabase\functions\.env
```

注意：

- 这个 `.env` 文件不要提交到 Git
- `.gitignore` 我已经帮你加好了

### 6.4 部署 3 个函数

执行：

```powershell
npx supabase@latest functions deploy settings-proxy --no-verify-jwt
npx supabase@latest functions deploy chat-research --no-verify-jwt
npx supabase@latest functions deploy generate-briefing --no-verify-jwt
```

这 3 个函数要带 `--no-verify-jwt`。

否则最常见的现象就是：
- 前端登录明明成功了
- 但保存 Provider 或发起研究请求时会报 `Edge Function returned a non-2xx status code`
- 进一步看函数响应会是 `401 Invalid JWT`

这个 PoC 现在改成了“函数内部自己校验用户 token”，所以部署时要保持这个参数。

### 6.5 检查函数有没有部署成功

方法 1：

```powershell
npx supabase@latest functions list
```

方法 2：

去 Supabase Dashboard 左侧打开 `Edge Functions`，看这 3 个函数是否出现。

## 7. 第一次登录

### 最省事的第一次方式

因为我们在 `.env.local` 里先设置了：

```env
VITE_ENABLE_PUBLIC_REGISTRATION=true
```

所以你可以直接：

1. 打开本地前端
2. 点击 `Login`
3. 再点 `Create one`
4. 用邮箱和密码注册

### 如果注册时报错

去 Supabase Dashboard 检查：

1. 左侧点 `Authentication`
2. 检查 Email 登录是否启用
3. 如果要求邮箱验证，就去邮箱点确认链接

如果你不想走公开注册，也可以在 Supabase Dashboard 里手动创建测试用户，然后直接登录。

## 8. 保存一个可用的 Provider

登录后：

1. 进入页面顶部的 `Provider Settings`
2. 或直接打开：

```text
http://localhost:5173/settings
```

### 推荐你第一次这样填

如果你是 OpenAI 官方：

- `Nickname`: OpenAI Direct
- `Provider`: `openai`
- `Model`: `gpt-4o-mini`
- `Provider Type`: `direct`
- `API Key`: 你的 OpenAI key
- `Base URL`: 留空
- `Extra Headers JSON`: `{}`
- `OpenAI-compatible`: 关闭
- `Set as default`: 打开
- `Enabled`: 打开

### 如果你是国内中转 / 网关 / 代理

推荐第一次这样填：

- `Nickname`: Main Gateway
- `Provider`: `openai`
- `Model`: 你的网关支持的模型名，比如 `gpt-4o-mini`、`deepseek-chat`
- `Provider Type`: `openai-compatible`
- `API Key`: 你的中转 key
- `Base URL`: 你的网关基础地址，推荐填到 `/v1`
- `Extra Headers JSON`: `{}`
- `OpenAI-compatible`: 打开
- `Set as default`: 打开
- `Enabled`: 打开

举例：

```text
Base URL = https://your-gateway-domain.com/v1
```

一般不要手动写到 `/chat/completions`，虽然这个项目代码也兼容，但填到 `/v1` 最稳。

### 如果你的代理商要求额外 Header

把它写进 `Extra Headers JSON`，例如：

```json
{
  "X-Channel": "internal-poc",
  "X-Client": "tradinggoose"
}
```

格式要求非常严格：

- 必须是合法 JSON
- 外层必须是大括号
- 键和值都要用双引号

然后点击 `保存 Provider`。

## 9. 第一条真链路测试

### 9.1 测试研究问答

进入：

```text
http://localhost:5173/workspace
```

输入：

```text
你怎么看特斯拉？
```

如果链路正常，你应该能看到：

- 明确立场
- bull thesis
- bear thesis
- 风险点
- 情景分析
- 来源引用

### 9.2 测试简报

在 Workspace 里生成一个：

- `市场晨报`
或
- `公司一页纸简报`

如果成功，说明 `generate-briefing` 也通了。

## 10. 常见问题

### 10.1 `Provider 保存失败`

先检查这几项：

- API key 对不对
- `Base URL` 是否多写了路径
- `Extra Headers JSON` 是否是合法 JSON
- 你的代理商是否真的是 OpenAI-compatible

### 10.2 `chat-research` 报 500

最常见原因：

- `PERPLEFINA_API_URL` 没设置
- `PERPLEFINA_API_URL` 设置了，但地址不通
- Provider 虽然保存成功，但实际模型接口调用失败

### 10.3 页面能打开，但一直提示 Supabase configuration missing

说明你本地前端的 `.env.local` 没配好，重点检查：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

改完后重启 `npm run dev`。

### 10.4 没有 market-data sidecar 能不能先跑

可以。

当前这版 PoC 已经做了降级：

- 没有 `MARKET_DATA_ADAPTER_URL` 时
- 聊天和简报仍然可以走 `Perplefina + 来源引用`

所以它不是首个阻塞项。

## 11. 你现在最推荐的实际顺序

如果你就是想最快跑通，不要贪多，按下面做：

1. 建 Supabase 项目
2. 跑 `research_poc_patch.sql`
3. 配 `.env.local`
4. `npx supabase@latest login`
5. `npx supabase@latest link --project-ref ...`
6. 设置 `PERPLEFINA_API_URL`
7. 部署 3 个函数
8. `npm run dev`
9. 注册账号并登录
10. 在 `Provider Settings` 保存一个可用 provider
11. 在 Workspace 问 `你怎么看特斯拉？`

如果你卡在 `PERPLEFINA_API_URL` 这一步，下一条直接告诉我：

```text
我现在卡在 Perplefina，没有可用地址
```

我会接着把 `Perplefina` 的部署，也按 Windows 新手版一步一步带你做完。
