"""
文件扫描器模块
扫描节目文件夹，识别各类文件
"""

import os
import re
from pathlib import Path
from typing import List, Optional, Dict

from .models import EpisodeFiles
from .config import Config


class FileScanner:
    """文件扫描器"""
    
    def __init__(self, config: Config):
        self.config = config
        self.required_files = config.required_files
        self.assets_pattern = config.get_assets_folder_pattern()
    
    def scan_folder(self, folder_path: str) -> List[EpisodeFiles]:
        """
        扫描文件夹，识别所有节目期数
        
        Args:
            folder_path: 节目文件夹路径
            
        Returns:
            识别到的节目文件列表
        """
        folder = Path(folder_path)
        if not folder.exists():
            raise FileNotFoundError(f"文件夹不存在: {folder_path}")
        
        if not folder.is_dir():
            raise NotADirectoryError(f"路径不是目录: {folder_path}")
        
        episodes = self._group_files_by_episode(folder)
        return episodes
    
    def _group_files_by_episode(self, folder: Path) -> List[EpisodeFiles]:
        """按期数分组文件"""
        episodes: Dict[str, EpisodeFiles] = {}
        
        for item in folder.iterdir():
            if item.is_file():
                episode_num = self._extract_episode_number(item.name)
                if episode_num:
                    if episode_num not in episodes:
                        episodes[episode_num] = EpisodeFiles(
                            episode_number=episode_num,
                            folder_path=str(folder)
                        )
                    self._classify_file(episodes[episode_num], item)
            elif item.is_dir():
                episode_num = self._extract_episode_number(item.name)
                if episode_num and self._is_assets_folder(item.name):
                    if episode_num not in episodes:
                        episodes[episode_num] = EpisodeFiles(
                            episode_number=episode_num,
                            folder_path=str(folder)
                        )
                    episodes[episode_num].assets_folder = str(item)
        
        return list(episodes.values())
    
    def _extract_episode_number(self, filename: str) -> Optional[str]:
        """从文件名中提取期数编号"""
        match = re.match(r'^EP(\d{3})', filename, re.IGNORECASE)
        if match:
            return match.group(1)
        return None
    
    def _is_assets_folder(self, folder_name: str) -> bool:
        """判断是否为授权素材文件夹"""
        pattern = self.assets_pattern
        if not pattern:
            return folder_name.endswith('_assets')
        return bool(re.match(pattern, folder_name, re.IGNORECASE))
    
    def _classify_file(self, episode: EpisodeFiles, file_path: Path) -> None:
        """根据文件类型分类"""
        filename = file_path.name
        
        if self._match_pattern(filename, 'audio'):
            episode.audio_path = str(file_path)
        elif self._match_pattern(filename, 'cover'):
            episode.cover_path = str(file_path)
        elif self._match_pattern(filename, 'shownotes'):
            episode.shownotes_path = str(file_path)
        elif self._match_pattern(filename, 'subtitles'):
            episode.subtitles_path = str(file_path)
        else:
            episode.extra_files.append(str(file_path))
    
    def _match_pattern(self, filename: str, file_type: str) -> bool:
        """检查文件名是否匹配指定类型的命名模式"""
        pattern = self.config.get_file_pattern(file_type)
        if not pattern:
            if file_type == 'audio':
                return filename.lower().endswith('.mp3')
            elif file_type == 'cover':
                return filename.lower().endswith(('.jpg', '.jpeg', '.png'))
            elif file_type == 'shownotes':
                return filename.lower().endswith(('.md', '.txt')) and 'shownotes' in filename.lower()
            elif file_type == 'subtitles':
                return filename.lower().endswith('.srt')
            return False
        
        return bool(re.match(pattern, filename))
