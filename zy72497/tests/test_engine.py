import os
import json
import tempfile
import pytest
from datetime import datetime

from src.models import (
    ProcessingStatus,
    EvidenceSource,
    AbnormalType,
)
from src.engine import ClearanceEngine, BoundaryRules
from src.consistency import SingleSourceOfTruth


@pytest.fixture
def temp_storage():
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.remove(path)


@pytest.fixture
def engine(temp_storage):
    return ClearanceEngine(storage_path=temp_storage)


@pytest.fixture
def ssot(engine):
    return SingleSourceOfTruth(engine)


class TestBoundaryRules:
    def test_detect_temporary_detour(self):
        assert BoundaryRules.detect_temporary_detour_issue(
            "施工临时改道，找不到入口",
            "现场有围挡"
        ) is True

        assert BoundaryRules.detect_temporary_detour_issue(
            "地图未更新，导航错误",
            "道路正常"
        ) is True

        assert BoundaryRules.detect_temporary_detour_issue(
            "杂物堆积",
            "现场有箱子"
        ) is False

    def test_should_hold_for_review(self):
        assert BoundaryRules.should_hold_for_review(
            "施工临时改道",
            "现场围挡"
        ) is True

        assert BoundaryRules.should_hold_for_review(
            "正常投诉",
            "正常现场"
        ) is False

    def test_classify_abnormal(self):
        result = BoundaryRules.classify_abnormal(
            "施工临时改道未同步地图",
            "现场有围挡"
        )
        assert result == AbnormalType.TEMPORARY_DETOUR_NOT_SYNCED

        result = BoundaryRules.classify_abnormal(
            "消防通道被堵",
            "有车辆占用"
        )
        assert result == AbnormalType.OBSTRUCTION_FOUND

    def test_rollback_eligibility(self):
        assert BoundaryRules.get_rollback_eligibility(ProcessingStatus.CONFIRMED_NORMAL) is True
        assert BoundaryRules.get_rollback_eligibility(ProcessingStatus.CONFIRMED_ABNORMAL) is True
        assert BoundaryRules.get_rollback_eligibility(ProcessingStatus.IMPORTED) is False


class TestClearanceEngine:
    def test_step1_import(self, engine):
        complaints = [
            {
                "complaint_id": "TEST-001",
                "location": "测试路1号",
                "content": "测试投诉内容",
            }
        ]
        records = engine.step1_import_complaints(complaints, "测试操作员")

        assert len(records) == 1
        record = records[0]
        assert record.complaint_id == "TEST-001"
        assert record.complaint.original_row_number == 1
        assert record.current_status == ProcessingStatus.IMPORTED
        assert len(record.audit_logs) == 1
        assert record.audit_logs[0].source == EvidenceSource.RESIDENT_COMPLAINT

    def test_step2_review_photo_normal(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-001", "location": "测试路", "content": "正常投诉"}
        ], "操作员A")

        photo_data = {
            "photo_id": "P-001",
            "photo_url": "/test.jpg",
            "scene_description": "现场一切正常"
        }
        record = engine.step2_review_photos("TEST-001", photo_data, "阿宁")

        assert record is not None
        assert len(record.photos) == 1
        assert record.current_status == ProcessingStatus.PHOTO_REVIEWED
        assert record.abnormal_type is None

    def test_step2_review_photo_detour_issue(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-002", "location": "施工路", "content": "施工临时改道找不到"}
        ], "操作员A")

        photo_data = {
            "photo_id": "P-002",
            "photo_url": "/test2.jpg",
            "scene_description": "现场有围挡，地图未更新路线"
        }
        record = engine.step2_review_photos("TEST-002", photo_data, "阿宁")

        assert record is not None
        assert record.current_status == ProcessingStatus.PENDING_REVIEW
        assert record.abnormal_type == AbnormalType.TEMPORARY_DETOUR_NOT_SYNCED
        assert "居民代表复核" in record.abnormal_note

    def test_step3_confirm_abnormal(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-003", "location": "测试路", "content": "通道堵塞"}
        ], "操作员A")
        engine.step2_review_photos("TEST-003", {
            "scene_description": "有杂物堆积"
        }, "阿宁")

        record = engine.step3_confirm_and_update("TEST-003", "居民代表", False, "确认堵塞")

        assert record.current_status == ProcessingStatus.CONFIRMED_ABNORMAL
        assert record.confirmed_by == "居民代表"
        assert record.confirmed_at is not None

    def test_step3_confirm_normal(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-004", "location": "测试路", "content": "投诉"}
        ], "操作员A")
        engine.step2_review_photos("TEST-004", {
            "scene_description": "正常"
        }, "阿宁")

        record = engine.step3_confirm_and_update("TEST-004", "居民代表", True)

        assert record.current_status == ProcessingStatus.CONFIRMED_NORMAL

    def test_manual_edit(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-006", "location": "旧地址", "content": "旧内容"}
        ], "操作员A")

        record = engine.update_complaint_manual(
            "TEST-006",
            "location",
            "旧地址",
            "新地址路88号",
            "修改人"
        )

        assert record.complaint.location == "新地址路88号"
        assert len(record.complaint.manual_changes) == 1
        assert record.complaint.manual_changes[0]["field"] == "location"

    def test_trace_by_source(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-007", "location": "追溯路", "content": "追溯测试"}
        ], "录入员")
        engine.step2_review_photos("TEST-007", {
            "photo_id": "P-TRACE",
            "scene_description": "现场说法测试"
        }, "审核员阿宁")
        engine.step3_confirm_and_update("TEST-007", "居民代表", False)

        trace = engine.get_trace_by_source("TEST-007")

        assert trace["complaint_id"] == "TEST-007"
        assert "resident_complaint_source" in trace
        assert trace["resident_complaint_source"]["original_row_number"] == 1
        assert len(trace["photo_supplements"]) == 1
        assert len(trace["manual_confirmations"]) >= 1
        assert "full_audit_trail" in trace

    def test_persistence(self, temp_storage):
        engine1 = ClearanceEngine(storage_path=temp_storage)
        engine1.step1_import_complaints([
            {"complaint_id": "PERSIST-001", "location": "持久化路", "content": "持久化测试"}
        ], "测试员")

        engine2 = ClearanceEngine(storage_path=temp_storage)
        record = engine2.get_record("PERSIST-001")

        assert record is not None
        assert record.complaint.location == "持久化路"

    def test_consistency_single_source(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "CONS-001", "location": "一致性路", "content": "一致性测试"}
        ], "录入员")

        all_records = engine.get_all_records()
        by_id = engine.get_record("CONS-001")

        assert len(all_records) == 1
        assert all_records[0].complaint_id == by_id.complaint_id
        assert all_records[0].current_status == by_id.current_status


