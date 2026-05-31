import os
import unittest
import tempfile
import json
import csv
from datetime import datetime, timedelta

from models import (
    RecordStatus, IssueType, DataSourceType,
    init_db, RecordRepository
)
from data_ingestion import DataIngestionService
from anomaly_detector import AnomalyDetector
from review_service import StateEngine, ReviewService
from main import RiverPollutionSystem


class TestModels(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.conn = init_db(self.db_path)
        self.repo = RecordRepository(self.conn)
    
    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)
    
    def test_record_status_enum(self):
        self.assertEqual(RecordStatus.DRAFT.value, "draft")
        self.assertEqual(RecordStatus.NORMAL.value, "normal")
        self.assertEqual(RecordStatus.PENDING_REVIEW.value, "pending_review")
        self.assertEqual(RecordStatus.REJECTED.value, "rejected")
        self.assertEqual(RecordStatus.ARCHIVED.value, "archived")
    
    def test_issue_type_enum(self):
        self.assertEqual(IssueType.UNIT_MISMATCH.value, "unit_mismatch")
        self.assertEqual(IssueType.CONSTRAINT_OVERRIDDEN.value, "constraint_overridden")
        self.assertEqual(IssueType.RESULT_DRIFT.value, "result_drift")
        self.assertEqual(IssueType.DUPLICATE.value, "duplicate")
        self.assertEqual(IssueType.LATE_ATTACHMENT.value, "late_attachment")
        self.assertEqual(IssueType.MANUAL_CORRECTION.value, "manual_correction")
    
    def test_data_source_type_enum(self):
        self.assertEqual(DataSourceType.AUTOMATIC.value, "automatic")
        self.assertEqual(DataSourceType.MANUAL_UPLOAD.value, "manual_upload")
        self.assertEqual(DataSourceType.LATE_ATTACHMENT.value, "late_attachment")
        self.assertEqual(DataSourceType.MANUAL_CORRECTION.value, "manual_correction")


