import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from config import config


class FileScanner:
    """文件扫描器 - 扫描目录中的所有文件并分类"""
    
    def __init__(self, source_dir: str):
        self.source_dir = Path(source_dir)
        if not self.source_dir.exists():
            raise ValueError(f"源目录不存在: {source_dir}")
        
        self.photos: List[Dict[str, Any]] = []
        self.csv_files: List[Dict[str, Any]] = []
        self.gpx_files: List[Dict[str, Any]] = []
        self.text_files: List[Dict[str, Any]] = []
        self.other_files: List[Dict[str, Any]] = []
    
    def scan(self) -> Dict[str, List[Dict[str, Any]]]:
        """扫描目录中的所有文件"""
        if not self.source_dir.is_dir():
            raise ValueError(f"路径不是目录: {self.source_dir}")
        
        for file_path in self.source_dir.iterdir():
            if file_path.is_file():
                self._classify_file(file_path)
        
        return {
            'photos': self.photos,
            'csv_files': self.csv_files,
            'gpx_files': self.gpx_files,
            'text_files': self.text_files,
            'other_files': self.other_files
        }
    
    def _classify_file(self, file_path: Path):
        """根据文件扩展名分类文件"""
        ext = file_path.suffix.lower()
        file_info = self._get_file_info(file_path)
        
        if ext in config.PHOTO_EXTENSIONS:
            self.photos.append(file_info)
        elif ext == config.CSV_EXTENSION:
            self.csv_files.append(file_info)
        elif ext == config.GPX_EXTENSION:
            self.gpx_files.append(file_info)
        elif ext in config.TEXT_EXTENSIONS:
            self.text_files.append(file_info)
        else:
            self.other_files.append(file_info)
    
    def _get_file_info(self, file_path: Path) -> Dict[str, Any]:
        """获取文件基本信息"""
        stat = file_path.stat()
        return {
            'path': str(file_path),
            'name': file_path.name,
            'size': stat.st_size,
            'created_time': datetime.fromtimestamp(stat.st_birthtime).isoformat(),
            'modified_time': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'extension': file_path.suffix.lower()
        }
    
    def extract_hole_number(self, filename: str) -> Optional[str]:
        """从文件名中提取孔号"""
        patterns = [
            r'ZK-?(\d+)',
            r'ZK(\d+)',
            r'zk-?(\d+)',
            r'Hole-?(\d+)',
            r'孔号[：:]\s*(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return f"ZK{match.group(1)}"
        
        return None
    
    def extract_box_number(self, filename: str) -> Optional[int]:
        """从文件名中提取箱号"""
        patterns = [
            r'箱[：:]\s*(\d+)',
            r'箱(\d+)',
            r'Box-?(\d+)',
            r'box-?(\d+)',
            r'BX-?(\d+)',
            r'(\d+)箱',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return None
    
    def extract_depth_range(self, filename: str) -> Optional[Dict[str, float]]:
        """从文件名中提取深度区间"""
        pattern = r'(\d+\.?\d*)\s*[-~至]\s*(\d+\.?\d*)'
        match = re.search(pattern, filename)
        if match:
            return {
                'start': float(match.group(1)),
                'end': float(match.group(2))
            }
        return None
    
    def get_scan_summary(self) -> Dict[str, Any]:
        """获取扫描摘要"""
        return {
            'source_directory': str(self.source_dir),
            'scan_time': datetime.now().isoformat(),
            'total_files': len(self.photos) + len(self.csv_files) + 
                          len(self.gpx_files) + len(self.text_files) + 
                          len(self.other_files),
            'photo_count': len(self.photos),
            'csv_count': len(self.csv_files),
            'gpx_count': len(self.gpx_files),
            'text_count': len(self.text_files),
            'other_count': len(self.other_files)
        }
