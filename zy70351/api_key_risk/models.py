"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import List, Dict, Any, Optional


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskType(Enum):
    VOLUME_SPIKE = "volume_spike"
    UNUSUAL_REGION = "unusual_region"
    SENSITIVE_API = "sensitive_api"
    FAILURE_RATE = "failure_rate"
    MULTI_IP = "multi_ip"


class RecommendationType(Enum):
    OBSERVE = "observe"
    LIMIT_RATE = "limit_rate"
    BLOCK_KEY = "block_key"
    SUSPEND_KEY = "suspend_key"
    CONTACT_CUSTOMER = "contact_customer"
    REVOKE_PERMISSION = "revoke_permission"


@dataclass
class CustomerProfile:
    customer_id: str
    customer_name: str
    create_date: date
    business_type: str
    industry: str
    avg_daily_calls: float = 0
    peak_hours: List[int] = field(default_factory=list)
    usual_regions: List[str] = field(default_factory=list)
    is_new_customer: bool = False


@dataclass
class APIKey:
    key_id: str
    customer_id: str
    api_key: str
    create_date: date
    permissions: List[str] = field(default_factory=list)
    rate_limit: int = 1000
    is_active: bool = True


@dataclass
class AccessLog:
    log_id: str
    api_key: str
    endpoint: str
    ip: str
    region: str
    timestamp: datetime
    status_code: int
    response_time_ms: int
    is_sensitive: bool = False
    is_duplicate: bool = False


@dataclass
class IPRegionBaseline:
    customer_id: str
    key_id: str
    usual_regions: List[str] = field(default_factory=list)
    usual_ips: List[str] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class APIConfig:
    endpoint: str
    is_sensitive: bool = False
    permission_required: Optional[str] = None
    max_calls_per_hour: int = 100


@dataclass
class RiskEvidence:
    risk_type: RiskType
    description: str
    severity: float
    supporting_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskAssessment:
    customer_id: str
    key_id: str
    risk_level: RiskLevel
    overall_score: float
    evidences: List[RiskEvidence] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    analysis_time: datetime = field(default_factory=datetime.now)


@dataclass
class SafetyMark:
    mark_id: str
    customer_id: str
    key_id: str
    marked_by: str
    mark_time: datetime
    reason: str
    expires_at: Optional[datetime] = None
    is_active: bool = True


@dataclass
class RateLimitSuggestion:
    key_id: str
    customer_id: str
    current_limit: int
    suggested_limit: int
    reason: str
    affected_apis: List[str] = field(default_factory=list)
    normal_traffic_impact: str = ""


@dataclass
class RiskReport:
    report_id: str
    dimension: str
    dimension_value: str
    risk_level: RiskLevel
    total_calls: int
    evidences: List[RiskEvidence] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    generate_time: datetime = field(default_factory=datetime.now)
