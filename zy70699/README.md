# 口腔耗材批次灭菌有效期患者追溯排查CLI

## 项目简介

本工具用于口腔门诊耗材批次与灭菌记录、使用患者之间的追溯关联分析，实现耗材使用的全流程可追溯，确保医疗安全。

## 核心功能

- **批次绑定**: 耗材批次与灭菌记录的关联
- **灭菌有效期校验**: 检查使用时间是否在灭菌有效期内
- **使用登记追溯**: 耗材使用记录与治疗项目、患者的关联
- **异常检测**: 自动识别过期灭菌、无有效灭菌、未来使用等异常
- **多格式报告导出**: 支持 JSON、CSV、Excel、文本格式导出

## 异常类型说明

| 异常类型 | 说明 |
|---------|------|
| `EXPIRED` | 灭菌已过期 |
| `NOT_STERILIZED` | 无有效灭菌记录 |
| `FUTURE_USAGE` | 使用时间在未来 |
| `MISSING_DATA` | 关联数据缺失 |
| `DUPLICATE_RECORD` | 重复记录 |

## 安装依赖

```bash
pip3 install click pydantic pandas openpyxl python-dateutil
```

## 快速开始

### 1. 生成样例数据

```bash
python3 main.py generate-samples
```

生成的样例数据包含：
- `batches.csv`: 耗材批次
- `sterilizations.csv`: 灭菌记录
- `patients.csv`: 患者信息
- `treatments.csv`: 治疗项目
- `usages.csv`: 使用记录

### 2. 执行追溯分析

```bash
python3 main.py trace \
    --batch-csv samples/batches.csv \
    --sterilization-csv samples/sterilizations.csv \
    --patient-csv samples/patients.csv \
    --treatment-csv samples/treatments.csv \
    --usage-csv samples/usages.csv \
    --output reports \
    --format all
```

### 3. 按批次追溯

```bash
python3 main.py trace --batch-csv samples/batches.csv --batch-id B001
```

### 4. 按患者追溯

```bash
python3 main.py trace --patient-csv samples/patients.csv --patient-id P001
```

### 5. 只查看异常记录

```bash
python3 main.py trace --anomalies-only
```

## 命令说明

### `trace` - 执行追溯分析

| 参数 | 说明 |
|-----|------|
| `--excel, -e` | Excel数据文件路径（包含所有工作表） |
| `--batch-csv` | 耗材批次CSV文件 |
| `--sterilization-csv` | 灭菌记录CSV文件 |
| `--patient-csv` | 患者信息CSV文件 |
| `--treatment-csv` | 治疗项目CSV文件 |
| `--usage-csv` | 使用记录CSV文件 |
| `--output, -o` | 输出目录，默认 `./reports` |
| `--format, -f` | 输出格式：all/json/csv/excel/text，默认 all |
| `--batch-id` | 指定批次号追溯 |
| `--patient-id` | 指定患者ID追溯 |
| `--anomalies-only` | 只显示异常记录 |

### `generate-samples` - 生成样例数据

| 参数 | 说明 |
|-----|------|
| `--output, -o` | 样例数据输出目录，默认 `./samples` |

### `validate` - 验证环境依赖

```bash
python3 main.py validate
```

## 数据格式说明

### 耗材批次 (batches.csv)

| 字段 | 说明 | 必填 |
|-----|------|------|
| 批次号 | 唯一标识 | 是 |
| 耗材名称 | 耗材名称 | 是 |
| 耗材类型 | 类型分类 | 是 |
| 生产厂家 | 生产厂商 | 是 |
| 生产日期 | YYYY-MM-DD | 否 |
| 有效期 | YYYY-MM-DD | 否 |
| 初始数量 | 整数 | 是 |
| 入库日期 | YYYY-MM-DD | 是 |
| 供应商 | 供应商名称 | 否 |
| 备注 | 备注信息 | 否 |

### 灭菌记录 (sterilizations.csv)

| 字段 | 说明 | 必填 |
|-----|------|------|
| 灭菌记录ID | 唯一标识 | 是 |
| 批次号 | 关联耗材批次 | 是 |
| 灭菌日期 | YYYY-MM-DD HH:MM:SS | 是 |
| 灭菌有效期 | YYYY-MM-DD HH:MM:SS | 是 |
| 灭菌方式 | 如：高压蒸汽、环氧乙烷 | 是 |
| 操作人员 | 操作员姓名 | 是 |
| 灭菌器编号 | 设备编号 | 否 |
| 温度 | 灭菌温度 | 否 |
| 时长 | 灭菌时长（分钟） | 否 |
| 指示剂结果 | 如：合格/不合格 | 否 |
| 备注 | 备注信息 | 否 |

### 使用记录 (usages.csv)

| 字段 | 说明 | 必填 |
|-----|------|------|
| 使用记录ID | 唯一标识 | 是 |
| 治疗项目ID | 关联治疗项目 | 是 |
| 批次号 | 关联耗材批次 | 是 |
| 使用日期 | YYYY-MM-DD HH:MM:SS | 是 |
| 使用数量 | 整数 | 是 |
| 使用人 | 使用人员 | 是 |
| 备注 | 备注信息 | 否 |

## 报告说明

### 机器可读格式

1. **JSON**: 完整的结构化数据，便于程序处理
2. **CSV**: 表格格式，便于电子表格打开
3. **Excel**: 包含追溯结果和统计汇总两个工作表

### 人类可读格式

1. **TXT**: 清晰的文本报告，包含：
   - 统计汇总
   - 异常记录详情
   - 所有追溯记录明细

## 验收测试

### 测试1: 正常数据验证

输入: B001批次
预期结果: 有效记录，灭菌在有效期内

### 测试2: 脏数据验证

输入: B002批次S002灭菌
预期结果: 检测到已过期灭菌

### 测试3: 边界冲突验证

输入: U003使用记录（未来时间）
预期结果: 检测到FUTURE_USAGE异常

### 测试4: 空结果验证

输入: B004批次
预期结果: 检测到NOT_STERILIZED异常

## 项目结构

```
dental_trace_cli/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── models.py          # 数据模型定义
├── engine/
│   ├── __init__.py
│   └── rules.py           # 追溯规则引擎
├── data_loader.py         # 数据加载器
├── reports.py             # 报告导出器
└── cli.py                 # CLI入口
main.py                    # 主入口
requirements.txt           # 依赖列表
samples/                   # 样例数据
reports/                   # 输出报告
```

## 技术栈

- Python 3.7+
- Click (CLI框架)
- Pydantic (数据验证)
- Pandas (数据处理)
- OpenPyXL (Excel读写)

## License

MIT
