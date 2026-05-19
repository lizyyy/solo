# Silence Audit CLI

Prometheus 静默规则审计命令行工具，用于识别高风险静默规则、过期规则、和广泛匹配规则。

## 功能特性

- **静默规则解析**：支持 JSON/YAML 格式，保留坏行位置信息
- **标签匹配分析**：精确匹配和正则匹配，记录匹配细节
- **过期识别**：识别已过期和即将过期的静默规则
- **命中统计**：统计每个静默规则匹配的告警数量
- **风险分级**：多维度风险评分（CRITICAL/HIGH/MEDIUM/LOW/INFO）
- **报告导出**：JSON/CSV/文本多种格式，稳定排序确保结果可重复

## 安装

```bash
pip install -r requirements.txt
pip install -e .
```

## 使用方法

### 完整审计

```bash
silence-audit audit test_silences.json test_alerts.json
```

### 指定输出目录

```bash
silence-audit audit silences.json alerts.json -o ./my_audit_output
```

### 添加文件名前缀

```bash
silence-audit audit silences.json alerts.json -p production
```

### 仅解析静默规则文件

```bash
silence-audit parse-silences test_silences.json
```

### 仅解析告警文件

```bash
silence-audit parse_alerts test_alerts.json
```

### 启用详细输出

```bash
silence-audit audit silences.json alerts.json -v
```

## 风险评估维度

| 风险因素 | 说明 |
|---------|------|
| 已过期 | 静默规则已过期但仍存在 |
| 即将过期 | 24小时内即将过期 |
| 无告警匹配 | 未匹配任何告警，可能无用 |
| 高命中数 | 匹配告警数量过多 |
| 无创建者 | 创建人字段为空 |
| 无注释 | 注释缺失或过短 |
| 无严重度标签 | 匹配器未指定 severity，范围过广 |
| 通配符正则 | 使用 .* 等通配符正则表达式 |
| 单一匹配器 | 仅有一个标签匹配器，范围过广 |

## 输出文件

| 文件名 | 格式 | 说明 |
|-------|------|------|
| silence_audit_report.json | JSON | 完整审计报告，包含所有详情 |
| silence_audit_report.csv | CSV | 表格格式，便于导入电子表格 |
| high_risk_silences.txt | 文本 | 仅高风险静默规则的详细报告 |
| audit_summary.txt | 文本 | 审计摘要统计 |

## 项目结构

```
silence_audit/
├── __init__.py
├── models.py          # 数据模型定义
├── parser.py          # 静默规则和告警解析器
├── matcher.py         # 标签匹配引擎和来源追踪
├── risk_assessor.py   # 风险评估器
├── report_generator.py # 报告生成器
└── cli.py             # 命令行入口
```

## 数据格式

### 静默规则格式 (JSON)

```json
[
  {
    "id": "silence-id",
    "createdBy": "user",
    "comment": "reason for silence",
    "startsAt": "2025-05-15T00:00:00Z",
    "endsAt": "2025-05-16T00:00:00Z",
    "status": "active",
    "matchers": [
      {"name": "alertname", "value": "SomeAlert", "isRegex": false}
    ]
  }
]
```

### 告警格式 (JSON)

```json
{
  "alerts": [
    {
      "labels": {"alertname": "SomeAlert", "severity": "critical"},
      "annotations": {"summary": "..."},
      "startsAt": "2025-05-15T10:30:00Z"
    }
  ]
}
```

YAML 格式也同样支持。
