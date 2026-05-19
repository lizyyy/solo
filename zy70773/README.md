# User-Agent 归类未知样本聚类排查 CLI

用于安全分析的 Nginx 访问日志 User-Agent 分类工具，支持按客户端、爬虫、未知风险分组，对未知样本进行聚类分析。

## 功能特性

- ✅ **UA 解析**: 基于 ua-parser 库的专业 UA 解析
- ✅ **规则匹配**: 内置分类规则，支持自定义 YAML 配置
- ✅ **未知样本聚类**: 基于特征哈希 + 字符串相似度的 UA 聚类
- ✅ **路径统计分析**: 自动路径签名提取和统计
- ✅ **IP 来源追踪**: 可疑 IP 识别和统计
- ✅ **报告生成**: JSON + CSV 格式，结果稳定可重复
- ✅ **坏行保留**: 解析失败的行保留原文件位置信息

## 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 添加执行权限
chmod +x ua_classifier.py
```

## 快速开始

### 1. 分析访问日志

```bash
# 基础分析
./ua_classifier.py analyze access.log

# 使用自定义规则
./ua_classifier.py analyze access.log -r ua_rules.yaml

# 指定报告ID（重复运行同一批材料结果稳定）
./ua_classifier.py analyze access.log --report-id 20240115_investigation

# 输出到指定目录
./ua_classifier.py analyze access.log -o ./my_reports

# 多个日志文件
./ua_classifier.py analyze access.log access.log.1 access.log.2
```

### 2. 查看 Top UA

```bash
# 查看所有 Top UA
./ua_classifier.py top access.log

# 只看爬虫分类
./ua_classifier.py top access.log -c crawler -n 30

# 显示完整 UA
./ua_classifier.py top access.log --show-ua
```

### 3. 解析单个 UA 字符串

```bash
./ua_classifier.py parse "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
```

### 4. 初始化配置文件

```bash
./ua_classifier.py init-config
```

### 5. 查看已生成的报告

```bash
./ua_classifier.py view reports/report_20240115_123456.json
```

## 分类说明

| 分类 | 说明 | 示例 |
|------|------|------|
| **client** | 正常客户端访问 | Chrome、Firefox、Safari、移动端APP |
| **crawler** | 爬虫/搜索引擎 | Googlebot、Bingbot、BaiduSpider |
| **risk** | 风险/可疑访问 | 扫描器、空UA、脚本工具 |
| **unknown** | 未知/待分析 | 无法匹配规则的UA |

## 报告文件说明

分析完成后在 `reports/` 目录生成 3 个文件：

### 1. report_{id}.json - 完整分析报告

包含：
- 总体统计摘要
- 分类分布统计（请求数、占比、唯一UA、唯一IP）
- 聚类结果详情
- 可疑IP列表
- Top 50 User-Agent
- Top 30 访问路径
- 解析失败的坏行列表（含行号）
- 未知样本统计

### 2. summary_{id}.csv - 逐行分类摘要

每行对应日志文件中的一行，包含：
- 行号、IP、分类、分类原因
- 聚类ID、UA家族、OS家族、设备类型
- 是否爬虫、是否移动端
- 路径、状态码、UA预览

### 3. unknown_samples_{id}.csv - 未知样本详情

仅包含分类为 "unknown" 的条目，便于后续人工分析。

## 自定义分类规则

编辑 `ua_rules.yaml` 文件：

```yaml
rules:
  - name: "我的自定义规则"
    category: "client"       # client / crawler / risk
    priority: 80             # 优先级，数字越大越高
    patterns:                # 正则匹配UA字符串
      - "my-app"
      - "internal-client"
    ua_families:             # 匹配UA家族
      - "Chrome"
    os_families:             # 匹配操作系统
      - "Windows"
      - "Mac OS X"
    is_bot: false            # 是否为爬虫
```

## 结果稳定性保证

为确保重复运行同一批材料结果一致：

1. 使用 `--report-id` 参数指定固定报告ID
2. JSON 报告所有字典键按字母序排序
3. 所有列表输出按行号排序
4. 聚类使用稳定哈希算法

## 命令行参数说明

### analyze 命令

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `log_files` | 日志文件路径（可多个） | 必填 |
| `--rules, -r` | 自定义规则 YAML 文件 | 内置规则 |
| `--output-dir, -o` | 报告输出目录 | `reports/` |
| `--report-id` | 指定报告ID，用于结果稳定 | 自动生成 |
| `--min-cluster-size` | 最小聚类样本数 | 3 |
| `--similarity-threshold` | UA 相似度阈值 | 0.7 |
| `--quiet, -q` | 静默模式 | false |

### top 命令

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `log_file` | 日志文件路径 | 必填 |
| `--category, -c` | 过滤分类 | 全部 |
| `--limit, -n` | 显示数量 | 20 |
| `--show-ua` | 显示完整 UA | false |

## 使用场景示例

### 场景1: 安全应急响应

```bash
# 快速分析攻击日志，识别可疑UA和IP
./ua_classifier.py analyze attack_logs.log --report-id attack_20240115

# 查看可疑风险分类的Top UA
./ua_classifier.py top attack_logs.log -c risk -n 50 --show-ua
```

### 场景2: 日常巡检

```bash
# 每日定时分析
./ua_classifier.py analyze /var/log/nginx/access.log --report-id daily_$(date +%Y%m%d)
```

### 场景3: 未知样本人工分析

```bash
# 先用工具聚类
./ua_classifier.py analyze access.log

# 然后打开 unknown_samples_*.csv 人工审查聚类结果
```

## 文件结构

```
.
├── ua_classifier.py      # CLI 主入口
├── ua_parser.py          # UA 解析和日志解析
├── rule_matcher.py       # 分类规则匹配
├── cluster.py            # 未知样本聚类
├── path_analyzer.py      # 路径统计分析
├── reporter.py           # 报告生成
├── ua_rules_default.yaml # 默认规则模板
└── requirements.txt      # 依赖
```

## 支持的日志格式

默认支持标准 Nginx 日志格式：

```
$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
```

如需其他格式，请修改 `ua_parser.py` 中的正则表达式。