class TestDataIngestion(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.conn = init_db(self.db_path)
        self.repo = RecordRepository(self.conn)
        self.ingestion = DataIngestionService(self.repo)
        self.detector = AnomalyDetector(self.repo)
    
    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)
    
    def test_ingest_from_dict_normal(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100},
            "overridden_constraints": {}
        }
        
        record_id = self.ingestion.ingest_from_dict(
            data=data,
            source_type=DataSourceType.AUTOMATIC,
            uploaded_by="测试用户"
        )
        
        record = self.repo.get_record(record_id)
        self.assertIsNotNone(record)
        self.assertEqual(record.location, "监测点A")
        self.assertEqual(record.pollutant, "COD")
        self.assertEqual(record.value, 45.2)
        self.assertEqual(record.unit, "mg/L")
        self.assertEqual(record.status, RecordStatus.DRAFT)
        self.assertEqual(record.current_owner, "测试用户")
        
        source = self.repo.get_data_source(record.source_id)
        self.assertIsNotNone(source)
        self.assertEqual(source.source_type, DataSourceType.AUTOMATIC)
        self.assertEqual(source.uploaded_by, "测试用户")
        
        audit_log = self.repo.get_audit_log(record_id)
        self.assertEqual(len(audit_log), 1)
        self.assertEqual(audit_log[0].action, "create")
        self.assertEqual(audit_log[0].new_status, RecordStatus.DRAFT)
    
    def test_ingest_late_attachment(self):
        original_data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点B",
            "pollutant": "氨氮",
            "value": 3.5,
            "unit": "mg/L",
            "model_version": "v2.1.0"
        }
        
        original_id = self.ingestion.ingest_from_dict(
            data=original_data,
            uploaded_by="原始用户"
        )
        
        attachment_data = {
            "value": 4.2,
            "unit": "mg/L"
        }
        
        new_id = self.ingestion.ingest_late_attachment(
            original_record_id=original_id,
            attachment_data=attachment_data,
            uploaded_by="补充用户",
            filename="补充数据.csv",
            reason="实验室重新检测"
        )
        
        new_record = self.repo.get_record(new_id)
        self.assertIsNotNone(new_record)
        self.assertEqual(new_record.value, 4.2)
        self.assertEqual(new_record.metadata["late_attachment_for"], original_id)
        self.assertEqual(new_record.metadata["attachment_reason"], "实验室重新检测")
        
        source = self.repo.get_data_source(new_record.source_id)
        self.assertEqual(source.source_type, DataSourceType.LATE_ATTACHMENT)
        
        original_audit = self.repo.get_audit_log(original_id)
        self.assertTrue(
            any("late_attachment" in entry.action for entry in original_audit)
        )
    
    def test_manual_correction(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点C",
            "pollutant": "总磷",
            "value": 1000,
            "unit": "mg/L",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(
            data=data,
            uploaded_by="录入人员"
        )
        
        self.ingestion.apply_manual_correction(
            record_id=record_id,
            corrections={"value": 1.0, "unit": "mg/L"},
            corrected_by="审核人员",
            reason="数值录入错误，多输入了3个0"
        )
        
        record = self.repo.get_record(record_id)
        self.assertEqual(record.value, 1.0)
        self.assertEqual(record.status, RecordStatus.DRAFT)
        self.assertTrue(record.metadata["manual_correction"])
        self.assertEqual(record.metadata["corrected_by"], "审核人员")
        
        audit_log = self.repo.get_audit_log(record_id)
        correction_logs = [e for e in audit_log if e.action == "manual_correction"]
        self.assertEqual(len(correction_logs), 1)
        self.assertEqual(correction_logs[0].changed_by, "审核人员")
        self.assertIn("数值录入错误", correction_logs[0].change_reason)
    
    def test_duplicate_detection(self):
        base_time = datetime.now()
        
        records = [
            {
                "sample_time": base_time.isoformat(),
                "location": "监测点D",
                "pollutant": "COD",
                "value": 50.0,
                "unit": "mg/L",
                "model_version": "v2.1.0"
            },
            {
                "sample_time": (base_time + timedelta(minutes=5)).isoformat(),
                "location": "监测点D",
                "pollutant": "COD",
                "value": 50.0,
                "unit": "mg/L",
                "model_version": "v2.1.0"
            },
            {
                "sample_time": (base_time + timedelta(minutes=10)).isoformat(),
                "location": "监测点D",
                "pollutant": "COD",
                "value": 55.0,
                "unit": "mg/L",
                "model_version": "v2.1.0"
            }
        ]
        
        for r in records:
            self.ingestion.ingest_from_dict(data=r)
        
        groups = self.ingestion.find_duplicates(time_window_minutes=30)
        self.assertEqual(len(groups), 1)
        self.assertEqual(len(groups[0].duplicate_record_ids), 1)
        
        dup_id = groups[0].duplicate_record_ids[0]
        dup_record = self.repo.get_record(dup_id)
        self.assertEqual(dup_record.status, RecordStatus.PENDING_REVIEW)
        
        pending_items = self.repo.get_pending_items_for_record(dup_id)
        self.assertEqual(len(pending_items), 1)
        self.assertEqual(pending_items[0].issue_type, IssueType.DUPLICATE)
    
    def test_ingest_from_csv(self):
        csv_fd, csv_path = tempfile.mkstemp(suffix=".csv")
        try:
            with os.fdopen(csv_fd, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["sample_time", "location", "pollutant", "value", "unit", "model_version"])
                writer.writerow([datetime.now().isoformat(), "监测点E", "COD", "25.5", "mg/L", "v2.1.0"])
                writer.writerow([datetime.now().isoformat(), "监测点E", "氨氮", "2.3", "mg/L", "v2.1.0"])
            
            record_ids = self.ingestion.ingest_from_csv(
                csv_path=csv_path,
                uploaded_by="批量导入"
            )
            
            self.assertEqual(len(record_ids), 2)
            
            for rid in record_ids:
                record = self.repo.get_record(rid)
                self.assertIsNotNone(record)
                source = self.repo.get_data_source(record.source_id)
                self.assertEqual(source.source_type, DataSourceType.MANUAL_UPLOAD)
        finally:
            os.unlink(csv_path)
    
    def test_ingest_from_json(self):
        json_fd, json_path = tempfile.mkstemp(suffix=".json")
        try:
            data = [
                {
                    "sample_time": datetime.now().isoformat(),
                    "location": "监测点F",
                    "pollutant": "COD",
                    "value": 35.0,
                    "unit": "mg/L",
                    "model_version": "v2.1.0"
                },
                {
                    "sample_time": datetime.now().isoformat(),
                    "location": "监测点F",
                    "pollutant": "总磷",
                    "value": 0.5,
                    "unit": "mg/L",
                    "model_version": "v2.1.0"
                }
            ]
            
            with os.fdopen(json_fd, "w", encoding="utf-8") as f:
                json.dump(data, f)
            
            record_ids = self.ingestion.ingest_from_json(
                json_path=json_path,
                uploaded_by="JSON导入"
            )
            
            self.assertEqual(len(record_ids), 2)
        finally:
            os.unlink(json_path)


class TestAnomalyDetector(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.conn = init_db(self.db_path)
        self.repo = RecordRepository(self.conn)
        self.ingestion = DataIngestionService(self.repo)
        self.detector = AnomalyDetector(self.repo)
    
    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)
    
    def test_detect_unit_mismatch_undefined_unit(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "unknown_unit",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        
        issue = self.detector.detect_unit_mismatch(record_id)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_type, IssueType.UNIT_MISMATCH)
        self.assertIn("未定义的单位", issue.issue_description)
        
        record = self.repo.get_record(record_id)
        self.assertEqual(record.status, RecordStatus.PENDING_REVIEW)
    
    def test_detect_unit_mismatch_different_from_others(self):
        base_time = datetime.now()
        
        records = [
            {
                "sample_time": base_time.isoformat(),
                "location": "监测点B",
                "pollutant": "COD",
                "value": 45.2,
                "unit": "mg/L",
                "model_version": "v2.1.0"
            },
            {
                "sample_time": (base_time + timedelta(hours=1)).isoformat(),
                "location": "监测点B",
                "pollutant": "COD",
                "value": 42800,
                "unit": "μg/L",
                "model_version": "v2.1.0"
            }
        ]
        
        for r in records:
            self.ingestion.ingest_from_dict(data=r)
        
        second_id = self.repo.get_records_by_criteria(location="监测点B", pollutant="COD")[0].record_id
        
        issue = self.detector.detect_unit_mismatch(second_id)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_type, IssueType.UNIT_MISMATCH)
        self.assertIn("单位不一致", issue.issue_description)
    
    def test_detect_constraint_overridden(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点C",
            "pollutant": "氨氮",
            "value": 5.8,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 10, "confidence_threshold": 0.8},
            "overridden_constraints": {"confidence_threshold": 0.5}
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        
        issue = self.detector.detect_constraint_overridden(record_id)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_type, IssueType.CONSTRAINT_OVERRIDDEN)
        self.assertIn("约束条件被覆盖", issue.issue_description)
        self.assertIn("confidence_threshold", issue.review_reason)
        self.assertIn("0.8", issue.review_reason)
        self.assertIn("0.5", issue.review_reason)
    
    def test_detect_result_drift(self):
        base_time = datetime.now()
        
        records = [
            {
                "sample_time": base_time.isoformat(),
                "location": "监测点D",
                "pollutant": "总磷",
                "value": 0.85,
                "unit": "mg/L",
                "model_version": "v2.0.0"
            },
            {
                "sample_time": (base_time + timedelta(minutes=2)).isoformat(),
                "location": "监测点D",
                "pollutant": "总磷",
                "value": 1.25,
                "unit": "mg/L",
                "model_version": "v2.1.0"
            }
        ]
        
        for r in records:
            self.ingestion.ingest_from_dict(data=r)
        
        records_list = self.repo.get_records_by_criteria(location="监测点D", pollutant="总磷")
        newer_id = records_list[0].record_id
        
        issue = self.detector.detect_result_drift(newer_id, drift_threshold=0.15)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_type, IssueType.RESULT_DRIFT)
        self.assertIn("偏差过大", issue.issue_description)
        
        drift_pct = abs(1.25 - 0.85) / 0.85 * 100
        self.assertIn(f"{round(drift_pct, 2)}", issue.review_reason)
    
    def test_detect_late_attachment(self):
        original_data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点E",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "mg/L",
            "model_version": "v2.1.0"
        }
        
        original_id = self.ingestion.ingest_from_dict(data=original_data)
        
        attachment_data = {"value": 48.5, "unit": "mg/L"}
        new_id = self.ingestion.ingest_late_attachment(
            original_record_id=original_id,
            attachment_data=attachment_data,
            uploaded_by="测试人员",
            reason="晚到附件测试"
        )
        
        issue = self.detector.detect_late_attachment(new_id)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_type, IssueType.LATE_ATTACHMENT)
        self.assertIn("晚到附件", issue.issue_description)
        self.assertIn("晚到附件测试", issue.review_reason)
    
    def test_detect_manual_correction(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点F",
            "pollutant": "氨氮",
            "value": 1000,
            "unit": "mg/L",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        
        self.ingestion.apply_manual_correction(
            record_id=record_id,
            corrections={"value": 1.0},
            corrected_by="审核员",
            reason="单位换算错误"
        )
        
        issue = self.detector.detect_manual_correction(record_id)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_type, IssueType.MANUAL_CORRECTION)
        self.assertIn("人工修正", issue.issue_description)
        self.assertIn("单位换算错误", issue.review_reason)
    
    def test_run_all_checks(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点G",
            "pollutant": "COD",
            "value": 1000,
            "unit": "bad_unit",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100},
            "overridden_constraints": {"max_value": 1000}
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        
        issues = self.detector.run_all_checks(record_id)
        self.assertGreaterEqual(len(issues), 2)
        
        issue_types = [i.issue_type for i in issues]
        self.assertIn(IssueType.UNIT_MISMATCH, issue_types)
        self.assertIn(IssueType.CONSTRAINT_OVERRIDDEN, issue_types)


