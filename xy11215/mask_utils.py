import re
import logging


def mask_phone(phone: str) -> str:
    if not phone:
        return phone
    phone = str(phone)
    if len(phone) >= 11:
        return phone[:3] + "****" + phone[-4:]
    elif len(phone) >= 7:
        return phone[:2] + "***" + phone[-2:]
    return phone[0] + "*" * (len(phone) - 2) + phone[-1] if len(phone) > 2 else "*" * len(phone)


def mask_name(name: str) -> str:
    if not name:
        return name
    name = str(name)
    if len(name) <= 1:
        return "*"
    elif len(name) == 2:
        return name[0] + "*"
    else:
        return name[0] + "*" * (len(name) - 2) + name[-1]


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email
    username, domain = email.split("@", 1)
    if len(username) <= 2:
        masked_username = username[0] + "*" * (len(username) - 1)
    else:
        masked_username = username[0] + "*" * (len(username) - 2) + username[-1]
    return f"{masked_username}@{domain}"


def mask_id_card(id_card: str) -> str:
    if not id_card:
        return id_card
    id_card = str(id_card)
    if len(id_card) >= 18:
        return id_card[:6] + "********" + id_card[-4:]
    elif len(id_card) >= 8:
        return id_card[:2] + "****" + id_card[-2:]
    return "*" * len(id_card)


def mask_sensitive_data(data: dict, sensitive_fields: list = None) -> dict:
    if sensitive_fields is None:
        sensitive_fields = ["phone", "mobile", "tel", "id_card", "idcard", "email", "name", "inspector_name", "inspector_phone"]

    result = data.copy() if isinstance(data, dict) else data

    if isinstance(result, dict):
        for key in result:
            key_lower = key.lower()
            if any(sf in key_lower for sf in sensitive_fields):
                if "phone" in key_lower or "mobile" in key_lower or "tel" in key_lower:
                    result[key] = mask_phone(str(result[key]))
                elif "name" in key_lower:
                    result[key] = mask_name(str(result[key]))
                elif "email" in key_lower:
                    result[key] = mask_email(str(result[key]))
                elif "id" in key_lower and "card" in key_lower:
                    result[key] = mask_id_card(str(result[key]))
            elif isinstance(result[key], dict):
                result[key] = mask_sensitive_data(result[key], sensitive_fields)
            elif isinstance(result[key], list):
                result[key] = [mask_sensitive_data(item, sensitive_fields) if isinstance(item, dict) else item for item in result[key]]

    return result


class MaskingFormatter(logging.Formatter):
    def format(self, record):
        message = super().format(record)
        message = re.sub(r'1[3-9]\d{9}', lambda m: mask_phone(m.group()), message)
        message = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', lambda m: mask_email(m.group()), message)
        return message


def setup_masked_logger(name: str = __name__):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(MaskingFormatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    return logger
