# JSON 配置合并轨迹 CLI 工具

追踪多层 JSON 配置的合并过程，清晰展示每个配置项的来源、被谁覆盖、怎么合并的。解决线上问题时"只知道最终值，不知道是谁覆盖的"痛点。

## ✨ 功能特性

- **三层合并**: 默认值 → 环境配置 → 租户配置，按优先级层层合并
- **覆盖链追踪**: 每个配置项完整记录从默认到最终的所有变更过程
- **智能数组合并**: 支持三种模式：替换(replace)、追加(concat)、去重追加(unique)
- **NULL 覆盖处理**: 显式的 null 值会覆盖之前所有非 null 值
- **大小写不敏感匹配**: 自动匹配不同大小写的键名，同时警告不一致用法
- **冲突报告**: 识别所有被覆盖的配置项并高亮显示
- **三种输出格式**:
  - 🖥️ 终端彩色摘要（方便快速查看）
  - 📄 JSON 机器可读（用于自动化处理）
  - 📝 Markdown 报告（方便分享给同事）

## 📦 安装

```bash
# 克隆或下载项目
cd config-merge-trace

# 安装依赖
npm install

# 全局链接（可选，方便全局使用）
npm link
```

系统要求: Node.js >= 14.0.0

## 🚀 快速开始

### 基本用法

```bash
# 基本命令
config-trace -d examples/default.json -e examples/env.json -t examples/tenant.json

# 或者使用完整参数
config-trace \
  --default examples/default.json \
  --env examples/env.json \
  --tenant examples/tenant.json \
  --output ./output
```

### 追踪特定键路径

当你只想知道某个配置项（如 database.host）的来源时：

```bash
config-trace -d default.json -e env.json -t tenant.json -k database.host
```

### 数组合并模式

```bash
# 替换模式（默认）- 新数组完全替换旧数组
config-trace -d default.json -e env.json -t tenant.json --array-merge replace

# 追加模式 - 新数组追加到旧数组后面
config-trace -d default.json -e env.json -t tenant.json --array-merge concat

# 去重追加 - 合并数组并去重
config-trace -d default.json -e env.json -t tenant.json --array-merge unique
```

### 大小写敏感模式

```bash
# 默认不敏感，Database 和 database 视为同一个键，同时警告不一致
config-trace -d default.json -e env.json -t tenant.json

# 开启大小写敏感
config-trace -d default.json -e env.json -t tenant.json --case-sensitive
```

### 输出格式控制

```bash
# 只输出终端摘要
config-trace -d default.json -e env.json -t tenant.json --format terminal

# 只生成 JSON 文件
config-trace -d default.json -e env.json -t tenant.json --format json

# 只生成 Markdown 报告
config-trace -d default.json -e env.json -t tenant.json --format markdown

# 全部输出（默认）
config-trace -d default.json -e env.json -t tenant.json --format all
```

### 其他选项

```bash
# 禁用彩色输出
config-trace -d default.json -e env.json -t tenant.json --no-color

# 静默模式（只输出错误）
config-trace -d default.json -e env.json -t tenant.json --silent

# 指定输出目录
config-trace -d default.json -e env.json -t tenant.json -o ./my-reports
```

## 📁 输入目录结构

推荐的项目配置文件结构：

```
your-project/
├── config/
│   ├── default.json          # 默认配置（所有环境通用）
│   ├── env/
│   │   ├── development.json  # 开发环境
│   │   ├── staging.json      # 预发环境
│   │   └── production.json   # 生产环境
│   └── tenants/
│       ├── acme.json         # ACME 租户
│       ├── beta.json         # Beta 租户
│       └── customer-x.json   # 其他租户
└── ...
```

### 环境文件格式支持

环境配置文件支持两种格式：

**1. JSON 格式（推荐）:**
```json
{
  "port": 8080,
  "database": {
    "host": "prod-db.example.com"
  }
}
```

**2. .env 格式:**
```env
PORT=8080
DATABASE_HOST=prod-db.example.com
DEBUG=true
```

> 注意：.env 文件格式仅支持扁平结构，嵌套对象需要用下划线分隔。

## 📖 命令行参数

| 参数 | 全称 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| `-d` | `--default` | ✅ | 默认配置文件路径 (JSON) | - |
| `-e` | `--env` | ✅ | 环境配置文件路径 (JSON 或 .env) | - |
| `-t` | `--tenant` | ✅ | 租户配置文件路径 (JSON) | - |
| `-o` | `--output` | ❌ | 输出目录 | `./output` |
| `-k` | `--key-path` | ❌ | 只追踪特定键路径 (如: database.host) | - |
| - | `--array-merge` | ❌ | 数组合并模式: replace\|concat\|unique | `replace` |
| - | `--case-sensitive` | ❌ | 键名大小写敏感 | `false` |
| - | `--no-color` | ❌ | 禁用彩色输出 | `false` |
| - | `--format` | ❌ | 输出格式: all\|terminal\|json\|markdown | `all` |
| - | `--silent` | ❌ | 静默模式，只输出错误 | `false` |
| `-v` | `--version` | ❌ | 显示版本号 | - |
| `-h` | `--help` | ❌ | 显示帮助信息 | - |