class TestStateEngine(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.conn = init_db(self.db_path)
        self.repo = RecordRepository(self.conn)
        self.ingestion = DataIngestionService(self.repo)
        self.state_engine = StateEngine(self.repo)
    
    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)
    
    def _create_test_record(self) -> str:
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "测试点",
            "pollutant": "COD",
            "value": 50.0,
            "unit": "mg/L",
            "model_version": "v2.1.0"
        }
        return self.ingestion.ingest_from_dict(data=data)
    
    def test_allowed_transitions(self):
        self.assertTrue(self.state_engine.can_transition(RecordStatus.DRAFT, RecordStatus.NORMAL))
        self.assertTrue(self.state_engine.can_transition(RecordStatus.DRAFT, RecordStatus.PENDING_REVIEW))
        self.assertTrue(self.state_engine.can_transition(RecordStatus.PENDING_REVIEW, RecordStatus.NORMAL))
        self.assertTrue(self.state_engine.can_transition(RecordStatus.PENDING_REVIEW, RecordStatus.REJECTED))
        self.assertFalse(self.state_engine.can_transition(RecordStatus.NORMAL, RecordStatus.DRAFT))
        self.assertFalse(self.state_engine.can_transition(RecordStatus.REJECTED, RecordStatus.NORMAL))
    
    def test_transition(self):
        record_id = self._create_test_record()
        
        record = self.state_engine.transition(
            record_id=record_id,
            target_status=RecordStatus.NORMAL,
            changed_by="审核员",
            reason="数据正常"
        )
        
        self.assertEqual(record.status, RecordStatus.NORMAL)
        
        audit_log = self.repo.get_audit_log(record_id)
        self.assertEqual(len(audit_log), 2)
        self.assertEqual(audit_log[1].action, "status_change")
        self.assertEqual(audit_log[1].old_status, RecordStatus.DRAFT)
        self.assertEqual(audit_log[1].new_status, RecordStatus.NORMAL)
        self.assertEqual(audit_log[1].changed_by, "审核员")
    
    def test_invalid_transition(self):
        record_id = self._create_test_record()
        
        self.state_engine.transition(
            record_id=record_id,
            target_status=RecordStatus.NORMAL,
            changed_by="审核员",
            reason="数据正常"
        )
        
        with self.assertRaises(Exception) as context:
            self.state_engine.transition(
                record_id=record_id,
                target_status=RecordStatus.DRAFT,
                changed_by="审核员",
                reason="返回草稿"
            )
        
        self.assertIn("不允许的状态流转", str(context.exception))
    
    def test_approve(self):
        record_id = self._create_test_record()
        
        record = self.state_engine.approve(
            record_id=record_id,
            approved_by="主任",
            reason="审核通过"
        )
        
        self.assertEqual(record.status, RecordStatus.NORMAL)
        
        audit_log = self.repo.get_audit_log(record_id)
        self.assertEqual(audit_log[-1].action, "approve")
    
    def test_reject(self):
        record_id = self._create_test_record()
        
        record = self.state_engine.reject(
            record_id=record_id,
            rejected_by="主任",
            reason="数据异常"
        )
        
        self.assertEqual(record.status, RecordStatus.REJECTED)
        
        audit_log = self.repo.get_audit_log(record_id)
        self.assertEqual(audit_log[-1].action, "reject")
    
    def test_send_to_review(self):
        record_id = self._create_test_record()
        
        self.state_engine.transition(
            record_id=record_id,
            target_status=RecordStatus.NORMAL,
            changed_by="审核员",
            reason="初步通过"
        )
        
        record = self.state_engine.send_to_review(
            record_id=record_id,
            sent_by="复核员",
            reason="需要进一步核实"
        )
        
        self.assertEqual(record.status, RecordStatus.PENDING_REVIEW)
        
        audit_log = self.repo.get_audit_log(record_id)
        self.assertEqual(audit_log[-1].action, "send_to_review")


