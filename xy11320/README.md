# 农机合作社财务管理系统

专为农机合作社设计的财务管理工具，支持拖拉机按小时、亩数、油费混合计费，提供数据导入、复核、导出全流程管理。

## 功能特性

- ✅ **多模式计费**：按时计费、按亩计费、按油计费、混合计费
- ✅ **数据校验**：自动检测缺失字段、格式错误、金额不匹配等问题
- ✅ **批量导入**：Excel批量导入，详细记录成功/失败状态
- ✅ **失败重试**：支持对导入失败记录进行修正后重试，不影响已成功记录
- ✅ **复核流程**：支持单条或批量复核记录，记录复核意见
- ✅ **多维度筛选**：按负责人、时间、状态、异常类型等筛选
- ✅ **导出报告**：导出与查询条件一致的Excel报告
- ✅ **操作日志**：完整记录所有操作，月底对账可追溯

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install pandas openpyxl python-dateutil
```

### 2. 生成样例数据

```bash
python generate_samples.py
```

将生成以下样例文件：
- `sample_normal.xlsx` - 5条正常数据
- `sample_mixed.xlsx` - 6条混合数据（含5条异常）
- `sample_batch.xlsx` - 20条批量测试数据

### 3. 数据导入

```bash
# 导入正常数据
python cli.py import sample_normal.xlsx --operator 财务小王

# 导入混合数据（含异常）
python cli.py import sample_mixed.xlsx --operator 财务小王
```

导入结果将显示：
- 批次ID（用于后续操作）
- 成功/失败数量统计
- 每条记录的详细状态和异常原因

### 4. 查看导入批次

```bash
# 查看批次详情
python cli.py batch --batch_id <你的批次ID>
```

### 5. 重试失败记录

```bash
# 重试该批次的失败记录
python cli.py retry <你的批次ID> --operator 财务小王
```

### 6. 查询记录

```bash
# 查询所有记录
python cli.py query

# 按机手筛选
python cli.py query --operator 张三

# 按状态筛选
python cli.py query --status imported

# 按异常类型筛选
python cli.py query --exception_type missing_field

# 按日期范围筛选
python cli.py query --start_date 2024-05-01 --end_date 2024-05-10
```

### 7. 复核记录

```bash
# 查看待复核记录
python cli.py review --reviewer 李主管

# 单条复核通过
python cli.py review --record_id 1 --reviewer 李主管 --approved --comment "数据核对无误"

# 单条复核驳回
python cli.py review --record_id 2 --reviewer 李主管 --comment "金额异常，请核实"

# 批量复核批次内所有记录
python cli.py review --batch_id <批次ID> --reviewer 李主管 --approved
```

### 8. 导出报告

```bash
# 导出所有记录
python cli.py export report_all.xlsx

# 按机手导出
python cli.py export report_zhangsan.xlsx --operator 张三

# 按状态导出已复核记录
python cli.py export report_reviewed.xlsx --status reviewed

# 按日期范围导出月度报表
python cli.py export report_may.xlsx --start_date 2024-05-01 --end_date 2024-05-31

# 导出异常记录进行处理
python cli.py export report_errors.xlsx --exception_type calculation_error
```

### 9. 查看操作日志

```bash
# 查看所有日志
python cli.py logs

# 查看指定记录的操作日志
python cli.py logs --record_id 1

# 查看指定批次的操作日志
python cli.py logs --batch_id <批次ID>
```

### 10. 计费计算器

```bash
# 按时计费
python cli.py calculate --billing_type hourly --hours 8 --hourly_rate 150

# 按亩计费
python cli.py calculate --billing_type by_area --area 50 --area_rate 60

# 按油计费
python cli.py calculate --billing_type fuel --fuel 100 --fuel_price 7.5

# 混合计费
python cli.py calculate --billing_type mixed --hours 6 --hourly_rate 200 --area 30 --area_rate 50 --fuel 50 --fuel_price 7.5
```

## 数据格式说明

### Excel导入字段

| 字段名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| record_no | 是 | 记录编号（唯一） | REC001 |
| tractor_no | 是 | 拖拉机编号 | TRACTOR01 |
| operator | 是 | 机手姓名 | 张三 |
| work_date | 是 | 作业日期（YYYY-MM-DD） | 2024-05-01 |
| work_type | 是 | 作业类型 | 耕地/播种/收割 |
| billing_type | 是 | 计费类型 | hourly/by_area/fuel/mixed |
| hours | 否 | 小时数 | 8 |
| hourly_rate | 否 | 小时单价（元） | 150 |
| area | 否 | 亩数 | 50 |
| area_rate | 否 | 亩单价（元） | 60 |
| fuel_consumption | 否 | 油耗（升） | 100 |
| fuel_price | 否 | 油价（元/升） | 7.5 |
| total_amount | 否 | 总金额（系统自动计算） | 1200 |

### 计费类型说明

| 计费类型 | 说明 | 所需字段 |
|----------|------|----------|
| hourly | 按时计费 | hours, hourly_rate |
| by_area | 按亩计费 | area, area_rate |
| fuel | 按油计费 | fuel_consumption, fuel_price |
| mixed | 混合计费 | 至少提供一种计费方式的字段 |

### 状态流转

```
draft → imported → validated → reviewed → exported
               ↓
            rejected
