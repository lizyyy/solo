# 连接器限速休眠恢复分析 CLI

三方连接器被限流后，重试脚本越跑越乱，缺少统一的休眠和恢复记录。本工具用于分析连接器日志中的限速、休眠、恢复事件，识别问题并生成报告。

## 核心功能

- **限速识别**: 检测限流事件并统计频率
- **休眠状态机**: 追踪完整的休眠会话生命周期
- **恢复幂等**: 检测恢复事件的幂等性问题
- **失败归因**: 自动识别问题原因并给出置信度
- **摘要导出**: 支持 JSON、CSV、Excel 多格式导出
- **坏行追踪**: 保留坏行的原始文件位置信息

## 安装

```bash
# 安装基础版本
pip install -e .

# 安装完整版本（支持 Excel 导出）
pip install -e ".[excel]"
```

## 使用说明

### 1. 分析日志

```bash
# 基本分析
rate-limit-cli analyze examples/sample_log1.log

# 详细分析
rate-limit-cli analyze examples/sample_log1.log -v

# 分析多个文件
rate-limit-cli analyze examples/*.log -v

# 自定义检测参数
rate-limit-cli analyze examples/sample_log1.log \
  --rate-limit-window 120 \
  --min-sleep-interval 5 \
  --max-consecutive-sleep 5
```

### 2. 导出报告

```bash
# 导出全部格式
rate-limit-cli export examples/sample_log1.log -o output/

# 仅导出 JSON
rate-limit-cli export examples/sample_log1.log -f json -o output/

# 仅导出 CSV
rate-limit-cli export examples/sample_log1.log -f csv -o output/

# 导出 Excel（需要安装 pandas 和 openpyxl）
rate-limit-cli export examples/sample_log1.log -f excel -o output/
```

### 3. 检查坏行

```bash
rate-limit-cli badlines examples/sample_log1.log
```

### 4. 查看版本

```bash
rate-limit-cli version
```

## 日志格式要求

工具支持自动识别以下日志格式：

```
# 标准格式
YYYY-MM-DD HH:MM:SS LEVEL connector:xxx supplier:xxx - message

# 支持关键词
rate limit, 限流, throttled, 429
sleep, 休眠, wait, delay
recover, 恢复, recovery, resum
retry, 重试
error, exception, 失败, 异常
```

## 项目结构

```
connector_rate_limit_cli/
├── __init__.py          # 版本信息
├── parser.py            # 日志解析模块
├── state_machine.py     # 规则判断和状态机
├── tracker.py           # 来源追踪和失败归因
├── reporter.py          # 报告生成和导出
└── cli.py               # 命令行入口
```

## 核心模块说明

### LogParser (parser.py)
- 解析日志文件，提取时间、连接器、供应商等字段
- 识别限流、休眠、恢复、重试、错误等事件
- 标记坏行并保留原始位置信息

### RateLimitRuleEngine & SleepStateMachine (state_machine.py)
- 限流窗口检测
- 休眠策略验证
- 状态转换追踪
- 幂等性检测

### SourceTracker & FailureCauseAnalyzer (tracker.py)
- 来源追踪和哈希计算
- 失败原因分析和置信度评估
- 按严重程度分类

### ConsoleReporter & FileReporter (reporter.py)
- 控制台彩色输出
- JSON/CSV/Excel 多格式导出
- 结构化报告生成

## 输出说明

### 运行摘要
- 总记录数、休眠会话数
- 成功恢复会话数、非幂等会话数
- 各类事件统计（限流、休眠、恢复、重试、错误）
- 坏行记录数

### 失败归因
- 原因类型和描述
- 置信度（百分比）
- 严重程度（critical/high/medium/low）
- 证据记录数

### 导出文件
- JSON: 完整的结构化数据
- CSV: 摘要、会话、失败原因、坏行记录
- Excel: 多工作表汇总

## 示例

```bash
# 运行示例
$ rate-limit-cli analyze examples/sample_log1.log -v

# 查看坏行
$ rate-limit-cli badlines examples/sample_log1.log

# 导出报告
$ rate-limit-cli export examples/sample_log1.log -o reports/
```
