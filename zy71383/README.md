# 配置漂移检查工具 (Config Drift Checker - CDC)

一个用于检测多环境配置漂移的命令行工具。解决开发、测试、生产环境之间的隐形配置差异问题。

## ✨ 核心特性

- **🔍 结构化比对**: 深度递归比对配置，支持 JSON、YAML、ENV 格式
- **🔒 敏感字段遮蔽**: 自动识别并遮蔽明文密钥、密码、Token
- **📖 差异解释**: 智能分析差异根因，提供可读的影响评估和处理建议
- **📜 变更历史**: 关联已知变更记录，区分预期变更和意外漂移
- **📊 报告导出**: 支持 JSON 和 Markdown 格式导出，便于分享和归档
- **🎯 误报识别**: 自动识别数组顺序不匹配等常见误报场景
- **⚠️ 默认值校验**: 检测配置值与默认值的偏差，区分允许/禁止变更

## 📦 安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# （可选）全局链接命令
npm link
```

## 🚀 快速开始

### 启动方式

```bash
# 使用 ts-node 直接运行（开发阶段）
npm run dev -- <command>

# 或先构建再运行
npm run build
npm start -- <command>

# 或全局链接后直接使用 cdc 命令
npm link
cdc <command>
```

### 样例入口：一键完整流程

我们在 `examples/` 目录下提供了完整的测试数据，故意包含以下问题：
- 🔴 **明文密钥**：testing 环境的数据库密码、Redis 密钥、JWT 私钥均为明文
- 🟡 **默认值变化**：cache.ttl 从 300 变为 600，app.debug 从 true 变为 false
- ⚪ **数组顺序误报**：security.allowedOrigins 元素相同但顺序不同
- 其他常见问题：类型不匹配、缺少配置项、额外配置项等

#### 完整测试流程（推荐按顺序执行）：

```bash
# 1. 导入所有样例数据（会检测到明文密钥并警告）
npm run dev -- import --dir examples --clear

# 2. 执行漂移检查（以 development 为基线，对比 testing 和 production）
npm run dev -- check --baseline development

# 3. 查询需要人工处理的项
npm run dev -- query --requires-review

# 4. 查询所有严重级别为 critical 的问题
npm run dev -- query --severity critical

# 5. 查看变更历史
npm run dev -- history

# 6. 导出报告（Markdown 格式，包含建议操作）
npm run dev -- export --format markdown --include-suggestions

# 7. 导出报告（JSON 格式，包含遮蔽后的值）
npm run dev -- export --format json --include-masked
```

### 会失败的操作

以下操作会**故意失败**，用于验证错误处理机制：

```bash
# 失败场景1: 导入不存在的文件
npm run dev -- import --config /path/that/does/not/exist.json --environment development

# 失败场景2: 执行检查但未导入任何配置
npm run dev -- clear -y
npm run dev -- check --baseline development

# 失败场景3: 使用不存在的环境作为基线
npm run dev -- import --config examples/development.json --environment development
npm run dev -- check --baseline nonexistent-env

# 失败场景4: 导出报告但未执行检查
npm run dev -- clear -y
npm run dev -- export --format markdown

# 失败场景5: 导入配置但未指定环境
npm run dev -- import --config examples/development.json
```

## 📖 命令详解

### `import` - 导入配置

导入配置文件、默认值或变更记录。

```bash
# 导入单个配置文件
cdc import --config examples/development.json --environment development

# 导入默认值配置
cdc import --defaults examples/defaults.json

# 导入变更记录
cdc import --changes examples/changes.json

# 批量导入目录下所有配置
cdc import --dir examples --pattern "**/*.json"

# 导入前清空现有数据
cdc import --dir examples --clear
```

### `check` - 执行漂移检查

对比基线环境与目标环境的配置差异。

```bash
# 以 development 为基线，对比所有其他环境
cdc check --baseline development

# 对比指定环境
cdc check --baseline development --target testing production

# 忽略数组顺序差异
cdc check --baseline development --ignore-array-order
```

### `query` - 查询差异结果

对上一次检查的结果进行筛选查询。

```bash
# 查询需要人工处理的项
cdc query --requires-review

# 按严重级别筛选
cdc query --severity critical

# 按环境筛选
cdc query --environment testing

# 按键名模式筛选（正则表达式）
cdc query --key "password|secret"

# 组合筛选
cdc query --environment testing --severity warning --requires-review
```

### `history` - 查看变更历史

查看已知的配置变更记录。

```bash
# 查看所有变更历史
cdc history

# 按配置项筛选
cdc history --key "featureFlags.newDashboard"

# 按环境筛选
cdc history --environment production
```

### `export` - 导出报告

将检查结果导出为文件。

```bash
# 导出为 Markdown 格式（默认）
cdc export

# 导出为 JSON 格式
cdc export --format json

# 指定输出路径
cdc export --output reports/my-report.md

# 包含建议操作
cdc export --include-suggestions

