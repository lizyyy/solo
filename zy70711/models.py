from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib
import json
import uuid


@dataclass
class RuntimeEnvironment:
    python_version: str
    os: str
    cpu_info: str
    memory_total: int
    disk_space: int
    libraries: Dict[str, str]
    env_hash: str = ""

    def generate_hash(self) -> str:
        self.env_hash = self._calculate_hash()
        return self.env_hash

    def verify_hash(self) -> bool:
        return self.env_hash == self._calculate_hash()

    def _calculate_hash(self) -> str:
        env_str = json.dumps({
            "python_version": self.python_version,
            "os": self.os,
            "cpu_info": self.cpu_info,
            "memory_total": self.memory_total,
            "libraries": dict(sorted(self.libraries.items()))
        }, sort_keys=True)
        return hashlib.sha256(env_str.encode()).hexdigest()[:16]


@dataclass
class ParameterSet:
    param_id: str = ""
    name: str = ""
    values: Dict[str, Any] = field(default_factory=dict)
    signature: str = ""
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.param_id:
            self.param_id = str(uuid.uuid4())[:8]

    def generate_signature(self) -> str:
        sorted_params = dict(sorted(self.values.items()))
        param_str = json.dumps(sorted_params, sort_keys=True)
        self.signature = hashlib.sha256(param_str.encode()).hexdigest()[:16]
        return self.signature

    def verify_signature(self) -> bool:
        sorted_params = dict(sorted(self.values.items()))
        param_str = json.dumps(sorted_params, sort_keys=True)
        expected = hashlib.sha256(param_str.encode()).hexdigest()[:16]
        return self.signature == expected


@dataclass
class OutputArtifact:
    artifact_id: str = ""
    name: str = ""
    type: str = ""
    path: str = ""
    size: int = 0
    checksum: str = ""
    version: str = "1.0.0"
    created_at: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.artifact_id:
            self.artifact_id = str(uuid.uuid4())[:8]

    def generate_checksum(self, content: bytes) -> str:
        self.checksum = hashlib.sha256(content).hexdigest()[:16]
        return self.checksum


@dataclass
class ReviewComment:
    reviewer: str
    comment: str
    status: str
    reviewed_at: str = ""

    def __post_init__(self):
        if not self.reviewed_at:
            self.reviewed_at = datetime.now().isoformat()


@dataclass
class NotebookRecord:
    notebook_id: str
    name: str
    path: str
    parameters: ParameterSet
    environment: RuntimeEnvironment
    artifacts: List[OutputArtifact] = field(default_factory=list)
    reviews: List[ReviewComment] = field(default_factory=list)
    review_status: str = "pending"
    created_at: str = ""
    executed_at: str = ""
    execution_time: float = 0.0
    exit_code: int = 0

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["parameters"] = asdict(self.parameters)
        data["environment"] = asdict(self.environment)
        data["artifacts"] = [asdict(a) for a in self.artifacts]
        data["reviews"] = [asdict(r) for r in self.reviews]
        return data

    def add_artifact(self, artifact: OutputArtifact):
        self.artifacts.append(artifact)

    def add_review(self, review: ReviewComment):
        self.reviews.append(review)
        if review.status == "approved":
            self.review_status = "approved"
        elif review.status == "rejected":
            self.review_status = "rejected"


@dataclass
class ArtifactIndex:
    index_id: str = ""
    records: List[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.index_id:
            self.index_id = str(uuid.uuid4())[:8]
