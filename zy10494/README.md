# 镜像晋级清单 CLI

一个专业的命令行工具，用于在镜像从 dev 晋级到 prod 前核对签名、扫描结果和部署记录。

## 功能特性

### 核心检查机制
- **签名校验**: 验证镜像是否已签名，签名指纹是否匹配
- **扫描门禁**: 根据漏洞等级设置门禁（critical / high / medium / all）
- **部署记录验证**: 检查源环境和目标环境的部署记录
- **阶段对比**: 对比 dev 和 prod 环境的记录一致性
- **缺项检查**: 识别缺失的数据项并给出明确提示

### 输出格式
- **终端摘要**: 美观的彩色表格输出，快速了解检查结果
- **机器可读 JSON**: 完整的结构化数据，适合自动化集成
- **Markdown 报告**: 适合发给同事或存档的专业报告

### 异常处理
- **错误追溯**: 坏行或异常样本可以追溯到原始文件位置（文件名+行号）
- **清晰错误提示**: 分级错误信息（CRITICAL / HIGH / WARNING）
- **参数校验**: 完善的输入参数验证

## 安装

```bash
# 安装依赖
npm install

# 可选：全局链接（方便直接使用 image-promotion 命令）
npm link
```

## 快速开始

### 基础用法
```bash
# 使用示例数据
node src/index.js -i examples/sample-images.csv

# 或全局安装后
image-promotion -i examples/sample-images.csv
```

### 常用选项
```bash
# 指定输出目录
image-promotion -i data.csv -o ./reports

# 设置扫描门禁（仅阻断 critical 漏洞）
image-promotion -i data.csv --scan-gate critical

# 严格模式：任何缺项都视为失败
image-promotion -i data.csv --strict

# 自定义环境阶段
image-promotion -i data.csv --from-env staging --to-env production

# 仅生成 JSON 输出
image-promotion -i data.csv --format json

# 详细模式
image-promotion -i data.csv --verbose
```

## 命令行参数

| 参数 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| `-i, --input <file>` | 输入数据文件路径（必需） | - | CSV, YAML, JSON |
| `-o, --output-dir <dir>` | 输出目录 | `./outputs` | - |
| `-f, --format <format>` | 输出格式 | `all` | `all`, `summary`, `json`, `markdown` |
| `--from-env <env>` | 源环境阶段 | `dev` | 任意字符串 |
| `--to-env <env>` | 目标环境阶段 | `prod` | 任意字符串 |
| `--scan-gate <threshold>` | 扫描门禁等级 | `critical` | `critical`, `high`, `medium`, `all` |
| `--strict` | 严格模式 | 关闭 | - |
| `--verbose` | 显示详细日志 | 关闭 | - |
| `-h, --help` | 显示帮助信息 | - | - |
| `-V, --version` | 显示版本号 | - | - |

## 输入数据格式

### CSV 格式
```csv
imageTag,environment,signed,signer,signatureFingerprint,scanned,critical,high,medium,low,deployed,deployedAt,cluster
myapp:v1.0.0,dev,true,ci-bot,abc123def456,true,0,2,5,12,true,2024-01-15T10:00:00Z,dev-cluster
myapp:v1.0.0,prod,true,ci-bot,abc123def456,true,0,2,5,12,true,2024-01-16T14:00:00Z,prod-cluster
```

### YAML 格式
```yaml
images:
  - imageTag: myapp:v1.0.0
    environment: dev
    signed: true
    signer: ci-bot
    signatureFingerprint: abc123def456
    scanned: true
    critical: 0
    high: 2
    medium: 5
    low: 12
    deployed: true
    deployedAt: 2024-01-15T10:00:00Z
    cluster: dev-cluster
```

### 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `imageTag` | 镜像标签 | 是 |
| `environment` | 环境阶段（dev/prod 等） | 是 |
| `signed` | 是否已签名 | 否 |
| `signer` | 签名者 | 否 |
| `signatureFingerprint` | 签名指纹 | 否 |
| `scanned` | 是否已进行安全扫描 | 否 |
| `critical` | Critical 级漏洞数量 | 否 |
| `high` | High 级漏洞数量 | 否 |
| `medium` | Medium 级漏洞数量 | 否 |
| `low` | Low 级漏洞数量 | 否 |
| `deployed` | 是否已部署 | 否 |
| `deployedAt` | 部署时间 | 否 |
| `cluster` | 集群名称 | 否 |

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 所有镜像均通过晋级检查 |
| 1 | 参数错误或文件读取错误 |
| 2 | 晋级检查未通过（有失败项） |

## 输出文件

运行命令后，输出目录会包含：

```
outputs/
├── promotion-report.json    # 机器可读的完整 JSON 报告
└── promotion-report.md      # 人类可读的 Markdown 报告
```

## 示例报告

### Markdown 报告内容
- 执行摘要（总镜像数、通过率、问题统计）
- 详细结果（每个镜像的检查项）
- 问题列表（带严重程度和来源位置）
- 缺项列表
- 数据来源追溯
- 附录（门禁说明、问题类型说明）

### JSON 报告结构
```json
{
  "metadata": {
    "generatedAt": "2024-01-20T...",
    "fromEnv": "dev",
    "toEnv": "prod",
    "scanGate": "critical",
    "strictMode": false
  },
  "summary": {
    "total": 5,
    "passed": 3,
    "failures": 2,
    "passRate": "60.00",
    "totalIssues": 8,
    "totalMissing": 3,
    "criticalIssues": 1,
    "highIssues": 2
  },
  "results": [...]
}
```

## 运行测试

```bash
# 运行完整测试套件
npm test

# 或直接运行
node tests/run-test.js
```

## 项目结构

```
.
├── src/
│   └── index.js              # CLI 入口文件
├── lib/
│   ├── cli-config.js         # 参数解析和配置
│   ├── data-processor.js     # 数据读取和解析
│   ├── validator.js          # 核心验证逻辑
│   ├── reporter.js           # 报告生成
│   └── error-handler.js      # 错误处理
├── examples/
│   ├── sample-images.csv     # 示例 CSV 数据
│   └── sample-images.yaml    # 示例 YAML 数据
├── tests/
│   └── run-test.js           # 测试脚本
├── outputs/                   # 报告输出目录
├── package.json
└── README.md
```

## 常见问题

### Q: 如何只检查签名不检查漏洞？
A: 使用 `--scan-gate all`，这会设置最宽松的门禁，不会因为漏洞而阻断。

### Q: 为什么有些镜像显示"缺少目标环境 prod 记录"？
A: 这意味着你的输入数据中只有该镜像的 dev 环境记录，没有 prod 环境的记录。请检查数据是否完整。

### Q: 如何集成到 CI/CD 流水线？
A: 使用 `--format json` 获取机器可读的结果，然后根据退出码判断是否通过（0 = 通过，1 = 参数错误，2 = 检查未通过）。

## 许可证

MIT
