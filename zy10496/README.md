# 🤖 bot-filter - 访问日志爬虫过滤工具

一个工程化的命令行工具，用于从访问日志中识别、过滤和分析机器人流量，支持可配置规则和多种输出格式。

## ✨ 主要功能

- **多格式日志解析**: 支持 Nginx、Apache、Common、Combined 等标准日志格式
- **智能规则匹配**: 基于 User-Agent、IP、路径、状态码等多维度评分系统
- **三级分类**: 机器人流量、可疑流量、正常流量
- **完整报告**:
  - 终端彩色表格摘要
  - JSON 结构化数据
  - 美观的 HTML 报告（适合发给同事）
- **样本导出**: 每个分类保留样本记录，支持追溯到原文件行号
- **坏行处理**: 解析失败的日志行会被单独记录，不影响整体处理

## 🚀 快速开始

### 安装

```bash
npm install
```

### 基本用法

```bash
# 处理单个日志文件
node src/index.js -i /var/log/nginx/access.log

# 处理整个目录下的日志文件
node src/index.js -i /var/log/nginx/ -o ./my-output

# 使用自定义规则配置
node src/index.js -i access.log -c ./my-rules.json

# 指定日志格式
node src/index.js -i access.log -f apache

# 每个分类保留100个样本
node src/index.js -i access.log --sample-count 100
```

## 📖 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input <path>` | **必填** 输入日志文件或目录路径 | - |
| `-o, --output <path>` | 输出结果目录 | `./bot-filter-output` |
| `-c, --config <path>` | 自定义规则配置文件路径 | - |
| `-f, --format <format>` | 日志格式: nginx, apache, common, combined | `nginx` |
| `--sample-count <number>` | 每个分类保留的样本数量 | `50` |
| `--no-report` | 不生成 HTML 报告 | - |
| `--no-json` | 不输出 JSON 结果和样本 | - |
| `--verbose` | 显示详细处理信息 | - |
| `-h, --help` | 显示帮助信息 | - |
| `-V, --version` | 显示版本号 | - |

## 📂 输出目录结构

```
bot-filter-output/
├── report.html              # 美观的HTML分析报告（可直接发给同事）
├── report-summary.json      # 结构化摘要数据（供程序使用）
├── clean-access.log         # 净化后的日志（仅正常流量）
├── bot-access.log           # 被识别为机器人的日志
├── bad-lines.json           # 解析失败的日志行（如果有）
└── samples/
    ├── bot-samples.json     # 机器人流量样本（带评分和匹配规则）
    └── suspicious-samples.json  # 可疑流量样本
```

## 🔧 自定义规则配置

创建 `custom-rules.json` 文件来自定义过滤规则：

```json
{
  "rules": {
    "userAgents": {
      "knownBots": [
        "Googlebot",
        "Bingbot",
        "MyCustomBot"
      ]
    },
    "ips": {
      "knownBadIPs": [
        "192.168.1.100",
        "10.0.0.50"
      ]
    }
  },
  "scoring": {
    "botThreshold": 40,
    "suspiciousThreshold": 20
  }
}
```

### 评分机制说明

| 规则 | 分值 | 说明 |
|------|------|------|
| 已知机器人 UA | 100 | 匹配到已知爬虫UA |
| 空 UA | 50 | User-Agent 为空 |
| 扫描器路径 | 40 | 访问到典型扫描路径 |
| 高错误率 | 40 | 大量4xx/5xx响应 |
| 可疑 UA 模式 | 30 | UA包含bot/crawl等关键词 |
| 私有 IP | 10 | 来自内网IP地址 |
| 缺失请求头 | 15 | 缺少标准HTTP头 |

- **得分 ≥ 40**: 标记为机器人流量
- **得分 ≥ 20**: 标记为可疑流量
- **得分 < 20**: 标记为正常流量

## 💡 使用示例

### 示例1: 基础分析

```bash
node src/index.js -i /var/log/nginx/access.log -o ./report
```

输出示例:
```
🤖 访问日志爬虫过滤工具启动...

📂 输入路径: /var/log/nginx/access.log
📤 输出目录: /Users/xxx/report
📝 日志格式: nginx

   ✅ 已生成摘要报告: /Users/xxx/report/report-summary.json
   ✅ 已导出净化日志: /Users/xxx/report/clean-access.log
   ✅ 已导出机器人日志: /Users/xxx/report/bot-access.log
   ✅ 已生成HTML报告: /Users/xxx/report/report.html

✅ 处理完成!
📊 报告目录: /Users/xxx/report
```

### 示例2: 处理大量日志文件

```bash
# 处理整个目录，增加样本数量
node src/index.js -i ./logs/ -o ./analysis --sample-count 100
```

### 示例3: 在流水线中使用

```bash
# 只输出净化日志和JSON，不生成HTML
node src/index.js -i access.log --no-report
```

## ⚠️ 坏行处理说明

当日志文件中存在格式不正确的行时，工具会:

1. 继续处理其他正常行
2. 将坏行记录到 `bad-lines.json`
3. 在终端显示警告信息
4. 在HTML报告顶部显示黄色警告条

每条坏行记录包含:
- `file`: 源文件路径
- `lineNumber`: 行号
- `content`: 原始内容
- `reason`: 失败原因

你可以用这个文件来追溯和修复日志格式问题。

## 📊 报告内容

HTML报告包含以下信息:

1. **流量概览卡片**: 机器人/可疑/正常流量数量和占比
2. **热门机器人IP Top 10**: 哪些IP产生了最多的机器人请求
3. **匹配规则统计**: 哪些过滤规则被触发最多
4. **评分分布**: 所有请求的安全评分分布情况
5. **可疑 User-Agent Top 10**: 最常见的可疑UA
6. **可疑路径 Top 10**: 被扫描最多的路径

## 🔍 支持的日志格式

### Nginx 默认格式
```log
127.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.0" 200 1234 "http://referer.com" "Mozilla/5.0"
```

### Apache Combined 格式
```log
127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://www.example.com/start.html" "Mozilla/4.08 [en] (Win98; I)"
```

### Common 格式 (无 Referer 和 UA)
```log
127.0.0.1 - user [10/Oct/2000:13:55:36 -0700] "GET /page.html HTTP/1.1" 200 1234
```

## 🛠️ 常见问题

### Q: 如何添加自定义的爬虫UA？
A: 创建配置文件，在 `rules.userAgents.knownBots` 数组中添加即可。

### Q: 如何调整灵敏度？
A: 修改 `scoring.botThreshold` 和 `scoring.suspiciousThreshold`，值越高越严格。

### Q: 支持 gzip 压缩的日志吗？
A: 当前版本不支持，需要先解压。可以先用 `zcat access.log.gz > access.log` 解压。

### Q: 处理大文件会内存溢出吗？
A: 不会，使用流式读取，内存占用稳定。

## 📄 License

MIT
