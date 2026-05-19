from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class RiskLevel(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class CertStatus(Enum):
    VALID = "VALID"
    EXPIRED = "EXPIRED"
    EXPIRING_SOON = "EXPIRING_SOON"
    NOT_YET_VALID = "NOT_YET_VALID"
    INVALID = "INVALID"


@dataclass
class CertConfig:
    warn_days: int = 30
    output_dir: str = "./cert_reports"
    output_json: bool = False
    output_html: bool = False
    weak_algorithms: List[str] = field(default_factory=lambda: [
        "md2", "md5", "sha1", "md4", "mdc2"
    ])
    weak_key_sizes: Dict[str, int] = field(default_factory=lambda: {
        "RSA": 2048,
        "DSA": 2048,
        "EC": 256
    })


@dataclass
class CertNode:
    subject: str
    issuer: str
    serial_number: str
    not_before: datetime
    not_after: datetime
    days_until_expiry: int
    signature_algorithm: str
    public_key_algorithm: str
    public_key_size: int
    fingerprint: str
    is_self_signed: bool
    is_root_ca: bool
    is_intermediate_ca: bool
    is_leaf_cert: bool
    path: Optional[str] = None
    pem_data: Optional[str] = None


@dataclass
class AlgorithmIssue:
    algorithm: str
    key_size: Optional[int]
    risk_level: RiskLevel
    issue_type: str
    description: str
    recommendation: str


@dataclass
class ExpiryIssue:
    cert_node: CertNode
    status: CertStatus
    days_remaining: int
    expiry_date: datetime
    risk_level: RiskLevel
    recommendation: str


@dataclass
class ChainIssue:
    issue_type: str
    description: str
    risk_level: RiskLevel
    affected_certs: List[str]
    recommendation: str


@dataclass
class CertAnalysisResult:
    cert_file: str
    analyzed_at: datetime
    chain_nodes: List[CertNode]
    chain_valid: bool
    chain_length: int
    expiry_issues: List[ExpiryIssue]
    algorithm_issues: List[AlgorithmIssue]
    chain_issues: List[ChainIssue]
    overall_risk: RiskLevel
    overall_status: str
    summary: Dict[str, Any]
    raw_errors: List[str] = field(default_factory=list)


@dataclass
class RepairRecord:
    issue_type: str
    original_value: str
    recommended_value: str
    status: str
    applied_at: Optional[datetime] = None
