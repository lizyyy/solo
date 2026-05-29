import hashlib
import uuid
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import MATERIAL_STORAGE_DIR


def generate_batch_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"BATCH-{timestamp}-{suffix}"


def generate_report_no(batch_no: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"REPORT-{batch_no}-{timestamp}"


def generate_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def generate_file_hash(file_path: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def generate_cache_fingerprint(data: str) -> str:
    return hashlib.md5(data.encode("utf-8")).hexdigest()


def store_material_content(batch_no: str, material_type: str, content: str, filename: Optional[str] = None) -> Path:
    batch_dir = MATERIAL_STORAGE_DIR / batch_no / material_type
    batch_dir.mkdir(parents=True, exist_ok=True)
    if not filename:
        filename = f"{material_type}_{uuid.uuid4().hex[:8]}.txt"
    file_path = batch_dir / filename
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return file_path


def parse_timestamp(log_line: str) -> Optional[datetime]:
    patterns = [
        r"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)",
        r"\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]",
        r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})",
        r"(\d{4}-\d{2}-\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, log_line)
        if match:
            ts_str = match.group(1)
            try:
                ts_str = ts_str.replace("T", " ").replace("Z", "")
                if "." in ts_str:
                    ts_str = ts_str.split(".")[0]
                if "+" in ts_str or "-" in ts_str[10:]:
                    ts_str = ts_str.split("+")[0].split("-")[0]
                return datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    return datetime.strptime(ts_str, "%Y-%m-%d")
                except ValueError:
                    pass
    return None


def parse_log_level(log_line: str) -> Optional[str]:
    patterns = [
        r"\[(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\]",
        r"\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, log_line, re.IGNORECASE)
        if match:
            return match.group(1).upper()
    return None


def sanitize_filename(name: str) -> str:
    name = re.sub(r"[^\w\s.-]", "_", name)
    name = name.replace(" ", "_")
    return name[:100]
