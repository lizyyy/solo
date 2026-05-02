"""测试文件解析模块"""
import pytest
import os
import sys
import tempfile
from pathlib import Path

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from juanzong_redactor.file_parser import (
    scan_directory,
    calculate_file_hash,
    get_file_metadata,
    format_file_size,
    classify_file_type,
    DEFAULT_FILE_TYPES,
    parse_csv,
    extract_csv_text,
)


class TestScanner:
    """测试目录扫描功能"""
    
    def test_format_file_size(self):
        """测试文件大小格式化"""
        assert format_file_size(0) == "0 B"
        assert format_file_size(1024) == "1.0 KB"
        assert format_file_size(1024 * 1024) == "1.0 MB"
        assert format_file_size(1024 * 1024 * 1024) == "1.0 GB"
    
    def test_classify_file_type(self):
        """测试文件类型分类"""
        assert classify_file_type(".pdf") == "pdf"
        assert classify_file_type(".jpg") == "image"
        assert classify_file_type(".png") == "image"
        assert classify_file_type(".csv") == "csv"
        assert classify_file_type(".txt") == "text"
        assert classify_file_type(".doc") == "document"
        assert classify_file_type(".unknown") == "other"
    
    def test_calculate_file_hash(self, tmp_path):
        """测试文件哈希计算"""
        # 创建临时文件
        test_file = tmp_path / "test.txt"
        test_file.write_text("test content", encoding="utf-8")
        
        hash_sha256 = calculate_file_hash(str(test_file), "sha256")
        hash_md5 = calculate_file_hash(str(test_file), "md5")
        
        assert len(hash_sha256) == 64  # SHA256是64个十六进制字符
        assert len(hash_md5) == 32  # MD5是32个十六进制字符
    
    def test_get_file_metadata(self, tmp_path):
        """测试获取文件元数据"""
        test_file = tmp_path / "test.txt"
        test_file.write_text("test", encoding="utf-8")
        
        metadata = get_file_metadata(str(test_file))
        
        assert metadata["name"] == "test.txt"
        assert metadata["extension"] == ".txt"
        assert metadata["size"] == 4
        assert "created_time" in metadata
        assert "modified_time" in metadata
    
    def test_scan_directory(self, tmp_path):
        """测试目录扫描"""
        # 创建测试目录结构
        (tmp_path / "subdir").mkdir()
        (tmp_path / "file1.txt").write_text("test1", encoding="utf-8")
        (tmp_path / "file2.pdf").write_text("%PDF-1.4", encoding="utf-8")
        (tmp_path / "subdir" / "file3.jpg").write_bytes(b"\xff\xd8\xff")  # 简单的JPEG头
        
        # 扫描目录
        result = scan_directory(str(tmp_path), recursive=True, calculate_hash=False)
        
        assert result["total_files"] == 3
        assert len(result["files"]) == 3
        
        # 检查文件类型
        file_types = {f["file_type"] for f in result["files"]}
        assert "text" in file_types
        assert "pdf" in file_types
        assert "image" in file_types


class TestCsvParser:
    """测试CSV解析功能"""
    
    def test_parse_csv(self, tmp_path):
        """测试解析CSV文件"""
        csv_content = """姓名,身份证号,手机号
张三,110101199001011234,13812345678
李四,310101198505123456,13987654321
"""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        result = parse_csv(str(csv_file))
        
        assert result["row_count"] == 2
        assert result["column_count"] == 3
        assert result["columns"] == ["姓名", "身份证号", "手机号"]
        assert len(result["sample_rows"]) == 2
        
        # 检查第一行数据
        first_row = result["sample_rows"][0]
        assert first_row["姓名"] == "张三"
        assert first_row["身份证号"] == "110101199001011234"
    
    def test_parse_csv_column_types(self, tmp_path):
        """测试CSV列类型分析"""
        csv_content = """姓名,身份证号,手机号,邮箱,金额
张三,110101199001011234,13812345678,test@example.com,1000.50
李四,310101198505123456,13987654321,user@test.org,2000.00
"""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        result = parse_csv(str(csv_file))
        
        # 检查列类型
        assert "column_types" in result
        column_types = result["column_types"]
        
        # 身份证号列应该被识别为id_card类型
        assert "身份证号" in column_types
        # 手机号列应该被识别为phone类型
        assert "手机号" in column_types
    
    def test_extract_csv_text(self, tmp_path):
        """测试提取CSV为文本"""
        csv_content = """姓名,手机号
张三,13812345678
李四,13987654321
"""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        text = extract_csv_text(str(csv_file))
        
        assert "张三" in text
        assert "13812345678" in text
        assert "李四" in text


class TestIntegration:
    """集成测试"""
    
    def test_full_workflow(self, tmp_path):
        """测试完整工作流"""
        # 创建测试文件
        test_files = tmp_path / "evidence"
        test_files.mkdir()
        
        # 创建一些测试文件
        (test_files / "起诉状_第1页.txt").write_text("原告：张三，身份证：110101199001011234", encoding="utf-8")
        (test_files / "证据清单_第2页.txt").write_text("证据列表：银行转账记录", encoding="utf-8")
        (test_files / "借款合同_第3页.txt").write_text("借款人：张三，电话：13812345678", encoding="utf-8")
        
        # 扫描目录
        scan_result = scan_directory(str(test_files), recursive=False)
        
        assert scan_result["total_files"] == 3
        
        # 检查是否提取了页码
        # 文件名中有"第X页"，应该能提取
        files = scan_result["files"]
        
        # 验证每个文件都有完整的元数据
        for f in files:
            assert "name" in f
            assert "path" in f
            assert "size" in f
            assert "hash_sha256" in f
            assert "hash_md5" in f


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
