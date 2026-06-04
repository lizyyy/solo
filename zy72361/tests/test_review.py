from __future__ import annotations

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
        assert r1.status == ReviewStatus.SUPPLEMENTED
        assert r2.status == ReviewStatus.PENDING_REVIEW
        statuses = {r1.status, r2.status}
        assert ReviewStatus.PENDING_REVIEW in statuses
        assert ReviewStatus.SUPPLEMENTED in statuses


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
        ss_normal = make_normal_screenshot()
        wf.step1_import_screenshot(ss_normal)
        ss_mixed = make_mixed_unit_screenshot()
        wf.step1_import_screenshot(ss_mixed)
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
        wf.step1_import_screenshot(ss2)
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
        assert "待复核" in report.summary


class TestThreeStepWorkflow:
    def test_full_three_step_flow(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss_normal = make_normal_screenshot()
        r0 = wf.step1_import_screenshot(ss_normal)
        ss_mixed = make_mixed_unit_screenshot()
        r1 = wf.step1_import_screenshot(ss_mixed)
        assert r1.status == ReviewStatus.PENDING_REVIEW
        assert len(wf.screenshots) == 2
        assert len(wf.records) == 2
        note = make_old_caliber_note()
        updated = wf.step2_review_sampling_note(note, r0.id, "老岑")
        assert updated is not None
        assert len(wf.notes) == 1
        report = wf.step3_update_handover_report()
        assert isinstance(report, HandoverReport)
        assert len(report.records) == 2
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
