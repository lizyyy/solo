import pathlib

BASE = pathlib.Path("/Users/lzy/pro/solo/workspaces/zy72361")

files = {}

files["pulley_review/models.py"] = r'''from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class TempUnit(str, Enum):
    CELSIUS = "celsius"
    KELVIN = "kelvin"


class RecordSource(str, Enum):
    CHAT_SCREENSHOT = "chat_screenshot"
    SAMPLING_INTERVAL_NOTE = "sampling_interval_note"


class ReviewStatus(str, Enum):
    NORMAL = "normal"
    PENDING_REVIEW = "pending_review"
    SUPPLEMENTED = "supplemented"


class ConflictResolution(str, Enum):
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    PENDING = "pending"


@dataclass
class ReviewRecord:
    id: str
    equipment_id: str
    temperature_value: float
    temperature_unit: TempUnit
    efficiency: float
    source: RecordSource
    status: ReviewStatus = ReviewStatus.NORMAL
    recorded_at: datetime = field(default_factory=datetime.now)
    reviewed_by: Optional[str] = None
    original_unit: Optional[TempUnit] = None
    supplemental_source: Optional[RecordSource] = None
    note: str = ""


@dataclass
class ChatScreenshot:
    id: str
    equipment_id: str
    temperature_value: float
    temperature_unit: TempUnit
    efficiency: float
    captured_at: datetime = field(default_factory=datetime.now)
    imported: bool = False


@dataclass
class SamplingIntervalNote:
    id: str
    equipment_id: str
    temperature_value: float
    temperature_unit: TempUnit
    efficiency: float
    interval_seconds: int
    documented_at: datetime = field(default_factory=datetime.now)
    is_old_caliber: bool = False


@dataclass
class ConflictEvidence:
    screenshot_id: str
    note_id: str
    equipment_id: str
    screenshot_temp: tuple[float, TempUnit]
    note_temp: tuple[float, TempUnit]
    screenshot_efficiency: float
    note_efficiency: float
    resolution: ConflictResolution = ConflictResolution.PENDING
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_note: str = ""


@dataclass
class AuditEntry:
    id: str
    record_id: str
    changed_by: str
    change_type: str
    old_value: str
    new_value: str
    reason: str
    affected_results: list[str] = field(default_factory=list)
    changed_at: datetime = field(default_factory=datetime.now)


@dataclass
class HandoverReport:
    id: str
    equipment_id: str
    records: list[ReviewRecord] = field(default_factory=list)
    conflicts: list[ConflictEvidence] = field(default_factory=list)
    audit_entries: list[AuditEntry] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    summary: str = ""
'''

