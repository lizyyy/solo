"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class IssueSeverity(Enum):
    """问题严重程度"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    """问题类型"""
    MISSING_FILE = "missing_file"
    INVALID_FILENAME = "invalid_filename"
    DURATION_TOO_SHORT = "duration_too_short"
    DURATION_TOO_LONG = "duration_too_long"
    SUBTITLE_TIMING_ERROR = "subtitle_timing_error"
    SUBTITLE_DURATION_INVALID = "subtitle_duration_invalid"
    AUDIO_QUALITY_ISSUE = "audio_quality_issue"


@dataclass
class Issue:
    """检查问题"""
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    file_path: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: Optional[str] = None


@dataclass
class EpisodeFiles:
    """单期节目文件集合"""
    episode_number: str
    folder_path: str
    
    # 文件路径
    audio_path: Optional[str] = None
    cover_path: Optional[str] = None
    shownotes_path: Optional[str] = None
    subtitles_path: Optional[str] = None
    assets_folder: Optional[str] = None
    
    # 额外文件（非必需但存在的）
    extra_files: List[str] = field(default_factory=list)
    
    # 元数据
    audio_duration: Optional[float] = None
    audio_bitrate: Optional[int] = None
    audio_sample_rate: Optional[int] = None


@dataclass
class CheckResult:
    """单期检查结果"""
    episode_number: str
    check_time: datetime
    folder_path: str
    
    # 文件信息
    files: EpisodeFiles
    
    # 检查问题
    issues: List[Issue] = field(default_factory=list)
    
    # 统计
    total_files_checked: int = 0
    error_count: int = 0
    warning_count: int = 0
    
    # 状态
    passed: bool = False


@dataclass
class CheckHistory:
    """检查历史记录"""
    episode_number: str
    check_time: datetime
    folder_path: str
    passed: bool
    error_count: int
    warning_count: int
    issues_summary: List[str]
    result_file: str
