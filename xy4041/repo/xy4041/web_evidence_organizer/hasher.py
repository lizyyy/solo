#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
哈希计算模块
计算文件SHA256哈希值，用于证据完整性校验
"""

import hashlib
import os
from pathlib import Path
from typing import Dict, Optional


class Hasher:
    """文件哈希计算器"""

    @staticmethod
    def compute_file_hash(file_path: str, chunk_size: int = 8192) -> str:
        """
        计算文件的SHA256哈希值

        Args:
            file_path: 文件路径
            chunk_size: 读取块大小

        Returns:
            SHA256哈希十六进制字符串
        """
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                sha256.update(chunk)
        return sha256.hexdigest()

    @staticmethod
    def compute_string_hash(content: str, encoding: str = "utf-8") -> str:
        """
        计算字符串的SHA256哈希值

        Args:
            content: 字符串内容
            encoding: 编码格式

        Returns:
            SHA256哈希十六进制字符串
        """
        return hashlib.sha256(content.encode(encoding)).hexdigest()

    @staticmethod
    def compute_bytes_hash(data: bytes) -> str:
        """
        计算字节数据的SHA256哈希值

        Args:
            data: 字节数据

        Returns:
            SHA256哈希十六进制字符串
        """
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def verify_file_hash(file_path: str, expected_hash: str) -> bool:
        """
        验证文件哈希是否匹配

        Args:
            file_path: 文件路径
            expected_hash: 期望的哈希值

        Returns:
            哈希是否匹配
        """
        actual_hash = Hasher.compute_file_hash(file_path)
        return actual_hash.lower() == expected_hash.lower()

    @staticmethod
    def get_file_info(file_path: str) -> Dict:
        """
        获取文件完整信息（包括哈希）

        Args:
            file_path: 文件路径

        Returns:
            包含文件信息和哈希的字典
        """
        path = Path(file_path)
        stat = path.stat()
        return {
            "path": str(path.absolute()),
            "filename": path.name,
            "extension": path.suffix.lower(),
            "size": stat.st_size,
            "created_time": stat.st_ctime,
            "modified_time": stat.st_mtime,
            "sha256_hash": Hasher.compute_file_hash(file_path),
        }


class DuplicateDetector:
    """重复文件检测器"""

    def __init__(self):
        self.hash_map: Dict[str, list] = {}
        self.filename_map: Dict[str, list] = {}

    def add_file(self, file_path: str, evidence_id: str = None) -> Dict:
        """
        添加文件进行检测

        Args:
            file_path: 文件路径
            evidence_id: 证据ID（可选）

        Returns:
            检测结果字典
        """
        file_info = Hasher.get_file_info(file_path)
        file_hash = file_info["sha256_hash"]
        filename = file_info["filename"]

        result = {
            "is_duplicate": False,
            "is_name_conflict": False,
            "duplicate_of": [],
            "name_conflict_with": [],
            "file_info": file_info,
        }

        if file_hash in self.hash_map:
            result["is_duplicate"] = True
            result["duplicate_of"] = self.hash_map[file_hash].copy()

        if filename in self.filename_map:
            result["is_name_conflict"] = True
            result["name_conflict_with"] = [
                entry for entry in self.filename_map[filename]
                if entry["hash"] != file_hash
            ]

        entry = {
            "path": file_path,
            "hash": file_hash,
            "evidence_id": evidence_id,
        }

        if file_hash not in self.hash_map:
            self.hash_map[file_hash] = []
        self.hash_map[file_hash].append(entry)

        if filename not in self.filename_map:
            self.filename_map[filename] = []
        self.filename_map[filename].append(entry)

        return result

    def get_duplicates(self) -> Dict[str, list]:
        """
        获取所有重复文件组

        Returns:
            哈希值到文件列表的映射
        """
        return {
            h: files
            for h, files in self.hash_map.items()
            if len(files) > 1
        }

    def get_name_conflicts(self) -> Dict[str, list]:
        """
        获取所有文件名冲突（同名不同内容）

        Returns:
            文件名到文件列表的映射
        """
        conflicts = {}
        for filename, files in self.filename_map.items():
            unique_hashes = set(f["hash"] for f in files)
            if len(unique_hashes) > 1:
                conflicts[filename] = files
        return conflicts

    def clear(self):
        """清空检测器状态"""
        self.hash_map.clear()
        self.filename_map.clear()
