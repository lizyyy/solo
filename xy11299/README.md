# 民宿保洁结算管理工具

一个用于民宿保洁管理的后端工具，支持保洁记录导入、规则引擎自动检测问题、扣款复核和月度结算导出。

## 功能特性

- **数据导入**：支持房态CSV、保洁记录JSON、照片清单CSV导入
- **错误处理**：坏数据不直接吞掉，保留原始位置、失败原因和修改建议
- **批量操作**：失败时说明哪些成功、哪些失败，重试不破坏已成功记录
- **规则引擎**：自动检测照片缺失、评分过低、时长不足等问题
- **复核流程**：支持确认扣款、申诉、处理申诉等完整流程
- **结算管理**：自动生成月度结算，支持按保洁员明细导出
- **审计日志**：所有操作都有完整记录，便于月底对账核对

## 快速开始

### 环境要求

- Python 3.10+
- pip 或 poetry

### 安装依赖

```bash
pip install click rich sqlalchemy pydantic pandas python-dateutil
```

或使用 poetry：

```bash
poetry install
```

### 验证安装

```bash
python3 homestay_cli.py --help
```

## 完整使用流程

### 1. 导入数据

#### 导入房态数据（正常数据）

```bash
# 导入正常房态数据
python3 homestay_cli.py import-data room-status examples/room_status_normal.csv
```

#### 导入房态数据（含错误数据，演示错误处理）

```bash
# 导入含错误的房态数据，查看错误记录
python3 homestay_cli.py import-data room-status examples/room_status_with_errors.csv
```

**预期输出**：
- 显示成功导入和失败数量
- 列出具体错误（如房间号为空、日期格式无效、状态为空等）

#### 导入保洁记录

```bash
python3 homestay_cli.py import-data cleaning-records examples/cleaning_records_normal.json
```

#### 导入照片清单

```bash
python3 homestay_cli.py import-data photos examples/photos_normal.csv
```

### 2. 运行规则引擎自动检测问题

```bash
# 运行指定日期范围的规则引擎
python3 homestay_cli.py rules run 2024-01-01 2024-01-31
```

**自动检测规则**：
- 照片数量不足5张 → 自动生成扣款问题
- 保洁评分低于3分 → 自动生成质量问题
- 保洁时长少于30分钟 → 自动生成时长问题

### 3. 复核扣款

#### 查看待复核问题

```bash
python3 homestay_cli.py review list-pending
```

#### 确认扣款

```bash
# 确认问题ID为1的扣款
python3 homestay_cli.py review confirm 1 --notes "情况属实，扣款确认"
```

#### 申诉问题

```bash
# 对问题ID为2提出申诉
python3 homestay_cli.py review appeal 2 --reason "照片已上传，系统延迟"
```

#### 处理申诉

```bash
# 处理申诉，可调整扣款金额
python3 homestay_cli.py review resolve 2 --notes "申诉属实，调整扣款" --adjust-amount 10.0
```

### 4. 月度结算

#### 查看月度结算汇总

```bash
python3 homestay_cli.py settlement summary 2024-01
```

**显示内容**：
- 每位保洁员的保洁次数
- 基础金额（100元/次）
- 扣款总额
- 实发金额
- 结算状态

#### 确认结算单

```bash
# 确认结算单ID为1的结算
python3 homestay_cli.py settlement finalize 1
```

### 5. 导出数据

#### 导出月度结算报表

```bash
python3 homestay_cli.py export settlements 2024-01
```

#### 导出保洁记录

```bash
python3 homestay_cli.py export cleaning-records 2024-01-01 2024-01-31
```

#### 导出问题清单

```bash
python3 homestay_cli.py export issues
```

#### 导出导入错误记录

```bash
python3 homestay_cli.py export import-errors
```

#### 导出保洁员明细结算单

```bash
# 先获取保洁员ID，然后导出其1月份明细
python3 homestay_cli.py export settlement-detail 1 2024-01
```

## 数据文件格式说明

### 房态数据 (CSV)

| 字段 | 说明 | 必填 |
|------|------|------|
| room_number | 房间号 | 是 |
| date | 日期 (YYYY-MM-DD) | 是 |
| status | 房间状态 | 是 |
| guest_name | 客人姓名 | 否 |
| check_in | 入住日期 | 否 |
| check_out | 离店日期 | 否 |

### 保洁记录 (JSON)

```json
[
    {
        "room_number": "101",
        "cleaning_date": "2024-01-15",
        "cleaner_name": "王阿姨",
        "start_time": "2024-01-15 10:00:00",
        "end_time": "2024-01-15 10:45:00",
        "score": 4.5,
        "notes": "正常清洁完成"
    }
]
```

### 照片清单 (CSV)