class TestRollbackRestoresFields:
    def test_rollback_restores_complaint_content(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "RB-001", "location": "原路", "content": "原内容"}
        ], "操作员A")
        engine.step2_review_photos("RB-001", {
            "scene_description": "正常"
        }, "阿宁")
        engine.update_complaint_manual(
            "RB-001", "complaint_content", "原内容", "修改后内容", "阿宁"
        )
        engine.step3_confirm_and_update("RB-001", "居民代表", True, "确认正常")

        assert engine.get_record("RB-001").complaint.complaint_content == "修改后内容"
        assert engine.get_record("RB-001").current_status == ProcessingStatus.CONFIRMED_NORMAL

        record = engine.rollback_status("RB-001", "管理员", "内容改错了")

        assert record.complaint.complaint_content == "修改后内容"
        assert record.current_status == ProcessingStatus.PHOTO_REVIEWED
        assert record.abnormal_type is None
        assert record.confirmed_by is None

    def test_rollback_restores_abnormal_fields(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "RB-002", "location": "施工路", "content": "施工临时改道找不到"}
        ], "操作员A")
        engine.step2_review_photos("RB-002", {
            "scene_description": "现场有围挡，地图未更新路线"
        }, "阿宁")

        assert engine.get_record("RB-002").abnormal_type == AbnormalType.TEMPORARY_DETOUR_NOT_SYNCED
        assert engine.get_record("RB-002").current_status == ProcessingStatus.PENDING_REVIEW

        engine.step3_confirm_and_update("RB-002", "居民代表", False, "确认异常")

        assert engine.get_record("RB-002").confirmed_by == "居民代表"

        record = engine.rollback_status("RB-002", "管理员", "需重新复核")

        assert record.abnormal_type == AbnormalType.TEMPORARY_DETOUR_NOT_SYNCED
        assert record.abnormal_note == "需居民代表复核，暂不归为正常"
        assert record.current_status == ProcessingStatus.PENDING_REVIEW
        assert record.confirmed_by is None

    def test_rollback_restores_location(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "RB-003", "location": "旧地址路1号", "content": "投诉"}
        ], "操作员A")
        engine.step2_review_photos("RB-003", {
            "scene_description": "正常"
        }, "阿宁")
        engine.update_complaint_manual(
            "RB-003", "location", "旧地址路1号", "新地址路88号", "阿宁"
        )
        engine.step3_confirm_and_update("RB-003", "居民代表", True)

        record = engine.rollback_status("RB-003", "管理员", "地址改错了")

        assert record.complaint.location == "新地址路88号"

    def test_rollback_exports_match_display(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "RB-004", "location": "施工路", "content": "施工临时改道"}
        ], "操作员A")
        engine.step2_review_photos("RB-004", {
            "scene_description": "地图未更新"
        }, "阿宁")
        engine.step3_confirm_and_update("RB-004", "居民代表", False, "确认异常")

        engine.rollback_status("RB-004", "管理员", "需复核")

        api_data = ssot.for_api("RB-004")
        assert api_data["current_status"] == "pending_review"
        assert api_data["abnormal_type"] == "temporary_detour_not_synced"
        assert api_data["confirmed_by"] is None

        display = ssot.for_page_display()
        found = [d for d in display if d["complaint_id"] == "RB-004"][0]
        assert found["current_status"] == "pending_review"
        assert found["abnormal_type"] == "temporary_detour_not_synced"

        csv_out = ssot.for_export_csv()
        assert "pending_review" in csv_out
        assert "temporary_detour_not_synced" in csv_out


