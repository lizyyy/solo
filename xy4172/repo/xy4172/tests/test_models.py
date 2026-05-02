"""数据模型测试"""
import pytest

from git_lfs_migrator.models import (
    FileType,
    GitFile,
    Issue,
    IssueSeverity,
    IssueType,
    LFSStatus,
    ScanResult,
)


class TestGitFile:
    """GitFile 模型测试"""
    
    def test_creation(self):
        """测试创建 GitFile"""
        git_file = GitFile(
            path="test.png",
            size=1024 * 1024,
            hash="abc123",
            blob_hash="def456",
            commit_hash="ghi789",
        )
        
        assert git_file.path == "test.png"
        assert git_file.size == 1048576
        assert git_file.file_type == FileType.UNKNOWN
        assert git_file.lfs_status == LFSStatus.NOT_IN_LFS
    
    def test_with_type(self):
        """测试带类型的 GitFile"""
        git_file = GitFile(
            path="test.jpg",
            size=2048,
            hash="hash1",
            blob_hash="blob1",
            commit_hash="commit1",
            file_type=FileType.BINARY,
            lfs_status=LFSStatus.NOT_IN_LFS,
        )
        
        assert git_file.file_type == FileType.BINARY
        assert git_file.lfs_status == LFSStatus.NOT_IN_LFS


class TestIssue:
    """Issue 模型测试"""
    
    def test_creation(self):
        """测试创建 Issue"""
        issue = Issue(
            issue_type=IssueType.LARGE_FILE,
            severity=IssueSeverity.HIGH,
            message="发现大文件",
            affected_files=["large.bin"],
            suggestion="建议添加到 LFS",
        )
        
        assert issue.issue_type == IssueType.LARGE_FILE
        assert issue.severity == IssueSeverity.HIGH
        assert issue.message == "发现大文件"
        assert issue.affected_files == ["large.bin"]
        assert issue.suggestion == "建议添加到 LFS"


class TestScanResult:
    """ScanResult 模型测试"""
    
    def test_defaults(self):
        """测试默认值"""
        result = ScanResult()
        
        assert result.total_files == 0
        assert result.total_size == 0
        assert result.binary_files == 0
        assert result.large_files == 0
        assert result.file_sizes == {}
        assert result.rev_list == []


class TestEnums:
    """枚举测试"""
    
    def test_file_type_values(self):
        """测试 FileType 枚举值"""
        assert FileType.TEXT.value == 1
        assert FileType.BINARY.value == 2
        assert FileType.UNKNOWN.value == 3
    
    def test_lfs_status(self):
        """测试 LFSStatus 枚举"""
        statuses = list(LFSStatus)
        assert len(statuses) == 4
    
    def test_issue_severity_order(self):
        """测试 IssueSeverity 严重程度顺序"""
        assert IssueSeverity.CRITICAL.value < IssueSeverity.HIGH.value
        assert IssueSeverity.HIGH.value < IssueSeverity.MEDIUM.value
        assert IssueSeverity.MEDIUM.value < IssueSeverity.LOW.value