files["pulley_review/engine.py"] = r'''from __future__ import annotations

from datetime import datetime

from .models import (
    AuditEntry,
    ChatScreenshot,
    RecordSource,
    ReviewRecord,
    ReviewStatus,
    SamplingIntervalNote,
    TempUnit,
)


def _is_celsius_kelvin_mixed(
    value: float, unit: TempUnit, context_records: list[ReviewRecord]
) -> bool:
    for rec in context_records:
        if rec.equipment_id and rec.temperature_unit != unit:
            return True
    return False


def _celsius_to_kelvin(celsius: float) -> float:
    return celsius + 273.15


def _kelvin_to_celsius(kelvin: float) -> float:
    return kelvin - 273.15


def import_chat_screenshot(
    screenshot: ChatScreenshot,
    existing_records: list[ReviewRecord],
) -> tuple[ReviewRecord, list[AuditEntry]]:
    audit_entries: list[AuditEntry] = []
    mixed = _is_celsius_kelvin_mixed(
        screenshot.temperature_value, screenshot.temperature_unit, existing_records
    )

    if mixed:
        status = ReviewStatus.PENDING_REVIEW
        note = "摄氏度与开尔文混用，留待训练教练复核"
    else:
        status = ReviewStatus.NORMAL
        note = ""

    record = ReviewRecord(
        id=f"rec-{screenshot.id}",
        equipment_id=screenshot.equipment_id,
        temperature_value=screenshot.temperature_value,
        temperature_unit=screenshot.temperature_unit,
        efficiency=screenshot.efficiency,
        source=RecordSource.CHAT_SCREENSHOT,
        status=status,
        note=note,
    )

    if mixed:
        audit_entries.append(
            AuditEntry(
                id=f"aud-{screenshot.id}-mixed",
                record_id=record.id,
                changed_by="system",
                change_type="status_set",
                old_value="normal",
                new_value="pending_review",
                reason="检测到摄氏度与开尔文混用，不自动归正常",
                affected_results=["效率复核结果", "交接报告"],
            )
        )

    screenshot.imported = True
    return record, audit_entries


def supplement_from_sampling_note(
    note: SamplingIntervalNote,
    target_record: ReviewRecord,
    operator: str = "老岑",
) -> tuple[ReviewRecord, list[AuditEntry]]:
    audit_entries: list[AuditEntry] = []

    old_status = target_record.status
    old_unit = target_record.temperature_unit
    old_value = target_record.temperature_value

    if note.is_old_caliber:
        target_record.status = ReviewStatus.SUPPLEMENTED
        target_record.supplemental_source = RecordSource.SAMPLING_INTERVAL_NOTE
        target_record.original_unit = old_unit
        target_record.temperature_unit = note.temperature_unit
        target_record.temperature_value = note.temperature_value
        target_record.efficiency = note.efficiency
        target_record.note = f"旧口径补录，来源：采样间隔说明({note.id})"

        audit_entries.append(
            AuditEntry(
                id=f"aud-{target_record.id}-supplement",
                record_id=target_record.id,
                changed_by=operator,
                change_type="supplement_old_caliber",
                old_value=f"{old_value}{old_unit.value}/eff={target_record.efficiency}",
                new_value=f"{note.temperature_value}{note.temperature_unit.value}/eff={note.efficiency}",
                reason=f"从采样间隔说明({note.id})补录旧口径数据",
                affected_results=["效率值", "温度值", "交接报告"],
            )
        )
        audit_entries.append(
            AuditEntry(
                id=f"aud-{target_record.id}-status",
                record_id=target_record.id,
                changed_by=operator,
                change_type="status_change",
                old_value=old_status.value,
                new_value=ReviewStatus.SUPPLEMENTED.value,
                reason="旧口径数据补录",
                affected_results=["复核状态"],
            )
        )
    else:
        target_record.supplemental_source = RecordSource.SAMPLING_INTERVAL_NOTE
        audit_entries.append(
            AuditEntry(
                id=f"aud-{target_record.id}-ref",
                record_id=target_record.id,
                changed_by=operator,
                change_type="reference_added",
                old_value="",
                new_value=f"sampling_interval_note:{note.id}",
                reason=f"补充采样间隔说明({note.id})作为参考",
                affected_results=["参考资料"],
            )
        )

    return target_record, audit_entries
'''

files["pulley_review/conflict.py"] = r'''from __future__ import annotations

from datetime import datetime

from .models import (
    ChatScreenshot,
    ConflictEvidence,
    ConflictResolution,
    SamplingIntervalNote,
    TempUnit,
)


def _temps_conflict(
    s_val: float, s_unit: TempUnit, n_val: float, n_unit: TempUnit, tolerance: float = 0.5
) -> bool:
    if s_unit == n_unit:
        return abs(s_val - n_val) > tolerance

    if s_unit == TempUnit.CELSIUS and n_unit == TempUnit.KELVIN:
        return abs(s_val + 273.15 - n_val) > tolerance
    if s_unit == TempUnit.KELVIN and n_unit == TempUnit.CELSIUS:
        return abs(s_val - 273.15 - n_val) > tolerance

    return True


def _efficiency_conflict(s_eff: float, n_eff: float, tolerance: float = 0.01) -> bool:
    return abs(s_eff - n_eff) > tolerance


def detect_conflicts(
    screenshots: list[ChatScreenshot],
    notes: list[SamplingIntervalNote],
) -> list[ConflictEvidence]:
    conflicts: list[ConflictEvidence] = []

    for ss in screenshots:
        for note in notes:
            if ss.equipment_id != note.equipment_id:
                continue

            temp_conflict = _temps_conflict(
                ss.temperature_value, ss.temperature_unit,
                note.temperature_value, note.temperature_unit,
            )
            eff_conflict = _efficiency_conflict(ss.efficiency, note.efficiency)

            if temp_conflict or eff_conflict:
                conflicts.append(
                    ConflictEvidence(
                        screenshot_id=ss.id,
                        note_id=note.id,
                        equipment_id=ss.equipment_id,
                        screenshot_temp=(ss.temperature_value, ss.temperature_unit),
                        note_temp=(note.temperature_value, note.temperature_unit),
                        screenshot_efficiency=ss.efficiency,
                        note_efficiency=note.efficiency,
                    )
                )

    return conflicts


def resolve_conflict(
    conflict: ConflictEvidence,
    resolution: ConflictResolution,
    resolved_by: str,
    note: str = "",
) -> ConflictEvidence:
    conflict.resolution = resolution
    conflict.resolved_by = resolved_by
    conflict.resolved_at = datetime.now()
    conflict.resolution_note = note
    return conflict
'''

