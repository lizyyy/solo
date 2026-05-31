import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from ulid import ULID


def generate_trace_id() -> str:
    return str(ULID())


def generate_idempotency_key() -> str:
    return str(uuid.uuid4())


def generate_batch_no(prefix: str = "BATCH") -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{prefix}_{timestamp}_{str(uuid.uuid4())[:8].upper()}"


def generate_export_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"EXPORT_{timestamp}_{str(uuid.uuid4())[:8].upper()}"


def generate_material_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"MAT_{timestamp}_{str(uuid.uuid4())[:8].upper()}"


def generate_track_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"TRK_{timestamp}_{str(uuid.uuid4())[:8].upper()}"


def generate_script_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"SCR_{timestamp}_{str(uuid.uuid4())[:8].upper()}"


def calculate_file_hash(file_content: bytes) -> str:
    return hashlib.sha256(file_content).hexdigest()


def calculate_filter_hash(filter_params: Dict[str, Any]) -> str:
    sorted_params = json.dumps(filter_params, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(sorted_params.encode("utf-8")).hexdigest()


def calculate_request_hash(request_body: Dict[str, Any]) -> str:
    sorted_body = json.dumps(request_body, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(sorted_body.encode("utf-8")).hexdigest()


def get_expires_at(hours: int = 24) -> datetime:
    return datetime.utcnow() + timedelta(hours=hours)


def parse_tags(tags_str: Optional[str]) -> list:
    if not tags_str:
        return []
    return [tag.strip() for tag in tags_str.split(",") if tag.strip()]


def format_tags(tags: list) -> str:
    return ",".join(tags) if tags else ""


def format_timestamp(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.isoformat()


def parse_timestamp(ts_str: Optional[str]) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        return None


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def safe_str(value: Any, default: str = "") -> str:
    return str(value).strip() if value is not None else default
