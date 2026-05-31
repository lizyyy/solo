#!/usr/bin/env python3
import uuid
from datetime import datetime, timedelta
import unittest

from models import (
    ScheduleDatabase, ScheduleRecord, Material, SilenceSegment,
    ConfirmationStatus, IssueType
)
from validator import (
    validate_record, validate_all, check_missing_materials,
    check_timeline_drift, check_silence_segments, check_overlaps,
    HUMAN_MESSAGES
)
from operations import (
    import_records, withdraw_record, amend_record,
    filter_records, export_records, get_record_history
)


class TestMissingMaterial(unittest.TestCase):
    def test_single_missing_material(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m1", "主音频", timedelta(seconds=30)),
                Material("m2", "不存在的素材", timedelta(seconds=30), exists=False)
            ]
        )
        
        issues = check_missing_materials(record)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.MISSING_MATERIAL)
        self.assertEqual(issues[0].severity, "error")
        self.assertIn("测试广告", issues[0].message)
        self.assertIn("不存在的素材", issues[0].message)
        self.assertIsNotNone(issues[0].reviewable_reason)
        self.assertIn("素材库中找不到", issues[0].reviewable_reason)
    
    def test_multiple_missing_materials(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m1", "素材A", timedelta(seconds=20), exists=False),
                Material("m2", "素材B", timedelta(seconds=20), exists=False),
                Material("m3", "素材C", timedelta(seconds=20))
            ]
        )
        
        issues = check_missing_materials(record)
        self.assertEqual(len(issues), 1)
        self.assertIn("2 个素材", issues[0].message)
        self.assertIn("素材A", issues[0].message)
        self.assertIn("素材B", issues[0].message)
    
    def test_no_missing_materials(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m1", "主音频", timedelta(seconds=30)),
                Material("m2", "背景音乐", timedelta(seconds=30))
            ]
        )
        
        issues = check_missing_materials(record)
        self.assertEqual(len(issues), 0)


class TestTimelineDrift(unittest.TestCase):
    def test_positive_drift_over_threshold(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 10),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5)
        )
        
        issues = check_timeline_drift(record)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.TIMELINE_DRIFT)
        self.assertEqual(issues[0].severity, "warning")
        self.assertIn("多 10.0 秒", issues[0].message)
        self.assertIn("预期时长 60.0 秒", issues[0].reviewable_reason)
        self.assertIn("08:00:00 ~ 08:01:10", issues[0].reviewable_reason)
    
    def test_negative_drift_over_threshold(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 0, 50),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5)
        )
        
        issues = check_timeline_drift(record)
        self.assertEqual(len(issues), 1)
        self.assertIn("少 10.0 秒", issues[0].message)
    
    def test_drift_within_threshold(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 3),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5)
        )
        
        issues = check_timeline_drift(record)
        self.assertEqual(len(issues), 0)
    
    def test_no_drift(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5)
        )
        
        issues = check_timeline_drift(record)
        self.assertEqual(len(issues), 0)


class TestSilenceSegments(unittest.TestCase):
    def test_single_silence_deleted(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            silence_segments=[
                SilenceSegment(timedelta(seconds=29), timedelta(seconds=31), preserved=False)
            ]
        )
        
        issues = check_silence_segments(record)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.SILENCE_DELETED)
        self.assertEqual(issues[0].severity, "warning")
        self.assertIn("静音段被删除了", issues[0].message)
        self.assertIn("第 1 段静音", issues[0].reviewable_reason)
        self.assertIn("29.0秒 ~ 31.0秒", issues[0].reviewable_reason)
    
    def test_multiple_silence_deleted(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            silence_segments=[
                SilenceSegment(timedelta(seconds=9), timedelta(seconds=11), preserved=False),
                SilenceSegment(timedelta(seconds=29), timedelta(seconds=31), preserved=False),
                SilenceSegment(timedelta(seconds=49), timedelta(seconds=51), preserved=True)
            ]
        )
        
        issues = check_silence_segments(record)
        self.assertEqual(len(issues), 1)
        self.assertIn("2 段静音被误删", issues[0].message)
        self.assertIn("第 1 段静音", issues[0].reviewable_reason)
        self.assertIn("第 2 段静音", issues[0].reviewable_reason)
    
    def test_no_silence_deleted(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            silence_segments=[
                SilenceSegment(timedelta(seconds=29), timedelta(seconds=31), preserved=True)
            ]
        )
        
        issues = check_silence_segments(record)
        self.assertEqual(len(issues), 0)
    
    def test_no_silence_segments(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            silence_segments=[]
        )
        
        issues = check_silence_segments(record)
        self.assertEqual(len(issues), 0)


