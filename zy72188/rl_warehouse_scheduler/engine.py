import hashlib
import json
import logging
from typing import List, Tuple, Dict, Any, Optional
from datetime import datetime

from .models import (
    EvaluationRecord,
    RecordStatus,
    SchedulingDecision,
    DataSource,
)

logger = logging.getLogger(__name__)


class EvaluationEngine:
    def __init__(self, threshold_config: Optional[Dict[str, float]] = None):
        self.threshold_config = threshold_config or {
            "cost_tolerance": 0.1,
            "priority_mismatch_threshold": 1,
            "confidence_threshold": 0.8,
        }
        self.seen_record_ids: set = set()
        self.duplicate_records: List[EvaluationRecord] = []

    def validate_record(self, record: EvaluationRecord) -> Tuple[bool, Optional[str]]:
        decision = record.scheduling_decision
        
        if not decision.warehouse_id:
            return False, "warehouse_id为空"
        
        if decision.priority < 0 or decision.priority > 10:
            return False, f"priority超出有效范围: {decision.priority}"
        
        if decision.estimated_cost < 0:
            return False, f"estimated_cost不能为负数: {decision.estimated_cost}"
        
        return True, None

    def detect_duplicates(self, records: List[EvaluationRecord]) -> set:
        seen = set()
        duplicate_ids = set()
        
        for record in records:
            if record.record_id in seen:
                duplicate_ids.add(record.record_id)
            else:
                seen.add(record.record_id)
        
        return duplicate_ids

    def check_conflict(
        self,
        decision: SchedulingDecision,
        ground_truth: SchedulingDecision,
    ) -> Tuple[bool, str]:
        reasons = []
        
        if decision.warehouse_id != ground_truth.warehouse_id:
            reasons.append(
                f"仓库选择不一致: 模型={decision.warehouse_id}, "
                f"标注={ground_truth.warehouse_id}"
            )
        
        priority_diff = abs(decision.priority - ground_truth.priority)
        if priority_diff > self.threshold_config["priority_mismatch_threshold"]:
            reasons.append(
                f"优先级差异过大: 模型={decision.priority}, "
                f"标注={ground_truth.priority}, 差值={priority_diff}"
            )
        
        if ground_truth.estimated_cost > 0:
            cost_diff_ratio = abs(
                decision.estimated_cost - ground_truth.estimated_cost
            ) / ground_truth.estimated_cost
            if cost_diff_ratio > self.threshold_config["cost_tolerance"]:
                reasons.append(
                    f"成本差异超过阈值: 模型={decision.estimated_cost:.2f}, "
                    f"标注={ground_truth.estimated_cost:.2f}, "
                    f"差异率={cost_diff_ratio:.2%}"
                )
        
        if reasons:
            return True, "; ".join(reasons)
        
        return False, ""

    def determine_status(
        self,
        record: EvaluationRecord,
    ) -> Tuple[RecordStatus, Optional[str]]:
        is_valid, invalid_reason = self.validate_record(record)
        if not is_valid:
            return RecordStatus.INVALID, invalid_reason

        if record.source == DataSource.ONLINE_FEEDBACK:
            return RecordStatus.LEGACY, "线上反馈工单旧口径数据"

        if record.ground_truth is None:
            return RecordStatus.NEEDS_REVIEW, "缺少标注结果，需要人工确认"

        has_conflict, conflict_reason = self.check_conflict(
            record.scheduling_decision,
            record.ground_truth,
        )

        if has_conflict:
            return RecordStatus.CONFLICT, conflict_reason

        return RecordStatus.SUCCESS, None

    def evaluate_records(
        self,
        records: List[EvaluationRecord],
    ) -> Tuple[List[EvaluationRecord], Dict[str, Any]]:
        evaluated_records: List[EvaluationRecord] = []
        duplicate_ids = self.detect_duplicates(records)
        processed_ids = set()
        
        stats = {
            "total": len(records),
            "duplicates": len(duplicate_ids),
            "success": 0,
            "needs_review": 0,
            "conflict": 0,
            "invalid": 0,
            "legacy": 0,
        }

        for record in records:
            if record.record_id in duplicate_ids and record.record_id in processed_ids:
                record.status = RecordStatus.INVALID
                record.conflict_reason = f"重复记录: {record.record_id}"
                evaluated_records.append(record)
                stats["invalid"] += 1
                continue

            processed_ids.add(record.record_id)
            status, reason = self.determine_status(record)
            record.status = status
            record.conflict_reason = reason
            record.modified_at = datetime.now()

            evaluated_records.append(record)

            if status == RecordStatus.SUCCESS:
                stats["success"] += 1
            elif status == RecordStatus.NEEDS_REVIEW:
                stats["needs_review"] += 1
            elif status == RecordStatus.CONFLICT:
                stats["conflict"] += 1
            elif status == RecordStatus.INVALID:
                stats["invalid"] += 1
            elif status == RecordStatus.LEGACY:
                stats["legacy"] += 1

        stats["accuracy"] = (
            stats["success"] / stats["total"] if stats["total"] > 0 else 0.0
        )

        return evaluated_records, stats

    def generate_record_fingerprint(
        self,
        record: EvaluationRecord,
    ) -> str:
        record_dict = record.model_dump(exclude={"created_at", "modified_at"})
        record_json = json.dumps(record_dict, sort_keys=True, default=str)
        return hashlib.md5(record_json.encode()).hexdigest()

    def group_by_status(
        self,
        records: List[EvaluationRecord],
    ) -> Dict[RecordStatus, List[EvaluationRecord]]:
        groups: Dict[RecordStatus, List[EvaluationRecord]] = {
            status: [] for status in RecordStatus
        }
        for record in records:
            groups[record.status].append(record)
        return groups

    def get_conflict_records(
        self,
        records: List[EvaluationRecord],
    ) -> List[EvaluationRecord]:
        return [
            r for r in records
            if r.status in (RecordStatus.CONFLICT, RecordStatus.NEEDS_REVIEW)
        ]
