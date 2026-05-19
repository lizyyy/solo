# 配置漂移豁免到期复核排查工具

用于配置漂移检测、豁免到期复核的命令行工具，核心功能包括：

- **差异检测**: 对比配置项的期望值与实际值，识别漂移
- **豁免到期**: 自动检查豁免记录是否到期
- **复核状态**: 管理豁免记录的复核状态（待复核、已批准、已拒绝）
- **重复导入幂等**: 防止重复导入相同数据，保证运行结果稳定
- **报告导出**: 生成CSV、JSON、TXT摘要、Excel等格式报告
- **坏行保留**: 保留解析失败的行位置，方便排查

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 准备输入文件

#### 配置项文件 (CSV/Excel)
必需列：`service_name`, `config_key`, `expected_value`, `actual_value`

示例 `test_configs.csv`:
```csv
service_name,config_key,expected_value,actual_value
order-service,db.connection.timeout,30,30
order-service,log.level,INFO,DEBUG
payment-service,max.retry.attempts,3,5
```

#### 豁免记录文件 (CSV/Excel)
必需列：`service_name`, `config_key`, `reason`, `expire_date`
可选列：`reviewer`, `status`

示例 `test_exemptions.csv`:
```csv
service_name,config_key,reason,expire_date,reviewer,status
order-service,log.level,排查问题临时开启DEBUG,2024-01-01,zhangsan,approved
payment-service,max.retry.attempts,提高重试次数提升稳定性,2099-12-31,lisi,approved
```

### 2. 运行审计

```bash
python -m config_drift_audit -c test_configs.csv -e test_exemptions.csv
```

### 3. 查看报告

报告默认输出到 `./audit_reports/` 目录：
- `drift_audit_YYYYMMDD_HHMMSS.csv` - 详细CSV报告
- `drift_audit_YYYYMMDD_HHMMSS.json` - JSON格式报告
- `drift_audit_YYYYMMDD_HHMMSS_summary.txt` - 文本摘要报告
- `drift_audit_YYYYMMDD_HHMMSS.xlsx` - 带格式的Excel报告

## 命令行选项

```
usage: config_drift_audit [-h] -c CONFIGS -e EXEMPTIONS [-o OUTPUT_DIR]
                          [-p PREFIX] [-d CHECK_DATE] [--no-idempotency]
                          [--clear-history] [--list-runs] [-v]

选项:
  -h, --help            显示帮助信息
  -c CONFIGS, --configs CONFIGS
                        配置项文件路径 (CSV或Excel)
  -e EXEMPTIONS, --exemptions EXEMPTIONS
                        豁免记录文件路径 (CSV或Excel)
  -o OUTPUT_DIR, --output-dir OUTPUT_DIR
                        报告输出目录 (默认: ./audit_reports)
  -p PREFIX, --prefix PREFIX
                        报告文件名前缀 (默认: drift_audit)
  -d CHECK_DATE, --check-date CHECK_DATE
                        豁免到期检查日期 YYYY-MM-DD (默认: 今天)
  --no-idempotency      跳过幂等性检查，强制重新运行
  --clear-history       清除运行历史后退出
  --list-runs           列出最近的运行记录后退出
  -v, --version         显示版本信息
```

## 示例

### 基本用法
```bash
python -m config_drift_audit -c configs.csv -e exemptions.csv
```

### 指定输出目录和报告前缀
```bash
python -m config_drift_audit -c configs.xlsx -e exemptions.xlsx -o ./reports -p prod_audit
```

### 指定检查日期
```bash
python -m config_drift_audit -c configs.csv -e exemptions.csv -d 2024-12-31
```

### 跳过重复检测
```bash
python -m config_drift_audit -c configs.csv -e exemptions.csv --no-idempotency
```

### 查看运行历史
```bash
python -m config_drift_audit --list-runs
```

### 清除运行历史
```bash
python -m config_drift_audit --clear-history
```

## 复核状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待复核 |
| `approved` | 已批准 |
| `rejected` | 已拒绝 |
| `expired` | 豁免已过期 |
| `no_exemption` | 无豁免 |

## 项目结构

```
config_drift_audit/
├── __init__.py          # 包入口
├── __main__.py          # 模块运行入口
├── cli.py               # 命令行接口
├── models/              # 数据模型
│   ├── __init__.py
│   ├── config_item.py   # 配置项、豁免记录、漂移记录
│   ├── source_tracker.py # 来源追踪、坏行记录
│   └── audit_result.py  # 审计结果、统计摘要
├── parsers/             # 解析器
│   ├── __init__.py
│   ├── base_parser.py   # 解析器基类
│   ├── csv_parser.py    # CSV解析器
│   ├── excel_parser.py  # Excel解析器
│   └── parser_factory.py # 解析器工厂
├── rules/               # 规则引擎
│   ├── __init__.py
│   └── rule_engine.py   # 核心规则引擎
├── reports/             # 报告生成
│   ├── __init__.py
│   └── report_generator.py # 多格式报告生成器
└── utils/               # 工具类
    ├── __init__.py
    └── idempotency.py   # 幂等性管理
```

## Excel报告工作表说明

- **摘要**: 审计概览和统计数据
- **漂移详情**: 所有漂移记录的详细信息，过期豁免标红
- **已过期豁免**: 仅包含已过期的豁免记录，重点关注
- **坏行记录**: 解析失败的行位置和原始内容

## 注意事项

1. 输入文件编码建议使用 UTF-8
2. 日期格式必须为 `YYYY-MM-DD`
3. 重复运行相同输入文件会触发幂等性检查，可使用 `--no-idempotency` 跳过
4. 坏行会被保留在报告中，包含原始文件路径和行号，方便定位问题
