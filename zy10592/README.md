# 接口耗时分位分析 CLI 工具

一个功能完整的命令行工具，用于分析访问日志中的接口耗时分布，按路径、租户和状态码计算分位数。

## 功能特性

- ✅ **日志解析**：支持 JSON 和 Nginx 格式日志，记录坏行位置和原因
- ✅ **路径聚合**：按【路径 + 租户 + 状态码】分组统计
- ✅ **分位计算**：支持自定义分位数（P50/P90/P95/P99 等）
- ✅ **异常样本**：保留慢请求和错误请求的样本信息
- ✅ **去重处理**：重复请求自动去重，并说明去重口径
- ✅ **多种输出**：终端摘要、机器可读 JSON、友好报告、CSV 样本

## 安装

```bash
npm install
```

## 使用方法

### 基本使用

```bash
npm start -- --input ./logs --output ./results
```

### 完整参数

```bash
node src/index.js \
  --input <日志目录> \
  --output <输出目录> \
  --percentiles <分位值,逗号分隔> \
  --slow-threshold <慢请求阈值ms> \
  --error-samples <每个分组保留的异常样本数> \
  --log-format <json|nginx>
```

### 参数说明

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--input` | `-i` | `./logs` | 日志文件所在目录 |
| `--output` | `-o` | `./results` | 分析结果输出目录 |
| `--percentiles` | `-p` | `50,90,95,99` | 要计算的分位值列表 |
| `--slow-threshold` | `-s` | `3000` | 慢请求阈值（毫秒） |
| `--error-samples` | `-e` | `10` | 每个分组保留的慢请求样本数 |
| `--log-format` | `-f` | `json` | 日志格式（json/nginx） |

### 示例

```bash
# 分析 ./logs 目录，输出到 ./results
npm start

# 自定义分位数和慢请求阈值
npm start -- -p 25,50,75,90,99,99.9 -s 5000

# 分析 Nginx 格式日志
npm start -- -f nginx
```

## 输出文件

每次运行会在输出目录下创建一个带时间戳的子目录，包含以下文件：

| 文件名 | 说明 |
|--------|------|
| `summary.txt` | 终端摘要，快速查看关键指标 |
| `results.json` | 机器可读的完整分析结果 |
| `report.md` | 可直接发给同事的友好 Markdown 报告 |
| `bad_lines.csv` | 坏行记录，包含文件名、行号和错误原因 |
| `slow_samples.csv` | 慢请求样本，包含原始位置信息 |

## 日志格式

### JSON 格式（推荐）

每行一个 JSON 对象，支持以下字段：

```json
{
  "path": "/api/users",
  "tenant": "tenant_001",
  "status": 200,
  "latency": 123,
  "request_id": "req_abc123",
  "timestamp": 1716000000000
}
```

字段别名支持：
- `path`: `url_path`, `endpoint`, `uri`
- `tenant`: `tenant_id`, `org`, `org_id`
- `status`: `status_code`, `http_status`
- `latency`: `duration`, `response_time`, `ms`
- `request_id`: `req_id`, `trace_id`
- `timestamp`: `time`, `ts`

## 去重口径

1. 优先使用 `request_id` 作为唯一标识
2. 无 `request_id` 时，使用【路径 + 租户 + 秒级时间戳 + 耗时】作为近似标识
3. 仍无法匹配时，按原始行号保留，不进行去重
4. 重复请求保留首次出现的记录，其他记录计入 `duplicateSources`

## 项目结构

```
latency-percentile-cli/
├── src/
│   ├── index.js          # 入口文件和 CLI 解析
│   ├── parser.js         # 日志解析模块
│   ├── aggregator.js     # 聚合和去重模块
│   ├── percentile.js     # 分位计算模块
│   ├── reporter.js       # 报告生成模块
│   └── output.js         # 输出目录管理
├── logs/                 # 示例日志目录
├── results/              # 分析结果目录
├── package.json
└── README.md
```
