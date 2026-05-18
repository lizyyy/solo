#!/usr/bin/env python3
import os
import sys
import pytest
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from reconcile import GymCourseReconciler, ReconciliationConfig


@pytest.fixture
def config():
    return ReconciliationConfig()


@pytest.fixture
def base_dir():
    return os.path.join(os.path.dirname(__file__), '..')


class TestMissingColumns:
    def test_missing_columns_detection(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'bad', '202605_课包消耗明细_缺列.csv')
        
        result = reconciler.process_file(file_path)
        
        assert result is False
        assert len(reconciler.result.errors) > 0
        missing_err = next((e for e in reconciler.result.errors if e['type'] == 'missing_columns'), None)
        assert missing_err is not None
        assert '备注' in missing_err['error'] or '操作人' in missing_err['error']


class TestDuplicateRows:
    def test_duplicate_rows_detection(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'bad', '202605_课包消耗明细_重复行.csv')
        
        reconciler.process_file(file_path)
        
        assert reconciler.result.duplicate_rows > 0
        duplicate_errs = [e for e in reconciler.result.errors if e['type'] == 'duplicate_row']
        assert len(duplicate_errs) > 0


class TestEmptyFiles:
    def test_completely_empty_file(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'empty', '202605_课包消耗明细_空文件.csv')
        
        result = reconciler.process_file(file_path)
        
        assert result is False
        assert reconciler.result.empty_files >= 1

    def test_only_header_file(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'empty', '202605_课包消耗明细_只有表头.csv')
        
        result = reconciler.process_file(file_path)
        
        assert result is False
        assert reconciler.result.empty_files >= 1


class TestContinueOnFailure:
    def test_continue_on_failure_true(self, config, base_dir):
        config.config['continue_on_failure'] = True
        reconciler = GymCourseReconciler(config)
        data_dir = os.path.join(base_dir, 'data')
        
        reconciler.process_directory(data_dir)
        
        assert reconciler.result.total_files > 0
        assert reconciler.result.total_files == reconciler.result.success_files + reconciler.result.failed_files + reconciler.result.empty_files

    def test_no_continue_mode(self, config, base_dir):
        config.config['continue_on_failure'] = False
        reconciler = GymCourseReconciler(config)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            bad_file = os.path.join(tmpdir, 'bad.csv')
            good_file = os.path.join(tmpdir, 'good.csv')
            
            with open(bad_file, 'w') as f:
                f.write('col1,col2\n')
            
            with open(good_file, 'w') as f:
                f.write(','.join(config['required_columns']) + '\n')
                f.write('2026-05-01,M001,张三,P001,课包,私教,C001,王,1,29,正常消课,备注,系统,SH001\n')
            
            os.rename(bad_file, os.path.join(tmpdir, '01_bad.csv'))
            os.rename(good_file, os.path.join(tmpdir, '02_good.csv'))
            
            reconciler.process_directory(tmpdir)
            
            assert reconciler.result.total_files == 1


class TestBusinessClassification:
    def test_gift_course_detection(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'normal', '202605_课包消耗明细_01.csv')
        
        reconciler.process_file(file_path)
        
        assert len(reconciler.result.gift_courses) > 0
        for gift in reconciler.result.gift_courses:
            assert 'source_file' in gift
            assert 'row_number' in gift
            assert gift['row_number'] > 0

    def test_transfer_detection(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'normal', '202605_课包消耗明细_01.csv')
        
        reconciler.process_file(file_path)
        
        assert len(reconciler.result.transfers) > 0
        for transfer in reconciler.result.transfers:
            assert 'source_file' in transfer
            assert 'row_number' in transfer

    def test_freeze_detection(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'normal', '202605_课包消耗明细_01.csv')
        
        reconciler.process_file(file_path)
        
        assert len(reconciler.result.freezes) > 0
        for freeze in reconciler.result.freezes:
            assert 'source_file' in freeze
            assert 'row_number' in freeze


class TestRetryableItems:
    def test_retryable_items_generated(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'bad', '202605_课包消耗明细_格式错误.csv')
        
        reconciler.process_file(file_path)
        
        assert len(reconciler.result.retryable) > 0
        for item in reconciler.result.retryable:
            assert 'file' in item
            assert 'reason' in item
            assert 'fix_hint' in item


class TestNormalFiles:
    def test_normal_file_processing(self, config, base_dir):
        reconciler = GymCourseReconciler(config)
        file_path = os.path.join(base_dir, 'data', 'normal', '202605_课包消耗明细_01.csv')
        
        result = reconciler.process_file(file_path)
        
        assert result is True
        assert reconciler.result.valid_rows > 0
        assert reconciler.result.invalid_rows == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
