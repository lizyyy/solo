import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class PodcastProgram:
    name: str
    folder_pattern: str  # 用于匹配节目文件夹的模式
    required_files: List[str] = field(default_factory=lambda: ["audio.mp3", "subtitles.srt", "cover.jpg", "notes.txt"])
    audio_extensions: List[str] = field(default_factory=lambda: [".mp3", ".wav", ".m4a"])
    subtitle_extensions: List[str] = field(default_factory=lambda: [".srt", ".vtt", ".ass"])
    cover_extensions: List[str] = field(default_factory=lambda: [".jpg", ".jpeg", ".png", ".webp"])
    notes_extensions: List[str] = field(default_factory=lambda: [".txt", ".md", ".docx"])
    edit_list_extensions: List[str] = field(default_factory=lambda: [".txt", ".md", ".csv"])
    
    # 检查规则
    check_audio_duration: bool = True
    check_subtitle_sync: bool = True
    check_cover_dimensions: bool = True
    check_notes_confirmed: bool = True
    
    # 规则参数
    expected_cover_width: int = 1400
    expected_cover_height: int = 1400
    min_audio_duration: int = 60  # 秒
    max_audio_duration: int = 7200  # 秒
    subtitle_sync_tolerance: float = 0.5  # 秒，字幕与音频的时间差容忍度
    
    # 备注确认关键词
    confirmation_keywords: List[str] = field(default_factory=lambda: ["已确认", "确认无误", "已审核", "confirmed", "approved"])


DEFAULT_PROGRAMS: Dict[str, PodcastProgram] = {
    "tech_talk": PodcastProgram(
        name="科技访谈",
        folder_pattern="tech_talk_*",
        expected_cover_width=1400,
        expected_cover_height=1400,
    ),
    "daily_news": PodcastProgram(
        name="每日新闻",
        folder_pattern="daily_news_*",
        expected_cover_width=1200,
        expected_cover_height=1200,
        min_audio_duration=300,
        max_audio_duration=3600,
    ),
    "music_hour": PodcastProgram(
        name="音乐时刻",
        folder_pattern="music_hour_*",
        expected_cover_width=1600,
        expected_cover_height=1600,
        check_subtitle_sync=False,  # 音乐节目可能不需要字幕
    ),
}


@dataclass
class AppConfig:
    # 状态文件路径
    state_file: str = "delivery_check_state.json"
    
    # 日志文件路径
    log_file: str = "delivery_check.log"
    
    # 默认检查的节目配置
    programs: Dict[str, PodcastProgram] = field(default_factory=lambda: DEFAULT_PROGRAMS)
    
    # 导出报告格式
    export_formats: List[str] = field(default_factory=lambda: ["json", "csv", "html"])
    
    # 网页服务配置
    web_host: str = "127.0.0.1"
    web_port: int = 5000
    
    @classmethod
    def load(cls) -> "AppConfig":
        """加载配置"""
        # 这里可以实现从配置文件加载的逻辑
        return cls()


# 全局配置实例
config = AppConfig.load()
