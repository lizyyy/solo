import hashlib
import json
import uuid
from datetime import datetime, date
from typing import Any, Dict


def generate_record_no(prefix: str = "EXP") -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"{prefix}-{timestamp}-{unique_id}"


def calculate_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def mask_sensitive_data(data: Dict[str, Any], role: str) -> Dict[str, Any]:
    masked = data.copy()

    if role in ["pharmacy_manager", "town_supervisor"]:
        sensitive_fields = ["liability_amount", "change_reason"]
        for field in sensitive_fields:
            if field in masked and masked[field]:
                masked[field] = "***"

    if role == "pharmacy_manager":
        if "other_pharmacy_data" in masked:
            masked["other_pharmacy_data"] = "***"

    return masked


def serialize_for_audit(obj: Any) -> str:
    def default_serializer(o):
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        if hasattr(o, "__dict__"):
            return {k: v for k, v in o.__dict__.items() if not k.startswith("_")}
        return str(o)

    return json.dumps(obj, default=default_serializer, ensure_ascii=False, indent=2)


def get_days_near_expiry(expiry_date: date, reference_date: date = None) -> int:
    if reference_date is None:
        reference_date = date.today()
    delta = expiry_date - reference_date
    return delta.days


def get_expiry_category(days_near_expiry: int) -> str:
    if days_near_expiry <= 0:
        return "已过期"
    elif days_near_expiry <= 30:
        return "临期(30天内)"
    elif days_near_expiry <= 90:
        return "近效期(90天内)"
    elif days_near_expiry <= 180:
        return "预警(180天内)"
    else:
        return "正常"
