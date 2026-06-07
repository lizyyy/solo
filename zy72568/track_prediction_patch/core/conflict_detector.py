from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from ..models.candidate_table import CandidateTable, CandidateRecord
from ..models.param_yaml import ParamYAML
from ..models.patch_record import PatchIssue, PatchIssueType
from ..utils.helpers import get_current_time


class ConflictType(str, Enum):
    THRESHOLD_MISMATCH = "threshold_mismatch"
    PARAM_VALUE_CONFLICT = "param_value_conflict"
    MISSING_THRESHOLD = "missing_threshold"


@dataclass
class ConflictEvidence:
    """冲突证据，用于展示给用户确认或驳回"""
    conflict_type: ConflictType
    track_id: str
    description: str
    candidate_value: float
    yaml_value: float
    threshold_name: str
    candidate_report_time: Optional[datetime] = None
    yaml_update_time: Optional[datetime] = None
    severity: str = "warning"
    resolved: bool = False
    resolution: str = ""  # "confirmed" 或 "rejected"
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None
    evidence_id: str = field(default_factory=lambda: f"evi_{id(datetime.now())}")

    def to_dict(self) -> Dict:
        return {
            "evidence_id": self.evidence_id,
            "conflict_type": self.conflict_type,
            "track_id": self.track_id,
            "description": self.description,
            "candidate_value": self.candidate_value,
            "yaml_value": self.yaml_value,
            "threshold_name": self.threshold_name,
            "candidate_report_time": self.candidate_report_time.isoformat() if self.candidate_report_time else None,
            "yaml_update_time": self.yaml_update_time.isoformat() if self.yaml_update_time else None,
            "severity": self.severity,
            "resolved": self.resolved,
            "resolution": self.resolution,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class ConflictDetector:
    """
    冲突检测器
    检测召回候选表和参数YAML之间的矛盾，不自动拍板，列出证据让用户选择
    """

    def __init__(self):
        self.conflicts: List[ConflictEvidence] = []

    def detect_conflicts(
        self,
        candidate_table: CandidateTable,
        param_yaml: ParamYAML,
        threshold_name: str = "default"
    ) -> List[ConflictEvidence]:
        """
        检测召回候选表和参数YAML之间的冲突

        Args:
            candidate_table: 召回候选表
            param_yaml: 参数YAML配置
            threshold_name: 要检测的阈值名称

        Returns:
            冲突证据列表
        """
        self.conflicts = []
        yaml_threshold = param_yaml.get_threshold(threshold_name)

        if yaml_threshold is None:
            for record in candidate_table.records:
                evidence = ConflictEvidence(
                    conflict_type=ConflictType.MISSING_THRESHOLD,
                    track_id=record.track_id,
                    description=f"参数YAML中缺少阈值配置: {threshold_name}",
                    candidate_value=record.reported_threshold,
                    yaml_value=0.0,
                    threshold_name=threshold_name,
                    severity="error",
                )
                self.conflicts.append(evidence)
            return self.conflicts

        yaml_value = yaml_threshold.value
        yaml_update_time = yaml_threshold.updated_at

        for record in candidate_table.records:
            reported_value = record.reported_threshold

            if abs(reported_value - yaml_value) > 1e-9:
                description = (
                    f"轨迹[{record.track_id}]候选表报告阈值为{reported_value}, "
                    f"但参数YAML中配置为{yaml_value}"
                )
                evidence = ConflictEvidence(
                    conflict_type=ConflictType.THRESHOLD_MISMATCH,
                    track_id=record.track_id,
                    description=description,
                    candidate_value=reported_value,
                    yaml_value=yaml_value,
                    threshold_name=threshold_name,
                    candidate_report_time=record.created_at,
                    yaml_update_time=yaml_update_time,
                    severity="warning",
                )
                self.conflicts.append(evidence)

        return self.conflicts

    def resolve_conflict(
        self,
        evidence_id: str,
        resolution: str,
        resolved_by: str
    ) -> Optional[ConflictEvidence]:
        """
        解决冲突（确认或驳回）

        Args:
            evidence_id: 证据ID
            resolution: "confirmed" 或 "rejected"
            resolved_by: 解决人

        Returns:
            更新后的冲突证据
        """
        for evidence in self.conflicts:
            if evidence.evidence_id == evidence_id:
                evidence.resolved = True
                evidence.resolution = resolution
                evidence.resolved_by = resolved_by
                evidence.resolved_at = get_current_time()
                return evidence
        return None

    def get_unresolved_conflicts(self) -> List[ConflictEvidence]:
        """获取未解决的冲突"""
        return [c for c in self.conflicts if not c.resolved]

    def generate_issue_from_conflict(self, evidence: ConflictEvidence) -> PatchIssue:
        """从冲突证据生成问题记录"""
        return PatchIssue(
            issue_type=PatchIssueType.THRESHOLD_MISMATCH,
            description=evidence.description,
            severity=evidence.severity,
            track_id=evidence.track_id,
            evidence={
                "candidate_value": evidence.candidate_value,
                "yaml_value": evidence.yaml_value,
                "threshold_name": evidence.threshold_name,
            },
        )

    def get_conflict_summary(self) -> Dict:
        """获取冲突摘要"""
        total = len(self.conflicts)
        unresolved = len(self.get_unresolved_conflicts())
        by_type = {}
        for c in self.conflicts:
            by_type[c.conflict_type] = by_type.get(c.conflict_type, 0) + 1

        return {
            "total_conflicts": total,
            "unresolved_conflicts": unresolved,
            "resolved_conflicts": total - unresolved,
            "by_type": by_type,
        }
