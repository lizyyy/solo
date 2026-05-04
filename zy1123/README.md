# Doc Sync Guard - 文档并发写安全助手

一个用于协调团队多人并发编辑 Markdown 文档和 JSON 配置文件的命令行工具，防止意外覆盖，智能合并冲突。

## 功能特性

- ✅ **Workspace 初始化** - 一键初始化文档工作区
- ✅ **版本快照** - 自动记录每次修改的完整快照和 revision
- ✅ **租约机制** - 写入前可申请带过期时间的写租约
- ✅ **版本校验** - 写入时自动做版本校验，防止覆盖
- ✅ **智能合并** - Markdown 按标题块三方合并，JSON 按 path 合并
- ✅ **冲突处理** - 无法自动合并时生成人工决策文件
- ✅ **并发模拟** - simulate 命令复现覆盖、可合并、冲突等场景
- ✅ **审计报告** - 导出每次写入、拒绝、合并、冲突的完整报告
- ✅ **HTTP API** - 轻量本地协调服务，支持程序化调用

## 快速开始

### 安装

```bash
npm install
```

### 基础使用流程

#### 1. 初始化 Workspace

在你的文档目录中初始化：

```bash
cd /path/to/your/docs
doc-guard init
```

或使用 npm 脚本：

```bash
node src/cli.js init
```

**选项说明：**
- `--force` - 强制重新初始化（会清除现有数据）
- `--lease-duration 300` - 默认租约时长（秒）
- `--max-lease 3600` - 最大租约时长（秒）
- `--no-auto-merge` - 禁用自动合并

#### 2. 查看状态

```bash
doc-guard status
```

#### 3. 写入文件

**方式一：直接写入（自动合并）**

```bash
doc-guard write docs/README.md --author "张三" --message "更新安装说明"
```

**方式二：使用租约（强一致性）**

```bash
# 1. 申请租约
doc-guard lease acquire docs/README.md --author "张三" --duration 300

# 2. 使用租约 ID 写入
doc-guard write docs/README.md --author "张三" --lease-id <lease-id>
```

**方式三：直接提供内容**

```bash
doc-guard write docs/new.md --author "李四" --content "# 新文档\n\n内容..."
```

---

## 核心命令详解

### 📁 Workspace 管理

#### `doc-guard init`

初始化文档工作区。

```bash
# 基础初始化
doc-guard init

# 带自定义配置
doc-guard init --lease-duration 600 --max-lease 7200

# 强制重新初始化（危险！会清除数据）
doc-guard init --force
```

#### `doc-guard status`

查看工作区状态。

```bash
doc-guard status
```

输出示例：
```
=== Workspace 状态 ===

ID: 550e8400-e29b-41d4-a716-446655440000
创建时间: 2026-05-04T10:00:00.000Z

--- 统计 ---
跟踪文件: 5 个
总修订数: 23 个
活跃租约: 1 个
待处理冲突: 0 个
```

### 📝 租约管理

租约机制防止多人同时写入同一文件造成覆盖。

#### `doc-guard lease acquire <file>`

申请写租约。

```bash
# 基础申请
doc-guard lease acquire docs/README.md --author "张三"

# 自定义时长
doc-guard lease acquire config/app.json --author "李四" --duration 600

# 绑定期望版本
doc-guard lease acquire docs/README.md --author "王五" --expected-revision <revision-id>
```

#### `doc-guard lease list`

列出所有租约。

```bash
# 所有租约
doc-guard lease list

# 只显示活跃租约
doc-guard lease list --active

# 只显示指定文件的租约
doc-guard lease list --file docs/README.md
```

#### `doc-guard lease show <lease-id>`

查看租约详情。

```bash
doc-guard lease show 550e8400-e29b-41d4-a716-446655440000
```

#### `doc-guard lease release <lease-id>`

释放租约。

```bash
# 释放（需验证作者）
doc-guard lease release <lease-id> --author "张三"

# 强制释放（无需作者验证）
doc-guard lease release <lease-id>
```

#### `doc-guard lease renew <lease-id>`

续租。

```bash
# 使用默认时长续租
doc-guard lease renew <lease-id>

# 自定义时长
doc-guard lease renew <lease-id> --duration 600
```

### 📄 文件写入与合并

#### `doc-guard write <file>`

写入文件，支持版本校验和自动合并。

**常用选项：**

| 选项 | 说明 | 示例 |
|------|------|------|
| `--author` | 作者名称 | `--author "张三"` |
| `--message` | 提交信息 | `--message "更新安装说明"` |
| `--lease-id` | 使用租约 | `--lease-id <id>` |
| `--expected-revision` | 期望版本 | `--expected-revision <id>` |
| `--no-auto-merge` | 禁用自动合并 | |
| `--content` | 直接提供内容 | `--content "# 标题"` |
| `--from-file` | 从文件读取 | `--from-file /tmp/new.md` |

**写入场景示例：**

1. **简单写入（自动合并）**
   ```bash
   doc-guard write docs/README.md --author "张三"
   ```