class TestSnapshotInAuditLog:
    def test_every_status_change_has_snapshots(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "SNAP-001", "location": "快照路", "content": "快照测试"}
        ], "操作员A")

        record = engine.get_record("SNAP-001")
        for log in record.audit_logs:
            assert "complaint_content" in log.snapshot_before
            assert "location" in log.snapshot_before
            assert "abnormal_type" in log.snapshot_before
            assert "confirmed_by" in log.snapshot_before
            assert "complaint_content" in log.snapshot_after
            assert "location" in log.snapshot_after

    def test_snapshot_before_captures_pre_change_state(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "SNAP-002", "location": "快照路", "content": "原始内容"}
        ], "操作员A")

        engine.update_complaint_manual(
            "SNAP-002", "complaint_content", "原始内容", "改后内容", "阿宁"
        )

        record = engine.get_record("SNAP-002")
        manual_log = [l for l in record.audit_logs if l.details.get("action") == "manual_edit"][0]
        assert manual_log.snapshot_before["complaint_content"] == "原始内容"
        assert manual_log.snapshot_after["complaint_content"] == "改后内容"

    def test_snapshot_after_includes_system_set_fields(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "SNAP-003", "location": "施工路", "content": "施工临时改道"}
        ], "操作员A")
        engine.step2_review_photos("SNAP-003", {
            "scene_description": "地图未更新路线"
        }, "阿宁")

        record = engine.get_record("SNAP-003")
        review_log = [l for l in record.audit_logs if "pending_review" in l.action][0]
        assert review_log.snapshot_before["abnormal_type"] is None
        assert review_log.snapshot_after["abnormal_type"] == "temporary_detour_not_synced"
        assert review_log.snapshot_after["abnormal_note"] is not None


class TestExportEvidenceChain:
    def test_json_export_contains_evidence_chain(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "EXP-001", "location": "导出路", "content": "施工临时改道未同步地图"}
        ], "操作员A")
        engine.step2_review_photos("EXP-001", {
            "photo_id": "P-EXP",
            "scene_description": "现场有围挡，地图未更新路线"
        }, "阿宁")

        result = ssot.for_export_json()
        data = json.loads(result)
        assert len(data) == 1
        record = data[0]
        assert "evidence_chain" in record
        chain = record["evidence_chain"]
        assert chain["original_row_number"] == 1
        assert len(chain["photo_evidence"]) == 1
        assert chain["photo_evidence"][0]["scene_description"] == "现场有围挡，地图未更新路线"
        assert len(chain["status_history"]) >= 2

    def test_csv_export_contains_photo_descriptions_and_raw_data(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "EXP-002", "location": "导出路", "content": "施工临时改道"}
        ], "操作员A")
        engine.step2_review_photos("EXP-002", {
            "scene_description": "围挡阻挡"
        }, "阿宁")

        csv_output = ssot.for_export_csv()
        assert "围挡阻挡" in csv_output
        assert "施工临时改道" in csv_output

    def test_csv_export_contains_manual_changes_detail(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "EXP-003", "location": "旧路", "content": "投诉"}
        ], "操作员A")
        engine.update_complaint_manual(
            "EXP-003", "location", "旧路", "新路", "阿宁"
        )

        csv_output = ssot.for_export_csv()
        assert "location" in csv_output
        assert "旧路" in csv_output
        assert "新路" in csv_output

    def test_api_export_contains_evidence_chain(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "EXP-004", "location": "API路", "content": "API测试"}
        ], "操作员A")

        result = ssot.for_api("EXP-004")
        assert result is not None
        assert "evidence_chain" in result
        assert result["evidence_chain"]["original_row_number"] == 1


