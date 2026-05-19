from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from hashlib import sha256
import json


class ReviewStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    NO_EXEMPTION = "no_exemption"


@dataclass
class ConfigItem:
    service_name: str
    config_key: str
    expected_value: str
    actual_value: str
    source_id: str = ""
    row_hash: str = field(init=False)

    def __post_init__(self):
        self.row_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        data = {
            "service_name": self.service_name,
            "config_key": self.config_key,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
        }
        json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return sha256(json_str.encode("utf-8")).hexdigest()[:16]

    def has_drift(self) -> bool:
        return self.expected_value != self.actual_value


@dataclass
class ExemptionRecord:
    service_name: str
    config_key: str
    reason: str
    expire_date: str
    reviewer: str = ""
    status: ReviewStatus = ReviewStatus.PENDING
    exemption_id: str = field(init=False)

    def __post_init__(self):
        self.exemption_id = self._compute_id()

    def _compute_id(self) -> str:
        data = {
            "service_name": self.service_name,
            "config_key": self.config_key,
            "reason": self.reason,
            "expire_date": self.expire_date,
        }
        json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return sha256(json_str.encode("utf-8")).hexdigest()[:12]

    def is_expired(self, check_date: Optional[datetime] = None) -> bool:
        if check_date is None:
            check_date = datetime.now()
        try:
            expire_dt = datetime.strptime(self.expire_date, "%Y-%m-%d")
            return check_date > expire_dt
        except ValueError:
            return True


@dataclass
class DriftRecord:
    config_item: ConfigItem
    exemption: Optional[ExemptionRecord] = None
    review_status: ReviewStatus = ReviewStatus.NO_EXEMPTION
    is_exemption_expired: bool = False
    record_id: str = field(init=False)

    def __post_init__(self):
        self.record_id = self.config_item.row_hash
