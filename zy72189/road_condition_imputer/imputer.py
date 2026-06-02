import copy
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    RoadConditionRecord,
    ImputationEvidence,
    ImputationResult,
    ProcessingSuggestion,
    MissingType,
    RecordStatus,
    AuditEntry,
)


class RoadConditionImputer:
    def __init__(self, audit_log: Optional[List[AuditEntry]] = None, run_id: str = ""):
        self.audit_log = audit_log if audit_log is not None else []
        self.run_id = run_id
        self._reference_pool: Dict[str, List[RoadConditionRecord]] = {}

    def _log(self, record_id: str, action: str, details: Dict):
        self.audit_log.append(
            AuditEntry(
                run_id=self.run_id,
                record_id=record_id,
                action=action,
                actor="Imputer",
                details=details,
                timestamp=datetime.now().isoformat(),
            )
        )

    def build_reference_pool(self, records: List[RoadConditionRecord]):
        for rec in records:
            segment = rec.road_segment or "UNKNOWN"
            if segment not in self._reference_pool:
                self._reference_pool[segment] = []
            self._reference_pool[segment].append(rec)
        self._log("ALL", "reference_pool_built", {"segments": list(self._reference_pool.keys())})

    def _find_references(self, record: RoadConditionRecord, field_name: str, top_k: int = 3) -> List[RoadConditionRecord]:
        segment = record.road_segment or "UNKNOWN"
        candidates = self._reference_pool.get(segment, [])
        refs = [r for r in candidates if getattr(r, field_name) is not None and r.record_id != record.record_id]
        return refs[:top_k]

    def _impute_field(self, record: RoadConditionRecord, field_name: str) -> tuple:
        refs = self._find_references(record, field_name)

        if not refs:
            all_refs = []
            for seg_recs in self._reference_pool.values():
                all_refs.extend(seg_recs)
            refs = [r for r in all_refs if getattr(r, field_name) is not None and r.record_id != record.record_id][:3]

        if not refs:
            return None, [], 0.0, "no_reference", "无同路段历史数据可供参考，需人工补全"

        values = [getattr(r, field_name) for r in refs]
        ref_ids = [r.record_id for r in refs]

        if field_name in ("congestion_level", "temperature"):
            numeric_vals = []
            for v in values:
                try:
                    numeric_vals.append(float(v))
                except (ValueError, TypeError):
                    pass
            if numeric_vals:
                imputed = round(sum(numeric_vals) / len(numeric_vals), 2)
                confidence = min(1.0, len(numeric_vals) / 3.0)
                method = "mean_of_references"
                reasoning = f"取同路段 {len(numeric_vals)} 条参考记录的均值，参考记录: {ref_ids}"
                return imputed, ref_ids, confidence, method, reasoning
        elif field_name == "traffic_volume":
            numeric_vals = []
            for v in values:
                try:
                    numeric_vals.append(int(v))
                except (ValueError, TypeError):
                    pass
            if numeric_vals:
                imputed = round(sum(numeric_vals) / len(numeric_vals))
                confidence = min(1.0, len(numeric_vals) / 3.0)
                method = "mean_of_references"
                reasoning = f"取同路段 {len(numeric_vals)} 条参考记录的均值（取整），参考记录: {ref_ids}"
                return int(imputed), ref_ids, confidence, method, reasoning
        else:
            from collections import Counter
            counter = Counter(values)
            most_common_val, count = counter.most_common(1)[0]
            confidence = min(1.0, count / len(values))
            method = "mode_of_references"
            reasoning = f"取同路段 {len(values)} 条参考记录的众数（出现 {count} 次），参考记录: {ref_ids}"
            return most_common_val, ref_ids, confidence, method, reasoning

        return None, ref_ids, 0.0, "no_valid_values", "参考记录中该字段均为空，需人工补全"

    def impute(self, record: RoadConditionRecord, missing_type: MissingType) -> ImputationResult:
        if missing_type == MissingType.NONE:
            self._log(record.record_id, "skip_impute", {"reason": "no_missing_fields"})
            return ImputationResult(
                record_id=record.record_id,
                original_record=copy.deepcopy(record),
                imputed_record=copy.deepcopy(record),
                evidences=[],
                suggestions=[],
                status=RecordStatus.VALIDATED,
                processed_at=datetime.now().isoformat(),
            )

        if missing_type == MissingType.FULL_ROW:
            self._log(record.record_id, "impute_failed", {"reason": "full_row_missing"})
            return ImputationResult(
                record_id=record.record_id,
                original_record=copy.deepcopy(record),
                imputed_record=copy.deepcopy(record),
                evidences=[],
                suggestions=[
                    ProcessingSuggestion(
                        record_id=record.record_id,
                        field_name="ALL",
                        suggestion_text="整行缺失，无法自动修补。请回到原始数据源确认该记录是否真实存在，"
                                       "若确认存在请手动补全至少 路段名称+时间戳 后重新提交修补",
                        action_type="manual_full",
                        priority="high",
                    )
                ],
                status=RecordStatus.REWORK,
                processed_at=datetime.now().isoformat(),
            )

        imputed = copy.deepcopy(record)
        evidences = []
        suggestions = []
        fields_to_impute = [
            k for k in ("timestamp", "road_segment", "congestion_level", "weather",
                       "temperature", "surface_condition", "traffic_volume")
            if getattr(record, k) is None
        ]

        for field_name in fields_to_impute:
            value, ref_ids, confidence, method, reasoning = self._impute_field(record, field_name)

            evidence = ImputationEvidence(
                record_id=record.record_id,
                field_name=field_name,
                missing_type=missing_type,
                imputation_method=method,
                reference_record_ids=ref_ids,
                confidence=confidence,
                reasoning=reasoning,
                imputed_value=value,
            )
            evidences.append(evidence)

            if value is not None:
                setattr(imputed, field_name, value)

                if confidence < 0.5:
                    suggestions.append(
                        ProcessingSuggestion(
                            record_id=record.record_id,
                            field_name=field_name,
                            suggestion_text=(
                                f"自动修补置信度较低（{confidence:.0%}），修补依据仅有 {len(ref_ids)} 条参考。"
                                f"请重点核对该字段，建议对照原始数据源确认"
                            ),
                            action_type="low_confidence_review",
                            priority="high",
                        )
                    )
                elif confidence < 0.8:
                    suggestions.append(
                        ProcessingSuggestion(
                            record_id=record.record_id,
                            field_name=field_name,
                            suggestion_text=(
                                f"自动修补置信度中等（{confidence:.0%}），建议抽查确认"
                            ),
                            action_type="medium_confidence_review",
                            priority="normal",
                        )
                    )
            else:
                suggestions.append(
                    ProcessingSuggestion(
                        record_id=record.record_id,
                        field_name=field_name,
                        suggestion_text=(
                            f"字段 {field_name} 无法自动修补（{reasoning}）。"
                            f"请手动补全该字段，补全后重新提交修补流程"
                        ),
                        action_type="manual_field",
                        priority="high",
                    )
                )

        any_unfilled = any(getattr(imputed, f) is None for f in fields_to_impute)
        status = RecordStatus.REWORK if any_unfilled else RecordStatus.IMPUTED

        self._log(record.record_id, "imputed", {
            "fields_imputed": fields_to_impute,
            "status": status.value,
            "avg_confidence": sum(e.confidence for e in evidences) / len(evidences) if evidences else 0,
        })

        return ImputationResult(
            record_id=record.record_id,
            original_record=copy.deepcopy(record),
            imputed_record=imputed,
            evidences=evidences,
            suggestions=suggestions,
            status=status,
            processed_at=datetime.now().isoformat(),
        )
