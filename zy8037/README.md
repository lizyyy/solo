# ESG 碳排放月度复核 CLI

本地 Python 命令行工具，用于 ESG 同事复核月度碳排放口径。

## 功能特性

- 按站点/范围/月份归并能源用量
- 自动单位换算 (kWh/MWh/GJ/m³/kg/t/L)
- 排放因子版本匹配 (基于生效日期)
- 重复账单自动识别
- 跨月调整事项处理
- 负数冲回支持
- 站点中英文别名自动匹配
- 因子缺失时使用默认值并报警

## 安装

```bash
pip install -e .
```

或直接使用 `python -m esg_emissions_cli`

## 输入文件格式

### 能源账单 CSV (energy_bills.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| site | string | ✅ | 站点名称 |
| month | string | ✅ | 月份 YYYY-MM |
| energy_type | string | ✅ | 能源类型 |
| consumption | float | ✅ | 用量 |
| unit | string | ✅ | 单位 |
| bill_id | string | ✅ | 账单ID |

支持能源类型: `electricity`, `natural_gas`, `diesel`, `gasoline`, `coal`, `lng`

### 组织边界 JSON (org_boundary.json)

```json
{
  "sites": {
    "站点名": {
      "name_cn": "中文名",
      "name_en": "English Name",
      "scope": "Scope 1/2/3",
      "region": "区域"
    }
  },
  "site_aliases": {
    "标准名": ["别名1", "别名2"]
  }
}
```

### 排放因子 YAML (emission_factors.yaml)

```yaml
factors:
  - energy_type: electricity
    factor_value: 0.581
    unit: kgCO2/kWh
    scope: Scope 2
    version: v2024.1
    effective_date: 2024-01
```

### 调整事项 CSV (adjustments.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| site | string | ✅ | 站点名称 |
| month | string | ✅ | 调整月份 |
| energy_type | string | ✅ | 能源类型 |
| adjustment_type | string | ✅ | 类型: correction/reversal |
| amount | float | ✅ | 调整量 (tCO2e, 负数表示冲回) |
| reason | string | | 调整原因 |
| related_bill_id | string | | 关联账单ID |

## 使用方法

### 基本用法

```bash
python -m esg_emissions_cli \
  --energy-bills sample_data/energy_bills.csv \
  --org-boundary sample_data/org_boundary.json \
  --factors sample_data/emission_factors.yaml \
  --adjustments sample_data/adjustments.csv \
  --output-dir output
```

### 指定复核月份

```bash
python -m esg_emissions_cli \
  --energy-bills sample_data/energy_bills.csv \
  --org-boundary sample_data/org_boundary.json \
  --factors sample_data/emission_factors.yaml \
  --adjustments sample_data/adjustments.csv \
  --month 2024-01 \
  --output-dir output
```

### 使用 pip 安装后

```bash
esg-emissions-cli \
  --energy-bills energy_bills.csv \
  --org-boundary org_boundary.json \
  --factors emission_factors.yaml \
  --adjustments adjustments.csv
```

## 输出文件

### emissions.csv

完整的排放清单，包含以下字段：

| 字段 | 说明 |
|------|------|
| site | 站点 |
| scope | 范围 (Scope 1/2/3) |
| month | 月份 |
| energy_type | 能源类型 |
| consumption | 归并后用量 |
| unit | 单位 |
| emission_factor | 排放因子值 |
| emissions_tCO2e | 排放量 (tCO2e) |
| factor_version | 因子版本 |

### anomalies.csv

异常清单，包含：

| 字段 | 说明 |
|------|------|
| type | 异常类型 |
| site | 站点 |
| severity | 严重程度 |
| description | 描述 |

异常类型包括：
- `因子缺失` - 无法找到对应排放因子
- `重复账单` - 检测到重复的账单记录
- `跨月调整` - 同一站点同一能源类型有多条跨月调整
- `负数冲回` - 应用了负数调整

### report.md

Markdown 格式的汇总报告，包含：
- 总体概况
- 按范围统计
- 按站点统计
- 异常清单
- 数据质量说明

## 边界情况处理

### 1. 因子缺失

当无法找到对应排放因子时：
1. 尝试使用默认因子 (定义在 `EMISSION_FACTOR_DEFAULTS`)
2. 在异常清单中记录 `因子缺失` 警告
3. 跳过该条记录继续处理其他数据

### 2. 站点别名

组织边界 JSON 中的 `site_aliases` 字段用于定义中英文别名映射：

```json
{
  "site_aliases": {
    "Shanghai Factory": ["上海工厂", "shanghai factory", "SHANGHAI"]
  }
}
```

系统会自动将别名匹配到标准站点名。

### 3. 负数冲回

调整事项中的负数 `amount` 表示冲回：

```
amount = -15000  →  减少 15000 tCO2e
```

系统会在异常清单中记录所有负数冲回操作。

## 运行测试

```bash
pytest tests/ -v
```

## 项目结构

```
esg_emissions_cli/
├── __main__.py           # CLI 入口
├── __init__.py           # 包初始化
├── models/
│   ├── data_models.py    # 数据模型
│   └── validator.py      # 输入验证
├── calculators/
│   └── emission_calculator.py  # 排放计算引擎
├── validators/
│   └── business_rules.py # 业务规则验证
└── sample_data/
    ├── energy_bills.csv
    ├── org_boundary.json
    ├── emission_factors.yaml
    └── adjustments.csv
```
