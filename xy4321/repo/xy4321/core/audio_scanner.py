import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum

from core.metadata_parser import metadata_parser
from db.database import db_manager
from db.models import AudioFile


class ScanStatus(Enum):
    IDLE = "idle"
    SCANNING = "scanning"
    PARSING = "parsing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ERROR = "error"


class AudioScanner:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self._status = ScanStatus.IDLE
        self._cancel_requested = False
        self._supported_extensions = {".wav", ".mp3", ".m4a", ".mp4", ".aac", ".flac"}
    
    def scan_folder(self, folder_path: str, project_id: int,
                    progress_callback: Callable[[int, int, str], None] = None,
                    recursive: bool = True,
                    compute_hash: bool = True) -> List[Dict[str, Any]]:
        folder_path = str(Path(folder_path).resolve())
        
        if not os.path.exists(folder_path):
            raise ValueError(f"文件夹不存在: {folder_path}")
        
        self._status = ScanStatus.SCANNING
        self._cancel_requested = False
        
        try:
            audio_files = self._find_audio_files(folder_path, recursive)
            
            if not audio_files:
                self._status = ScanStatus.COMPLETED
                return []
            
            total_files = len(audio_files)
            parsed_files = []
            
            for index, file_path in enumerate(audio_files):
                if self._cancel_requested:
                    self._status = ScanStatus.CANCELLED
                    return parsed_files
                
                if progress_callback:
                    progress_callback(index + 1, total_files, f"正在解析: {Path(file_path).name}")
                
                self._status = ScanStatus.PARSING
                
                try:
                    metadata = metadata_parser.parse_file(file_path, compute_hash=compute_hash)
                    
                    if metadata:
                        metadata["project_id"] = project_id
                        
                        audio_file = db_manager.create_audio_file(metadata)
                        
                        if audio_file:
                            parsed_files.append({
                                "id": audio_file.id,
                                "file_path": audio_file.file_path,
                                "file_name": audio_file.file_name,
                                "format": audio_file.format,
                                "duration_seconds": audio_file.duration_seconds,
                                "sample_rate": audio_file.sample_rate,
                                "channels": audio_file.channels,
                            })
                            
                except Exception as e:
                    print(f"解析文件失败 {file_path}: {e}")
                    continue
            
            self._status = ScanStatus.COMPLETED
            
            if progress_callback:
                progress_callback(total_files, total_files, "扫描完成")
            
            return parsed_files
            
        except Exception as e:
            self._status = ScanStatus.ERROR
            print(f"扫描文件夹失败: {e}")
            return []
    
    def _find_audio_files(self, folder_path: str, recursive: bool) -> List[str]:
        audio_files = []
        
        try:
            if recursive:
                for root, dirs, files in os.walk(folder_path):
                    for file in files:
                        ext = Path(file).suffix.lower()
                        if ext in self._supported_extensions:
                            audio_files.append(os.path.join(root, file))
            else:
                for file in os.listdir(folder_path):
                    file_path = os.path.join(folder_path, file)
                    if os.path.isfile(file_path):
                        ext = Path(file).suffix.lower()
                        if ext in self._supported_extensions:
                            audio_files.append(file_path)
        
        except Exception as e:
            print(f"查找音频文件失败: {e}")
        
        return audio_files
    
    def cancel_scan(self):
        self._cancel_requested = True
    
    def get_status(self) -> ScanStatus:
        return self._status
    
    def is_scanning(self) -> bool:
        return self._status in [ScanStatus.SCANNING, ScanStatus.PARSING]
    
    def refresh_file(self, file_path: str, project_id: int, compute_hash: bool = True) -> Optional[Dict[str, Any]]:
        file_path = str(Path(file_path).resolve())
        
        if not os.path.exists(file_path):
            return None
        
        ext = Path(file_path).suffix.lower()
        if ext not in self._supported_extensions:
            return None
        
        try:
            metadata = metadata_parser.parse_file(file_path, compute_hash=compute_hash)
            
            if metadata:
                metadata["project_id"] = project_id
                
                audio_file = db_manager.create_audio_file(metadata)
                
                if audio_file:
                    return {
                        "id": audio_file.id,
                        "file_path": audio_file.file_path,
                        "file_name": audio_file.file_name,
                        "format": audio_file.format,
                        "duration_seconds": audio_file.duration_seconds,
                        "sample_rate": audio_file.sample_rate,
                        "channels": audio_file.channels,
                    }
            
        except Exception as e:
            print(f"刷新文件失败 {file_path}: {e}")
        
        return None
    
    def detect_role_from_filename(self, filename: str) -> Optional[str]:
        filename_lower = filename.lower()
        
        role_keywords = {
            "主持人": ["host", "主持人", "主播", "主", "mc"],
            "嘉宾": ["guest", "嘉宾", "客人", "嘉"],
            "片头": ["intro", "片头", "开场", "op", "opening"],
            "片尾": ["outro", "片尾", "结束", "ed", "ending"],
            "广告": ["ad", "广告", "赞助", "commercial", "spot"],
            "远程录音": ["remote", "远程", "线上", "线上录音", "zoom", "skype"],
        }
        
        for role, keywords in role_keywords.items():
            for keyword in keywords:
                if keyword in filename_lower:
                    return role
        
        return None
    
    def detect_quality_from_filename(self, filename: str) -> Optional[str]:
        filename_lower = filename.lower()
        
        quality_keywords = {
            "高质量": ["hq", "high", "高质量", "高音质", "优质"],
            "中等质量": ["mq", "medium", "中等", "普通"],
            "低质量": ["lq", "low", "低质量", "低音质", "差"],
            "原始录音": ["raw", "original", "原始", "未处理"],
        }
        
        for quality, keywords in quality_keywords.items():
            for keyword in keywords:
                if keyword in filename_lower:
                    return quality
        
        return None


audio_scanner = AudioScanner()
