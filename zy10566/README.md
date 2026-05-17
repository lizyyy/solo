# Cron 时区巡检工具

自动检测海外业务的 Cron 任务在夏令时切换时可能出现的时间异常问题。

## ✨ 功能特性

- **Cron 解析**: 支持标准 Cron 表达式解析
- **时区换算**: 在不同时区之间准确换算执行时间
- **夏令时检测**: 自动识别夏令时 (DST) 切换时间点
- **窗口展开**: 展开指定时间范围内的所有执行时间
- **多格式报告**: 终端摘要、JSON 机器可读格式、Markdown 分享报告
- **坏数据处理**: 保留原始位置和原因，不抛栈追踪

## 📦 安装

```bash
# 安装依赖
npm install

# 全局安装 CLI (可选)
npm link
```

## 🚀 快速开始

### 1. 生成示例数据

```bash
# 生成 CSV 格式示例
node src/cli.js example

# 生成 JSON 格式示例  
node src/cli.js example -f json -o examples/tasks.json
```

### 2. 运行巡检

```bash
# 使用 CSV 输入
node src/cli.js audit -i examples/tasks.csv

# 使用 JSON 输入
node src/cli.js audit -i examples/tasks.json

# 指定输出目录
node src/cli.js audit -i examples/tasks.csv -o my-reports

# 指定审计时间范围
node src/cli.js audit -i examples/tasks.csv -s 2024-01-01 -e 2024-12-31
```

### 3. 单个表达式检查

```bash
node src/cli.js check -c "0 2 * * *" -t "America/New_York"
```

### 4. 时区转换

```bash
# 将纽约时间的 Cron 转换为 UTC
node src/cli.js convert -c "0 2 * * *" -f "America/New_York" -t "UTC"
```

## 📋 输入格式

### CSV 格式

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| taskName | ✅ | 任务名称 | 每日数据备份 |
| cronExpression | ✅ | Cron 表达式 | 0 2 * * * |
| timezone | ✅ | IANA 时区 | America/New_York |
| service | - | 服务/模块名称 | infra |
| owner | - | 负责人/团队 | team-a |
| description | - | 任务描述 | 每日凌晨2点备份 |

### JSON 格式

```json
[
  {
    "taskName": "每日数据备份",
    "cronExpression": "0 2 * * *",
    "timezone": "America/New_York",
    "service": "infra",
    "owner": "team-a",
    "description": "每日凌晨2点备份数据库"
  }
]
```

### 常用时区

| 时区 | 说明 |
|------|------|
| UTC | 协调世界时 |
| America/New_York | 美国东部时间 |
| America/Los_Angeles | 美国太平洋时间 |
| Europe/London | 英国时间 |
| Europe/Paris | 欧洲中部时间 |
| Asia/Tokyo | 日本时间 |
| Asia/Shanghai | 中国标准时间 |
| Australia/Sydney | 澳大利亚东部时间 |

## 📊 输出说明

### 1. 终端摘要

运行后会在终端显示：
- 总体统计数据
- 坏数据记录（如有）
- 异常类型统计
- 异常任务清单（Top 10）
- 时区分布

### 2. JSON 报告

保存在 `reports/audit-result-{timestamp}.json`

包含完整的审计数据结构：
- summary: 统计摘要
- input: 输入文件信息和坏数据
- dstTransitions: 夏令时切换时间表
- results: 所有任务结果、异常详情

### 3. Markdown 报告

保存在 `reports/audit-report-{timestamp}.md`

适合分享给同事的易读格式：
- 美观的表格展示
- 异常任务完整详情
- 夏令时切换时间汇总
- 所有任务清单

## 🔍 检测的异常类型

| 异常类型 | 严重程度 | 说明 |
|----------|----------|------|
| hour-shift | 高 | 夏令时导致执行小时偏移 |
| missing-run | 严重 | 夏令时跳过时任务被跳过 |
| duplicate-run | 高 | 冬令时回拨任务重复执行 |

## 📁 项目结构

```
cron-timezone-audit/
├── src/
│   ├── cli.js          # CLI 入口
│   ├── core.js         # 核心逻辑模块
│   ├── auditor.js      # 审计编排器
│   ├── input.js        # 输入解析器
│   └── reporter.js     # 报告生成器
├── examples/           # 示例输入文件
├── reports/            # 输出报告目录
├── package.json
└── README.md
```

## ⚙️ CLI 命令参考

### audit - 运行时区巡检

```
Usage: cron-audit audit [options]

运行时区巡检

Options:
  -i, --input <path>        输入文件路径 (CSV或JSON) (required)
  -o, --output-dir <dir>    输出目录 (default: "reports")
  -s, --start-date <date>   审计开始日期 (ISO格式)
  -e, --end-date <date>     审计结束日期 (ISO格式)
  -w, --window-days <days>  DST前后检查天数 (default: "7")
  --no-color                禁用彩色输出
  -h, --help                display help for command
```

### check - 检查单个Cron表达式

```
Usage: cron-audit check [options]

检查单个Cron表达式

Options:
  -c, --cron <expression>   Cron表达式 (required)
  -t, --timezone <timezone> 时区 (required)
  -s, --start-date <date>   审计开始日期
  -e, --end-date <date>     审计结束日期
  -h, --help                display help for command
```

### convert - 转换时区

```
Usage: cron-audit convert [options]

转换Cron表达式时区

Options:
  -c, --cron <expression>   Cron表达式 (required)
  -f, --from <timezone>     源时区 (required)
  -t, --to <timezone>       目标时区 (required)
  -h, --help                display help for command
```

### example - 生成示例文件

```
Usage: cron-audit example [options]

生成示例输入文件

Options:
  -f, --format <type>   格式: csv 或 json (default: "csv")
  -o, --output <path>   输出路径 (default: "examples/tasks.csv")
  -h, --help            display help for command
```

## ❌ 错误处理

工具会优雅处理以下情况：
- 文件不存在：显示友好错误信息
- 格式错误：显示解析错误位置
- 无效 Cron：保留原始数据，标记错误原因
- 坏数据：记录行号、原因和原始内容

不会抛出冗长的堆栈跟踪，便于排查数据问题。

## 🛠 技术栈

- **Node.js** 16+
- **cron-parser**: Cron 表达式解析
- **luxon**: 日期时间和时区处理
- **commander**: CLI 框架
- **csv-parse**: CSV 解析
- **chalk**: 终端彩色输出
- **cli-table3**: 终端表格

## 📝 常见问题

### Q: 为什么我的 Cron 在夏令时切换时时间不对？

A: 当 Cron 使用本地时区时，夏令时切换会导致：
- 时钟向前拨时：跳过的小时内的任务不会执行
- 时钟向后拨时：重复的小时内的任务会执行两次

本工具会自动检测这些情况并报警。

### Q: 如何避免夏令时问题？

A: 最佳实践：
1. 重要任务使用 UTC 时区
2. 避免在 DST 切换时间点附近（2:00 AM）安排任务
3. 使用本工具定期巡检所有任务

### Q: 支持哪些 Cron 格式？

A: 支持标准 5 字段和 6 字段 Cron 格式：
```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    │
│    │    │    │    │    └ 星期 (0 - 7) (0或7为周日)
│    │    │    │    └───── 月份 (1 - 12)
│    │    │    └────────── 日期 (1 - 31)
│    │    └─────────────── 小时 (0 - 23)
│    └──────────────────── 分钟 (0 - 59)
└───────────────────────── 秒 (0 - 59, 可选)
```

## 📄 License

MIT