class TestReviewService(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.conn = init_db(self.db_path)
        self.repo = RecordRepository(self.conn)
        self.ingestion = DataIngestionService(self.repo)
        self.detector = AnomalyDetector(self.repo)
        self.state_engine = StateEngine(self.repo)
        self.review = ReviewService(self.repo, self.state_engine)
    
    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)
    
    def test_get_pending_queue(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "bad_unit",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        self.detector.run_all_checks(record_id)
        
        queue = self.review.get_pending_queue()
        self.assertEqual(len(queue), 1)
        self.assertEqual(queue[0]["queue_item"]["issue_type"], "unit_mismatch")
        self.assertIsNotNone(queue[0]["record"])
        self.assertIsNotNone(queue[0]["source"])
    
    def test_get_pending_queue_by_type(self):
        data1 = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "bad_unit",
            "model_version": "v2.1.0"
        }
        
        data2 = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点B",
            "pollutant": "氨氮",
            "value": 5.8,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"confidence_threshold": 0.8},
            "overridden_constraints": {"confidence_threshold": 0.5}
        }
        
        rid1 = self.ingestion.ingest_from_dict(data=data1)
        rid2 = self.ingestion.ingest_from_dict(data=data2)
        
        self.detector.run_all_checks(rid1)
        self.detector.run_all_checks(rid2)
        
        unit_queue = self.review.get_pending_queue(issue_type=IssueType.UNIT_MISMATCH)
        self.assertEqual(len(unit_queue), 1)
        self.assertEqual(unit_queue[0]["queue_item"]["issue_type"], "unit_mismatch")
        
        constraint_queue = self.review.get_pending_queue(issue_type=IssueType.CONSTRAINT_OVERRIDDEN)
        self.assertEqual(len(constraint_queue), 1)
        self.assertEqual(constraint_queue[0]["queue_item"]["issue_type"], "constraint_overridden")
    
    def test_resolve_pending_issue_accept(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "bad_unit",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        self.detector.run_all_checks(record_id)
        
        pending_items = self.repo.get_pending_items_for_record(record_id)
        self.assertEqual(len(pending_items), 1)
        queue_id = pending_items[0].queue_id
        
        self.review.resolve_pending_issue(
            queue_id=queue_id,
            reviewed_by="王主任",
            resolution="经核实，该单位为临时标准，已确认有效",
            accept=True
        )
        
        record = self.repo.get_record(record_id)
        self.assertEqual(record.status, RecordStatus.NORMAL)
        
        resolved_items = self.repo.get_pending_items_for_record(record_id, active_only=True)
        self.assertEqual(len(resolved_items), 0)
        
        all_items = self.repo.get_pending_items_for_record(record_id, active_only=False)
        self.assertFalse(all_items[0].is_active)
        self.assertEqual(all_items[0].reviewed_by, "王主任")
        self.assertEqual(all_items[0].resolution, "经核实，该单位为临时标准，已确认有效")
    
    def test_resolve_pending_issue_reject(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "bad_unit",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        self.detector.run_all_checks(record_id)
        
        pending_items = self.repo.get_pending_items_for_record(record_id)
        queue_id = pending_items[0].queue_id
        
        self.review.resolve_pending_issue(
            queue_id=queue_id,
            reviewed_by="李主任",
            resolution="单位确实错误，需要重新录入",
            accept=False
        )
        
        record = self.repo.get_record(record_id)
        self.assertEqual(record.status, RecordStatus.REJECTED)
    
    def test_resolve_record_issues(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 1000,
            "unit": "bad_unit",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100},
            "overridden_constraints": {"max_value": 1000}
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        self.detector.run_all_checks(record_id)
        
        pending_before = self.repo.get_pending_items_for_record(record_id)
        self.assertGreaterEqual(len(pending_before), 2)
        
        self.review.review_and_resolve_all(
            record_id=record_id,
            reviewed_by="张主任",
            accept=False,
            resolution="数据存在多处问题，予以退回"
        )
        
        record = self.repo.get_record(record_id)
        self.assertEqual(record.status, RecordStatus.REJECTED)
        
        pending_after = self.repo.get_pending_items_for_record(record_id, active_only=True)
        self.assertEqual(len(pending_after), 0)
    
    def test_get_review_summary(self):
        data1 = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "mg/L",
            "model_version": "v2.1.0"
        }
        
        data2 = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点B",
            "pollutant": "氨氮",
            "value": 5.8,
            "unit": "bad_unit",
            "model_version": "v2.1.0"
        }
        
        rid1 = self.ingestion.ingest_from_dict(data=data1)
        rid2 = self.ingestion.ingest_from_dict(data=data2)
        
        self.state_engine.approve(rid1, "审核员", "正常")
        self.detector.run_all_checks(rid2)
        
        summary = self.review.get_review_summary()
        
        self.assertEqual(summary["total_records"], 2)
        self.assertEqual(summary["by_status"]["normal"], 1)
        self.assertEqual(summary["by_status"]["pending_review"], 1)
        self.assertEqual(summary["pending_count"], 1)
        self.assertEqual(summary["pending_by_type"]["unit_mismatch"], 1)
    
    def test_get_controversial_records(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 1000,
            "unit": "bad_unit",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100},
            "overridden_constraints": {"max_value": 1000}
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        self.detector.run_all_checks(record_id)
        
        controversial = self.review.get_controversial_records(min_issues=2)
        self.assertEqual(len(controversial), 1)
        self.assertEqual(controversial[0]["record_id"], record_id)
        self.assertGreaterEqual(controversial[0]["issue_count"], 2)
    
    def test_get_review_history(self):
        data = {
            "sample_time": datetime.now().isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "bad_unit",
            "model_version": "v2.1.0"
        }
        
        record_id = self.ingestion.ingest_from_dict(data=data)
        self.detector.run_all_checks(record_id)
        
        pending_items = self.repo.get_pending_items_for_record(record_id)
        self.review.resolve_pending_issue(
            queue_id=pending_items[0].queue_id,
            reviewed_by="审核员",
            resolution="确认无误",
            accept=True
        )
        
        history = self.review.get_record_review_history(record_id)
        self.assertGreaterEqual(len(history), 3)
        
        actions = [h.get("action") for h in history if h.get("type") == "audit"]
        self.assertIn("create", actions)
        self.assertIn("mark_pending", actions)
        self.assertIn("resolve_pending", actions)
        self.assertIn("approve", actions)


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
    
    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)
    
    def test_full_workflow(self):
        system = RiverPollutionSystem(db_path=self.db_path, reset=True)
        
        try:
            data1 = {
                "sample_time": datetime.now().isoformat(),
                "location": "监测点A",
                "pollutant": "COD",
                "value": 45.2,
                "unit": "mg/L",
                "model_version": "v2.1.0",
                "constraints": {"max_value": 100},
                "overridden_constraints": {}
            }
            
            data2 = {
                "sample_time": datetime.now().isoformat(),
                "location": "监测点B",
                "pollutant": "氨氮",
                "value": 5.8,
                "unit": "mg/L",
                "model_version": "v2.1.0",
                "constraints": {"confidence_threshold": 0.8},
                "overridden_constraints": {"confidence_threshold": 0.5}
            }
            
            rid1 = system.ingest_data(data1, uploaded_by="数据员A", auto_detect=True)
            rid2 = system.ingest_data(data2, uploaded_by="数据员B", auto_detect=True)
            
            record1 = system.repo.get_record(rid1)
            record2 = system.repo.get_record(rid2)
            
            self.assertEqual(record1.status, RecordStatus.NORMAL)
            self.assertEqual(record2.status, RecordStatus.PENDING_REVIEW)
            
            pending = system.get_pending_queue()
            self.assertEqual(len(pending), 1)
            self.assertEqual(pending[0]["queue_item"]["record_id"], rid2)
            self.assertEqual(pending[0]["queue_item"]["issue_type"], "constraint_overridden")
            
            system.resolve_record_issues(
                record_id=rid2,
                reviewed_by="李主任",
                accept=True,
                resolution="该约束调整经过审批，允许使用较低置信阈值"
            )
            
            record2_after = system.repo.get_record(rid2)
            self.assertEqual(record2_after.status, RecordStatus.NORMAL)
            
            pending_after = system.get_pending_queue()
            self.assertEqual(len(pending_after), 0)
            
            trace = system.get_record_trace(rid2)
            self.assertIn("record", trace)
            self.assertIn("source", trace)
            self.assertIn("audit_log", trace)
            self.assertIn("pending_items", trace)
            self.assertGreaterEqual(len(trace["audit_log"]), 3)
            
            history = system.get_review_history(rid2)
            self.assertGreaterEqual(len(history), 3)
            
            summary = system.get_summary()
            self.assertEqual(summary["total_records"], 2)
            self.assertEqual(summary["by_status"]["normal"], 2)
            
            report = system.print_report(detailed=False)
            self.assertIn("河道污染反推系统", report)
            self.assertIn("总记录数: 2", report)
            self.assertIn("正常: 2条", report)
            
        finally:
            system.close()
    
    def test_mixed_data_scenarios(self):
        system = RiverPollutionSystem(db_path=self.db_path, reset=True)
        
        try:
            base_time = datetime.now()
            
            records = [
                {
                    "sample_time": base_time.isoformat(),
                    "location": "监测点A",
                    "pollutant": "COD",
                    "value": 45.2,
                    "unit": "mg/L",
                    "model_version": "v2.1.0",
                    "constraints": {"max_value": 100},
                    "overridden_constraints": {},
                    "metadata": {"type": "normal"}
                },
                {
                    "sample_time": (base_time + timedelta(minutes=8)).isoformat(),
                    "location": "监测点A",
                    "pollutant": "COD",
                    "value": 45.2,
                    "unit": "mg/L",
                    "model_version": "v2.1.0",
                    "constraints": {"max_value": 100},
                    "overridden_constraints": {},
                    "metadata": {"type": "duplicate"}
                },
                {
                    "sample_time": (base_time + timedelta(minutes=15)).isoformat(),
                    "location": "监测点A",
                    "pollutant": "COD",
                    "value": 42800,
                    "unit": "μg/L",
                    "model_version": "v2.1.0",
                    "constraints": {"max_value": 100, "confidence_threshold": 0.8},
                    "overridden_constraints": {"confidence_threshold": 0.5},
                    "metadata": {"type": "unit_mismatch_and_constraint"}
                },
                {
                    "sample_time": (base_time + timedelta(minutes=30)).isoformat(),
                    "location": "监测点B",
                    "pollutant": "氨氮",
                    "value": 5.8,
                    "unit": "mg/L",
                    "model_version": "v2.1.0",
                    "constraints": {"max_value": 10, "confidence_threshold": 0.8},
                    "overridden_constraints": {"confidence_threshold": 0.5},
                    "metadata": {"type": "constraint_override"}
                },
                {
                    "sample_time": (base_time + timedelta(minutes=60)).isoformat(),
                    "location": "监测点C",
                    "pollutant": "总磷",
                    "value": 0.85,
                    "unit": "mg/L",
                    "model_version": "v2.0.0",
                    "constraints": {"max_value": 2},
                    "overridden_constraints": {},
                    "metadata": {"type": "result_drift_1"}
                },
                {
                    "sample_time": (base_time + timedelta(minutes=62)).isoformat(),
                    "location": "监测点C",
                    "pollutant": "总磷",
                    "value": 1.25,
                    "unit": "mg/L",
                    "model_version": "v2.1.0",
                    "constraints": {"max_value": 2},
                    "overridden_constraints": {},
                    "metadata": {"type": "result_drift_2"}
                }
            ]
            
            for r in records:
                system.ingest_data(r, auto_detect=False)
            
            duplicates = system.find_duplicates()
            self.assertEqual(len(duplicates), 1)
            
            issues = system.run_detection_on_all()
            
            all_records = system.get_records()
            statuses = [r["status"] for r in all_records]
            
            self.assertIn("normal", statuses)
            self.assertIn("pending_review", statuses)
            
            pending_count = len([s for s in statuses if s == "pending_review"])
            self.assertGreaterEqual(pending_count, 4)
            
            controversial = system.get_controversial_records(min_issues=1)
            self.assertGreaterEqual(len(controversial), 4)
            
            report = system.print_report(detailed=True)
            self.assertIn("待处理问题", report)
            self.assertIn("高争议记录", report)
            self.assertIn("约束被覆盖", report)
            self.assertIn("单位混用", report)
            
        finally:
            system.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