2. **使用租约写入**
   ```bash
   doc-guard write docs/README.md --author "张三" --lease-id <lease-id>
   ```

3. **直接提供内容**
   ```bash
   doc-guard write docs/new.md --author "李四" --content "# 新文档\n\n内容..."
   ```

4. **禁用自动合并**
   ```bash
   doc-guard write docs/README.md --author "王五" --no-auto-merge
   ```

### ⚔️ 冲突管理

当无法自动合并时，系统会生成冲突文件等待人工处理。

#### `doc-guard conflict list`

列出待处理的冲突。

```bash
# 所有冲突
doc-guard conflict list

# 指定文件的冲突
doc-guard conflict list --file docs/README.md
```

#### `doc-guard conflict show <conflict-id>`

查看冲突详情。

```bash
doc-guard conflict show <conflict-id>
```

输出包含：
- 冲突文件路径
- BASE/THEIRS/OURS 三个版本
- 详细的冲突位置
- 解决建议

#### `doc-guard conflict resolve <conflict-id>`

解决冲突。

```bash
# 接受 THEIR 版本（其他人的更改）
doc-guard conflict resolve <conflict-id> --choice theirs --author "张三"

# 接受 OUR 版本（你的更改）
doc-guard conflict resolve <conflict-id> --choice ours --author "张三"

# 手动解决（提供内容）
doc-guard conflict resolve <conflict-id> --choice manual --author "张三" --content "# 合并后的内容..."

# 手动解决（从文件读取）
doc-guard conflict resolve <conflict-id> --choice manual --author "张三" --from-file /tmp/resolved.md
```

### 🧪 并发模拟

使用 `simulate` 命令复现各种并发场景。

#### 可用场景

| 场景 | 说明 |
|------|------|
| `overwrite` | 模拟覆盖场景（租约阻止并发） |
| `clean_merge` | 模拟可自动合并场景 |
| `conflict` | 模拟必须人工处理的冲突 |
| `mixed` | 混合场景（默认） |

#### 运行模拟

```bash
# 基础模拟（混合场景，3个 worker）
doc-guard simulate

# 指定场景
doc-guard simulate --scenario conflict

# 自定义参数
doc-guard simulate \
  --scenario mixed \
  --workers 3 \
  --iterations 5 \
  --file-types md,json \
  --delay 100

# 输出报告到文件
doc-guard simulate --output ./simulation-report.md --format md
```

**模拟输出示例：**
```
=== 启动并发模拟 ===

场景: mixed
Worker 数量: 3
迭代次数: 5
文件类型: md, json
操作间隔: 100ms

✓ 模拟完成！

--- 统计 ---
总耗时: 5.2s
总写入尝试: 30
成功写入: 15
自动合并: 8
检测冲突: 5
租约/版本问题: 2
拒绝: 0
```

### 📊 审计与导出

#### `doc-guard audit log`

查看审计日志。

```bash
# 最近 50 条
doc-guard audit log

# 过滤操作类型
doc-guard audit log --action revision_create

# 自定义数量
doc-guard audit log --limit 100

# 详细输出
doc-guard audit log --verbose
```

#### `doc-guard audit export`

导出审计报告。

**支持格式：** `json`、`html`、`md`

```bash
# JSON 格式（默认）
doc-guard audit export --output ./audit-report.json

# HTML 格式
doc-guard audit export --format html --output ./audit-report.html

# Markdown 格式
doc-guard audit export --format md --output ./audit-report.md

# 时间范围过滤
doc-guard audit export --start "2026-05-01T00:00:00Z" --end "2026-05-04T23:59:59Z"

# 排除某些部分
doc-guard audit export --no-revisions --no-conflicts
```

**报告包含内容：**
- Workspace 信息
- 操作统计（按类型、作者、文件）
- 修订历史
- 冲突记录
- 租约记录
- 完整审计日志

### 📜 历史记录

#### `doc-guard history <file>`

查看文件修订历史。

```bash
# 默认显示最近 10 条
doc-guard history docs/README.md

# 自定义数量
doc-guard history docs/README.md --limit 20
```

---

## 🔧 HTTP API 服务

启动本地协调服务，支持程序化调用。

### 启动服务

```bash
# 使用默认端口 8765
npm run server

# 或指定端口
DOC_GUARD_PORT=9000 node src/server.js
```

### API 端点

#### 健康检查
```
GET /api/health
```

#### 初始化 Workspace
```
POST /api/init
Content-Type: application/json

{
  "force": false,
  "defaultLeaseDuration": 300,
  "maxLeaseDuration": 3600,
  "autoMergeEnabled": true
}
```

#### 获取状态
```
GET /api/status
```

#### 文件操作
```
GET  /api/files                    # 列出所有文件
GET  /api/files/:path              # 获取文件内容
POST /api/files/:path              # 写入文件
GET  /api/files/:path/history      # 获取文件历史
```

#### 租约操作
```
GET    /api/leases                 # 列出租约
POST   /api/leases                 # 申请租约
GET    /api/leases/:id             # 获取租约详情
POST   /api/leases/:id/release     # 释放租约
POST   /api/leases/:id/renew       # 续租
```

