# SQLite Migration Manager API

一个专门为小团队设计的本地后端 API 服务，用于管理 SQLite 迁移脚本。

## 特性

- ✅ **项目管理** - 登记多个项目及其对应的 SQLite 数据库文件
- ✅ **迁移管理** - 导入迁移 SQL 文件，区分 up/down 脚本
- ✅ **版本控制** - 支持时间戳、语义化版本、数字版本等多种版本格式
- ✅ **依赖管理** - 自动按版本和依赖关系生成执行计划
- ✅ **Dry-Run 验证** - 在真正执行前，在临时副本中预演并检查问题
- ✅ **健康检查** - 检测破坏性操作、外键失效、索引缺失、数据约束冲突
- ✅ **详细报告** - 导出 Markdown、JSON、CSV 格式的迁移体检报告
- ✅ **执行历史** - 记录每一批 apply/rollback 的执行历史
- ✅ **清晰错误** - 不再只是返回 500，而是明确告诉你哪里错了

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式（带自动重载）
npm run dev

# 生产模式
npm start
```

服务默认运行在 `http://localhost:3000`

### 初始化种子数据（示例项目）

```bash
node src/seed/seedData.js
```

这将创建一个示例博客应用项目，包含 6 个示例迁移。

## 项目结构

```
zy1121/
├── src/
│   ├── app.js                    # Express 应用入口
│   ├── config/
│   │   └── database.js           # 数据库连接和表结构初始化
│   ├── models/
│   │   ├── project.js            # 项目模型
│   │   ├── migration.js          # 迁移模型
│   │   └── executionHistory.js   # 执行历史模型
│   ├── services/
│   │   ├── migrationParser.js    # 迁移解析器
│   │   ├── planGenerator.js      # 执行计划生成器
│   │   ├── dryRunChecker.js      # Dry-Run 检查器
│   │   ├── healthChecker.js      # 健康检查模块
│   │   └── executionService.js   # 执行服务（apply/rollback/export）
│   ├── routes/
│   │   ├── projects.js           # 项目管理路由
│   │   ├── migrations.js         # 迁移管理路由
│   │   └── execution.js          # 执行路由（plan/apply/rollback/check/export）
│   ├── middleware/
│   │   └── errorHandler.js       # 统一错误处理
│   └── seed/
│       └── seedData.js           # 种子数据（示例迁移）
├── tests/
│   └── unit/
│       ├── migrationParser.test.js
│       ├── planGenerator.test.js
│       ├── dryRunChecker.test.js
│       └── healthChecker.test.js
├── examples/
│   └── curl-examples.sh          # Curl 示例脚本
├── data/                         # 数据目录（自动创建）
├── temp/                         # 临时目录（自动创建）
├── .env                          # 环境变量
├── package.json
└── jest.config.js
```

## API 文档

### 健康检查

#### GET /health

检查服务状态。

```bash
curl http://localhost:3000/health
```

响应:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-05-04T...",
    "uptime": 123.45,
    "version": "1.0.0",
    "environment": "development"
  }
}
```

### 项目管理

#### GET /api/projects

列出所有项目。

#### POST /api/projects

创建新项目。

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "description": "我的应用项目",
    "db_path": "./data/my-app.db"
  }'
```

#### GET /api/projects/:id

获取项目详情，包括迁移摘要和最近执行历史。

#### PUT /api/projects/:id

更新项目信息。

#### DELETE /api/projects/:id

删除项目（级联删除相关迁移和执行历史）。

#### GET /api/projects/:id/migrations

列出项目的所有迁移及其状态。

#### GET /api/projects/:id/history

获取项目的执行历史。

---

### 迁移管理

#### GET /api/migrations/:projectId

列出项目的所有迁移。

#### POST /api/migrations/:projectId

创建单个迁移。

```bash
curl -X POST http://localhost:3000/api/migrations/{projectId} \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0001",
    "name": "create_users_table",
    "description": "创建用户表",
    "up_sql": "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);",
    "down_sql": "DROP TABLE IF EXISTS users;",
    "dependencies": []
  }'
```

#### PUT /api/migrations/:projectId/:migrationId

更新迁移（只能修改未应用的迁移）。

#### DELETE /api/migrations/:projectId/:migrationId

删除迁移（只能删除未应用的迁移）。

#### POST /api/migrations/:projectId/import

批量导入迁移。

```bash
curl -X POST http://localhost:3000/api/migrations/{projectId}/import \
  -H "Content-Type: application/json" \
  -d '{
    "migrations": [
      {
        "version": "0001",
        "name": "create_users",
        "up_sql": "CREATE TABLE users (id INTEGER PRIMARY KEY);",
        "down_sql": "DROP TABLE IF EXISTS users;"
      },
      {
        "version": "0002",
        "name": "create_posts",
        "up_sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER);",
        "down_sql": "DROP TABLE IF EXISTS posts;",
        "dependencies": ["0001"]
      }
    ]
  }'
```

