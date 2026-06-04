from __future__ import annotations

from .audit import AuditLog
from .conflict import detect_conflicts, resolve_conflict
from .engine import import_chat_screenshot, supplement_from_sampling_note
from .models import (
    AuditEntry,
    ChatScreenshot,
    ConflictEvidence,
    ConflictResolution,
    HandoverReport,
    ReviewRecord,
    SamplingIntervalNote,
)


class PulleyReviewWorkflow:
    def __init__(self, equipment_id: str) -> None:
        self.equipment_id = equipment_id
        self.records: list[ReviewRecord] = []
        self.screenshots: list[ChatScreenshot] = []
        self.notes: list[SamplingIntervalNote] = []
        self.conflicts: list[ConflictEvidence] = []
        self.audit_log = AuditLog()

    def step1_import_screenshot(self, screenshot: ChatScreenshot) -> ReviewRecord:
        record, entries = import_chat_screenshot(screenshot, self.records)
        self.records.append(record)
        self.screenshots.append(screenshot)
        for entry in entries:
            self.audit_log.add(entry)
        return record

    def step2_review_sampling_note(
        self, note: SamplingIntervalNote, target_record_id: str, operator: str = "老岑"
    ) -> ReviewRecord | None:
        target = next((r for r in self.records if r.id == target_record_id), None)
        if target is None:
            return None
        self.notes.append(note)
        new_conflicts = detect_conflicts(
            [s for s in self.screenshots if s.equipment_id == note.equipment_id],
            [note],
        )
        for c in new_conflicts:
            self.conflicts.append(c)
        record, entries = supplement_from_sampling_note(note, target, operator)
        for entry in entries:
            self.audit_log.add(entry)
        return record

    def step3_update_handover_report(self) -> HandoverReport:
        normal = sum(1 for r in self.records if r.status.value == "normal")
        pending = sum(1 for r in self.records if r.status.value == "pending_review")
        supplemented = sum(1 for r in self.records if r.status.value == "supplemented")
        summary_parts = [
            f"设备{self.equipment_id}滑轮组效率复核交接报告",
            f"正常记录: {normal}条",
            f"待复核(含温度单位混用): {pending}条",
            f"旧口径补录: {supplemented}条",
            f"冲突: {len(self.conflicts)}条",
        ]
        if self.conflicts:
            unresolved = [c for c in self.conflicts if c.resolution.value == "pending"]
            if unresolved:
                summary_parts.append(f"其中{len(unresolved)}条冲突待维修师傅确认")
        return HandoverReport(
            id=f"report-{self.equipment_id}",
            equipment_id=self.equipment_id,
            records=list(self.records),
            conflicts=list(self.conflicts),
            audit_entries=self.audit_log.entries,
            summary="; ".join(summary_parts),
        )

    def resolve_conflict(
        self, conflict: ConflictEvidence, resolution: ConflictResolution, resolved_by: str, note: str = ""
    ) -> ConflictEvidence:
        resolved = resolve_conflict(conflict, resolution, resolved_by, note)
        self.audit_log.add(
            AuditEntry(
                id=f"aud-conflict-{conflict.screenshot_id}-{conflict.note_id}",
                record_id=conflict.screenshot_id,
                changed_by=resolved_by,
                change_type="conflict_resolution",
                old_value="pending",
                new_value=resolution.value,
                reason=note or f"冲突处理: {resolution.value}",
                affected_results=["冲突状态", "交接报告"],
            )
        )
        return resolved