```

- `draft`：草稿（数据校验失败）
- `imported`：已导入，待复核
- `validated`：重试后校验通过
- `reviewed`：已复核通过
- `rejected`：已驳回
- `exported`：已导出

### 异常类型

| 异常类型 | 说明 |
|----------|------|
| missing_field | 缺少必填字段 |
| invalid_value | 字段值无效 |
| duplicate | 记录编号重复 |
| calculation_error | 金额计算不匹配 |
| rule_violation | 违反业务规则 |
| import_error | 导入过程错误 |

## 月底对账流程

1. **导出指定月份数据**
   ```bash
   python cli.py export report_202405.xlsx --start_date 2024-05-01 --end_date 2024-05-31
   ```

2. **核对导出数据与历史操作**
   ```bash
   # 查看该月份所有操作日志
   python cli.py logs --action_type import
   python cli.py logs --action_type review
   python cli.py logs --action_type export
   ```

3. **按机手统计汇总**
   ```bash
   python cli.py query --operator 张三 --start_date 2024-05-01 --end_date 2024-05-31
   ```

4. **核对异常记录处理情况**
   ```bash
   python cli.py query --exception_type calculation_error
   ```

## 典型使用场景

### 场景1：日常数据导入与复核

```bash
# 1. 每日收集机手手写单，整理成Excel
# 2. 批量导入
python cli.py import daily_20240520.xlsx --operator 财务小王

# 3. 查看导入结果，处理异常
python cli.py batch --batch_id <批次ID>

# 4. 主管复核
python cli.py review --batch_id <批次ID> --reviewer 李主管 --approved
```

### 场景2：发现数据错误需要修正

```bash
# 1. 查询异常记录
python cli.py query --exception_type missing_field

# 2. 在系统外修正Excel数据
# 3. 重新导入（注意使用新的记录编号）
# 或使用重试功能
python cli.py retry <批次ID> --operator 财务小王
```

### 场景3：月底结账

```bash
# 1. 导出本月所有已复核记录
python cli.py export may_final.xlsx --start_date 2024-05-01 --end_date 2024-05-31 --status reviewed

# 2. 按机手分别导出
for name in 张三 李四 王五; do
    python cli.py export "may_${name}.xlsx" --operator "$name" --start_date 2024-05-01 --end_date 2024-05-31
done

# 3. 查看本月操作日志进行审计
python cli.py logs --action_type review
```

## 项目结构

```
.
├── README.md           # 本文档
├── requirements.txt    # 依赖列表
├── cli.py             # 命令行工具
├── storage.py         # 存储层（数据库模型）
├── business.py        # 业务层（计费、导入、复核、导出）
├── generate_samples.py # 样例数据生成脚本
└── agri_finance.db    # SQLite数据库（运行后自动生成）
```

## 数据库表结构

### work_records（作业记录表）
- 核心业务表，存储所有作业记录
- 包含计费详情、状态、复核信息、异常信息

### import_batches（导入批次表）
- 记录每次批量导入的批次信息
- 包含成功/失败数量统计

### import_results（导入结果表）
- 记录每条导入记录的详细结果
- 支持失败重试追踪

### action_logs（操作日志表）
- 记录所有用户操作
- 支持审计和追溯

## 注意事项

1. **记录编号唯一性**：`record_no` 必须全局唯一，重复导入会被检测为重复记录
2. **日期格式**：必须使用 `YYYY-MM-DD` 格式，如 `2024-05-01`
3. **失败重试**：重试操作只会重新校验失败记录，不会影响已成功导入的记录
4. **数据备份**：定期备份 `agri_finance.db` 数据库文件
5. **权限管理**：建议财务人员和主管使用不同的操作人标识，便于日志追溯

## 故障排查

### 导入失败
- 检查Excel文件格式是否正确
- 查看返回的异常详情字段
- 确认必填字段是否都已填写

### 金额计算不符
- 检查计费类型是否与提供字段匹配
- 使用 `calculate` 命令手动验证计算结果
- 混合计费时确认各组件都已正确提供

### 数据库损坏
- 删除 `agri_finance.db` 文件，系统会自动重建
- 如有备份，恢复备份文件

## 技术支持

如遇到问题，请检查：
1. Python版本（建议3.8+）
2. 依赖包是否正确安装
3. Excel文件格式是否符合要求

## 许可证

本项目仅供农机合作社内部使用。
