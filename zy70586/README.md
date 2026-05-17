# Feature Flag 死分支扫描 CLI 工具

> 功能开关下线后，代码里还残留不会再走到的分支？这个工具帮你自动扫描和清理。

## ✨ 功能特性

- 🕵️ **代码扫描**: 自动扫描源码目录中的 Feature Flag 引用
- 🔄 **默认值合并**: 支持 JSON 和 CSV 格式的开关清单
- 📊 **引用分类**: 按文件、开关名称分组统计引用次数
- 💀 **死分支检测**: 根据默认值识别可清理的死代码分支
- 📝 **多格式报告**: 输出终端摘要、JSON、Markdown、HTML 报告
- ⚠️ **异常样本保留**: 坏数据、语法错误保留原始位置和原因

## 📦 安装

```bash
# 克隆项目后安装依赖
npm install

# 构建 TypeScript
npm run build

# 链接到全局（可选）
npm link
```

## 🚀 快速开始

### 1. 准备 Feature Flag 清单

创建 `feature-flags.json` 文件：

```json
[
  {
    "name": "FEATURE_NEW_CHECKOUT",
    "defaultValue": true,
    "description": "新结账流程开关"
  },
  {
    "name": "FEATURE_DARK_MODE",
    "defaultValue": false,
    "description": "深色模式开关"
  }
]
```

也支持 CSV 格式：

```csv
name,defaultValue,description
FEATURE_NEW_CHECKOUT,true,新结账流程开关
FEATURE_DARK_MODE,false,深色模式开关
```

### 2. 运行扫描

```bash
ff-scan scan -s ./src -f feature-flags.json --html
```

## 📖 命令详解

### scan 命令

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-s, --source <dir>` | **必须** - 源码目录路径 | - |
| `-f, --flags <file>` | Feature Flag 清单文件 (JSON/CSV) | - |
| `-o, --output <dir>` | 报告输出目录 | `./reports` |
| `--patterns <patterns>` | 文件匹配模式 (分号分隔) | `**/*.js;**/*.ts;**/*.jsx;**/*.tsx;**/*.py;**/*.java;**/*.go` |
| `--exclude <patterns>` | 排除目录模式 (分号分隔) | `**/node_modules/**;**/dist/**;**/build/**` |
| `--html` | 生成 HTML 格式报告 | false |
| `--no-markdown` | 不生成 Markdown 格式报告 | false |

### init 命令

```bash
ff-scan init
```

显示初始化向导和配置示例。

## 📂 输入输出结构

### 输入目录结构示例

```
your-project/
├── src/
│   ├── checkout.ts
│   └── auth.ts
├── feature-flags.json      # 开关清单
└── package.json
```

### 输出报告结构

```
reports/
├── scan-result.json        # 机器可读的完整扫描结果
├── scan-report.md          # Markdown 格式报告 (适合发给同事)
└── scan-report.html        # HTML 格式报告 (可选)
```

## 📊 报告说明

### 终端摘要

扫描完成后会在终端显示：
- 扫描基本信息（目录、文件数、耗时）
- 开关统计（总数、含死分支开关数）
- 引用统计（总引用数、Top 5 文件）
- 死分支统计（按置信度分级）
- 异常样本（如有）

### JSON 结果

完整的结构化数据，包含：
- 所有扫描到的开关信息
- 代码引用的完整列表
- 检测到的死分支详情
- 异常样本和错误信息

### Markdown 报告

适合发送给团队成员的清理清单，包含：
- 扫描概览
- 高置信度死分支详情（带代码位置和清理建议）
- 中置信度待审核清单
- 异常样本记录
- 清理行动计划建议

### HTML 报告

美观的网页版报告，包含：
- 统计卡片可视化
- 死分支按置信度分组展示
- 代码片段高亮
- 异常样本警告提示

## 🎯 死分支检测逻辑

### 置信度分级

| 级别 | 说明 | 场景示例 |
|------|------|----------|
| **高 (High)** | 确定是死代码，可以安全删除 | `if (FLAG) { ... } else { ... }` 且 FLAG 默认值固定 |
| **中 (Medium)** | 很可能是死代码，建议人工审核 | 三元表达式、简单的条件判断 |
| **低 (Low)** | 需要进一步确认 | 复杂的组合条件、动态逻辑 |

### 支持的模式

- ✅ `if (FLAG) { ... } else { ... }`
- ✅ `FLAG ? a : b` 三元表达式
- ✅ `FLAG && expr` 短路表达式
- ✅ 简单的否定判断 `!FLAG`

## ⚠️ 异常样本处理

工具遇到以下情况时会记录为异常样本：
- 无法解析的 JSON/CSV 文件
- 无效的开关配置（缺少 name 或 defaultValue）
- 文件读取失败
- 其他扫描错误

每个异常样本都包含：
- 文件路径
- 行号（如有）
- 错误类型
- 原始内容片段

## 💡 使用建议

### 最佳实践

1. **先跑测试环境**: 在代码分支上先跑扫描，确认结果准确性
2. **高置信度优先清理**: 先处理高置信度的死分支，风险最低
3. **保留开关声明**: 清理死分支时保留开关本身的定义，避免影响其他地方
4. **运行自动化测试**: 清理后务必运行完整测试套件

### 常见问题

**Q: 扫描结果有很多误报怎么办？**
A: 工具是基于正则匹配的静态分析，误报在所难免。重点关注高置信度的结果，中低置信度作为参考。

**Q: 支持哪些编程语言？**
A: 默认支持 JS/TS/Python/Java/Go，通过 `--patterns` 参数可以自定义文件匹配规则。

**Q: 能自动修复代码吗？**
A: 目前只做检测和报告，自动修复需要慎重评估。后续版本可能考虑加入辅助修改功能。

## 📝 示例

使用项目自带的示例代码测试：

```bash
npm run build
node dist/cli.js scan -s ./examples/test-src -f ./examples/feature-flags.json --html
```

查看生成的报告：
- `reports/scan-result.json` - 完整数据
- `reports/scan-report.md` - Markdown 报告
- `reports/scan-report.html` - HTML 报告

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 License

MIT