files["pulley_review/workflow.py"] = r'''from __future__ import annotations

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
'''

files["pulley_review/audit.py"] = r'''from __future__ import annotations

from .models import AuditEntry


class AuditLog:
    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []

    def add(self, entry: AuditEntry) -> None:
        self.entries.append(entry)

    def get_by_record(self, record_id: str) -> list[AuditEntry]:
        return [e for e in self.entries if e.record_id == record_id]

    def get_by_operator(self, operator: str) -> list[AuditEntry]:
        return [e for e in self.entries if e.changed_by == operator]

    def get_by_change_type(self, change_type: str) -> list[AuditEntry]:
        return [e for e in self.entries if e.change_type == change_type]

    def format_changelog(self) -> list[dict]:
        result = []
        for e in self.entries:
            result.append(
                {
                    "who": e.changed_by,
                    "what": f"{e.change_type}: {e.old_value} -> {e.new_value}",
                    "why": e.reason,
                    "impact": e.affected_results,
                    "when": e.changed_at.isoformat(),
                }
            )
        return result
'''

files["pulley_review/sample_data.py"] = r'''from __future__ import annotations

from datetime import datetime

from .models import (
    ChatScreenshot,
    SamplingIntervalNote,
    TempUnit,
)


def make_normal_screenshot() -> ChatScreenshot:
    return ChatScreenshot(
        id="ss-normal-001",
        equipment_id="PULLEY-A01",
        temperature_value=25.0,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.92,
        captured_at=datetime(2026, 5, 28, 10, 30, 0),
    )


def make_mixed_unit_screenshot() -> ChatScreenshot:
    return ChatScreenshot(
        id="ss-mixed-002",
        equipment_id="PULLEY-A01",
        temperature_value=298.15,
        temperature_unit=TempUnit.KELVIN,
        efficiency=0.89,
        captured_at=datetime(2026, 5, 29, 14, 15, 0),
    )


def make_old_caliber_note() -> SamplingIntervalNote:
    return SamplingIntervalNote(
        id="note-old-003",
        equipment_id="PULLEY-A01",
        temperature_value=26.5,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.88,
        interval_seconds=300,
        documented_at=datetime(2026, 5, 20, 9, 0, 0),
        is_old_caliber=True,
    )


def make_conflicting_note() -> SamplingIntervalNote:
    return SamplingIntervalNote(
        id="note-conflict-004",
        equipment_id="PULLEY-A01",
        temperature_value=35.0,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.75,
        interval_seconds=600,
        documented_at=datetime(2026, 5, 27, 11, 0, 0),
        is_old_caliber=False,
    )
'''

