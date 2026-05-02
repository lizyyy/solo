from datetime import datetime
import uuid
from typing import Optional


def generate_code(prefix: str, timestamp: bool = True, 
                  random_suffix: bool = True, 
                  timestamp_format: str = "%Y%m%d%H%M%S") -> str:
    parts = [prefix.upper()]
    
    if timestamp:
        parts.append(datetime.now().strftime(timestamp_format))
    
    if random_suffix:
        suffix = uuid.uuid4().hex[:6].upper()
        parts.append(suffix)
    
    return "_".join(parts)


def generate_reservation_code() -> str:
    return generate_code("RES", timestamp=True, random_suffix=True)


def generate_swipe_code() -> str:
    return generate_code("SWP", timestamp=True, random_suffix=True)


def generate_sample_code() -> str:
    return generate_code("SAM", timestamp=True, random_suffix=True)


def generate_violation_code() -> str:
    return generate_code("VIO", timestamp=True, random_suffix=True)


def generate_bill_code() -> str:
    return generate_code("BIL", timestamp=True, random_suffix=True)


def generate_audit_code() -> str:
    return generate_code("AUD", timestamp=True, random_suffix=True)


def generate_batch_code() -> str:
    return generate_code("BAT", timestamp=True, random_suffix=True)


def generate_review_code() -> str:
    return generate_code("REV", timestamp=True, random_suffix=True)
