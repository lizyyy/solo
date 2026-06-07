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

    def test_rollback(self, engine):
        engine.step1_import_complaints([
            {"complaint_id": "TEST-005", "location": "测试路", "content": "投诉"}
        ], "操作员A")
        engine.step2_review_photos("TEST-005", {"scene_description": "正常"}, "阿宁")
        engine.step3_confirm_and_update("TEST-005", "居民代表", True)

        record = engine.rollback_status("TEST-005", "管理员", "误判")

        assert record.current_status == ProcessingStatus.PHOTO_REVIEWED

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
