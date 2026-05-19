from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime
from exhibition_material.models import MaterialType, AnomalyType

class Validators:
    @staticmethod
    def validate_material_code(code: str) -> Tuple[bool, Optional[str]]:
        if not code or len(code.strip()) == 0:
            return False, "物料编码不能为空"
        if len(code) > 50:
            return False, "物料编码长度不能超过50个字符"
        return True, None
    
    @staticmethod
    def validate_quantity(quantity: float, allow_zero: bool = False) -> Tuple[bool, Optional[str]]:
        if quantity is None:
            return False, "数量不能为空"
        if not allow_zero and quantity <= 0:
            return False, "数量必须大于0"
        if quantity < 0:
            return False, "数量不能为负数"
        return True, None
    
    @staticmethod
    def validate_material_type(material_type: str) -> Tuple[bool, Optional[str]]:
        try:
            MaterialType(material_type)
            return True, None
        except ValueError:
            valid_types = [t.value for t in MaterialType]
            return False, f"无效的物料类型，有效类型为：{', '.join(valid_types)}"
    
    @staticmethod
    def validate_date_format(date_str: str, fmt: str = "%Y-%m-%d") -> Tuple[bool, Optional[str], Optional[datetime]]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return True, None, dt
        except ValueError:
            return False, f"日期格式不正确，应为 {fmt}", None
    
    @staticmethod
    def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> Tuple[bool, Optional[str]]:
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None or data[field] == "":
                missing_fields.append(field)
        
        if missing_fields:
            return False, f"缺少必填字段：{', '.join(missing_fields)}"
        return True, None
    
    @staticmethod
    def validate_booth_number(booth_number: str) -> Tuple[bool, Optional[str]]:
        if not booth_number or len(booth_number.strip()) == 0:
            return False, "展位号不能为空"
        if len(booth_number) > 50:
            return False, "展位号长度不能超过50个字符"
        return True, None
    
    @staticmethod
    def validate_person_name(name: str) -> Tuple[bool, Optional[str]]:
        if not name or len(name.strip()) == 0:
            return False, "负责人姓名不能为空"
        if len(name) > 100:
            return False, "负责人姓名长度不能超过100个字符"
        return True, None
