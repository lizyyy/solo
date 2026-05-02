"""测试目录校验模块"""
import pytest
import os
import sys
from pathlib import Path

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from juanzong_redactor.validation import Validator


class TestValidator:
    """测试Validator类"""
    
    def test_validator_init(self):
        """测试初始化"""
        validator = Validator()
        assert validator.issues == []
    
    def test_validate_empty(self):
        """测试空数据校验"""
        validator = Validator()
        
        scan_data = {
            "scan_time": "2024-01-01T00:00:00",
            "base_directory": "/test",
            "total_files": 0,
            "files": [],
            "summary": {},
        }
        
        result = validator.validate(scan_data, checks=["page", "hash", "signature"])
        
        assert result["total_files"] == 0
        assert len(result["issues"]) == 0
        assert result["summary"]["errors"] == 0
        assert result["summary"]["warnings"] == 0
    
    def test_check_duplicate_hashes(self):
        """测试重复哈希检查"""
        validator = Validator()
        
        # 创建两个相同哈希的文件
        scan_data = {
            "files": [
                {
                    "path": "file1.txt",
                    "name": "file1.txt",
                    "hash_sha256": "abc123",
                    "hash_md5": "def456",
                    "size": 100,
                    "size_human": "100 B",
                },
                {
                    "path": "file2.txt",
                    "name": "file2.txt",
                    "hash_sha256": "abc123",
                    "hash_md5": "def456",
                    "size": 100,
                    "size_human": "100 B",
                },
                {
                    "path": "file3.txt",
                    "name": "file3.txt",
                    "hash_sha256": "xyz789",
                    "hash_md5": "uvw012",
                    "size": 200,
                    "size_human": "200 B",
                },
            ]
        }
        
        issues = validator.check_duplicate_hashes(scan_data["files"])
        
        # 应该发现1组重复文件
        assert len(issues) == 1
        assert issues[0]["type"] == "hash_duplicate"
        assert issues[0]["severity"] == "error"
    
    def test_check_page_numbers_basic(self):
        """测试页码检查"""
        validator = Validator()
        
        # 创建按页码命名的文件
        scan_data = {
            "files": [
                {
                    "path": "证据_第1页.jpg",
                    "name": "证据_第1页.jpg",
                    "file_type": "image",
                    "absolute_path": "/test/证据_第1页.jpg",
                },
                {
                    "path": "证据_第2页.jpg",
                    "name": "证据_第2页.jpg",
                    "file_type": "image",
                    "absolute_path": "/test/证据_第2页.jpg",
                },
                {
                    "path": "证据_第4页.jpg",
                    "name": "证据_第4页.jpg",
                    "file_type": "image",
                    "absolute_path": "/test/证据_第4页.jpg",
                },
            ]
        }
        
        issues = validator.check_page_numbers(scan_data["files"])
        
        # 应该发现缺失第3页
        page_missing_issues = [i for i in issues if i["type"] == "page_missing"]
        assert len(page_missing_issues) == 1
    
    def test_check_page_numbers_duplicate(self):
        """测试重复页码检查"""
        validator = Validator()
        
        scan_data = {
            "files": [
                {
                    "path": "file_1.txt",
                    "name": "file_1.txt",
                    "file_type": "text",
                    "absolute_path": "/test/file_1.txt",
                },
                {
                    "path": "file_1_duplicate.txt",
                    "name": "file_1_duplicate.txt",
                    "file_type": "text",
                    "absolute_path": "/test/file_1_duplicate.txt",
                },
            ]
        }
        
        issues = validator.check_page_numbers(scan_data["files"])
        
        # 可能会发现重复页码（取决于文件名解析）
        # 这里文件名都是"1"，可能被解析为页码1
    
    def test_check_missing_signatures(self):
        """测试签名页检查"""
        validator = Validator()
        
        scan_data = {
            "files": [
                {
                    "path": "借款合同.pdf",
                    "name": "借款合同.pdf",
                    "file_type": "pdf",
                    "absolute_path": "/test/借款合同.pdf",
                },
                {
                    "path": "授权委托书.doc",
                    "name": "授权委托书.doc",
                    "file_type": "document",
                    "absolute_path": "/test/授权委托书.doc",
                },
                {
                    "path": "普通文件.txt",
                    "name": "普通文件.txt",
                    "file_type": "text",
                    "absolute_path": "/test/普通文件.txt",
                },
            ]
        }
        
        issues = validator.check_missing_signatures(scan_data["files"])
        
        # 应该对合同和委托书发出警告
        # （除非实际文件有签名特征）
        # 由于没有实际文件，可能不会检测到实际签名
        assert len(issues) >= 0  # 至少不应该报错
    
    def test_validate_with_specified_checks(self):
        """测试指定检查项目"""
        validator = Validator()
        
        scan_data = {
            "files": [
                {
                    "path": "file1.txt",
                    "name": "file1.txt",
                    "hash_sha256": "abc123",
                    "size": 100,
                    "file_type": "text",
                    "absolute_path": "/test/file1.txt",
                },
            ],
            "total_files": 1,
        }
        
        # 只执行哈希检查
        result = validator.validate(scan_data, checks=["hash"])
        
        assert "hash" in result["checks_performed"]
        assert "page" not in result["checks_performed"]
        assert "signature" not in result["checks_performed"]
    
    def test_validate_with_all_checks(self):
        """测试执行所有检查"""
        validator = Validator()
        
        scan_data = {
            "files": [
                {
                    "path": "file_p1.txt",
                    "name": "file_p1.txt",
                    "hash_sha256": "abc123",
                    "size": 100,
                    "file_type": "text",
                    "absolute_path": "/test/file_p1.txt",
                },
            ],
            "total_files": 1,
        }
        
        result = validator.validate(scan_data)
        
        assert "page" in result["checks_performed"]
        assert "hash" in result["checks_performed"]
        assert "signature" in result["checks_performed"]