#### 冲突操作
```
GET  /api/conflicts                # 列出冲突
GET  /api/conflicts/:id            # 获取冲突详情
POST /api/conflicts/:id/resolve   # 解决冲突
```

#### 合并测试
```
POST /api/merge/test
Content-Type: application/json

{
  "base": "原始内容",
  "theirs": "其他人的修改",
  "ours": "你的修改",
  "filePath": "test.md"
}
```

#### 模拟运行
```
POST /api/simulate
Content-Type: application/json

{
  "scenario": "mixed",
  "workers": 3,
  "iterations": 5,
  "fileTypes": "md,json",
  "delay": 100
}
```

#### 审计导出
```
GET /api/audit/log?limit=50&action=revision_create
GET /api/audit/export?format=html
```

---

## 💡 使用场景示例

### 场景一：团队协作编辑文档

```bash
# 1. 项目负责人初始化
cd /project/docs
doc-guard init

# 2. 开发者 A 开始编辑
doc-guard lease acquire api.md --author "Developer-A"
# 编辑文件...
doc-guard write api.md --author "Developer-A" --lease-id <id>
doc-guard lease release <id> --author "Developer-A"

# 3. 开发者 B 尝试编辑同一文件（A 的租约还在）
doc-guard lease acquire api.md --author "Developer-B"
# 输出：File is locked by Developer-A until ...

# 4. 等 A 释放后，B 才能获取租约
```

### 场景二：自动合并不同章节

```bash
# 基础版本（已存在）
# docs/README.md
# 项目文档
## 安装指南
## 配置说明
## API 参考

# 开发者 A 修改 "安装指南" 章节
doc-guard write docs/README.md --author "Developer-A"

# 开发者 B 修改 "配置说明" 章节
doc-guard write docs/README.md --author "Developer-B"

# 结果：自动合并成功！两个不同章节的修改被合并
```

### 场景三：冲突检测与人工解决

```bash
# 基础版本
# config/app.json
# { "app": { "port": 3000, "host": "localhost" } }

# 开发者 A 修改 port 为 8080
doc-guard write config/app.json --author "Developer-A"

# 开发者 B 修改 port 为 9000
doc-guard write config/app.json --author "Developer-B"

# 结果：检测到冲突！
# 输出：
# ✗ 检测到冲突！
# 冲突数量: 1
#   1. json_path_conflict: app.port

# 查看冲突详情
doc-guard conflict show <conflict-id>

# 解决冲突（选择 A 的版本）
doc-guard conflict resolve <conflict-id> --choice theirs --author "管理员"
```

### 场景四：运行并发模拟

```bash
# 1. 初始化一个测试目录
mkdir -p /tmp/test-sim && cd /tmp/test-sim
doc-guard init

# 2. 运行覆盖场景（展示租约如何阻止并发）
doc-guard simulate --scenario overwrite --workers 3 --iterations 3

# 3. 运行冲突场景（展示如何检测冲突）
doc-guard simulate --scenario conflict --workers 3 --iterations 3

# 4. 查看生成的冲突
doc-guard conflict list

# 5. 导出审计报告
doc-guard audit export --format html --output ./report.html
```

---

## 📁 项目结构

```
doc-sync-guard/
├── src/
│   ├── cli.js                 # CLI 入口
│   ├── server.js              # HTTP API 服务
│   └── modules/
│       ├── workspace.js       # Workspace 管理（初始化、快照、revision）
│       ├── lease-manager.js   # 租约管理（申请、校验、释放、续租）
│       ├── merge-engine.js    # 合并引擎（Markdown 按块、JSON 按 path）
│       ├── write-coordinator.js # 写入协调器（合并、冲突处理）
│       ├── audit-exporter.js  # 审计报告导出
│       └── simulator.js       # 并发模拟器
├── __tests__/
│   ├── workspace.test.js
│   ├── lease-manager.test.js
│   └── merge-engine.test.js
├── package.json
├── jest.config.js
└── README.md
```

---

## 🧪 运行测试

```bash
# 运行所有测试
npm test

# 运行单个测试文件
npx jest __tests__/merge-engine.test.js

# 带覆盖率
npm test -- --coverage
```

---

## ⚠️ 常见问题

### Q: 租约过期了怎么办？

租约过期后，其他用户可以获取该文件的新租约。如果你需要继续编辑，只需重新申请租约即可。

### Q: 自动合并不安全，我想禁用怎么办？

有两种方式：
1. 初始化时禁用：`doc-guard init --no-auto-merge`
2. 单次写入禁用：`doc-guard write <file> --no-auto-merge`

### Q: 冲突文件存储在哪里？

冲突文件存储在 `.doc-guard/conflicts/` 目录下，每个冲突是一个 JSON 文件，包含 BASE/THEIRS/OURS 三个版本和详细的冲突信息。

### Q: 如何查看历史版本？

```bash
# 查看修订历史
doc-guard history <file>

# 通过 API 获取特定版本
GET /api/files/<path>?revisionId=<id>
```

---

## 📄 License

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
