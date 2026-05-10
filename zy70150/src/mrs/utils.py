import hashlib
import uuid
from datetime import datetime
from typing import Any, Dict, Optional


def generate_id() -> str:
    return str(uuid.uuid4())


def generate_request_id() -> str:
    return f"REQ-{generate_id()[:8]}"


def generate_execution_id() -> str:
    return f"EXEC-{generate_id()[:8]}"


def generate_report_id() -> str:
    return f"RPT-{generate_id()[:8]}"


def generate_message_id() -> str:
    return f"MSG-{generate_id()[:8]}"


def generate_idempotency_key(
    business_type: str,
    business_id: str,
    message_id: Optional[str] = None,
) -> str:
    raw = f"{business_type}:{business_id}"
    if message_id:
        raw += f":{message_id}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def to_business_summary(data: Dict[str, Any]) -> str:
    parts = []
    if data.get("message_id"):
        parts.append(f"消息ID: {data['message_id']}")
    if data.get("business_key"):
        parts.append(f"业务主键: {data['business_key']}")
    if data.get("business_type"):
        parts.append(f"业务类型: {data['business_type']}")
    if data.get("business_id"):
        parts.append(f"业务ID: {data['business_id']}")
    if data.get("amount"):
        parts.append(f"金额: {data['amount']:.2f}")
    if data.get("quantity"):
        parts.append(f"数量: {data['quantity']}")
    if data.get("quota"):
        parts.append(f"名额: {data['quota']}")
    return " | ".join(parts) if parts else "无业务信息"
