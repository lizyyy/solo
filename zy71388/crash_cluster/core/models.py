from typing import List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class CrashReport:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    app_version: Optional[str] = None
    device_model: Optional[str] = None
    stack_trace: Optional[str] = None
    user_note: Optional[str] = None
    raw_log: Optional[str] = None
    normalized_stack: Optional[str] = None
    stack_fingerprint: Optional[str] = None
    version_bucket: Optional[str] = None
    device_family: Optional[str] = None
    cluster_id: Optional[str] = None
    is_obfuscated: bool = False
    obfuscated_frames: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=_utcnow_iso)
    updated_at: str = field(default_factory=_utcnow_iso)


@dataclass
class CrashCluster:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    fingerprint: str = ""
    version_bucket: str = ""
    representative_stack: str = ""
    crash_ids: List[str] = field(default_factory=list)
    device_distribution: dict = field(default_factory=dict)
    version_distribution: dict = field(default_factory=dict)
    obfuscated_count: int = 0
    first_seen: str = ""
    last_seen: str = ""
    updated_at: str = field(default_factory=_utcnow_iso)
