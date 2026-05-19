#!/usr/bin/env python3
"""GitScanner模块单元测试"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from pathlib import Path
from gitlfs_scout.git_scanner import GitScanner, ScanResult, LFSFile


class TestGitScanner(unittest.TestCase):
    """测试GitScanner类"""
    
    def setUp(self):
        self.test_repos_dir = Path(__file__).parent / "test_repos"
        
    def test_is_lfs_pointer_valid(self):
        """测试识别有效的LFS指针"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        
        valid_content = """version https://git-lfs.github.com/spec/v1
oid sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
size 1048576
"""
        result = scanner.is_lfs_pointer(valid_content)
        self.assertIsNotNone(result)
        oid, size = result
        self.assertEqual(oid, "a" * 64)
        self.assertEqual(size, 1048576)
    
    def test_is_lfs_pointer_invalid(self):
        """测试识别无效的LFS指针"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        
        # 普通文本
        self.assertIsNone(scanner.is_lfs_pointer("Hello World"))
        
        # 缺少size
        missing_size = """version https://git-lfs.github.com/spec/v1
oid sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
"""
        self.assertIsNone(scanner.is_lfs_pointer(missing_size))
        
        # oid太短
        short_oid = """version https://git-lfs.github.com/spec/v1
oid sha256:abc123
size 100
"""
        self.assertIsNone(scanner.is_lfs_pointer(short_oid))
    
    def test_scan_empty_repo(self):
        """测试扫描空仓库（无LFS文件）"""
        scanner = GitScanner(self.test_repos_dir / "empty_repo")
        result = scanner.scan_current()
        
        self.assertIsInstance(result, ScanResult)
        self.assertEqual(len(result.lfs_files), 0)
        self.assertEqual(result.total_size, 0)
        self.assertEqual(len(result.unique_oids), 0)
    
    def test_scan_normal_repo(self):
        """测试扫描正常仓库（有LFS文件）"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        result = scanner.scan_current()
        
        self.assertIsInstance(result, ScanResult)
        self.assertGreater(len(result.lfs_files), 0)
        self.assertGreater(result.total_size, 0)
        
        # 验证LFSFile对象
        for lfs_file in result.lfs_files:
            self.assertIsInstance(lfs_file, LFSFile)
            self.assertEqual(len(lfs_file.oid), 64)
            self.assertIsInstance(lfs_file.size, int)
            self.assertIsInstance(lfs_file.path, str)
    
    def test_scan_with_path_filter(self):
        """测试路径过滤功能"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        result_all = scanner.scan_current()
        result_filtered = scanner.scan_current(path_filter="models")
        
        self.assertLessEqual(len(result_filtered.lfs_files), len(result_all.lfs_files))
        
        # 所有过滤后的文件路径都应该包含关键词
        for lfs_file in result_filtered.lfs_files:
            self.assertIn("models", lfs_file.path)
    
    def test_scan_history(self):
        """测试历史扫描功能"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        result = scanner.scan_history()
        
        # 历史扫描应该包含所有提交中的文件
        self.assertIsInstance(result, ScanResult)
        # 注意：历史扫描可能会扫描多次同一文件（在不同提交），所以数量可能更多
    
    def test_duplicate_files_detection(self):
        """测试重复文件（相同OID）的扫描结果"""
        scanner = GitScanner(self.test_repos_dir / "duplicate_files_repo")
        result = scanner.scan_current()
        
        # 应该有4个文件引用，但唯一OID应该少于4
        self.assertEqual(len(result.lfs_files), 4)
        self.assertLess(len(result.unique_oids), len(result.lfs_files))
        
        # 验证有重复的OID
        oid_counts = {}
        for f in result.lfs_files:
            oid_counts[f.oid] = oid_counts.get(f.oid, 0) + 1
        
        # 应该有至少一个OID出现多次
        self.assertTrue(any(count > 1 for count in oid_counts.values()))
    
    def test_special_chars_path(self):
        """测试特殊字符路径处理"""
        scanner = GitScanner(self.test_repos_dir / "special_chars_repo")
        result = scanner.scan_current()
        
        self.assertGreater(len(result.lfs_files), 0)
        
        # 验证路径被正确处理
        for lfs_file in result.lfs_files:
            self.assertIsInstance(lfs_file.path, str)
            self.assertGreater(len(lfs_file.path), 0)
    
    def test_invalid_repo_path(self):
        """测试无效的仓库路径"""
        with self.assertRaises(ValueError):
            GitScanner("/nonexistent/path/that/should/not/exist")