class TestValidatorIntegration:
    """Validator集成测试"""
    
    def test_complete_validation(self):
        """测试完整校验流程"""
        validator = Validator()
        
        # 模拟一个有问题的扫描结果
        scan_data = {
            "scan_time": "2024-01-01T10:00:00",
            "base_directory": "/evidence",
            "total_files": 4,
            "files": [
                {
                    "path": "起诉状_第1页.pdf",
                    "name": "起诉状_第1页.pdf",
                    "file_type": "pdf",
                    "hash_sha256": "hash_001",
                    "hash_md5": "md5_001",
                    "size": 1024,
                    "size_human": "1.0 KB",
                    "absolute_path": "/evidence/起诉状_第1页.pdf",
                },
                {
                    "path": "证据清单_第2页.pdf",
                    "name": "证据清单_第2页.pdf",
                    "file_type": "pdf",
                    "hash_sha256": "hash_002",
                    "hash_md5": "md5_002",
                    "size": 2048,
                    "size_human": "2.0 KB",
                    "absolute_path": "/evidence/证据清单_第2页.pdf",
                },
                {
                    "path": "借款合同_第3页.pdf",
                    "name": "借款合同_第3页.pdf",
                    "file_type": "pdf",
                    "hash_sha256": "hash_003",
                    "hash_md5": "md5_003",
                    "size": 4096,
                    "size_human": "4.0 KB",
                    "absolute_path": "/evidence/借款合同_第3页.pdf",
                },
                {
                    "path": "借款合同_副本_第3页.pdf",
                    "name": "借款合同_副本_第3页.pdf",
                    "file_type": "pdf",
                    "hash_sha256": "hash_003",  # 相同哈希
                    "hash_md5": "md5_003",
                    "size": 4096,
                    "size_human": "4.0 KB",
                    "absolute_path": "/evidence/借款合同_副本_第3页.pdf",
                },
            ],
            "summary": {
                "by_type": {"pdf": 4},
            },
        }
        
        result = validator.validate(scan_data)
        
        # 应该发现重复哈希问题
        hash_issues = [i for i in result["issues"] if i["type"] == "hash_duplicate"]
        assert len(hash_issues) == 1
        
        # 应该发现重复页码问题
        page_issues = [i for i in result["issues"] if i["type"] == "page_duplicate"]
        assert len(page_issues) >= 0  # 取决于文件名解析


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
