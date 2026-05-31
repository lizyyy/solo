#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest
import uuid
from datetime import datetime, timedelta

from models import (
    InspectionRecord, RecordSource, AlertLevel, RecordStatus,
    ThresholdConfig
)
from core_processor import (
    get_alert_level, check_threshold_cross, check_late_arrival,
    check_duplicates, check_sequence_errors, check_fluctuation
)
from config import PV_THRESHOLDS
from inspection_pipeline import InspectionPipeline
from error_messages import generate_user_friendly_message, format_audit_reason


class TestAlertLevelDetection(unittest.TestCase):
    def test_normal_voltage(self):
        level, desc = get_alert_level("直流输入电压", 600.0)
        self.assertEqual(level, AlertLevel.NORMAL)
    
    def test_warning_voltage_low(self):
        level, desc = get_alert_level("直流输入电压", 380.0)
        self.assertEqual(level, AlertLevel.WARNING)
    
    def test_alarm_voltage_high(self):
        level, desc = get_alert_level("直流输入电压", 900.0)
        self.assertEqual(level, AlertLevel.ALARM)
    
    def test_critical_voltage(self):
        level, desc = get_alert_level("直流输入电压", 1100.0)
        self.assertEqual(level, AlertLevel.CRITICAL)
    
    def test_normal_power(self):
        level, desc = get_alert_level("交流输出功率", 50.0)
        self.assertEqual(level, AlertLevel.NORMAL)
    
    def test_alarm_power_low(self):
        level, desc = get_alert_level("交流输出功率", 0.3)
        self.assertEqual(level, AlertLevel.ALARM)
    
    def test_unknown_metric(self):
        level, desc = get_alert_level("未知指标", 100.0)
        self.assertEqual(level, AlertLevel.NORMAL)


class TestThresholdCross(unittest.TestCase):
    def test_no_cross_same_level(self):
        crossed, old, new, reason = check_threshold_cross(600.0, 650.0, "直流输入电压")
        self.assertFalse(crossed)
        self.assertIsNone(old)
        self.assertIsNone(new)
    
    def test_cross_normal_to_warning(self):
        crossed, old, new, reason = check_threshold_cross(380.0, 600.0, "直流输入电压")
        self.assertTrue(crossed)
        self.assertEqual(old, AlertLevel.NORMAL)
        self.assertEqual(new, AlertLevel.WARNING)
        self.assertIn("跨越阈值档位", reason)
    
    def test_cross_multiple_levels(self):
        crossed, old, new, reason = check_threshold_cross(300.0, 700.0, "直流输入电压")
        self.assertTrue(crossed)
        self.assertEqual(old, AlertLevel.NORMAL)
        self.assertEqual(new, AlertLevel.ALARM)
    
    def test_no_previous_value(self):
        crossed, old, new, reason = check_threshold_cross(600.0, None, "直流输入电压")
        self.assertFalse(crossed)
        self.assertIn("无历史数据", reason)


class TestLateArrival(unittest.TestCase):
    def test_on_time_data(self):
        record = InspectionRecord(
            record_id=str(uuid.uuid4()),
            device_id="INV-001",
            device_name="1号逆变器",
            metric_name="直流输入电压",
            metric_value=600.0,
            unit="V",
            collect_time=datetime(2026, 5, 30, 8, 0),
            receive_time=datetime(2026, 5, 30, 8, 1),
            source=RecordSource.AUTO
        )
        is_late, reason = check_late_arrival(record)
        self.assertFalse(is_late)
    
    def test_late_data(self):
        record = InspectionRecord(
            record_id=str(uuid.uuid4()),
            device_id="INV-001",
            device_name="1号逆变器",
            metric_name="直流输入电压",
            metric_value=600.0,
            unit="V",
            collect_time=datetime(2026, 5, 28, 8, 0),
            receive_time=datetime(2026, 5, 30, 8, 0),
            source=RecordSource.ATTACHMENT
        )
        is_late, reason = check_late_arrival(record)
        self.assertTrue(is_late)
        self.assertIn("延迟", reason)
        self.assertIn("48.0小时", reason)


