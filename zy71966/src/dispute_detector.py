"""争议检测模块：检测标签漏映射、口径变更、重复项冲突等"""
from typing import List, Dict, Optional, Set, Tuple
from collections import defaultdict
from datetime import datetime
import difflib

from .models import (
    DataRecord, RecordType, Dispute, DisputeType, DisputeStatus,
    EvidenceLink, AnnotationSample, EvaluationRecord
)
from .data_loader import generate_id


class DisputeDetector:
    """争议检测器"""

    def __init__(self, label_mapping: Optional[Dict[str, str]] = None):
        self.label_mapping = label_mapping or {}
        self.known_labels: Set[str] = set(self.label_mapping.keys()) | set(self.label_mapping.values())
        self.disputes: List[Dispute] = []

    def detect_all(self, records: List[DataRecord]) -> List[Dispute]:
        """执行所有检测"""
        self.disputes = []

        self._detect_label_missing(records)
        self._detect_label_mismatch(records)
        self._detect_duplicate_conflicts(records)
        self._detect_metric_changes(records)
        self._detect_late_attachment_issues(records)
        self._detect_correction_conflicts(records)

        return self.disputes

    def _detect_label_missing(self, records: List[DataRecord]):
        """检测标签漏映射：标注标签不在已知标签集合中"""
        if not self.known_labels:
            return

        for record in records:
            if not record.sample:
                continue

            label = record.sample.label
            if not label or label == "nan":
                continue

            if label not in self.known_labels:
                similar = difflib.get_close_matches(label, self.known_labels, n=3, cutoff=0.6)
                dispute = Dispute(
                    dispute_id=generate_id("D", f"label_missing_{record.record_id}"),
                    dispute_type=DisputeType.LABEL_MISSING,
                    status=DisputeStatus.OPEN,
                    title=f"标签漏映射: {label}",
                    description=(
                        f"标注标签 '{label}' 不在标签映射表中。"
                        f"{' 相似标签建议: ' + ', '.join(similar) if similar else ''}"
                    ),
                    record_ids=[record.record_id],
                    evidence_links=[
                        EvidenceLink(
                            link_id=generate_id("L", f"sample_{record.record_id}"),
                            link_type="annotation_reference",
                            source_type="dispute",
                            source_id="",
                            target_type="annotation_sample",
                            target_id=record.sample.sample_id,
                            description=f"标注样本来源: {record.sample.source_file} 第{record.sample.source_line}行"
                        )
                    ],
                    metadata={
                        "detected_label": label,
                        "similar_labels": similar,
                        "source_file": record.sample.source_file,
                        "source_line": record.sample.source_line
                    }
                )
                dispute.evidence_links[0].source_id = dispute.dispute_id
                self.disputes.append(dispute)

    def _detect_label_mismatch(self, records: List[DataRecord]):
        """检测同一文本的标签不一致（人工更正与原始标注冲突）"""
        text_to_labels: Dict[str, List[Tuple[str, str, DataRecord]]] = defaultdict(list)

        for record in records:
            if not record.sample:
                continue
            text = record.sample.text.strip()
            if text:
                text_to_labels[text].append((
                    record.sample.label,
                    record.record_type.value,
                    record
                ))

        for text, labels in text_to_labels.items():
            unique_labels = set(l for l, _, _ in labels)
            if len(unique_labels) > 1:
                record_ids = [r.record_id for _, _, r in labels]
                label_details = [f"{lt}({l})" for l, lt, _ in labels]

                dispute = Dispute(
                    dispute_id=generate_id("D", f"label_mismatch_{hash(text)}"),
                    dispute_type=DisputeType.LABEL_MISMATCH,
                    status=DisputeStatus.OPEN,
                    title=f"标签不一致: {text[:30]}...",
                    description=(
                        f"相同文本存在不同标注: {', '.join(label_details)}。"
                        f"请确认正确标签。"
                    ),
                    record_ids=record_ids,
                    evidence_links=[
                        EvidenceLink(
                            link_id=generate_id("L", f"mismatch_{r.record_id}"),
                            link_type="annotation_reference",
                            source_type="dispute",
                            source_id="",
                            target_type="annotation_sample",
                            target_id=r.sample.sample_id,
                            description=f"标注: {r.sample.label} (类型: {r.record_type.value}) "
                                        f"来源: {r.sample.source_file} 第{r.sample.source_line}行"
                        )
                        for _, _, r in labels
                    ],
                    metadata={
                        "text": text,
                        "labels": [{"label": l, "type": t} for l, t, _ in labels]
                    }
                )
                for link in dispute.evidence_links:
                    link.source_id = dispute.dispute_id
                self.disputes.append(dispute)

    def _detect_duplicate_conflicts(self, records: List[DataRecord]):
        """检测重复项冲突：同一内容哈希对应多条记录但标签或评估结果不同"""
        hash_to_records: Dict[str, List[DataRecord]] = defaultdict(list)

        for record in records:
            content_hash = record.metadata.get("content_hash")
            if content_hash:
                hash_to_records[content_hash].append(record)

        for content_hash, dup_records in hash_to_records.items():
            if len(dup_records) <= 1:
                continue

            labels = set(r.sample.label for r in dup_records if r.sample and r.sample.label)
            eval_results = set()
            for r in dup_records:
                if r.evaluation:
                    eval_results.add(f"{r.evaluation.predicted_label}->{r.evaluation.ground_truth}")

            if len(labels) > 1 or len(eval_results) > 1:
                record_ids = [r.record_id for r in dup_records]

                dispute = Dispute(
                    dispute_id=generate_id("D", f"dup_conflict_{content_hash}"),
                    dispute_type=DisputeType.DUPLICATE_CONFLICT,
                    status=DisputeStatus.OPEN,
                    title=f"重复项冲突: {dup_records[0].sample.text[:30] if dup_records[0].sample else '未知'}...",
                    description=(
                        f"检测到{len(dup_records)}条重复记录存在冲突。"
                        f"标签差异: {', '.join(labels)}。"
                        f"评估差异: {', '.join(eval_results) if eval_results else '无'}。"
                    ),
                    record_ids=record_ids,
                    evidence_links=[
                        EvidenceLink(
                            link_id=generate_id("L", f"dup_{r.record_id}"),
                            link_type="duplicate_reference",
                            source_type="dispute",
                            source_id="",
                            target_type="data_record",
                            target_id=r.record_id,
                            description=(
                                f"记录类型: {r.record_type.value}, "
                                f"标签: {r.sample.label if r.sample else 'N/A'}, "
                                f"来源: {r.sample.source_file if r.sample else (r.evaluation.source_file if r.evaluation else 'N/A')} "
                                f"第{r.sample.source_line if r.sample else (r.evaluation.source_line if r.evaluation else 'N/A')}行"
                            )
                        )
                        for r in dup_records
                    ],
                    metadata={
                        "content_hash": content_hash,
                        "duplicate_count": len(dup_records),
                        "labels": list(labels),
                        "eval_results": list(eval_results)
                    }
                )
                for link in dispute.evidence_links:
                    link.source_id = dispute.dispute_id
                self.disputes.append(dispute)

    def _detect_metric_changes(self, records: List[DataRecord]):
        """检测指标口径变更：同一模型版本在不同评估记录中指标计算方式或数值差异过大"""
        model_metrics: Dict[str, List[Dict]] = defaultdict(list)
        sample_evals: Dict[str, List[EvaluationRecord]] = defaultdict(list)

        for record in records:
            if not record.evaluation:
                continue

            eval_rec = record.evaluation
            model_key = eval_rec.model_version
            sample_evals[eval_rec.sample_id].append(eval_rec)

            if eval_rec.metrics:
                model_metrics[model_key].append({
                    "metrics": eval_rec.metrics,
                    "record": record,
                    "eval_id": eval_rec.eval_id
                })

        for sample_id, evals in sample_evals.items():
            if len(evals) < 2:
                continue

            unique_ground_truth = set(e.ground_truth for e in evals)
            unique_predicted = set(e.predicted_label for e in evals)

            if len(unique_ground_truth) > 1 or len(unique_predicted) > 1:
                record_ids = []
                evidence = []
                for e in evals:
                    for r in records:
                        if r.evaluation and r.evaluation.eval_id == e.eval_id:
                            record_ids.append(r.record_id)
                            evidence.append(EvidenceLink(
                                link_id=generate_id("L", f"metric_{e.eval_id}"),
                                link_type="evaluation_reference",
                                source_type="dispute",
                                source_id="",
                                target_type="evaluation_record",
                                target_id=e.eval_id,
                                description=(
                                    f"模型版本: {e.model_version}, "
                                    f"预测: {e.predicted_label}, "
                                    f"真值: {e.ground_truth}, "
                                    f"正确: {e.is_correct}, "
                                    f"来源: {e.source_file} 第{e.source_line}行"
                                )
                            ))
                            break

                dispute = Dispute(
                    dispute_id=generate_id("D", f"metric_change_{sample_id}"),
                    dispute_type=DisputeType.METRIC_CHANGE,
                    status=DisputeStatus.OPEN,
                    title=f"指标口径变更疑义: 样本{sample_id}",
                    description=(
                        f"同一样本在不同评估中结果不一致。"
                        f"真值版本: {', '.join(unique_ground_truth)}。"
                        f"预测版本: {', '.join(unique_predicted)}。"
                        f"可能是指标口径变更或标注更新导致。"
                    ),
                    record_ids=record_ids,
                    evidence_links=evidence,
                    metadata={
                        "sample_id": sample_id,
                        "ground_truth_versions": list(unique_ground_truth),
                        "predicted_versions": list(unique_predicted),
                        "model_versions": [e.model_version for e in evals]
                    }
                )
                for link in dispute.evidence_links:
                    link.source_id = dispute.dispute_id
                self.disputes.append(dispute)

        for model_version, metric_records in model_metrics.items():
            if len(metric_records) < 2:
                continue

            all_metric_keys = set()
            for mr in metric_records:
                all_metric_keys.update(mr["metrics"].keys())

            for metric_key in all_metric_keys:
                values = [mr["metrics"].get(metric_key) for mr in metric_records if metric_key in mr["metrics"]]
                if len(values) >= 2:
                    v_max, v_min = max(values), min(values)
                    if v_max > 0 and (v_max - v_min) / v_max > 0.3:
                        dispute = Dispute(
                            dispute_id=generate_id("D", f"metric_drift_{model_version}_{metric_key}"),
                            dispute_type=DisputeType.METRIC_CHANGE,
                            status=DisputeStatus.OPEN,
                            title=f"指标波动异常: {model_version} {metric_key}",
                            description=(
                                f"模型 {model_version} 的 {metric_key} 指标波动超过30%。"
                                f"最大值: {v_max:.4f}, 最小值: {v_min:.4f}。"
                                f"请确认是否存在口径变更。"
                            ),
                            record_ids=[mr["record"].record_id for mr in metric_records],
                            evidence_links=[
                                EvidenceLink(
                                    link_id=generate_id("L", f"metric_drift_{mr['eval_id']}"),
                                    link_type="metric_reference",
                                    source_type="dispute",
                                    source_id="",
                                    target_type="evaluation_record",
                                    target_id=mr["eval_id"],
                                    description=(
                                        f"{metric_key}: {mr['metrics'].get(metric_key):.4f}, "
                                        f"来源: {mr['record'].evaluation.source_file} "
                                        f"第{mr['record'].evaluation.source_line}行"
                                    )
                                )
                                for mr in metric_records
                            ],
                            metadata={
                                "model_version": model_version,
                                "metric_key": metric_key,
                                "max_value": v_max,
                                "min_value": v_min,
                                "diff_ratio": (v_max - v_min) / v_max
                            }
                        )
                        for link in dispute.evidence_links:
                            link.source_id = dispute.dispute_id
                        self.disputes.append(dispute)

    def _detect_late_attachment_issues(self, records: List[DataRecord]):
        """检测晚到附件可能带来的问题"""
        late_records = [r for r in records if r.record_type == RecordType.LATE_ATTACHMENT]

        for record in late_records:
            if not record.sample:
                continue

            related_evals = [
                r for r in records
                if r.evaluation and r.evaluation.sample_id == record.sample.sample_id
            ]

            dispute = Dispute(
                dispute_id=generate_id("D", f"late_attachment_{record.record_id}"),
                dispute_type=DisputeType.LATE_ATTACHMENT_ISSUE,
                status=DisputeStatus.OPEN,
                title=f"晚到附件待复核: {record.sample.text[:30]}...",
                description=(
                    f"该记录为晚到附件 (收到时间: {record.received_at})。"
                    f"相关评估记录: {len(related_evals)}条。"
                    f"请确认晚到附件是否影响之前的评估结论。"
                ),
                record_ids=[record.record_id] + [r.record_id for r in related_evals],
                evidence_links=[
                    EvidenceLink(
                        link_id=generate_id("L", f"late_main_{record.record_id}"),
                        link_type="late_attachment",
                        source_type="dispute",
                        source_id="",
                        target_type="annotation_sample",
                        target_id=record.sample.sample_id,
                        description=(
                            f"晚到附件标注: {record.sample.label}, "
                            f"标注时间: {record.sample.annotated_at}, "
                            f"收到时间: {record.received_at}, "
                            f"来源: {record.sample.source_file} 第{record.sample.source_line}行"
                        )
                    )
                ] + [
                    EvidenceLink(
                        link_id=generate_id("L", f"late_eval_{r.evaluation.eval_id}"),
                        link_type="related_evaluation",
                        source_type="dispute",
                        source_id="",
                        target_type="evaluation_record",
                        target_id=r.evaluation.eval_id,
                        description=(
                            f"相关评估: 预测={r.evaluation.predicted_label}, "
                            f"真值={r.evaluation.ground_truth}, "
                            f"正确={r.evaluation.is_correct}, "
                            f"来源: {r.evaluation.source_file} 第{r.evaluation.source_line}行"
                        )
                    )
                    for r in related_evals
                ],
                metadata={
                    "received_at": record.received_at.isoformat() if record.received_at else None,
                    "related_eval_count": len(related_evals)
                }
            )
            for link in dispute.evidence_links:
                link.source_id = dispute.dispute_id
            self.disputes.append(dispute)

    def _detect_correction_conflicts(self, records: List[DataRecord]):
        """检测人工更正与原记录的冲突"""
        correction_records = [r for r in records if r.record_type == RecordType.MANUAL_CORRECTION]

        for record in correction_records:
            if not record.parent_record_id:
                continue

            parent = next((r for r in records if r.record_id == record.parent_record_id), None)
            if not parent or not parent.sample or not record.sample:
                continue

            if parent.sample.label != record.sample.label:
                dispute = Dispute(
                    dispute_id=generate_id("D", f"correction_conflict_{record.record_id}"),
                    dispute_type=DisputeType.CORRECTION_CONFLICT,
                    status=DisputeStatus.OPEN,
                    title=f"人工更正冲突: {record.sample.text[:30]}...",
                    description=(
                        f"人工更正与原记录标签不一致。"
                        f"原标签: {parent.sample.label} -> 更正后: {record.sample.label}。"
                        f"请确认更正是否合理。"
                    ),
                    record_ids=[record.parent_record_id, record.record_id],
                    evidence_links=[
                        EvidenceLink(
                            link_id=generate_id("L", f"orig_{parent.record_id}"),
                            link_type="original_record",
                            source_type="dispute",
                            source_id="",
                            target_type="annotation_sample",
                            target_id=parent.sample.sample_id,
                            description=(
                                f"原始标注: {parent.sample.label}, "
                                f"标注人: {parent.sample.annotator}, "
                                f"来源: {parent.sample.source_file} 第{parent.sample.source_line}行"
                            )
                        ),
                        EvidenceLink(
                            link_id=generate_id("L", f"corrected_{record.record_id}"),
                            link_type="correction_record",
                            source_type="dispute",
                            source_id="",
                            target_type="annotation_sample",
                            target_id=record.sample.sample_id,
                            description=(
                                f"更正标注: {record.sample.label}, "
                                f"标注人: {record.sample.annotator}, "
                                f"备注: {record.note}, "
                                f"来源: {record.sample.source_file} 第{record.sample.source_line}行"
                            )
                        )
                    ],
                    metadata={
                        "original_label": parent.sample.label,
                        "corrected_label": record.sample.label,
                        "parent_record_id": record.parent_record_id
                    }
                )
                for link in dispute.evidence_links:
                    link.source_id = dispute.dispute_id
                self.disputes.append(dispute)

    def get_disputes_by_type(self, dispute_type: DisputeType) -> List[Dispute]:
        """按类型获取争议"""
        return [d for d in self.disputes if d.dispute_type == dispute_type]

    def get_open_disputes(self) -> List[Dispute]:
        """获取未解决的争议"""
        return [d for d in self.disputes if d.status == DisputeStatus.OPEN]
