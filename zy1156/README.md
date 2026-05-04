# LLM Context Evaluator (LLM 上下文评估台)

一个本地的 LLM 上下文评估平台，用于分析和优化 LLM 应用中的上下文窗口管理策略。

## 功能特性

### 📁 文件上传与处理
- 支持上传 `conversations.jsonl` 对话记录
- 支持上传 `docs.md` 参考文档
- 支持上传 `tool-results.json` 工具调用结果
- 支持上传 `budget.yaml` 预算约束配置
- 自动验证文件格式，提供详细错误信息

### 📊 上下文分析与裁剪
- 精确计算各部分 Token 数量
- 支持多种 Token 预算策略
- 智能优先级排序：预算约束 > 系统提示 > 最近消息 > 工具结果 > 文档 > 历史消息
- 可视化展示保留/丢失的内容

### 🔄 多策略对比
- 同时对比多种 Token 预算策略
- 可视化展示不同策略的保留率
- 详细对比各策略保留的内容类型

### 🚨 风险标记
- 自动检测高风险场景：
  - 系统提示被裁剪
  - 超过 50% 的内容丢失
  - 关键数据丢失
- 支持手动标记风险等级（低/中/高）
- 添加评估备注

### 📋 报告导出
- 导出 Markdown 格式报告
- 导出 JSON 格式报告
- 报告预览功能
- 包含完整的评估信息和统计数据

## 项目结构

```
zy1156/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   │   └── database.js    # 数据库配置
│   │   ├── models/            # 数据模型
│   │   │   ├── ContextPackage.js
│   │   │   ├── Evaluation.js
│   │   │   ├── Task.js
│   │   │   └── TokenStrategy.js
│   │   ├── routes/            # API 路由
│   │   │   ├── context.js     # 上下文相关 API
│   │   │   ├── evaluations.js # 评估相关 API
│   │   │   ├── reports.js     # 报告相关 API
│   │   │   ├── strategies.js  # 策略相关 API
│   │   │   └── tasks.js       # 任务相关 API
│   │   ├── services/          # 业务逻辑
│   │   │   ├── fileService.js # 文件处理服务
│   │   │   ├── reportService.js # 报告生成服务
│   │   │   └── tokenService.js # Token 计算服务
│   │   ├── scripts/           # 脚本
│   │   │   └── seed.js        # 数据种子脚本
│   │   ├── tests/             # 测试文件
│   │   │   ├── tokenService.test.js
│   │   │   ├── fileService.test.js
│   │   │   └── setup.js
│   │   └── index.js           # 入口文件
│   ├── package.json
│   └── jest.config.js
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── api/               # API 客户端
│   │   │   └── client.js
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.js   # 仪表盘
│   │   │   ├── FileUpload.js  # 文件上传
│   │   │   ├── EvaluationPage.js # 评估分析
│   │   │   ├── ComparisonPage.js # 方案对比
│   │   │   └── ReportPage.js  # 报告导出
│   │   ├── store/             # 状态管理
│   │   │   └── appStore.js    # Zustand store
│   │   └── App.js             # 应用入口
│   └── package.json
│
├── data/                       # 数据目录
│   ├── examples/              # 示例数据
│   │   ├── conversations.jsonl
│   │   ├── docs.md
│   │   ├── tool-results.json
│   │   └── budget.yaml
│   └── edge-cases/            # 异常样例
│       ├── invalid-jsonl.jsonl
│       ├── malformed-budget.yaml
│       ├── empty-tool-results.json
│       ├── huge-conversation.jsonl
│       └── missing-fields.jsonl
│
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 初始化数据

```bash
cd backend
npm run seed
```

这将：
1. 初始化数据库
2. 创建默认的 Token 预算策略
3. 插入示例任务和上下文数据
4. 运行示例评估

### 启动服务

```bash
# 启动后端服务 (端口 3001)
cd backend
npm run dev

