import unittest
import tempfile
import os
import shutil
from datetime import datetime
from models.data_models import FiringRecord, TemperaturePoint
from persistence.data_store import DataStore


class TestDataStore(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.store = DataStore(data_dir=self.temp_dir)
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_save_and_load_record(self):
        record = FiringRecord(
            record_id="TEST-001",
            name="测试记录",
            created_at=datetime(2024, 1, 15, 8, 0, 0)
        )
        record.notes = "这是一个测试记录"
        record.temperature_data = [
            TemperaturePoint(
                timestamp=datetime(2024, 1, 15, 8, 0, 0),
                temperatures={"上层": 25.0},
                elapsed_minutes=0
            )
        ]
        
        result = self.store.save(record)
        self.assertTrue(result)
        
        loaded = self.store.load("TEST-001")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.record_id, "TEST-001")
        self.assertEqual(loaded.name, "测试记录")
    
    def test_list_records(self):
        record1 = FiringRecord(
            record_id="TEST-001",
            name="测试记录1",
            created_at=datetime(2024, 1, 15, 8, 0, 0)
        )
        record2 = FiringRecord(
            record_id="TEST-002",
            name="测试记录2",
            created_at=datetime(2024, 1, 16, 8, 0, 0)
        )
        
        self.store.save(record1)
        self.store.save(record2)
        
        records = self.store.list_records()
        self.assertEqual(len(records), 2)
    
    def test_delete_record(self):
        record = FiringRecord(
            record_id="TEST-DELETE",
            name="要删除的记录",
            created_at=datetime(2024, 1, 15, 8, 0, 0)
        )
        
        self.store.save(record)
        self.assertIsNotNone(self.store.load("TEST-DELETE"))
        
        self.store.delete("TEST-DELETE")
        self.assertIsNone(self.store.load("TEST-DELETE"))
    
    def test_update_record(self):
        record = FiringRecord(
            record_id="TEST-UPDATE",
            name="原始名称",
            created_at=datetime(2024, 1, 15, 8, 0, 0)
        )
        
        self.store.save(record)
        
        loaded = self.store.load("TEST-UPDATE")
        loaded.name = "更新后的名称"
        loaded.notes = "添加了备注"
        
        self.store.save(loaded)
        
        reloaded = self.store.load("TEST-UPDATE")
        self.assertEqual(reloaded.name, "更新后的名称")
        self.assertEqual(reloaded.notes, "添加了备注")
    
    def test_record_exists(self):
        record = FiringRecord(
            record_id="TEST-EXISTS",
            name="测试存在性",
            created_at=datetime(2024, 1, 15, 8, 0, 0)
        )
        
        self.assertFalse(self.store.exists("TEST-EXISTS"))
        
        self.store.save(record)
        self.assertTrue(self.store.exists("TEST-EXISTS"))


if __name__ == "__main__":
    unittest.main()
