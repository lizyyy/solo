# Release Plan CLI

小团队发版前准备工具 - 汇总变更、评估风险、生成回滚清单。

## 功能特性

- 📋 **智能解析** - 自动解析 CSV/JSON/SQL 等多种格式的输入数据
- 🔗 **关联分析** - 自动建立 Issue-Commit 关联关系
- ⚠️ **风险检测** - 自动检测破坏性变更、数据库迁移风险
- 📊 **影响评估** - 按模块负责人和受影响客户归类分析
- 🔄 **回滚准备** - 生成回滚核对清单，提示缺失回滚方案
- 📄 **多格式导出** - 支持 Markdown/HTML/JSON 三种格式导出
- 💾 **历史记录** - 本地保存配置和执行历史

## 安装

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd release-plan-cli

# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接（可选，方便全局使用）
npm link
```

## 快速开始

### 1. 初始化示例数据

```bash
release-plan init
```

这会在当前目录创建 `release-data` 文件夹，包含示例数据文件：

```
release-data/
├── commits.csv       # Git 提交记录
├── issues.csv        # Issue 列表
├── deploy-plan.json # 部署计划配置
└── migrations/     # 数据库迁移文件
    ├── 001_add_user_login_index.sql
    ├── 002_remove_deprecated_columns.sql
    └── 003_add_payment_order_extra.sql
```

### 2. 校验输入数据

```bash
release-plan validate
```

校验输入数据的完整性和格式，输出错误、警告和信息。

### 3. 生成发版计划

```bash
release-plan plan
```

汇总版本变更、风险评估和影响分析，输出详细的分析报告。

### 4. 生成回滚核对清单

```bash
release-plan rollback
```

检查回滚准备状态，生成回滚步骤核对清单。

### 5. 导出发版计划

```bash
release-plan export
```

默认导出所有格式到 `release-output` 目录：

- `release-plan-v1.2.0.json` - JSON 格式
- `release-plan-v1.2.0.md` - Markdown 格式
- `release-plan-v1.2.0.html` - HTML 格式
- `rollback-checklist-v1.2.0.json` - 回滚清单 JSON
- `rollback-checklist-v1.2.0.md` - 回滚清单 Markdown
- `rollback-checklist-v1.2.0.html` - 回滚清单 HTML

## 命令详解

### init

初始化示例数据目录和文件。

```bash
release-plan init [选项]

选项:
  -d, --data-dir <dir>  数据目录路径 (默认: ./release-data)
```

### validate

校验输入数据的完整性和格式。

```bash
release-plan validate [选项]

选项:
  -d, --data-dir <dir>   数据目录路径 (默认: ./release-data)
  --export               导出校验结果到文件
  -o, --output-dir <dir> 输出目录 (默认: ./release-output)
```

**校验内容：**

- **提交记录校验：ID 重复、必填字段缺失、破坏性变更描述
- **Issue 校验：** ID 重复、高优先级 Issue 回滚计划检查
- **部署计划校验：** 版本号、配置变更、回滚策略
- **数据库迁移校验：** 破坏性迁移回滚脚本检查
- **关联关系校验：** Issue-Commit 引用完整性
- **回滚准备校验：** 高优先级项回滚方案检查

### plan

汇总版本变更、风险评估和影响分析。

```bash
release-plan plan [选项]

选项:
  -d, --data-dir <dir>  数据目录路径 (默认: ./release-data)
  --skip-validation     跳过数据校验
```

**分析内容：**

- **破坏性变更检测** - 自动识别 Commit/Migration/Config 中的破坏性变更
- **风险评估** - 综合评估整体风险等级（critical/high/medium/low）
- **影响分析** - 受影响客户、模块、依赖服务、停机需求
- **负责人责任** - 按模块负责人分配变更责任
- **回滚准备** - 检查回滚方案完整性

### rollback

生成回滚核对清单。

```bash
release-plan rollback [选项]

