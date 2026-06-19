from __future__ import annotations

from datetime import datetime

import pytest

from pulley_review.conflict import detect_conflicts, resolve_conflict
from pulley_review.engine import create_supplemented_record, import_chat_screenshot, supplement_from_sampling_note
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
    def test_create_supplemented_record(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss = make_normal_screenshot()
        record = wf.step1_import_screenshot(ss)
        note = make_old_caliber_note()
        new_record = wf.step2_create_supplemented(note, "老岑", record.id)
        assert new_record is not None
        assert new_record.status == ReviewStatus.SUPPLEMENTED
        assert new_record.supplemental_source == RecordSource.SAMPLING_INTERVAL_NOTE
        assert new_record.original_unit == TempUnit.CELSIUS
        assert new_record.temperature_value == 26.5
        assert new_record.efficiency == 0.88
        assert new_record.related_screenshot_id == record.id
        assert new_record.id.startswith("rec-suppl-")
        assert record.status == ReviewStatus.NORMAL
        assert len(wf.records) == 2

    def test_supplement_audit(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss = make_normal_screenshot()
        record = wf.step1_import_screenshot(ss)
        note = make_old_caliber_note()
        wf.step2_create_supplemented(note, "老岑", record.id)
        audits = wf.audit_log.get_by_operator("老岑")
        assert len(audits) >= 2
        supplement_audits = [a for a in audits if a.change_type == "supplement_new_record"]
        assert len(supplement_audits) == 1
        assert "旧口径" in supplement_audits[0].reason
        status_audits = [a for a in audits if a.change_type == "status_set"]
        assert len(status_audits) >= 1


class TestThreeDifferentResults:
    def test_three_record_types_produce_different_statuses(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss_normal = make_normal_screenshot()
        r1 = wf.step1_import_screenshot(ss_normal)
        ss_mixed = make_mixed_unit_screenshot()
        r2 = wf.step1_import_screenshot(ss_mixed)
        note = make_old_caliber_note()
        r3 = wf.step2_create_supplemented(note, "老岑", r1.id)
        assert r1.status == ReviewStatus.NORMAL
        assert r2.status == ReviewStatus.PENDING_REVIEW
        assert r3.status == ReviewStatus.SUPPLEMENTED
        statuses = {r1.status, r2.status, r3.status}
        assert ReviewStatus.NORMAL in statuses
        assert ReviewStatus.PENDING_REVIEW in statuses
        assert ReviewStatus.SUPPLEMENTED in statuses
        assert len(wf.records) == 3


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
        wf.step2_create_supplemented(note, "老岑", r1.id)
        report = wf.step3_update_handover_report()
        record_ids_in_report = {r.id for r in report.records}
        record_ids_in_workflow = {r.id for r in wf.records}
        assert record_ids_in_report == record_ids_in_workflow
        audit_ids_in_report = {a.id for a in report.audit_entries}
        audit_ids_in_workflow = {a.id for a in wf.audit_log.entries}
        assert audit_ids_in_report == audit_ids_in_workflow
        assert len(report.records) == 3

    def test_report_summarizes_all_types(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss1 = make_normal_screenshot()
        r1 = wf.step1_import_screenshot(ss1)
        ss2 = make_mixed_unit_screenshot()
        wf.step1_import_screenshot(ss2)
        note = make_old_caliber_note()
        wf.step2_create_supplemented(note, "老岑", r1.id)
        report = wf.step3_update_handover_report()
        assert "待复核" in report.summary
        assert "正常记录: 1条" in report.summary
        assert "旧口径补录: 1条" in report.summary


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
        new_record = wf.step2_create_supplemented(note, "老岑", r0.id)
        assert new_record is not None
        assert new_record.status == ReviewStatus.SUPPLEMENTED
        assert len(wf.notes) == 1
        assert len(wf.records) == 3
        report = wf.step3_update_handover_report()
        assert isinstance(report, HandoverReport)
        assert len(report.records) == 3
        assert report.equipment_id == "PULLEY-A01"

    def test_celsius_kelvin_stays_pending_through_flow(self):
        wf = PulleyReviewWorkflow("PULLEY-A01")
        ss_normal = make_normal_screenshot()
        wf.step1_import_screenshot(ss_normal)
        ss_mixed = make_mixed_unit_screenshot()
        r2 = wf.step1_import_screenshot(ss_mixed)
        note = make_old_caliber_note()
        wf.step2_create_supplemented(note, "老岑", wf.records[0].id)
        assert r2.status == ReviewStatus.PENDING_REVIEW
        assert "混用" in r2.note
        changelog = wf.audit_log.format_changelog()
        mixed_entries = [e for e in changelog if "混用" in e["why"]]
        assert len(mixed_entries) >= 1


class TestWebInteractionPath:
    def test_webcalc_summary_normal_consistent_across_views(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        assert a.status == ReviewStatus.NORMAL
        assert b.status == ReviewStatus.PENDING_REVIEW
        assert b.pending_review is not None
        assert "训练教练" in b.pending_review.next_handler
        c = wf._counts()
        assert c["normal"] == 1
        assert c["pending"] == 1
        assert c["supplemented"] == 0
        note = make_old_caliber_note()
        wf.step2_create_supplemented(note, "老岑", a.id)
        c2 = wf._counts()
        assert c2["normal"] == 1
        assert c2["supplemented"] == 1
        assert c2["pending"] == 1
        sv = wf.build_summary_view()
        assert sv["counts"]["normal"] == 1
        lst = wf.build_records_list()
        normal_count_in_list = sum(1 for x in lst if x["status"] == "normal")
        supplemented_in_list = sum(1 for x in lst if x["status"] == "supplemented")
        pending_in_list = sum(1 for x in lst if x["status"] == "pending_review")
        assert normal_count_in_list == 1
        assert supplemented_in_list == 1
        assert pending_in_list == 1
        for item in lst:
            assert item["report_summary"] == sv["summary_text"]
        detail = wf.build_record_detail(a.id)
        assert detail is not None
        assert detail["summary_view"]["counts"]["normal"] == 1
        assert detail["report_summary"] == sv["summary_text"]
        assert detail["record"]["status"] == "normal"
        assert len(detail["related_supplemented_records"]) == 1
        detail2 = wf.build_record_detail(b.id)
        assert detail2 is not None
        assert detail2["record"]["status"] == "pending_review"
        pr = detail2["pending_review"]
        assert pr is not None
        assert len(pr["original_statement"]) > 0
        assert len(pr["next_handler"]) > 0
        assert "不自动" in pr["reason"]
        report = wf.step3_update_handover_report()
        assert "正常记录: 1条" in report.summary
        assert "待复核(含温度单位混用): 1条" in report.summary
        assert "旧口径补录: 1条" in report.summary
        txt = wf.export_handover_text()
        assert "正常记录: 1条" in txt
        js = wf.export_handover_json()
        assert '"正常记录: 1条"' in js or "正常记录: 1条" in js

    def test_three_distinct_statuses_on_same_device(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)
        statuses = {r.status for r in wf.records}
        assert ReviewStatus.SUPPLEMENTED in statuses
        assert ReviewStatus.PENDING_REVIEW in statuses
        assert ReviewStatus.NORMAL in statuses
        assert len(wf.records) == 3


class TestThreeDistinctRecords:
    def test_three_records_parallel(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        c = wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)

        c = wf._counts()
        assert c["normal"] == 1
        assert c["pending"] == 1
        assert c["supplemented"] == 1
        assert c["total"] == 3

    def test_three_statuses_in_list(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        c = wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)

        lst = wf.build_records_list()
        statuses = {x["status"] for x in lst}
        assert "normal" in statuses
        assert "pending_review" in statuses
        assert "supplemented" in statuses

    def test_three_distinct_ids(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        c = wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)

        ids = {r.id for r in wf.records}
        assert len(ids) == 3
        assert a.id in ids
        assert b.id in ids
        assert c.id in ids

    def test_normal_record_not_overwritten(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        original_status = a.status
        original_value = a.temperature_value
        original_eff = a.efficiency
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        c = wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)

        assert a.status == original_status
        assert a.temperature_value == original_value
        assert a.efficiency == original_eff
        assert a.status == ReviewStatus.NORMAL

    def test_report_summary_consistent_across_records(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        c = wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)

        detail_a = wf.build_record_detail(a.id)
        detail_b = wf.build_record_detail(b.id)
        detail_c = wf.build_record_detail(c.id)

        assert detail_a is not None
        assert detail_b is not None
        assert detail_c is not None
        assert detail_a["report_summary"] == detail_b["report_summary"]
        assert detail_b["report_summary"] == detail_c["report_summary"]
        assert "正常记录: 1条" in detail_a["report_summary"]
        assert "待复核(含温度单位混用): 1条" in detail_a["report_summary"]
        assert "旧口径补录: 1条" in detail_a["report_summary"]

    def test_export_text_has_all_three_statuses(self):
        from pulley_review.sample_data import make_webcalc_screenshot_a, make_webcalc_screenshot_b_mixed, make_old_caliber_note
        wf = PulleyReviewWorkflow("PULLEY-A01")
        a = wf.step1_import_screenshot(make_webcalc_screenshot_a())
        b = wf.step1_import_screenshot(make_webcalc_screenshot_b_mixed())
        c = wf.step2_create_supplemented(make_old_caliber_note(), "老岑", a.id)

        txt = wf.export_handover_text()
        assert "status=normal" in txt
        assert "status=pending_review" in txt
        assert "status=supplemented" in txt
        assert a.id in txt
        assert b.id in txt
        assert c.id in txt
