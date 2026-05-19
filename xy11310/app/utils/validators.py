import re
from datetime import date
from typing import List, Dict, Any


def validate_phone(phone: str) -> tuple[bool, str]:
    if not phone:
        return True, ""
    pattern = r'^1[3-9]\d{9}$'
    if not re.match(pattern, phone):
        return False, "手机号格式不正确"
    return True, ""


def validate_id_card(id_card: str) -> tuple[bool, str]:
    if not id_card:
        return True, ""
    pattern = r'^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$'
    if not re.match(pattern, id_card):
        return False, "身份证号格式不正确"
    return True, ""


def validate_age(age: int) -> tuple[bool, str]:
    if age is None:
        return True, ""
    if age < 0 or age > 150:
        return False, "年龄必须在0-150之间"
    return True, ""


def validate_date_not_past(check_date: date) -> tuple[bool, str]:
    if check_date < date.today():
        return False, "日期不能是过去的日期"
    return True, ""


def validate_dietary_restrictions(restrictions: List[str]) -> tuple[bool, str]:
    if not isinstance(restrictions, list):
        return False, "饮食禁忌必须是列表格式"
    valid_restrictions = {
        "低盐", "低脂", "低糖", "无糖", "素食",
        "辛辣禁忌", "海鲜禁忌", "坚果禁忌",
        "牛奶禁忌", "鸡蛋禁忌", " gluten-free",
        "糖尿病餐", "高血压餐", "胃病餐",
        "软食", "半流质", "流质"
    }
    invalid = [r for r in restrictions if r not in valid_restrictions]
    if invalid:
        return False, f"不支持的饮食禁忌类型: {', '.join(invalid)}"
    return True, ""


def validate_chronic_diseases(diseases: List[str]) -> tuple[bool, str]:
    if not isinstance(diseases, list):
        return False, "慢病标签必须是列表格式"
    valid_diseases = {
        "糖尿病", "高血压", "心脏病", "冠心病",
        "痛风", "肾病", "肝病", "胃病",
        "高血脂", "高尿酸", "骨质疏松",
        "关节炎", "中风", "阿尔茨海默"
    }
    invalid = [d for d in diseases if d not in valid_diseases]
    if invalid:
        return False, f"不支持的慢病类型: {', '.join(invalid)}"
    return True, ""


def validate_elderly_data(data: Dict[str, Any]) -> tuple[bool, List[str]]:
    errors = []
    
    if "name" in data and not data["name"].strip():
        errors.append("姓名不能为空")
    
    if "phone" in data:
        valid, msg = validate_phone(data["phone"])
        if not valid:
            errors.append(msg)
    
    if "id_card" in data:
        valid, msg = validate_id_card(data["id_card"])
        if not valid:
            errors.append(msg)
    
    if "age" in data:
        valid, msg = validate_age(data["age"])
        if not valid:
            errors.append(msg)
    
    if "dietary_restrictions" in data:
        valid, msg = validate_dietary_restrictions(data["dietary_restrictions"])
        if not valid:
            errors.append(msg)
    
    if "chronic_diseases" in data:
        valid, msg = validate_chronic_diseases(data["chronic_diseases"])
        if not valid:
            errors.append(msg)
    
    return len(errors) == 0, errors
