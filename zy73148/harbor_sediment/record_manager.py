from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from copy import deepcopy

from .models import (
    BottleSample,
    SedimentRecord,
    RecordStatus,
    ChangeHistory,
    CalculationError,
)
from .calculator import calculate_sediment, CalculationResult
from .bottle_parser import enrich_bottle_from_id


def _generate_record_id() -> str:
    return f"SED-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


def create_record(
    station_code: str,
    target_harbor: str,
    bottles: Optional[List[BottleSample]] = None,
    created_by: Optional[str] = None,
) -> Tuple[SedimentRecord, CalculationResult]:
    record = SedimentRecord(
        record_id=_generate_record_id(),
        station_code=station_code,
        target_harbor=target_harbor,
        status=RecordStatus.PENDING_EVIDENCE,
        bottles=[],
        created_by=created_by,
        last_modified_by=created_by,
    )

    if bottles:
        record, calc_result = add_bottles_batch(
            record, bottles, operator=created_by, batch_note="首次提交"
        )
    else:
        calc_result = calculate_sediment(record)

    return record, calc_result


def _snapshot_bottles(bottles: List[BottleSample]) -> List[Dict[str, Any]]:
    return [b.model_dump(mode="json") for b in bottles]


def _snapshot_record_state(record: SedimentRecord) -> Dict[str, Any]:
    return {
        "status": record.status.value,
        "sediment_conclusion": record.sediment_conclusion,
        "sediment_value": record.sediment_value,
        "sediment_unit": record.sediment_unit,
        "final_report_ready": record.final_report_ready,
        "bottles_count": len(record.bottles),
        "bottles_received": list(record.bottles_received),
        "calculation_errors_count": len(record.calculation_errors),
        "suspicions_count": len(record.suspicions),
    }


def _merge_bottle_fields(
    existing: BottleSample, incoming: BottleSample
) -> Tuple[BottleSample, Dict[str, Dict[str, Any]]]:
    snapshot_before = existing.model_dump(mode="json")
    merged = BottleSample(**existing.model_dump())
    changes: Dict[str, Dict[str, Any]] = {"added": {}, "overwritten": {}}

    def _check_and_merge(field_name: str, new_val: Any, is_bool: bool = False):
        current_val = getattr(merged, field_name)
        if is_bool:
            if new_val and not current_val:
                setattr(merged, field_name, new_val)
                changes["added"][field_name] = {"from": current_val, "to": new_val}
            elif new_val and current_val and new_val != current_val:
                setattr(merged, field_name, new_val)
                changes["overwritten"][field_name] = {"from": current_val, "to": new_val}
            return
        if new_val is not None and new_val != "":
            if current_val is None or current_val == "":
                setattr(merged, field_name, new_val)
                changes["added"][field_name] = {"from": current_val, "to": new_val}
            elif current_val != new_val:
                setattr(merged, field_name, new_val)
                changes["overwritten"][field_name] = {"from": current_val, "to": new_val}

    if incoming.experiment_result is not None:
        if existing.experiment_result is None:
            merged.experiment_result = incoming.experiment_result
            changes["added"]["experiment_result"] = {
                "from": existing.experiment_result,
                "to": incoming.experiment_result,
            }
        elif existing.experiment_result != incoming.experiment_result:
            merged.experiment_result = incoming.experiment_result
            changes["overwritten"]["experiment_result"] = {
                "from": existing.experiment_result,
                "to": incoming.experiment_result,
            }

    _check_and_merge("experiment_unit", incoming.experiment_unit)
    _check_and_merge("experiment_time", incoming.experiment_time)
    _check_and_merge("sampling_time", incoming.sampling_time)
    _check_and_merge("station_code", incoming.station_code)
    _check_and_merge("operator", incoming.operator)
    _check_and_merge("batch_no", incoming.batch_no)
    _check_and_merge("remarks", incoming.remarks)
    _check_and_merge("has_cloud_occlusion", incoming.has_cloud_occlusion, is_bool=True)
    _check_and_merge("cloud_occlusion_detail", incoming.cloud_occlusion_detail)

    if incoming.raw_data:
        old_raw_data = dict(merged.raw_data)
        merged.raw_data.update(incoming.raw_data)
        changes["added"]["raw_data"] = {
            "from": old_raw_data,
            "to": dict(merged.raw_data),
        }

    return merged, changes


