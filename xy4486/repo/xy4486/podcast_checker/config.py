"""
配置文件读取模块
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional

import yaml


class Config:
    """配置管理类"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._find_config_path()
        self._config = self._load_config()
    
    def _find_config_path(self) -> str:
        """查找配置文件"""
        possible_paths = [
            "./config.yaml",
            "./config.yml",
            "~/.podcast_checker/config.yaml",
            "~/.podcast_checker/config.yml",
        ]
        
        for path in possible_paths:
            expanded = os.path.expanduser(path)
            if os.path.exists(expanded):
                return expanded
        
        raise FileNotFoundError(
            "未找到配置文件。请在当前目录创建 config.yaml 或 "
            "参考文档了解配置文件格式"
        )
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @property
    def show(self) -> Dict[str, Any]:
        """节目信息配置"""
        return self._config.get('show', {})
    
    @property
    def naming(self) -> Dict[str, Any]:
        """命名规则配置"""
        return self._config.get('naming', {})
    
    @property
    def required_files(self) -> Dict[str, Any]:
        """必需文件配置"""
        return self.naming.get('required_files', {})
    
    @property
    def audio_config(self) -> Dict[str, Any]:
        """音频配置"""
        return self._config.get('audio', {
            'min_duration': 300,
            'max_duration': 7200,
            'target_bitrate': 128,
            'target_sample_rate': 44100,
        })
    
    @property
    def subtitles_config(self) -> Dict[str, Any]:
        """字幕配置"""
        return self._config.get('subtitles', {
            'max_timing_deviation': 5,
            'min_subtitle_duration': 1,
            'max_subtitle_duration': 10,
        })
    
    @property
    def history_config(self) -> Dict[str, Any]:
        """历史记录配置"""
        return self._config.get('history', {
            'storage_path': './check_history',
            'keep_count': 50,
        })
    
    @property
    def report_config(self) -> Dict[str, Any]:
        """报告配置"""
        return self._config.get('report', {
            'output_path': './reports',
            'include_suggestions': True,
        })
    
    def get_file_pattern(self, file_type: str) -> str:
        """获取指定类型文件的命名模式"""
        file_config = self.required_files.get(file_type, {})
        return file_config.get('pattern', '')
    
    def get_assets_folder_pattern(self) -> str:
        """获取授权素材文件夹命名模式"""
        assets_config = self.naming.get('assets', {})
        return assets_config.get('folder_pattern', '')
