from typing import Dict, List, Tuple

from models import RawRecord, ValidatedRecord, RecordStatus


def flag_late_records(
    records: List[RawRecord],
    deadline_record_ids: List[str] = None,
    late_ids: List[str] = None,
) -> List[RawRecord]:
    if late_ids:
        id_set = set(late_ids)
        for r in records:
            if r.record_id in id_set:
                r.is_late = True
    if deadline_record_ids:
        deadline_set = set(deadline_record_ids)
        for r in records:
            if r.record_id not in deadline_set and not r.is_late:
                r.is_late = True
    return records


def attach_supplementary_note(
    records: List[RawRecord],
    record_id: str,
    note: str,
) -> List[RawRecord]:
    for r in records:
        if r.record_id == record_id:
            r.supplementary_note = note
            break
    return records


def apply_late_attachment(
    base_records: List[RawRecord],
    late_record: RawRecord,
) -> List[RawRecord]:
    late_record.is_late = True
    merged = list(base_records)
    existing_ids = {r.record_id for r in merged}
    if late_record.record_id in existing_ids:
        for i, r in enumerate(merged):
            if r.record_id == late_record.record_id:
                merged[i] = late_record
                break
    else:
        merged.append(late_record)
    return merged


def summarize_late_impact(
    before: List[ValidatedRecord],
    after: List[ValidatedRecord],
) -> Dict:
    def sum_std(recs):
        return sum(
            (vr.standard_value or 0.0)
            for vr in recs
            if vr.can_release and vr.standard_value is not None
        )

    before_total = sum_std(before)
    after_total = sum_std(after)

    before_ids = {vr.raw.record_id for vr in before}
    after_ids = {vr.raw.record_id for vr in after}
    added_ids = sorted(after_ids - before_ids)
    changed_ids = []
    before_map = {vr.raw.record_id: vr for vr in before}
    for vr in after:
        rid = vr.raw.record_id
        if rid in before_map:
            bv = before_map[rid]
            if (vr.standard_value, vr.status, vr.can_release) != (
                bv.standard_value,
                bv.status,
                bv.can_release,
            ):
                changed_ids.append(rid)

    delta = after_total - before_total
    return {
        "before_release_total": before_total,
        "after_release_total": after_total,
        "delta_value": delta,
        "delta_percent": (delta / before_total * 100.0) if before_total else None,
        "added_record_ids": added_ids,
        "changed_record_ids": sorted(changed_ids),
        "is_consistent_caliber": _check_consistency(before, after),
    }


def _check_consistency(before: List[ValidatedRecord], after: List[ValidatedRecord]) -> bool:
    before_map = {vr.raw.record_id: vr for vr in before}
    for vr in after:
        rid = vr.raw.record_id
        if rid in before_map:
            bv = before_map[rid]
            if vr.raw.value != bv.raw.value:
                continue
            if vr.raw.unit != bv.raw.unit:
                continue
            if vr.standard_value != bv.standard_value:
                return False
    return True