def add_bottles_batch(
    record: SedimentRecord,
    new_bottles: List[BottleSample],
    operator: Optional[str] = None,
    batch_note: Optional[str] = None,
    change_reason: str = "补充采样瓶批次数据",
) -> Tuple[SedimentRecord, CalculationResult]:
    old_material = {
        "bottles": _snapshot_bottles(record.bottles),
        "record_state": _snapshot_record_state(record),
    }

    existing_by_id = {b.bottle_id: b for b in record.bottles}
    added_bottles: List[BottleSample] = []
    merged_bottles: List[BottleSample] = []
    merge_details: List[Dict[str, Any]] = []

    for bottle in new_bottles:
        enriched = enrich_bottle_from_id(bottle.bottle_id)
        if bottle.experiment_result is not None:
            enriched.experiment_result = bottle.experiment_result
        if bottle.experiment_unit:
            enriched.experiment_unit = bottle.experiment_unit
        if bottle.experiment_time:
            enriched.experiment_time = bottle.experiment_time
        if bottle.sampling_time:
            enriched.sampling_time = bottle.sampling_time
        if bottle.station_code:
            enriched.station_code = bottle.station_code
        if bottle.operator:
            enriched.operator = bottle.operator
        if bottle.batch_no:
            enriched.batch_no = bottle.batch_no
        if bottle.remarks:
            enriched.remarks = bottle.remarks
        if bottle.has_cloud_occlusion:
            enriched.has_cloud_occlusion = bottle.has_cloud_occlusion
        if bottle.cloud_occlusion_detail:
            enriched.cloud_occlusion_detail = bottle.cloud_occlusion_detail
        enriched.raw_data.update(bottle.raw_data)

        if bottle.bottle_id in existing_by_id:
            existing = existing_by_id[bottle.bottle_id]
            merged, changes = _merge_bottle_fields(existing, enriched)
            if changes["added"] or changes["overwritten"]:
                idx = record.bottles.index(existing)
                record.bottles[idx] = merged
                merged_bottles.append(merged)
                merge_details.append(
                    {
                        "bottle_id": bottle.bottle_id,
                        "before": _snapshot_bottles([existing])[0],
                        "after": _snapshot_bottles([merged])[0],
                        "added_fields": changes["added"],
                        "overwritten_fields": changes["overwritten"],
                    }
                )
        else:
            added_bottles.append(enriched)
            existing_by_id[bottle.bottle_id] = enriched

    record.bottles.extend(added_bottles)

    added_ids = [b.bottle_id for b in added_bottles]
    merged_ids = [b.bottle_id for b in merged_bottles]
    record.bottles_received.extend(added_ids + merged_ids)

    calc_result = calculate_sediment(record)

    new_material = {
        "new_bottles": _snapshot_bottles(added_bottles),
        "merged_bottles": merge_details,
        "new_bottle_ids": added_ids,
        "merged_bottle_ids": merged_ids,
        "batch_note": batch_note,
        "calculation_result": {
            "success": calc_result.success,
            "status": calc_result.status.value,
            "sediment_value": calc_result.sediment_value,
            "sediment_unit": calc_result.sediment_unit,
            "conclusion": calc_result.conclusion,
            "errors_count": len(calc_result.errors),
            "suspicions_count": len(calc_result.suspicions),
            "valid_bottle_count": len(calc_result.valid_bottles),
            "invalid_bottle_count": len(calc_result.invalid_bottles),
        },
    }

    old_conclusion = record.sediment_conclusion

    record.sediment_value = calc_result.sediment_value
    record.sediment_unit = calc_result.sediment_unit
    record.sediment_conclusion = calc_result.conclusion
    record.calculation_errors = calc_result.errors
    record.suspicions = calc_result.suspicions
    old_status = record.status
    record.status = calc_result.status
    record.final_report_ready = calc_result.final_report_ready
    record.current_version += 1
    record.updated_at = datetime.now()
    record.last_modified_by = operator

    final_reason = change_reason
    if merged_bottles and not added_bottles:
        field_changes = []
        for detail in merge_details:
            added = list(detail["added_fields"].keys())
            overwritten = list(detail["overwritten_fields"].keys())
            parts = []
            if added:
                parts.append(f"补录字段：{', '.join(added)}")
            if overwritten:
                parts.append(f"覆盖字段：{', '.join(overwritten)}")
            field_changes.append(f"{detail['bottle_id']}({'、'.join(parts)})")
        final_reason = "补录采样瓶材料：" + "；".join(field_changes)
    elif added_bottles and merged_bottles:
        final_reason = f"新增采样瓶{len(added_bottles)}个，补录{len(merged_bottles)}个已有采样瓶的晚到材料"

    change = ChangeHistory(
        version=record.current_version,
        operator=operator,
        old_material=old_material,
        new_material=new_material,
        new_remark=batch_note,
        change_reason=final_reason,
        old_conclusion=old_conclusion,
        new_conclusion=record.sediment_conclusion,
    )
    record.change_history.append(change)

    return record, calc_result