#### POST /api/migrations/:projectId/parse

解析迁移文件内容，提取 up/down 部分并分析。

支持 `-- UP` 和 `-- DOWN` 标记分隔的 SQL 内容。

#### POST /api/migrations/:projectId/validate

验证项目的所有迁移，检查重复版本、缺失依赖、缺少 down 脚本等问题。

---

### 执行操作

#### POST /api/execution/:projectId/plan

生成执行计划。

**参数:**
- `direction` (query): `up` 或 `down`，默认 `up`
- `target_version` (query): 目标版本
- `steps` (query): 回滚步数（仅 direction=down 时）

```bash
# 生成 apply 计划
curl -X POST "http://localhost:3000/api/execution/{projectId}/plan?direction=up"

# 生成 rollback 计划（回滚 2 步）
curl -X POST "http://localhost:3000/api/execution/{projectId}/plan?direction=down&steps=2"

# 生成 rollback 计划（回滚到指定版本）
curl -X POST "http://localhost:3000/api/execution/{projectId}/plan?direction=down&target_version=0002"
```

#### POST /api/execution/:projectId/apply

应用迁移。

**注意:** 默认先执行 dry-run 验证，验证通过后才会真正执行。

**请求体:**
```json
{
  "target_version": "0003",  // 可选，目标版本
  "dry_run": true,           // 可选，默认 true（仅预演）
  "force": false             // 可选，是否强制执行（跳过 dry-run 检查失败）
}
```

**工作流程:**
1. 生成执行计划
2. **Dry-Run**: 在数据库临时副本中执行迁移
3. **健康检查**: 检查外键、索引、数据约束等问题
4. **执行确认**: dry_run=false 时才真正执行
5. **记录历史**: 记录执行历史和已应用的迁移

#### POST /api/execution/:projectId/rollback

回滚迁移。

**请求体:**
```json
{
  "target_version": "0002",  // 可选，目标版本
  "steps": 1,                 // 可选，回滚步数
  "dry_run": true,            // 可选，默认 true
  "force": false              // 可选
}
```

**注意:** 
- 回滚的迁移必须有 down 脚本
- 回滚顺序是版本倒序

#### GET /api/execution/:projectId/check

健康检查数据库和迁移。

检查内容:
- 外键约束是否启用
- 是否存在外键违规数据
- 表是否缺少主键
- 外键列是否缺少索引
- 迁移的重复版本、缺失依赖、缺少 down 脚本

```bash
curl http://localhost:3000/api/execution/{projectId}/check
```

#### GET /api/execution/:projectId/export

导出迁移体检报告。

**参数:**
- `format`: `json` (默认)、`markdown`、`csv`

```bash
# JSON 格式
curl http://localhost:3000/api/execution/{projectId}/export?format=json

# Markdown 格式（下载）
curl -O -J http://localhost:3000/api/execution/{projectId}/export?format=markdown

# CSV 格式（下载）
curl -O -J http://localhost:3000/api/execution/{projectId}/export?format=csv
```

#### GET /api/execution/:projectId/preview-export

预览报告内容（不下载）。

---

## 检测能力

### 迁移分析

检测类型 | 说明
---|---
重复版本 | 同一项目内相同版本号的迁移
缺失依赖 | 迁移依赖的版本不存在
无效依赖 | 依赖的版本号高于当前版本
混合版本格式 | 同时使用时间戳、semver、数字版本
缺少 down 脚本 | 迁移没有编写回滚 SQL

### 操作类型检测

操作类型 | 破坏性 | 风险等级 | 说明
---|---|---|---
CREATE TABLE | ❌ 否 | 低 | 创建新表
CREATE INDEX | ❌ 否 | 低 | 创建索引
ALTER TABLE ADD COLUMN | ❌ 否 | 低 | 添加新列
ALTER TABLE ADD NOT NULL | ❌ 否 | **高** | 添加 NOT NULL 约束（可能与现有数据冲突）
ALTER TABLE DROP COLUMN | ✅ 是 | 高 | 删除列（数据丢失）
ALTER TABLE DROP CONSTRAINT | ✅ 是 | 高 | 删除约束
ALTER TABLE RENAME | ✅ 是 | 高 | 重命名表/列
DROP TABLE | ✅ 是 | **严重** | 删除表（数据丢失）
DROP INDEX | ❌ 否 | 中 | 删除索引（可能影响性能）
DELETE / TRUNCATE | ✅ 是 | **严重** | 删除数据
UPDATE | ❌ 否 | 中 | 更新数据（注意影响范围）

### 数据库健康检查

检查项 | 严重程度 | 说明
---|---|---
外键约束未启用 | 高 | `PRAGMA foreign_keys = OFF`，外键不会被检查
外键违规数据 | 严重 | 存在违反外键约束的数据行
表缺少主键 | 中 | 表没有定义 PRIMARY KEY
可空外键 | 中 | 外键列允许 NULL（可能导致孤儿关系）
外键列缺少索引 | 低 | 大数据表的外键列可能需要索引加速 JOIN

