"""测试CSV清洗引擎"""
import os
import sys
import tempfile
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from csv_cleaner.models import (
    CleaningContext, CSVRecord, RecordStatus, OperationType, LedgerEntry
)
from csv_cleaner.engine import CSVCleaningEngine, generate_batch_id
from csv_cleaner.errors import (
    DuplicateBatchError, LedgerConsistencyError, EmptyFilterResult,
    PathSpaceWarning, translate_error
)


class TestCSVRecord(unittest.TestCase):
    """测试CSV记录模型"""

    def test_path_space_detection(self):
        """测试路径空格检测"""
        record = CSVRecord(
            row_id="test_1",
            source_file="test.csv",
            source_row_number=1,
            data={"file_path": "/data/path with spaces/file.zip", "工单号": "WO001"}
        )
        self.assertTrue(record.has_path_space)
        self.assertEqual(record.normalized_path, "/data/path with spaces/file.zip")
        self.assertIn("路径空格已修正", record.notes)

    def test_no_path_space(self):
        """测试无空格路径"""
        record = CSVRecord(
            row_id="test_2",
            source_file="test.csv",
            source_row_number=2,
            data={"file_path": "/data/normal/path.zip", "工单号": "WO002"}
        )
        self.assertFalse(record.has_path_space)
        self.assertEqual(record.notes, "")

    def test_hash_computation(self):
        """测试哈希计算"""
        data = {"工单号": "WO001", "处理结果": "成功"}
        record1 = CSVRecord("t1", "f.csv", 1, data)
        record2 = CSVRecord("t2", "f.csv", 2, data)
        self.assertEqual(record1.record_hash, record2.record_hash)

    def test_manual_correction_detection(self):
        """测试人工更正检测"""
        engine = self._create_engine()
        
        record = CSVRecord("t1", "f.csv", 1, {
            "工单号": "WO001",
            "备注": "人工更正：状态改为成功",
            "is_correction": "是"
        })
        self.assertTrue(engine._detect_manual_correction(record))

    def test_late_arrival_detection(self):
        """测试晚到附件检测"""
        engine = self._create_engine()
        
        record = CSVRecord("t1", "f.csv", 1, {
            "工单号": "WO001",
            "备注": "晚到附件",
            "is_late": "是"
        })
        self.assertTrue(engine._detect_late_arrival(record))

    def _create_engine(self):
        context = CleaningContext(session_id="test")
        return CSVCleaningEngine(context)


