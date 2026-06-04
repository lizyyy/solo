from __future__ import annotations

from datetime import datetime
from typing import Optional

from .models import Annotation, ChangeRecord, ImportBatch
from .rules import AnnotationSource, ReviewStatus
from .store import Store
from .engine import detect_edge_case, apply_boundary_rule


class ImportResult:
    def __init__(self, batch: ImportBatch, changes: list[ChangeRecord],
                 flagged: list[Annotation]):
        self.batch = batch
        self.changes = changes
        self.flagged = flagged

    def summary(self) -> str:
        lines = [
            f"导入批次: {self.batch.id}",
            f"来源: {self.batch.source.value}",
            f"总行数: {self.batch.total_rows}",
            f"新增: {self.batch.new_count}",
            f"未变: {self.batch.unchanged_count}",
            f"改动: {self.batch.changed_count}",
            f"跳过重复: {self.batch.skipped_duplicate_count}",
            f"标记待复核: {self.batch.flagged_count}",
        ]
        if self.flagged:
            lines.append("")
            lines.append("⚠ 标记待复核的条目:")
            for ann in self.flagged:
                lines.append(
                    f"  行{ann.original_line_number} [{ann.item_name}] "
                    f"边界类型={ann.edge_case_type} "
                    f"原始值='{ann.original_value}' 当前值='{ann.current_value}'"
                )
        if self.changes:
            lines.append("")
            lines.append("变更记录:")
            for ch in self.changes:
                lines.append(
                    f"  批注ID={ch.annotation_id} 字段={ch.field_name} "
                    f"'{ch.old_value}' → '{ch.new_value}' 原因={ch.reason}"
                )
        return "\n".join(lines)


def import_annotations(
    store: Store,
    rows: list[dict],
    source: AnnotationSource = AnnotationSource.TEACHER_ANNOTATION,
    changed_by: str = "system",
) -> ImportResult:
    batch = ImportBatch(source=source, total_rows=len(rows))
    store.save_batch(batch)

    changes: list[ChangeRecord] = []
    flagged: list[Annotation] = []

    for row in rows:
        line_number = row.get("line_number", 0)
        item_name = row.get("item_name", "")
        category = row.get("category", "")
        value = row.get("value", "")
        denominator_raw = row.get("denominator", "")
        numerator_raw = row.get("numerator", "")

        existing = store.find_annotation_by_line(line_number, source)

        ann = Annotation(
            source=source,
            original_line_number=line_number,
            original_value=value,
            current_value=value,
            item_name=item_name,
            category=category,
            denominator_raw=str(denominator_raw),
            numerator_raw=str(numerator_raw),
            import_batch_id=batch.id,
        )

        edge_type = detect_edge_case(ann)
        if edge_type:
            ann = apply_boundary_rule(ann, edge_type)
            if ann.status == ReviewStatus.FLAGGED:
                flagged.append(ann)

        if existing is not None:
            diff_fields = _diff_annotations(existing, ann)
            if not diff_fields:
                batch.unchanged_count += 1
                continue

            batch.changed_count += 1
            for field_name, (old_val, new_val) in diff_fields.items():
                ch = ChangeRecord(
                    annotation_id=existing.id,
                    field_name=field_name,
                    old_value=str(old_val),
                    new_value=str(new_val),
                    changed_by=changed_by,
                    reason=f"reimport_diff: {field_name} changed",
                    import_batch_id=batch.id,
                )
                changes.append(ch)
                store.save_change(ch)

                setattr(existing, field_name, new_val)

            existing.updated_at = datetime.now().isoformat()
            if edge_type and ann.is_edge_case:
                existing.is_edge_case = True
                existing.edge_case_type = ann.edge_case_type
                existing.status = ann.status
            store.save_annotation(existing, batch.id)
        else:
            batch.new_count += 1
            ann.import_batch_id = batch.id
            store.save_annotation(ann, batch.id)

    batch.flagged_count = len(flagged)
    store.save_batch(batch)

    return ImportResult(batch=batch, changes=changes, flagged=flagged)


def _diff_annotations(old: Annotation, new: Annotation) -> dict[str, tuple]:
    diff: dict[str, tuple] = {}
    compare_fields = [
        "current_value", "item_name", "category",
        "denominator_raw", "numerator_raw",
    ]
    for field in compare_fields:
        old_val = getattr(old, field)
        new_val = getattr(new, field)
        if str(old_val) != str(new_val):
            diff[field] = (old_val, new_val)
    return diff
