# 工厂换模停机统计 CLI

一个用于统计工厂机台换模停机时间的命令行工具。

## 功能特性

- **数据导入**: 支持导入机台生产计划、换模记录、异常停机记录、产量记录
- **智能去重**: 自动检测重复记录并标记
- **异常检测**: 检测结束时间早于开始时间、时间重叠、产量无对应计划等异常
- **数据核算**: 计算每台机的计划停机、异常停机、有效产出和效率
- **人工修正**: 支持对异常记录进行人工修正
- **日报导出**: 导出包含统计口径说明和明细的日报CSV

## 统计口径

### 计划停机（换模时间）
- 包含所有状态为"有效"的换模记录
- 计算：结束时间 - 开始时间
- 注意：重复记录、结束早于开始、时间重叠的记录不计入

### 异常停机
- 包含所有状态为"有效"的异常停机记录
- 计算：结束时间 - 开始时间
- 注意：重复记录、结束早于开始、时间重叠的记录不计入

### 有效产出
- 包含所有状态为"有效"的产量记录
- 产量记录必须匹配到对应的生产计划
- 注意：重复记录、无对应计划的产量不计入

### 效率计算
- 有效生产时间 = 24小时 - 计划停机 - 异常停机
- 效率 = 有效生产时间 / 24小时 × 100%

### 记录状态说明
- **有效**: 正常计入统计
- **重复**: 与已有记录完全一致，已被忽略
- **时间无效**: 结束时间早于或等于开始时间，待复核
- **时间重叠**: 与其他有效记录时间重叠，待复核
- **无对应计划**: 产量记录无法匹配生产计划，待复核
- **待复核**: 以上所有异常状态统称

## 安装

```bash
pip install click rich pandas
```

## 使用方法

### 1. 查看帮助

```bash
python3 -m factory_downtime_cli.cli --help
```

### 2. 导入数据

```bash
# 导入生产计划
python3 -m factory_downtime_cli.cli import-data --plans samples/production_plans.csv

# 导入换模记录
python3 -m factory_downtime_cli.cli import-data --changeovers samples/changeover_records.csv

# 导入异常停机
python3 -m factory_downtime_cli.cli import-data --downtimes samples/abnormal_downtimes.csv

# 导入产量记录
python3 -m factory_downtime_cli.cli import-data --productions samples/production_records.csv

# 一次性导入所有数据
python3 -m factory_downtime_cli.cli import-data \
  --plans samples/production_plans.csv \
  --changeovers samples/changeover_records.csv \
  --downtimes samples/abnormal_downtimes.csv \
  --productions samples/production_records.csv
```

### 3. 核算数据

```bash
# 核算当天数据
python3 -m factory_downtime_cli.cli calculate

# 核算指定日期数据
python3 -m factory_downtime_cli.cli calculate --date 2025-05-10
```

### 4. 查看机台明细

```bash
# 查看M001机台当天明细
python3 -m factory_downtime_cli.cli detail M001

# 查看指定日期的机台明细
python3 -m factory_downtime_cli.cli detail M001 --date 2025-05-10
```

### 5. 列出待复核记录

```bash
# 列出所有待复核记录
python3 -m factory_downtime_cli.cli list-pending all

# 列出换模待复核记录
python3 -m factory_downtime_cli.cli list-pending changeover

# 列出异常停机待复核记录
python3 -m factory_downtime_cli.cli list-pending downtime

# 列出产量待复核记录
python3 -m factory_downtime_cli.cli list-pending production
```

### 6. 人工修正记录

```bash
# 修正异常停机时间（结束早于开始的情况）
python3 -m factory_downtime_cli.cli correct downtime AD0004 \
  --start-time "2025-05-10 15:30:00" \
  --end-time "2025-05-10 16:00:00"

# 修正记录状态为有效
python3 -m factory_downtime_cli.cli correct changeover CO0004 --status valid

# 修正产量记录关联的计划
python3 -m factory_downtime_cli.cli correct production PR0010 --plan-id P005

# 删除记录
python3 -m factory_downtime_cli.cli correct downtime AD0003 --delete
```

### 7. 导出日报

```bash
# 导出当天日报
python3 -m factory_downtime_cli.cli export --output daily_report.csv

# 导出指定日期日报
python3 -m factory_downtime_cli.cli export --date 2025-05-10 --output daily_report_2025-05-10.csv
```

### 8. 查看数据统计

```bash
python3 -m factory_downtime_cli.cli stats
```

### 9. 重置所有数据

```bash
python3 -m factory_downtime_cli.cli reset
```

## CSV文件格式

### 生产计划 (production_plans.csv)
```csv
plan_id,machine_id,product_code,planned_start,planned_end,planned_quantity
P001,M001,PROD-A,2025-05-10 08:00:00,2025-05-10 14:00:00,1000
```

### 换模记录 (changeover_records.csv)
```csv
machine_id,from_product,to_product,start_time,end_time,operator
M001,PROD-A,PROD-B,2025-05-10 14:00:00,2025-05-10 15:30:00,张三
```

### 异常停机 (abnormal_downtimes.csv)
```csv
machine_id,downtime_type,start_time,end_time,reason,operator
M002,设备故障,2025-05-10 12:30:00,2025-05-10 13:45:00,电机故障,赵六
```

### 产量记录 (production_records.csv)
```csv
machine_id,product_code,quantity,production_time,plan_id
M001,PROD-A,500,2025-05-10 10:00:00,P001
```

## 项目结构

```
factory_downtime_cli/
├── __init__.py          # 包初始化
├── cli.py               # 命令行接口
├── models.py            # 数据模型
├── utils.py             # 工具函数
├── importer.py          # 数据导入模块
├── validator.py         # 数据验证模块
├── calculator.py        # 核算模块
├── corrector.py         # 人工修正模块
├── exporter.py          # 报告导出模块
└── storage.py           # 数据持久化存储
```
