import re
from typing import List, Tuple, Optional

PHONE_PATTERN = re.compile(r'(?<!\d)(1[3-9]\d{9})(?!\d)')
ID_CARD_PATTERN = re.compile(r'(?<!\d)(\d{17}[\dXx]|\d{15})(?!\d)')
BANK_CARD_PATTERN = re.compile(r'(?<!\d)(\d{16,19})(?!\d)')
EMAIL_PATTERN = re.compile(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})')


def mask_phone(phone: str) -> str:
    if not phone:
        return phone
    return PHONE_PATTERN.sub(lambda m: m.group(1)[:3] + '****' + m.group(1)[7:], phone)


def mask_id_card(id_card: str) -> str:
    if not id_card:
        return id_card
    if len(id_card) == 18:
        return id_card[:6] + '********' + id_card[14:]
    elif len(id_card) == 15:
        return id_card[:6] + '*****' + id_card[11:]
    return id_card


def mask_bank_card(bank_card: str) -> str:
    if not bank_card or len(bank_card) < 8:
        return bank_card
    return bank_card[:4] + '****' + '****' + bank_card[-4:]


def mask_email(email: str) -> str:
    if not email or '@' not in email:
        return email
    name, domain = email.rsplit('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[0] + '*' * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"


def mask_text(text: str) -> str:
    if not text:
        return text
    result = mask_phone(text)
    result = mask_id_card(result)
    result = mask_bank_card(result)
    result = mask_email(result)
    return result


def is_phone_number(text: str) -> bool:
    if not text:
        return False
    return bool(PHONE_PATTERN.search(text))


def has_sensitive_data(text: str) -> Tuple[bool, List[str]]:
    if not text:
        return False, []
    found = []
    if PHONE_PATTERN.search(text):
        found.append("phone")
    if ID_CARD_PATTERN.search(text):
        found.append("id_card")
    if BANK_CARD_PATTERN.search(text):
        found.append("bank_card")
    if EMAIL_PATTERN.search(text):
        found.append("email")
    return len(found) > 0, found


def find_phone_numbers(text: str) -> List[str]:
    if not text:
        return []
    return PHONE_PATTERN.findall(text)


def generate_mask_audit_text(text: str, field_name: str) -> str:
    has, types = has_sensitive_data(text)
    if not has:
        return f"[安全] 字段 '{field_name}' 未检测到敏感数据"
    return f"[警告] 字段 '{field_name}' 检测到敏感数据类型: {', '.join(types)}"
