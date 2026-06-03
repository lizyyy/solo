from __future__ import annotations

import uuid
from datetime import datetime

from .models import AuditEntry, SensitivityResult, ErrorExplanation


def record_import(
    operator: str,
    row_count: int,
    affected_result_ids: list[str] | None = None,
) -> AuditEntry:
    return AuditEntry(
        entry_id=str(uuid.uuid4())[:8],
        operator=operator,
        action=f"导入了{row_count}条问卷原始行",
        reason="首次导入问卷原始行数据",
        affected_result_ids=affected_result_ids or [],
        timestamp=datetime.now(),
    )


def record_boundary_review(
    operator: str,
    note_count: int,
    affected_result_ids: list[str],
) -> AuditEntry:
    return AuditEntry(
        entry_id=str(uuid.uuid4())[:8],
        operator=operator,
        action=f"补看了{note_count}条边界值说明",
        reason="教研负责人补录现场说法与先验约束",
        affected_result_ids=affected_result_ids,
        timestamp=datetime.now(),
    )


def record_error_update(
    operator: str,
    explanation_count: int,
    affected_result_ids: list[str],
) -> AuditEntry:
    return AuditEntry(
        entry_id=str(uuid.uuid4())[:8],
        operator=operator,
        action=f"更新了{explanation_count}条误差说明",
        reason="边界值说明变更后重新生成误差说明",
        affected_result_ids=affected_result_ids,
        timestamp=datetime.now(),
    )


def record_manual_correction(
    operator: str,
    result_id: str,
    field: str,
    old_value: str,
    new_value: str,
    reason: str,
    cascaded_result_ids: list[str] | None = None,
) -> AuditEntry:
    return AuditEntry(
        entry_id=str(uuid.uuid4())[:8],
        operator=operator,
        action=f"人工修正：结果{result_id}的{field}从「{old_value}」改为「{new_value}」",
        reason=reason,
        before_snapshot=f"{field}={old_value}",
        after_snapshot=f"{field}={new_value}",
        affected_result_ids=[result_id] + (cascaded_result_ids or []),
        timestamp=datetime.now(),
    )


def record_rerun(
    operator: str,
    result_count: int,
    reason: str,
    affected_result_ids: list[str],
) -> AuditEntry:
    return AuditEntry(
        entry_id=str(uuid.uuid4())[:8],
        operator=operator,
        action=f"重跑试算，共{result_count}条结果",
        reason=reason,
        affected_result_ids=affected_result_ids,
        timestamp=datetime.now(),
    )


def format_audit_trail(entries: list[AuditEntry]) -> str:
    lines: list[str] = []
    for e in entries:
        ts = e.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"[{ts}] {e.operator} {e.action}")
        lines.append(f"  原因：{e.reason}")
        if e.before_snapshot or e.after_snapshot:
            lines.append(f"  修改前：{e.before_snapshot}")
            lines.append(f"  修改后：{e.after_snapshot}")
        if e.affected_result_ids:
            ids = "、".join(e.affected_result_ids[:10])
            lines.append(f"  影响结果：{ids}")
        lines.append("")
    return "\n".join(lines)
