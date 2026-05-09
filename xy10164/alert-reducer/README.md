# Alert Reducer - 值班告警降噪 CLI

一个专业的值班告警降噪工具，解决半夜告警太多、真正需要叫醒人的故障反而被淹没的问题。

## 功能特性

- **告警导入**：支持从Prometheus、Zabbix、日志文件等多种数据源导入告警
- **合并窗口**：在指定时间窗口内合并相似告警，减少重复告警
- **抑制规则**：基于时间、优先级、标签等条件抑制不重要的告警
- **升级策略**：定义告警升级规则，确保高优先级告警能及时通知值班人员
- **值班历史**：记录每次值班的告警处理情况
- **复盘报告**：生成详细的复盘报告，帮助改进告警策略
- **历史查询**：支持按时间、状态、优先级等条件查询历史告警
- **失败留痕**：所有操作失败都会记录详细日志，便于排查
- **重跑校验**：支持对历史告警进行重新处理，验证规则效果

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 初始化数据库

```bash
python -m alert_reducer init
```

### 查看帮助

```bash
python -m alert_reducer --help
```

## 使用示例

### 1. 导入告警

```bash
# 从文件导入
python -m alert_reducer import --file examples/alerts_normal.json

# 从目录批量导入
python -m alert_reducer import --dir examples/
```

### 2. 处理告警

```bash
# 处理最近1小时的告警
python -m alert_reducer process --window 60

# 处理指定时间范围的告警
python -m alert_reducer process --start "2026-05-01 00:00:00" --end "2026-05-01 02:00:00"
```

### 3. 查询历史

```bash
# 查询所有告警
python -m alert_reducer query --all

# 查询未处理的告警
python -m alert_reducer query --status pending

# 查询高优先级告警
python -m alert_reducer query --priority P1

# 查询指定时间范围的告警
python -m alert_reducer query --start "2026-05-01" --end "2026-05-02"
```

### 4. 生成报告

```bash
# 生成最近24小时的报告
python -m alert_reducer report --window 1440

# 生成指定时间范围的报告
python -m alert_reducer report --start "2026-05-01" --end "2026-05-02" --output report.html

# 导出为JSON格式
python -m alert_reducer report --start "2026-05-01" --end "2026-05-02" --format json --output report.json
```

### 5. 重跑校验

```bash
# 重跑处理指定批次的告警
python -m alert_reducer rerun --batch-id 123

# 重跑并应用新规则
python -m alert_reducer rerun --start "2026-05-01" --end "2026-05-02"
```

### 6. 查看失败日志

```bash
# 查看所有失败记录
python -m alert_reducer failures

# 查看最近24小时的失败记录
python -m alert_reducer failures --window 1440
```

## 配置说明

配置文件位于 `config.yaml`，包含以下主要配置项：

- **merge_window**: 告警合并窗口（分钟）
- **suppression_rules**: 告警抑制规则
- **escalation_strategies**: 告警升级策略
- **night_hours**: 夜间时段定义（默认 22:00 - 06:00）

## 示例数据

- `examples/alerts_normal.json`: 正常工作流的示例告警
- `examples/alerts_escalation.json`: 需要升级的示例告警
- `examples/alerts_failed.json`: 包含失败场景的示例告警
