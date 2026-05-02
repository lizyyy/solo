"""脱敏规则定义 - 敏感信息识别规则和模式"""
import re
from typing import Dict, List, Pattern, Any, Callable, Optional
from dataclasses import dataclass


@dataclass
class RedactionRule:
    """脱敏规则定义"""
    name: str
    display_name: str
    description: str
    pattern: Pattern[str]
    mask_function: Callable[[str], str]
    priority: int = 0
    enabled: bool = True


def mask_id_card(match: str) -> str:
    """脱敏身份证号 - 保留前6位和后4位
    
    例如: 110101199001011234 -> 110101********1234
    """
    if len(match) == 18:
        return match[:6] + "********" + match[-4:]
    elif len(match) == 15:
        return match[:6] + "*******" + match[-4:]
    return "*" * len(match)


def mask_phone(match: str) -> str:
    """脱敏手机号 - 保留前3位和后4位
    
    例如: 13812345678 -> 138****5678
    """
    if len(match) >= 7:
        return match[:3] + "****" + match[-4:]
    return "*" * len(match)


def mask_address(match: str) -> str:
    """脱敏地址 - 保留省/市/区，隐藏详细地址
    
    例如: 北京市朝阳区建国路88号 -> 北京市朝阳区**路**号
    """
    # 简单策略：保留前6个字符，后面用*代替
    if len(match) > 6:
        return match[:6] + "*" * (len(match) - 6)
    return "*" * len(match)


def mask_email(match: str) -> str:
    """脱敏邮箱 - 隐藏用户名中间部分
    
    例如: testuser@example.com -> te****er@example.com
    """
    if "@" not in match:
        return "*" * len(match)
    
    username, domain = match.split("@", 1)
    if len(username) > 4:
        masked_username = username[:2] + "****" + username[-2:]
    else:
        masked_username = username[0] + "****" + username[-1] if len(username) >= 2 else "*" * len(username)
    
    return f"{masked_username}@{domain}"


def mask_bank_card(match: str) -> str:
    """脱敏银行卡号 - 保留前4位和后4位
    
    例如: 6222021234567890123 -> 6222************0123
    """
    if len(match) > 8:
        return match[:4] + "*" * (len(match) - 8) + match[-4:]
    return "*" * len(match)


def mask_name(match: str) -> str:
    """脱敏姓名 - 保留姓，隐藏名
    
    例如: 张三 -> 张*
    例如: 张三丰 -> 张**
    """
    if len(match) > 1:
        return match[0] + "*" * (len(match) - 1)
    return "*" * len(match)


# 预定义的规则模式
RULE_PATTERNS: Dict[str, Dict[str, Any]] = {
    "id_card": {
        "display_name": "身份证号",
        "description": "中华人民共和国居民身份证号（18位或15位）",
        "pattern": r"\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b",
        "mask_function": mask_id_card,
    },
    "id_card_15": {
        "display_name": "身份证号(15位)",
        "description": "旧版15位居民身份证号",
        "pattern": r"\b[1-9]\d{5}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}\b",
        "mask_function": mask_id_card,
    },
    "phone": {
        "display_name": "手机号",
        "description": "中国大陆手机号（11位）",
        "pattern": r"\b1[3-9]\d{9}\b",
        "mask_function": mask_phone,
    },
    "phone_hk": {
        "display_name": "香港手机号",
        "description": "香港特别行政区手机号（8位）",
        "pattern": r"\b[569]\d{7}\b",
        "mask_function": mask_phone,
    },
    "address": {
        "display_name": "地址",
        "description": "中国地址信息",
        "pattern": r"[北京上海天津重庆河北山西辽宁吉林黑龙江江苏浙江安徽福建江西山东河南湖北湖南广东广西海南四川贵州云南西藏陕西甘肃青海宁夏新疆内蒙古]{2,3}?(?:省|市|自治区)?(?:[市区县区]{1,2})?(?:[街道乡镇]{1,2})?(?:[路街巷弄]{1,2})?\d+(?:号|弄|幢|栋)?(?:[单元楼层]{1,2})?\d*(?:室|号)?",
        "mask_function": mask_address,
    },
    "email": {
        "display_name": "邮箱",
        "description": "电子邮件地址",
        "pattern": r"\b[\w\.-]+@[\w\.-]+\.\w{2,}\b",
        "mask_function": mask_email,
    },
    "bank_card": {
        "display_name": "银行卡号",
        "description": "银行卡号（16-19位）",
        "pattern": r"\b[34569]\d{15,18}\b",
        "mask_function": mask_bank_card,
    },
    "name": {
        "display_name": "姓名",
        "description": "中文姓名（2-4字）",
        "pattern": r"[\u4e00-\u9fa5]{2,4}",
        "mask_function": mask_name,
    },
}


def get_all_rules() -> Dict[str, RedactionRule]:
    """获取所有预定义的脱敏规则
    
    Returns:
        规则名称到RedactionRule对象的映射
    """
    rules = {}
    for name, config in RULE_PATTERNS.items():
        rules[name] = RedactionRule(
            name=name,
            display_name=config["display_name"],
            description=config["description"],
            pattern=re.compile(config["pattern"]),
            mask_function=config["mask_function"],
        )
    return rules


def get_rules_by_names(names: List[str]) -> Dict[str, RedactionRule]:
    """根据名称获取脱敏规则
    
    Args:
        names: 规则名称列表
    
    Returns:
        规则名称到RedactionRule对象的映射
    """
    all_rules = get_all_rules()
    selected = {}
    
    for name in names:
        if name in all_rules:
            selected[name] = all_rules[name]
    
    return selected


def get_default_rule_names() -> List[str]:
    """获取默认启用的规则名称列表
    
    Returns:
        默认规则名称列表
    """
    return ["id_card", "phone", "email", "bank_card"]


def validate_id_card(id_card: str) -> bool:
    """验证身份证号的有效性（校验码验证）
    
    Args:
        id_card: 身份证号
    
    Returns:
        是否有效
    """
    if len(id_card) != 18:
        return False
    
    # 校验码计算
    weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
    check_codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
    
    try:
        total = sum(int(id_card[i]) * weights[i] for i in range(17))
        check_index = total % 11
        return id_card[17].upper() == check_codes[check_index]
    except Exception:
        return False
