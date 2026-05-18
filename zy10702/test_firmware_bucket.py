#!/usr/bin/env python3
"""
设备升级日志固件失败分桶 - 自动化测试脚本
"""

import unittest
import json
import os
import sys
import tempfile
import subprocess

from firmware_failure_bucket import (
    load_config,
    parse_version,
    load_logs,
    generate_log_id,
    bucket_failures
)


class TestFirmwareBucket(unittest.TestCase):
    """固件失败分桶测试类"""

    def setUp(self):
        """测试前置准备"""
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.samples_dir = os.path.join(self.test_dir, 'samples')
        
        self.normal_logs_path = os.path.join(self.samples_dir, 'firmware_logs_normal.json')
        self.anomalies_logs_path = os.path.join(self.samples_dir, 'firmware_logs_with_anomalies.json')
        self.csv_logs_path = os.path.join(self.samples_dir, 'firmware_logs.csv')
        
        self.config_path = os.path.join(self.test_dir, 'config.json')
        self.config_v2_path = os.path.join(self.test_dir, 'config_v2.json')

    def test_load_config(self):
        """测试加载配置文件"""
        config = load_config(self.config_path)
        self.assertIn('bucket_by', config)
        self.assertIn('failure_statuses', config)
        self.assertEqual(config['bucket_by'], ['model', 'stage'])

    def test_parse_version_normal(self):
        """测试正常版本号解析"""
        result = parse_version('2.3.5')
        self.assertEqual(result['segment_count'], 3)
        self.assertFalse(result['missing_segments'])

    def test_parse_version_missing_segments(self):
        """测试缺段版本号解析"""
        result = parse_version('2.3')
        self.assertEqual(result['segment_count'], 2)
        self.assertTrue(result['missing_segments'])
        
        result = parse_version('2')
        self.assertEqual(result['segment_count'], 1)
        self.assertTrue(result['missing_segments'])

    def test_parse_version_empty(self):
        """测试空版本号"""
        result = parse_version('')
        self.assertTrue(result['missing_segments'])

    def test_load_logs_json(self):
        """测试加载JSON日志"""
        logs = load_logs(self.normal_logs_path)
        self.assertEqual(len(logs), 6)
        self.assertEqual(logs[0]['device_id'], 'DEV001')

    def test_load_logs_csv(self):
        """测试加载CSV日志"""
        logs = load_logs(self.csv_logs_path)
        self.assertEqual(len(logs), 7)
        self.assertEqual(logs[0]['device_id'], 'DEV001')

    def test_generate_log_id_consistent(self):
        """测试日志ID生成一致性"""
        log1 = {
            'device_id': 'DEV001',
            'timestamp': '2024-01-15T10:30:00Z',
            'firmware_version': '2.3.5',
            'stage': 'download'
        }
        log2 = log1.copy()
        
        id1 = generate_log_id(log1)
        id2 = generate_log_id(log2)
        self.assertEqual(id1, id2)

    def test_bucket_normal_logs(self):
        """测试正常日志分桶 - 设备升级日志固件失败分桶特征"""
        config = load_config(self.config_path)
        logs = load_logs(self.normal_logs_path)
        result = bucket_failures(logs, config)
        
        summary = result['summary']
        self.assertEqual(summary['total_failures'], 5)
        self.assertEqual(summary['total_buckets'], 4)
        
        buckets = result['buckets']
        self.assertIn('SmartCam-X1|download', buckets)
        self.assertIn('SmartCam-X1|install', buckets)
        self.assertIn('DoorLock-Pro|verify', buckets)
        self.assertIn('DoorLock-Pro|reboot', buckets)
        
        self.assertEqual(summary['device_offline_count'], 0)
        self.assertEqual(summary['version_missing_segments_count'], 0)
        self.assertEqual(summary['duplicate_reports_count'], 0)

    def test_bucket_anomalies_detection(self):
        """测试异常检测：设备离线、版本缺段、重复上报"""
        config = load_config(self.config_path)
        logs = load_logs(self.anomalies_logs_path)
        result = bucket_failures(logs, config)
        
        summary = result['summary']
        
        self.assertEqual(summary['device_offline_count'], 4)
        
        self.assertEqual(summary['version_missing_segments_count'], 5)
        
        self.assertEqual(summary['duplicate_reports_count'], 2)

    def test_config_change_affects_bucketing(self):
        """测试配置变更影响分桶结果 - 便于diff对比"""
        logs = load_logs(self.anomalies_logs_path)
        
        config_v1 = load_config(self.config_path)
        result_v1 = bucket_failures(logs, config_v1)
        
        config_v2 = load_config(self.config_v2_path)
        result_v2 = bucket_failures(logs, config_v2)
        
        self.assertNotEqual(
            result_v1['summary']['total_buckets'],
            result_v2['summary']['total_buckets']
        )
        
        self.assertEqual(result_v1['summary']['bucketed_by'], ['model', 'stage'])
        self.assertEqual(result_v2['summary']['bucketed_by'], ['model'])

    def test_cli_basic_execution(self):
        """测试CLI基本执行"""
        cmd = [
            sys.executable,
            os.path.join(self.test_dir, 'firmware_failure_bucket.py'),
            '-i', self.normal_logs_path,
            '-c', self.config_path,
            '-f', 'json'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        
        output = json.loads(result.stdout)
        self.assertIn('summary', output)
        self.assertIn('buckets', output)

    def test_cli_output_to_file(self):
        """测试CLI输出到文件"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            output_path = f.name
        
        try:
            cmd = [
                sys.executable,
                os.path.join(self.test_dir, 'firmware_failure_bucket.py'),
                '-i', self.normal_logs_path,
                '-c', self.config_path,
                '-o', output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertTrue(os.path.exists(output_path))
            
            with open(output_path, 'r', encoding='utf-8') as f:
                content = f.read()
                self.assertIn('设备升级日志固件失败分桶结果', content)
                self.assertIn('总失败数', content)
                self.assertIn('分桶维度', content)
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_cli_missing_config(self):
        """测试CLI缺少配置文件的错误处理"""
        cmd = [
            sys.executable,
            os.path.join(self.test_dir, 'firmware_failure_bucket.py'),
            '-i', self.normal_logs_path,
            '-c', 'nonexistent_config.json'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('错误', result.stderr)

    def test_cli_show_logs_flag(self):
        """测试--show-logs标志"""
        cmd = [
            sys.executable,
            os.path.join(self.test_dir, 'firmware_failure_bucket.py'),
            '-i', self.normal_logs_path,
            '-c', self.config_path,
            '-f', 'json',
            '--show-logs'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        
        output = json.loads(result.stdout)
        for bucket in output['buckets'].values():
            self.assertIn('logs', bucket)

    def test_output_has_firmware_bucket_identity(self):
        """测试输出明确显示这是设备升级日志固件失败分桶，而非通用工具"""
        cmd = [
            sys.executable,
            os.path.join(self.test_dir, 'firmware_failure_bucket.py'),
            '-i', self.anomalies_logs_path,
            '-c', self.config_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        output = result.stdout
        
        self.assertIn('设备升级日志固件失败分桶结果', output)
        self.assertIn('分桶维度', output)
        self.assertIn('设备离线数', output)
        self.assertIn('版本号缺段数', output)
        self.assertIn('重复上报数', output)
        
        self.assertIn('SmartCam-X1', output)
        self.assertIn('DoorLock-Pro', output)
        self.assertIn('download', output)
        self.assertIn('install', output)


def run_tests():
    """运行所有测试"""
    print("=" * 80)
    print("设备升级日志固件失败分桶 - 自动化测试")
    print("=" * 80)
    print()
    
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestFirmwareBucket)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print()
    print("=" * 80)
    if result.wasSuccessful():
        print("✅ 所有测试通过！")
    else:
        print(f"❌ 测试失败: {len(result.failures)} 个失败, {len(result.errors)} 个错误")
    print("=" * 80)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
