# 缓存清理命令行工具

一个安全、可追溯、带完整报告的缓存清理工具，支持候选清单生成、参数验证拦截、失败项追踪等功能。

## 功能特性

### ✅ 核心功能
- **候选清单生成**：清理前先生成待处理文件清单，避免误伤
- **Dry-run 预览**：默认预览模式，确认无误后再执行真实清理
- **保护文件检测**：自动识别包含 `important`, `backup`, `production` 等关键词的文件
- **支持多种匹配模式**：可自定义文件匹配规则

### 🛡️ 安全机制
- **危险操作拦截**：禁止清理系统根目录 (`/`, `/root`, `/home` 等)
- **参数组合验证**：缺失必要参数时拦截操作，防止误操作
- **强制确认机制**：真实执行前需指定输出目录保存报告

### 📊 报告生成
- **完整执行报告** (Markdown)：包含处理前后对比、执行摘要、候选清单等
- **失败项单独保存** (JSON)：便于接手人员直接查看问题原因
- **边界处理结果**：记录受保护文件等特殊处理情况
- **审计日志**：追踪所有操作行为

### 🔍 边界处理
- 不存在目录自动记录失败项
- 空目录列表安全处理
- 受保护文件自动跳过并记录原因
- 输入背景关联到报告，便于追溯

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行自检
```bash
npm test
# 或
node src/cli.js --self-test
```

### 基本使用

#### 1. 预览模式（推荐）
```bash
# 清理指定目录的 .tmp 文件（仅预览，不实际删除）
node src/cli.js -d /path/to/cache -o ./output
```

#### 2. 带输入背景
```bash
# 使用网关错误摘录作为输入背景
node src/cli.js -d /path/to/cache -i data/gateway-error.txt -o ./output
```

#### 3. 真实执行清理
```bash
# 确认预览结果无误后，添加 --no-dry-run 执行真实删除
node src/cli.js -d /path/to/cache -o ./output --no-dry-run
```

#### 4. 强制执行（忽略保护文件）
```bash
# 注意：此操作会删除受保护文件，请谨慎使用
node src/cli.js -d /path/to/cache -o ./output --force
```

#### 5. 自定义匹配模式
```bash
# 只清理 .cache 和 .log 文件
node src/cli.js -d /path/to/cache -p "*.cache" "*.log" -o ./output
```

## 命令行选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-d, --cache-dirs <dirs...>` | 指定要清理的缓存目录（必选） | - |
| `-p, --patterns <patterns...>` | 文件匹配模式 | `["*.tmp", "*.cache"]` |
| `--no-dry-run` | 执行真实清理（默认仅预览） | false |
| `-f, --force` | 强制执行，忽略保护文件检测 | false |
| `-i, --input <file>` | 输入背景文件（网关错误摘录等） | - |
| `-o, --output <dir>` | 输出报告目录 | `./output` |
| `-b, --backup <dir>` | 备份目录（用于回滚） | - |
| `-r, --rollback` | 执行回滚操作 | false |
| `--self-test` | 运行自检脚本 | - |

## 输出文件说明

```
output/
├── clean-report-2026-05-15T23-37-59-786Z.md    # 完整执行报告
├── candidate-list-2026-05-15T23-37-59-784Z.json # 候选文件清单
├── failed-items-2026-05-15T23-37-59-XXX.json   # 失败项（如有）
├── boundary-results-2026-05-15T23-37-59-XXX.json # 边界处理结果
└── audit-log-2026-05-15T23-37-59-XXX.json       # 审计日志
```

## 报告内容详解

### 执行报告包含：
1. **基本信息**：执行时间、模式、耗时
2. **输入背景**：关联的网关错误或问题描述
3. **处理前后对比**：文件总数、总大小变化表格
4. **执行摘要**：候选数、已清理数、失败数、边界处理数
5. **候选清单**：详细文件列表及保护状态
6. **失败项详情**：失败原因和时间戳
7. **边界输入处理**：受保护文件等特殊处理记录
8. **参数验证说明**：如有拦截操作的原因说明
9. **下一步建议**：根据执行结果给出操作建议

## 使用示例

### 场景：网关故障后清理缓存
```bash
# 1. 先预览
node src/cli.js -d /var/cache/nginx /var/cache/api \
  -i data/gateway-error.txt \
  -o ./output

# 2. 检查报告确认无误
cat output/clean-report-*.md

# 3. 执行真实清理
node src/cli.js -d /var/cache/nginx /var/cache/api \
  -i data/gateway-error.txt \
  -o ./output \
  --no-dry-run
```

## 安全最佳实践

1. ✅ **始终先预览**：默认就是 dry-run 模式，先确认候选清单
2. ✅ **指定输出目录**：真实执行必须指定 `-o` 保存报告
3. ✅ **保留审计日志**：所有清理操作都会记录到审计日志
4. ✅ **慎用 --force**：仅在确认受保护文件可删除时使用
5. ✅ **关联输入背景**：添加 `-i` 关联问题工单，便于追溯

## 项目结构

```
.
├── src/
│   ├── cli.js              # 命令行入口
│   ├── cacheCleaner.js     # 核心清理模块
│   ├── paramValidator.js   # 参数验证与拦截
│   └── reportGenerator.js  # 报告生成模块
├── tests/
│   └── self-check.js       # 自检脚本
├── data/
│   └── gateway-error.txt   # 示例输入背景
├── output/                 # 报告输出目录
└── package.json
```

## 模块说明

### [cacheCleaner.js](file:///Users/lzy/pro/solo/workspaces/zy70477/src/cacheCleaner.js)
核心清理模块，负责：
- 递归扫描目录生成候选清单
- 保护文件检测与标记
- 执行清理或预览操作
- 失败项和边界结果记录
- 审计日志追踪

### [paramValidator.js](file:///Users/lzy/pro/solo/workspaces/zy70477/src/paramValidator.js)
参数验证模块，负责：
- 必填参数检查
- 参数组合验证（如真实执行需指定输出）
- 危险路径拦截
- 生成拦截原因说明和操作建议

### [reportGenerator.js](file:///Users/lzy/pro/solo/workspaces/zy70477/src/reportGenerator.js)
报告生成模块，负责：
- Markdown 完整报告生成
- 处理前后对比表格
- 各种 JSON 数据文件保存
- 控制台执行摘要输出

## 测试覆盖

自检脚本覆盖以下场景：
- ✅ 参数验证模块（危险路径拦截、组合验证）
- ✅ 缓存清理模块（候选生成、保护文件检测）
- ✅ 报告生成模块（表格生成、文件保存）
- ✅ 边界情况（空目录、不存在路径、空清单）

共计 **22** 项测试用例。

## 责任追溯

本工具设计支持团队协作和责任追溯：

1. **输入背景关联**：通过 `-i` 关联仓库交接单编号
2. **审计日志**：记录操作人、时间、文件路径
3. **完整报告**：所有决策依据保存在报告中
4. **失败项保留**：便于后续人员接手处理

示例中 `data/gateway-error.txt` 包含：
- 仓库交接单编号: `INFRA-2024-0115`
- 责任团队: `基础设施组`
- 关联工单: `OPS-12345`

## 许可证

MIT
