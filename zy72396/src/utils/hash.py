import hashlib
from typing import Optional


def generate_photo_id(file_name: str, original_row: int, batch_context: Optional[str] = None) -> str:
    raw = f"{file_name}:{original_row}"
    if batch_context:
        raw = f"{batch_context}:{raw}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]


def generate_batch_id(source_file: str, timestamp_str: str) -> str:
    raw = f"{source_file}:{timestamp_str}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:12]
