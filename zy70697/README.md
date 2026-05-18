# 车位转租门禁授权费用分摊排查 CLI

本地命令行工具，用于处理业主短期转租车位时的租期校验、费用分摊、门禁授权、提前终止和报告导出。

## 功能特性

### 核心功能
- ✅ **租期校验** - 检查日期有效性、租期冲突、租期过期
- ✅ **费用分摊** - 按天计算租金，自动计算物业分成和业主收入
- ✅ **门禁授权** - 管理门禁状态和授权/撤销日期
- ✅ **提前终止** - 计算提前终止的退款金额
- ✅ **报告导出** - 生成多种格式的排查报告

### 架构特点
- ✅ **模块化设计** - 解析、规则判断、来源追踪、报告生成各模块独立
- ✅ **坏行保留** - 保留原始文件位置（行号）和原始数据
- ✅ **结果稳定** - 按record_id排序，重复运行结果一致
- ✅ **缓存机制** - 对比上一次运行，检测新增/删除/修改的记录

## 安装依赖

```bash
pip3 install click pandas openpyxl python-dateutil
```

## 快速开始

### 1. 生成示例数据
```bash
python3 main.py sample
```

### 2. 检查数据并生成报告
```bash
python3 main.py check sample_sublease.csv
```

### 3. 仅验证数据格式
```bash
python3 main.py validate sample_sublease.csv
```

## 命令详解

### check - 检查数据并生成报告

```bash
python3 main.py check <文件路径> [选项]
```

**选项:**
- `-o, --output-dir TEXT` - 报告输出目录 (默认: ./reports)
- `-p, --property-fee-rate FLOAT` - 物业费率 (默认: 0.1 = 10%)
- `-d, --check-date TEXT` - 检查日期，格式: YYYY-MM-DD (默认: 今天)
- `--no-cache` - 不使用缓存，强制重新处理

**示例:**
```bash
# 使用指定检查日期
python3 main.py check sample_sublease.csv --check-date 2025-03-01

# 自定义物业费率
python3 main.py check sample_sublease.csv --property-fee-rate 0.15

# 强制重新处理
python3 main.py check sample_sublease.csv --no-cache
```

### terminate - 提前终止转租记录

```bash
python3 main.py terminate <文件路径> <记录ID> <终止日期>
```

**示例:**
```bash
python3 main.py terminate sample_sublease.csv R001 2025-02-28
```

### validate - 仅验证数据格式

```bash
python3 main.py validate <文件路径>
```

### sample - 生成示例数据文件

```bash
python3 main.py sample
```

## 数据文件格式

### CSV/Excel 列说明

| 列名 | 必填 | 说明 |
|------|------|------|
| record_id | 是 | 记录唯一标识 |
| space_id | 是 | 车位编号 |
| owner_id | 是 | 业主ID |
| owner_name | 是 | 业主姓名 |
| tenant_id | 是 | 承租人ID |
| tenant_name | 是 | 承租人姓名 |
| tenant_phone | 是 | 承租人电话 |
| start_date | 是 | 开始日期 (YYYY-MM-DD) |
| end_date | 是 | 结束日期 (YYYY-MM-DD) |
| monthly_fee | 是 | 月租金 |
| actual_terminate_date | 否 | 实际终止日期 |
| access_grant_date | 否 | 门禁授权日期 |
| access_revoke_date | 否 | 门禁撤销日期 |

## 生成的报告

运行 `check` 命令后会在 reports 目录下生成以下文件：

1. **summary_report_YYYYMMDD_HHMMSS.json** - 完整汇总报告（JSON格式）
2. **sublease_report_YYYYMMDD_HHMMSS.csv** - 转租明细报告
3. **validation_report_YYYYMMDD_HHMMSS.csv** - 校验结果报告
4. **owner_summary_YYYYMMDD_HHMMSS.csv** - 业主汇总报告
5. **bad_records_YYYYMMDD_HHMMSS.csv** - 坏记录详情（如有错误）

## 项目结构

```
parking_sublease_cli/
├── __init__.py
├── cli.py                    # CLI入口
└── core/
    ├── __init__.py
    ├── models.py             # 数据模型和枚举
    ├── parser.py             # 数据解析模块
    ├── rules.py              # 规则引擎模块
    ├── tracker.py            # 来源追踪模块
    └── reporter.py           # 报告生成模块
```

## 模块说明

### models.py
定义数据模型：
- `LeaseStatus` - 租期状态枚举（有效/日期无效/租期冲突/已提前终止/已过期）
- `AccessStatus` - 门禁状态枚举（未授权/已授权/已撤销/授权过期）
- `SubleaseRecord` - 转租记录数据类
- `ValidationResult` - 校验结果数据类
- `BadRecord` - 坏记录数据类
- `SourceInfo` - 来源信息数据类

### parser.py
数据解析模块，支持：
- CSV和Excel文件解析
- 多种日期格式自动识别
- 坏记录捕获和原始数据保留
- 行号追踪

### rules.py
规则引擎模块，处理：
- 租期日期验证
- 租期重叠检测
- 费用分摊计算（按月租/30天计算日租金）
- 门禁状态管理
- 提前终止处理和退款计算

### tracker.py
来源追踪模块：
- 文件哈希计算和变更检测
- 记录级别的变更追踪（新增/删除/修改）
- 数据溯源（记录来源文件和行号）

### reporter.py
报告生成模块：
- 生成多种格式的排查报告
- 控制台输出摘要
- 按record_id排序保证稳定性

## 门禁状态判定规则

门禁状态按以下优先级判定（检查日期为准）：

1. **已撤销 (REVOKED)** - 最高优先级
   - 有 `access_revoke_date` 且撤销日期 ≤ 检查日期
   
2. **已授权 (GRANTED)**
   - 有 `access_grant_date` 且授权日期 ≤ 检查日期
   - 且租期未结束（检查日期 ≤ 租期结束日期）
   
3. **授权过期 (EXPIRED)**
   - 有 `access_grant_date` 且授权日期 ≤ 检查日期
   - 但租期已结束
   
4. **未授权 (NOT_GRANTED)**
   - 无有效授权日期或授权未生效

## 稳定性保证

1. **排序稳定** - 所有输出按`record_id`排序
2. **来源追踪** - 每条记录保留源文件路径和行号
3. **缓存对比** - 重复运行时检测数据变更
4. **坏行隔离** - 解析错误不影响正常记录处理
