from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
import json

class HealthLevel(Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"

class AnomalyType(Enum):
    LATENCY_SPIKE = "latency_spike"
    PACKET_LOSS_HIGH = "packet_loss_high"
    CERT_EXPIRING_SOON = "cert_expiring_soon"
    CERT_EXPIRED = "cert_expired"
    PROBE_OFFLINE = "probe_offline"
    REGION_ANOMALY = "region_anomaly"
    DATA_GAP = "data_gap"

@dataclass
class Region:
    region_id: str
    name: str
    country: str
    city: str
    timezone: str
    latitude: float
    longitude: float
    isp: str
    tier: int = 1

@dataclass
class EdgeNode:
    node_id: str
    name: str
    region_id: str
    ip_address: str
    ipv6_address: Optional[str]
    is_active: bool
    hardware_model: str
    bandwidth_capacity: int
    last_maintenance: Optional[datetime]
    provisioned_at: datetime
    tags: List[str] = field(default_factory=list)

@dataclass
class CertificateInfo:
    cert_id: str
    node_id: str
    domain: str
    issuer: str
    serial_number: str
    issued_at: datetime
    expires_at: datetime
    signature_algorithm: str
    key_size: int
    is_wildcard: bool
    last_checked: datetime
    chain_valid: bool
    ocsp_status: Optional[str]

@dataclass
class ProbeResult:
    probe_id: str
    node_id: str
    probe_source: str
    timestamp: datetime
    latency_ms: float
    packet_loss_pct: float
    jitter_ms: float
    http_status: Optional[int]
    dns_resolve_time: Optional[float]
    tcp_connect_time: Optional[float]
    tls_handshake_time: Optional[float]
    download_speed_mbps: Optional[float]
    is_success: bool
    error_message: Optional[str]

@dataclass
class AnomalyRecord:
    anomaly_id: str
    node_id: str
    anomaly_type: AnomalyType
    severity: HealthLevel
    detected_at: datetime
    description: str
    raw_data: Dict[str, Any]
    is_acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    evidence: List[str] = field(default_factory=list)

@dataclass
class HealthRadarPoint:
    node_id: str
    node_name: str
    region_id: str
    region_name: str
    latency_score: float
    packet_loss_score: float
    certificate_score: float
    availability_score: float
    overall_score: float
    health_level: HealthLevel
    anomalies: List[AnomalyRecord]
    last_updated: datetime

@dataclass
class TrendDataPoint:
    timestamp: datetime
    region_id: Optional[str]
    avg_latency_ms: float
    avg_packet_loss_pct: float
    nodes_healthy_count: int
    nodes_warning_count: int
    nodes_critical_count: int
    certs_expiring_soon_count: int

@dataclass
class AuditLog:
    log_id: str
    action: str
    user: str
    timestamp: datetime
    details: Dict[str, Any]
    ip_address: Optional[str]

def to_dict(obj: Any) -> Dict[str, Any]:
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, Enum):
        return obj.value
    elif hasattr(obj, '__dataclass_fields__'):
        result = {}
        for field_name in obj.__dataclass_fields__:
            result[field_name] = to_dict(getattr(obj, field_name))
        return result
    elif isinstance(obj, list):
        return [to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: to_dict(v) for k, v in obj.items()}
    else:
        return obj

def from_dict(cls, data: Dict[str, Any]) -> Any:
    if not hasattr(cls, '__dataclass_fields__'):
        return data
    
    kwargs = {}
    for field_name, field_type in cls.__dataclass_fields__.items():
        if field_name in data:
            value = data[field_name]
            if field_type.type == 'datetime' and isinstance(value, str):
                kwargs[field_name] = datetime.fromisoformat(value)
            elif field_type.type == 'HealthLevel' and isinstance(value, str):
                kwargs[field_name] = HealthLevel(value)
            elif field_type.type == 'AnomalyType' and isinstance(value, str):
                kwargs[field_name] = AnomalyType(value)
            else:
                kwargs[field_name] = value
    
    return cls(**kwargs)
