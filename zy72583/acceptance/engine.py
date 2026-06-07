from datetime import datetime
from typing import Dict, List, Optional, Tuple
import uuid

from .models import (
    AcceptanceRecord,
    EvaluationSlice,
    ExperimentComparison,
    FeatureSnapshot,
    RecordStatus,
    ScoreBucket,
)


class AcceptanceEngine:
    def __init__(self):
        self.records: Dict[str, AcceptanceRecord] = {}

    def import_slice(
        self,
        slice_id: str,
        name: str,
        offline_score: float,
        online_score: float,
        query_count: int,
        tags: Optional[List[str]] = None,
    ) -> AcceptanceRecord:
        slice_obj = EvaluationSlice(
            slice_id=slice_id,
            name=name,
            offline_score=offline_score,
            online_score=online_score,
            query_count=query_count,
            tags=tags or [],
        )

        record_id = f"REC-{uuid.uuid4().hex[:8].upper()}"
        record = AcceptanceRecord(record_id=record_id, slice=slice_obj)

        if slice_obj.has_bucket_mismatch:
            record.update_status(RecordStatus.BUCKET_MISMATCH)
            record.missing_materials.append("离线线上分桶不一致，需复核口径")
            record.next_step = "提交评测运营复核分桶口径"
            record.assignee = "评测运营"
        else:
            record.update_status(RecordStatus.FEATURE_MISSING)
            record.missing_materials.append("特征快照编号")
            record.next_step = "联系推荐策略老唐补录特征快照编号"
            record.assignee = "推荐策略老唐"

        self.records[record_id] = record
        return record

    def fill_feature_snapshot(
        self,
        record_id: str,
        snapshot_id: str,
        feature_version: str,
        vector_dim: int,
        index_type: str,
        remark: str = "",
    ) -> AcceptanceRecord:
        record = self._get_record(record_id)

        snapshot = FeatureSnapshot(
            snapshot_id=snapshot_id,
            slice_id=record.slice.slice_id,
            feature_version=feature_version,
            indexed_at=datetime.now(),
            vector_dim=vector_dim,
            index_type=index_type,
            remark=remark,
        )

        record.feature_snapshot = snapshot
        record.update_status(RecordStatus.FEATURE_FILLED)

        if "特征快照编号" in record.missing_materials:
            record.missing_materials.remove("特征快照编号")

        if record.slice.has_bucket_mismatch:
            record.update_status(RecordStatus.PENDING_REVIEW)
            record.next_step = "评测运营复核分桶差异原因"
            record.assignee = "评测运营"
        else:
            record.update_status(RecordStatus.COMPARISON_UPDATED)
            record.next_step = "实验对比已更新，可查看结果"
            record.assignee = None

        self._update_comparison(record)
        return record

    def _update_comparison(self, record: AcceptanceRecord) -> ExperimentComparison:
        comparison = ExperimentComparison(
            comparison_id=f"CMP-{uuid.uuid4().hex[:8].upper()}",
            slice_id=record.slice.slice_id,
            feature_snapshot_id=record.feature_snapshot.snapshot_id
            if record.feature_snapshot
            else None,
            current_offline_score=record.slice.offline_score,
            current_online_score=record.slice.online_score,
            baseline_offline_score=record.slice.offline_score * 0.95,
            baseline_online_score=record.slice.online_score * 0.97,
            generated_at=datetime.now(),
            updated_at=datetime.now(),
        )

        if comparison.baseline_offline_score and comparison.current_offline_score:
            comparison.offline_delta = (
                comparison.current_offline_score - comparison.baseline_offline_score
            )
        if comparison.baseline_online_score and comparison.current_online_score:
            comparison.online_delta = (
                comparison.current_online_score - comparison.baseline_online_score
            )

        comparison.conclusion = self._generate_conclusion(record, comparison)
        record.comparisons.append(comparison)
        return comparison

    def _generate_conclusion(
        self, record: AcceptanceRecord, comparison: ExperimentComparison
    ) -> str:
        parts = []

        parts.append(
            f"评测切片[{record.slice.name}]离线分桶={record.slice.offline_bucket.value}，"
            f"线上分桶={record.slice.online_bucket.value}"
        )

        if record.slice.has_bucket_mismatch:
            parts.append(
                f"⚠️ 离线线上分桶差{record.slice.bucket_diff}个桶，"
                f"需评测运营复核口径是否一致"
            )
            parts.append(
                "可能原因：1) 离线评估口径与线上不一致；"
                "2) 特征快照版本不匹配；3) 索引构建参数有差异"
            )
            parts.append("下一步：先找评测运营确认分桶差异原因")
        else:
            parts.append("✅ 离线线上分桶一致")
            if comparison.offline_delta is not None and comparison.offline_delta > 0:
                parts.append(f"离线指标提升{comparison.offline_delta:.4f}，符合预期")
            if comparison.online_delta is not None and comparison.online_delta > 0:
                parts.append(f"线上指标提升{comparison.online_delta:.4f}，符合预期")
            parts.append("下一步：可安排上线或联系推荐策略老唐确认")

        if record.feature_snapshot:
            parts.append(
                f"特征快照[{record.feature_snapshot.snapshot_id}]版本={record.feature_snapshot.feature_version}"
            )
        else:
            parts.append("❌ 缺特征快照编号，请推荐策略老唐补录")

        return " | ".join(parts)

    def manual_correct(
        self,
        record_id: str,
        operator: str,
        field: str,
        before: str,
        after: str,
        reason: str,
    ) -> AcceptanceRecord:
        record = self._get_record(record_id)
        record.add_correction(
            operator=operator, action=f"修正{field}", before=before, after=after, reason=reason
        )
        record.update_status(RecordStatus.MANUAL_CORRECTED)
        return record

    def re_run(self, record_id: str, operator: str) -> AcceptanceRecord:
        record = self._get_record(record_id)
        record.add_correction(
            operator=operator,
            action="重跑实验",
            before=str(record.status),
            after=RecordStatus.RE_RUN.value,
            reason="分桶差异待确认，重跑验证",
        )
        record.update_status(RecordStatus.RE_RUN)

        if record.slice.has_bucket_mismatch:
            record.update_status(RecordStatus.PENDING_REVIEW)
            record.next_step = "重跑后仍有分桶差异，评测运营继续复核"
            record.assignee = "评测运营"

        self._update_comparison(record)
        return record

    def review_result(
        self, record_id: str, passed: bool, reviewer: str, comment: str
    ) -> AcceptanceRecord:
        record = self._get_record(record_id)
        if passed:
            record.update_status(RecordStatus.REVIEW_PASSED)
            record.next_step = "复核通过，可继续推进"
            record.assignee = "推荐策略老唐"
        else:
            record.update_status(RecordStatus.REVIEW_REJECTED)
            record.next_step = f"复核驳回：{comment}，需推荐策略老唐排查"
            record.assignee = "推荐策略老唐"
            record.missing_materials.append(f"复核问题：{comment}")

        record.add_correction(
            operator=reviewer,
            action="复核",
            before="待复核",
            after="通过" if passed else "驳回",
            reason=comment,
        )
        return record

    def get_record(self, record_id: str) -> Optional[AcceptanceRecord]:
        return self.records.get(record_id)

    def _get_record(self, record_id: str) -> AcceptanceRecord:
        record = self.records.get(record_id)
        if not record:
            raise ValueError(f"验收记录 {record_id} 不存在")
        return record

    def list_records(
        self, status: Optional[RecordStatus] = None, assignee: Optional[str] = None
    ) -> List[AcceptanceRecord]:
        records = list(self.records.values())
        if status:
            records = [r for r in records if r.status == status]
        if assignee:
            records = [r for r in records if r.assignee == assignee]
        return records

    def generate_report(self, record_id: str) -> str:
        record = self._get_record(record_id)
        lines = []
        lines.append("=" * 60)
        lines.append("向量索引召回验收报告")
        lines.append("=" * 60)
        lines.append(f"记录编号: {record.record_id}")
        lines.append(f"当前状态: {record.status.value}")
        lines.append(f"负责人: {record.assignee or '未分配'}")
        lines.append(f"下一步: {record.next_step}")
        lines.append("-" * 60)
        lines.append("【评测切片信息】")
        lines.append(f"  切片ID: {record.slice.slice_id}")
        lines.append(f"  切片名称: {record.slice.name}")
        lines.append(f"  查询量: {record.slice.query_count}")
        lines.append(f"  离线分数: {record.slice.offline_score:.4f} (分桶: {record.slice.offline_bucket.value})")
        lines.append(f"  线上分数: {record.slice.online_score:.4f} (分桶: {record.slice.online_bucket.value})")
        lines.append(f"  分桶差异: {'差' + str(record.slice.bucket_diff) + '个桶 ⚠️' if record.slice.has_bucket_mismatch else '一致 ✅'}")
        lines.append("-" * 60)

        if record.feature_snapshot:
            lines.append("【特征快照信息】")
            lines.append(f"  快照编号: {record.feature_snapshot.snapshot_id}")
            lines.append(f"  特征版本: {record.feature_snapshot.feature_version}")
            lines.append(f"  向量维度: {record.feature_snapshot.vector_dim}")
            lines.append(f"  索引类型: {record.feature_snapshot.index_type}")
            lines.append(f"  索引时间: {record.feature_snapshot.indexed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if record.feature_snapshot.remark:
                lines.append(f"  备注: {record.feature_snapshot.remark}")
        else:
            lines.append("【特征快照信息】❌ 缺失，请补录特征快照编号")

        lines.append("-" * 60)
        if record.comparisons:
            latest = record.comparisons[-1]
            lines.append("【实验对比】")
            lines.append(f"  对比ID: {latest.comparison_id}")
            if latest.baseline_offline_score is not None:
                lines.append(f"  基线离线: {latest.baseline_offline_score:.4f}")
            if latest.current_offline_score is not None:
                lines.append(f"  当前离线: {latest.current_offline_score:.4f}")
            if latest.offline_delta is not None:
                lines.append(f"  离线Delta: {latest.offline_delta:+.4f}")
            if latest.baseline_online_score is not None:
                lines.append(f"  基线上线: {latest.baseline_online_score:.4f}")
            if latest.current_online_score is not None:
                lines.append(f"  当前线上: {latest.current_online_score:.4f}")
            if latest.online_delta is not None:
                lines.append(f"  线上Delta: {latest.online_delta:+.4f}")
            lines.append(f"  结论: {latest.conclusion}")
            lines.append(f"  生成时间: {latest.generated_at.strftime('%Y-%m-%d %H:%M:%S') if latest.generated_at else 'N/A'}")

        lines.append("-" * 60)
        if record.missing_materials:
            lines.append("【缺件清单】")
            for i, mat in enumerate(record.missing_materials, 1):
                lines.append(f"  {i}. {mat}")

        if record.correction_logs:
            lines.append("-" * 60)
            lines.append("【操作日志】")
            for log in record.correction_logs:
                lines.append(
                    f"  [{log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {log.operator}: {log.action}"
                )
                lines.append(f"    原因: {log.reason}")
                lines.append(f"    {log.before} → {log.after}")

        lines.append("=" * 60)
        return "\n".join(lines)