| 字段 | 说明 | 必填 |
|------|------|------|
| file_name | 文件名 | 是 |
| room_number | 房间号 | 是 |
| uploaded_at | 上传时间 | 是 |
| photo_type | 照片类型 | 否 |
| file_path | 文件路径 | 否 |

## 错误处理机制

### 导入错误记录

当导入失败时，系统会自动记录：
- 原始文件位置（文件名、行号）
- 原始数据内容
- 具体错误信息
- 建议的修复方案

### 查看导入错误

```bash
# 导出所有未解决的导入错误
python3 homestay_cli.py export import-errors
```

## 月底对账流程

### 步骤1：导出结算报表

```bash
# 导出月度结算汇总
python3 homestay_cli.py export settlements 2024-01
```

### 步骤2：导出问题明细

```bash
# 导出所有问题记录
python3 homestay_cli.py export issues
```

### 步骤3：导出保洁记录

```bash
python3 homestay_cli.py export cleaning-records 2024-01-01 2024-01-31
```

### 步骤4：与历史操作核对

所有操作都有审计日志记录，可用于核对：
- 扣款确认记录
- 申诉处理记录
- 结算确认记录
- 数据导入记录

## 项目结构

```
.
├── src/
│   └── homestay_settlement/
│       ├── __init__.py
│       ├── models/              # 数据模型层
│       │   ├── __init__.py
│       │   ├── database.py      # 数据库连接
│       │   └── schemas.py       # 表结构定义
│       ├── importers/           # 数据导入层
│       │   ├── __init__.py
│       │   ├── base.py          # 基础导入器
│       │   ├── room_status_importer.py
│       │   ├── cleaning_record_importer.py
│       │   └── photo_importer.py
│       ├── services/            # 业务层
│       │   ├── __init__.py
│       │   ├── rule_engine.py   # 规则引擎
│       │   ├── review_service.py # 复核服务
│       │   └── settlement_service.py # 结算服务
│       ├── exporters/           # 导出层
│       │   ├── __init__.py
│       │   └── csv_exporter.py
│       └── cli/                 # 命令行接口
│           ├── __init__.py
│           └── main.py
├── examples/                    # 样例数据
│   ├── room_status_normal.csv
│   ├── room_status_with_errors.csv
│   ├── cleaning_records_normal.json
│   └── photos_normal.csv
├── output/                      # 导出文件目录（自动生成）
├── pyproject.toml
├── homestay_cli.py             # 入口脚本
└── README.md
```

## 数据库

数据库默认存储位置：`~/.homestay_settlement/settlement.db`

主要数据表：
- `room_statuses` - 房态记录
- `cleaners` - 保洁员信息
- `cleaning_records` - 保洁记录
- `photos` - 照片记录
- `issues` - 问题/扣款记录
- `reworks` - 返工记录
- `settlements` - 结算单
- `import_errors` - 导入错误记录
- `audit_logs` - 审计日志

## 命令一览

```bash
# 数据导入
python3 homestay_cli.py import-data room-status <文件路径>
python3 homestay_cli.py import-data cleaning-records <文件路径>
python3 homestay_cli.py import-data photos <文件路径>

# 规则引擎
python3 homestay_cli.py rules run <开始日期> <结束日期>

# 复核操作
python3 homestay_cli.py review list-pending [--cleaner-id <ID>]
python3 homestay_cli.py review confirm <问题ID> [--notes <备注>]
python3 homestay_cli.py review appeal <问题ID> --reason <申诉理由>
python3 homestay_cli.py review resolve <问题ID> --notes <处理意见> [--adjust-amount <金额>]

# 结算管理
python3 homestay_cli.py settlement summary <月份>  # 格式：YYYY-MM
python3 homestay_cli.py settlement finalize <结算单ID>

# 数据导出
python3 homestay_cli.py export settlements <月份>
python3 homestay_cli.py export cleaning-records <开始日期> <结束日期>
python3 homestay_cli.py export issues
python3 homestay_cli.py export import-errors
python3 homestay_cli.py export settlement-detail <保洁员ID> <月份>
```

## 样例数据演示

项目包含完整的样例数据，可直接运行测试：

```bash
# 1. 导入房态数据（含错误，演示错误处理）
python3 homestay_cli.py import-data room-status examples/room_status_with_errors.csv

# 2. 导入保洁记录
python3 homestay_cli.py import-data cleaning-records examples/cleaning_records_normal.json

# 3. 导入照片清单
python3 homestay_cli.py import-data photos examples/photos_normal.csv

# 4. 运行规则引擎，自动生成问题
python3 homestay_cli.py rules run 2024-01-01 2024-01-31

# 5. 查看待复核问题
python3 homestay_cli.py review list-pending

# 6. 生成月度结算
python3 homestay_cli.py settlement summary 2024-01
```

通过以上步骤，可以完整体验：
- 错误数据的捕获和记录
- 规则引擎自动检测问题
- 扣款和申诉流程
- 月度结算生成