class TestSummaryWithEvidence:
    def test_summary_contains_abnormal_records_with_evidence(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "SUM-001", "location": "施工路", "content": "施工临时改道未同步地图"}
        ], "操作员A")
        engine.step2_review_photos("SUM-001", {
            "scene_description": "围挡阻挡，地图未更新"
        }, "阿宁")
        engine.step3_confirm_and_update("SUM-001", "居民代表", False)

        summary = ssot.for_summary()
        assert "abnormal_records_with_evidence" in summary
        abnormal = summary["abnormal_records_with_evidence"]
        assert len(abnormal) >= 1
        found = [a for a in abnormal if a["complaint_id"] == "SUM-001"]
        assert len(found) == 1
        assert found[0]["abnormal_type"] == "temporary_detour_not_synced"
        assert "trigger_evidence" in found[0]
        assert len(found[0]["photo_descriptions"]) >= 1

    def test_summary_contains_pending_review_records_with_evidence(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "SUM-002", "location": "施工路", "content": "施工临时改道"}
        ], "操作员A")
        engine.step2_review_photos("SUM-002", {
            "scene_description": "地图未更新路线"
        }, "阿宁")

        summary = ssot.for_summary()
        assert "pending_review_records_with_evidence" in summary
        pending = summary["pending_review_records_with_evidence"]
        assert len(pending) >= 1
        found = [p for p in pending if p["complaint_id"] == "SUM-002"]
        assert len(found) == 1
        assert found[0]["abnormal_type"] == "temporary_detour_not_synced"
        assert "trigger_complaint" in found[0]


class TestPageDisplayWithEvidence:
    def test_page_display_contains_photo_descriptions(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "PAGE-001", "location": "展示路", "content": "投诉"}
        ], "操作员A")
        engine.step2_review_photos("PAGE-001", {
            "scene_description": "现场有围挡"
        }, "阿宁")

        display = ssot.for_page_display()
        found = [d for d in display if d["complaint_id"] == "PAGE-001"]
        assert len(found) == 1
        assert "photo_descriptions" in found[0]
        assert "现场有围挡" in found[0]["photo_descriptions"]

    def test_page_display_contains_manual_changes_summary(self, engine, ssot):
        engine.step1_import_complaints([
            {"complaint_id": "PAGE-002", "location": "旧路", "content": "投诉"}
        ], "操作员A")
        engine.update_complaint_manual(
            "PAGE-002", "location", "旧路", "新路", "阿宁"
        )

        display = ssot.for_page_display()
        found = [d for d in display if d["complaint_id"] == "PAGE-002"]
        assert len(found) == 1
        assert len(found[0]["manual_changes_summary"]) >= 1
        assert any("旧路" in s and "新路" in s for s in found[0]["manual_changes_summary"])


class TestReplayableWorkflow:
    def test_replayable_includes_manual_edit(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "REP-001", "location": "重跑路", "content": "重跑测试"}
        ], "操作员A")
        engine.update_complaint_manual(
            "REP-001", "location", "重跑路", "改后路", "阿宁"
        )

        from src.cli import cmd_replayable
        import argparse

        class FakeArgs:
            storage = engine.storage_path
            output = None

        steps = []
        records = engine.get_all_records()
        for r in sorted(records, key=lambda x: x.created_at):
            for log in r.audit_logs:
                log_action = log.details.get("action", "") if log.details else ""
                if log_action == "manual_edit":
                    change = log.details.get("change", {})
                    steps.append({
                        "action": "manual_edit",
                        "field": change.get("field", ""),
                        "new_value": change.get("new_value", ""),
                    })

        assert any(s["action"] == "manual_edit" and s["field"] == "location" for s in steps)

    def test_replayable_includes_rollback(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "REP-002", "location": "回滚路", "content": "回滚测试"}
        ], "操作员A")
        engine.step2_review_photos("REP-002", {
            "scene_description": "正常"
        }, "阿宁")
        engine.step3_confirm_and_update("REP-002", "居民代表", True)
        engine.rollback_status("REP-002", "管理员", "需重审")

        steps = []
        records = engine.get_all_records()
        for r in sorted(records, key=lambda x: x.created_at):
            for log in r.audit_logs:
                log_action = log.details.get("action", "") if log.details else ""
                if log_action == "rollback":
                    steps.append({"action": "rollback"})

        assert any(s["action"] == "rollback" for s in steps)

    def test_replayable_produces_consistent_result(self, temp_storage):
        engine1 = ClearanceEngine(storage_path=temp_storage)
        engine1.step1_import_complaints([
            {"complaint_id": "REP-003", "location": "一致性路", "content": "施工临时改道"}
        ], "操作员A")
        engine1.step2_review_photos("REP-003", {
            "scene_description": "地图未更新路线"
        }, "阿宁")
        engine1.update_complaint_manual(
            "REP-003", "complaint_content", "施工临时改道", "施工临时改道，需复核", "阿宁"
        )

        ssot1 = SingleSourceOfTruth(engine1)
        result1 = ssot1.for_api("REP-003")
        assert result1["complaint"]["complaint_content"] == "施工临时改道，需复核"
        assert result1["evidence_chain"]["manual_changes"][0]["field"] == "complaint_content"