class TestCleaningEngine(unittest.TestCase):
    """测试清洗引擎"""

    def setUp(self):
        self.context = CleaningContext(session_id="test", operator="测试员")
        self.engine = CSVCleaningEngine(self.context)

    def _add_records(self):
        """添加测试记录"""
        records_data = [
            (1, {"工单号": "WO001", "file_path": "/data/normal.zip", "处理结果": "成功"}, RecordStatus.NORMAL),
            (2, {"工单号": "WO001", "file_path": "/data/normal.zip", "处理结果": "成功"}, RecordStatus.DUPLICATE),
            (3, {"工单号": "WO002", "file_path": "/data/path with space.zip", "处理结果": "成功"}, RecordStatus.NORMAL),
            (4, {"工单号": "WO002", "file_path": "/data/late.zip", "处理结果": "成功", "is_late": "是"}, RecordStatus.LATE_ARRIVAL),
            (5, {"工单号": "WO001", "file_path": "/data/corr.zip", "处理结果": "更正", "is_correction": "是", "original_id": "rec_1"}, RecordStatus.MANUAL_CORRECTION),
        ]
        
        for row_num, data, expected_status in records_data:
            record = CSVRecord(
                row_id=f"rec_{row_num}",
                source_file="test.csv",
                source_row_number=row_num,
                data=data
            )
            record.status = expected_status
            if expected_status == RecordStatus.LATE_ARRIVAL:
                record.is_late_arrival = True
            if expected_status == RecordStatus.MANUAL_CORRECTION:
                record.is_manual_correction = True
            self.context.add_record(record)

    def test_deduplication(self):
        """测试去重功能"""
        self._add_records()
        before_count = len(self.context.records)
        
        removed_count, removed_ids = self.engine.remove_duplicates()
        
        self.assertEqual(removed_count, 1)
        self.assertEqual(len(self.context.records), before_count - 1)
        
        hashes = set()
        for rec in self.context.records.values():
            self.assertNotIn(rec.record_hash, hashes)
            hashes.add(rec.record_hash)

    def test_path_space_fix(self):
        """测试路径空格修复"""
        self._add_records()
        
        fixed_count, fixed_ids = self.engine.fix_path_spaces()
        
        self.assertEqual(fixed_count, 1)
        for rec_id in fixed_ids:
            rec = self.context.records.get(rec_id)
            self.assertIsNotNone(rec)
            self.assertIn("路径空格已修复", rec.notes)

    def test_late_arrival_merge(self):
        """测试晚到附件合并"""
        self._add_records()
        
        merged_count, merged_ids = self.engine.merge_late_arrivals()
        
        self.assertEqual(merged_count, 1)
        late_rec = next(r for r in self.context.records.values() if r.status == RecordStatus.LATE_ARRIVAL)
        self.assertIsNotNone(late_rec.late_for_record_id)

    def test_manual_correction_apply(self):
        """测试人工更正应用"""
        self._add_records()
        
        applied_count, applied_ids = self.engine.apply_manual_corrections()
        
        self.assertEqual(applied_count, 1)
        corr_rec = next(r for r in self.context.records.values() if r.status == RecordStatus.MANUAL_CORRECTION)
        self.assertIsNotNone(corr_rec.corrects_record_id)

    def test_full_cleaning(self):
        """测试完整清洗流程"""
        self._add_records()
        before_count = len(self.context.records)
        
        results = self.engine.run_full_cleaning()
        
        self.assertIn("去重", results)
        self.assertIn("修复路径空格", results)
        self.assertIn("合并晚到附件", results)
        self.assertIn("应用人工更正", results)
        
        self.assertLess(len(self.context.records), before_count)

    def test_batch_id_generation(self):
        """测试批次ID生成（幂等性基础）"""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(b"col1,col2\n1,2\n")
            temp_path = f.name
        
        try:
            batch_id1 = generate_batch_id([temp_path])
            batch_id2 = generate_batch_id([temp_path])
            self.assertEqual(batch_id1, batch_id2)
        finally:
            os.unlink(temp_path)

    def test_duplicate_batch_detection(self):
        """测试重复批次检测"""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
            f.write("工单号,file_path\nWO001,/test.zip\n")
            temp_path = f.name
        
        try:
            self.engine.load_csv_files([temp_path])
            
            with self.assertRaises(DuplicateBatchError):
                self.engine.load_csv_files([temp_path])
            
            loaded, _ = self.engine.load_csv_files([temp_path], force=True)
            self.assertGreater(loaded, 0)
        finally:
            os.unlink(temp_path)

    def test_ledger_consistency(self):
        """测试账本一致性校验"""
        self._add_records()
        self.engine.remove_duplicates()
        
        self.assertGreater(len(self.context.ledger), 0)
        last_entry = self.context.ledger[-1]
        self.assertEqual(last_entry.operation, OperationType.DEDUP)
        self.assertIsNotNone(last_entry.screen_range_start)
        self.assertIsNotNone(last_entry.screen_range_end)
        self.assertEqual(last_entry.operator, "测试员")

    def test_screen_range_and_ledger(self):
        """测试屏幕范围和账本一致性"""
        self._add_records()
        records = self.engine.refresh_screen()
        
        self.assertEqual(len(records), min(5, self.context.page_size))
        
        last_entry = self.context.ledger[-1]
        self.assertEqual(last_entry.operation, OperationType.SCREEN_REFRESH)
        self.assertEqual(last_entry.screen_range_start, self.context.screen_range_start)
        self.assertEqual(last_entry.screen_range_end, self.context.screen_range_end)
        self.assertEqual(len(last_entry.record_ids), len(records))

    def test_filter_change(self):
        """测试筛选条件变更"""
        self._add_records()
        
        records = self.engine.change_filter(status="正常")
        for rec in records:
            self.assertEqual(rec.status, RecordStatus.NORMAL)
        
        last_entry = self.context.ledger[-1]
        self.assertEqual(last_entry.operation, OperationType.FILTER_CHANGE)
        self.assertEqual(last_entry.filter_conditions, {"status": "正常"})

    def test_empty_filter_error(self):
        """测试空筛选结果错误"""
        self._add_records()
        
        with self.assertRaises(EmptyFilterResult):
            self.engine.change_filter(status="不存在的状态")

    def test_pagination(self):
        """测试分页功能"""
        for i in range(60):
            record = CSVRecord(
                row_id=f"rec_{i}",
                source_file="test.csv",
                source_row_number=i + 1,
                data={"工单号": f"WO{i:03d}", "file_path": f"/data/file_{i}.zip"}
            )
            self.context.add_record(record)
        
        self.context.page_size = 10
        
        self.context.set_page(1)
        page1 = self.engine.refresh_screen()
        self.assertEqual(len(page1), 10)
        self.assertEqual(page1[0].data["工单号"], "WO000")
        
        self.context.set_page(2)
        page2 = self.engine.refresh_screen()
        self.assertEqual(len(page2), 10)
        self.assertEqual(page2[0].data["工单号"], "WO010")

    def test_export(self):
        """测试导出功能"""
        self._add_records()
        self.engine.run_full_cleaning()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "result.csv")
            data_file, ledger_file = self.engine.export_cleaned_data(output_path)
            
            self.assertTrue(os.path.exists(data_file))
            self.assertTrue(os.path.exists(ledger_file))
            
            self.assertTrue(os.path.getsize(data_file) > 0)
            self.assertTrue(os.path.getsize(ledger_file) > 0)

    def test_idempotent_operations(self):
        """测试操作幂等性"""
        self._add_records()
        initial_count = len(self.context.records)
        
        self.engine.remove_duplicates()
        count1 = len(self.context.records)
        
        self.engine.remove_duplicates()
        count2 = len(self.context.records)
        
        self.assertEqual(count1, count2)
        self.assertLess(count1, initial_count)

    def test_statistics(self):
        """测试统计信息"""
        self._add_records()
        
        stats = self.engine.get_statistics()
        
        self.assertIn("总记录数", stats)
        self.assertIn("状态分布", stats)
        self.assertIn("含路径空格", stats)
        self.assertIn("重复项", stats)
        self.assertIn("晚到附件", stats)
        self.assertIn("人工更正", stats)
        self.assertEqual(stats["总记录数"], len(self.context.records))


class TestErrorTranslation(unittest.TestCase):
    """测试错误翻译功能"""

    def test_file_not_found_translation(self):
        """测试文件不存在错误翻译"""
        err = FileNotFoundError("No such file or directory: 'test.csv'")
        translated = translate_error(err, file_path="test.csv")
        
        self.assertIn("找不到这个文件", translated.user_message)
        self.assertIn("test.csv", translated.user_message)
        self.assertTrue(len(translated.suggestion) > 0)  # 建议字段有内容即可

    def test_permission_error_translation(self):
        """测试权限错误翻译"""
        err = PermissionError("Permission denied")
        translated = translate_error(err)
        
        self.assertIn("没有权限", translated.user_message)

    def test_unicode_decode_translation(self):
        """测试编码错误翻译"""
        err = UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid")
        translated = translate_error(err)
        
        self.assertIn("编码不对", translated.user_message)

    def test_generic_error_translation(self):
        """测试通用错误翻译"""
        err = RuntimeError("Some unknown error")
        translated = translate_error(err)
        
        self.assertIn("意料之外", translated.user_message)
        self.assertIn("截图发给开发同事", translated.suggestion)


if __name__ == "__main__":
    unittest.main(verbosity=2)
