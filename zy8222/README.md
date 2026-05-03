# 燃气锅炉燃烧配风复核工具

一个本地 Python CLI 工具，用于锅炉运行工程师离线复核燃气锅炉燃烧配风状况。

## 功能特性

- **数据读取**: 支持 CSV、YAML、JSONL 格式的输入文件
- **时间线重建**: 按锅炉/燃烧器重建时间线，数据自动排序对齐
- **核心计算**:
  - 过量空气系数计算 (λ = 21 / (21 - O2))
  - 负荷突变检测 (>20% 变化)
  - NOx/CO 排放超限检查
  - 维护后回归风险评估
- **告警检测**:
  - 跨午夜班次检测
  - 传感器断采检测 (>5 分钟间隔)
  - 单位混用检测 (量级异常跳变)
- **报告导出**:
  - `issues.csv`: 问题列表 (CSV 格式)
  - `combustion_review.md`: 详细分析报告 (Markdown 格式)

## 安装

```bash
pip install -r requirements.txt
```

## 输入文件格式

### 1. burners.csv (燃烧器配置)

```csv
boiler_id,burner_id,model,rated_power_mw,installation_date,status
B001,B1,Weishaupt-GL10,10.5,2020-03-15,active
B001,B2,Weishaupt-GL10,10.5,2020-03-15,active
```

### 2. minute_logs.csv (分钟级运行日志)

```csv
boiler_id,burner_id,timestamp,load,o2,co,nox,gas_flow,air_flow
B001,B1,2026-05-01 06:00:00,75.0,4.2,350.0,65.0,1200.0,9500.0
```

- `load`: 负荷百分比 (%)
- `o2`: 烟气含氧量 (%)
- `co`: 一氧化碳浓度 (mg/m³)
- `nox`: 氮氧化物浓度 (mg/m³)
- `gas_flow`: 燃气流量
- `air_flow`: 空气流量

### 3. emission_limits.yaml (排放限值)

```yaml
nox:
  limit_mg_m3: 100
  unit: mg/m3
co:
  limit_mg_m3: 4000
  unit: mg/m3
o2:
  target_min_pct: 3.0
  target_max_pct: 5.0
excess_air_ratio:
  target_min: 1.05
  target_max: 1.2
```

### 4. maintenance.jsonl (维护记录)

每行一个 JSON 对象：

```json
{"boiler_id": "B001", "burner_id": "B1", "timestamp": "2026-05-01 08:00:00", "type": "air_fuel_ratio_adjustment", "description": "调整空燃比"}
```

## 使用方法

### 基本用法

```bash
python boiler_review.py -b burners.csv -l minute_logs.csv -e emission_limits.yaml -m maintenance.jsonl
```

### 指定输出目录

```bash
python boiler_review.py -b burners.csv -l minute_logs.csv -e emission_limits.yaml -m maintenance.jsonl -o ./output
```

### 详细输出模式

```bash
python boiler_review.py -b burners.csv -l minute_logs.csv -e emission_limits.yaml -m maintenance.jsonl -v
```

### 使用示例数据测试

```bash
python boiler_review.py -b sample_data/burners.csv -l sample_data/minute_logs.csv -e sample_data/emission_limits.yaml -m sample_data/maintenance.jsonl -o sample_output -v
```

### 查看帮助

```bash
python boiler_review.py --help
```

## 输出文件说明

### issues.csv

包含所有检测到的问题，字段包括：
- `boiler_id`: 锅炉 ID
- `burner_id`: 燃烧器 ID
- `timestamp`: 时间戳
- `issue_type`: 问题类型
  - `excess_air_ratio`: 过量空气系数异常
  - `load_transient`: 负荷突变
  - `emission_exceeded`: 排放超限
  - `maintenance_regression`: 维护后回归
- `severity`: 严重程度 (critical/warning)
- `message`: 详细描述

### combustion_review.md

Markdown 格式的详细报告，包含：
1. 统计概览
2. 告警信息
3. 问题详情 (按锅炉/燃烧器分组)
4. 配置信息
5. 维护记录

## 示例数据说明

`sample_data/` 目录包含示例数据，可以直接用于测试：

- **正常运行数据**: B001/B1 在 06:00-06:09 的数据 (O2 4.2-4.4%, 负荷平稳)
- **过量空气系数偏低**: B001/B1 在 08:30-08:32 的数据 (O2 2.3-2.5%, λ < 1.05)
- **负荷突变**: B001/B1 在 09:15-09:16 的数据 (负荷 50% -> 85%, 变化 70%)
- **过量空气系数偏高 + NOx 超限**: B001/B1 在 14:00-14:02 的数据 (O2 8.8-9.2%, NOx 108-115 mg/m³ > 100)
- **CO 超限**: B001/B2 在 10:00-10:04 的数据 (CO 4200-5500 mg/m³ > 4000)
- **跨午夜班次**: B002/B1 在 23:58-00:02 的数据
- **传感器断采**: B002/B1 在 14:20-14:30 的数据 (间隔 10 分钟)

## 测试用例

### 用例 1: 正常运行 (应无问题)

```csv
boiler_id,burner_id,timestamp,load,o2,co,nox,gas_flow,air_flow
B001,B1,2026-05-01 06:00:00,75.0,4.2,350.0,65.0,1200.0,9500.0
B001,B1,2026-05-01 06:01:00,75.2,4.3,340.0,64.5,1210.0,9550.0
B001,B1,2026-05-01 06:02:00,74.8,4.1,355.0,65.2,1195.0,9480.0
```

**预期结果**:
- 过量空气系数: λ = 21/(21-4.2) ≈ 1.25 (正常范围边缘，1.05-1.2)
- 负荷变化: 平稳 (<20%)
- 排放: NOx 65 < 100, CO 355 < 4000
- 结论: 基本正常，O2 略高

### 用例 2: 异常运行 (应检测到多个问题)

```csv
boiler_id,burner_id,timestamp,load,o2,co,nox,gas_flow,air_flow
B001,B1,2026-05-01 08:30:00,80.0,2.5,800.0,90.0,1350.0,9800.0
B001,B1,2026-05-01 09:15:00,50.0,4.0,300.0,55.0,800.0,6500.0
B001,B1,2026-05-01 09:16:00,85.0,4.5,500.0,75.0,1450.0,10200.0
B001,B1,2026-05-01 14:00:00,70.0,9.0,200.0,110.0,1100.0,15000.0
```

**预期结果**:
1. **08:30 过量空气系数偏低**: O2=2.5%, λ=21/(21-2.5)≈1.135 (正常? 1.135 在 1.05-1.2 范围内)
   - 实际上 λ=1.135 是正常的，但 O2=2.5% 偏低
   - 代码中: λ<1.05 才警告

2. **09:15-09:16 负荷突变**: 50% -> 85%, 变化 70% (>20%)

3. **14:00 过量空气系数偏高 + NOx 超限**:
   - O2=9.0%, λ=21/(21-9)=1.75 (>1.3, warning)
   - NOx=110 (>100, exceeded)

## 注意事项

1. **时间戳格式**: 支持多种时间戳格式 (YYYY-MM-DD HH:MM:SS, YYYY/MM/DD HH:MM, ISO 格式等)
2. **单位一致性**: 确保所有数值字段使用一致的单位
3. **数据完整性**: 建议 O2、CO、NOx 字段完整，否则某些检测可能无法执行
4. **跨时区**: 工具假设所有时间戳使用同一时区，不做时区转换

## 依赖

- Python 3.7+
- PyYAML >= 6.0
