# 网关访问日志限流命中归因 CLI

自动分析网关访问日志，按租户和接口聚合限流命中原因，并检测时钟漂移、网关重试、规则版本不一致等特殊情况。

## 功能特性

- ✅ **限流归因分析**：按租户和接口维度聚合限流命中记录
- 🔍 **规则匹配**：自动识别命中的限流规则和原因
- ⚠️ **异常检测**：
  - 时钟漂移（日志时间乱序）
  - 网关重试（同一请求多次记录）
  - 规则版本不一致（多版本规则同时生效）
- 📊 **多格式输出**：JSON、CSV、Markdown 报告

## 安装

```bash
npm install
chmod +x src/cli.js
```

## 使用方法

### 命令参数

```bash
node src/cli.js [选项]

选项:
  -i, --input <path>    输入日志文件路径（支持 .jsonl 或 .csv）【必需】
  -r, --rules <path>    限流规则文件路径（.json）【必需】
  -o, --output <dir>    输出目录路径【必需】
  --dry-run             试运行，不写入文件
  --overwrite           覆盖已存在的输出文件
  -V, --version         输出版本号
  -h, --help            显示帮助
```

## 完整命令链示例

### 1. 查看帮助

```bash
node src/cli.js --help
```

### 2. 试运行（正常路径）- 预览结果不写入文件

```bash
node src/cli.js \
  --input examples/normal-logs.jsonl \
  --rules examples/rules.json \
  --output output/normal \
  --dry-run
```

### 3. 正式运行（正常路径）- 写入输出文件

```bash
node src/cli.js \
  --input examples/normal-logs.jsonl \
  --rules examples/rules.json \
  --output output/normal \
  --overwrite
```

### 4. 试运行（特殊情况路径）- 检测时钟漂移和网关重试

```bash
node src/cli.js \
  --input examples/with-special-cases.jsonl \
  --rules examples/rules.json \
  --output output/special \
  --dry-run
```

### 5. 正式运行（特殊情况路径）

```bash
node src/cli.js \
  --input examples/with-special-cases.jsonl \
  --rules examples/rules.json \
  --output output/special \
  --overwrite
```

## 输入文件格式

### 日志文件格式（.jsonl）

```json
{
  "timestamp": "2024-01-15T10:00:00.000Z",
  "requestId": "req-001",
  "tenantId": "tenant-A",
  "apiPath": "/api/v1/users",
  "statusCode": 429,
  "responseHeaders": {
    "x-ratelimit-remaining": "0",
    "x-ratelimit-hit": "true"
  }
}
```

### 规则文件格式（.json）

```json
{
  "rateLimitRules": [
    {
      "id": "RL-001",
      "name": "租户API调用限额-每分钟",
      "version": "v1.2.0",
      "limitType": "tenant_per_minute",
      "threshold": 100
    }
  ]
}
```

## 输出文件说明

运行后输出目录包含以下文件：

| 文件名 | 格式 | 说明 |
|--------|------|------|
| `summary.json` | JSON | 处理概览汇总 |
| `SUMMARY.md` | Markdown | 人类可读的汇总报告 |
| `attribution.json` | JSON | 限流归因详情 |
| `attribution.csv` | CSV | 限流归因表格格式 |
| `ATTRIBUTION.md` | Markdown | 归因详情报告 |
| `special-cases.json` | JSON | 特殊情况检测结果 |
| `SPECIAL-CASES.md` | Markdown | 特殊情况报告 |
| `rate-limit-hits.json` | JSON | 限流命中日志明细 |
| `rate-limit-hits.csv` | CSV | 限流命中日志表格 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 运行正常路径测试
node src/cli.js -i examples/normal-logs.jsonl -r examples/rules.json -o output/test-normal --overwrite

# 3. 运行特殊情况测试
node src/cli.js -i examples/with-special-cases.jsonl -r examples/rules.json -o output/test-special --overwrite

# 4. 查看输出
cat output/test-normal/SUMMARY.md
cat output/test-special/SPECIAL-CASES.md
```

## 检测的特殊情况说明

### 时钟漂移（Clock Drift）

- **检测方式**：检查日志时间戳是否严格递增
- **阈值**：超过 5 秒判定为漂移，超过 60 秒为高严重程度
- **可能原因**：多机房时钟不同步、日志收集顺序异常

### 网关重试（Gateway Retry）

- **检测方式**：同一 requestId 出现多次，且时间间隔小于 1 秒
- **可能原因**：网关自动重试、客户端重复发送

### 规则版本不一致（Rule Version Mismatch）

- **检测方式**：
  - 日志中规则版本与配置文件版本不符
  - 同一规则 ID 出现多个不同版本
- **可能原因**：规则灰度发布中、多网关版本未同步
