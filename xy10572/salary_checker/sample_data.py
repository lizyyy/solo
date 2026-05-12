from typing import Dict, List, Any


SAMPLE_MONTH = "2024-03"

SAMPLE_EMPLOYEES = [
    {
        "emp_id": "EMP001",
        "name": "张三",
        "employee_type": "full_time",
        "department": "技术部",
        "bank_account": "6222021234567890001",
        "bank_name": "工商银行"
    },
    {
        "emp_id": "EMP002",
        "name": "李四",
        "employee_type": "full_time",
        "department": "市场部",
        "bank_account": "6222021234567890002",
        "bank_name": "工商银行"
    },
    {
        "emp_id": "EMP003",
        "name": "王五",
        "employee_type": "terminated",
        "department": "人事部",
        "bank_account": "6222021234567890003",
        "bank_name": "建设银行"
    },
    {
        "emp_id": "EMP004",
        "name": "赵六",
        "employee_type": "part_time",
        "department": "财务部",
        "bank_account": "6222021234567890004",
        "bank_name": "农业银行"
    },
    {
        "emp_id": "EMP005",
        "name": "孙七",
        "employee_type": "full_time",
        "department": "技术部",
        "bank_account": "6222021234567890005",
        "bank_name": "招商银行"
    }
]

SAMPLE_SALARY_ITEMS = [
    {
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "base_salary": 15000,
        "overtime": 1500,
        "performance": 3000,
        "other_allowance": 500
    },
    {
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "base_salary": 12000,
        "overtime": 0,
        "performance": 2000,
        "other_allowance": 300
    },
    {
        "emp_id": "EMP003",
        "month": SAMPLE_MONTH,
        "base_salary": 10000,
        "overtime": 0,
        "performance": 0,
        "other_allowance": 0
    },
    {
        "emp_id": "EMP004",
        "month": SAMPLE_MONTH,
        "base_salary": 4000,
        "overtime": 500,
        "performance": 0,
        "other_allowance": 200
    },
    {
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "base_salary": 18000,
        "overtime": 2000,
        "performance": 4000,
        "other_allowance": 800
    }
]

SAMPLE_ATTENDANCES = [
    {
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "work_days": 21,
        "absent_days": 0,
        "late_times": 2
    },
    {
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "work_days": 20,
        "absent_days": 1,
        "late_times": 0
    },
    {
        "emp_id": "EMP003",
        "month": SAMPLE_MONTH,
        "work_days": 10,
        "absent_days": 0,
        "late_times": 0
    },
    {
        "emp_id": "EMP004",
        "month": SAMPLE_MONTH,
        "work_days": 15,
        "absent_days": 0,
        "late_times": 5
    },
    {
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "work_days": 22,
        "absent_days": 0,
        "late_times": 0
    }
]

SAMPLE_LEAVES = [
    {
        "leave_id": "LEV001",
        "emp_id": "EMP001",
        "leave_type": "年假",
        "start_date": "2024-02-28",
        "end_date": "2024-03-02",
        "days": 3,
        "is_approved": True
    },
    {
        "leave_id": "LEV002",
        "emp_id": "EMP003",
        "leave_type": "离职交接",
        "start_date": "2024-03-11",
        "end_date": "2024-03-31",
        "days": 15,
        "is_approved": True
    },
    {
        "leave_id": "LEV003",
        "emp_id": "EMP002",
        "leave_type": "事假",
        "start_date": "2024-03-15",
        "end_date": "2024-03-15",
        "days": 1,
        "is_approved": True
    }
]

SAMPLE_ALLOWANCES = [
    {
        "allowance_id": "ALW001",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "allowance_type": "transportation",
        "amount": 800,
        "approved_by": "HR001"
    },
    {
        "allowance_id": "ALW002",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "allowance_type": "meal",
        "amount": 600,
        "approved_by": "HR001"
    },
    {
        "allowance_id": "ALW003",
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "allowance_type": "housing",
        "amount": 6000,
        "approved_by": "HR001"
    },
    {
        "allowance_id": "ALW004",
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "allowance_type": "communication",
        "amount": 200,
        "approved_by": "HR002"
    },
    {
        "allowance_id": "ALW005",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "allowance_type": "transportation",
        "amount": 500,
        "approved_by": "HR001"
    }
]

