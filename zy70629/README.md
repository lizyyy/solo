# 借款展期还款计划扣款流水排查CLI

财务部门处理员工借款展期时，用于排查原单、还款计划和审批意见的命令行工具。

## 核心功能

### 数据解析
- 支持 CSV 和 Excel 格式文件
- 自动识别列名（支持中英文列名）
- 保留原始文件位置（行号、工作表名）
- 记录解析错误信息

### 规则检查
1. **计划重算检查** - 验证还款计划本金总额与借款金额是否一致
2. **展期审批检查** - 验证展期申请的审批流程完整性
3. **扣款幂等检查** - 检查是否存在重复扣款记录
4. **逾期标记检查** - 验证逾期记录是否正确标记
5. **计划金额一致性检查** - 验证本息和与总金额一致
6. **审批完整性检查** - 验证审批层级是否完整

### 来源追踪
- 每条记录都关联原始文件位置
- 记录原始内容快照
- 生成稳定标识用于重复运行比对

### 报告生成
- 摘要报告（Markdown格式）
- 违规明细报告（CSV格式）
- 来源追踪报告（CSV格式）
- 完整数据导出（JSON格式）

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 生成示例数据

```bash
loan-extension generate-sample ./sample_data
```

### 2. 执行排查检查

```bash
loan-extension check \
  --loan-file ./sample_data/loan_sample.csv \
  --plan-file ./sample_data/plan_sample.csv \
  --extension-file ./sample_data/extension_sample.csv \
  --approval-file ./sample_data/approval_sample.csv \
  --deduction-file ./sample_data/deduction_sample.csv \
  --report-file ./sample_data/report_sample.csv \
  --check-date 2024-04-01
```

### 命令选项

| 选项 | 说明 |
|------|------|
| `--loan-file` | 借款单文件路径 |
| `--plan-file` | 还款计划文件路径 |
| `--extension-file` | 展期申请文件路径 |
| `--approval-file` | 审批意见文件路径 |
| `--deduction-file` | 扣款流水文件路径 |
| `--report-file` | 还款报告文件路径 |
| `--output-dir` | 报告输出目录（默认: ./output） |
| `--check-date` | 检查基准日期（YYYY-MM-DD） |

## 输出文件

在 `--output-dir` 指定的目录下会生成以下文件：

1. `check_summary_<timestamp>.md` - 检查摘要报告
2. `violations_detail_<timestamp>.csv` - 违规明细
3. `source_tracking_<timestamp>.csv` - 来源追踪记录
4. `full_export_<timestamp>.json` - 完整数据导出

## 数据文件格式

### 借款单
- `loan_no` - 借款单号
- `employee_id` - 员工ID
- `employee_name` - 员工姓名
- `loan_amount` - 借款金额
- `loan_date` - 借款日期
- `loan_term_months` - 借款期限（月）
- `status` - 状态

### 还款计划
- `plan_id` - 计划ID
- `loan_no` - 借款单号
- `period_no` - 期号
- `due_date` - 到期日
- `principal_amount` - 本金
- `interest_amount` - 利息
- `total_amount` - 总金额
- `status` - 状态
- `is_extended` - 是否已展期

### 展期申请
- `application_id` - 申请ID
- `loan_no` - 借款单号
- `application_date` - 申请日期
- `extension_months` - 展期月数
- `new_due_date` - 新到期日
- `reason` - 原因
- `applicant` - 申请人

### 审批意见
- `approval_id` - 审批ID
- `application_id` - 申请ID
- `loan_no` - 借款单号
- `approver` - 审批人
- `approval_date` - 审批日期
- `approval_result` - 审批结果（通过/拒绝）
- `approval_comment` - 审批意见
- `approval_level` - 审批级别

### 扣款流水
- `deduction_id` - 扣款ID
- `loan_no` - 借款单号
- `deduction_date` - 扣款日期
- `deduction_amount` - 扣款金额
- `deduction_type` - 扣款类型
- `related_plan_id` - 关联计划ID
- `transaction_no` - 交易号

### 还款报告
- `report_id` - 报告ID
- `loan_no` - 借款单号
- `report_date` - 报告日期
- `total_principal_due` - 应还本金
- `total_interest_due` - 应还利息
- `total_paid` - 已还总额
- `remaining_principal` - 剩余本金
- `remaining_interest` - 剩余利息
- `is_overdue` - 是否逾期

## 项目结构

```
loan_extension_cli/
├── __init__.py
├── cli.py              # CLI入口
├── models/            # 数据模型
│   ├── __init__.py
│   └── base.py
├── parsers/           # 解析器
│   ├── __init__.py
│   ├── base_parser.py
│   └── record_parsers.py
├── rules/             # 规则引擎
│   ├── __init__.py
│   └── rule_engine.py
├── tracking/          # 来源追踪
│   ├── __init__.py
│   └── tracker.py
├── reports/           # 报告生成
│   ├── __init__.py
│   └── generator.py
└── utils/             # 工具函数
    └── __init__.py
```

## 稳定运行特性

1. **稳定标识** - 基于输入内容生成唯一的稳定标识，确保重复运行结果可比对
2. **来源可追溯** - 每条记录都保留原始文件位置，方便定位问题
3. **排序无关** - 输出结果按固定规则排序，不随输入顺序变化
4. **坏行保留** - 解析失败的行保留原始内容和错误信息

## 许可证

本工具仅供内部使用。
