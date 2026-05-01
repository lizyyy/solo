"""
配置模块
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Pattern


@dataclass
class StoreRule:
    store_code: str
    store_name: str
    checkpoints: List[str]
    time_window: Dict[str, str]
    photo_patterns: List[str]
    checkpoint_patterns: Dict[str, List[str]] = field(default_factory=dict)

    def get_checkpoint_pattern(self, checkpoint: str) -> Pattern:
        patterns = self.checkpoint_patterns.get(checkpoint, [f".*{re.escape(checkpoint)}.*"])
        combined_pattern = "|".join(patterns)
        return re.compile(combined_pattern, re.IGNORECASE)


@dataclass
class InspectionItem:
    store_code: str
    checkpoint: str
    required: bool = True
    deadline: Optional[str] = None


@dataclass
class PhotoMetadata:
    original_path: str
    filename: str
    size: int
    exif_time: Optional[str] = None
    filename_time: Optional[str] = None
    determined_time: Optional[str] = None
    store_code_from_filename: Optional[str] = None
    store_code_from_exif: Optional[str] = None
    determined_store_code: Optional[str] = None
    checkpoint_from_filename: Optional[str] = None
    checkpoint_from_content: Optional[str] = None
    determined_checkpoint: Optional[str] = None
    file_hash: Optional[str] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None


@dataclass
class Issue:
    issue_type: str
    severity: str
    photo_metadata: Optional[PhotoMetadata]
    message: str
    store_code: Optional[str] = None
    checkpoint: Optional[str] = None
    details: Dict = field(default_factory=dict)


ISSUE_TYPES = {
    "missing_photo": "缺拍",
    "duplicate_photo": "重复",
    "time_deviation": "时间偏差",
    "checkpoint_mismatch": "点位错配",
    "store_mismatch": "门店不匹配",
    "no_exif": "EXIF缺失",
    "name_conflict": "同名冲突",
    "unknown_store": "未知门店",
    "unknown_checkpoint": "未知点位",
}

ISSUE_SEVERITY = {
    "critical": "严重",
    "warning": "警告",
    "info": "信息",
}
