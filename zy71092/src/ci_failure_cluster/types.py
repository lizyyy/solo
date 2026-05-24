from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
import hashlib
import json


@dataclass
class MatrixParams:
    os: Optional[str] = None
    python_version: Optional[str] = None
    node_version: Optional[str] = None
    browser: Optional[str] = None
    arch: Optional[str] = None
    custom: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        result = {k: v for k, v in asdict(self).items() if v}
        if self.custom:
            result.update(self.custom)
        return result


@dataclass
class FailureRecord:
    id: str
    commit_sha: str
    job_name: str
    matrix_params: MatrixParams
    error_message: str
    stack_trace: Optional[str] = None
    full_log: Optional[str] = None
    timestamp: Optional[datetime] = None
    rerun_count: int = 0
    rerun_success: bool = False
    raw_source: str = ""

    def get_signature_input(self) -> str:
        parts = [self.error_message]
        if self.stack_trace:
            parts.append(self.stack_trace)
        return "\n".join(parts)

    def generate_id(self) -> str:
        content = f"{self.commit_sha}:{self.job_name}:{self.error_message[:100]}"
        return hashlib.md5(content.encode()).hexdigest()[:12]


@dataclass
class NormalizedSignature:
    normalized_error: str
    normalized_stack: Optional[str]
    signature_hash: str
    tokens: List[str]
    error_type: Optional[str] = None
    error_category: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class FailureCluster:
    cluster_id: str
    signature: NormalizedSignature
    members: List[FailureRecord]
    jitter_score: float = 0.0
    matrix_coverage: Dict[str, Any] = field(default_factory=dict)

    @property
    def size(self) -> int:
        return len(self.members)

    @property
    def unique_commits(self) -> int:
        return len(set(r.commit_sha for r in self.members))

    @property
    def rerun_success_rate(self) -> float:
        if not self.members:
            return 0.0
        success = sum(1 for r in self.members if r.rerun_success)
        return success / len(self.members)


@dataclass
class ClusterReport:
    generated_at: datetime
    total_failures: int
    total_clusters: int
    clusters: List[FailureCluster]
    unclustered: List[FailureRecord]
    analysis_params: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "generated_at": self.generated_at.isoformat(),
            "total_failures": self.total_failures,
            "total_clusters": self.total_clusters,
            "clusters": [
                {
                    "cluster_id": c.cluster_id,
                    "size": c.size,
                    "jitter_score": c.jitter_score,
                    "unique_commits": c.unique_commits,
                    "rerun_success_rate": c.rerun_success_rate,
                    "signature": c.signature.to_dict(),
                    "matrix_coverage": c.matrix_coverage,
                    "members": [
                        {
                            "id": m.id,
                            "commit_sha": m.commit_sha,
                            "job_name": m.job_name,
                            "matrix_params": m.matrix_params.to_dict(),
                            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                            "rerun_count": m.rerun_count,
                            "rerun_success": m.rerun_success,
                        }
                        for m in c.members
                    ],
                }
                for c in self.clusters
            ],
            "unclustered_count": len(self.unclustered),
            "unclustered": [
                {
                    "id": u.id,
                    "commit_sha": u.commit_sha,
                    "job_name": u.job_name,
                    "matrix_params": u.matrix_params.to_dict(),
                    "error_message": u.error_message,
                    "stack_trace": u.stack_trace,
                    "timestamp": u.timestamp.isoformat() if u.timestamp else None,
                    "rerun_count": u.rerun_count,
                    "rerun_success": u.rerun_success,
                    "raw_source": u.raw_source,
                }
                for u in self.unclustered
            ],
            "analysis_params": self.analysis_params,
        }