class TestOverlapDetection(unittest.TestCase):
    def test_overlapping_records(self):
        r1 = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="广告A",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60)
        )
        r2 = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="广告B",
            slot_start=datetime(2026, 5, 31, 8, 0, 30),
            slot_end=datetime(2026, 5, 31, 8, 1, 30),
            expected_duration=timedelta(seconds=60)
        )
        
        overlaps = check_overlaps([r1, r2])
        self.assertEqual(len(overlaps), 1)
        _, _, issue = overlaps[0]
        self.assertEqual(issue.issue_type, IssueType.OVERLAP)
        self.assertIn("广告A", issue.message)
        self.assertIn("广告B", issue.message)
        self.assertIn("重叠了 30.0 秒", issue.reviewable_reason)
    
    def test_non_overlapping_records(self):
        r1 = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="广告A",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60)
        )
        r2 = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="广告B",
            slot_start=datetime(2026, 5, 31, 8, 1, 0),
            slot_end=datetime(2026, 5, 31, 8, 2, 0),
            expected_duration=timedelta(seconds=60)
        )
        
        overlaps = check_overlaps([r1, r2])
        self.assertEqual(len(overlaps), 0)


class TestValidationStatus(unittest.TestCase):
    def test_clean_record_is_confirmed(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="完美广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m1", "主音频", timedelta(seconds=60))
            ]
        )
        
        validated = validate_record(record)
        self.assertEqual(validated.status, ConfirmationStatus.CONFIRMED)
        self.assertEqual(len(validated.issues), 0)
    
    def test_record_with_warnings_is_pending(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="有漂移广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 10),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5),
            materials=[
                Material("m1", "主音频", timedelta(seconds=60))
            ]
        )
        
        validated = validate_record(record)
        self.assertEqual(validated.status, ConfirmationStatus.PENDING)
        self.assertTrue(any(i.severity == "warning" for i in validated.issues))
    
    def test_record_with_errors_needs_review(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="缺素材广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m1", "不存在的素材", timedelta(seconds=60), exists=False)
            ]
        )
        
        validated = validate_record(record)
        self.assertEqual(validated.status, ConfirmationStatus.NEEDS_REVIEW)
        self.assertTrue(any(i.severity == "error" for i in validated.issues))
    
    def test_incomplete_data(self):
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="",
            slot_start=None,
            slot_end=None,
            expected_duration=None
        )
        
        validated = validate_record(record)
        self.assertEqual(validated.status, ConfirmationStatus.PENDING)
        self.assertTrue(any(i.issue_type == IssueType.INVALID_DATA for i in validated.issues))
        self.assertIn("数据填写不完整", validated.issues[0].message)


class TestImportOperations(unittest.TestCase):
    def test_import_new_records(self):
        db = ScheduleDatabase()
        records = [
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="新广告A",
                slot_start=datetime(2026, 5, 31, 8, 0, 0),
                slot_end=datetime(2026, 5, 31, 8, 1, 0),
                expected_duration=timedelta(seconds=60),
                materials=[Material("m1", "素材", timedelta(seconds=60))]
            )
        ]
        
        result = import_records(db, records, "test_user")
        self.assertEqual(len(result["imported"]), 1)
        self.assertEqual(len(result["updated"]), 0)
        self.assertEqual(len(db.records), 1)
        self.assertEqual(len(db.logs), 1)
        self.assertEqual(db.logs[0].operation, "新导入")
    
    def test_import_duplicate_creates_new_version(self):
        db = ScheduleDatabase()
        record_id = str(uuid.uuid4())
        
        r1 = ScheduleRecord(
            record_id=record_id,
            ad_name="重复广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[Material("m1", "素材", timedelta(seconds=60))]
        )
        
        import_records(db, [r1], "test_user")
        self.assertEqual(db.records[record_id].version, 1)
        
        r2 = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="重复广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 30),
            expected_duration=timedelta(seconds=60),
            materials=[Material("m1", "新素材", timedelta(seconds=60))]
        )
        
        result = import_records(db, [r2], "test_user")
        self.assertEqual(len(result["updated"]), 1)
        self.assertEqual(db.records[record_id].version, 2)
        self.assertEqual(db.records[record_id].slot_end.minute, 1)
        self.assertEqual(db.records[record_id].slot_end.second, 30)
        
        withdraw_logs = [l for l in db.logs if l.operation == "撤回旧版本"]
        self.assertEqual(len(withdraw_logs), 1)