def manually_modify_record(
    record: SedimentRecord,
    new_conclusion: Optional[str] = None,
    new_value: Optional[float] = None,
    new_unit: Optional[str] = None,
    change_reason: str = "",
    operator: Optional[str] = None,
    remark: Optional[str] = None,
) -> SedimentRecord:
    if not change_reason:
        raise ValueError("人工修改必须提供改判原因")

    old_material = {
        "record_state": _snapshot_record_state(record),
        "bottles": _snapshot_bottles(record.bottles),
    }

    old_conclusion = record.sediment_conclusion
    old_value = record.sediment_value
    old_unit = record.sediment_unit
    old_status = record.status

    if new_conclusion is not None:
        record.sediment_conclusion = new_conclusion
    if new_value is not None:
        record.sediment_value = new_value
    if new_unit is not None:
        record.sediment_unit = new_unit

    record.status = RecordStatus.MANUALLY_MODIFIED
    record.final_report_ready = False
    record.current_version += 1
    record.updated_at = datetime.now()
    record.last_modified_by = operator

    new_material = {
        "manual_changes": {
            "new_conclusion": record.sediment_conclusion,
            "new_value": record.sediment_value,
            "new_unit": record.sediment_unit,
        },
        "old_values": {
            "old_conclusion": old_conclusion,
            "old_value": old_value,
            "old_unit": old_unit,
        },
    }

    change = ChangeHistory(
        version=record.current_version,
        operator=operator,
        old_material=old_material,
        new_material=new_material,
        new_remark=remark,
        change_reason=change_reason,
        old_conclusion=old_conclusion,
        new_conclusion=record.sediment_conclusion,
    )
    record.change_history.append(change)

    return record


def get_version_history(
    record: SedimentRecord, version: Optional[int] = None
) -> Optional[ChangeHistory]:
    if version is None:
        return record.change_history[-1] if record.change_history else None
    for ch in record.change_history:
        if ch.version == version:
            return ch
    return None


def compare_versions(
    record: SedimentRecord, v1: int, v2: int
) -> Optional[Dict[str, Any]]:
    h1 = get_version_history(record, v1)
    h2 = get_version_history(record, v2)
    if not h1 or not h2:
        return None
    return {
        "version_from": v1,
        "version_to": v2,
        "conclusion_changed": h1.new_conclusion != h2.new_conclusion,
        "old_conclusion": h1.new_conclusion,
        "new_conclusion": h2.new_conclusion,
        "reasons": [h1.change_reason, h2.change_reason],
        "remarks": [h1.new_remark, h2.new_remark],
        "operators": [h1.operator, h2.operator],
        "times": [h1.change_time, h2.change_time],
    }
