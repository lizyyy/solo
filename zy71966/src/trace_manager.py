"""可追溯管理模块：结论链接机制、复核原因记录"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import field

from .models import (
    Dispute, DisputeStatus, EvidenceLink, ReviewReason,
    DataRecord, AnnotationSample, EvaluationRecord, DisputeType
)
from .data_loader import generate_id


class TraceManager:
    """可追溯管理器"""

    def __init__(self):
        self._evidence_index: Dict[str, List[EvidenceLink]] = {}
        self._dispute_index: Dict[str, Dispute] = {}

    def index_disputes(self, disputes: List[Dispute]):
        """索引争议记录"""
        for dispute in disputes:
            self._dispute_index[dispute.dispute_id] = dispute
            for link in dispute.evidence_links:
                target_key = f"{link.target_type}:{link.target_id}"
                if target_key not in self._evidence_index:
                    self._evidence_index[target_key] = []
                self._evidence_index[target_key].append(link)

    def add_review_reason(
        self,
        dispute: Dispute,
        reviewer: str,
        reason_type: str,
        description: str,
        metric_before: Optional[Dict[str, float]] = None,
        metric_after: Optional[Dict[str, float]] = None,
        related_evidence_ids: Optional[List[str]] = None
    ) -> ReviewReason:
        """添加复核原因"""
        reason = ReviewReason(
            reason_id=generate_id("RR", f"{dispute.dispute_id}_{datetime.now().isoformat()}"),
            dispute_id=dispute.dispute_id,
            reviewer=reviewer,
            reason_type=reason_type,
            description=description,
            evidence_links=related_evidence_ids or [],
            metric_before=metric_before,
            metric_after=metric_after,
            created_at=datetime.now()
        )
        dispute.review_reasons.append(reason)
        return reason

    def resolve_dispute(
        self,
        dispute: Dispute,
        resolver: str,
        conclusion: str,
        status: DisputeStatus = DisputeStatus.RESOLVED
    ):
        """解决争议并记录结论"""
        dispute.status = status
        dispute.conclusion = conclusion
        dispute.resolver = resolver
        dispute.resolved_at = datetime.now()

        if status in [DisputeStatus.RESOLVED, DisputeStatus.REJECTED]:
            conclusion_link = EvidenceLink(
                link_id=generate_id("L", f"conclusion_{dispute.dispute_id}"),
                link_type="conclusion_reference",
                source_type="dispute",
                source_id=dispute.dispute_id,
                target_type="dispute_conclusion",
                target_id=dispute.dispute_id,
                description=f"结论: {conclusion[:50]}..."
            )
            dispute.evidence_links.append(conclusion_link)

    def get_dispute_evidence_chain(self, dispute: Dispute) -> List[Dict[str, Any]]:
        """获取争议的完整证据链"""
        chain = []

        for link in dispute.evidence_links:
            chain.append({
                "link_id": link.link_id,
                "link_type": link.link_type,
                "target_type": link.target_type,
                "target_id": link.target_id,
                "description": link.description,
                "created_at": link.created_at.isoformat() if link.created_at else None
            })

        for reason in dispute.review_reasons:
            chain.append({
                "reason_id": reason.reason_id,
                "type": "review_reason",
                "reason_type": reason.reason_type,
                "reviewer": reason.reviewer,
                "description": reason.description,
                "metric_before": reason.metric_before,
                "metric_after": reason.metric_after,
                "created_at": reason.created_at.isoformat() if reason.created_at else None
            })

        if dispute.conclusion:
            chain.append({
                "type": "conclusion",
                "conclusion": dispute.conclusion,
                "resolver": dispute.resolver,
                "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
                "status": dispute.status.value
            })

        return chain

    def find_disputes_by_evidence(self, target_type: str, target_id: str) -> List[Dispute]:
        """通过证据目标反向查找关联的争议"""
        target_key = f"{target_type}:{target_id}"
        links = self._evidence_index.get(target_key, [])
        dispute_ids = set(link.source_id for link in links if link.source_type == "dispute")
        return [self._dispute_index[did] for did in dispute_ids if did in self._dispute_index]

    def trace_conclusion_to_source(
        self,
        dispute: Dispute,
        records: List[DataRecord]
    ) -> Dict[str, Any]:
        """从结论追溯到原始标注样本和评估表"""
        record_map = {r.record_id: r for r in records}

        result = {
            "dispute_id": dispute.dispute_id,
            "dispute_type": dispute.dispute_type.value,
            "title": dispute.title,
            "conclusion": dispute.conclusion,
            "resolver": dispute.resolver,
            "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
            "related_records": [],
            "evidence_chain": self.get_dispute_evidence_chain(dispute)
        }

        for record_id in dispute.record_ids:
            record = record_map.get(record_id)
            if not record:
                continue

            record_info = {
                "record_id": record.record_id,
                "record_type": record.record_type.value,
                "note": record.note,
                "received_at": record.received_at.isoformat() if record.received_at else None
            }

            if record.sample:
                record_info["annotation"] = {
                    "sample_id": record.sample.sample_id,
                    "text": record.sample.text,
                    "label": record.sample.label,
                    "annotator": record.sample.annotator,
                    "annotated_at": record.sample.annotated_at.isoformat(),
                    "source_file": record.sample.source_file,
                    "source_line": record.sample.source_line,
                    "confidence": record.sample.confidence
                }

            if record.evaluation:
                record_info["evaluation"] = {
                    "eval_id": record.evaluation.eval_id,
                    "sample_id": record.evaluation.sample_id,
                    "predicted_label": record.evaluation.predicted_label,
                    "ground_truth": record.evaluation.ground_truth,
                    "is_correct": record.evaluation.is_correct,
                    "evaluator": record.evaluation.evaluator,
                    "evaluated_at": record.evaluation.evaluated_at.isoformat(),
                    "source_file": record.evaluation.source_file,
                    "source_line": record.evaluation.source_line,
                    "model_version": record.evaluation.model_version,
                    "metrics": record.evaluation.metrics
                }

            result["related_records"].append(record_info)

        return result

    def generate_metric_change_reason(
        self,
        dispute: Dispute,
        reviewer: str,
        is_caliber_change: bool,
        caliber_description: str = "",
        metric_before: Optional[Dict[str, float]] = None,
        metric_after: Optional[Dict[str, float]] = None
    ) -> ReviewReason:
        """为指标口径变更类争议生成标准化复核原因"""
        if is_caliber_change:
            reason_type = "caliber_change_confirmed"
            description = (
                f"[指标口径变更确认] {caliber_description}. "
                f"变更前指标: {metric_before}. 变更后指标: {metric_after}. "
                f"处理人: {reviewer}. 该记录已复核，后续评估需使用新口径。"
            )
        else:
            reason_type = "caliber_change_denied"
            description = (
                f"[指标口径变更排除] {caliber_description}. "
                f"指标差异并非口径变更导致。"
                f"处理人: {reviewer}."
            )

        return self.add_review_reason(
            dispute=dispute,
            reviewer=reviewer,
            reason_type=reason_type,
            description=description,
            metric_before=metric_before,
            metric_after=metric_after
        )

    def generate_label_missing_reason(
        self,
        dispute: Dispute,
        reviewer: str,
        correct_label: str,
        add_to_mapping: bool = True
    ) -> ReviewReason:
        """为标签漏映射类争议生成标准化复核原因"""
        detected_label = dispute.metadata.get("detected_label", "")
        reason_type = "label_mapping_resolved"
        description = (
            f"[标签漏映射处理] 检测到标签: '{detected_label}', "
            f"确认映射为: '{correct_label}'. "
            f"{'已添加到标签映射表' if add_to_mapping else '未添加到映射表'}. "
            f"处理人: {reviewer}."
        )

        return self.add_review_reason(
            dispute=dispute,
            reviewer=reviewer,
            reason_type=reason_type,
            description=description
        )