选项:
  -d, --data-dir <dir>  数据目录路径 (默认: ./release-data)
```

**输出内容：**

- 整体回滚准备状态
- 缺失回滚计划的项列表及建议
- 分类型回滚核对清单（代码、数据库、配置、验证、通信）
- 每个高优先级 Issue 的回滚验证项

### export

导出发版计划到指定格式。

```bash
release-plan export [选项]

选项:
  -d, --data-dir <dir>   数据目录路径 (默认: ./release-data)
  -o, --output-dir <dir> 输出目录 (默认: ./release-output)
  --format <format>     导出格式: json, markdown, html (可多次使用，默认全部)
```

**示例：**

```bash
# 只导出 Markdown 格式
release-plan export --format markdown

# 导出 JSON 和 HTML
release-plan export --format json --format html
```

### config

查看或更新配置。

```bash
release-plan config [选项]

选项:
  --set <key=value>  设置配置项 (可多次使用)
  --reset             重置为默认配置
  --show            显示当前配置 (默认)
```

**示例：**

```bash
# 查看当前配置
release-plan config

# 设置数据目录
release-plan config --set dataDirectory=./my-data

# 重置配置
release-plan config --reset
```

### history

查看执行历史。

```bash
release-plan history [选项]

选项:
  -n, --limit <number>  显示最近的N条记录 (默认: 10)
  --clear              清空历史记录
```

## 数据格式说明

### commits.csv

| 字段 | 说明 | 示例
------|------|------
id | Commit ID | commit-1
hash | Git 提交哈希 | a1b2c3d
message | 提交信息 | feat(auth): 添加用户登录功能
author | 作者 | 张三
date | 提交日期 | 2026-05-01
module | 模块（可选，未指定会自动推断） | auth
related_issues | 关联的 Issue ID（逗号分隔或 #数字格式 | issue-1, issue-2
is_breaking | 是否破坏性变更（true/false） | false
breaking_description | 破坏性变更描述 | 修改了 API 响应格式

**提交信息中自动识别：**

- `BREAKING CHANGE:` 开头的行
- `#数字` 格式的 Issue 引用
- 模块名从前缀推断（如 `feat(auth):` → `auth` 模块）

### issues.csv

| 字段 | 说明 | 示例
------|------|------
id | Issue ID | issue-1
title | 标题 | 用户登录功能需求
description | 描述 | 实现用户登录认证功能
status | 状态 | in_progress
author | 创建者 | 产品经理
assignee | 负责人 | 张三
module | 模块 | auth
priority | 优先级 | high/medium/low
affected_customers | 受影响客户（逗号分隔） | 客户A, 客户B
related_commits | 关联的 Commit ID（逗号分隔） | commit-1, commit-4
has_rollback_plan | 是否有回滚计划 | true
rollback_plan | 回滚计划详情 | 1. 回滚到上一个版本
labels | 标签（逗号分隔） | feature, auth

### deploy-plan.json

```json
{
  "version": "1.2.0",
  "date": "2026-05-15",
  "environment": "production",
  "description": "本次发布包含...",
  "moduleOwners": {
    "auth": "张三",
    "payment": "李四"
  },
  "configChanges": [
    {
      "key": "auth.session.timeout",
      "oldValue": "3600",
      "newValue": "7200",
      "environment": "production",
      "description": "延长登录会话超时时间",
      "isRequired": true,
      "rollbackAction": "恢复为 3600"
    }
  ],
  "dependencies": [
    "user-service >= 2.0.0"
  ],
  "preDeploySteps": [
    "备份数据库"
  ],
  "postDeploySteps": [
    "执行数据库迁移"
  ],
  "rollbackStrategy": "1. 停止新服务实例..."
}
```

### migrations/ 目录

迁移文件支持 `.sql`、`.js`、`.ts`、`.py` 格式。

**迁移文件注释规范：**

