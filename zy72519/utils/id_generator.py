import uuid
from datetime import datetime


def generate_id(prefix: str = "") -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid.uuid4().hex[:8]
    if prefix:
        return f"{prefix}_{timestamp}_{unique_suffix}"
    return f"{timestamp}_{unique_suffix}"


def generate_batch_id() -> str:
    return f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
