# 充电桩巡检多源导入巡检 CLI

一个用于充电桩巡检数据多源导入、校验、修正和审计的命令行工具。

## 功能特性

- **多源数据导入**: 支持桩端告警、巡检表、客服投诉单、供应商对账单、离线工单、审批邮件等多种数据源
- **三种导入模式**: 忽略(ignore)、覆盖(overwrite)、追加(append)
- **数据校验**: 自动检查数据质量，生成失败清单
- **人工修正**: 支持逐行逐字段修正错误数据
- **审计历史**: 完整记录所有操作，支持回看前后差异
- **片区经理报告**: 重点展示原始行号、失败清单、修正记录
- **异步任务管理**: 支持等重试、等人工、永久失败三种状态
- **数据导出**: 支持 Excel、CSV、JSON 格式导出

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 初始化数据库

```bash
cpi init
```

### 2. 生成样例数据

```bash
python samples/generate_samples.py
```

### 3. 导入数据

```bash
# 导入桩端告警
python3 -m cpi_cli.main import-data pile_alarm samples/pile_alarms.xlsx --operator 张工

# 导入巡检表
python3 -m cpi_cli.main import-data inspection samples/inspections.xlsx --mode append

# 指定导入模式
python3 -m cpi_cli.main import-data pile_alarm samples/pile_alarms.xlsx --mode ignore  # 忽略重复
python3 -m cpi_cli.main import-data pile_alarm samples/pile_alarms.xlsx --mode overwrite  # 覆盖更新
```

### 4. 检查数据质量

```bash
# 查看所有批次
cpi check

# 查看指定批次详情
cpi check <批次号> --show-errors

# 只看错误级别
cpi check <批次号> --level error
```

### 5. 人工修正数据

```bash
# 查看待修复错误
cpi fix <批次号>

# 修复指定错误
cpi fix <批次号> --row-no 4 --field pile_id --value "P003" --operator 李工
```

### 6. 生成片区经理报告

```bash
# 表格形式展示
cpi report

# 导出为 Excel
cpi report --format excel --output 报告.xlsx

# 按数据源筛选
cpi report --source-type pile_alarm
```

### 7. 查看审计历史

```bash
# 查看批次历史
cpi history <批次号>

# 查看指定记录历史
cpi history --record-id 1

# 显示详细差异
cpi history <批次号> --show-diff
```

### 8. 导出数据

```bash
# 导出为 Excel
cpi export pile_alarm --format excel

# 导出指定批次
cpi export pile_alarm --batch-no <批次号> --format csv
```

### 9. 异步任务管理

```bash
# 列出所有任务
cpi task list

# 重试任务
cpi task retry <任务ID>

# 标记为永久失败
cpi task fail <任务ID> --reason "数据不可修复"
```

## 数据源类型

| 类型 | 说明 |
|------|------|
| `pile_alarm` | 桩端告警 |
| `inspection` | 巡检表 |
| `complaint` | 客服投诉单 |
| `supplier_bill` | 供应商对账单 |
| `offline_work_order` | 离线告警工单 |
| `approval_email` | 审批邮件 |

## 数据存储位置

- 数据库: `~/.cpi/cpi.db`
- 导出文件: `~/.cpi/exports/`

## 演示

运行完整演示脚本:

```bash
chmod +x DEMO.sh
./DEMO.sh
```

## 命令帮助

```bash
cpi --help
cpi import --help
cpi check --help
```
