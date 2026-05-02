# 冻存盒交接核对员 (FreezeValidator)

生物样本库本地自动化工具，用于冻存盒交接时的多源数据核对。

## 功能特性

- **ingest**: 导入多源文件并计算SHA256哈希确保可追溯性
- **check**: 自动校验条码重复、孔位错误、温度超限、签字缺失等问题
- **review**: 记录人工复核结果
- **export**: 导出Markdown/CSV/JSON格式的审计报告

## 校验规则

| 规则 | 严重程度 | 描述 |
|------|---------|------|
| `duplicate_barcode` | ERROR | 样本条码重复出现 |
| `invalid_position` | ERROR | 孔位编号超出范围 |
| `missing_scan` | ERROR | 位置表中存在但未被扫描的条码 |
| `unexpected_scan` | WARNING | 已扫描但不在位置表中的条码 |
| `temperature_exceeded` | WARNING | 温度超出阈值范围 |
| `temperature_not_marked` | ERROR | 温度超限但未人工标记 |
| `missing_signature` | ERROR | 交接人漏签 |
| `incomplete_transfer_chain` | ERROR/WARNING | 冻存盒编号与交接单不匹配 |

## 安装

### 要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆或解压项目
cd xy4196

# 以可编辑模式安装（开发模式）
pip install -e .

# 或者安装依赖
pip install click pandas pydantic python-dateutil
```

## 快速开始

### 使用示例数据验证

```bash
# 1. 查看示例数据
ls examples/

# 2. 导入数据（使用临时存储目录）
freezevalidator --storage ./tmp_storage ingest \
  --position-table examples/position_table_good.csv \
  --scan-log examples/scan_log_good.csv \
  --temperature examples/temperature_good.json \
  --transfer-form examples/transfer_form_good.json

# 3. 记下输出的session_id，例如：session_20260503_xxxxxx

# 4. 执行校验
freezevalidator --storage ./tmp_storage check session_20260503_xxxxxx

# 5. 查看会话列表
freezevalidator --storage ./tmp_storage list

# 6. 导出报告
freezevalidator --storage ./tmp_storage export \
  session_20260503_xxxxxx \
  --output ./audit_report \
  --format all
```

## 详细使用指南

### 1. 数据文件格式

#### 位置表 CSV

支持中英文表头：

```csv
barcode,box_id,position,batch_id,sample_type
SAM001,BOX001,A01,BATCH001,血浆
```

或者：

```csv
样本条码,冻存盒号,孔位,批次号,样本类型
SAM001,BOX001,A01,BATCH001,血浆
```

**孔位格式**: 字母(A-J)+数字(1-10)，如 A01, B10

#### 扫码日志 CSV

```csv
barcode,scan_time,scanner_id,location,box_id
SAM001,2026-05-03T09:15:00,SCAN001,样本库入口,BOX001
```

#### 温度记录 JSON

```json
{
  "freezer_id": "FREEZER001",
  "readings": [
    {
      "timestamp": "2026-05-03T08:00:00",
      "temperature": -78.5,
      "freezer_id": "FREEZER001",
      "probe_id": "PROBE01",
      "is_alert": false,
      "alert_marked": false
    }
  ]
}
```

#### 交接单 JSON

```json
{
  "transfer_id": "TRANSFER_20260503_001",
  "transfer_date": "2026-05-03T09:00:00",
  "sender_name": "张三",
  "sender_signature": "ZS_20260503",
  "sender_sign_date": "2026-05-03T09:10:00",
  "receiver_name": "李四",
  "receiver_signature": "LS_20260503",
  "receiver_sign_date": "2026-05-03T09:15:00",
  "box_ids": ["BOX001", "BOX002"],
  "notes": "常规样本交接"
}
```

### 2. 导入数据

```bash
# 一次导入多个文件到新会话
freezevalidator ingest \
  -p position_table.csv \
  -l scan_log.csv \
  -t temperature.json \
  -f transfer_form.json

# 追加文件到现有会话
freezevalidator ingest \
  -l additional_scans.csv \
  -i session_20260503_xxxxxx

# 使用自定义存储目录
freezevalidator -s ./my_storage ingest -p position_table.csv
```

### 3. 执行校验

```bash
# 使用默认配置
freezevalidator check session_20260503_xxxxxx

# 自定义温度阈值
freezevalidator check session_20260503_xxxxxx \
  --min-temp -90.0 \
  --max-temp -60.0

# 自定义冻存盒尺寸
freezevalidator check session_20260503_xxxxxx \
  --max-rows 12 \
  --max-cols 12

# 显示详细信息
freezevalidator check session_20260503_xxxxxx -v
```

### 4. 记录复核

```bash
# 整体复核
freezevalidator review session_20260503_xxxxxx \
  -r "管理员" \
  -a note \
  -s confirmed \
  -m "已确认所有问题"

# 针对特定问题（根据check输出的序号）
freezevalidator review session_20260503_xxxxxx \
  -r "管理员" \
  -i 1 \
  -a accept \
  -s resolved \
  -m "条码重复已修正"
