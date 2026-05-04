import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from enum import Enum

try:
    from pydub import AudioSegment
    from pydub.silence import detect_silence
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False

from db.database import db_manager
from db.models import AudioFile, ValidationIssue
from config.settings import settings_manager


class IssueType(Enum):
    SAMPLE_RATE_MISMATCH = "sample_rate_mismatch"
    MISSING_ROLE_TRACK = "missing_role_track"
    DUPLICATE_NAME_DIFFERENT_CONTENT = "duplicate_name_different_content"
    LONG_SILENCE = "long_silence"
    CHANNELS_MISMATCH = "channels_mismatch"
    UNKNOWN_ROLE = "unknown_role"
    FILE_NOT_FOUND = "file_not_found"


class IssueSeverity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationResult:
    def __init__(self):
        self.issues: List[Dict[str, Any]] = []
        self.summary: Dict[str, int] = defaultdict(int)
        self.sample_rate_stats: Dict[int, int] = defaultdict(int)
        self.role_stats: Dict[str, int] = defaultdict(int)
    
    def add_issue(self, audio_file_id: int, issue_type: str, description: str,
                  severity: str = "warning"):
        issue = {
            "audio_file_id": audio_file_id,
            "issue_type": issue_type,
            "description": description,
            "severity": severity
        }
        self.issues.append(issue)
        self.summary[issue_type] += 1


