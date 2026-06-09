from __future__ import annotations

import json

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
    ReviewStatus,
    SamplingIntervalNote,
)


def _format_status(s: ReviewStatus) -> str:
    mapping = {
        ReviewStatus.NORMAL: "正常",
        ReviewStatus.PENDING_REVIEW: "待复核(温度单位混用)",
        ReviewStatus.SUPPLEMENTED: "已补录(旧口径)",
    }
    return mapping.get(s, s.value)


class PulleyReviewWorkflow:
    def __init__(self, equipment_id: str) -> None:
        self.equipment_id = equipment_id
        self.records: list[ReviewRecord] = []
        self.screenshots: list[ChatScreenshot] = []
        self.notes: list[SamplingIntervalNote] = []
        self.conflicts: list[ConflictEvidence] = []
        self.audit_log = AuditLog()

    def _counts(self) -> dict[str, int]:
        return {
            "normal": sum(1 for r in self.records if r.status == ReviewStatus.NORMAL),
            "pending": sum(1 for r in self.records if r.status == ReviewStatus.PENDING_REVIEW),
            "supplemented": sum(1 for r in self.records if r.status == ReviewStatus.SUPPLEMENTED),
            "conflicts": len(self.conflicts),
            "conflicts_pending": sum(1 for c in self.conflicts if c.resolution == ConflictResolution.PENDING),
            "total": len(self.records),
        }

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
        c = self._counts()
        summary_parts = [
            "设备{}滑轮组效率复核交接报告".format(self.equipment_id),
            "正常记录: {}条".format(c["normal"]),
            "待复核(含温度单位混用): {}条".format(c["pending"]),
            "旧口径补录: {}条".format(c["supplemented"]),
            "冲突: {}条".format(c["conflicts"]),
        ]
        if c["conflicts_pending"]:
            summary_parts.append("其中{}条冲突待维修师傅确认".format(c["conflicts_pending"]))
        return HandoverReport(
            id="report-{}".format(self.equipment_id),
            equipment_id=self.equipment_id,
            records=list(self.records),
            conflicts=list(self.conflicts),
            audit_entries=list(self.audit_log.entries),
            summary="; ".join(summary_parts),
        )

    def build_summary_view(self) -> dict:
        report = self.step3_update_handover_report()
        c = self._counts()
        return {
            "equipment_id": self.equipment_id,
            "counts": c,
            "summary_text": report.summary,
            "record_count": len(self.records),
            "screenshot_count": len(self.screenshots),
            "note_count": len(self.notes),
            "conflict_count": len(self.conflicts),
            "audit_count": len(self.audit_log.entries),
        }

    def build_records_list(self) -> list[dict]:
        report = self.step3_update_handover_report()
        summary = report.summary
        result = []
        for r in self.records:
            item = {
                "id": r.id,
                "equipment_id": r.equipment_id,
                "temperature_value": r.temperature_value,
                "temperature_unit": r.temperature_unit.value,
                "efficiency": r.efficiency,
                "status": r.status.value,
                "status_label": _format_status(r.status),
                "source": r.source.value,
                "note": r.note,
                "original_unit": r.original_unit.value if r.original_unit else None,
                "supplemental_source": r.supplemental_source.value if r.supplemental_source else None,
                "original_value_before_supplement": r.original_value_before_supplement,
                "original_efficiency_before_supplement": r.original_efficiency_before_supplement,
                "has_pending": r.pending_review is not None,
                "report_summary": summary,
                "recorded_at": r.recorded_at.isoformat(),
            }
            if r.pending_review:
                item["pending"] = {
                    "original_statement": r.pending_review.original_statement,
                    "suggested_value": r.pending_review.suggested_value,
                    "reason": r.pending_review.reason,
                    "next_handler": r.pending_review.next_handler,
                }
            result.append(item)
        return result

    def build_record_detail(self, record_id: str) -> dict | None:
        r = next((x for x in self.records if x.id == record_id), None)
        if r is None:
            return None
        report = self.step3_update_handover_report()
        history = self.audit_log.get_by_record(record_id)
        related_conflicts = [c for c in self.conflicts if c.screenshot_id in r.id or c.note_id in r.id]
        pending = None
        if r.pending_review:
            pending = {
                "original_statement": r.pending_review.original_statement,
                "suggested_value": r.pending_review.suggested_value,
                "reason": r.pending_review.reason,
                "next_handler": r.pending_review.next_handler,
            }
        return {
            "record": {
                "id": r.id,
                "equipment_id": r.equipment_id,
                "temperature_value": r.temperature_value,
                "temperature_unit": r.temperature_unit.value,
                "efficiency": r.efficiency,
                "status": r.status.value,
                "status_label": _format_status(r.status),
                "source": r.source.value,
                "note": r.note,
                "original_unit": r.original_unit.value if r.original_unit else None,
                "original_value_before_supplement": r.original_value_before_supplement,
                "original_efficiency_before_supplement": r.original_efficiency_before_supplement,
                "supplemental_source": r.supplemental_source.value if r.supplemental_source else None,
            },
            "pending_review": pending,
            "history": [
                {
                    "id": h.id,
                    "changed_by": h.changed_by,
                    "change_type": h.change_type,
                    "old_value": h.old_value,
                    "new_value": h.new_value,
                    "reason": h.reason,
                    "affected_results": h.affected_results,
                    "changed_at": h.changed_at.isoformat(),
                }
                for h in history
            ],
            "conflicts": [
                {
                    "screenshot_id": c.screenshot_id,
                    "note_id": c.note_id,
                    "screenshot_temp": [c.screenshot_temp[0], c.screenshot_temp[1].value],
                    "note_temp": [c.note_temp[0], c.note_temp[1].value],
                    "screenshot_efficiency": c.screenshot_efficiency,
                    "note_efficiency": c.note_efficiency,
                    "resolution": c.resolution.value,
                    "resolved_by": c.resolved_by,
                    "resolution_note": c.resolution_note,
                }
                for c in related_conflicts
            ],
            "report_summary": report.summary,
            "summary_view": self.build_summary_view(),
            "audit_total": len(self.audit_log.entries),
        }

    def export_handover_text(self) -> str:
        report = self.step3_update_handover_report()
        lines = []
        lines.append("===== " + report.summary + " =====")
        lines.append("生成时间：" + report.generated_at.isoformat())
        lines.append("")
        lines.append("-- 记录列表 ({}) --".format(len(report.records)))
        for r in report.records:
            lines.append(
                "[{}] {} {}/{} eff={} status={} src={}".format(
                    r.id, r.equipment_id, r.temperature_value, r.temperature_unit.value,
                    r.efficiency, r.status.value, r.source.value,
                )
            )
            if r.note:
                lines.append("    note: " + r.note)
            if r.pending_review:
                lines.append("    pending.original: " + r.pending_review.original_statement)
                lines.append("    pending.suggested: " + r.pending_review.suggested_value)
                lines.append("    pending.reason: " + r.pending_review.reason)
                lines.append("    pending.next: " + r.pending_review.next_handler)
        lines.append("")
        lines.append("-- 冲突证据 ({}) --".format(len(report.conflicts)))
        for c in report.conflicts:
            lines.append(
                "conflict ss={} note={} status={} by={}".format(
                    c.screenshot_id, c.note_id, c.resolution.value, c.resolved_by,
                )
            )
            lines.append(
                "  ss_temp={}{} eff={} note_temp={}{} eff={}".format(
                    c.screenshot_temp[0], c.screenshot_temp[1].value, c.screenshot_efficiency,
                    c.note_temp[0], c.note_temp[1].value, c.note_efficiency,
                )
            )
        lines.append("")
        lines.append("-- 审计日志 ({}) --".format(len(report.audit_entries)))
        for a in report.audit_entries:
            lines.append(
                "{} [{}] {} {} -> {} 原因:{}".format(
                    a.changed_at.isoformat(), a.change_type, a.changed_by,
                    a.old_value, a.new_value, a.reason,
                )
            )
        return "\n".join(lines)

    def export_handover_json(self) -> str:
        data = {
            "summary": self.build_summary_view(),
            "records": self.build_records_list(),
            "report": self.step3_update_handover_report().summary,
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    def resolve_conflict(
        self, conflict: ConflictEvidence, resolution: ConflictResolution, resolved_by: str, note: str = ""
    ) -> ConflictEvidence:
        resolved = resolve_conflict(conflict, resolution, resolved_by, note)
        self.audit_log.add(
            AuditEntry(
                id="aud-conflict-{}-{}".format(conflict.screenshot_id, conflict.note_id),
                record_id=conflict.screenshot_id,
                changed_by=resolved_by,
                change_type="conflict_resolution",
                old_value="pending",
                new_value=resolution.value,
                reason=note or "冲突处理: {}".format(resolution.value),
                affected_results=["冲突状态", "交接报告", "摘要统计"],
            )
        )
        return resolved
