#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""哈希计算模块测试"""

import tempfile
from pathlib import Path

import pytest

from web_evidence_organizer.hasher import Hasher, DuplicateDetector


class TestHasher:
    """Hasher 测试"""

    def test_compute_file_hash(self):
        """测试文件哈希计算"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("测试内容")
            temp_path = f.name

        try:
            hash_value = Hasher.compute_file_hash(temp_path)
            assert isinstance(hash_value, str)
            assert len(hash_value) == 64
        finally:
            Path(temp_path).unlink()

    def test_compute_string_hash(self):
        """测试字符串哈希计算"""
        hash1 = Hasher.compute_string_hash("test")
        hash2 = Hasher.compute_string_hash("test")
        hash3 = Hasher.compute_string_hash("different")

        assert hash1 == hash2
        assert hash1 != hash3
        assert len(hash1) == 64

    def test_compute_bytes_hash(self):
        """测试字节哈希计算"""
        hash1 = Hasher.compute_bytes_hash(b"test")
        hash2 = Hasher.compute_bytes_hash(b"test")

        assert hash1 == hash2
        assert len(hash1) == 64

    def test_verify_file_hash(self):
        """测试文件哈希验证"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("验证测试")
            temp_path = f.name

        try:
            hash_value = Hasher.compute_file_hash(temp_path)
            assert Hasher.verify_file_hash(temp_path, hash_value) is True
            assert Hasher.verify_file_hash(temp_path, "wrong_hash") is False
        finally:
            Path(temp_path).unlink()

    def test_get_file_info(self):
        """测试获取文件信息"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("文件信息测试")
            temp_path = f.name

        try:
            info = Hasher.get_file_info(temp_path)

            assert info["filename"] == Path(temp_path).name
            assert info["extension"] == ".txt"
            assert info["size"] > 0
            assert "sha256_hash" in info
            assert len(info["sha256_hash"]) == 64
        finally:
            Path(temp_path).unlink()


class TestDuplicateDetector:
    """DuplicateDetector 测试"""

    def test_add_file(self):
        """测试添加文件"""
        detector = DuplicateDetector()

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("测试文件1")
            temp1 = f.name

        try:
            result = detector.add_file(temp1, "EVD-001")

            assert result["is_duplicate"] is False
            assert result["is_name_conflict"] is False
            assert result["file_info"]["sha256_hash"] is not None
        finally:
            Path(temp1).unlink()

    def test_duplicate_detection(self):
        """测试重复文件检测"""
        detector = DuplicateDetector()

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("相同内容")
            temp1 = f.name

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("相同内容")
            temp2 = f.name

        try:
            result1 = detector.add_file(temp1, "EVD-001")
            result2 = detector.add_file(temp2, "EVD-002")

            assert result1["is_duplicate"] is False
            assert result2["is_duplicate"] is True
            assert len(result2["duplicate_of"]) == 1
        finally:
            Path(temp1).unlink()
            Path(temp2).unlink()

    def test_name_conflict_detection(self):
        """测试文件名冲突检测"""
        detector = DuplicateDetector()

        with tempfile.TemporaryDirectory() as tmpdir:
            dir_path = Path(tmpdir)
            subdir1 = dir_path / "dir1"
            subdir2 = dir_path / "dir2"
            subdir1.mkdir()
            subdir2.mkdir()

            file1 = subdir1 / "test.txt"
            file1.write_text("内容1")

            file2 = subdir2 / "test.txt"
            file2.write_text("内容2")

            result1 = detector.add_file(str(file1), "EVD-001")
            result2 = detector.add_file(str(file2), "EVD-002")

            assert result1["is_duplicate"] is False
            assert result1["is_name_conflict"] is False
            assert result2["is_duplicate"] is False
            assert result2["is_name_conflict"] is True
            assert len(result2["name_conflict_with"]) == 1

    def test_get_duplicates(self):
        """测试获取所有重复文件"""
        detector = DuplicateDetector()

        with tempfile.TemporaryDirectory() as tmpdir:
            dir_path = Path(tmpdir)

            content = "相同内容"
            file1 = dir_path / "file1.txt"
            file1.write_text(content)
            file2 = dir_path / "file2.txt"
            file2.write_text(content)
            file3 = dir_path / "file3.txt"
            file3.write_text("不同内容")

            detector.add_file(str(file1), "EVD-001")
            detector.add_file(str(file2), "EVD-002")
            detector.add_file(str(file3), "EVD-003")

            duplicates = detector.get_duplicates()
            assert len(duplicates) == 1

            for hash_val, files in duplicates.items():
                assert len(files) == 2

    def test_get_name_conflicts(self):
        """测试获取文件名冲突"""
        detector = DuplicateDetector()

        with tempfile.TemporaryDirectory() as tmpdir:
            dir_path = Path(tmpdir)
            subdir1 = dir_path / "dir1"
            subdir2 = dir_path / "dir2"
            subdir1.mkdir()
            subdir2.mkdir()

            file1 = subdir1 / "test.txt"
            file1.write_text("内容1")

            file2 = subdir2 / "test.txt"
            file2.write_text("内容2")

            detector.add_file(str(file1), "EVD-001")
            detector.add_file(str(file2), "EVD-002")

            conflicts = detector.get_name_conflicts()
            assert len(conflicts) == 1
            assert "test.txt" in conflicts

    def test_clear(self):
        """测试清空检测器"""
        detector = DuplicateDetector()

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("测试内容")
            temp_path = f.name

        try:
            detector.add_file(temp_path, "EVD-001")
            assert len(detector.hash_map) == 1
            assert len(detector.filename_map) == 1

            detector.clear()
            assert len(detector.hash_map) == 0
            assert len(detector.filename_map) == 0
        finally:
            Path(temp_path).unlink()
