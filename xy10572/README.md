# 发薪异常解释 CLI (Salary Checker)

一套实用的发薪前核对工具，帮助薪酬专员在发薪前检查工资、请假、补贴、扣款、个税和银行回盘异常，确保每个员工都能清晰解释"为什么这个月发这么多"。

---

## 功能特性

### 核心命令
| 命令 | 功能 |
|------|------|
| `init` | 初始化项目，创建配置文件和数据目录 |
| `import` | 导入数据（支持内置样例或自定义JSON） |
| `check` | 执行规则检查，发现异常 |
| `detail` | 查看异常详情、历史记录、失败原因 |
| `report` | 生成最终报告（阻断/提醒/已处理/个人明细） |
| `resolve` | 人工标记异常为已处理，记录差异和操作者 |
| `clear` | 清除数据（用于幂等性测试） |

### 内置规则
1. **请假跨月检测** - 检测请假单跨月情况，确保归属月份正确
2. **补贴上限检查** - 各类型补贴不得超过预设上限
3. **扣款依据验证** - 扣款必须有有效类型、原因和审批人
4. **个税异常检查** - 个税金额不得为负数
5. **银行回盘异常** - 检测银行打款失败，区分可重试和不可重试
6. **社保公积金计算** - 验证与预期比例的一致性
7. **旷工扣款检查** - 旷工必须有对应扣款记录

### 关键特性
- ✅ **幂等性保证** - 重复导入/检查不会产生重复数据
- ✅ **历史记录** - 所有操作都有时间戳和记录
- ✅ **人工修正追踪** - 记录变更前后的值、操作人、原因
- ✅ **多种输出格式** - 控制台表格 + JSON
- ✅ **内置样例** - 3种员工类型，7种异常场景
- ✅ **业务闭环判断** - 清晰展示"可以发薪"还是"暂缓发薪"

---

## 快速开始

### 1. 环境准备

```bash
# 确认 Python 版本 (>= 3.8)
python3 --version

# 安装依赖
pip3 install -r requirements.txt

# 或作为包安装
pip3 install -e .
```

### 2. 初始化项目

```bash
# 使用入口脚本
python3 salary.py init

# 或安装后直接使用
salary init
```

输出：
```
✓ 初始化完成
  配置文件: salary_checker.json
  数据目录: .salary_data

下一步:
  1. 使用 'salary import --sample' 导入样例数据
  2. 或使用 'salary import --file <path> --type <type> --month <YYYY-MM>' 导入自己的数据
```

### 3. 导入样例数据

```bash
python3 salary.py import --sample
```

样例数据包含：
- 5名员工（正式3人、离职1人、实习生1人）
- 7种预置异常场景
- 月份：2024-03

### 4. 执行检查

```bash
python3 salary.py check --month 2024-03
```

### 5. 查看详情

```bash
# 查看所有异常
python3 salary.py detail --month 2024-03

# 查看指定员工
python3 salary.py detail --month 2024-03 --employee EMP002

# 只看待处理异常
python3 salary.py detail --month 2024-03 --status pending
```

### 6. 生成报告

```bash
# 控制台输出
python3 salary.py report --month 2024-03

# JSON 输出
python3 salary.py report --month 2024-03 --output json

# 单个员工明细
python3 salary.py report --month 2024-03 --employee EMP001
```

### 7. 人工处理异常

```bash
# 标记异常为已处理（需要先从 detail 中获取 anomaly-id）
python3 salary.py resolve \
  --month 2024-03 \
  --anomaly-id xxxxxxxxxxxx \
  --operator 薪酬专员小王 \
  --reason "已联系银行确认账号信息" \
  --before-value "账号无效" \
  --after-value "已更新正确账号"
```

---

## 主要演示路径（成功路径）

### 路径一：完整发薪核对流程