SAMPLE_DEDUCTIONS = [
    {
        "deduction_id": "DED001",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "deduction_type": "social_insurance",
        "amount": 1575,
        "reason": "当月社保个人缴纳部分",
        "approved_by": "HR001"
    },
    {
        "deduction_id": "DED002",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "deduction_type": "housing_fund",
        "amount": 1800,
        "reason": "当月公积金个人缴纳部分",
        "approved_by": "HR001"
    },
    {
        "deduction_id": "DED003",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "deduction_type": "tax",
        "amount": 450,
        "reason": "当月个人所得税",
        "approved_by": "HR001"
    },
    {
        "deduction_id": "DED004",
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "deduction_type": "social_insurance",
        "amount": 1260,
        "reason": "当月社保",
        "approved_by": "HR001"
    },
    {
        "deduction_id": "DED005",
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "deduction_type": "housing_fund",
        "amount": 1440,
        "reason": "当月公积金",
        "approved_by": "HR001"
    },
    {
        "deduction_id": "DED006",
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "deduction_type": "late_deduction",
        "amount": 500,
        "reason": "",
        "approved_by": None
    },
    {
        "deduction_id": "DED007",
        "emp_id": "EMP003",
        "month": SAMPLE_MONTH,
        "deduction_type": "social_insurance",
        "amount": 1050,
        "reason": "当月社保",
        "approved_by": "HR001"
    },
    {
        "deduction_id": "DED008",
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "deduction_type": "social_insurance",
        "amount": 1890,
        "reason": "当月社保",
        "approved_by": "HR002"
    },
    {
        "deduction_id": "DED009",
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "deduction_type": "housing_fund",
        "amount": 2160,
        "reason": "当月公积金",
        "approved_by": "HR002"
    },
    {
        "deduction_id": "DED010",
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "deduction_type": "tax",
        "amount": 890,
        "reason": "当月个税",
        "approved_by": "HR002"
    }
]

SAMPLE_TAXES = [
    {
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "tax_amount": 450,
        "taxable_income": 15000,
        "cumulative_tax": 1350
    },
    {
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "tax_amount": -50,
        "taxable_income": 4000,
        "cumulative_tax": 120
    },
    {
        "emp_id": "EMP003",
        "month": SAMPLE_MONTH,
        "tax_amount": 0,
        "taxable_income": 3000,
        "cumulative_tax": 450
    },
    {
        "emp_id": "EMP004",
        "month": SAMPLE_MONTH,
        "tax_amount": 0,
        "taxable_income": 2000,
        "cumulative_tax": 0
    },
    {
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "tax_amount": 890,
        "taxable_income": 22000,
        "cumulative_tax": 2670
    }
]

SAMPLE_BANK_RESPONSES = [
    {
        "response_id": "BANK001",
        "emp_id": "EMP001",
        "month": SAMPLE_MONTH,
        "status": "success",
        "error_code": None,
        "error_message": None,
        "retry_count": 0,
        "last_attempt": "2024-03-25 09:30:00"
    },
    {
        "response_id": "BANK002",
        "emp_id": "EMP002",
        "month": SAMPLE_MONTH,
        "status": "failed",
        "error_code": "ACCOUNT_INVALID",
        "error_message": "账号不存在或已销户",
        "retry_count": 3,
        "last_attempt": "2024-03-25 10:15:00"
    },
    {
        "response_id": "BANK003",
        "emp_id": "EMP003",
        "month": SAMPLE_MONTH,
        "status": "success",
        "error_code": None,
        "error_message": None,
        "retry_count": 0,
        "last_attempt": "2024-03-25 09:45:00"
    },
    {
        "response_id": "BANK004",
        "emp_id": "EMP004",
        "month": SAMPLE_MONTH,
        "status": "success",
        "error_code": None,
        "error_message": None,
        "retry_count": 0,
        "last_attempt": "2024-03-25 10:00:00"
    },
    {
        "response_id": "BANK005",
        "emp_id": "EMP005",
        "month": SAMPLE_MONTH,
        "status": "failed",
        "error_code": "INSUFFICIENT_BALANCE",
        "error_message": "账户余额不足",
        "retry_count": 1,
        "last_attempt": "2024-03-25 10:30:00"
    }
]


def get_all_sample_data() -> Dict[str, List[Dict[str, Any]]]:
    return {
        "employees": SAMPLE_EMPLOYEES,
        "salary_items": SAMPLE_SALARY_ITEMS,
        "attendances": SAMPLE_ATTENDANCES,
        "leaves": SAMPLE_LEAVES,
        "allowances": SAMPLE_ALLOWANCES,
        "deductions": SAMPLE_DEDUCTIONS,
        "taxes": SAMPLE_TAXES,
        "bank_responses": SAMPLE_BANK_RESPONSES
    }


SAMPLE_DATA_DESCRIPTION = """
样例数据说明 (月份: 2024-03)

【员工类型】
- EMP001 张三: 正式员工 (技术部) - 请假跨月
- EMP002 李四: 正式员工 (市场部) - 住房补贴超上限, 个税为负, 银行账号失败
- EMP003 王五: 离职员工 (人事部) - 部分月份工资结算
- EMP004 赵六: 实习生 (财务部) - 无社保公积金
- EMP005 孙七: 正式员工 (技术部) - 银行打款失败可重试

【预置异常场景】
1. 请假跨月: EMP001 的年假从2月28日到3月2日
2. 补贴超过上限: EMP002 的住房补贴6000 > 上限5000
3. 扣款无依据: EMP002 的扣款 DED006 缺少原因和审批人
4. 个税为负: EMP002 的个税为 -50
5. 银行账号失败: EMP002 账号失败, 重试2/3次 (阻断)
6. 银行打款失败可重试: EMP005 余额不足, 重试1/3次 (警告)
7. 旷工缺少扣款: EMP002 旷工1天但无 absent_deduction
"""
