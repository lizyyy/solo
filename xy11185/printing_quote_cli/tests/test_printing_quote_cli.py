#!/usr/bin/env python3
import unittest
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from printing_quote_cli import (
    read_csv_file,
    validate_columns,
    validate_row,
    check_duplicates,
    process_single_file,
    process_files,
    EmptyFileError,
    MissingColumnError
)


class TestPrintingQuoteCLI(unittest.TestCase):
    
    def setUp(self):
        self.samples_dir = Path(__file__).parent.parent / 'samples'
        self.normal_dir = self.samples_dir / 'normal'
        self.bad_dir = self.samples_dir / 'bad'
        self.empty_dir = self.samples_dir / 'empty'
    
    def test_normal_file_read(self):
        file_path = self.normal_dir / '报价单_2024_001.csv'
        headers, rows = read_csv_file(file_path)
        
        self.assertIn('起印量', headers)
        self.assertIn('覆膜加价', headers)
        self.assertIn('可复跑', headers)
        self.assertEqual(len(rows), 5)
    
    def test_validate_columns_success(self):
        headers = ['订单号', '起印量', '覆膜加价', '可复跑', '其他列']
        validate_columns(headers)
    
    def test_validate_columns_missing(self):
        headers = ['订单号', '产品名称']
        with self.assertRaises(MissingColumnError):
            validate_columns(headers)
    
    def test_validate_row_valid(self):
        row = {
            '起印量': '500',
            '覆膜加价': '0.30',
            '可复跑': '是'
        }
        warnings = validate_row(row, 2)
        self.assertEqual(len(warnings), 0)
    
    def test_validate_row_invalid_print_quantity(self):
        row = {
            '起印量': '五百',
            '覆膜加价': '0.30',
            '可复跑': '是'
        }
        warnings = validate_row(row, 2)
        self.assertEqual(len(warnings), 1)
        self.assertIn('起印量', warnings[0])
    
    def test_validate_row_invalid_lamination_price(self):
        row = {
            '起印量': '500',
            '覆膜加价': '待确认',
            '可复跑': '是'
        }
        warnings = validate_row(row, 2)
        self.assertEqual(len(warnings), 1)
        self.assertIn('覆膜加价', warnings[0])
    
    def test_validate_row_invalid_rerun(self):
        row = {
            '起印量': '500',
            '覆膜加价': '0.30',
            '可复跑': 'YES'
        }
        warnings = validate_row(row, 2)
        self.assertEqual(len(warnings), 1)
        self.assertIn('可复跑', warnings[0])
    
    def test_check_duplicates(self):
        rows = [
            {'订单号': 'PO001'},
            {'订单号': 'PO002'},
            {'订单号': 'PO001'},
            {'订单号': 'PO003'}
        ]
        duplicates = check_duplicates(rows)
        self.assertEqual(len(duplicates), 1)
        self.assertIn('PO001', duplicates[0])
    
    def test_empty_file(self):
        file_path = self.empty_dir / '报价单_完全空.csv'
        result = process_single_file(file_path)
        self.assertFalse(result['success'])
        self.assertEqual(len(result['errors']), 1)
        self.assertIsNotNone(result['continue_reason'])
        self.assertIn('空文件', result['continue_reason'])
    
    def test_only_header_file(self):
        file_path = self.empty_dir / '报价单_只有表头.csv'
        result = process_single_file(file_path)
        self.assertTrue(result['success'])
        self.assertEqual(len(result['warnings']), 1)
        self.assertEqual(result['row_count'], 0)
    
    def test_only_empty_lines_file(self):
        file_path = self.empty_dir / '报价单_只有空行.csv'
        result = process_single_file(file_path)
        self.assertFalse(result['success'])
        self.assertEqual(len(result['errors']), 1)
        self.assertIsNotNone(result['continue_reason'])
    
    def test_missing_print_quantity_column(self):
        file_path = self.bad_dir / '报价单_缺起印量列.csv'
        result = process_single_file(file_path)
        self.assertFalse(result['success'])
        self.assertEqual(len(result['errors']), 1)
        self.assertIsNotNone(result['continue_reason'])
        self.assertIn('起印量', result['continue_reason'])
    
    def test_missing_lamination_price_column(self):
        file_path = self.bad_dir / '报价单_缺覆膜加价列.csv'
        result = process_single_file(file_path)
        self.assertFalse(result['success'])
        self.assertIsNotNone(result['continue_reason'])
        self.assertIn('覆膜加价', result['continue_reason'])
    
    def test_missing_rerun_column(self):
        file_path = self.bad_dir / '报价单_缺可复跑列.csv'
        result = process_single_file(file_path)
        self.assertFalse(result['success'])
        self.assertIsNotNone(result['continue_reason'])
        self.assertIn('可复跑', result['continue_reason'])
    
    def test_duplicate_rows(self):
        file_path = self.bad_dir / '报价单_重复行.csv'
        result = process_single_file(file_path)
        self.assertTrue(result['success'])
        self.assertEqual(len(result['warnings']), 2)
    
    def test_format_errors(self):
        file_path = self.bad_dir / '报价单_格式错误.csv'
        result = process_single_file(file_path)
        self.assertTrue(result['success'])
        self.assertEqual(len(result['warnings']), 2)
    
    def test_process_multiple_files_with_failures(self):
        file_paths = [
            self.normal_dir / '报价单_2024_001.csv',
            self.bad_dir / '报价单_缺起印量列.csv',
            self.normal_dir / '报价单_2024_002.csv',
            self.empty_dir / '报价单_完全空.csv',
            self.normal_dir / '报价单_2024_003.csv'
        ]
        
        results = process_files(file_paths)
        
        self.assertEqual(len(results), 5)
        
        success_count = sum(1 for r in results if r['success'])
        error_count = sum(1 for r in results if not r['success'])
        
        self.assertEqual(success_count, 3)
        self.assertEqual(error_count, 2)
        
        continue_count = sum(1 for r in results if r['continue_reason'])
        self.assertEqual(continue_count, 2)
    
    def test_all_samples(self):
        all_files = []
        for subdir in ['normal', 'bad', 'empty']:
            dir_path = self.samples_dir / subdir
            csv_files = sorted(dir_path.glob('*.csv'))
            all_files.extend(csv_files)
        
        results = process_files(all_files)
        
        print(f"\n总文件数: {len(all_files)}")
        print(f"成功处理: {sum(1 for r in results if r['success'])}")
        print(f"处理失败: {sum(1 for r in results if not r['success'])}")
        print(f"继续处理记录: {sum(1 for r in results if r['continue_reason'])}")


if __name__ == '__main__':
    unittest.main(verbosity=2)
