from datetime import datetime
import uuid
import re
from typing import Optional
import pytz

from config.settings import Settings

def parse_datetime(dt_str: str) -> Optional[datetime]:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(dt_str.strip(), fmt)
            tz = pytz.timezone(Settings.TIMEZONE)
            if dt.tzinfo is None:
                return tz.localize(dt)
            return dt.astimezone(tz)
        except (ValueError, TypeError):
            continue
    return None

def format_datetime(dt: datetime) -> str:
    if dt is None:
        return ""
    tz = pytz.timezone(Settings.TIMEZONE)
    if dt.tzinfo is None:
        dt = tz.localize(dt)
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def generate_id() -> str:
    return str(uuid.uuid4())[:8]

def normalize_slot_id(block: str, row: int, bay: int, tier: int) -> str:
    block = block.upper().strip()
    return f"{block}-{int(row):02d}-{int(bay):02d}-{int(tier)}"

def parse_slot_id(slot_id: str) -> dict:
    parts = slot_id.split("-")
    if len(parts) >= 4:
        return {
            "block": parts[0],
            "row": int(parts[1]),
            "bay": int(parts[2]),
            "tier": int(parts[3])
        }
    return None