class TestWithdrawOperations(unittest.TestCase):
    def test_withdraw_record(self):
        db = ScheduleDatabase()
        record_id = str(uuid.uuid4())
        
        record = ScheduleRecord(
            record_id=record_id,
            ad_name="要撤回的广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[Material("m1", "素材", timedelta(seconds=60))]
        )
        
        import_records(db, [record], "test_user")
        self.assertNotEqual(db.records[record_id].status, ConfirmationStatus.REJECTED)
        
        result = withdraw_record(db, record_id, "test_user", "客户取消了")
        self.assertTrue(result["success"])
        self.assertEqual(db.records[record_id].status, ConfirmationStatus.REJECTED)
        self.assertEqual(result["reason"], "客户取消了")
        
        withdraw_logs = [l for l in db.logs if l.operation == "撤回"]
        self.assertEqual(len(withdraw_logs), 1)


class TestAmendOperations(unittest.TestCase):
    def test_amend_record(self):
        db = ScheduleDatabase()
        record_id = str(uuid.uuid4())
        
        record = ScheduleRecord(
            record_id=record_id,
            ad_name="要修正的广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[Material("m1", "素材", timedelta(seconds=60))]
        )
        
        import_records(db, [record], "test_user")
        self.assertEqual(db.records[record_id].version, 1)
        
        result = amend_record(
            db, record_id, "test_user",
            {"slot_end": datetime(2026, 5, 31, 8, 2, 0)},
            "调整了结束时间"
        )
        
        self.assertTrue(result["success"])
        self.assertEqual(db.records[record_id].version, 2)
        self.assertEqual(db.records[record_id].slot_end, datetime(2026, 5, 31, 8, 2, 0))
        
        amend_logs = [l for l in db.logs if l.operation == "修正"]
        self.assertEqual(len(amend_logs), 1)


class TestExportOperations(unittest.TestCase):
    def test_export_only_confirmed_by_default(self):
        db = ScheduleDatabase()
        records = [
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="已确认广告",
                slot_start=datetime(2026, 5, 31, 8, 0, 0),
                slot_end=datetime(2026, 5, 31, 8, 1, 0),
                expected_duration=timedelta(seconds=60),
                materials=[Material("m1", "素材", timedelta(seconds=60))]
            ),
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="待确认广告",
                slot_start=datetime(2026, 5, 31, 8, 5, 0),
                slot_end=datetime(2026, 5, 31, 8, 6, 10),
                expected_duration=timedelta(seconds=60),
                drift_threshold=timedelta(seconds=5),
                materials=[Material("m2", "素材", timedelta(seconds=60))]
            )
        ]
        
        import_records(db, records, "test_user")
        all_records = list(db.records.values())
        
        result = export_records(all_records, "test_user", include_pending=False)
        self.assertEqual(result["exported_count"], 1)
        self.assertEqual(result["confirmed_count"], 1)
        self.assertEqual(result["pending_count"], 1)
        self.assertTrue(any("待确认记录未导出" in w for w in result["warnings"]))
    
    def test_export_includes_pending_when_enabled(self):
        db = ScheduleDatabase()
        records = [
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="已确认广告",
                slot_start=datetime(2026, 5, 31, 8, 0, 0),
                slot_end=datetime(2026, 5, 31, 8, 1, 0),
                expected_duration=timedelta(seconds=60),
                materials=[Material("m1", "素材", timedelta(seconds=60))]
            ),
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="待确认广告",
                slot_start=datetime(2026, 5, 31, 8, 5, 0),
                slot_end=datetime(2026, 5, 31, 8, 6, 10),
                expected_duration=timedelta(seconds=60),
                drift_threshold=timedelta(seconds=5),
                materials=[Material("m2", "素材", timedelta(seconds=60))]
            )
        ]
        
        import_records(db, records, "test_user")
        all_records = list(db.records.values())
        
        result = export_records(all_records, "test_user", include_pending=True)
        self.assertEqual(result["exported_count"], 2)
    
    def test_export_includes_issue_details(self):
        db = ScheduleDatabase()
        record = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="有问题的广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 10),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5),
            materials=[Material("m1", "素材", timedelta(seconds=60), exists=False)]
        )
        
        import_records(db, [record], "test_user")
        all_records = list(db.records.values())
        
        result = export_records(all_records, "test_user", include_pending=True)
        self.assertTrue(len(result["records"]) > 0)
        exported = result["records"][0]
        self.assertIn("问题数量", exported)
        self.assertIn("问题描述", exported)
        self.assertIn("复核原因", exported)


