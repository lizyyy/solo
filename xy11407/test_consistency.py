import unittest
import json
from datetime import datetime
from core import QueueService
from models import (
    MedicineRecordCreate, QueueStatus, RetryCategory,
    DirtyType
)


class TestDataConsistency(unittest.TestCase):
    def setUp(self):
        self.service = QueueService("sqlite:///:memory:")
    
    def test_full_workflow_consistency(self):
        data = MedicineRecordCreate(
            store_id="ST001",
            store_name="乡镇一店",
            medicine_id="MED001",
            medicine_name="阿莫西林胶囊",
            batch_no="B20240101",
            expiry_date="2025-12-31",
            quantity=100.0,
            amount=500.0,
            source_type="inventory_export"
        )
        record = self.service.create_medicine_record(data, operator="user1")
        self.assertEqual(record.quantity, 100.0)
        self.assertEqual(record.amount, 500.0)
        
        queue_item = self.service.enqueue_record(record.id, region_id="R001")
        self.assertEqual(queue_item.status, QueueStatus.PENDING)
        self.assertEqual(queue_item.current_quantity, 100.0)
        
        detail = self.service.get_queue_item_detail(queue_item.id)
        self.assertEqual(detail["status"], QueueStatus.PENDING)
        self.assertEqual(detail["medicine"]["quantity"], 100.0)
        self.assertEqual(detail["current"]["quantity"], 100.0)
        
        queue_item = self.service.submit_external_receipt(
            queue_item.id, "EXT001", {"status": "processing"}, operator="system"
        )
        self.assertEqual(queue_item.status, QueueStatus.PROCESSING)
        self.assertEqual(queue_item.external_receipt_no, "EXT001")
        
        detail = self.service.get_queue_item_detail(queue_item.id)
        self.assertEqual(detail["external"]["receipt_no"], "EXT001")
        self.assertEqual(detail["status"], QueueStatus.PROCESSING)
        
        history = self.service.get_queue_item_history(queue_item.id)
        statuses = [h["to_status"] for h in history]
        self.assertIn(QueueStatus.PENDING, statuses)
        self.assertIn(QueueStatus.PROCESSING, statuses)
    
    def test_retry_consistency(self):
        data = MedicineRecordCreate(
            store_id="ST001",
            store_name="乡镇一店",
            medicine_id="MED002",
            medicine_name="布洛芬片",
            batch_no="B20240201",
            expiry_date="2025-06-30",
            quantity=50.0,
            amount=250.0,
            source_type="transfer_note"
        )
        record = self.service.create_medicine_record(data)
        queue_item = self.service.enqueue_record(record.id, max_retries=3)
        
        queue_item, log1 = self.service.process_retry(
            queue_item.id, RetryCategory.NETWORK_ERROR,
            error_message="连接超时", success=False
        )
        self.assertEqual(queue_item.retry_count, 1)
        self.assertEqual(queue_item.status, QueueStatus.RETRYING)
        
        queue_item, log2 = self.service.process_retry(
            queue_item.id, RetryCategory.EXTERNAL_TIMEOUT,
            error_message="外部系统无响应", success=False
        )
        self.assertEqual(queue_item.retry_count, 2)
        
        queue_item, log3 = self.service.process_retry(
            queue_item.id, RetryCategory.INVALID_RECEIPT,
            error_message="回执格式错误", success=False
        )
        self.assertEqual(queue_item.retry_count, 3)
        self.assertEqual(queue_item.status, QueueStatus.MANUAL)
        
        history = self.service.get_queue_item_history(queue_item.id)
        self.assertEqual(len(history), 5)
        
        retries = self.service.get_retry_logs(queue_item.id)
        self.assertEqual(len(retries), 3)
        self.assertEqual(retries[0]["attempt_no"], 1)
        self.assertEqual(retries[1]["attempt_no"], 2)
        self.assertEqual(retries[2]["attempt_no"], 3)
        
        detail = self.service.get_queue_item_detail(queue_item.id)
        self.assertEqual(len(detail["retries"]), 3)
        self.assertEqual(len(detail["history"]), 5)
    
    def test_compensation_consistency(self):
        data = MedicineRecordCreate(
            store_id="ST002",
            store_name="乡镇二店",
            medicine_id="MED003",
            medicine_name="头孢克肟",
            batch_no="B20240301",
            expiry_date="2025-09-30",
            quantity=80.0,
            amount=800.0,
            source_type="return_photo"
        )
        record = self.service.create_medicine_record(data)
        queue_item = self.service.enqueue_record(record.id)
        
        queue_item, comp = self.service.compensate_record(
            queue_item.id, 20.0, 200.0,
            {"rule": "损耗补偿", "rate": 0.25},
            operator="manager1", notes="近效期报损"
        )
        
        self.assertEqual(queue_item.status, QueueStatus.COMPENSATED)
        self.assertEqual(queue_item.current_quantity, 60.0)
        self.assertEqual(queue_item.current_amount, 600.0)
        self.assertEqual(comp.compensated_quantity, 20.0)
        
        detail = self.service.get_queue_item_detail(queue_item.id)
        self.assertEqual(detail["current"]["quantity"], 60.0)
        self.assertEqual(detail["current"]["amount"], 600.0)
        self.assertEqual(detail["status"], QueueStatus.COMPENSATED)
        
        history = self.service.get_queue_item_history(queue_item.id)
        compensated_entry = next(
            (h for h in history if h["to_status"] == QueueStatus.COMPENSATED), None
        )
        self.assertIsNotNone(compensated_entry)
        self.assertIn("current_quantity", compensated_entry["diff_fields"])
        self.assertIn("current_amount", compensated_entry["diff_fields"])
    
    def test_close_consistency(self):
        data = MedicineRecordCreate(
            store_id="ST001",
            store_name="乡镇一店",
            medicine_id="MED004",
            medicine_name="维生素C片",
            batch_no="B20240401",
            expiry_date="2026-03-31",
            quantity=200.0,
            amount=100.0,
            source_type="sms_screenshot"
        )
        record = self.service.create_medicine_record(data)
        queue_item = self.service.enqueue_record(record.id)
        
        queue_item = self.service.close_queue_item(
            queue_item.id, operator="supervisor", reason="流程完成"
        )
        self.assertEqual(queue_item.status, QueueStatus.CLOSED)
        
        detail = self.service.get_queue_item_detail(queue_item.id)
        self.assertEqual(detail["status"], QueueStatus.CLOSED)
        
        history = self.service.get_queue_item_history(queue_item.id)
        closed_entry = next(
            (h for h in history if h["to_status"] == QueueStatus.CLOSED), None
        )
        self.assertIsNotNone(closed_entry)
        self.assertEqual(closed_entry["reason"], "流程完成")
    
    def test_export_and_detail_consistency(self):
        for i in range(3):
            data = MedicineRecordCreate(
                store_id=f"ST{i+1:03d}",
                store_name=f"门店{i+1}",
                medicine_id=f"MED{i+1:03d}",
                medicine_name=f"药品{i+1}",
                batch_no=f"BATCH{i+1}",
                expiry_date="2025-12-31",
                quantity=100.0 + i * 10,
                amount=500.0 + i * 50,
                source_type="test"
            )
            record = self.service.create_medicine_record(data)
            self.service.enqueue_record(record.id)
        
        export_data = self.service.export_queue_data()
        self.assertEqual(len(export_data), 3)
        
        for export_item in export_data:
            detail = self.service.get_queue_item_detail(
                self.service.list_queue_items(limit=1)[0].id
                if export_item["queue_no"] == export_data[0]["queue_no"]
                else self.service.list_queue_items(limit=1)[0].id
            )
            
            self.assertEqual(export_item["status"], detail["status"])
            self.assertEqual(export_item["retry_count"], detail["retry_count"])
            self.assertEqual(export_item["medicine"]["quantity"], detail["medicine"]["quantity"])
            self.assertEqual(export_item["current"]["quantity"], detail["current"]["quantity"])
    
    def test_dirty_record_handling(self):
        incomplete_data = {
            "store_id": "ST001",
            "medicine_id": "MED001",
            "quantity": 100.0
        }
        
        is_dirty, dirty_type, dirty_fields, details = self.service.detect_dirty_record(
            incomplete_data
        )
        
        self.assertTrue(is_dirty)
        self.assertEqual(dirty_type, DirtyType.MISSING_FIELD)
        self.assertIn("batch_no", dirty_fields)
        self.assertIn("amount", dirty_fields)
        
        dirty = self.service.create_dirty_record(
            dirty_type, incomplete_data, dirty_fields,
            details, source_ref="import_20240101.csv"
        )
        self.assertEqual(dirty.status, "pending")
        self.assertEqual(dirty.dirty_type, DirtyType.MISSING_FIELD.value)
        
        resolved = self.service.resolve_dirty_record(
            dirty.id, resolver="admin",
            processing_opinion="补充缺失字段",
            corrected_content={
                "store_id": "ST001",
                "medicine_id": "MED001",
                "batch_no": "B20240101",
                "quantity": 100.0,
                "amount": 500.0,
                "expiry_date": "2025-12-31"
            }
        )
        
        self.assertEqual(resolved.status, "resolved")
        self.assertEqual(resolved.resolver, "admin")
        self.assertIsNotNone(resolved.resolved_at)
    
    def test_supervisor_stats(self):
        for i in range(5):
            data = MedicineRecordCreate(
                store_id=f"ST{i+1:03d}",
                store_name=f"门店{i+1}",
                medicine_id=f"MED{i+1:03d}",
                medicine_name=f"药品{i+1}",
                batch_no=f"B{i:06d}",
                expiry_date="2025-12-31",
                quantity=100.0,
                amount=500.0,
                source_type="test"
            )
            record = self.service.create_medicine_record(data)
            queue_item = self.service.enqueue_record(record.id)
            
            if i < 3:
                self.service.process_retry(
                    queue_item.id, RetryCategory.NETWORK_ERROR,
                    error_message="test", success=False
                )
            if i == 4:
                self.service.close_queue_item(
                    queue_item.id, operator="test", reason="done"
                )
        
        stats = self.service.get_supervisor_stats()
        self.assertIsInstance(stats.retry_by_category, dict)
        self.assertGreater(len(stats.retry_by_category), 0)
        self.assertIsInstance(stats.recovery_rate, float)
        self.assertGreaterEqual(stats.recovery_rate, 0.0)
        self.assertLessEqual(stats.recovery_rate, 1.0)
        self.assertGreaterEqual(stats.closed_today, 0)
    
    def test_diff_computation(self):
        before = {
            "status": "pending",
            "quantity": 100.0,
            "amount": 500.0
        }
        after = {
            "status": "processing",
            "quantity": 80.0,
            "amount": 500.0,
            "extra": "new_field"
        }
        
        diff_fields, diff_summary = QueueService.compute_diff(before, after)
        
        self.assertIn("status", diff_fields)
        self.assertIn("quantity", diff_fields)
        self.assertIn("extra", diff_fields)
        self.assertNotIn("amount", diff_fields)
        
        self.assertEqual(diff_summary["status"]["before"], "pending")
        self.assertEqual(diff_summary["status"]["after"], "processing")
        self.assertEqual(diff_summary["quantity"]["before"], 100.0)
        self.assertEqual(diff_summary["quantity"]["after"], 80.0)


if __name__ == "__main__":
    unittest.main()
