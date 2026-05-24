from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime


class ResourceType(str, Enum):
    PVC = "PersistentVolumeClaim"
    POD = "Pod"
    CRONJOB = "CronJob"
    JOB = "Job"
    STATEFULSET = "StatefulSet"
    DEPLOYMENT = "Deployment"
    DAEMONSET = "DaemonSet"
    REPLICASET = "ReplicaSet"
    REPLICATIONCONTROLLER = "ReplicationController"


@dataclass
class SourceLocation:
    file_path: str
    start_line: int
    end_line: Optional[int] = None

    def __str__(self) -> str:
        if self.end_line:
            return f"{self.file_path}:{self.start_line}-{self.end_line}"
        return f"{self.file_path}:{self.start_line}"


@dataclass
class K8sResource:
    kind: str
    api_version: str
    name: str
    namespace: str
    labels: Dict[str, str] = field(default_factory=dict)
    annotations: Dict[str, str] = field(default_factory=dict)
    spec: Dict[str, Any] = field(default_factory=dict)
    status: Dict[str, Any] = field(default_factory=dict)
    source: Optional[SourceLocation] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def key(self) -> str:
        return f"{self.namespace}/{self.kind}/{self.name}"

    @property
    def resource_type(self) -> Optional[ResourceType]:
        try:
            return ResourceType(self.kind)
        except ValueError:
            return None


@dataclass
class ReferenceEdge:
    from_resource: str
    to_resource: str
    reference_type: str
    via_field: str


@dataclass
class RetentionRule:
    rule_type: str
    description: str
    expires_at: Optional[datetime] = None
    is_active: bool = True


@dataclass
class PVCStatus:
    pvc: K8sResource
    is_orphan: bool
    references: List[str] = field(default_factory=list)
    retention_rules: List[RetentionRule] = field(default_factory=list)
    cleanup_recommendation: str = "review"
    reason: str = ""
    issues: List[str] = field(default_factory=list)


@dataclass
class AnalysisResult:
    pvcs: List[PVCStatus] = field(default_factory=list)
    all_resources: List[K8sResource] = field(default_factory=list)
    references: List[ReferenceEdge] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def orphan_count(self) -> int:
        return sum(1 for p in self.pvcs if p.is_orphan)

    @property
    def total_pvc_count(self) -> int:
        return len(self.pvcs)
