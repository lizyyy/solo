from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import re

from models.order import Order
from models.patient import Patient
from config.settings import get_settings


@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"
    row_number: Optional[int] = None


class OrderValidator:
    def __init__(self):
        self.settings = get_settings()
    
    def validate_phone(self, phone: Optional[str]) -> List[ValidationError]:
        errors = []
        if phone:
            phone_clean = re.sub(r'[\s\-()]', '', phone)
            if not re.match(r'^1[3-9]\d{9}$', phone_clean):
                errors.append(ValidationError(
                    field="phone",
                    message=f"手机号格式不正确: {phone}",
                    severity="warning"
                ))
        return errors
    
    def validate_side(self, side: str) -> List[ValidationError]:
        errors = []
        valid_sides = self.settings.side_enum
        if side not in valid_sides:
            errors.append(ValidationError(
                field="side",
                message=f"左右侧值无效: '{side}'，有效值: {', '.join(valid_sides)}",
                severity="error"
            ))
        return errors
    
    def validate_date(self, date_str: Optional[str], field_name: str = "date") -> Tuple[Optional[datetime], List[ValidationError]]:
        errors = []
        if not date_str:
            return None, errors
        
        date_formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y年%m月%d日",
            "%d/%m/%Y",
            "%m-%d-%Y",
        ]
        
        parsed_date = None
        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str.strip(), fmt)
                break
            except ValueError:
                continue
        
        if parsed_date is None:
            errors.append(ValidationError(
                field=field_name,
                message=f"日期格式无法解析: '{date_str}'，请使用 YYYY-MM-DD 格式",
                severity="error"
            ))
        
        return parsed_date.date() if parsed_date else None, errors
    
    def validate_order_number(
        self,
        order_number: str,
        existing_numbers: List[str]
    ) -> List[ValidationError]:
        errors = []
        
        if not order_number or order_number.strip() == "":
            errors.append(ValidationError(
                field="order_number",
                message="订单号不能为空",
                severity="error"
            ))
            return errors
        
        if order_number in existing_numbers:
            errors.append(ValidationError(
                field="order_number",
                message=f"订单号重复: {order_number}",
                severity="error"
            ))
        
        return errors
    
    def validate_import_row(
        self,
        row: Dict[str, Any],
        row_number: int,
        existing_order_numbers: List[str]
    ) -> List[ValidationError]:
        errors = []
        
        phone = row.get("phone") or row.get("联系电话") or row.get("电话")
        if phone:
            phone_errors = self.validate_phone(str(phone))
            for e in phone_errors:
                e.row_number = row_number
            errors.extend(phone_errors)
        
        side = row.get("side") or row.get("左右侧") or row.get("侧别")
        if side:
            side_errors = self.validate_side(str(side))
            for e in side_errors:
                e.row_number = row_number
            errors.extend(side_errors)
        
        order_number = row.get("order_number") or row.get("订单号")
        if order_number:
            order_errors = self.validate_order_number(
                str(order_number),
                existing_order_numbers
            )
            for e in order_errors:
                e.row_number = row_number
            errors.extend(order_errors)
        
        date_fields = [
            ("impression_date", "取模日期"),
            ("follow_up_date", "复诊日期"),
            ("date", "日期")
        ]
        
        for field_name, display_name in date_fields:
            date_value = row.get(field_name) or row.get(display_name)
            if date_value:
                _, date_errors = self.validate_date(str(date_value), field_name)
                for e in date_errors:
                    e.row_number = row_number
                errors.extend(date_errors)
        
        return errors
