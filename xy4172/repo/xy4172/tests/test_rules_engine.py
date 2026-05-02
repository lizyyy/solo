"""规则引擎测试"""
import pytest

from git_lfs_migrator.models import (
    FileType,
    GitAttributeRule,
    GitFile,
    IssueSeverity,
    IssueType,
    LFSStatus,
    ScanResult,
)
from git_lfs_migrator.rules_engine.checker import (
    check_case_sensitivity,
    check_hash_conflicts,
    check_large_files,
    check_rule_conflicts,
    perform_full_check,
)


class TestLargeFilesCheck:
    """大文件检查测试"""
    
    def test_no_large_files(self):
        """测试没有大文件"""
        files = {
            "small.txt": GitFile(
                path="small.txt",
                size=1024,
                hash="hash1",
                blob_hash="blob1",
                commit_hash="commit1",
            )
        }
        
        result = check_large_files(files, threshold_bytes=100 * 1024)
        
        assert result.passed is True
        assert len(result.issues) == 0
    
    def test_large_file_not_in_lfs(self):
        """测试大文件不在 LFS 中"""
        files = {
            "large.bin": GitFile(
                path="large.bin",
                size=200 * 1024,
                hash="hash1",
                blob_hash="blob1",
                commit_hash="commit1",
                lfs_status=LFSStatus.NOT_IN_LFS,
            )
        }
        
        result = check_large_files(files, threshold_bytes=100 * 1024)
        
        assert result.passed is False
        assert len(result.issues) == 1
        assert result.issues[0].issue_type == IssueType.LARGE_FILE
        assert result.issues[0].severity == IssueSeverity.HIGH


class TestCaseSensitivityCheck:
    """大小写敏感检查测试"""
    
    def test_no_conflicts(self):
        """测试没有冲突"""
        files = {
            "file.txt": GitFile(
                path="file.txt",
                size=100,
                hash="h1",
                blob_hash="b1",
                commit_hash="c1",
            ),
            "another.txt": GitFile(
                path="another.txt",
                size=200,
                hash="h2",
                blob_hash="b2",
                commit_hash="c2",
            ),
        }
        
        result = check_case_sensitivity(files)
        
        assert result.passed is True
        assert len(result.issues) == 0
    
    def test_case_conflict(self):
        """测试大小写冲突"""
        files = {
            "File.txt": GitFile(
                path="File.txt",
                size=100,
                hash="h1",
                blob_hash="b1",
                commit_hash="c1",
            ),
            "file.txt": GitFile(
                path="file.txt",
                size=200,
                hash="h2",
                blob_hash="b2",
                commit_hash="c2",
            ),
        }
        
        result = check_case_sensitivity(files)
        
        assert result.passed is False
        assert len(result.issues) == 1
        assert result.issues[0].issue_type == IssueType.CASE_SENSITIVITY
        assert result.issues[0].severity == IssueSeverity.CRITICAL


class TestHashConflictsCheck:
    """哈希冲突检查测试"""
    
    def test_no_conflicts(self):
        """测试没有冲突"""
        files = {
            "file.txt": GitFile(
                path="file.txt",
                size=100,
                hash="h1",
                blob_hash="b1",
                commit_hash="c1",
            ),
        }
        
        result = check_hash_conflicts(files)
        
        assert result.passed is True
        assert len(result.issues) == 0


class TestRuleConflictsCheck:
    """规则冲突检查测试"""
    
    def test_no_conflicts(self):
        """测试没有冲突"""
        rules = [
            GitAttributeRule(
                pattern="*.png",
                lfs_enabled=True,
                raw_line="*.png filter=lfs",
            ),
            GitAttributeRule(
                pattern="*.jpg",
                lfs_enabled=True,
                raw_line="*.jpg filter=lfs",
            ),
        ]
        
        result = check_rule_conflicts(rules)
        
        assert result.passed is True


class TestFullCheck:
    """完整检查测试"""
    
    def test_empty_scan_result(self):
        """测试空扫描结果"""
        scan_result = ScanResult()
        
        result = perform_full_check(scan_result)
        
        assert result.scan_result == scan_result
        assert len(result.issues) == 0
