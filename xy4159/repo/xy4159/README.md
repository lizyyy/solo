# PR 评审证据夹

一个给开源维护者用的本地 VS Code 扩展 + 小服务，用于在 PR 评审过程中记录证据、标注问题、管理状态。

## 解决的问题

- 边看 diff 边在聊天里记疑点，最后忘了哪条评论对应哪段代码
- 无法跟踪评审意见的状态流转
- 没有统一的评审摘要导出方式

## 功能特性

- ✅ **评审卡片**: 在文件/选区上创建评审卡片，标注严重级别
- ✅ **代码位置**: 自动记录代码位置、上下文（前后2行）
- ✅ **去重检测**: 自动检测同一行的重复问题，避免重复报告
- ✅ **状态流转**: Open → In Progress → Resolved → Dismissed
- ✅ **附件支持**: 支持截图、粘贴日志片段作为附件
- ✅ **Diff 导入**: 支持按 PR 导入 Git diff
- ✅ **导出功能**: 导出 Markdown 评审摘要和 JSON 审计包
- ✅ **本地存储**: SQLite 本地存储，数据不离开你的电脑

## 项目结构

```
xy4159/
├── src/                    # VS Code 扩展代码
│   ├── extension.ts        # 扩展入口
│   ├── panelProvider.ts    # Webview 面板
│   ├── apiClient.ts        # API 客户端
│   └── types.ts            # 类型定义
├── server/                 # 本地服务
│   └── src/
│       ├── index.ts        # 服务入口
│       ├── database.ts     # SQLite 数据层
│       ├── routes.ts       # API 路由
│       ├── diffParser.ts   # Git diff 解析器
│       ├── exporter.ts     # 导出模块
│       └── diffParser.test.ts  # 测试
├── package.json            # 扩展配置
├── tsconfig.json           # TypeScript 配置
└── README.md               # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
# 安装扩展依赖
npm install

# 安装服务依赖
cd server
npm install
cd ..
```

### 2. 启动本地服务

```bash
cd server
npm run build
npm start
```

服务将在 `http://localhost:38765` 运行。

### 3. 编译 VS Code 扩展

```bash
# 在项目根目录
npm run compile
```

### 4. 在 VS Code 中加载扩展

1. 打开 VS Code
2. 按 `Cmd+Shift+P` 打开命令面板
3. 输入 `Developer: Open New Extension Development Host...`
4. 在新窗口中，扩展将自动加载

或者：

1. 按 `F5` 启动调试（需要 VS Code 打开项目根目录）

### 5. 测试服务是否可用

使用 curl 验证服务状态：

```bash
# 健康检查
curl http://localhost:38765/api/health

# 期望输出:
# {"status":"ok","timestamp":"..."}

# 获取所有 PR
curl http://localhost:38765/api/prs

# 创建一个 PR
curl -X POST http://localhost:38765/api/prs \
  -H "Content-Type: application/json" \
  -d '{"title":"Test PR #123","sourceBranch":"feature","targetBranch":"main"}'

# 创建评审卡片
curl -X POST http://localhost:38765/api/cards \
  -H "Content-Type: application/json" \
  -d '{
    "prId": "<your-pr-id>",
    "title": "空指针风险",
    "description": "这里缺少 null 检查",
    "severity": "high",
    "codeLocation": {
      "filePath": "src/main.ts",
      "startLine": 15,
      "endLine": 20,
      "lineContent": "const data = response.data;"
    }
  }'
```

## 使用说明

### 打开评审面板

- 点击左侧活动栏的 "📁 PR 评审证据夹" 图标
- 或按 `Cmd+Shift+P`，输入 "PR 评审证据夹: 打开面板"

### 创建评审卡片

1. 在编辑器中选中一段代码
2. 右键选择 "PR 评审证据夹: 创建评审卡片"
3. 按提示选择/创建 PR、选择严重级别、输入标题和描述
4. 卡片会自动关联选中的代码位置

### 导入 Git Diff

1. 按 `Cmd+Shift+P`
2. 输入 "PR 评审证据夹: 导入 Git Diff"
3. 输入 PR 标题
4. 粘贴 diff 内容（或从当前打开的 diff 文件读取）

### 导出评审摘要

1. 在评审面板中选择一个 PR
2. 点击 "导出 Markdown" 或 "导出 JSON"
3. 选择保存位置

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/prs` | 获取所有 PR |
| POST | `/api/prs` | 创建 PR |
| GET | `/api/prs/:id` | 获取单个 PR |
| DELETE | `/api/prs/:id` | 删除 PR |
| POST | `/api/prs/import-diff` | 导入 Git diff |
| GET | `/api/prs/:prId/cards` | 获取 PR 下的所有卡片 |
| POST | `/api/cards` | 创建卡片 |
| GET | `/api/cards/:id` | 获取单个卡片 |
| PATCH | `/api/cards/:id` | 更新卡片 |
| DELETE | `/api/cards/:id` | 删除卡片 |
| POST | `/api/cards/:id/locations` | 添加代码位置 |
| POST | `/api/cards/:id/attachments` | 添加附件 |
| GET | `/api/prs/:prId/export/markdown` | 导出 Markdown |
| GET | `/api/prs/:prId/export/json` | 导出 JSON |

## 严重级别 (Severity)

| 级别 | 颜色 | 描述 |
|------|------|------|
| Critical | 🔴 红色 | 阻塞性问题，必须修复 |
| High | 🟠 橙色 | 严重问题，建议修复 |
| Medium | 🟡 黄色 | 中等问题，应该修复 |
| Low | 🟢 绿色 | 轻微问题，建议改进 |

## 状态流转 (Status)

| 状态 | 颜色 | 描述 |
|------|------|------|
| Open | 🔵 蓝色 | 新报告的问题 |
| In Progress | 🟡 黄色 | 正在处理 |
| Resolved | 🟢 绿色 | 已修复 |
| Dismissed | ⚪ 灰色 | 已忽略/不修复 |

## 数据存储

数据存储在 `server/data/reviews.db` SQLite 数据库中，包含以下表：

- `pull_requests` - PR 列表
- `review_cards` - 评审卡片
- `code_locations` - 代码位置
- `attachments` - 附件（截图、日志等）
- `review_records` - 评审历史记录

## 开发模式

### 服务端热重载

```bash
cd server
npm run dev
```

### 扩展端监听模式

```bash
npm run watch
```

## 许可证

MIT