```

**动作类型**:
- `accept`: 接受问题
- `reject`: 拒绝问题
- `note`: 备注说明
- `escalate`: 升级处理

**状态类型**:
- `resolved`: 已解决
- `pending`: 待处理
- `confirmed`: 已确认
- `dismissed`: 已忽略

### 5. 导出报告

```bash
# 导出所有格式
freezevalidator export session_20260503_xxxxxx \
  -o ./report \
  -f all

# 仅导出Markdown
freezevalidator export session_20260503_xxxxxx \
  -o report.md \
  -f markdown

# 仅导出CSV
freezevalidator export session_20260503_xxxxxx \
  -o ./csv_reports \
  -f csv
```

导出内容：
- `audit_report.md`: 完整的Markdown报告
- `audit_report.json`: JSON格式摘要
- `csv/summary.csv`: 数据统计
- `csv/validation_issues.csv`: 问题列表
- `csv/samples.csv`: 样本列表
- `csv/review_entries.csv`: 复核记录

### 6. 查看会话

```bash
# 列出所有会话
freezevalidator list

# 列出最近5个会话
freezevalidator list -n 5
```

## 临时目录完整验证流程

使用示例数据进行完整的端到端测试：

```bash
#!/bin/bash

# 1. 准备环境
cd xy4196
mkdir -p ./test_audit

# 2. 安装依赖
pip install -e .

# 3. 场景A：完美数据 - 应该全部通过
echo "=== 场景A：完美数据 ==="
SESSION_A=$(freezevalidator -s ./test_audit ingest \
  -p examples/position_table_good.csv \
  -l examples/scan_log_good.csv \
  -t examples/temperature_good.json \
  -f examples/transfer_form_good.json 2>&1 | grep "会话ID" | cut -d' ' -f2)
echo "会话ID: $SESSION_A"

freezevalidator -s ./test_audit check $SESSION_A

# 4. 场景B：有问题的数据 - 应该报告错误
echo ""
echo "=== 场景B：有问题的数据 ==="
SESSION_B=$(freezevalidator -s ./test_audit ingest \
  -p examples/position_table_with_errors.csv \
  -l examples/scan_log_missing.csv \
  -t examples/temperature_with_alerts.json \
  -f examples/transfer_form_missing_signatures.json 2>&1 | grep "会话ID" | cut -d' ' -f2)
echo "会话ID: $SESSION_B"

# 这个应该会失败并返回错误码
freezevalidator -s ./test_audit check $SESSION_B -v || echo "预期的校验失败"

# 5. 添加复核记录
echo ""
echo "=== 添加复核记录 ==="
freezevalidator -s ./test_audit review $SESSION_B \
  -r "张管理员" \
  -a note \
  -s pending \
  -m "发现多个问题，待进一步调查"

# 6. 导出报告
echo ""
echo "=== 导出报告 ==="
freezevalidator -s ./test_audit export $SESSION_B \
  -o ./test_audit/report_$SESSION_B \
  -f all

# 7. 查看会话列表
echo ""
echo "=== 会话列表 ==="
freezevalidator -s ./test_audit list

# 8. 检查生成的文件
echo ""
echo "=== 生成的报告文件 ==="
ls -la ./test_audit/report_$SESSION_B/

echo ""
echo "验证完成！检查 ./test_audit 目录查看结果"
```

## 运行测试

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_rules.py -v
pytest tests/test_parser.py -v
```

## 项目结构

```
xy4196/
├── src/
│   └── freezevalidator/
│       ├── __init__.py      # 版本信息
│       ├── models.py        # 数据模型定义
│       ├── parser.py        # 文件解析器
│       ├── rules.py         # 校验规则引擎
│       ├── storage.py       # 会话存储管理
│       ├── exporter.py      # 报告导出器
│       └── cli.py           # CLI入口
├── examples/                 # 示例数据
│   ├── position_table_good.csv
│   ├── position_table_with_errors.csv
│   ├── scan_log_good.csv
│   ├── scan_log_missing.csv
│   ├── temperature_good.json
│   ├── temperature_with_alerts.json
│   ├── transfer_form_good.json
│   └── transfer_form_missing_signatures.json
├── tests/                    # 单元测试
│   ├── test_rules.py
│   └── test_parser.py
├── pyproject.toml           # 项目配置
└── README.md                # 本文件
```

## 默认存储位置

- macOS: `~/Library/Application Support/FreezeValidator/`
- Windows: `%LOCALAPPDATA%\FreezeValidator\`
- Linux: `~/.freezevalidator/`

使用 `-s` 或 `--storage` 参数自定义存储位置。

## 注意事项

1. **数据安全**: 所有数据存储在本地，不会上传到任何服务器
2. **文件哈希**: 每个导入的文件都会计算SHA256哈希，确保可追溯
3. **错误退出码**: 发现ERROR级别问题时，`check` 命令返回退出码1
4. **中文支持**: 支持中英文表头和字段名

## License

内部使用