# 包含遮蔽后的配置值
cdc export --include-masked
```

### `list` - 列出已导入的环境

查看当前已导入的所有环境和配置信息。

```bash
cdc list
```

### `clear` - 清空数据

清空所有已导入的配置和数据。

```bash
cdc clear -y
```

## 🔧 检测能力说明

### 明文密钥检测模式

| 模式 | 描述 | 示例 |
|------|------|------|
| AWS Access Key | AKIA 开头的 20 字符密钥 | `AKIAIOSFODNN7EXAMPLE` |
| OpenAI API Key | sk- 开头的 48 字符密钥 | `sk-abc123...` |
| RSA/EC/PGP 私钥 | PEM 格式私钥 | `-----BEGIN RSA PRIVATE KEY-----` |
| 通用 Token | 32 位以上的随机字符串 | `a1b2c3d4e5f6...` |
| 敏感字段名 | password/secret/token/api_key 等 | `db_password: "plaintext"` |

### 差异类型说明

| 类型 | 严重级别 | 说明 |
|------|----------|------|
| `plaintext_secret` | critical | 检测到明文密钥 |
| `default_value_changed` | critical/info | 与默认值不一致（根据 mutable 字段决定严重度） |
| `value_mismatch` | warning | 配置值不匹配 |
| `missing_key` | warning | 目标环境缺少配置项 |
| `extra_key` | warning | 目标环境存在额外配置项 |
| `type_mismatch` | warning | 配置类型不匹配 |
| `array_order_mismatch` | false_positive | 数组顺序不同但元素相同（误报） |

### 人工处理标记

以下情况会标记为需要人工处理：
- 🔴 明文密钥检测
- 🔴 不可变更的默认值被修改
- 🟡 配置值不匹配（非已知变更）
- 🟡 缺少/额外配置项
- 🟡 类型不匹配

## 📊 报告示例

导出的 Markdown 报告包含以下内容：
- 基本信息（基线环境、目标环境、生成时间）
- 统计摘要（各严重级别数量、需人工处理数量）
- 需要人工处理的项列表
- 按环境分组的详细差异分析
- 每个差异的根因分析、影响评估、建议操作
- （可选）遮蔽后的完整配置内容

## 📁 项目结构

```
├── src/
│   ├── core/
│   │   ├── types.ts              # 类型定义
│   │   ├── store.ts              # 数据存储
│   │   ├── sensitiveMasker.ts    # 敏感字段遮蔽
│   │   ├── diffEngine.ts         # 比对引擎
│   │   ├── diffInterpreter.ts    # 差异解释
│   │   ├── driftChecker.ts       # 编排服务
│   │   └── reportExporter.ts     # 报告导出
│   ├── cli/
│   │   └── index.ts              # CLI 命令定义
│   └── index.ts                  # 入口文件
├── examples/                      # 样例数据
│   ├── development.json          # 基线环境（正确配置）
│   ├── testing.json              # 测试环境（含各种问题）
│   ├── production.json           # 生产环境
│   ├── defaults.json             # 默认值配置
│   └── changes.json              # 变更记录
├── data/                         # 运行时数据存储
├── reports/                      # 导出报告目录
├── package.json
├── tsconfig.json
└── README.md
```

## 🔗 核心代码引用

- 类型定义：[types.ts](file:///Users/lzy/pro/solo/workspaces/zy71383/src/core/types.ts)
- 比对引擎：[diffEngine.ts](file:///Users/lzy/pro/solo/workspaces/zy71383/src/core/diffEngine.ts#L20-L51)
- 敏感遮蔽：[sensitiveMasker.ts](file:///Users/lzy/pro/solo/workspaces/zy71383/src/core/sensitiveMasker.ts#L16-L20)
- 差异解释：[diffInterpreter.ts](file:///Users/lzy/pro/solo/workspaces/zy71383/src/core/diffInterpreter.ts#L53-L78)
- 报告导出：[reportExporter.ts](file:///Users/lzy/pro/solo/workspaces/zy71383/src/core/reportExporter.ts#L7-L30)
- CLI 入口：[cli/index.ts](file:///Users/lzy/pro/solo/workspaces/zy71383/src/cli/index.ts)

## 📝 使用建议

1. **首次使用**：从 `npm run dev -- import --dir examples --clear` 开始，体验完整流程
2. **日常检查**：建议在 CI/CD 流程中集成，每次部署前运行检查
3. **密钥安全**：定期导出报告，关注 critical 级别的明文密钥问题
4. **变更记录**：将已知的配置变更导入，减少误报
5. **人工审核**：每次检查后务必处理标记为 `requiresManualReview` 的项

## ❓ 常见问题

**Q: 数组顺序不同但元素相同会被识别为差异吗？**
A: 默认会识别为 `array_order_mismatch` 类型，但严重级别为 `false_positive`（误报），无需人工处理。也可以使用 `--ignore-array-order` 完全忽略。

**Q: 如何添加自定义的密钥检测模式？**
A: 在 `data/secrets.json` 中添加自定义模式，格式为 `[{"pattern": "regex", "placeholder": "***", "description": "..."}]`。

**Q: 如何标记某个配置变更为已知变更？**
A: 将变更记录添加到 `examples/changes.json` 并导入，比对时会自动关联，严重级别降为 info。