class TestDuplicateDetection(unittest.TestCase):
    def test_no_duplicates(self):
        records = []
        base_time = datetime(2026, 5, 30, 8, 0)
        for i in range(3):
            records.append(InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id=f"INV-00{i+1}",
                device_name=f"{i+1}号逆变器",
                metric_name="直流输入电压",
                metric_value=600.0 + i * 10,
                unit="V",
                collect_time=base_time,
                receive_time=base_time + timedelta(minutes=i),
                source=RecordSource.AUTO
            ))
        
        duplicates = check_duplicates(records)
        self.assertEqual(len(duplicates), 0)
    
    def test_with_duplicates(self):
        records = []
        base_time = datetime(2026, 5, 30, 8, 0)
        for i in range(3):
            records.append(InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="直流输入电压",
                metric_value=720.0,
                unit="V",
                collect_time=base_time,
                receive_time=base_time + timedelta(minutes=i),
                source=RecordSource.AUTO
            ))
        
        duplicates = check_duplicates(records)
        self.assertEqual(len(duplicates), 1)
        group = list(duplicates.values())[0]
        self.assertEqual(group.duplicate_count, 2)
        self.assertEqual(len(group.records), 3)
        self.assertEqual(group.kept_record_id, records[0].record_id)


class TestSequenceErrors(unittest.TestCase):
    def test_no_sequence_error(self):
        base_time = datetime(2026, 5, 30, 8, 0)
        records = [
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="发电效率",
                metric_value=95.0,
                unit="%",
                collect_time=base_time,
                receive_time=base_time + timedelta(minutes=1),
                source=RecordSource.AUTO
            ),
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="发电效率",
                metric_value=85.0,
                unit="%",
                collect_time=base_time + timedelta(minutes=10),
                receive_time=base_time + timedelta(minutes=11),
                source=RecordSource.AUTO
            ),
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="发电效率",
                metric_value=75.0,
                unit="%",
                collect_time=base_time + timedelta(minutes=20),
                receive_time=base_time + timedelta(minutes=21),
                source=RecordSource.AUTO
            ),
        ]
        
        errors = check_sequence_errors(records)
        self.assertEqual(len(errors), 0)
    
    def test_with_sequence_error(self):
        base_time = datetime(2026, 5, 30, 8, 0)
        records = [
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="发电效率",
                metric_value=65.0,
                unit="%",
                collect_time=base_time,
                receive_time=base_time + timedelta(minutes=1),
                source=RecordSource.AUTO
            ),
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="发电效率",
                metric_value=92.0,
                unit="%",
                collect_time=base_time + timedelta(minutes=10),
                receive_time=base_time + timedelta(minutes=11),
                source=RecordSource.AUTO
            ),
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="发电效率",
                metric_value=78.0,
                unit="%",
                collect_time=base_time + timedelta(minutes=20),
                receive_time=base_time + timedelta(minutes=21),
                source=RecordSource.AUTO
            ),
        ]
        
        errors = check_sequence_errors(records)
        self.assertGreater(len(errors), 0)


class TestFluctuationDetection(unittest.TestCase):
    def test_no_fluctuation(self):
        base_time = datetime(2026, 5, 30, 8, 0)
        history = []
        for i in range(5):
            history.append(InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="交流输出功率",
                metric_value=80.0 + i,
                unit="kW",
                collect_time=base_time + timedelta(minutes=i * 5),
                receive_time=base_time + timedelta(minutes=i * 5 + 1),
                source=RecordSource.AUTO
            ))
        
        current = InspectionRecord(
            record_id=str(uuid.uuid4()),
            device_id="INV-001",
            device_name="1号逆变器",
            metric_name="交流输出功率",
            metric_value=82.0,
            unit="kW",
            collect_time=base_time + timedelta(minutes=30),
            receive_time=base_time + timedelta(minutes=31),
            source=RecordSource.AUTO
        )
        
        is_fluct, reason, values = check_fluctuation(current, history)
        self.assertFalse(is_fluct)
    
    def test_significant_fluctuation(self):
        base_time = datetime(2026, 5, 30, 8, 0)
        history = []
        for i in range(5):
            history.append(InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="交流输出功率",
                metric_value=90.0 + i,
                unit="kW",
                collect_time=base_time + timedelta(minutes=i * 5),
                receive_time=base_time + timedelta(minutes=i * 5 + 1),
                source=RecordSource.AUTO
            ))
        
        current = InspectionRecord(
            record_id=str(uuid.uuid4()),
            device_id="INV-001",
            device_name="1号逆变器",
            metric_name="交流输出功率",
            metric_value=40.0,
            unit="kW",
            collect_time=base_time + timedelta(minutes=30),
            receive_time=base_time + timedelta(minutes=31),
            source=RecordSource.AUTO
        )
        
        is_fluct, reason, values = check_fluctuation(current, history)
        self.assertTrue(is_fluct)
        self.assertIn("波动剧烈", reason)


