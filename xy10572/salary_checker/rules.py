from typing import List, Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from .models import (
    Employee, SalaryItem, Attendance, Leave, Allowance, Deduction,
    Tax, BankResponse, Anomaly
)
from .config import ConfigManager
from .storage import StorageManager


class RuleEngine:
    def __init__(self, config: ConfigManager, storage: StorageManager):
        self.config = config
        self.storage = storage

    def _check_leave_cross_month(self, emp_id: str, month: str) -> List[Anomaly]:
        anomalies = []
        leaves = self.storage.list_leaves_by_emp(emp_id)
        
        month_start = datetime.strptime(f"{month}-01", "%Y-%m-%d")
        next_month = month_start.replace(day=28) + timedelta(days=4)
        month_end = next_month - timedelta(days=next_month.day)
        
        for leave in leaves:
            start = datetime.strptime(leave.start_date, "%Y-%m-%d")
            end = datetime.strptime(leave.end_date, "%Y-%m-%d")
            
            if (start < month_start and end >= month_start) or \
               (start <= month_end and end > month_end):
                anomaly_id = StorageManager.generate_id()
                anomaly = Anomaly(
                    anomaly_id=anomaly_id,
                    emp_id=emp_id,
                    month=month,
                    rule_code="LEAVE_CROSS_MONTH",
                    rule_name="请假跨月",
                    severity="warning",
                    status="pending",
                    message=f"请假单 {leave.leave_id} 跨月，类型: {leave.leave_type}, 时长: {leave.days}天",
                    detail={
                        "leave_id": leave.leave_id,
                        "leave_type": leave.leave_type,
                        "start_date": leave.start_date,
                        "end_date": leave.end_date,
                        "days": leave.days,
                        "is_approved": leave.is_approved,
                        "impact_month": month
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies

    def _check_allowance_over_limit(self, emp_id: str, month: str) -> List[Anomaly]:
        anomalies = []
        allowances = self.storage.list_allowances_by_emp(emp_id, month)
        
        type_totals: Dict[str, float] = {}
        for allowance in allowances:
            type_totals[allowance.allowance_type] = \
                type_totals.get(allowance.allowance_type, 0) + allowance.amount
        
        for allowance_type, total in type_totals.items():
            limit = self.config.get_allowance_limit(allowance_type)
            if total > limit:
                anomaly_id = StorageManager.generate_id()
                anomaly = Anomaly(
                    anomaly_id=anomaly_id,
                    emp_id=emp_id,
                    month=month,
                    rule_code="ALLOWANCE_OVER_LIMIT",
                    rule_name="补贴超过上限",
                    severity="blocker",
                    status="pending",
                    message=f"补贴类型 {allowance_type} 总额 {total} 超过上限 {limit}",
                    detail={
                        "allowance_type": allowance_type,
                        "total_amount": total,
                        "limit": limit,
                        "over_amount": total - limit
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies

    def _check_deduction_no_basis(self, emp_id: str, month: str) -> List[Anomaly]:
        anomalies = []
        deductions = self.storage.list_deductions_by_emp(emp_id, month)
        
        for deduction in deductions:
            valid_type = self.config.is_valid_deduction_type(deduction.deduction_type)
            has_reason = bool(deduction.reason and deduction.reason.strip())
            has_approval = bool(deduction.approved_by)
            
            if not valid_type or not has_reason or not has_approval:
                issues = []
                if not valid_type:
                    issues.append("扣款类型无效")
                if not has_reason:
                    issues.append("缺少扣款原因")
                if not has_approval:
                    issues.append("缺少审批人")
                
                anomaly_id = StorageManager.generate_id()
                anomaly = Anomaly(
                    anomaly_id=anomaly_id,
                    emp_id=emp_id,
                    month=month,
                    rule_code="DEDUCTION_NO_BASIS",
                    rule_name="扣款无依据",
                    severity="blocker",
                    status="pending",
                    message=f"扣款 {deduction.deduction_id} 存在问题: {', '.join(issues)}",
                    detail={
                        "deduction_id": deduction.deduction_id,
                        "deduction_type": deduction.deduction_type,
                        "amount": deduction.amount,
                        "reason": deduction.reason,
                        "approved_by": deduction.approved_by,
                        "issues": issues,
                        "is_valid_type": valid_type,
                        "has_reason": has_reason,
                        "has_approval": has_approval
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies

    def _check_tax_negative(self, emp_id: str, month: str) -> List[Anomaly]:
        anomalies = []
        tax = self.storage.get_tax(emp_id, month)
        
        if tax and tax.tax_amount < 0:
            anomaly_id = StorageManager.generate_id()
            anomaly = Anomaly(
                anomaly_id=anomaly_id,
                emp_id=emp_id,
                month=month,
                rule_code="TAX_NEGATIVE",
                rule_name="个税为负",
                severity="blocker",
                status="pending",
                message=f"个税金额为负: {tax.tax_amount}",
                detail={
                    "tax_amount": tax.tax_amount,
                    "taxable_income": tax.taxable_income,
                    "cumulative_tax": tax.cumulative_tax
                }
            )
            anomalies.append(anomaly)
        
        return anomalies

    def _check_bank_account_failures(self, emp_id: str, month: str) -> List[Anomaly]:
        anomalies = []
        responses = self.storage.list_bank_responses_by_emp(emp_id, month)
        
        if not responses:
            return anomalies
        
        latest_response = sorted(
            responses,
            key=lambda r: r.last_attempt or "",
            reverse=True
        )[0]
        
        if latest_response.status == "failed":
            retry_max = self.config.get_bank_retry_max()
            can_retry = latest_response.retry_count < retry_max
            
            severity = "blocker" if not can_retry else "warning"
            
            anomaly_id = StorageManager.generate_id()
            anomaly = Anomaly(
                anomaly_id=anomaly_id,
                emp_id=emp_id,
                month=month,
                rule_code="BANK_ACCOUNT_FAILED",
                rule_name="银行账号失败",
                severity=severity,
                status="pending",
                message=f"银行打款失败: {latest_response.error_message}. "
                        f"重试次数: {latest_response.retry_count}/{retry_max}",
                detail={
                    "response_id": latest_response.response_id,
                    "status": latest_response.status,
                    "error_code": latest_response.error_code,
                    "error_message": latest_response.error_message,
                    "retry_count": latest_response.retry_count,
                    "max_retries": retry_max,
                    "can_retry": can_retry,
                    "last_attempt": latest_response.last_attempt
                }
            )
            anomalies.append(anomaly)
        
        return anomalies

    def _check_salary_calculation(self, emp_id: str, month: str) -> List[Anomaly]:
        anomalies = []
        employee = self.storage.get_employee(emp_id)
        salary_item = self.storage.get_salary_item(emp_id, month)
        attendance = self.storage.get_attendance(emp_id, month)
        tax = self.storage.get_tax(emp_id, month)
        allowances = self.storage.list_allowances_by_emp(emp_id, month)
        deductions = self.storage.list_deductions_by_emp(emp_id, month)
        
        if not (employee and salary_item and tax):
            return anomalies
        
        emp_config = self.config.get_employee_type_config(employee.employee_type)
        
        if attendance and emp_config:
            total_income = salary_item.base_salary + salary_item.overtime + \
                           salary_item.performance + salary_item.other_allowance + \
                           sum(a.amount for a in allowances)
            
            expected_deductions = 0
            
            si_rate = emp_config.get("social_insurance_rate", 0)
            hf_rate = emp_config.get("housing_fund_rate", 0)
            if si_rate > 0:
                expected_deductions += salary_item.base_salary * si_rate
            if hf_rate > 0:
                expected_deductions += salary_item.base_salary * hf_rate
            
            actual_deductions = sum(
                d.amount for d in deductions 
                if d.deduction_type in ["social_insurance", "housing_fund"]
            )
            
            diff = abs(actual_deductions - expected_deductions)
            if diff > 10:
                anomaly_id = StorageManager.generate_id()
                anomaly = Anomaly(
                    anomaly_id=anomaly_id,
                    emp_id=emp_id,
                    month=month,
                    rule_code="DEDUCTION_CALCULATION",
                    rule_name="社保公积金计算异常",
                    severity="warning",
                    status="pending",
                    message=f"社保公积金扣款 {actual_deductions} 与预期 {expected_deductions:.2f} 差异较大",
                    detail={
                        "base_salary": salary_item.base_salary,
                        "si_rate": si_rate,
                        "hf_rate": hf_rate,
                        "expected": expected_deductions,
                        "actual": actual_deductions,
                        "difference": diff
                    }
                )
                anomalies.append(anomaly)
        
        if attendance and attendance.absent_days > 0:
            has_absent_deduction = any(
                d.deduction_type == "absent_deduction" for d in deductions
            )
            if not has_absent_deduction:
                anomaly_id = StorageManager.generate_id()
                anomaly = Anomaly(
                    anomaly_id=anomaly_id,
                    emp_id=emp_id,
                    month=month,
                    rule_code="MISSING_ABSENT_DEDUCTION",
                    rule_name="旷工缺少扣款",
                    severity="warning",
                    status="pending",
                    message=f"旷工 {attendance.absent_days} 天但无对应扣款",
                    detail={
                        "absent_days": attendance.absent_days,
                        "work_days": attendance.work_days
                    }
                )
                anomalies.append(anomaly)
        
        return anomalies

    def check_employee(self, emp_id: str, month: str) -> List[Anomaly]:
        all_anomalies = []
        
        checks = [
            self._check_leave_cross_month,
            self._check_allowance_over_limit,
            self._check_deduction_no_basis,
            self._check_tax_negative,
            self._check_bank_account_failures,
            self._check_salary_calculation
        ]
        
        for check in checks:
            anomalies = check(emp_id, month)
            all_anomalies.extend(anomalies)
        
        return all_anomalies

    def check_month(self, month: str) -> List[Anomaly]:
        all_anomalies = []
        employees = self.storage.list_employees()
        
        for employee in employees:
            anomalies = self.check_employee(employee.emp_id, month)
            all_anomalies.extend(anomalies)
        
        return all_anomalies
