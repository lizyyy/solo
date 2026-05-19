import re
from typing import Optional, Tuple


EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
)


def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    if not email:
        return False, "邮箱不能为空"
    
    if not isinstance(email, str):
        return False, "邮箱必须是字符串类型"
    
    if len(email) > 254:
        return False, f"邮箱长度超过254字符 (当前: {len(email)})"
    
    if not EMAIL_PATTERN.match(email):
        return False, f"邮箱格式无效: {email}"
    
    return True, None


def validate_department(dept: str) -> Tuple[bool, Optional[str]]:
    if not dept:
        return False, "部门不能为空"
    
    if not isinstance(dept, str):
        return False, "部门必须是字符串类型"
    
    if len(dept.strip()) == 0:
        return False, "部门不能只有空白字符"
    
    if len(dept) > 200:
        return False, f"部门名称过长 (当前: {len(dept)}, 最大: 200)"
    
    return True, None


def validate_not_empty(value: str, field_name: str = "字段") -> Tuple[bool, Optional[str]]:
    if value is None:
        return False, f"{field_name}不能为None"
    
    if isinstance(value, str) and len(value.strip()) == 0:
        return False, f"{field_name}不能为空"
    
    if isinstance(value, (list, dict)) and len(value) == 0:
        return False, f"{field_name}不能为空"
    
    return True, None
