"""数据模型定义"""

from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class PathIssueType(str, Enum):
    """路径问题类型"""
    ABSOLUTE_PATH = "absolute_path"
    CHINESE_SPACE = "chinese_space"
    NORMAL_SPACE = "normal_space"
    SPECIAL_CHARACTER = "special_character"
    DUPLICATE = "duplicate"
    ENCODING_ISSUE = "encoding_issue"
    INVALID_PATH = "invalid_path"


class ExitCode(int, Enum):
    """退出码定义"""
    SUCCESS = 0
    WARNINGS = 1
    ERRORS = 2
    INVALID_INPUT = 3
    IO_ERROR = 4


class ArchiveInfo(BaseModel):
    """归档包信息"""
    path: str
    size_bytes: int
    file_count: int
    format: str
    created_at: Optional[str] = None
    modified_at: Optional[str] = None


class FileEntry(BaseModel):
    """文件条目信息"""
    index: int
    original_path: str
    normalized_path: str
    file_size: int
    is_directory: bool
    issues: List[PathIssueType] = Field(default_factory=list)
    encoding_detected: Optional[str] = None
    encoding_confidence: float = 0.0
    duplicate_group: Optional[str] = None
    duplicate_index: Optional[int] = None
    error_message: Optional[str] = None


class PathIssue(BaseModel):
    """路径问题详情"""
    issue_type: PathIssueType
    original_path: str
    normalized_path: Optional[str] = None
    message: str
    severity: str = "warning"


class DuplicateGroup(BaseModel):
    """重复文件组"""
    group_id: str
    normalized_name: str
    files: List[FileEntry] = Field(default_factory=list)
    size_bytes: Optional[int] = None


class PurificationRules(BaseModel):
    """净化规则配置"""
    remove_absolute: bool = True
    replace_spaces: bool = True
    replace_chinese_spaces: bool = True
    deduplicate: bool = True
    deduplicate_strategy: str = "index_suffix"
    normalize_separators: bool = True
    max_filename_length: int = 255


class PurificationResult(BaseModel):
    """净化结果（机器可读）"""
    archive_info: ArchiveInfo
    total_files: int
    issues_count: Dict[str, int] = Field(default_factory=dict)
    duplicate_groups: int = 0
    files_with_issues: int = 0
    files_cleaned: int = 0
    files_skipped: int = 0
    entries: List[FileEntry] = Field(default_factory=list)
    rules: PurificationRules
    output_directory: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    exit_code: ExitCode
    success: bool
