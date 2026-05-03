"""
文件扫描模块
负责扫描素材目录，识别音频文件、场记CSV和备注文件
"""

import os
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class FileInfo:
    """文件信息数据类"""
    file_path: str
    file_name: str
    file_size: int
    file_type: str  # 'audio', 'csv', 'note', 'other'
    extension: str
    creation_time: float
    modification_time: float
    file_hash: str = ""
    scan_time: str = field(default_factory=lambda: datetime.now().isoformat())


class FileScanner:
    """文件扫描器类"""
    
    # 支持的音频格式
    AUDIO_EXTENSIONS = {'.wav', '.mp3', '.aiff', '.flac', '.ogg', '.m4a', '.wma'}
    
    # 支持的场记格式
    LOG_EXTENSIONS = {'.csv', '.xlsx', '.xls'}
    
    # 支持的备注格式
    NOTE_EXTENSIONS = {'.txt', '.md', '.rtf'}
    
    def __init__(self, directory_path: str):
        """
        初始化文件扫描器
        
        Args:
            directory_path: 要扫描的目录路径
        """
        self.directory_path = Path(directory_path)
        if not self.directory_path.exists():
            raise FileNotFoundError(f"目录不存在: {directory_path}")
        if not self.directory_path.is_dir():
            raise NotADirectoryError(f"不是有效的目录: {directory_path}")
        
        self.audio_files: List[FileInfo] = []
        self.log_files: List[FileInfo] = []
        self.note_files: List[FileInfo] = []
        self.other_files: List[FileInfo] = []
        
        self.scan_summary: Dict[str, Any] = {}
    
    def scan(self, recursive: bool = True) -> Dict[str, Any]:
        """
        扫描目录
        
        Args:
            recursive: 是否递归扫描子目录
            
        Returns:
            扫描结果摘要
        """
        self.audio_files = []
        self.log_files = []
        self.note_files = []
        self.other_files = []
        
        scan_pattern = "**/*" if recursive else "*"
        
        for file_path in self.directory_path.glob(scan_pattern):
            if file_path.is_file():
                file_info = self._process_file(file_path)
                if file_info:
                    self._categorize_file(file_info)
        
        self._generate_scan_summary()
        return self.scan_summary
    
    def _process_file(self, file_path: Path) -> Optional[FileInfo]:
        """
        处理单个文件，提取基本信息
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件信息对象，如果处理失败则返回None
        """
        try:
            stat = file_path.stat()
            extension = file_path.suffix.lower()
            
            # 计算文件哈希（用于检测重复）
            file_hash = self._calculate_file_hash(file_path)
            
            return FileInfo(
                file_path=str(file_path),
                file_name=file_path.name,
                file_size=stat.st_size,
                file_type=self._determine_file_type(extension),
                extension=extension,
                creation_time=stat.st_birthtime if hasattr(stat, 'st_birthtime') else stat.st_mtime,
                modification_time=stat.st_mtime,
                file_hash=file_hash
            )
        except Exception as e:
            print(f"处理文件时出错 {file_path}: {e}")
            return None
    
    def _determine_file_type(self, extension: str) -> str:
        """
        根据扩展名确定文件类型
        
        Args:
            extension: 文件扩展名（带点）
            
        Returns:
            文件类型字符串
        """
        if extension in self.AUDIO_EXTENSIONS:
            return 'audio'
        elif extension in self.LOG_EXTENSIONS:
            return 'csv'
        elif extension in self.NOTE_EXTENSIONS:
            return 'note'
        else:
            return 'other'
    
    def _categorize_file(self, file_info: FileInfo):
        """
        将文件分类到对应的列表
        
        Args:
            file_info: 文件信息对象
        """
        if file_info.file_type == 'audio':
            self.audio_files.append(file_info)
        elif file_info.file_type == 'csv':
            self.log_files.append(file_info)
        elif file_info.file_type == 'note':
            self.note_files.append(file_info)
        else:
            self.other_files.append(file_info)
    
    def _calculate_file_hash(self, file_path: Path, algorithm: str = 'sha256', block_size: int = 8192) -> str:
        """
        计算文件哈希值，用于检测重复文件
        
        Args:
            file_path: 文件路径
            algorithm: 哈希算法
            block_size: 读取块大小
            
        Returns:
            哈希值字符串
        """
        try:
            hasher = hashlib.new(algorithm)
            with open(file_path, 'rb') as f:
                for block in iter(lambda: f.read(block_size), b''):
                    hasher.update(block)
            return hasher.hexdigest()
        except Exception:
            return ""
    
    def _generate_scan_summary(self):
        """生成扫描摘要"""
        self.scan_summary = {
            'directory_scanned': str(self.directory_path),
            'scan_time': datetime.now().isoformat(),
            'total_files': len(self.audio_files) + len(self.log_files) + len(self.note_files) + len(self.other_files),
            'audio_files_count': len(self.audio_files),
            'log_files_count': len(self.log_files),
            'note_files_count': len(self.note_files),
            'other_files_count': len(self.other_files),
            'total_size': sum(f.file_size for f in self.audio_files + self.log_files + self.note_files + self.other_files),
            'audio_files': [self._file_info_to_dict(f) for f in self.audio_files],
            'log_files': [self._file_info_to_dict(f) for f in self.log_files],
            'note_files': [self._file_info_to_dict(f) for f in self.note_files]
        }
    
    def _file_info_to_dict(self, file_info: FileInfo) -> Dict[str, Any]:
        """
        将FileInfo对象转换为字典
        
        Args:
            file_info: 文件信息对象
            
        Returns:
            字典表示
        """
        return {
            'file_path': file_info.file_path,
            'file_name': file_info.file_name,
            'file_size': file_info.file_size,
            'file_type': file_info.file_type,
            'extension': file_info.extension,
            'creation_time': file_info.creation_time,
            'modification_time': file_info.modification_time,
            'file_hash': file_info.file_hash,
            'scan_time': file_info.scan_time
        }
    
    def get_duplicate_files(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        检测重复文件（基于文件哈希）
        
        Returns:
            重复文件字典，键为哈希值，值为文件信息字典列表
        """
        hash_map: Dict[str, List[Dict[str, Any]]] = {}
        
        # 检查音频文件中的重复
        for audio_file in self.audio_files:
            if audio_file.file_hash:
                if audio_file.file_hash not in hash_map:
                    hash_map[audio_file.file_hash] = []
                hash_map[audio_file.file_hash].append(self._file_info_to_dict(audio_file))
        
        # 只返回有重复的
        duplicates = {h: files for h, files in hash_map.items() if len(files) > 1}
        
        return duplicates
    
    def get_all_files(self) -> List[Dict[str, Any]]:
        """
        获取所有扫描到的文件信息
        
        Returns:
            所有文件信息字典列表
        """
        all_files = []
        all_files.extend([self._file_info_to_dict(f) for f in self.audio_files])
        all_files.extend([self._file_info_to_dict(f) for f in self.log_files])
        all_files.extend([self._file_info_to_dict(f) for f in self.note_files])
        return all_files


def scan_directory(directory_path: str, recursive: bool = True) -> Dict[str, Any]:
    """
    便捷函数：扫描指定目录
    
    Args:
        directory_path: 目录路径
        recursive: 是否递归扫描
        
    Returns:
        扫描结果摘要
    """
    scanner = FileScanner(directory_path)
    return scanner.scan(recursive=recursive)
