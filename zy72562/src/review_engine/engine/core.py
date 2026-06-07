import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple
import json
import os

from ..models import (
    NegativeSample,
    RecallCandidate,
    AnomalySample,
    ReviewRecord,
    ReviewStatus,
    TimeWindowIssue,
    TimeWindowSeverity,
    EvidenceMergeResult,
    NextAction,
    NextActionOwner,
)


class ReviewEngine:
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or "./review_data"
        self.negative_samples: Dict[str, NegativeSample] = {}
        self.recall_candidates: Dict[str, RecallCandidate] = {}
        self.anomaly_samples: Dict[str, AnomalySample] = {}
        self.review_records: List[ReviewRecord] = []
        self._load_from_storage()

    def _load_from_storage(self):
        if not os.path.exists(self.storage_path):
            return
        for fname in os.listdir(self.storage_path):
            if fname.startswith("negative_") and fname.endswith(".json"):
                with open(os.path.join(self.storage_path, fname)) as f:
                    data = json.load(f)
                    data["timestamp"] = datetime.fromisoformat(data["timestamp"])
                    data["imported_at"] = datetime.fromisoformat(data["imported_at"])
                    sample = NegativeSample(**data)
                    self.negative_samples[sample.sample_id] = sample
            elif fname.startswith("recall_") and fname.endswith(".json"):
                with open(os.path.join(self.storage_path, fname)) as f:
                    data = json.load(f)
                    data["timestamp"] = datetime.fromisoformat(data["timestamp"])
                    data["added_at"] = datetime.fromisoformat(data["added_at"])
                    candidate = RecallCandidate(**data)
                    self.recall_candidates[candidate.candidate_id] = candidate
            elif fname.startswith("anomaly_") and fname.endswith(".json"):
                with open(os.path.join(self.storage_path, fname)) as f:
                    data = json.load(f)
                    anomaly = self._anomaly_from_dict(data)
                    self.anomaly_samples[anomaly.anomaly_id] = anomaly

    def _save_to_storage(self):
        os.makedirs(self.storage_path, exist_ok=True)
        for sample_id, sample in self.negative_samples.items():
            with open(os.path.join(self.storage_path, f"negative_{sample_id}.json"), "w") as f:
                data = sample.__dict__.copy()
                data["timestamp"] = data["timestamp"].isoformat()
                data["imported_at"] = data["imported_at"].isoformat()
                json.dump(data, f, ensure_ascii=False, indent=2)
        for candidate_id, candidate in self.recall_candidates.items():
            with open(os.path.join(self.storage_path, f"recall_{candidate_id}.json"), "w") as f:
                data = candidate.__dict__.copy()
                data["timestamp"] = data["timestamp"].isoformat()
                data["added_at"] = data["added_at"].isoformat()
                json.dump(data, f, ensure_ascii=False, indent=2)
        for anomaly_id, anomaly in self.anomaly_samples.items():
            with open(os.path.join(self.storage_path, f"anomaly_{anomaly_id}.json"), "w") as f:
                data = self._anomaly_to_dict(anomaly)
                json.dump(data, f, ensure_ascii=False, indent=2)

    def _anomaly_to_dict(self, anomaly: AnomalySample) -> Dict:
        data = {
            "anomaly_id": anomaly.anomaly_id,
            "sample_id": anomaly.sample_id,
            "negative_sample": {
                **anomaly.negative_sample.__dict__,
                "timestamp": anomaly.negative_sample.timestamp.isoformat(),
                "imported_at": anomaly.negative_sample.imported_at.isoformat(),
            },
            "recall_candidates": [
                {
                    **c.__dict__,
                    "timestamp": c.timestamp.isoformat(),
                    "added_at": c.added_at.isoformat(),
                }
                for c in anomaly.recall_candidates
            ],
            "time_window_issues": [
            {
                **i.__dict__.copy(),
                "severity": i.severity.value if hasattr(i.severity, 'value') else i.severity,
            }
            for i in anomaly.time_window_issues
        ],
            "evidence_merge": anomaly.evidence_merge.__dict__ if anomaly.evidence_merge else None,
            "status": anomaly.status,
            "why_kept": anomaly.why_kept,
            "missing_materials": anomaly.missing_materials,
            "next_action": anomaly.next_action.__dict__ if anomaly.next_action else None,
            "detected_at": anomaly.detected_at.isoformat(),
            "updated_at": anomaly.updated_at.isoformat(),
            "review_comments": anomaly.review_comments,
            "tags": anomaly.tags,
        }
        for issue in data["time_window_issues"]:
            if issue.get("window_start"):
                issue["window_start"] = issue["window_start"].isoformat()
            if issue.get("window_end"):
                issue["window_end"] = issue["window_end"].isoformat()
        return data

    def _anomaly_from_dict(self, data: Dict) -> AnomalySample:
        neg_data = data["negative_sample"]
        neg_data["timestamp"] = datetime.fromisoformat(neg_data["timestamp"])
        neg_data["imported_at"] = datetime.fromisoformat(neg_data["imported_at"])
        negative_sample = NegativeSample(**neg_data)

        recall_candidates = []
        for c_data in data["recall_candidates"]:
            c_data["timestamp"] = datetime.fromisoformat(c_data["timestamp"])
            c_data["added_at"] = datetime.fromisoformat(c_data["added_at"])
            recall_candidates.append(RecallCandidate(**c_data))

        time_window_issues = []
        for i_data in data["time_window_issues"]:
            if i_data.get("window_start"):
                i_data["window_start"] = datetime.fromisoformat(i_data["window_start"])
            if i_data.get("window_end"):
                i_data["window_end"] = datetime.fromisoformat(i_data["window_end"])
            if isinstance(i_data.get("severity"), str):
                i_data["severity"] = TimeWindowSeverity(i_data["severity"])
            time_window_issues.append(TimeWindowIssue(**i_data))

        evidence_merge = None
        if data["evidence_merge"]:
            evidence_merge = EvidenceMergeResult(**data["evidence_merge"])

        next_action = None
        if data["next_action"]:
            next_action = NextAction(**data["next_action"])

        return AnomalySample(
            anomaly_id=data["anomaly_id"],
            sample_id=data["sample_id"],
            negative_sample=negative_sample,
            recall_candidates=recall_candidates,
            time_window_issues=time_window_issues,
            evidence_merge=evidence_merge,
            status=ReviewStatus(data["status"]),
            why_kept=data["why_kept"],
            missing_materials=data["missing_materials"],
            next_action=next_action,
            detected_at=datetime.fromisoformat(data["detected_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            review_comments=data["review_comments"],
            tags=data["tags"],
        )

    def import_negative_samples(self, samples: List[NegativeSample]) -> List[AnomalySample]:
        new_anomalies = []
        for sample in samples:
            self.negative_samples[sample.sample_id] = sample
            anomaly = self._create_anomaly_from_negative(sample)
            self.anomaly_samples[anomaly.anomaly_id] = anomaly
            new_anomalies.append(anomaly)
            self._add_review_record(
                anomaly_id=anomaly.anomaly_id,
                reviewer="system",
                action="import_negative",
                comment=f"导入负样本: {sample.main_process_name}",
                old_status=None,
                new_status=ReviewStatus.IMPORTED,
            )
        self._save_to_storage()
        return new_anomalies

    def _create_anomaly_from_negative(self, sample: NegativeSample) -> AnomalySample:
        anomaly_id = f"anomaly_{uuid.uuid4().hex[:8]}"
        time_window_issues = self._detect_time_window_issues(sample, [])

        why_kept = self._generate_why_kept(sample, [], time_window_issues)
        missing_materials = self._generate_missing_materials(sample, [])
        next_action = self._generate_next_action(time_window_issues, has_recall=False)

        return AnomalySample(
            anomaly_id=anomaly_id,
            sample_id=sample.sample_id,
            negative_sample=sample,
            time_window_issues=time_window_issues,
            status=ReviewStatus.IMPORTED if not time_window_issues else ReviewStatus.PENDING_EXPERT_REVIEW,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_action=next_action,
            tags=["主流程"] if sample.main_process_name else [],
        )

    def add_recall_candidates(self, candidates: List[RecallCandidate]) -> List[AnomalySample]:
        updated_anomalies = []
        for candidate in candidates:
            self.recall_candidates[candidate.candidate_id] = candidate
            sample_id = candidate.sample_id
            anomaly = self._find_anomaly_by_sample_id(sample_id)

            if anomaly:
                old_status = anomaly.status
                anomaly.recall_candidates.append(candidate)
                anomaly = self._recompute_anomaly(anomaly)
                if not anomaly.time_window_issues:
                    anomaly.status = ReviewStatus.RECALL_ADDED
                anomaly.updated_at = datetime.now()
                self._add_review_record(
                    anomaly_id=anomaly.anomaly_id,
                    reviewer=candidate.added_by or "recommend_strategy_tang",
                    action="add_recall",
                    comment=f"补录召回候选: {candidate.scene_description}",
                    old_status=old_status,
                    new_status=anomaly.status,
                )
                updated_anomalies.append(anomaly)
            else:
                negative_sample = self.negative_samples.get(sample_id)
                if negative_sample:
                    anomaly = self._create_anomaly_from_negative(negative_sample)
                    anomaly.recall_candidates.append(candidate)
                    anomaly = self._recompute_anomaly(anomaly)
                    if not anomaly.time_window_issues:
                        anomaly.status = ReviewStatus.RECALL_ADDED
                    self.anomaly_samples[anomaly.anomaly_id] = anomaly
                    updated_anomalies.append(anomaly)

        self._save_to_storage()
        return updated_anomalies

    def _find_anomaly_by_sample_id(self, sample_id: str) -> Optional[AnomalySample]:
        for anomaly in self.anomaly_samples.values():
            if anomaly.sample_id == sample_id:
                return anomaly
        return None

    def _recompute_anomaly(self, anomaly: AnomalySample) -> AnomalySample:
        time_window_issues = self._detect_time_window_issues(
            anomaly.negative_sample, anomaly.recall_candidates
        )
        anomaly.time_window_issues = time_window_issues
        anomaly.evidence_merge = self._merge_evidence(
            anomaly.negative_sample, anomaly.recall_candidates
        )
        anomaly.why_kept = self._generate_why_kept(
            anomaly.negative_sample, anomaly.recall_candidates, time_window_issues
        )
        anomaly.missing_materials = self._generate_missing_materials(
            anomaly.negative_sample, anomaly.recall_candidates
        )
        anomaly.next_action = self._generate_next_action(
            time_window_issues, has_recall=len(anomaly.recall_candidates) > 0
        )

        if time_window_issues and anomaly.status not in [
            ReviewStatus.EXPERT_APPROVED,
            ReviewStatus.EXPERT_REJECTED,
        ]:
            anomaly.status = ReviewStatus.PENDING_EXPERT_REVIEW
            anomaly.tags = list(set(anomaly.tags + ["待实验平台复核", "时间窗穿越"]))
        elif anomaly.recall_candidates:
            anomaly.tags = list(set(anomaly.tags + ["已补召回"]))

        anomaly.updated_at = datetime.now()
        return anomaly

    def _detect_time_window_issues(
        self,
        negative_sample: NegativeSample,
        recall_candidates: List[RecallCandidate],
    ) -> List[TimeWindowIssue]:
        issues = []

        if negative_sample.time_window_tag:
            tag = negative_sample.time_window_tag.lower()
            if "穿越" in tag or "cross" in tag or "inflated" in tag or "虚高" in tag:
                issues.append(
                    TimeWindowIssue(
                        issue_id=f"twi_{uuid.uuid4().hex[:6]}",
                        description=f"负样本标记存在时间窗问题: {negative_sample.time_window_tag}",
                        severity=TimeWindowSeverity.HIGH,
                        window_start=negative_sample.timestamp - timedelta(hours=1),
                        window_end=negative_sample.timestamp + timedelta(hours=1),
                        affected_metrics=["模型预测分", "召回率"],
                        inflated_effect_estimate=0.25,
                        evidence_refs=[f"negative_{negative_sample.sample_id}"],
                    )
                )

        for candidate in recall_candidates:
            time_diff = abs((candidate.timestamp - negative_sample.timestamp).total_seconds())
            if time_diff > 3600 * 24:
                issues.append(
                    TimeWindowIssue(
                        issue_id=f"twi_{uuid.uuid4().hex[:6]}",
                        description=f"召回候选与负样本时间差超过24小时: {time_diff/3600:.1f}小时",
                        severity=TimeWindowSeverity.MEDIUM,
                        window_start=min(candidate.timestamp, negative_sample.timestamp),
                        window_end=max(candidate.timestamp, negative_sample.timestamp),
                        affected_metrics=["时间一致性"],
                        inflated_effect_estimate=0.1,
                        evidence_refs=[
                            f"negative_{negative_sample.sample_id}",
                            f"recall_{candidate.candidate_id}",
                        ],
                    )
                )

        if negative_sample.model_prediction_score > 0.8 and negative_sample.ground_truth_label == "negative":
            issues.append(
                TimeWindowIssue(
                    issue_id=f"twi_{uuid.uuid4().hex[:6]}",
                    description=f"负样本预测分异常偏高: {negative_sample.model_prediction_score:.3f}, 疑似时间窗穿越导致效果虚高",
                    severity=TimeWindowSeverity.CRITICAL,
                    window_start=negative_sample.timestamp - timedelta(minutes=30),
                    window_end=negative_sample.timestamp + timedelta(minutes=30),
                    affected_metrics=["AUC", "精确率"],
                    inflated_effect_estimate=0.4,
                    evidence_refs=[f"negative_{negative_sample.sample_id}"],
                )
            )

        return issues

    def _merge_evidence(
        self,
        negative_sample: NegativeSample,
        recall_candidates: List[RecallCandidate],
    ) -> Optional[EvidenceMergeResult]:
        if not recall_candidates:
            return None

        merged_id = f"merge_{uuid.uuid4().hex[:8]}"
        combined_context = {
            "main_process": {
                "id": negative_sample.main_process_id,
                "name": negative_sample.main_process_name,
                "features": negative_sample.feature_values,
            },
            "field_scenes": [
                {
                    "description": c.scene_description,
                    "evidence": c.field_evidence,
                    "source": c.recall_source,
                    "confidence": c.confidence_score,
                }
                for c in recall_candidates
            ],
        }

        supporting_points = []
        conflicting_points = []

        for candidate in recall_candidates:
            if candidate.confidence_score > 0.7:
                supporting_points.append(
                    f"召回候选 '{candidate.scene_description}' 置信度较高({candidate.confidence_score:.2f})，支持主流程判断"
                )
            else:
                conflicting_points.append(
                    f"召回候选 '{candidate.scene_description}' 置信度较低({candidate.confidence_score:.2f})，与主流程存在差异"
                )

        summary = (
            f"合并了主流程「{negative_sample.main_process_name}」与 "
            f"{len(recall_candidates)} 条现场说法证据。"
        )
        if supporting_points:
            summary += f" 支持点: {len(supporting_points)} 个。"
        if conflicting_points:
            summary += f" 冲突点: {len(conflicting_points)} 个，需重点复核。"

        return EvidenceMergeResult(
            merged_evidence_id=merged_id,
            negative_sample_ref=negative_sample.sample_id,
            recall_candidate_refs=[c.candidate_id for c in recall_candidates],
            combined_context=combined_context,
            conflicting_points=conflicting_points,
            supporting_points=supporting_points,
            summary=summary,
        )

    def _generate_why_kept(
        self,
        negative_sample: NegativeSample,
        recall_candidates: List[RecallCandidate],
        time_window_issues: List[TimeWindowIssue],
    ) -> str:
        reasons = []

        reasons.append(f"属于主流程「{negative_sample.main_process_name}」的负样本，用于模型蒸馏质量控制")

        if recall_candidates:
            reasons.append(f"已关联 {len(recall_candidates)} 条现场说法召回候选，证据链完整度提升")

        if time_window_issues:
            high_severity = [i for i in time_window_issues if i.severity in [TimeWindowSeverity.HIGH, TimeWindowSeverity.CRITICAL]]
            reasons.append(
                f"检测到 {len(time_window_issues)} 个时间窗问题"
                + (f"，其中 {len(high_severity)} 个为高风险" if high_severity else "")
                + "，可能导致模型效果虚高，需实验平台负责人复核"
            )
        else:
            reasons.append("暂未检测到明显时间窗问题，待进一步验证")

        return "；".join(reasons)

    def _generate_missing_materials(
        self,
        negative_sample: NegativeSample,
        recall_candidates: List[RecallCandidate],
    ) -> List[str]:
        missing = []

        if not negative_sample.feature_values:
            missing.append("负样本详细特征值")

        if not recall_candidates:
            missing.append("召回候选表（现场说法证据）- 请推荐策略老唐补录")

        if recall_candidates and all(c.field_evidence == "" for c in recall_candidates):
            missing.append("召回候选的现场证据详情")

        if not negative_sample.source:
            missing.append("负样本来源信息")

        return missing

    def _generate_next_action(
        self,
        time_window_issues: List[TimeWindowIssue],
        has_recall: bool,
    ) -> Optional[NextAction]:
        if time_window_issues:
            has_critical = any(i.severity == TimeWindowSeverity.CRITICAL for i in time_window_issues)
            return NextAction(
                owner=NextActionOwner.EXPERIMENT_PLATFORM,
                action_description=(
                    "复核时间窗穿越问题，确认是否导致模型效果虚高，"
                    + ("问题严重，请优先处理" if has_critical else "请按排期处理")
                ),
                deadline_hint="3个工作日内",
                contact_info="实验平台负责人",
            )
        elif not has_recall:
            return NextAction(
                owner=NextActionOwner.RECOMMEND_STRATEGY,
                action_description="补录召回候选表，补充现场说法证据",
                deadline_hint="1个工作日内",
                contact_info="推荐策略老唐",
            )
        else:
            return NextAction(
                owner=NextActionOwner.REVIEWER,
                action_description="完成证据复核，确认样本是否可归档",
                deadline_hint="2个工作日内",
                contact_info="质量复核人",
            )

    def submit_expert_review(
        self,
        anomaly_id: str,
        reviewer: str,
        approved: bool,
        comment: str,
    ) -> Optional[AnomalySample]:
        anomaly = self.anomaly_samples.get(anomaly_id)
        if not anomaly:
            return None

        old_status = anomaly.status
        if approved:
            anomaly.status = ReviewStatus.EXPERT_APPROVED
            anomaly.tags = [t for t in anomaly.tags if t != "待实验平台复核"]
            anomaly.tags.append("已通过专家复核")
            action = "expert_approve"
        else:
            anomaly.status = ReviewStatus.EXPERT_REJECTED
            anomaly.tags.append("专家复核不通过")
            action = "expert_reject"

        anomaly.review_comments.append(f"[{reviewer}] {comment}")
        anomaly.updated_at = datetime.now()

        self._add_review_record(
            anomaly_id=anomaly_id,
            reviewer=reviewer,
            action=action,
            comment=comment,
            old_status=old_status,
            new_status=anomaly.status,
        )
        self._save_to_storage()
        return anomaly

    def archive_anomaly(self, anomaly_id: str, reviewer: str, comment: str = "") -> Optional[AnomalySample]:
        anomaly = self.anomaly_samples.get(anomaly_id)
        if not anomaly:
            return None

        old_status = anomaly.status
        anomaly.status = ReviewStatus.ARCHIVED
        anomaly.tags.append("已归档")
        anomaly.updated_at = datetime.now()

        self._add_review_record(
            anomaly_id=anomaly_id,
            reviewer=reviewer,
            action="archive",
            comment=comment or "样本归档",
            old_status=old_status,
            new_status=ReviewStatus.ARCHIVED,
        )
        self._save_to_storage()
        return anomaly

    def _add_review_record(
        self,
        anomaly_id: str,
        reviewer: str,
        action: str,
        comment: str,
        old_status: Optional[ReviewStatus],
        new_status: ReviewStatus,
    ):
        record = ReviewRecord(
            record_id=f"record_{uuid.uuid4().hex[:8]}",
            anomaly_id=anomaly_id,
            reviewer=reviewer,
            action=action,
            comment=comment,
            old_status=old_status,
            new_status=new_status,
        )
        self.review_records.append(record)

    def get_anomaly_list(
        self,
        status: Optional[ReviewStatus] = None,
        has_time_window_issue: Optional[bool] = None,
    ) -> List[AnomalySample]:
        result = list(self.anomaly_samples.values())
        if status:
            result = [a for a in result if a.status == status]
        if has_time_window_issue is not None:
            result = [a for a in result if a.has_time_window_inflation() == has_time_window_issue]
        return sorted(result, key=lambda a: a.updated_at, reverse=True)

    def get_anomaly_detail(self, anomaly_id: str) -> Optional[AnomalySample]:
        return self.anomaly_samples.get(anomaly_id)

    def get_review_history(self, anomaly_id: str) -> List[ReviewRecord]:
        return [r for r in self.review_records if r.anomaly_id == anomaly_id]

    def get_statistics(self) -> Dict:
        total = len(self.anomaly_samples)
        by_status = {}
        for status in ReviewStatus:
            by_status[status.value] = len(
                [a for a in self.anomaly_samples.values() if a.status == status]
            )
        with_time_window = len(
            [a for a in self.anomaly_samples.values() if a.has_time_window_inflation()]
        )
        with_recall = len(
            [a for a in self.anomaly_samples.values() if len(a.recall_candidates) > 0]
        )
        return {
            "total_anomalies": total,
            "by_status": by_status,
            "with_time_window_issues": with_time_window,
            "with_recall_candidates": with_recall,
            "pending_expert_review": by_status.get("pending_expert_review", 0),
        }