```bash
# Step 1: 初始化
python3 salary.py init

# Step 2: 导入样例数据
python3 salary.py import --sample

# Step 3: 执行检查，发现异常
python3 salary.py check --month 2024-03

# Step 4: 查看李四（EMP002）的详细异常
python3 salary.py detail --month 2024-03 --employee EMP002

# Step 5: 处理个税异常（假设是系统计算错误）
python3 salary.py resolve \
  --month 2024-03 \
  --anomaly-id <从detail中获取TAX_NEGATIVE的异常ID> \
  --operator 薪酬主管 \
  --reason "本月累计扣除超出，个税确认为0" \
  --before-value "-50" \
  --after-value "0"

# Step 6: 处理补贴超上限（假设是特殊审批）
python3 salary.py resolve \
  --month 2024-03 \
  --anomaly-id <从detail中获取ALLOWANCE_OVER_LIMIT的异常ID> \
  --operator 薪酬主管 \
  --reason "经总监特批，住房补贴临时上浮" \
  --before-value "6000" \
  --after-value "6000（特批）"

# Step 7: 处理扣款无依据（补充审批）
python3 salary.py resolve \
  --month 2024-03 \
  --anomaly-id <从detail中获取DEDUCTION_NO_BASIS的异常ID> \
  --operator 薪酬主管 \
  --reason "已补充迟到扣款依据，由部门经理审批" \
  --before-value "无原因无审批" \
  --after-value "已补充"

# Step 8: 处理银行账号失败（联系员工更新）
python3 salary.py resolve \
  --month 2024-03 \
  --anomaly-id <从detail中获取BANK_ACCOUNT_FAILED的异常ID> \
  --operator 薪酬主管 \
  --reason "员工已提供新账号，将在补发批次中发放" \
  --before-value "账号无效" \
  --after-value "待补发"

# Step 9: 生成最终报告
python3 salary.py report --month 2024-03
```

### 路径二：无异常的正常流程

```bash
# 初始化
python3 salary.py init

# 导入干净数据（实际场景中使用自己的正常数据）
python3 salary.py import --sample

# （假设所有异常已在系统中修复）
# 直接检查和报告
python3 salary.py check --month 2024-03
python3 salary.py report --month 2024-03
```

---

## 失败路径演示

### 场景：张三（EMP001）的完整异常

执行 `python3 salary.py check --month 2024-03` 后，张三的检查结果：

```
检查: 张三 (EMP001) - 正式员工
  [WARN] 请假跨月
    请假单 LEV001 跨月，类型: 年假, 时长: 3天
```

**业务解释**：
- 张三的年假从2月28日开始，到3月2日结束
- 涉及跨月归属问题，2月算1天，3月算2天
- 系统标记为 **警告**（可继续发薪，但需关注）

### 场景：李四（EMP002）的严重异常

执行检查后，李四的检查结果：

```
检查: 李四 (EMP002) - 正式员工
  [BLOCK] 补贴超过上限
    补贴类型 housing 总额 6000 超过上限 5000
  [BLOCK] 扣款无依据
    扣款 DED006 存在问题: 缺少扣款原因, 缺少审批人
  [BLOCK] 个税为负
    个税金额为负: -50
  [BLOCK] 银行账号失败
    银行打款失败: 账号不存在或已销户. 重试次数: 2/3
  [WARN] 旷工缺少扣款
    旷工 1 天但无对应扣款
```

**业务影响**：
- 4个 **阻断性异常** + 1个 **警告性异常**
- 系统判定：**暂缓发薪**
- 需要逐一处理后才能正常发薪

---

## 样例数据详细说明

### 员工列表

| 员工ID | 姓名 | 类型 | 部门 | 预置异常 |
|--------|------|------|------|----------|
| EMP001 | 张三 | 正式员工 | 技术部 | 请假跨月 |
| EMP002 | 李四 | 正式员工 | 市场部 | 补贴超上限、个税为负、扣款无依据、银行失败、旷工无扣款 |
| EMP003 | 王五 | 离职员工 | 人事部 | 部分月份结算 |
| EMP004 | 赵六 | 实习生 | 财务部 | 无社保公积金 |
| EMP005 | 孙七 | 正式员工 | 技术部 | 银行失败可重试 |

### 预置异常场景

1. **请假跨月**（EMP001）
   - 年假：2024-02-28 ~ 2024-03-02
   - 影响：归属月份需要拆分

2. **补贴超过上限**（EMP002）
   - 住房补贴：6000元
   - 配置上限：5000元
   - 超出：1000元

3. **扣款无依据**（EMP002）
   - 扣款类型：late_deduction
   - 金额：500元
   - 问题：原因为空，无审批人

4. **个税为负**（EMP002）
   - 本月税额：-50元
   - 问题：异常计算结果

5. **银行账号失败（阻断）**（EMP002）
   - 错误：账号不存在或已销户
   - 重试：2/3次（达到阈值，标记为阻断）

6. **银行打款失败（可重试）**（EMP005）
   - 错误：账户余额不足
   - 重试：1/3次（还可重试，标记为警告）

7. **旷工缺少扣款**（EMP002）
   - 旷工：1天
   - 问题：无 absent_deduction 记录

---

## 自定义数据导入

### 数据格式说明

所有数据文件必须是 **JSON 数组** 格式。

### 1. 员工数据 (employees)

```json
[
  {
    "emp_id": "EMP001",
    "name": "张三",
    "employee_type": "full_time",
    "department": "技术部",
    "bank_account": "6222021234567890001",
    "bank_name": "工商银行"
  }
]
```