class TestUserFriendlyMessages(unittest.TestCase):
    def test_threshold_cross_message(self):
        msg, suggestions = generate_user_friendly_message(
            "threshold_cross",
            device_name="1号逆变器",
            metric_name="直流输入电压",
            old_level="正常",
            new_level="报警",
            old_value=650,
            new_value=320,
            unit="V",
            cross_count=2
        )
        self.assertIn("阈值跨档提醒", msg)
        self.assertIn("1号逆变器", msg)
        self.assertIn("650V", msg)
        self.assertIn("320V", msg)
        self.assertGreater(len(suggestions), 0)
    
    def test_duplicate_alert_message(self):
        msg, suggestions = generate_user_friendly_message(
            "duplicate_alert",
            device_name="3号逆变器",
            metric_name="直流输入电压",
            count=2,
            first_time="2026-05-30 08:45",
            operator="系统"
        )
        self.assertIn("重复报警确认", msg)
        self.assertIn("3号逆变器", msg)
    
    def test_unknown_error_type(self):
        msg, suggestions = generate_user_friendly_message("unknown_error")
        self.assertIn("说不清楚的问题", msg)


class TestAuditFormatting(unittest.TestCase):
    def test_format_audit_reason(self):
        reason = "阈值跨档检测"
        evidence = {
            "previous_value": 650,
            "current_value": 320,
            "collect_time": "2026-05-30 08:15",
            "operator": "张工"
        }
        formatted = format_audit_reason(reason, evidence)
        self.assertIn("阈值跨档检测", formatted)
        self.assertIn("之前的值：650", formatted)
        self.assertIn("现在的值：320", formatted)
        self.assertIn("操作人：张工", formatted)


class TestFullPipeline(unittest.TestCase):
    def test_pipeline_with_mixed_data(self):
        from test_data import generate_test_records
        
        records = generate_test_records()
        self.assertGreater(len(records), 0)
        
        pipeline = InspectionPipeline()
        results = pipeline.process_batch(records)
        self.assertEqual(len(results), len(records))
        
        report = pipeline.generate_report(results)
        self.assertEqual(report.total_records, len(records))
        
        self.assertGreater(report.pending_count, 0)
        self.assertGreater(report.duplicate_count, 0)
        self.assertGreater(report.threshold_cross_count, 0)
        self.assertGreater(report.late_arrival_count, 0)
        self.assertGreater(report.sequence_error_count, 0)
    
    def test_pending_review_logic(self):
        base_time = datetime(2026, 5, 30, 8, 0)
        records = [
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="直流输入电压",
                metric_value=650.0,
                unit="V",
                collect_time=base_time,
                receive_time=base_time + timedelta(minutes=1),
                source=RecordSource.AUTO
            ),
            InspectionRecord(
                record_id=str(uuid.uuid4()),
                device_id="INV-001",
                device_name="1号逆变器",
                metric_name="直流输入电压",
                metric_value=320.0,
                unit="V",
                collect_time=base_time + timedelta(minutes=15),
                receive_time=base_time + timedelta(minutes=16),
                source=RecordSource.AUTO
            ),
        ]
        
        pipeline = InspectionPipeline()
        results = pipeline.process_batch(records)
        
        self.assertFalse(results[0].is_pending_review)
        self.assertEqual(results[0].status, RecordStatus.NORMAL)
        
        self.assertTrue(results[1].is_pending_review)
        self.assertEqual(results[1].status, RecordStatus.THRESHOLD_CROSS)
        self.assertIsNotNone(results[1].user_friendly_message)
        self.assertIn("阈值跨档", results[1].user_friendly_message)
        self.assertGreater(len(results[1].audit_trails), 0)
    
    def test_report_formatting(self):
        from test_data import generate_test_records
        
        records = generate_test_records()
        pipeline = InspectionPipeline()
        results = pipeline.process_batch(records)
        report = pipeline.generate_report(results)
        display = pipeline.format_report_for_display(report)
        
        self.assertIn("光伏逆变器波动巡检报告", display)
        self.assertIn("待确认记录详情", display)
        self.assertIn("正常记录", display)
        self.assertIn("值班长请重点复核", display)


if __name__ == "__main__":
    unittest.main(verbosity=2)