class ValidationEngine:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self._settings = settings_manager.get_settings()
    
    def validate_project(self, project_id: int, 
                         check_sample_rate: bool = True,
                         check_roles: bool = True,
                         check_duplicates: bool = True,
                         check_silence: bool = True,
                         check_channels: bool = True) -> ValidationResult:
        result = ValidationResult()
        
        audio_files = db_manager.get_audio_files_by_project(project_id)
        
        if not audio_files:
            return result
        
        db_manager.clear_issues_for_project(project_id)
        
        for audio_file in audio_files:
            if not os.path.exists(audio_file.file_path):
                result.add_issue(
                    audio_file.id,
                    IssueType.FILE_NOT_FOUND.value,
                    f"文件不存在: {audio_file.file_path}",
                    IssueSeverity.ERROR.value
                )
        
        if check_sample_rate:
            self._check_sample_rate(audio_files, result)
        
        if check_channels:
            self._check_channels(audio_files, result)
        
        if check_roles:
            self._check_roles(audio_files, result)
        
        if check_duplicates:
            self._check_duplicate_names(audio_files, result)
        
        if check_silence and PYDUB_AVAILABLE:
            self._check_long_silence(audio_files, result)
        
        for issue in result.issues:
            db_manager.create_validation_issue(
                audio_file_id=issue["audio_file_id"],
                issue_type=issue["issue_type"],
                description=issue["description"],
                severity=issue["severity"]
            )
        
        return result
    
    def _check_sample_rate(self, audio_files: List[AudioFile], result: ValidationResult):
        sample_rates = []
        for af in audio_files:
            if af.sample_rate:
                sample_rates.append(af.sample_rate)
                result.sample_rate_stats[af.sample_rate] += 1
        
        if len(sample_rates) <= 1:
            return
        
        unique_rates = set(sample_rates)
        if len(unique_rates) <= 1:
            return
        
        default_rate = self._settings.default_sample_rate
        most_common_rate = max(result.sample_rate_stats.keys(), 
                               key=lambda k: result.sample_rate_stats[k])
        
        for af in audio_files:
            if af.sample_rate and af.sample_rate != most_common_rate:
                result.add_issue(
                    af.id,
                    IssueType.SAMPLE_RATE_MISMATCH.value,
                    f"采样率不一致: {af.sample_rate} Hz (多数为 {most_common_rate} Hz)",
                    IssueSeverity.WARNING.value
                )
    
    def _check_channels(self, audio_files: List[AudioFile], result: ValidationResult):
        channels_list = []
        channel_stats = defaultdict(int)
        
        for af in audio_files:
            if af.channels:
                channels_list.append(af.channels)
                channel_stats[af.channels] += 1
        
        if len(channels_list) <= 1:
            return
        
        unique_channels = set(channels_list)
        if len(unique_channels) <= 1:
            return
        
        default_channels = self._settings.default_channels
        most_common_channels = max(channel_stats.keys(), 
                                   key=lambda k: channel_stats[k])
        
        for af in audio_files:
            if af.channels and af.channels != most_common_channels:
                channel_type = "单声道" if af.channels == 1 else "立体声" if af.channels == 2 else f"{af.channels}声道"
                expected_type = "单声道" if most_common_channels == 1 else "立体声" if most_common_channels == 2 else f"{most_common_channels}声道"
                result.add_issue(
                    af.id,
                    IssueType.CHANNELS_MISMATCH.value,
                    f"声道数不一致: {channel_type} (多数为 {expected_type})",
                    IssueSeverity.WARNING.value
                )
    
    def _check_roles(self, audio_files: List[AudioFile], result: ValidationResult):
        roles = set()
        files_without_role = []
        
        for af in audio_files:
            if af.role:
                roles.add(af.role)
                result.role_stats[af.role] += 1
            else:
                files_without_role.append(af)
        
        for af in files_without_role:
            result.add_issue(
                af.id,
                IssueType.UNKNOWN_ROLE.value,
                "未指定角色，请手动设置",
                IssueSeverity.INFO.value
            )
        
        expected_roles = ["主持人", "嘉宾"]
        missing_roles = []
        
        for expected in expected_roles:
            if expected not in roles:
                missing_roles.append(expected)
        
        if missing_roles:
            for af in audio_files:
                if not af.role or af.role not in expected_roles:
                    result.add_issue(
                        af.id,
                        IssueType.MISSING_ROLE_TRACK.value,
                        f"可能缺少角色轨: {', '.join(missing_roles)}",
                        IssueSeverity.WARNING.value
                    )
                    break
    
    def _check_duplicate_names(self, audio_files: List[AudioFile], result: ValidationResult):
        name_to_files = defaultdict(list)
        
        for af in audio_files:
            name_to_files[af.file_name].append(af)
        
        for file_name, files in name_to_files.items():
            if len(files) > 1:
                hashes = set()
                for f in files:
                    if f.hash_value:
                        hashes.add(f.hash_value)
                
                if len(hashes) > 1:
                    for f in files:
                        result.add_issue(
                            f.id,
                            IssueType.DUPLICATE_NAME_DIFFERENT_CONTENT.value,
                            f"同名但内容不同: {file_name}",
                            IssueSeverity.ERROR.value
                        )
    
    def _check_long_silence(self, audio_files: List[AudioFile], result: ValidationResult):
        max_silence = self._settings.max_silence_seconds
        silence_threshold = self._settings.silence_threshold_db
        
        for af in audio_files:
            if not os.path.exists(af.file_path):
                continue
            
            try:
                ext = Path(af.file_path).suffix.lower().lstrip(".")
                if ext == "m4a":
                    ext = "mp4"
                
                audio = AudioSegment.from_file(af.file_path, format=ext)
                
                silence_ranges = detect_silence(
                    audio,
                    min_silence_len=int(max_silence * 1000),
                    silence_thresh=silence_threshold
                )
                
                if silence_ranges:
                    total_silence = sum((end - start) for start, end in silence_ranges) / 1000.0
                    longest_silence = max((end - start) for start, end in silence_ranges) / 1000.0
                    
                    result.add_issue(
                        af.id,
                        IssueType.LONG_SILENCE.value,
                        f"检测到静音: 最长 {longest_silence:.1f} 秒，总计 {total_silence:.1f} 秒",
                        IssueSeverity.WARNING.value
                    )
            
            except Exception as e:
                print(f"静音检测失败 {af.file_name}: {e}")
                continue
    
    def get_issue_types(self) -> Dict[str, str]:
        return {
            IssueType.SAMPLE_RATE_MISMATCH.value: "采样率不一致",
            IssueType.MISSING_ROLE_TRACK.value: "缺少角色轨",
            IssueType.DUPLICATE_NAME_DIFFERENT_CONTENT.value: "同名不同内容",
            IssueType.LONG_SILENCE.value: "静音过长",
            IssueType.CHANNELS_MISMATCH.value: "声道数不一致",
            IssueType.UNKNOWN_ROLE.value: "未知角色",
            IssueType.FILE_NOT_FOUND.value: "文件不存在",
        }
    
    def is_pydub_available(self) -> bool:
        return PYDUB_AVAILABLE


validation_engine = ValidationEngine()
