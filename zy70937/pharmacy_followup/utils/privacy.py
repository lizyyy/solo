import re
import hashlib


def mask_phone(phone: str) -> str:
    if not phone:
        return ""
    phone = re.sub(r"\D", "", phone)
    if len(phone) == 11:
        return phone[:3] + "****" + phone[7:]
    return phone[:2] + "****" + phone[-2:] if len(phone) > 4 else "****"


def mask_id_card(id_card: str) -> str:
    if not id_card:
        return ""
    id_card = id_card.strip()
    if len(id_card) == 18:
        return id_card[:6] + "********" + id_card[-4:]
    return id_card[:4] + "****" + id_card[-4:] if len(id_card) > 8 else "****"


def mask_address(address: str) -> str:
    if not address:
        return ""
    if len(address) > 6:
        return address[:3] + "***" + address[-3:]
    return address[:1] + "***" if len(address) > 1 else "***"


def mask_name(name: str) -> str:
    if not name:
        return ""
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


def calculate_file_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()


def generate_trace_id(*args) -> str:
    content = "|".join(str(arg) for arg in args if arg)
    return hashlib.sha256(content.encode()).hexdigest()[:16]
