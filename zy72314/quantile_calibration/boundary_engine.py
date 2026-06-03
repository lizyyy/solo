"""边界规则引擎 - 定义和执行分位数薪酬校准的边界判定规则

边界规则（写死在代码中，不靠口头约定）：
1. 负数样本检测：分位数值 < 0 标记为 NEGATIVE_VALUE
2. 缺失值检测：分位数值为空 / None / NaN 标记为 MISSING_VALUE
3. 旧表遗留问题：样本量为正但分位数为空，且原始行有负数痕迹 → NEGATIVE_TREATED_AS_MISSING
4. 上述第3类样本不急着归正常，留给学生助教复核
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import logging

from .models import (
    RatingWeightRecord, RecordHistory, BoundaryType, ReviewTask,
    ProcessingStatus, ChangeSource
)
from .database import Database

logger = logging.getLogger(__name__)


class BoundaryRuleEngine:
    """边界规则引擎 - 所有规则硬编码在此，确保可追溯"""

    QUANTILE_FIELDS = ["weight_p10", "weight_p25", "weight_p50", "weight_p75", "weight_p90"]

    def __init__(self, db: Database):
        self.db = db

    def analyze_record(self, record: RatingWeightRecord) -> Tuple[BoundaryType, List[str]]:
        """
        分析单条记录，返回边界类型和判定理由列表。
        核心规则硬编码在此，不依赖外部配置。
        """
        reasons = []
        has_negative = False
        has_missing = False

        for field in self.QUANTILE_FIELDS:
            value = getattr(record, field)
            if value is None:
                has_missing = True
                reasons.append(f"{field}: 值为空")
            elif isinstance(value, (int, float)):
                if value < 0:
                    has_negative = True
                    reasons.append(f"{field}: 负数值 {value}")

        if has_negative and record.sample_count is not None and record.sample_count > 0:
            return BoundaryType.NEGATIVE_VALUE, reasons

        raw_data = record.raw_data or {}
        raw_has_negative_trace = self._check_raw_has_negative_trace(raw_data)

        if has_missing and raw_has_negative_trace:
            reasons.append("检测到旧表遗留：原始数据有负数痕迹但当前被标记为缺失")
            return BoundaryType.NEGATIVE_TREATED_AS_MISSING, reasons

        if has_missing:
            return BoundaryType.MISSING_VALUE, reasons

        if has_negative:
            return BoundaryType.NEGATIVE_VALUE, reasons

        return BoundaryType.NORMAL, ["正常样本"]

    def _check_raw_has_negative_trace(self, raw_data: Dict[str, Any]) -> bool:
        """检查原始数据中是否有负数被当成缺失的痕迹"""
        for key, value in raw_data.items():
            if value is None:
                continue
            if isinstance(value, str):
                value_lower = value.strip().lower()
                if value_lower.startswith("-") and len(value_lower) > 1:
                    try:
                        if float(value.strip()) < 0:
                            return True
                    except (ValueError, TypeError):
                        pass
                if "实际是-" in value_lower or "实为-" in value_lower or "原是-" in value_lower:
                    return True
                if "负数" in value_lower and ("缺失" in value_lower or "为空" in value_lower or "误标" in value_lower):
                    return True
                if value_lower.count("-") > 0:
                    import re
                    if re.search(r'-\d+', value_lower):
                        return True
            elif isinstance(value, (int, float)) and value < 0:
                return True
        return False

    def apply_boundary_detection(self, batch_id: int, operator: str = "system") -> Dict[str, Any]:
        """
        对整批数据应用边界检测。
        关键规则：NEGATIVE_TREATED_AS_MISSING 不急着归正常，留给学生助教复核。
        """
        records = self.db.get_records_by_batch(batch_id)
        summary = {
            "total": len(records),
            "normal": 0,
            "negative_value": 0,
            "missing_value": 0,
            "negative_treated_as_missing": 0,
            "outlier": 0,
            "pending_review": 0,
            "updated_ids": []
        }

        for record in records:
            boundary_type, reasons = self.analyze_record(record)

            if record.boundary_type != boundary_type:
                old_status = record.status
                old_boundary = record.boundary_type

                record.boundary_type = boundary_type
                record.updated_at = datetime.now()
                record.updated_by = operator

                if boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING:
                    record.status = ProcessingStatus.PENDING_REVIEW
                    summary["pending_review"] += 1
                elif boundary_type in (BoundaryType.NEGATIVE_VALUE, BoundaryType.MISSING_VALUE):
                    record.status = ProcessingStatus.PENDING_REVIEW
                else:
                    record.status = ProcessingStatus.IMPORTED

                self.db.update_rating_record(record)

                history = RecordHistory(
                    record_id=record.id,
                    change_source=ChangeSource.BOUNDARY_DETECTION,
                    field_name="boundary_type",
                    old_value=old_boundary.value,
                    new_value=boundary_type.value,
                    old_status=old_status,
                    new_status=record.status,
                    snapshot_before={
                        "boundary_type": old_boundary.value,
                        "status": old_status.value,
                        "weight_p10": record.weight_p10,
                        "weight_p25": record.weight_p25,
                        "weight_p50": record.weight_p50,
                        "weight_p75": record.weight_p75,
                        "weight_p90": record.weight_p90,
                        "sample_count": record.sample_count
                    },
                    snapshot_after={
                        "boundary_type": boundary_type.value,
                        "status": record.status.value,
                        "weight_p10": record.weight_p10,
                        "weight_p25": record.weight_p25,
                        "weight_p50": record.weight_p50,
                        "weight_p75": record.weight_p75,
                        "weight_p90": record.weight_p90,
                        "sample_count": record.sample_count,
                        "detection_reasons": reasons
                    },
                    changed_by=operator,
                    change_reason="边界检测: " + "; ".join(reasons),
                    changed_at=datetime.now()
                )
                self.db.add_history(history)
                summary["updated_ids"].append(record.id)

            summary[boundary_type.value] += 1

        return summary

    def create_review_tasks(self, batch_id: int, assigned_ta: str) -> List[int]:
        """
        为需要复核的记录创建复核任务。
        重点：NEGATIVE_TREATED_AS_MISSING 必须留待学生助教处理。
        """
        pending_records = self.db.get_records_by_status(ProcessingStatus.PENDING_REVIEW)
        batch_pending = [r for r in pending_records if r.import_batch_id == batch_id]
        task_ids = []

        for record in batch_pending:
            task = ReviewTask(
                record_id=record.id,
                boundary_type=record.boundary_type,
                assigned_to=assigned_ta,
                review_note=self._generate_review_note(record),
                created_at=datetime.now()
            )
            task_id = self.db.create_review_task(task)
            task_ids.append(task_id)

        return task_ids

    def _generate_review_note(self, record: RatingWeightRecord) -> str:
        notes = [f"原始行号: {record.original_row_number}"]
        notes.append(f"岗位: {record.position}")

        if record.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING:
            notes.append("【重点复核】旧表将负数当成缺失，请对照旧公式截图判断：")
            notes.append("  - 是录入错误？还是真实存在的负向调整？")
            notes.append("  - 是否需要恢复为负数值？还是保持缺失？")
        elif record.boundary_type == BoundaryType.NEGATIVE_VALUE:
            notes.append("存在负数值，请判断是否合理：")
            for field in self.QUANTILE_FIELDS:
                val = getattr(record, field)
                if val is not None and val < 0:
                    notes.append(f"  - {field} = {val}")
        elif record.boundary_type == BoundaryType.MISSING_VALUE:
            notes.append("存在缺失值，请判断是否需要补录：")
            for field in self.QUANTILE_FIELDS:
                if getattr(record, field) is None:
                    notes.append(f"  - {field} 为空")

        notes.append(f"样本量: {record.sample_count}")
        if record.remark:
            notes.append(f"备注: {record.remark}")
        return "\n".join(notes)

    def correct_boundary_issue(
        self,
        record_id: int,
        corrections: Dict[str, Any],
        operator: str,
        reason: str
    ) -> RatingWeightRecord:
        """
        修正边界问题，保留完整历史记录。
        支持回滚：每次修正都有快照，可以对比改前改后。
        """
        record = self.db.get_rating_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        snapshot_before = {
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "current_data": dict(record.current_data)
        }

        old_status = record.status
        old_boundary = record.boundary_type

        for field, new_value in corrections.items():
            if hasattr(record, field) and field != "id":
                setattr(record, field, new_value)
                record.current_data[field] = new_value

        new_boundary, _ = self.analyze_record(record)
        record.boundary_type = new_boundary

        if new_boundary == BoundaryType.NORMAL:
            record.status = ProcessingStatus.REVISED
        else:
            record.status = ProcessingStatus.PENDING_REVIEW

        record.updated_at = datetime.now()
        record.updated_by = operator

        self.db.update_rating_record(record)

        snapshot_after = {
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "current_data": dict(record.current_data),
            "corrections_applied": corrections
        }

        for field, new_value in corrections.items():
            history = RecordHistory(
                record_id=record_id,
                change_source=ChangeSource.TA_REVIEW if operator.startswith("ta_") else ChangeSource.MANUAL_EDIT,
                field_name=field,
                old_value=str(snapshot_before.get(field)),
                new_value=str(new_value),
                old_status=old_status,
                new_status=record.status,
                snapshot_before=snapshot_before,
                snapshot_after=snapshot_after,
                changed_by=operator,
                change_reason=reason,
                changed_at=datetime.now()
            )
            self.db.add_history(history)

        return record

    def rollback_to_history(self, record_id: int, history_id: int, operator: str) -> RatingWeightRecord:
        """
        回滚到指定历史版本。
        回滚本身也会生成一条历史记录，确保所有操作可追溯。
        """
        histories = self.db.get_record_histories(record_id)
        target_history = next((h for h in histories if h.id == history_id), None)

        if not target_history:
            raise ValueError(f"历史记录不存在: {history_id}")

        record = self.db.get_rating_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        snapshot_before = {
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark
        }

        old_status = record.status
        target_snapshot = target_history.snapshot_before

        for field in ["weight_p10", "weight_p25", "weight_p50", "weight_p75", "weight_p90", "sample_count", "remark"]:
            if field in target_snapshot:
                setattr(record, field, target_snapshot[field])

        record.boundary_type = BoundaryType(target_snapshot.get("boundary_type", BoundaryType.NORMAL.value))
        record.status = ProcessingStatus.ROLLED_BACK
        record.updated_at = datetime.now()
        record.updated_by = operator

        self.db.update_rating_record(record)

        snapshot_after = {
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "rollback_to_history": history_id
        }

        history = RecordHistory(
            record_id=record_id,
            change_source=ChangeSource.ROLLBACK,
            field_name="rollback",
            old_value=f"current_state_{record_id}",
            new_value=f"history_{history_id}",
            old_status=old_status,
            new_status=record.status,
            snapshot_before=snapshot_before,
            snapshot_after=snapshot_after,
            changed_by=operator,
            change_reason=f"回滚到历史版本 #{history_id}",
            changed_at=datetime.now()
        )
        self.db.add_history(history)

        return record