# 启动前端开发服务器 (端口 3000)
cd ../frontend
npm start
```

访问 http://localhost:3000 即可使用应用。

## API 文档

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建新任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 上下文管理
- `POST /api/context/upload` - 上传上下文文件
- `POST /api/context/analyze` - 分析上下文 Token
- `GET /api/context/:id` - 获取上下文详情
- `DELETE /api/context/:id` - 删除上下文

### 策略管理
- `GET /api/strategies` - 获取所有策略
- `GET /api/strategies/default` - 获取默认策略
- `GET /api/strategies/:id` - 获取策略详情
- `POST /api/strategies` - 创建新策略
- `PUT /api/strategies/:id` - 更新策略
- `DELETE /api/strategies/:id` - 删除策略

### 评估管理
- `GET /api/evaluations` - 获取评估列表
- `POST /api/evaluations/run` - 运行评估
- `POST /api/evaluations/run/dry` - 试运行评估（不保存）
- `POST /api/evaluations/compare` - 多策略对比
- `GET /api/evaluations/:id` - 获取评估详情
- `PUT /api/evaluations/:id` - 更新评估（风险标记、备注）
- `DELETE /api/evaluations/:id` - 删除评估

### 报告管理
- `POST /api/reports/generate` - 生成报告
- `GET /api/reports/:id` - 获取报告详情
- `GET /api/reports/evaluation/:evaluationId` - 获取评估的所有报告
- `POST /api/reports/preview` - 预览报告

## 默认 Token 策略

| 策略名称 | 最大 Token | 描述 |
|---------|-----------|------|
| GPT-3.5 Turbo (4K) | 4,096 | 标准 4K 上下文窗口 |
| GPT-3.5 Turbo (16K) | 16,384 | 扩展 16K 上下文窗口 |
| GPT-4 (8K) | 8,192 | 标准 8K 上下文窗口 |
| GPT-4 Turbo (128K) | 131,072 | 大 128K 上下文窗口 |
| Strict Budget (2K) | 2,048 | 严格 2K 预算限制 |

## 优先级规则

默认优先级（从高到低）：
1. **预算约束** (100) - 必须保留的硬约束
2. **系统提示** (95-90) - 系统角色定义
3. **最近消息** (90-80) - 最新的对话消息
4. **用户消息** (85-80) - 用户的问题和指令
5. **工具结果** (75-70) - 工具调用返回的数据
6. **文档资料** (60-70) - 参考文档
7. **历史消息** (30-40) - 较早的对话消息

## 风险检测规则

### 高风险条件
- 系统提示消息被裁剪丢失
- 超过 50% 的 Token 被裁剪
- 关键数据（如订单信息、医疗记录）丢失

### 中风险条件
- 超过 30% 但小于 50% 的 Token 被裁剪

## 使用示例

### 1. 上传文件

在"上传文件"页面，选择或创建任务，然后上传：
- `conversations.jsonl` - 对话记录
- `docs.md` - 参考文档（可选）
- `tool-results.json` - 工具结果（可选）
- `budget.yaml` - 预算约束（可选）

示例数据位于 `data/examples/` 目录。

### 2. 运行评估

在"评估分析"页面：
1. 选择 Token 预算策略
2. 点击"模拟运行"查看预览
3. 点击"运行评估"保存结果
4. 在"风险标记"标签页标记风险等级和添加备注

### 3. 多策略对比

在"方案对比"页面：
1. 选择上下文包
2. 选择至少 2 个策略
3. 点击"开始对比"
4. 查看可视化对比结果

### 4. 导出报告

在"报告导出"页面：
1. 选择评估记录
2. 选择导出格式（Markdown/JSON）
3. 点击"预览报告"查看
4. 点击"下载报告"保存

## 测试

### 运行测试

```bash
cd backend
npm test
```

### 运行测试（监控模式）

```bash
npm run test:watch
```

### 测试覆盖范围

- **tokenService.test.js** - Token 计算和裁剪服务
- **fileService.test.js** - 文件解析和验证服务

## 异常样例

`data/edge-cases/` 目录包含各种异常情况的测试数据：

| 文件 | 描述 | 预期行为 |
|-----|------|---------|
| invalid-jsonl.jsonl | 包含无效 JSON 行 | 解析错误，显示具体行号 |
| malformed-budget.yaml | YAML 语法错误 | 解析错误，显示错误位置 |
| empty-tool-results.json | 空的 JSON 文件 | 验证失败，提示内容为空 |
| huge-conversation.jsonl | 超长对话 | 测试 Token 限制和裁剪 |
| missing-fields.jsonl | 缺少必要字段 | 验证失败，列出缺失字段 |

## 技术栈

### 后端
- **Node.js** - 运行时
- **Express** - Web 框架
- **SQL.js** - 嵌入式数据库
- **tiktoken** - Token 计算
- **js-yaml** - YAML 解析
- **multer** - 文件上传
- **Jest** - 测试框架

### 前端
- **React** - UI 框架
- **React Router** - 路由管理
- **Zustand** - 状态管理
- **Material-UI** - UI 组件库
- **Recharts** - 数据可视化
- **Axios** - HTTP 客户端
- **react-syntax-highlighter** - 代码高亮

## 数据格式

### conversations.jsonl
每行是一个 JSON 对象，表示一条消息：
```json
{"role": "system", "content": "系统提示", "timestamp": 1}
{"role": "user", "content": "用户消息", "timestamp": 2}
{"role": "assistant", "content": "助手回复", "timestamp": 3}
```

### budget.yaml
```yaml
maxTokens: 8192

priorityRules:
  budget: 100
  systemPrompt: 95
  recentMessages: 90
  userMessages: 85
  toolResults: 75
  docs: 60
  oldMessages: 30

riskThresholds:
  highRisk:
    lostSystemMessage: true
    lostRatio: 0.5
  mediumRisk:
    lostRatio: 0.3
```

## 许可证

MIT License
