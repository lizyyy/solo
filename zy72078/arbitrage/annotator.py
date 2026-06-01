from datetime import datetime
from .models import RateRecord, AnnotationEntry, AnnotationDiff


def apply_annotation(records: list, row_index: int, annotation: str, annotated_by: str = "operator") -> tuple:
    now = datetime.now().isoformat()
    target = None
    for r in records:
        if r.row_index == row_index:
            target = r
            break

    if target is None:
        raise ValueError(f"找不到行索引 {row_index} 的记录")

    old_notes = target.original_notes
    ts = now[:19]
    append_tag = "[补录@{} {}: {}]".format(ts, annotated_by, annotation)
    if old_notes:
        new_notes = "{} | {}".format(old_notes, append_tag)
    else:
        new_notes = append_tag

    before_snapshot = _snapshot_record(target)
    target.original_notes = new_notes

    entry = AnnotationEntry(
        row_index=row_index,
        annotation=annotation,
        annotated_at=now,
        annotated_by=annotated_by,
    )

    after_snapshot = _snapshot_record(target)
    diffs = _compute_diffs(row_index, before_snapshot, after_snapshot, now)

    return target, entry, diffs


def _snapshot_record(r: RateRecord) -> dict:
    return {
        "from_currency": r.from_currency,
        "to_currency": r.to_currency,
        "rate": r.rate,
        "unit": r.unit,
        "original_source": r.original_source,
        "original_notes": r.original_notes,
        "compute_status": r.compute_status,
    }


def _compute_diffs(row_index: int, before: dict, after: dict, now: str) -> list:
    diffs = []
    for field in before:
        b = str(before[field])
        a = str(after[field])
        if b != a:
            explanation = _explain_change(field, b, a)
            diffs.append(AnnotationDiff(
                row_index=row_index,
                field=field,
                before=b,
                after=a,
                explanation=explanation,
                diff_timestamp=now,
            ))
    return diffs


def _explain_change(field: str, before: str, after: str) -> str:
    if field == "original_notes":
        added = after.replace(before, "").strip()
        if added.startswith("|"):
            added = added[1:].strip()
        return f"备注补录: 新增内容 '{added}'，原始备注 '{before}' 未被覆盖，以追加方式保留"
    if field == "compute_status":
        return f"计算状态从 '{before}' 变为 '{after}'，补录可能导致该记录重新可计算"
    return f"字段 {field} 从 '{before}' 变为 '{after}'"
