import os
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from config import PodcastProgram, config
import logging

logger = logging.getLogger(__name__)


class FileScanner:
    """文件扫描器，用于扫描项目目录中的播客节目文件"""
    
    def __init__(self, program_configs: Dict[str, PodcastProgram] = None):
        self.program_configs = program_configs or config.programs
    
    def scan_directory(self, directory_path: str) -> List[Dict[str, Any]]:
        """
        扫描指定目录，查找所有播客节目文件夹
        
        Args:
            directory_path: 要扫描的目录路径
            
        Returns:
            包含节目信息的列表，每个元素包含节目名称、文件夹路径、匹配的节目配置等
        """
        results = []
        
        if not os.path.isdir(directory_path):
            logger.error(f"目录不存在: {directory_path}")
            return results
        
        # 遍历目录中的所有文件夹
        for item in os.listdir(directory_path):
            item_path = os.path.join(directory_path, item)
            
            if os.path.isdir(item_path):
                # 检查这个文件夹是否匹配任何节目配置
                matched_program = None
                for program_id, program_config in self.program_configs.items():
                    if self._matches_pattern(item, program_config.folder_pattern):
                        matched_program = (program_id, program_config)
                        break
                
                if matched_program:
                    program_id, program_config = matched_program
                    # 扫描节目文件夹中的文件
                    files = self._scan_program_files(item_path, program_config)
                    
                    results.append({
                        "program_id": program_id,
                        "program_name": program_config.name,
                        "folder_name": item,
                        "folder_path": item_path,
                        "scan_time": datetime.now().isoformat(),
                        "files": files,
                        "config": self._program_config_to_dict(program_config)
                    })
                else:
                    logger.debug(f"文件夹 {item} 不匹配任何节目配置模式")
        
        return results
    
    def _matches_pattern(self, folder_name: str, pattern: str) -> bool:
        """
        检查文件夹名称是否匹配指定的模式
        
        Args:
            folder_name: 文件夹名称
            pattern: 匹配模式（支持简单的通配符）
            
        Returns:
            是否匹配
        """
        # 将简单通配符转换为正则表达式
        regex_pattern = pattern.replace("*", ".*")
        return re.match(regex_pattern, folder_name) is not None
    
    def _scan_program_files(self, folder_path: str, program_config: PodcastProgram) -> Dict[str, Any]:
        """
        扫描节目文件夹中的文件，按类型分类
        
        Args:
            folder_path: 节目文件夹路径
            program_config: 节目配置
            
        Returns:
            包含各类文件的字典
        """
        result = {
            "audio": [],
            "subtitles": [],
            "covers": [],
            "notes": [],
            "edit_lists": [],
            "others": []
        }
        
        for file_name in os.listdir(folder_path):
            file_path = os.path.join(folder_path, file_name)
            
            if os.path.isfile(file_path):
                file_ext = os.path.splitext(file_name)[1].lower()
                
                # 根据扩展名分类文件
                if file_ext in program_config.audio_extensions:
                    result["audio"].append({
                        "name": file_name,
                        "path": file_path,
                        "size": os.path.getsize(file_path),
                        "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    })
                elif file_ext in program_config.subtitle_extensions:
                    result["subtitles"].append({
                        "name": file_name,
                        "path": file_path,
                        "size": os.path.getsize(file_path),
                        "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    })
                elif file_ext in program_config.cover_extensions:
                    result["covers"].append({
                        "name": file_name,
                        "path": file_path,
                        "size": os.path.getsize(file_path),
                        "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    })
                elif file_ext in program_config.edit_list_extensions:
                    # 优先检查是否为剪辑单（通过文件名关键词）
                    if "剪辑" in file_name.lower() or "edit" in file_name.lower() or "cut" in file_name.lower():
                        result["edit_lists"].append({
                            "name": file_name,
                            "path": file_path,
                            "size": os.path.getsize(file_path),
                            "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                        })
                    elif file_ext in program_config.notes_extensions:
                        # 如果不是剪辑单，才归类为备注文件
                        result["notes"].append({
                            "name": file_name,
                            "path": file_path,
                            "size": os.path.getsize(file_path),
                            "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                        })
                    else:
                        result["others"].append({
                            "name": file_name,
                            "path": file_path,
                            "size": os.path.getsize(file_path),
                            "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                        })
                elif file_ext in program_config.notes_extensions:
                    result["notes"].append({
                        "name": file_name,
                        "path": file_path,
                        "size": os.path.getsize(file_path),
                        "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    })
                else:
                    result["others"].append({
                        "name": file_name,
                        "path": file_path,
                        "size": os.path.getsize(file_path),
                        "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    })
        
        return result
    
    def _program_config_to_dict(self, config: PodcastProgram) -> Dict[str, Any]:
        """将节目配置转换为字典"""
        return {
            "name": config.name,
            "folder_pattern": config.folder_pattern,
            "required_files": config.required_files,
            "audio_extensions": config.audio_extensions,
            "subtitle_extensions": config.subtitle_extensions,
            "cover_extensions": config.cover_extensions,
            "notes_extensions": config.notes_extensions,
            "edit_list_extensions": config.edit_list_extensions,
            "check_audio_duration": config.check_audio_duration,
            "check_subtitle_sync": config.check_subtitle_sync,
            "check_cover_dimensions": config.check_cover_dimensions,
            "check_notes_confirmed": config.check_notes_confirmed,
            "expected_cover_width": config.expected_cover_width,
            "expected_cover_height": config.expected_cover_height,
            "min_audio_duration": config.min_audio_duration,
            "max_audio_duration": config.max_audio_duration,
            "subtitle_sync_tolerance": config.subtitle_sync_tolerance,
            "confirmation_keywords": config.confirmation_keywords
        }