- `employee_type`: `full_time`(正式) / `part_time`(实习) / `terminated`(离职)

### 2. 工资项数据 (salary_items)

```json
[
  {
    "emp_id": "EMP001",
    "month": "2024-03",
    "base_salary": 15000,
    "overtime": 1500,
    "performance": 3000,
    "other_allowance": 500
  }
]
```

### 3. 考勤数据 (attendances)

```json
[
  {
    "emp_id": "EMP001",
    "month": "2024-03",
    "work_days": 21,
    "absent_days": 0,
    "late_times": 2
  }
]
```

### 4. 请假数据 (leaves)

```json
[
  {
    "leave_id": "LEV001",
    "emp_id": "EMP001",
    "leave_type": "年假",
    "start_date": "2024-02-28",
    "end_date": "2024-03-02",
    "days": 3,
    "is_approved": true
  }
]
```

### 5. 补贴数据 (allowances)

```json
[
  {
    "allowance_id": "ALW001",
    "emp_id": "EMP001",
    "month": "2024-03",
    "allowance_type": "transportation",
    "amount": 800,
    "approved_by": "HR001"
  }
]
```

- `allowance_type`: `transportation` / `housing` / `meal` / `communication` / `overtime_meal`

### 6. 扣款数据 (deductions)

```json
[
  {
    "deduction_id": "DED001",
    "emp_id": "EMP001",
    "month": "2024-03",
    "deduction_type": "social_insurance",
    "amount": 1575,
    "reason": "当月社保个人缴纳部分",
    "approved_by": "HR001"
  }
]
```

- `deduction_type`: `social_insurance` / `housing_fund` / `tax` / `absent_deduction` / `late_deduction` / `loan_repayment` / `damage_compensation`

### 7. 个税数据 (taxes)

```json
[
  {
    "emp_id": "EMP001",
    "month": "2024-03",
    "tax_amount": 450,
    "taxable_income": 15000,
    "cumulative_tax": 1350
  }
]
```

### 8. 银行回盘数据 (bank_responses)

```json
[
  {
    "response_id": "BANK001",
    "emp_id": "EMP001",
    "month": "2024-03",
    "status": "success",
    "error_code": null,
    "error_message": null,
    "retry_count": 0,
    "last_attempt": "2024-03-25 09:30:00"
  }
]
```

- `status`: `success` / `failed` / `pending` / `retrying`

### 导入命令

```bash
# 从文件导入
python3 salary.py import --file employees.json --type employees --month 2024-03

# 批量导入
python3 salary.py import --file salary_items.json --type salary_items --month 2024-03
python3 salary.py import --file attendances.json --type attendances --month 2024-03
python3 salary.py import --file taxes.json --type taxes --month 2024-03
```

---

## 配置说明

### salary_checker.json

```json
{
  "data_dir": ".salary_data",
  "rules": {
    "allowance_limits": {
      "transportation": 1000,
      "housing": 5000,
      "meal": 800,
      "communication": 300,
      "overtime_meal": 200
    },
    "deduction_types": [
      "social_insurance",
      "housing_fund",
      "tax",
      "absent_deduction",
      "late_deduction",
      "loan_repayment",
      "damage_compensation"
    ],
    "bank_retry_max": 3
  },
  "employee_types": {
    "full_time": {
      "name": "正式员工",
      "tax_base": 5000,
      "social_insurance_rate": 0.105,
      "housing_fund_rate": 0.12
    },
    "part_time": {
      "name": "实习生",
      "tax_base": 800,
      "social_insurance_rate": 0,
      "housing_fund_rate": 0
    },
    "terminated": {
      "name": "离职员工",
      "tax_base": 5000,
      "social_insurance_rate": 0.105,
      "housing_fund_rate": 0.12
    }
  }
}
```

可根据实际业务调整：
- 补贴上限金额
- 合法扣款类型
- 银行最大重试次数
- 员工类型配置

---

## 幂等性说明

系统设计保证 **重复操作不会产生副作用**：

### 1. 数据导入幂等
- 每次导入前检查是否已存在相同ID的记录
- 如果存在且内容相同：标记为 `unchanged`
- 如果存在但内容不同：标记为 `updated`
- 如果不存在：标记为 `created`

### 2. 检查执行幂等
- 每次 `check` 会重新生成异常记录
- 旧异常记录保留在历史中
- 报告只统计 `pending` 状态的异常

### 3. 幂等性测试

