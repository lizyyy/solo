# 服务目录孤儿检测 CLI

一个功能完整的命令行工具，用于检测服务目录中已下线或失效的"孤儿"服务，帮助团队清理技术债务。

## ✨ 功能特性

- **参数解析与输入校验**：完整的命令行参数支持和输入验证
- **多格式数据读取**：支持 YAML、JSON、CSV 格式的服务目录文件
- **仓库存活探测**：自动检测 Git 仓库是否存在、是否归档、最后提交时间
- **告警规则检查**：扫描告警规则中是否有对服务的引用
- **负责人归并统计**：按负责人聚合孤儿服务统计
- **多格式报告输出**：
  - 终端摘要表格（彩色输出）
  - JSON 格式完整报告（机器可读）
  - Markdown 格式详细报告（适合发给同事）
  - CSV 格式数据导出
- **错误追溯**：坏行或异常样本可追溯到原文件位置和行号
- **可配置**：支持通过配置文件自定义检测标准
- **幂等运行**：重复运行不会污染已有输出（需使用 --force 覆盖）

## 📦 安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# （可选）全局链接
npm link
```

## 🚀 快速开始

### 基本用法

```bash
# 使用默认配置运行
npm start -- --input-dir ./data --output-dir ./reports

# 或使用 ts-node 直接运行
npm run dev -- --input-dir ./data --output-dir ./reports
```

### 常用命令

```bash
# 显示帮助信息
service-orphan --help

# 指定输入和输出目录
service-orphan -i ./services -o ./output

# 使用配置文件
service-orphan --config-file ./config.yaml

# 只生成 JSON 和 Markdown 格式
service-orphan --format json markdown

# 跳过仓库探测
service-orphan --skip-repo-check

# 跳过告警检查
service-orphan --skip-alert-check

# 强制覆盖已有报告
service-orphan --force

# 显示详细日志
service-orphan --verbose
```

## ⚙️ 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--input-dir` | `-i` | 服务目录数据输入路径 | `./data` |
| `--output-dir` | `-o` | 报告输出目录路径 | `./reports` |
| `--config-file` | `-c` | 配置文件路径 (YAML/JSON) | - |
| `--format` | `-f` | 输出格式: json, markdown, csv, all | `all` |
| `--force` | | 覆盖已存在的输出文件 | `false` |
| `--verbose` | | 显示详细日志 | `false` |
| `--skip-repo-check` | | 跳过仓库可用性检查 | `false` |
| `--skip-alert-check` | | 跳过告警引用检查 | `false` |
| `--repo-timeout` | | 仓库探测超时时间(毫秒) | `10000` |
| `--github-token` | | GitHub API 访问令牌(可选) | - |
| `--version` | `-v` | 输出版本号 | - |
| `--help` | `-h` | 显示帮助信息 | - |

## 📋 配置文件

可以使用配置文件来自定义检测标准。复制 `config.example.yaml` 为 `config.yaml` 并根据需要修改：

```yaml
# 服务目录文件匹配模式
serviceDirectories:
  - "services.yaml"
  - "services.json"
  - "**/*.yaml"

# 告警规则文件匹配模式
alertRulePaths:
  - "alerts/**/*.yaml"

# 仓库探测配置
repoProbe:
  enabled: true
  timeout: 10000
  githubApiBase: "https://api.github.com"

# 孤儿服务判定标准
orphanCriteria:
  repoArchived: true           # 仓库已归档判定为孤儿
  noCommitSinceDays: 180       # 超过180天无提交判定为孤儿
  noAlertReferences: true      # 无告警规则引用判定为孤儿
  inactiveStatus: true         # 状态为 deprecated 判定为孤儿

# 输出配置
output:
  formats:
    - json
    - markdown
    - csv
  timestampPrefix: false
```

## 📁 输入数据格式

### YAML 格式示例

```yaml
services:
  - id: user-service
    name: 用户服务
    repoUrl: https://github.com/example/user-service
    owners:
      - 张三
      - 李四
    alertRules:
      - high_cpu_usage
    status: active
    lastUpdated: 2024-01-15
```

### JSON 格式示例

```json
{
  "services": [
    {
      "id": "user-service",
      "name": "用户服务",
      "repoUrl": "https://github.com/example/user-service",
      "owners": ["张三", "李四"],
      "alertRules": ["high_cpu_usage"],
      "status": "active",
      "lastUpdated": "2024-01-15"
    }
  ]
}
```

### CSV 格式示例

```csv
id,name,repoUrl,owners,alertRules,status,lastUpdated
user-service,用户服务,https://github.com/example/user-service,"张三,李四",high_cpu_usage,active,2024-01-15
```

## 📊 输出报告

运行后会在输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| `orphan-report.json` | 完整的 JSON 格式报告（机器可读） |
| `orphan-report.md` | Markdown 格式详细报告（适合分享） |
| `orphan-report.csv` | CSV 格式数据导出 |
| `errors.log` | 处理错误日志（如果有错误） |

## 🎯 孤儿服务判定标准

服务被判定为"孤儿"的条件（满足任意一条）：

1. **状态已废弃**：服务状态标记为 `deprecated` 或 `inactive`
2. **仓库不存在**：Git 仓库 URL 无法访问
3. **仓库已归档**：GitHub 仓库处于归档状态
4. **长期无提交**：超过配置天数（默认180天）无代码提交
5. **无告警引用**：告警规则中没有对该服务的任何引用

## 🔍 退出码

- `0`：执行成功，未发现孤儿服务
- `1`：执行成功，但有处理错误
- `2`：执行成功，发现了孤儿服务
- `>2`：程序执行出错

## 📝 项目结构

```
.
├── src/
│   ├── index.ts              # 程序入口
│   ├── types.ts              # 类型定义
│   ├── cli.ts                # 命令行参数解析
│   ├── config.ts             # 配置管理
│   ├── directory-reader.ts   # 服务目录读取
│   ├── repo-probe.ts         # 仓库存活探测
│   ├── alert-checker.ts      # 告警引用检查
│   ├── orphan-detector.ts    # 孤儿服务判定
│   └── report-generator.ts   # 报告生成
├── data/                     # 示例数据
├── package.json
├── tsconfig.json
├── config.example.yaml
└── README.md
```

## 🛠 开发

```bash
# 开发模式运行
npm run dev -- --input-dir ./data --output-dir ./reports

# 构建
npm run build

# 运行构建版本
npm start -- --input-dir ./data --output-dir ./reports
```

## 📄 License

MIT