files["tests/test_review.py"] = r'''from __future__ import annotations

from datetime import datetime

import pytest

from pulley_review.conflict import detect_conflicts, resolve_conflict
from pulley_review.engine import import_chat_screenshot, supplement_from_sampling_note
from pulley_review.models import (
    ChatScreenshot,
    ConflictResolution,
    HandoverReport,
    RecordSource,
    ReviewRecord,
    ReviewStatus,
    SamplingIntervalNote,
    TempUnit,
)
from pulley_review.sample_data import (
    make_conflicting_note,
    make_mixed_unit_screenshot,
    make_normal_screenshot,
    make_old_caliber_note,
)
from pulley_review.workflow import PulleyReviewWorkflow


class TestNormalRecord:
    def test_normal_import(self):
        ss = make_normal_screenshot()
        record, audits = import_chat_screenshot(ss, [])
        assert record.status == ReviewStatus.NORMAL
        assert record.source == RecordSource.CHAT_SCREENSHOT
        assert len(audits) == 0
        assert ss.imported is True

    def test_normal_in_workflow(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss = make_normal_screenshot()
        record = wf.step1_import_screenshot(ss)
        assert record.status == ReviewStatus.NORMAL
        report = wf.step3_update_handover_report()
        assert len(report.records) == 1
        assert "正常记录: 1条" in report.summary


class TestMixedUnitRecord:
    def test_mixed_unit_detected(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss_normal = make_normal_screenshot()
        ss_mixed = make_mixed_unit_screenshot()

        r1 = wf.step1_import_screenshot(ss_normal)
        assert r1.status == ReviewStatus.NORMAL

        r2 = wf.step1_import_screenshot(ss_mixed)
        assert r2.status == ReviewStatus.PENDING_REVIEW
        assert "混用" in r2.note

    def test_mixed_unit_not_auto_normalized(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss_normal = make_normal_screenshot()
        ss_mixed = make_mixed_unit_screenshot()

        wf.step1_import_screenshot(ss_normal)
        r2 = wf.step1_import_screenshot(ss_mixed)

        assert r2.temperature_unit == TempUnit.KELVIN
        assert r2.temperature_value == 298.15
        assert r2.status == ReviewStatus.PENDING_REVIEW

    def test_mixed_unit_audit_trail(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss_normal = make_normal_screenshot()
        ss_mixed = make_mixed_unit_screenshot()

        wf.step1_import_screenshot(ss_normal)
        r2 = wf.step1_import_screenshot(ss_mixed)

        audits = wf.audit_log.get_by_record(r2.id)
        assert len(audits) == 1
        assert audits[0].change_type == "status_set"
        assert "混用" in audits[0].reason


class TestOldCaliberSupplement:
    def test_supplement_from_note(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss = make_normal_screenshot()
        record = wf.step1_import_screenshot(ss)

        note = make_old_caliber_note()
        updated = wf.step2_review_sampling_note(note, record.id, "老岑")

        assert updated is not None
        assert updated.status == ReviewStatus.SUPPLEMENTED
        assert updated.supplemental_source == RecordSource.SAMPLING_INTERVAL_NOTE
        assert updated.original_unit == TempUnit.CELSIUS
        assert updated.temperature_value == 26.5
        assert updated.efficiency == 0.88

    def test_supplement_audit(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss = make_normal_screenshot()
        record = wf.step1_import_screenshot(ss)

        note = make_old_caliber_note()
        wf.step2_review_sampling_note(note, record.id, "老岑")

        audits = wf.audit_log.get_by_operator("老岑")
        assert len(audits) >= 1
        supplement_audits = [a for a in audits if a.change_type == "supplement_old_caliber"]
        assert len(supplement_audits) == 1
        assert "旧口径" in supplement_audits[0].reason


class TestThreeDifferentResults:
    def test_three_record_types_produce_different_statuses(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")

        ss_normal = make_normal_screenshot()
        r1 = wf.step1_import_screenshot(ss_normal)

        ss_mixed = make_mixed_unit_screenshot()
        r2 = wf.step1_import_screenshot(ss_mixed)

        note = make_old_caliber_note()
        r3 = wf.step2_review_sampling_note(note, r1.id, "老岑")

        statuses = {r1.status, r2.status, r3.status}
        assert r1.status == ReviewStatus.SUPPLEMENTED
        assert r2.status == ReviewStatus.PENDING_REVIEW
        assert r3.status == ReviewStatus.SUPPLEMENTED
        assert ReviewStatus.PENDING_REVIEW in statuses


class TestConflictDetection:
    def test_conflict_between_screenshot_and_note(self):
        ss = make_mixed_unit_screenshot()
        note = make_conflicting_note()
        conflicts = detect_conflicts([ss], [note])
        assert len(conflicts) >= 1
        assert conflicts[0].screenshot_id == ss.id
        assert conflicts[0].note_id == note.id

    def test_no_conflict_when_consistent(self):
        ss = make_normal_screenshot()
        note = SamplingIntervalNote(
            id="note-ok",
            equipment_id="PULLEY-A01",
            temperature_value=25.2,
            temperature_unit=TempUnit.CELSIUS,
            efficiency=0.92,
            interval_seconds=300,
            is_old_caliber=False,
        )
        conflicts = detect_conflicts([ss], [note])
        assert len(conflicts) == 0

    def test_conflict_resolution_requires_human(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss = make_mixed_unit_screenshot()
        wf.step1_import_screenshot(ss)

        note = make_conflicting_note()
        wf.step2_review_sampling_note(note, wf.records[0].id, "老岑")

        assert len(wf.conflicts) >= 1
        assert wf.conflicts[0].resolution == ConflictResolution.PENDING

        resolved = wf.resolve_conflict(
            wf.conflicts[0],
            ConflictResolution.CONFIRMED,
            "老岑",
            "确认以采样间隔说明为准",
        )
        assert resolved.resolution == ConflictResolution.CONFIRMED
        assert resolved.resolved_by == "老岑"


class TestHandoverReportConsistency:
    def test_report_matches_history(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")

        ss1 = make_normal_screenshot()
        r1 = wf.step1_import_screenshot(ss1)

        ss2 = make_mixed_unit_screenshot()
        r2 = wf.step1_import_screenshot(ss2)

        note = make_old_caliber_note()
        wf.step2_review_sampling_note(note, r1.id, "老岑")

        report = wf.step3_update_handover_report()

        record_ids_in_report = {r.id for r in report.records}
        record_ids_in_workflow = {r.id for r in wf.records}
        assert record_ids_in_report == record_ids_in_workflow

        audit_ids_in_report = {a.id for a in report.audit_entries}
        audit_ids_in_workflow = {a.id for a in wf.audit_log.entries}
        assert audit_ids_in_report == audit_ids_in_workflow

    def test_report_summarizes_all_types(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")

        ss1 = make_normal_screenshot()
        r1 = wf.step1_import_screenshot(ss1)

        ss2 = make_mixed_unit_screenshot()
        wf.step1_import_screenshot(ss2)

        note = make_old_caliber_note()
        wf.step2_review_sampling_note(note, r1.id, "老岑")

        report = wf.step3_update_handover_report()
        assert "正常记录" not in report.summary or "旧口径补录" in report.summary
        assert "待复核" in report.summary


class TestThreeStepWorkflow:
    def test_full_three_step_flow(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")

        ss = make_mixed_unit_screenshot()
        r1 = wf.step1_import_screenshot(ss)
        assert r1.status == ReviewStatus.PENDING_REVIEW
        assert len(wf.screenshots) == 1
        assert len(wf.records) == 1

        note = make_old_caliber_note()
        updated = wf.step2_review_sampling_note(note, r1.id, "老岑")
        assert updated is not None
        assert len(wf.notes) == 1

        report = wf.step3_update_handover_report()
        assert isinstance(report, HandoverReport)
        assert len(report.records) == 1
        assert report.equipment_id == "PULLEY-A01"

    def test_celsius_kelvin_stays_pending_through_flow(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")

        ss_normal = make_normal_screenshot()
        wf.step1_import_screenshot(ss_normal)

        ss_mixed = make_mixed_unit_screenshot()
        r2 = wf.step1_import_screenshot(ss_mixed)

        note = make_old_caliber_note()
        wf.step2_review_sampling_note(note, wf.records[0].id, "老岑")

        assert r2.status == ReviewStatus.PENDING_REVIEW
        assert "混用" in r2.note

        changelog = wf.audit_log.format_changelog()
        mixed_entries = [e for e in changelog if "混用" in e["why"]]
        assert len(mixed_entries) >= 1
'''

for rel_path, content in files.items():
    path = BASE / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"Wrote {path} ({len(content.splitlines())} lines)")

print("\nAll files written successfully.")