## ❌ 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 参数验证错误 |
| 2 | 文件不存在 |
| 3 | JSON 格式错误 |
| 4 | 环境文件格式错误 |
| 5 | 输出错误 |
| 6 | 键路径不存在 |

## ⚠️ 坏数据怎么处理？

### 1. JSON 格式错误

如果配置文件有语法错误：

```bash
$ config-trace -d bad.json -e env.json -t tenant.json
验证失败:
  - JSON解析错误 (bad.json): Unexpected token 'n' in JSON at position 20
```

**处理方式:**
- 检查 JSON 文件是否缺少逗号、引号、括号
- 使用 `jq . bad.json` 快速验证 JSON 格式
- 在线工具: https://jsonlint.com/

### 2. 文件不存在

```bash
$ config-trace -d nonexistent.json -e env.json -t tenant.json
验证失败:
  - 文件不存在: nonexistent.json
```

**处理方式:**
- 检查文件路径是否正确
- 确认文件是否被误删或移动

### 3. 键路径不存在

```bash
$ config-trace -d default.json -e env.json -t tenant.json -k non.existent.path
键路径验证失败:
  - 键路径不存在: non.existent.path
  - 相似的键: database.host, database.port
```

**处理方式:**
- 检查拼写是否正确
- 参考给出的相似键建议

### 4. 键名大小写不一致

当不同层级使用不同大小写的同一键名时（如 `Database` vs `database`）：

```
⚠️  键名大小写不一致警告
──────────────────────────────────────────────────────────────

  路径: Database
  统一小写: database
  使用情况:
    默认值: "database"
    租户配置: "Database"
```

**处理方式:**
- 统一各层级的键名大小写（推荐）
- 或使用 `--case-sensitive` 选项强制区分大小写

### 5. NULL 覆盖

当某层级显式设置 null 覆盖了有效值时：

```
⚠️  覆盖冲突详情
──────────────────────────────────────────────────────────────

  路径: apiKeys.stripe
  类型: NULL覆盖
  最终值: null
  来源: 租户配置
  覆盖链:
      默认值: "default_key"
      环境配置: "sk_live_env_12345"
   → 租户配置: null [最终]
```

**处理方式:**
- 确认 null 是否为预期行为
- 检查租户配置是否误设置了 null

## 📊 输出示例

### 终端输出

```
══════════════════════════════════════════════════════════════
                    JSON 配置合并轨迹报告
══════════════════════════════════════════════════════════════

📊 统计摘要
──────────────────────────────────────────────────────────────
  总配置项数: 15
  被覆盖项数: 8
  新增配置项: 2
  NULL覆盖数: 1
  冲突/告警数: 2

📁 各层级统计
──────────────────────────────────────────────────────────────
  默认值:
    定义键数: 12
    最终生效: 4
    覆盖其他: 0
  环境配置:
    定义键数: 7
    最终生效: 2
    覆盖其他: 5
  租户配置:
    定义键数: 9
    最终生效: 9
    覆盖其他: 3

🔍 指定键路径追踪: database.host
──────────────────────────────────────────────────────────────
  最终值: "tenant-db.acme.com"
  最终来源: 租户配置
  覆盖类型: 值覆盖
  说明: 新值覆盖旧值

  覆盖链:
     默认值: "localhost"
     环境配置: "prod-db.example.com"
   → 租户配置: "tenant-db.acme.com" [最终生效]

📄 输出文件:
  JSON: /path/to/output/config-trace-2024-01-15T10-30-00-000Z.json
  MARKDOWN: /path/to/output/config-trace-2024-01-15T10-30-00-000Z.md
```

### Markdown 报告

生成的 Markdown 报告包含：
- 统计摘要表格
- 各层级统计
- 指定键路径追踪（如果有）
- 覆盖冲突详情
- 键名大小写不一致警告
- 合并配置类型说明
- 最终合并配置（完整 JSON）

## 🧪 运行示例

```bash
# 运行完整示例
node examples/run-example.js

# 或者直接运行命令
node bin/config-trace.js \
  -d examples/default.json \
  -e examples/env.json \
  -t examples/tenant.json
```

## 🔧 开发

```bash
# 安装依赖
npm install

# 语法检查
npm run lint

# 运行测试示例
npm test
```

## 📄 许可证

MIT
