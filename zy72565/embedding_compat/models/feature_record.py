from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid

from .status import ProcessingStatus, AnomalyType
from .yaml_line import YamlSourceLine
from .audit_log import AuditLogEntry


@dataclass
class FeatureComparisonRecord:
    """单条特征对比记录

    这是整个系统的核心数据结构：
    - 明细导出、页面展示、接口返回都读这一份数据
    - 线上特征缺失给默认分这种记录，会被标记 anomaly_type = DEFAULT_SCORE_MISSING_FEATURE
    - 状态会被设为 PENDING_LEAD_REVIEW，不会自动归为正常
    """

    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    feature_name: str = ""
    embedding_version_a: str = ""
    embedding_version_b: str = ""

    score_a: Optional[float] = None
    score_b: Optional[float] = None
    score_diff: Optional[float] = None

    feature_present_online: bool = True
    used_default_score: bool = False
    default_score_value: Optional[float] = None

    anomaly_type: AnomalyType = AnomalyType.NONE
    anomaly_description: str = ""

    status: ProcessingStatus = ProcessingStatus.IMPORTED
    status_history: List[ProcessingStatus] = field(default_factory=list)

    yaml_source_lines: List[YamlSourceLine] = field(default_factory=list)
    audit_logs: List[AuditLogEntry] = field(default_factory=list)

    linji_review_note: str = ""
    linji_reviewed_at: Optional[datetime] = None
    linji_reviewed_by: str = ""

    lead_review_note: str = ""
    lead_reviewed_at: Optional[datetime] = None
    lead_reviewed_by: str = ""

    summary_note: str = ""
    summary_updated_at: Optional[datetime] = None
    summary_updated_by: str = ""

    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def _add_audit_log(
        self,
        actor: str,
        action: str,
        previous_status: Optional[ProcessingStatus] = None,
        new_status: Optional[ProcessingStatus] = None,
        details: str = "",
        field_changed: str = "",
        old_value: str = "",
        new_value: str = "",
    ) -> None:
        entry = AuditLogEntry(
            timestamp=datetime.now(),
            actor=actor,
            action=action,
            record_id=self.record_id,
            previous_status=previous_status.value if previous_status else None,
            new_status=new_status.value if new_status else None,
            details=details,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
        )
        self.audit_logs.append(entry)

    def _change_status(self, new_status: ProcessingStatus, actor: str, note: str = "") -> None:
        old_status = self.status
        self.status_history.append(old_status)
        self.status = new_status
        self.updated_at = datetime.now()
        self._add_audit_log(
            actor=actor,
            action="status_change",
            previous_status=old_status,
            new_status=new_status,
            details=note,
        )

    def detect_default_score_missing_feature(self) -> None:
        """检测并标记"线上特征缺失却给了默认分"

        满足两个条件就触发：
        1. feature_present_online = False（线上没这个特征）
        2. used_default_score = True（但给了默认分）

        标记后状态自动变为 PENDING_LEAD_REVIEW，留给推荐负责人复核
        不会自动算正常
        """
        if not self.feature_present_online and self.used_default_score:
            self.anomaly_type = AnomalyType.DEFAULT_SCORE_MISSING_FEATURE
            self.anomaly_description = (
                f"特征[{self.feature_name}]线上缺失，但使用了默认分"
                f"（默认分={self.default_score_value}），需推荐负责人复核"
            )
            if self.status == ProcessingStatus.IMPORTED or self.status == ProcessingStatus.LINJI_REVIEWED:
                self._change_status(
                    ProcessingStatus.PENDING_LEAD_REVIEW,
                    actor="system",
                    note="自动检测：线上特征缺失却给了默认分",
                )

    def linji_review(
        self,
        reviewer: str,
        note: str = "",
        mark_pending_lead: bool = False,
    ) -> None:
        """第二步：数据科学家林姐看完评测切片，做初步标记

        - 如果林姐觉得需要推荐负责人看（比如默认分那个情况），mark_pending_lead=True
        - 否则状态流转到 LINJI_REVIEWED
        """
        self.linji_review_note = note
        self.linji_reviewed_at = datetime.now()
        self.linji_reviewed_by = reviewer

        if mark_pending_lead or self.anomaly_type == AnomalyType.DEFAULT_SCORE_MISSING_FEATURE:
            target_status = ProcessingStatus.PENDING_LEAD_REVIEW
        else:
            target_status = ProcessingStatus.LINJI_REVIEWED

        self._change_status(
            target_status,
            actor=reviewer,
            note=f"林姐评测切片查看完成，备注：{note}",
        )

    def lead_approve(self, reviewer: str, note: str = "") -> None:
        """推荐负责人复核通过"""
        self.lead_review_note = note
        self.lead_reviewed_at = datetime.now()
        self.lead_reviewed_by = reviewer
        self._change_status(
            ProcessingStatus.LEAD_APPROVED,
            actor=reviewer,
            note=f"推荐负责人复核通过：{note}",
        )

    def lead_reject(self, reviewer: str, note: str = "") -> None:
        """推荐负责人打回"""
        self.lead_review_note = note
        self.lead_reviewed_at = datetime.now()
        self.lead_reviewed_by = reviewer
        self._change_status(
            ProcessingStatus.LEAD_REJECTED,
            actor=reviewer,
            note=f"推荐负责人打回：{note}",
        )

    def update_summary(self, updater: str, summary: str) -> None:
        """第三步：更新可解释摘要"""
        self.summary_note = summary
        self.summary_updated_at = datetime.now()
        self.summary_updated_by = updater
        self._change_status(
            ProcessingStatus.SUMMARY_UPDATED,
            actor=updater,
            note="可解释摘要更新完成",
        )

    def rollback(self, actor: str, note: str = "手动回滚") -> None:
        """回滚到上一个状态"""
        if not self.status_history:
            return
        previous_status = self.status_history.pop()
        self.status = previous_status
        self.updated_at = datetime.now()
        self._add_audit_log(
            actor=actor,
            action="rollback",
            previous_status=self.status,
            new_status=previous_status,
            details=note,
        )

    def to_dict(self) -> Dict[str, Any]:
        """统一序列化出口

        明细导出、页面展示、接口返回都用这个方法
        保证三个地方看到的数据完全一致
        """
        return {
            "record_id": self.record_id,
            "feature_name": self.feature_name,
            "embedding_version_a": self.embedding_version_a,
            "embedding_version_b": self.embedding_version_b,
            "score_a": self.score_a,
            "score_b": self.score_b,
            "score_diff": self.score_diff,
            "feature_present_online": self.feature_present_online,
            "used_default_score": self.used_default_score,
            "default_score_value": self.default_score_value,
            "anomaly_type": self.anomaly_type.value,
            "anomaly_description": self.anomaly_description,
            "status": self.status.value,
            "status_history": [s.value for s in self.status_history],
            "yaml_source_lines": [line.to_dict() for line in self.yaml_source_lines],
            "audit_logs": [log.to_dict() for log in self.audit_logs],
            "linji_review_note": self.linji_review_note,
            "linji_reviewed_at": self.linji_reviewed_at.isoformat() if self.linji_reviewed_at else None,
            "linji_reviewed_by": self.linji_reviewed_by,
            "lead_review_note": self.lead_review_note,
            "lead_reviewed_at": self.lead_reviewed_at.isoformat() if self.lead_reviewed_at else None,
            "lead_reviewed_by": self.lead_reviewed_by,
            "summary_note": self.summary_note,
            "summary_updated_at": self.summary_updated_at.isoformat() if self.summary_updated_at else None,
            "summary_updated_by": self.summary_updated_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
