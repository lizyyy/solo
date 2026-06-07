"""三步工作流

完整流程：
1. 参数 YAML 第一次导入
2. 数据科学家林姐补看评测切片
3. 可解释摘要更新

中间碰到"线上特征缺失却给了默认分"，自动进入 PENDING_LEAD_REVIEW
不急着归正常，留给推荐负责人复核
"""

from typing import Optional, List
from ..models import (
    EmbeddingCompatSession,
    FeatureComparisonRecord,
    ProcessingStatus,
    AnomalyType,
)
from ..io import import_session_from_yaml, UnifiedDataExporter


class ThreeStepWorkflow:
    """三步工作流控制器

    按用户说的，分三步走，中间卡住的就留给推荐负责人
    """

    def __init__(self):
        self.session: Optional[EmbeddingCompatSession] = None
        self.exporter: Optional[UnifiedDataExporter] = None

    def step1_import_yaml(
        self,
        yaml_file_path: str,
        created_by: str = "operator",
        session_name: str = "",
    ) -> EmbeddingCompatSession:
        """第一步：参数 YAML 第一次导入

        导入后自动检测"线上特征缺失给默认分"
        检测到的会自动标记为 PENDING_LEAD_REVIEW
        """
        self.session = import_session_from_yaml(
            file_path=yaml_file_path,
            created_by=created_by,
            session_name=session_name,
        )
        self.exporter = UnifiedDataExporter(self.session)
        return self.session

    def step2_linji_review(
        self,
        reviewer: str = "linjie",
        record_notes: Optional[dict] = None,
        mark_pending_for: Optional[List[str]] = None,
    ) -> None:
        """第二步：数据科学家林姐补看评测切片

        - 对每条记录可以写备注
        - 需要推荐负责人看的，可以主动标记
        - 但是！只要是 DEFAULT_SCORE_MISSING_FEATURE 的，不管标不标记，都会进 PENDING_LEAD_REVIEW
        """
        if not self.session:
            raise RuntimeError("请先执行第一步：导入YAML")

        record_notes = record_notes or {}
        mark_pending_for = mark_pending_for or []

        for record in self.session.records:
            note = record_notes.get(record.feature_name, "")
            need_pending = record.feature_name in mark_pending_for

            record.linji_review(
                reviewer=reviewer,
                note=note,
                mark_pending_lead=need_pending,
            )

    def lead_review_approve(
        self,
        record_id: str,
        reviewer: str,
        note: str = "",
    ) -> bool:
        """推荐负责人复核通过"""
        if not self.session:
            return False
        for record in self.session.records:
            if record.record_id == record_id:
                record.lead_approve(reviewer=reviewer, note=note)
                return True
        return False

    def lead_review_reject(
        self,
        record_id: str,
        reviewer: str,
        note: str = "",
    ) -> bool:
        """推荐负责人打回"""
        if not self.session:
            return False
        for record in self.session.records:
            if record.record_id == record_id:
                record.lead_reject(reviewer=reviewer, note=note)
                return True
        return False

    def step3_update_summary(
        self,
        updater: str,
        record_summaries: Optional[dict] = None,
    ) -> None:
        """第三步：可解释摘要更新

        只有状态是 LEAD_APPROVED 或 LINJI_REVIEWED 的才能更新摘要
        PENDING_LEAD_REVIEW 的会被跳过，等推荐负责人看完再说
        """
        if not self.session:
            raise RuntimeError("请先执行前面的步骤")

        record_summaries = record_summaries or {}

        for record in self.session.records:
            if record.status == ProcessingStatus.PENDING_LEAD_REVIEW:
                continue

            summary = record_summaries.get(record.feature_name, "")
            if summary:
                record.update_summary(updater=updater, summary=summary)

    def rollback_record(
        self,
        record_id: str,
        actor: str,
        note: str = "手动回滚",
    ) -> bool:
        """回滚某条记录的状态"""
        if not self.session:
            return False
        for record in self.session.records:
            if record.record_id == record_id:
                record.rollback(actor=actor, note=note)
                return True
        return False

    def get_exporter(self) -> UnifiedDataExporter:
        """获取统一数据导出器"""
        if not self.exporter:
            if not self.session:
                raise RuntimeError("会话还没创建")
            self.exporter = UnifiedDataExporter(self.session)
        return self.exporter

    def needs_lead_review(self) -> List[FeatureComparisonRecord]:
        """列出所有需要推荐负责人复核的记录"""
        if not self.session:
            return []
        return self.session.get_pending_lead_review()