```bash
# 第一次导入
python3 salary.py import --sample

# 第二次导入（相同数据）
python3 salary.py import --sample
# 结果：全部 unchanged

# 清除后重新导入
python3 salary.py clear --month 2024-03 --force
python3 salary.py import --sample
# 结果：全部 created
```

---

## 数据存储结构

```
.salary_data/
├── employees/           # 员工信息（按月存储）
├── salary_items/        # 工资项（按月存储）
├── attendances/         # 考勤数据（按月存储）
├── leaves/              # 请假记录（全局存储）
├── allowances/          # 补贴（按月存储）
├── deductions/          # 扣款（按月存储）
├── taxes/               # 个税（按月存储）
├── bank_responses/      # 银行回盘（按月存储）
├── anomalies/           # 异常记录（按月存储）
├── corrections/         # 人工修正记录（按月存储）
├── import_records/      # 导入历史（按月存储）
└── check_runs/          # 检查运行记录（按月存储）
```

每个文件都是独立的 JSON 文件，便于审计和追溯。

---

## 报告输出示例

### 控制台输出摘要

```
================================================================================
  发薪异常报告 - 2024-03
  生成时间: 2024-03-25 15:30:00
================================================================================

  一、业务闭环状态判断
--------------------------------------------------------------------------------

  ❌ 状态: 业务未闭环 - 存在阻断性异常，建议暂缓发薪

┌────────────────────────────────────────────────────┐
│ 员工总数                │ 5                         │
│ 需阻断发薪              │ 1 (李四)                 │
│ 需提醒关注              │ 2 (张三、孙七)           │
│ 可正常发薪              │ 2 (王五、赵六)           │
│ 待处理异常总数          │ 7                         │
│ 阻断性异常              │ 4                         │
│ 警告性异常              │ 3                         │
│ 已处理异常              │ 0                         │
└────────────────────────────────────────────────────┘
```

### JSON 输出示例

```json
{
  "month": "2024-03",
  "generated_at": "2024-03-25 15:30:00",
  "summary": {
    "total_employees": 5,
    "blocked_employees": 1,
    "warned_employees": 2,
    "clear_employees": 2,
    "total_anomalies": 7,
    "blocker_anomalies": 4,
    "warning_anomalies": 3,
    "resolved_anomalies": 0
  },
  "blocked_employees": ["EMP002"],
  "warned_employees": ["EMP001", "EMP005"],
  "clear_employees": ["EMP003", "EMP004"],
  "employee_details": {
    "EMP002": {
      "name": "李四",
      "employee_type": "full_time",
      "department": "市场部",
      "blocker_count": 4,
      "warning_count": 1,
      "anomalies": [...]
    }
  }
}
```

---

## 业务闭环判断标准

系统根据以下规则判断是否可以发薪：

### 可以发薪（业务闭环）
- 无 `blocker` 级别的待处理异常
- `warning` 级别异常可以继续，但需关注

### 暂缓发薪（业务未闭环）
- 存在任意 `blocker` 级别的待处理异常
- 必须处理后才能正常发薪

### 阻断性异常 (Blocker)
- 补贴超过上限
- 扣款无依据（无类型/原因/审批人）
- 个税金额为负
- 银行账号失败且重试次数达到上限

### 警告性异常 (Warning)
- 请假跨月
- 银行打款失败但仍可重试
- 社保公积金计算与预期有差异
- 旷工但无对应扣款记录

---

## 故障排查

### 问题1：初始化提示文件已存在
```bash
# 解决：使用 --force 强制初始化
python3 salary.py init --force
```

### 问题2：导入失败
检查：
1. JSON 格式是否正确
2. 必填字段是否完整
3. 月份格式是否为 `YYYY-MM`

### 问题3：检查时提示无员工数据
```bash
# 确认已导入员工数据
python3 salary.py import --sample
```

### 问题4：清除数据时被询问确认
```bash
# 使用 --force 跳过确认
python3 salary.py clear --month 2024-03 --force
```

---

## 命令参考

```bash
# 查看帮助
python3 salary.py --help
python3 salary.py check --help
python3 salary.py report --help

# 版本信息
python3 salary.py --version
```

---

## 项目结构

```
xy10572/
├── salary.py                 # 入口脚本
├── requirements.txt          # 依赖列表
├── setup.py                  # 安装配置
├── README.md                 # 本文档
└── salary_checker/
    ├── __init__.py           # 包初始化
    ├── cli.py                # CLI 命令实现
    ├── config.py             # 配置管理
    ├── models.py             # 数据模型
    ├── storage.py            # 存储管理
    ├── rules.py              # 规则引擎
    ├── data_import.py        # 数据导入
    └── sample_data.py        # 样例数据
```

---

## License

本工具仅用于演示和学习目的。
