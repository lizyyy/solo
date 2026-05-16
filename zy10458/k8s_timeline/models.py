from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any


@dataclass
class Event:
    timestamp: datetime
    type: str
    reason: str
    message: str
    object_kind: str
    object_name: str
    namespace: str
    source_component: str
    count: int = 1
    raw_source: Dict[str, Any] = field(default_factory=dict)

    def __lt__(self, other):
        return self.timestamp < other.timestamp


@dataclass
class PodStatus:
    name: str
    namespace: str
    phase: str
    pod_ip: str
    host_ip: str
    start_time: Optional[datetime]
    containers_ready: bool
    ready: bool
    restarts: int
    qos_class: str
    labels: Dict[str, str]
    annotations: Dict[str, str]
    container_statuses: List[Dict[str, Any]]
    raw_source: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReplicaSetInfo:
    name: str
    namespace: str
    replicas: int
    ready_replicas: int
    available_replicas: int
    generation: int
    creation_timestamp: Optional[datetime]
    labels: Dict[str, str]
    selector: Dict[str, str]
    pod_template_hash: str
    raw_source: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DeploymentInfo:
    name: str
    namespace: str
    replicas: int
    updated_replicas: int
    ready_replicas: int
    available_replicas: int
    unavailable_replicas: int
    generation: int
    observed_generation: int
    creation_timestamp: Optional[datetime]
    strategy: str
    labels: Dict[str, str]
    selector: Dict[str, str]
    current_replicaset: Optional[str]
    old_replicasets: List[str]
    raw_source: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImageInfo:
    name: str
    tag: str
    full_reference: str
    container_name: str


@dataclass
class TimelineEvent:
    timestamp: datetime
    event_type: str
    severity: str
    title: str
    description: str
    object_ref: str
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimelineReport:
    namespace: str
    deployment_name: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    events: List[TimelineEvent] = field(default_factory=list)
    pods: List[PodStatus] = field(default_factory=list)
    replicasets: List[ReplicaSetInfo] = field(default_factory=list)
    deployment: Optional[DeploymentInfo] = None
    image_changes: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    parse_errors: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