class TestFilterOperations(unittest.TestCase):
    def test_filter_by_status(self):
        records = [
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="已确认",
                status=ConfirmationStatus.CONFIRMED
            ),
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="待确认",
                status=ConfirmationStatus.PENDING
            ),
            ScheduleRecord(
                record_id=str(uuid.uuid4()),
                ad_name="已撤回",
                status=ConfirmationStatus.REJECTED
            )
        ]
        
        filtered = filter_records(records, status_filter=[ConfirmationStatus.CONFIRMED])
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].ad_name, "已确认")
    
    def test_filter_by_name(self):
        records = [
            ScheduleRecord(record_id=str(uuid.uuid4()), ad_name="早餐奶广告"),
            ScheduleRecord(record_id=str(uuid.uuid4()), ad_name="汽车广告"),
            ScheduleRecord(record_id=str(uuid.uuid4()), ad_name="手机广告")
        ]
        
        filtered = filter_records(records, ad_name_contains="广告")
        self.assertEqual(len(filtered), 3)
        
        filtered = filter_records(records, ad_name_contains="汽车")
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].ad_name, "汽车广告")


class TestOperationConsistency(unittest.TestCase):
    def test_import_and_export_use_same_validation(self):
        db = ScheduleDatabase()
        
        record_with_issues = ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="有问题的广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 10),
            expected_duration=timedelta(seconds=60),
            drift_threshold=timedelta(seconds=5),
            materials=[
                Material("m1", "素材A", timedelta(seconds=30), exists=False),
                Material("m2", "素材B", timedelta(seconds=30))
            ]
        )
        
        import_result = import_records(db, [record_with_issues], "test_user")
        imported = import_result["imported"][0]
        self.assertEqual(imported["status"], ConfirmationStatus.NEEDS_REVIEW.value)
        self.assertEqual(len(imported["issues"]), 2)
        
        all_records = list(db.records.values())
        validated_after_import = [r for r in all_records if r.ad_name == "有问题的广告"][0]
        import_issue_messages = sorted(imported["issues"])
        record_issue_messages = sorted([i.message for i in validated_after_import.issues])
        self.assertEqual(import_issue_messages, record_issue_messages)
        
        export_result = export_records(all_records, "test_user", include_pending=True)
        exported = [r for r in export_result["records"] if r["广告名称"] == "有问题的广告"][0]
        self.assertIn("缺少素材", exported["问题描述"])
        self.assertIn("实际时长比预期", exported["问题描述"])
    
    def test_amend_triggers_same_validation(self):
        db = ScheduleDatabase()
        record_id = str(uuid.uuid4())
        
        clean_record = ScheduleRecord(
            record_id=record_id,
            ad_name="原来没问题",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[Material("m1", "素材", timedelta(seconds=60))]
        )
        
        import_records(db, [clean_record], "test_user")
        self.assertEqual(db.records[record_id].status, ConfirmationStatus.CONFIRMED)
        self.assertEqual(len(db.records[record_id].issues), 0)
        
        amend_result = amend_record(
            db, record_id, "test_user",
            {"slot_end": datetime(2026, 5, 31, 8, 1, 10)},
            "调整时长"
        )
        
        self.assertEqual(amend_result["status"], ConfirmationStatus.PENDING.value)
        self.assertEqual(len(amend_result["issues"]), 1)
        self.assertIn("实际时长比预期", amend_result["issues"][0])


class TestHistoryTracking(unittest.TestCase):
    def test_full_history_tracking(self):
        db = ScheduleDatabase()
        record_id = str(uuid.uuid4())
        
        record = ScheduleRecord(
            record_id=record_id,
            ad_name="历史测试广告",
            slot_start=datetime(2026, 5, 31, 8, 0, 0),
            slot_end=datetime(2026, 5, 31, 8, 1, 0),
            expected_duration=timedelta(seconds=60),
            materials=[Material("m1", "素材", timedelta(seconds=60))]
        )
        
        import_records(db, [record], "user1")
        amend_record(db, record_id, "user2", {"notes": "更新备注"}, "修改备注")
        withdraw_record(db, record_id, "user3", "测试撤回")
        
        history = get_record_history(db, record_id)
        self.assertEqual(len(history), 3)
        self.assertEqual(history[0]["操作"], "新导入")
        self.assertEqual(history[0]["操作人"], "user1")
        self.assertEqual(history[1]["操作"], "修正")
        self.assertEqual(history[1]["操作人"], "user2")
        self.assertEqual(history[2]["操作"], "撤回")
        self.assertEqual(history[2]["操作人"], "user3")


if __name__ == "__main__":
    unittest.main(verbosity=2)
