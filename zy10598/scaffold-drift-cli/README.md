# scaffold-drift-cli

仓库脚手架漂移检测CLI工具 - 检测项目配置与标准模板的差异

## 功能特性

- ✅ **模板比对**: 将仓库文件与脚手架模板进行逐行比对
- ✅ **缺项定位**: 自动发现缺失的必需文件
- ✅ **配置差异**: 检测配置文件中的键缺失和值变化
- ✅ **修复预览**: 为每个问题生成详细的修复建议
- ✅ **报告导出**: 同时输出JSON和Markdown格式报告
- ✅ **证据保留**: 重复运行不会覆盖历史检测证据
- ✅ **多格式支持**: 支持JSON、YAML、.env等多种配置格式

## 安装

```bash
cd scaffold-drift-cli
npm install
npm run build
npm link
```

安装完成后，可以全局使用 `scaffold-drift` 命令。

## 快速开始

### 1. 初始化模板清单

在脚手架模板目录下运行:

```bash
cd /path/to/your/template
scaffold-drift init --name "your-scaffold" --version "1.0.0"
```

这会生成 `scaffold-manifest.json` 文件，配置需要检查的文件和配置项。

### 2. 检测漂移

```bash
scaffold-drift check \
  --repo /path/to/your/repo \
  --template /path/to/your/template
```

### 3. 查看报告

报告会保存在 `./drift-reports` 目录下，包含:
- `drift-report-<timestamp>.json`: 机器可读的完整数据
- `drift-report-<timestamp>.md`: 人类可读的Markdown摘要

## 命令详解

### check (默认命令)

检测仓库脚手架漂移

**选项:**

| 选项 | 简写 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--repo` | `-r` | ✅ | - | 仓库目录路径 |
| `--template` | `-t` | ✅ | - | 模板目录路径 |
| `--output` | `-o` | ❌ | `./drift-reports` | 报告输出目录 |
| `--format` | `-f` | ❌ | `both` | 输出格式: `json`\|`markdown`\|`both` |
| `--preview` | `-p` | ❌ | `true` | 是否生成修复预览 |
| `--detail` | `-d` | ❌ | `false` | 显示详细差异 (控制台) |

**示例:**

```bash
# 基本检测
scaffold-drift -r ./my-project -t ../scaffold-template

# 指定输出目录
scaffold-drift -r ./my-project -t ../scaffold-template -o ./reports

# 只输出JSON报告
scaffold-drift -r ./my-project -t ../scaffold-template -f json
```

### init

在当前目录初始化模板清单

**选项:**

| 选项 | 简写 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--name` | `-n` | ❌ | `custom-scaffold` | 模板名称 |
| `--template-version` | `-V` | ❌ | `1.0.0` | 模板版本 |

**示例:**

```bash
scaffold-drift init --name "react-scaffold" --template-version "2.1.0"
```

## 模板清单格式

`scaffold-manifest.json` 配置示例:

```json
{
  "name": "react-scaffold",
  "version": "2.1.0",
  "files": [
    {
      "path": "package.json",
      "required": true,
      "checkContent": false
    },
    {
      "path": ".gitignore",
      "required": true,
      "checkContent": true,
      "ignorePatterns": ["#*", ""]
    },
    {
      "path": "src/index.tsx",
      "required": true,
      "checkContent": true
    }
  ],
  "configs": [
    {
      "path": "tsconfig.json",
      "type": "json",
      "required": true,
      "keys": [
        "compilerOptions.target",
        "compilerOptions.module",
        "compilerOptions.strict"
      ]
    },
    {
      "path": ".env.example",
      "type": "env",
      "required": true,
      "keys": ["NODE_ENV", "API_URL"]
    }
  ]
}
```

### 字段说明

**files (文件检查配置):**
- `path`: 文件相对路径
- `required`: 是否为必需文件
- `checkContent`: 是否检查内容一致性
- `ignorePatterns`: 内容比对时忽略的行模式 (glob匹配)

**configs (配置文件检查配置):**
- `path`: 配置文件相对路径
- `type`: 配置文件类型 (`json` | `yaml` | `env` | `text`)
- `required`: 是否为必需文件
- `keys`: 需要检查的配置键路径 (使用lodash路径语法)

## 报告格式

### JSON报告

包含完整的检测数据，可用于CI/CD集成或进一步分析:

```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "repoPath": "/path/to/repo",
    "templatePath": "/path/to/template",
    "templateName": "react-scaffold",
    "templateVersion": "2.1.0",
    "runId": "run_1705309800_abc123"
  },
  "summary": {
    "totalFiles": 10,
    "totalConfigs": 5,
    "normalItems": 2,
    "riskItems": 8,
    "unknownItems": 1,
    "totalDrifts": 11,
    "criticalDrifts": 2,
    "highDrifts": 3,
    "mediumDrifts": 4,
    "lowDrifts": 2
  },
  "files": [...],
  "configs": [...],
  "drifts": [...],
  "repairPreview": [...]
}
```

### Markdown报告

面向人类的摘要报告，包含:
- 检测元数据
- 总体统计摘要
- 严重程度分布
- 风险项详情表格
- 无法处理项详情
- 正常项列表
- 修复预览
- 文件检查详情
- 配置检查详情

## 漂移类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `file_missing` | 必需文件缺失 | Critical / High |
| `config_missing_key` | 配置键缺失 | High |
| `content_diff` | 文件内容差异 | Medium |
| `config_value_diff` | 配置值不同 | Medium |
| `parse_error` | 文件解析失败 | Medium / Low |
| `permission_denied` | 权限不足无法读取 | Low |

## 返回码说明

| 返回码 | 说明 |
|--------|------|
| `0` | 检测成功，未发现任何漂移 |
| `1` | 检测成功，发现1个或多个漂移 |
| `2` | 检测失败（错误） |

**在CI中使用示例 (GitHub Actions):**

```yaml
name: Scaffold Drift Check
on: [push, pull_request]

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Checkout scaffold template
        uses: actions/checkout@v4
        with:
          repository: your-org/scaffold-template
          path: scaffold-template
      
      - name: Install drift CLI
        run: |
          git clone https://github.com/your-org/scaffold-drift-cli.git
          cd scaffold-drift-cli
          npm install && npm run build && npm link
      
      - name: Run drift check
        run: scaffold-drift -r . -t ../scaffold-template
        continue-on-error: true
        id: drift-check
      
      - name: Upload report artifacts
        uses: actions/upload-artifact@v4
        with:
          name: drift-reports
          path: drift-reports/
      
      - name: Fail if drift detected
        if: steps.drift-check.exit_code == 1
        run: exit 1
```

## 注意事项

1. **重复运行不覆盖**: 每次运行都会生成带时间戳的独立报告文件，不会覆盖历史证据
2. **路径处理**: 所有路径均支持相对路径和绝对路径，会自动转换为绝对路径
3. **编码**: 所有文件按UTF-8编码读取
4. **忽略模式**: `ignorePatterns` 使用glob匹配语法，支持通配符
5. **性能**: 文件数量较多时可能需要较长时间，建议在CI中使用缓存

## License

MIT