```sql
-- Description: 为用户表添加登录时间索引
-- Module: auth
-- Depends On: 001_xxx.sql

-- 迁移内容
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_time);

-- Rollback:
-- DROP INDEX IF EXISTS idx_users_last_login;
```

**特殊注释：**

- `-- Description:` - 迁移描述
- `-- Module:` - 所属模块
- `-- Depends On:` - 依赖的其他迁移
- `-- Rollback:` - 回滚脚本
- `-- ⚠️ 破坏性变更：` - 标记破坏性迁移

**自动检测：**

- `DROP TABLE`、`ALTER TABLE ... DROP COLUMN`、`DELETE FROM` 会自动识别为破坏性变更
- 从 `-- Rollback:` 后的内容提取回滚脚本

## 使用场景示例

### 正常发版流程

```bash
# 1. 准备数据（首次使用）
release-plan init

# 2. 编辑数据文件（替换为实际数据）
# - 修改 commits.csv
# - 修改 issues.csv
# - 修改 deploy-plan.json
# - 添加 migrations/ 下的文件

# 3. 校验数据
release-plan validate

# 4. 查看发版计划
release-plan plan

# 5. 检查回滚准备
release-plan rollback

# 6. 导出所有文档
release-plan export
```

### 高风险发版场景

当检测到以下情况时，工具会高亮警告：

1. **破坏性数据库迁移**（如 DROP TABLE）
2. **高优先级 Issue 缺少回滚计划**
3. **必需配置项缺少回滚操作**
4. **API 接口变更**（BREAKING CHANGE 标记）

**示例输出：**

```
⚠️ 破坏性变更
  1. [MIGRATION] 修改用户表，移除废弃字段
     严重程度: CRITICAL
     影响区域: auth, database

❌ 缺失回滚计划
  • [ISSUE] 高优先级Issue "用户API重构" 缺少回滚计划
    建议: 请为该Issue补充回滚方案
```

### 异常数据场景测试

工具会检测并报告以下异常：

| 异常类型 | 严重程度 | 说明
---------|---------|------
破坏性迁移缺少回滚脚本 | Critical | 必须修复才能发版
高优先级 Issue 无回滚计划 | Warning | 建议补充
必需配置项无回滚操作 | Warning | 建议补充
重复的 Commit/Issue ID | Error | 数据错误
无效的引用关系 | Warning | 可能是数据不一致
空的提交记录 | Warning | 可能是空版本

## 配置说明

### 默认配置

```json
{
  "dataDirectory": "./release-data",
  "outputDirectory": "./release-output",
  "defaultEnvironment": "production",
  "moduleOwners": {},
  "customerList": []
}
```

### 配置文件位置

- **macOS/Linux:** `~/.release-plan-cli/config.json`
- **Windows:** `%USERPROFILE%\.release-plan-cli\config.json`

### 历史记录

历史记录保存在 `~/.release-plan-cli/history.json`，最多保留 100 条。

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --testPathPattern=data-parser
```

## 项目结构

```
release-plan-cli/
├── src/
│   ├── commands/           # 命令实现
│   │   ├── init.ts      # 初始化命令
│   │   ├── validate.ts  # 校验命令
│   │   ├── plan.ts      # 计划命令
│   │   ├── rollback.ts  # 回滚命令
│   │   └── export.ts    # 导出命令
│   ├── core/             # 核心模块
│   │   ├── data-parser.ts      # 数据解析
│   │   ├── data-validator.ts   # 数据校验
│   │   ├── plan-analyzer.ts    # 计划分析
│   │   ├── exporter.ts         # 导出器
│   │   └── config-manager.ts   # 配置管理
│   ├── types/            # 类型定义
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   ├── file-utils.ts     # 文件操作
│   │   └── output-utils.ts   # 输出格式化
│   └── index.ts         # CLI 入口
├── __tests__/           # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 开发模式（监听文件变化）
npm run dev

# 构建
npm run build

# 运行
node dist/index.js <command>
```

## License

MIT