### 数据兼容性检查

检查项 | 严重程度 | 说明
---|---|---
NOT NULL 与现有 NULL 冲突 | 严重 | 添加 NOT NULL 约束，但表中已存在 NULL 值
默认值未应用到现有行 | 中 | SQLite 不会将新默认值应用到已存在的行

---

## 版本格式支持

支持以下版本格式（自动识别）：

| 格式 | 示例 | 比较方式 |
|---|---|---|
| 时间戳 | `20240115123000` | 按数字大小比较 |
| 语义化版本 | `1.2.3`, `v2.0.0` | major.minor.patch |
| 数字版本 | `0001`, `0010`, `100` | 按数字大小比较 |
| 字符串 | `initial`, `alpha` | 按字典序比较 |

**依赖关系**: 
- 显式依赖：通过 `dependencies` 字段指定
- 隐式依赖：版本号较小的迁移自动被视为依赖

---

## 错误响应格式

所有错误都有统一的响应格式：

```json
{
  "success": false,
  "error": {
    "message": "错误描述",
    "code": "错误代码",
    "details": "详细信息（可选）"
  }
}
```

常见错误代码:

| HTTP 状态码 | 错误代码 | 说明 |
|---|---|---|
| 400 | BAD_REQUEST | 请求参数错误 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突（如重复的项目名/版本号） |
| 422 | VALIDATION_ERROR | 验证失败 |
| 422 | DRY_RUN_FAILED | Dry-Run 检查失败 |
| 422 | CIRCULAR_DEPENDENCY | 循环依赖 |
| 500 | INTERNAL_ERROR | 内部错误 |

---

## Curl 示例

运行示例脚本查看完整的 API 调用：

```bash
# 确保服务已启动
npm run dev

# 在另一个终端运行
bash examples/curl-examples.sh
```

---

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- tests/unit/migrationParser.test.js

# 生成覆盖率报告
npm test -- --coverage
```

---

## 典型工作流

### 1. 创建项目

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-new-project",
    "description": "新项目",
    "db_path": "./data/my-project.db"
  }'
```

### 2. 导入迁移

```bash
curl -X POST http://localhost:3000/api/migrations/{projectId}/import \
  -H "Content-Type: application/json" \
  -d '{
    "migrations": [
      {
        "version": "0001",
        "name": "create_users",
        "up_sql": "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE);",
        "down_sql": "DROP TABLE IF EXISTS users;",
        "description": "创建用户表"
      },
      {
        "version": "0002",
        "name": "create_orders",
        "up_sql": "CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id));",
        "down_sql": "DROP TABLE IF EXISTS orders;",
        "dependencies": ["0001"],
        "description": "创建订单表（依赖用户表）"
      }
    ]
  }'
```

### 3. 验证迁移

```bash
# 检查迁移的重复版本、缺失依赖等
curl -X POST http://localhost:3000/api/migrations/{projectId}/validate
```

### 4. 生成执行计划

```bash
curl -X POST "http://localhost:3000/api/execution/{projectId}/plan?direction=up"
```

### 5. Dry-Run（预演）

```bash
curl -X POST http://localhost:3000/api/execution/{projectId}/apply \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": true
  }'
```

**检查 dry-run 报告，特别注意:**
- 是否有 SQL 语法错误
- 是否有破坏性操作
- 是否有数据约束冲突
- 外键约束是否正常工作

### 6. 真正执行

```bash
curl -X POST http://localhost:3000/api/execution/{projectId}/apply \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": false
  }'
```

### 7. 查看执行历史

```bash
curl http://localhost:3000/api/projects/{projectId}/history
```

### 8. 导出报告

```bash
# 导出 Markdown 报告
curl -O -J "http://localhost:3000/api/execution/{projectId}/export?format=markdown"
```

### 9. 如需回滚

```bash
# 先预演回滚
curl -X POST http://localhost:3000/api/execution/{projectId}/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "steps": 1,
    "dry_run": true
  }'

# 确认无误后执行
curl -X POST http://localhost:3000/api/execution/{projectId}/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "steps": 1,
    "dry_run": false
  }'
```

---

## 配置

通过 `.env` 文件配置:

```env
PORT=3000
NODE_ENV=development
DB_PATH=./data/migration-manager.db
TEMP_DIR=./temp
```

---

## 安全提示

⚠️ **重要提醒:**

1. **这是一个本地服务** - 不要暴露到公网
2. **Dry-Run 默认开启** - 所有 apply/rollback 默认先预演验证
3. **破坏性操作会被标记** - DROP TABLE、DELETE 等操作会在报告中高亮显示
4. **外键强制检查** - 执行迁移时会自动启用 `PRAGMA foreign_keys = ON`
5. **事务回滚** - 单迁移内的所有语句在同一个事务中，失败则回滚

---

## License

MIT
