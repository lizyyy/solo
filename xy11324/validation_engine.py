from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from models import WorkOrder, Operator, Tractor, ValidationLog, WorkOrderStatus
import hashlib

class ValidationResult:
    def __init__(self):
        self.passed = True
        self.checks = []
        self.errors = []
        self.warnings = []
    
    def add_check(self, name: str, passed: bool, message: str, severity: str = "error"):
        self.checks.append({
            "name": name,
            "passed": passed,
            "message": message,
            "severity": severity
        })
        if not passed:
            if severity == "error":
                self.errors.append(f"{name}: {message}")
                self.passed = False
            else:
                self.warnings.append(f"{name}: {message}")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": self.checks,
            "errors": self.errors,
            "warnings": self.warnings
        }

class ValidationEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_order_fingerprint(self, work_order: WorkOrder) -> str:
        fingerprint_str = (
            f"{work_order.operator_id}:{work_order.tractor_id}:"
            f"{work_order.start_time.isoformat() if work_order.start_time else ''}:"
            f"{work_order.end_time.isoformat() if work_order.end_time else ''}:"
            f"{work_order.work_area}:{work_order.fuel_used}"
        )
        return hashlib.md5(fingerprint_str.encode()).hexdigest()
    
    def validate_required_fields(self, work_order: WorkOrder, result: ValidationResult):
        checks = [
            ("order_no", work_order.order_no, "作业单号不能为空"),
            ("start_time", work_order.start_time, "开始时间不能为空"),
            ("end_time", work_order.end_time, "结束时间不能为空"),
            ("operator_id", work_order.operator_id, "机手ID不能为空"),
            ("tractor_id", work_order.tractor_id, "拖拉机ID不能为空")
        ]
        
        for field_name, field_value, error_msg in checks:
            result.add_check(
                f"必填字段_{field_name}",
                field_value is not None and (not isinstance(field_value, str) or field_value.strip() != ""),
                error_msg
            )
    
    def validate_reference_exists(self, work_order: WorkOrder, result: ValidationResult):
        if work_order.operator_id:
            operator = self.db.query(Operator).filter(Operator.id == work_order.operator_id).first()
            is_valid = operator is not None
            result.add_check(
                "机手存在性",
                is_valid,
                f"机手ID={work_order.operator_id}不存在" if not is_valid else f"机手ID={work_order.operator_id}存在"
            )
        
        if work_order.tractor_id:
            tractor = self.db.query(Tractor).filter(Tractor.id == work_order.tractor_id).first()
            is_valid = tractor is not None
            result.add_check(
                "拖拉机存在性",
                is_valid,
                f"拖拉机ID={work_order.tractor_id}不存在" if not is_valid else f"拖拉机ID={work_order.tractor_id}存在"
            )
    
    def validate_time_logic(self, work_order: WorkOrder, result: ValidationResult):
        if work_order.start_time and work_order.end_time:
            result.add_check(
                "时间逻辑",
                work_order.end_time >= work_order.start_time,
                "结束时间不能早于开始时间"
            )
            
            delta = work_order.end_time - work_order.start_time
            hours = delta.total_seconds() / 3600
            result.add_check(
                "作业时长合理性",
                0 < hours <= 24,
                f"作业时长{hours:.2f}小时异常，应在0-24小时之间",
                severity="warning" if hours <= 24 else "error"
            )
    
    def validate_numeric_fields(self, work_order: WorkOrder, result: ValidationResult):
        checks = [
            ("作业面积", work_order.work_area, 0, 1000),
            ("作业时长", work_order.work_hours, 0, 24),
            ("耗油量", work_order.fuel_used, 0, 500),
            ("小时单价", work_order.hourly_rate, 0, 1000),
            ("亩单价", work_order.area_rate, 0, 500),
            ("油价", work_order.fuel_price, 0, 20),
            ("最低收费", work_order.minimum_charge, 0, 10000)
        ]
        
        for name, value, min_val, max_val in checks:
            if value is not None and value != 0:
                is_valid = min_val <= value <= max_val
                result.add_check(
                    f"{name}范围",
                    is_valid,
                    f"{name}{value}超出合理范围[{min_val}, {max_val}]" if not is_valid else f"{name}{value}在合理范围内",
                    severity="warning"
                )
    
    def check_duplicate(self, work_order: WorkOrder, result: ValidationResult):
        if work_order.order_no:
            existing = self.db.query(WorkOrder).filter(
                WorkOrder.order_no == work_order.order_no,
                WorkOrder.id != getattr(work_order, 'id', None)
            ).first()
            
            if existing:
                result.add_check(
                    "重复作业单",
                    False,
                    f"作业单号{work_order.order_no}已存在(ID:{existing.id})",
                    severity="error"
                )
    
    def check_time_overlap(self, work_order: WorkOrder, result: ValidationResult):
        if not work_order.start_time or not work_order.end_time:
            return
        
        overlapping = self.db.query(WorkOrder).filter(
            WorkOrder.id != getattr(work_order, 'id', None),
            WorkOrder.tractor_id == work_order.tractor_id,
            WorkOrder.status != WorkOrderStatus.INVALID,
            WorkOrder.start_time < work_order.end_time,
            WorkOrder.end_time > work_order.start_time
        ).all()
        
        if overlapping:
            order_nos = [o.order_no for o in overlapping]
            result.add_check(
                "时间重叠",
                False,
                f"与作业单{order_nos}时间重叠，同一拖拉机不能同时作业",
                severity="warning"
            )
    
    def check_already_billed(self, work_order: WorkOrder, result: ValidationResult):
        if hasattr(work_order, 'id') and work_order.id:
            if work_order.status == WorkOrderStatus.BILLED:
                result.add_check(
                    "已结算",
                    False,
                    "该作业单已结算，不可重复结算"
                )
    
    def validate(self, work_order: WorkOrder, skip_duplicate: bool = False) -> ValidationResult:
        result = ValidationResult()
        
        self.validate_required_fields(work_order, result)
        self.validate_reference_exists(work_order, result)
        self.validate_time_logic(work_order, result)
        self.validate_numeric_fields(work_order, result)
        
        if not skip_duplicate:
            self.check_duplicate(work_order, result)
        
        self.check_time_overlap(work_order, result)
        self.check_already_billed(work_order, result)
        
        return result
    
    def save_validation_logs(self, work_order_id: int, result: ValidationResult):
        for check in result.checks:
            log = ValidationLog(
                work_order_id=work_order_id,
                check_name=check["name"],
                passed=check["passed"],
                message=check["message"],
                severity=check["severity"]
            )
            self.db.add(log)
        self.db.commit()
