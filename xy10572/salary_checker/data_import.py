import json
import os
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from .models import (
    Employee, SalaryItem, Attendance, Leave, Allowance, Deduction,
    Tax, BankResponse, ImportRecord
)
from .storage import StorageManager


class DataImporter:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def _validate_employee(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["emp_id", "name", "employee_type", "department", 
                    "bank_account", "bank_name"]
        for field in required:
            if field not in data or not data[field]:
                return False, f"缺少必填字段: {field}"
        
        valid_types = ["full_time", "part_time", "terminated"]
        if data["employee_type"] not in valid_types:
            return False, f"无效的员工类型: {data['employee_type']}, 有效值: {valid_types}"
        
        return True, ""

    def _validate_salary_item(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["emp_id", "month", "base_salary"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        if data.get("base_salary", 0) < 0:
            return False, "基本工资不能为负数"
        
        return True, ""

    def _validate_attendance(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["emp_id", "month", "work_days", "absent_days", "late_times"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        for field in ["work_days", "absent_days", "late_times"]:
            if data[field] < 0:
                return False, f"{field} 不能为负数"
        
        return True, ""

    def _validate_leave(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["leave_id", "emp_id", "leave_type", "start_date", 
                    "end_date", "days"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        try:
            start = datetime.strptime(data["start_date"], "%Y-%m-%d")
            end = datetime.strptime(data["end_date"], "%Y-%m-%d")
            if start > end:
                return False, "开始日期不能晚于结束日期"
        except ValueError as e:
            return False, f"日期格式错误: {e}"
        
        return True, ""

    def _validate_allowance(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["allowance_id", "emp_id", "month", "allowance_type", "amount"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        if data.get("amount", 0) < 0:
            return False, "补贴金额不能为负数"
        
        return True, ""

    def _validate_deduction(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["deduction_id", "emp_id", "month", "deduction_type", 
                    "amount", "reason"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        if data.get("amount", 0) < 0:
            return False, "扣款金额不能为负数"
        
        return True, ""

    def _validate_tax(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["emp_id", "month", "tax_amount", "taxable_income", "cumulative_tax"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        return True, ""

    def _validate_bank_response(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["response_id", "emp_id", "month", "status"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}"
        
        valid_status = ["success", "failed", "pending", "retrying"]
        if data["status"] not in valid_status:
            return False, f"无效的状态: {data['status']}, 有效值: {valid_status}"
        
        return True, ""

    def _import_single_type(self, data_type: str, items: List[Dict[str, Any]], 
                            month: str, file_path: str) -> ImportRecord:
        validators = {
            "employees": (self._validate_employee, Employee),
            "salary_items": (self._validate_salary_item, SalaryItem),
            "attendances": (self._validate_attendance, Attendance),
            "leaves": (self._validate_leave, Leave),
            "allowances": (self._validate_allowance, Allowance),
            "deductions": (self._validate_deduction, Deduction),
            "taxes": (self._validate_tax, Tax),
            "bank_responses": (self._validate_bank_response, BankResponse),
        }

        if data_type not in validators:
            return ImportRecord(
                record_id=StorageManager.generate_id(),
                data_type=data_type,
                month=month,
                file_path=file_path,
                count=0,
                status="failed",
                error_message=f"未知的数据类型: {data_type}"
            )

        validator, model_cls = validators[data_type]
        
        created = 0
        updated = 0
        unchanged = 0
        errors = []
        
        for item_data in items:
            is_valid, error_msg = validator(item_data)
            if not is_valid:
                errors.append(error_msg)
                continue
            
            try:
                obj = model_cls(**item_data)
                savers = {
                    "employees": self.storage.save_employee,
                    "salary_items": self.storage.save_salary_item,
                    "attendances": self.storage.save_attendance,
                    "leaves": self.storage.save_leave,
                    "allowances": self.storage.save_allowance,
                    "deductions": self.storage.save_deduction,
                    "taxes": self.storage.save_tax,
                    "bank_responses": self.storage.save_bank_response,
                }
                result = savers[data_type](obj)
                
                if result == "created":
                    created += 1
                elif result == "updated":
                    updated += 1
                else:
                    unchanged += 1
            except Exception as e:
                errors.append(str(e))
        
        if errors:
            status = "partial" if (created + updated + unchanged) > 0 else "failed"
        else:
            status = "success"
        
        return ImportRecord(
            record_id=StorageManager.generate_id(),
            data_type=data_type,
            month=month,
            file_path=file_path,
            count=len(items),
            status=status,
            error_message="; ".join(errors) if errors else None
        )

    def import_from_file(self, file_path: str, data_type: str, 
                         month: str) -> ImportRecord:
        if not os.path.exists(file_path):
            return ImportRecord(
                record_id=StorageManager.generate_id(),
                data_type=data_type,
                month=month,
                file_path=file_path,
                count=0,
                status="failed",
                error_message=f"文件不存在: {file_path}"
            )
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                items = json.load(f)
            
            if not isinstance(items, list):
                items = [items]
            
            record = self._import_single_type(data_type, items, month, file_path)
            self.storage.save_import_record(record)
            return record
            
        except Exception as e:
            record = ImportRecord(
                record_id=StorageManager.generate_id(),
                data_type=data_type,
                month=month,
                file_path=file_path,
                count=0,
                status="failed",
                error_message=str(e)
            )
            self.storage.save_import_record(record)
            return record

    def import_from_data(self, data_type: str, items: List[Dict[str, Any]], 
                         month: str) -> ImportRecord:
        record = self._import_single_type(data_type, items, month, "direct_import")
        self.storage.save_import_record(record)
        return record
