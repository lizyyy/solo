import hashlib
import os
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
from datetime import datetime

from .models import VideoSegment, Anomaly, AnomalyType, AnomalySeverity


class HashCalculator:
    """
    SHA256 哈希计算器
    支持大文件的分块读取
    """
    
    def __init__(self, chunk_size: int = 8192):
        self.chunk_size = chunk_size
    
    def calculate_file_hash(self, file_path: str) -> str:
        """
        计算文件的 SHA256 哈希值
        """
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(self.chunk_size), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()
    
    def calculate_string_hash(self, data: str) -> str:
        """
        计算字符串的 SHA256 哈希值
        """
        return hashlib.sha256(data.encode('utf-8')).hexdigest()
    
    def calculate_bytes_hash(self, data: bytes) -> str:
        """
        计算字节数据的 SHA256 哈希值
        """
        return hashlib.sha256(data).hexdigest()


class HashConflictDetector:
    """
    哈希冲突检测器
    检测：
    1. 同名文件的哈希冲突
    2. 不同文件名但相同哈希（重复片段）
    3. 哈希值异常
    """
    
    def __init__(self):
        self.hash_to_files: Dict[str, List[str]] = defaultdict(list)
        self.filename_to_hashes: Dict[str, List[str]] = defaultdict(list)
        self.file_to_hash: Dict[str, str] = {}
    
    def add_file(self, filename: str, file_path: str, hash_value: str):
        """
        添加文件到检测器
        """
        self.hash_to_files[hash_value].append(file_path)
        self.filename_to_hashes[filename].append(hash_value)
        self.file_to_hash[file_path] = hash_value
    
    def add_segments(self, segments: List[VideoSegment]):
        """
        批量添加视频片段
        """
        for segment in segments:
            if segment.sha256_hash:
                self.add_file(
                    segment.filename,
                    segment.file_path,
                    segment.sha256_hash
                )
    
    def detect_duplicates(self) -> List[Tuple[str, List[str]]]:
        """
        检测重复片段（相同哈希值）
        返回: [(hash_value, [file_paths]), ...]
        """
        duplicates = []
        for hash_value, file_paths in self.hash_to_files.items():
            if len(file_paths) > 1:
                duplicates.append((hash_value, file_paths))
        return duplicates
    
    def detect_filename_conflicts(self) -> List[Tuple[str, List[str]]]:
        """
        检测同名文件的哈希冲突
        返回: [(filename, [hash_values]), ...]
        """
        conflicts = []
        for filename, hash_values in self.filename_to_hashes.items():
            if len(set(hash_values)) > 1:
                conflicts.append((filename, hash_values))
        return conflicts
    
    def generate_anomalies(self) -> List[Anomaly]:
        """
        生成异常报告
        """
        anomalies = []
        
        duplicates = self.detect_duplicates()
        for hash_value, file_paths in duplicates:
            anomaly = Anomaly(
                anomaly_type=AnomalyType.DUPLICATE_SEGMENT,
                severity=AnomalySeverity.MEDIUM,
                timestamp=datetime.now(),
                description=f"发现重复片段，{len(file_paths)} 个文件具有相同的哈希值",
                affected_files=file_paths,
                details={
                    'hash_value': hash_value,
                    'file_count': len(file_paths),
                    'files': file_paths
                }
            )
            anomalies.append(anomaly)
        
        conflicts = self.detect_filename_conflicts()
        for filename, hash_values in conflicts:
            unique_hashes = list(set(hash_values))
            anomaly = Anomaly(
                anomaly_type=AnomalyType.HASH_CONFLICT,
                severity=AnomalySeverity.HIGH,
                timestamp=datetime.now(),
                description=f"同名文件 '{filename}' 存在哈希冲突，发现 {len(unique_hashes)} 个不同的哈希值",
                affected_files=[filename],
                details={
                    'filename': filename,
                    'hash_count': len(unique_hashes),
                    'hash_values': unique_hashes,
                    'occurrences': len(hash_values)
                }
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def get_manifest(self) -> Dict[str, str]:
        """
        获取哈希清单
        返回: {file_path: hash_value, ...}
        """
        return dict(self.file_to_hash)


class SegmentHasher:
    """
    视频片段哈希处理器
    负责计算和验证视频片段的哈希值
    """
    
    def __init__(self, chunk_size: int = 8192):
        self.hash_calculator = HashCalculator(chunk_size)
        self.conflict_detector = HashConflictDetector()
    
    def hash_segments(
        self, 
        segments: List[VideoSegment],
        skip_missing: bool = True
    ) -> Tuple[List[VideoSegment], List[Anomaly]]:
        """
        为视频片段计算哈希值
        """
        processed_segments = []
        anomalies = []
        
        for segment in segments:
            if segment.sha256_hash:
                processed_segments.append(segment)
                continue
            
            if not os.path.exists(segment.file_path):
                if skip_missing:
                    print(f"Warning: File not found, skipping: {segment.file_path}")
                    processed_segments.append(segment)
                    continue
                else:
                    raise FileNotFoundError(f"File not found: {segment.file_path}")
            
            try:
                hash_value = self.hash_calculator.calculate_file_hash(segment.file_path)
                segment.sha256_hash = hash_value
                processed_segments.append(segment)
            except Exception as e:
                print(f"Warning: Failed to hash {segment.file_path}: {e}")
                processed_segments.append(segment)
        
        self.conflict_detector.add_segments(processed_segments)
        conflict_anomalies = self.conflict_detector.generate_anomalies()
        anomalies.extend(conflict_anomalies)
        
        return processed_segments, anomalies
    
    def verify_hash(self, segment: VideoSegment, expected_hash: str) -> Tuple[bool, str]:
        """
        验证视频片段的哈希值
        返回: (is_valid, actual_hash)
        """
        if not os.path.exists(segment.file_path):
            return False, ""
        
        actual_hash = self.hash_calculator.calculate_file_hash(segment.file_path)
        return actual_hash == expected_hash, actual_hash
    
    def verify_all(
        self,
        segments: List[VideoSegment],
        expected_hashes: Dict[str, str]
    ) -> List[Tuple[VideoSegment, bool, str, str]]:
        """
        批量验证哈希值
        返回: [(segment, is_valid, expected_hash, actual_hash), ...]
        """
        results = []
        
        for segment in segments:
            file_key = segment.file_path
            expected_hash = expected_hashes.get(file_key, "")
            
            if not expected_hash:
                expected_hash = expected_hashes.get(segment.filename, "")
            
            if expected_hash:
                is_valid, actual_hash = self.verify_hash(segment, expected_hash)
                results.append((segment, is_valid, expected_hash, actual_hash))
        
        return results
    
    def get_manifest(self) -> Dict[str, str]:
        """
        获取哈希清单
        """
        return self.conflict_detector.get_manifest()
