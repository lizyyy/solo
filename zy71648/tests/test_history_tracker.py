"""测试历史记录模块"""

import pytest
import os
import tempfile
import time
import json
from error_propagation.history_tracker import HistoryTracker
from error_propagation.types import CorrectionRecord


class TestHistoryTracker:
    """测试历史记录追踪器"""

    def setup_method(self):
        self.temp_db = tempfile.mktemp(suffix='.db')
        self.tracker = HistoryTracker(db_path=self.temp_db)

    def teardown_method(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_save_and_get_entry(self):
        """测试保存和获取记录"""
        corrections = [
            CorrectionRecord(
                field='L.value',
                old_value='0.98',
                new_value='0.984',
                reason='修正测量值',
                corrected_by='teacher1',
                timestamp=time.time()
            )
        ]

        entry_id = self.tracker.save_entry(
            file_name='test.csv',
            original_data={'test': 'data'},
            corrections=corrections,
            issues_found=5,
            issues_resolved=3,
            summary='测试处理',
            processed_by='teacher1',
            report_path='/tmp/report.html'
        )

        assert entry_id > 0

        entry = self.tracker.get_entry(entry_id)
        assert entry is not None
        assert entry.id == entry_id
        assert entry.file_name == 'test.csv'
        assert entry.issues_found == 5
        assert entry.issues_resolved == 3
        assert len(entry.corrections) == 1
        assert entry.corrections[0].field == 'L.value'

    def test_list_entries(self):
        """测试列出记录"""
        for i in range(3):
            self.tracker.save_entry(
                file_name=f'test_{i}.csv',
                original_data={'test': i},
                corrections=[],
                issues_found=i,
                issues_resolved=0,
                summary=f'测试 {i}',
                processed_by='teacher'
            )

        entries = self.tracker.list_entries(limit=10)
        assert len(entries) == 3
        assert entries[0].processed_at > entries[1].processed_at

    def test_list_entries_with_filter(self):
        """测试带文件名过滤的列表"""
        self.tracker.save_entry(
            file_name='exp1.csv',
            original_data={'test': 1},
            corrections=[],
            issues_found=1,
            issues_resolved=0,
            summary='测试',
            processed_by='teacher'
        )
        self.tracker.save_entry(
            file_name='exp2.csv',
            original_data={'test': 2},
            corrections=[],
            issues_found=2,
            issues_resolved=0,
            summary='测试',
            processed_by='teacher'
        )

        entries = self.tracker.list_entries(file_name='exp1.csv', limit=10)
        assert len(entries) == 1
        assert entries[0].file_name == 'exp1.csv'

    def test_find_duplicates(self):
        """测试查找重复数据"""
        data = {'L': 0.984, 'T': 1.992}

        self.tracker.save_entry(
            file_name='test1.csv',
            original_data=data,
            corrections=[],
            issues_found=0,
            issues_resolved=0,
            summary='测试',
            processed_by='teacher'
        )

        duplicates = self.tracker.find_duplicates(data)
        assert len(duplicates) >= 1

    def test_get_corrections(self):
        """测试获取修正记录"""
        corrections = [
            CorrectionRecord(
                field='L.value',
                old_value='0.98',
                new_value='0.984',
                reason='修正1',
                corrected_by='teacher1',
                timestamp=time.time()
            ),
            CorrectionRecord(
                field='T.value',
                old_value='2.0',
                new_value='1.992',
                reason='修正2',
                corrected_by='teacher2',
                timestamp=time.time()
            )
        ]

        entry_id = self.tracker.save_entry(
            file_name='test.csv',
            original_data={'test': 'data'},
            corrections=corrections,
            issues_found=0,
            issues_resolved=2,
            summary='测试',
            processed_by='teacher'
        )

        retrieved_corrections = self.tracker.get_corrections(entry_id)
        assert len(retrieved_corrections) == 2
        assert retrieved_corrections[0].field == 'L.value'
        assert retrieved_corrections[1].field == 'T.value'

    def test_compare_entries(self):
        """测试比较两条记录"""
        corrections1 = [
            CorrectionRecord(
                field='L.value',
                old_value='0.98',
                new_value='0.984',
                reason='修正',
                corrected_by='teacher1',
                timestamp=time.time()
            )
        ]

        corrections2 = [
            CorrectionRecord(
                field='L.value',
                old_value='0.98',
                new_value='0.985',
                reason='再次修正',
                corrected_by='teacher2',
                timestamp=time.time()
            ),
            CorrectionRecord(
                field='T.value',
                old_value='2.0',
                new_value='1.992',
                reason='新增修正',
                corrected_by='teacher2',
                timestamp=time.time()
            )
        ]

        id1 = self.tracker.save_entry(
            file_name='test.csv',
            original_data={'test': 1},
            corrections=corrections1,
            issues_found=5,
            issues_resolved=1,
            summary='第一次处理',
            processed_by='teacher1'
        )

        id2 = self.tracker.save_entry(
            file_name='test.csv',
            original_data={'test': 1},
            corrections=corrections2,
            issues_found=5,
            issues_resolved=2,
            summary='第二次处理',
            processed_by='teacher2'
        )

        diff = self.tracker.compare_entries(id1, id2)

        assert 'metadata' in diff
        assert 'corrections_diff' in diff
        assert len(diff['corrections_diff']['new_in_entry2']) == 1
        assert len(diff['corrections_diff']['modified']) == 1

    def test_get_statistics(self):
        """测试获取统计信息"""
        for i in range(5):
            self.tracker.save_entry(
                file_name=f'test_{i}.csv',
                original_data={'test': i},
                corrections=[
                    CorrectionRecord(
                        field=f'field_{i}',
                        old_value='old',
                        new_value='new',
                        reason='test',
                        corrected_by=f'teacher_{i % 2}',
                        timestamp=time.time()
                    )
                ],
                issues_found=i + 1,
                issues_resolved=i,
                summary=f'测试 {i}',
                processed_by=f'teacher_{i % 2}'
            )

        stats = self.tracker.get_statistics()

        assert stats['total_entries'] == 5
        assert stats['total_files'] == 5
        assert stats['total_issues_found'] == 15
        assert stats['total_issues_resolved'] == 10
        assert stats['total_corrections'] == 5
        assert stats['resolution_rate'] > 0

    def test_delete_entry(self):
        """测试删除记录"""
        entry_id = self.tracker.save_entry(
            file_name='test.csv',
            original_data={'test': 'data'},
            corrections=[],
            issues_found=0,
            issues_resolved=0,
            summary='测试',
            processed_by='teacher'
        )

        assert self.tracker.delete_entry(entry_id) is True
        assert self.tracker.get_entry(entry_id) is None

    def test_compute_data_hash(self):
        """测试数据哈希计算"""
        data1 = {'L': 0.984, 'T': 1.992}
        data2 = {'L': 0.984, 'T': 1.992}
        data3 = {'L': 0.985, 'T': 1.992}

        hash1 = self.tracker._compute_data_hash(data1)
        hash2 = self.tracker._compute_data_hash(data2)
        hash3 = self.tracker._compute_data_hash(data3)

        assert hash1 == hash2
        assert hash1 != hash3
        assert len(hash1) == 64

    def test_get_file_history(self):
        """测试获取文件历史"""
        for i in range(3):
            self.tracker.save_entry(
                file_name='same_file.csv',
                original_data={'version': i},
                corrections=[],
                issues_found=i,
                issues_resolved=0,
                summary=f'版本 {i}',
                processed_by='teacher'
            )

        history = self.tracker.get_file_history('same_file.csv')
        assert len(history) == 3