class TestAnalyzer(unittest.TestCase):
    """测试LFSAnalyzer类"""
    
    def setUp(self):
        from gitlfs_scout.analyzer import LFSAnalyzer
        self.analyzer = LFSAnalyzer()
        self.test_repos_dir = Path(__file__).parent / "test_repos"
    
    def test_format_size(self):
        """测试大小格式化"""
        self.assertEqual(self.analyzer.format_size(100), "100.00 B")
        self.assertEqual(self.analyzer.format_size(1024), "1.00 KB")
        self.assertEqual(self.analyzer.format_size(1024 * 1024), "1.00 MB")
        self.assertEqual(self.analyzer.format_size(1024 * 1024 * 1024), "1.00 GB")
    
    def test_get_path_level(self):
        """测试路径层级提取"""
        path = "a/b/c/d/file.txt"
        
        self.assertEqual(self.analyzer.get_path_level(path, 1), "a")
        self.assertEqual(self.analyzer.get_path_level(path, 2), "a/b")
        self.assertEqual(self.analyzer.get_path_level(path, 3), "a/b/c")
        self.assertEqual(self.analyzer.get_path_level(path, 10), path)
    
    def test_analyze_empty_result(self):
        """测试分析空结果"""
        from gitlfs_scout.git_scanner import ScanResult
        empty_result = ScanResult()
        
        analysis = self.analyzer.analyze(empty_result)
        
        self.assertEqual(analysis.total_files, 0)
        self.assertEqual(analysis.total_size, 0)
        self.assertEqual(analysis.unique_files, 0)
        self.assertEqual(analysis.unique_size, 0)
        self.assertEqual(len(analysis.by_path), 0)
        self.assertEqual(len(analysis.by_author), 0)
    
    def test_analyze_with_min_size(self):
        """测试按最小大小过滤"""
        scanner = GitScanner(self.test_repos_dir / "mixed_sizes_repo")
        scan_result = scanner.scan_current()
        
        # 不设置过滤应该有所有文件
        analysis_all = self.analyzer.analyze(scan_result)
        
        # 设置1MB过滤应该排除小文件
        analysis_filtered = self.analyzer.analyze(scan_result, min_size=1024 * 1024)
        
        self.assertLessEqual(analysis_filtered.total_files, analysis_all.total_files)
    
    def test_duplicate_summary(self):
        """测试重复文件摘要"""
        scanner = GitScanner(self.test_repos_dir / "duplicate_files_repo")
        scan_result = scanner.scan_current()
        analysis = self.analyzer.analyze(scan_result)
        
        duplicate_summary = self.analyzer.get_duplicate_summary(analysis)
        
        self.assertIn("count", duplicate_summary)
        self.assertIn("total_duplicate_size", duplicate_summary)
        self.assertIn("details", duplicate_summary)
        
        # 应该检测到重复文件
        self.assertGreater(duplicate_summary["count"], 0)
        self.assertGreater(duplicate_summary["total_duplicate_size"], 0)
    
    def test_paths_sorted_by_size(self):
        """测试按大小排序路径"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        scan_result = scanner.scan_current()
        analysis = self.analyzer.analyze(scan_result)
        
        sorted_paths = self.analyzer.get_paths_sorted_by_size(analysis, limit=10)
        
        # 应该按大小降序排列
        sizes = [p.total_size for p in sorted_paths]
        self.assertEqual(sizes, sorted(sizes, reverse=True))
    
    def test_authors_sorted_by_size(self):
        """测试按作者大小排序"""
        scanner = GitScanner(self.test_repos_dir / "normal_repo")
        scan_result = scanner.scan_history()
        analysis = self.analyzer.analyze(scan_result)
        
        sorted_authors = self.analyzer.get_authors_sorted_by_size(analysis, limit=10)
        
        # 应该按大小降序排列
        sizes = [a.total_size for a in sorted_authors]
        self.assertEqual(sizes, sorted(sizes, reverse=True))


class TestReporter(unittest.TestCase):
    """测试ReportGenerator类"""
    
    def setUp(self):
        from gitlfs_scout.git_scanner import GitScanner
        from gitlfs_scout.analyzer import LFSAnalyzer
        from gitlfs_scout.reporter import ReportGenerator
        
        self.test_repos_dir = Path(__file__).parent / "test_repos"
        self.scanner = GitScanner(self.test_repos_dir / "normal_repo")
        self.analyzer = LFSAnalyzer()
        self.ReportGenerator = ReportGenerator
    
    def test_generate_human_report(self):
        """测试生成人类可读报告"""
        scan_result = self.scanner.scan_current()
        analysis = self.analyzer.analyze(scan_result)
        reporter = self.ReportGenerator(scan_result, analysis)
        
        report = reporter.generate_human_report()
        
        self.assertIsInstance(report, str)
        self.assertGreater(len(report), 0)
        
        # 报告应该包含关键部分
        self.assertIn("LFS文件总数", report)
        self.assertIn("唯一文件数", report)
        self.assertIn("总占用空间", report)
    
    def test_generate_machine_report(self):
        """测试生成机器可读报告（JSON格式）"""
        scan_result = self.scanner.scan_current()
        analysis = self.analyzer.analyze(scan_result)
        reporter = self.ReportGenerator(scan_result, analysis)
        
        report = reporter.generate_machine_report()
        
        self.assertIsInstance(report, dict)
        
        # 应该包含必要的字段
        self.assertIn("report_version", report)
        self.assertIn("generated_at", report)
        self.assertIn("summary", report)
        self.assertIn("top_files", report)
        self.assertIn("by_path", report)
        self.assertIn("by_author", report)
        self.assertIn("errors", report)
        
        # 摘要应该包含必要的字段
        summary = report["summary"]
        self.assertIn("total_files", summary)
        self.assertIn("unique_files", summary)
        self.assertIn("total_size_bytes", summary)
        self.assertIn("unique_size_bytes", summary)
    
    def test_reports_consistency(self):
        """验证人类可读报告和机器可读报告的数据一致性"""
        scan_result = self.scanner.scan_current()
        analysis = self.analyzer.analyze(scan_result)
        reporter = self.ReportGenerator(scan_result, analysis)
        
        human_report = reporter.generate_human_report()
        machine_report = reporter.generate_machine_report()
        
        summary = machine_report["summary"]
        
        # 验证关键数据在两个报告中一致
        self.assertIn(str(summary["total_files"]), human_report)
        self.assertIn(str(summary["unique_files"]), human_report)
        
        # 验证大小数据一致（可能有格式差异，但应该包含数字）
        human_size_mb = summary["total_size_bytes"] / (1024 * 1024)
        if human_size_mb >= 1:
            self.assertIn(str(int(human_size_mb)), human_report)
    
    def test_save_reports(self):
        """测试保存报告到文件"""
        import tempfile
        
        scan_result = self.scanner.scan_current()
        analysis = self.analyzer.analyze(scan_result)
        reporter = self.ReportGenerator(scan_result, analysis)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = Path(tmpdir) / "test_report"
            
            # 保存文本报告
            reporter.save_human_report(str(base_path.with_suffix(".txt")))
            self.assertTrue(base_path.with_suffix(".txt").exists())
            
            # 保存JSON报告
            reporter.save_json_report(str(base_path.with_suffix(".json")))
            self.assertTrue(base_path.with_suffix(".json").exists())
            
            # 保存CSV报告
            reporter.save_csv_report(str(base_path.with_suffix(".csv")))
            self.assertTrue(base_path.with_suffix(".csv").exists())


def run_tests():
    """运行所有测试"""
    # 首先创建测试仓库
    from test_scenarios import setup_all_scenarios
    setup_all_scenarios()
    
    # 运行测试
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestGitScanner))
    suite.addTests(loader.loadTestsFromTestCase(TestAnalyzer))
    suite.addTests(loader.loadTestsFromTestCase(TestReporter))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
