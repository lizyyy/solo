"""
Data models for Passkey/FIDO2 compatibility checker
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Any
from datetime import datetime


class IssueSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IssueCategory(Enum):
    RP_ID = "rp_id"
    RESIDENT_KEY = "resident_key"
    UV_UP = "uv_up"
    ALGORITHM = "algorithm"
    COUNTER = "counter"
    SYNC_RISK = "sync_risk"
    UNKNOWN_ALGORITHM = "unknown_algorithm"


@dataclass
class RelyingPartyConfig:
    rp_id: str
    rp_name: str
    origins: List[str]
    resident_key_required: bool
    user_verification_required: bool
    supported_algorithms: List[int]
    cross_device_allowed: bool


@dataclass
class BrowserSupport:
    browser: str
    version: str
    platform: str
    fido2_supported: bool
    resident_key_supported: bool
    user_verification_supported: bool
    supported_algorithms: List[int]


@dataclass
class UserInfo:
    user_id: str
    username: str
    display_name: str
    email: str


@dataclass
class AuthenticatorLogEntry:
    credential_id: str
    user_id: str
    rp_id: str
    timestamp: datetime
    sign_count: int
    resident_key: bool
    user_verified: bool
    user_present: bool
    algorithm: int
    device_id: str
    browser: str
    browser_version: str
    platform: str
    raw_data: Dict[str, Any]


@dataclass
class Issue:
    issue_id: str
    category: IssueCategory
    severity: IssueSeverity
    title: str
    description: str
    affected_credential_ids: List[str] = field(default_factory=list)
    affected_user_ids: List[str] = field(default_factory=list)
    affected_devices: List[str] = field(default_factory=list)
    additional_info: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[datetime] = None


@dataclass
class CredentialState:
    credential_id: str
    user_id: str
    rp_id: str
    sign_counts: Dict[str, int] = field(default_factory=dict)
    latest_sign_count: int = 0
    resident_key: Optional[bool] = None
    user_verified: Optional[bool] = None
    algorithm: Optional[int] = None
    devices: List[str] = field(default_factory=list)
    browsers: List[str] = field(default_factory=list)
    timestamps: List[datetime] = field(default_factory=list)
    counter_regressions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class CompatibilityReport:
    total_users: int = 0
    total_credentials: int = 0
    total_log_entries: int = 0
    issues: List[Issue] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    browser_compatibility: Dict[str, Any] = field(default_factory=dict)
    algorithm_usage: Dict[int, int] = field(default_factory=dict)
    generated_at: Optional[datetime] = None


@dataclass
class CounterRegression:
    credential_id: str
    from_device: str
    to_device: str
    from_count: int
    to_count: int
    from_timestamp: datetime
    to_timestamp: datetime
    is_cross_device: bool
