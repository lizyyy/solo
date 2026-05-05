"""
规则检查器模块
负责检查命名规则、音频时长、字幕时间轴等问题
"""

import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

from mutagen.mp3 import MP3
from mutagen import MutagenError

from .models import (
    Issue, IssueSeverity, IssueType, EpisodeFiles, CheckResult
)
from .config import Config


class RuleChecker:
    """规则检查器"""
    
    def __init__(self, config: Config):
        self.config = config
        self.audio_config = config.audio_config
        self.subtitles_config = config.subtitles_config
        self.required_files = config.required_files
    
    def check(self, episode_files: EpisodeFiles) -> CheckResult:
        """
        检查单期节目文件
        
        Args:
            episode_files: 节目文件集合
            
        Returns:
            检查结果
        """
        check_time = datetime.now()
        issues: List[Issue] = []
        
        self._check_missing_files(episode_files, issues)
        self._check_filenames(episode_files, issues)
        self._check_audio_duration(episode_files, issues)
        self._check_subtitles_timing(episode_files, issues)
        self._check_audio_quality(episode_files, issues)
        
        error_count = sum(1 for i in issues if i.severity == IssueSeverity.ERROR)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        total_files = self._count_checked_files(episode_files)
        
        result = CheckResult(
            episode_number=episode_files.episode_number,
            check_time=check_time,
            folder_path=episode_files.folder_path,
            files=episode_files,
            issues=issues,
            total_files_checked=total_files,
            error_count=error_count,
            warning_count=warning_count,
            passed=error_count == 0
        )
        
        return result
    
    def _count_checked_files(self, episode_files: EpisodeFiles) -> int:
        """统计已检查的文件数量"""
        count = 0
        if episode_files.audio_path:
            count += 1
        if episode_files.cover_path:
            count += 1
        if episode_files.shownotes_path:
            count += 1
        if episode_files.subtitles_path:
            count += 1
        if episode_files.assets_folder:
            count += 1
        return count
    
    def _check_missing_files(self, episode_files: EpisodeFiles, issues: List[Issue]) -> None:
        """检查是否有缺失的必需文件"""
        if not episode_files.audio_path:
            issues.append(Issue(
                issue_type=IssueType.MISSING_FILE,
                severity=IssueSeverity.ERROR,
                message="缺少音频文件",
                file_path=episode_files.folder_path,
                suggestion="请添加符合命名规则的MP3音频文件"
            ))
        
        if not episode_files.cover_path:
            issues.append(Issue(
                issue_type=IssueType.MISSING_FILE,
                severity=IssueSeverity.ERROR,
                message="缺少封面图片",
                file_path=episode_files.folder_path,
                suggestion="请添加符合命名规则的封面图片（jpg/jpeg/png）"
            ))
        
        if not episode_files.shownotes_path:
            issues.append(Issue(
                issue_type=IssueType.MISSING_FILE,
                severity=IssueSeverity.ERROR,
                message="缺少shownotes文件",
                file_path=episode_files.folder_path,
                suggestion="请添加符合命名规则的shownotes文件（md/txt）"
            ))
        
        if not episode_files.subtitles_path:
            issues.append(Issue(
                issue_type=IssueType.MISSING_FILE,
                severity=IssueSeverity.WARNING,
                message="缺少字幕文件",
                file_path=episode_files.folder_path,
                suggestion="如果需要字幕，请添加符合命名规则的SRT字幕文件"
            ))
        
        if not episode_files.assets_folder:
            issues.append(Issue(
                issue_type=IssueType.MISSING_FILE,
                severity=IssueSeverity.INFO,
                message="缺少授权素材文件夹",
                file_path=episode_files.folder_path,
                suggestion="如果使用了授权素材，请创建授权素材文件夹"
            ))
    
    def _check_filenames(self, episode_files: EpisodeFiles, issues: List[Issue]) -> None:
        """检查文件名是否符合规则"""
        checks = [
            ('audio', episode_files.audio_path, "音频文件"),
            ('cover', episode_files.cover_path, "封面图片"),
            ('shownotes', episode_files.shownotes_path, "shownotes文件"),
            ('subtitles', episode_files.subtitles_path, "字幕文件"),
        ]
        
        for file_type, file_path, description in checks:
            if file_path:
                filename = Path(file_path).name
                pattern = self.config.get_file_pattern(file_type)
                if pattern and not re.match(pattern, filename):
                    examples = self.required_files.get(file_type, {}).get('examples', [])
                    example_str = "、".join(examples[:2]) if examples else "无"
                    
                    issues.append(Issue(
                        issue_type=IssueType.INVALID_FILENAME,
                        severity=IssueSeverity.ERROR,
                        message=f"{description}文件名不合规: {filename}",
                        file_path=file_path,
                        details={
                            "expected_pattern": pattern,
                            "actual_filename": filename
                        },
                        suggestion=f"请参考命名规则修改文件名，例如: {example_str}"
                    ))
    
    def _check_audio_duration(self, episode_files: EpisodeFiles, issues: List[Issue]) -> None:
        """检查音频时长是否在合理范围内"""
        if not episode_files.audio_path:
            return
        
        try:
            audio = MP3(episode_files.audio_path)
            duration = audio.info.length
            episode_files.audio_duration = duration
            episode_files.audio_bitrate = int(audio.info.bitrate / 1000)
            episode_files.audio_sample_rate = audio.info.sample_rate
            
            min_duration = self.audio_config.get('min_duration', 300)
            max_duration = self.audio_config.get('max_duration', 7200)
            
            if duration < min_duration:
                issues.append(Issue(
                    issue_type=IssueType.DURATION_TOO_SHORT,
                    severity=IssueSeverity.WARNING,
                    message=f"音频时长过短: {self._format_duration(duration)}",
                    file_path=episode_files.audio_path,
                    details={
                        "actual_duration": duration,
                        "min_duration": min_duration
                    },
                    suggestion=f"音频最小时长应为 {self._format_duration(min_duration)}，请确认是否完整"
                ))
            
            if duration > max_duration:
                issues.append(Issue(
                    issue_type=IssueType.DURATION_TOO_LONG,
                    severity=IssueSeverity.WARNING,
                    message=f"音频时长过长: {self._format_duration(duration)}",
                    file_path=episode_files.audio_path,
                    details={
                        "actual_duration": duration,
                        "max_duration": max_duration
                    },
                    suggestion=f"音频最大时长应为 {self._format_duration(max_duration)}，请确认是否需要分割"
                ))
        
        except MutagenError as e:
            issues.append(Issue(
                issue_type=IssueType.AUDIO_QUALITY_ISSUE,
                severity=IssueSeverity.ERROR,
                message=f"无法读取音频文件: {str(e)}",
                file_path=episode_files.audio_path,
                suggestion="请检查音频文件是否损坏或格式是否正确"
            ))
    
    def _check_subtitles_timing(self, episode_files: EpisodeFiles, issues: List[Issue]) -> None:
        """检查字幕时间轴是否越界"""
        if not episode_files.subtitles_path:
            return
        
        subtitles = self._parse_srt(episode_files.subtitles_path)
        if not subtitles:
            return
        
        audio_duration = episode_files.audio_duration
        max_deviation = self.subtitles_config.get('max_timing_deviation', 5)
        min_sub_duration = self.subtitles_config.get('min_subtitle_duration', 1)
        max_sub_duration = self.subtitles_config.get('max_subtitle_duration', 10)
        
        if audio_duration:
            for idx, (start, end, text) in enumerate(subtitles, 1):
                if end > audio_duration + max_deviation:
                    issues.append(Issue(
                        issue_type=IssueType.SUBTITLE_TIMING_ERROR,
                        severity=IssueSeverity.ERROR,
                        message=f"字幕第 {idx} 条时间轴越界，结束时间超出音频时长",
                        file_path=episode_files.subtitles_path,
                        details={
                            "subtitle_index": idx,
                            "subtitle_start": start,
                            "subtitle_end": end,
                            "audio_duration": audio_duration
                        },
                        suggestion=f"请调整该条字幕的时间轴，音频时长为 {self._format_duration(audio_duration)}"
                    ))
                
                sub_duration = end - start
                if sub_duration < min_sub_duration:
                    issues.append(Issue(
                        issue_type=IssueType.SUBTITLE_DURATION_INVALID,
                        severity=IssueSeverity.WARNING,
                        message=f"字幕第 {idx} 条时长过短: {sub_duration:.2f}秒",
                        file_path=episode_files.subtitles_path,
                        details={
                            "subtitle_index": idx,
                            "actual_duration": sub_duration,
                            "min_duration": min_sub_duration
                        },
                        suggestion=f"单条字幕最小时长应为 {min_sub_duration} 秒"
                    ))
                
                if sub_duration > max_sub_duration:
                    issues.append(Issue(
                        issue_type=IssueType.SUBTITLE_DURATION_INVALID,
                        severity=IssueSeverity.WARNING,
                        message=f"字幕第 {idx} 条时长过长: {sub_duration:.2f}秒",
                        file_path=episode_files.subtitles_path,
                        details={
                            "subtitle_index": idx,
                            "actual_duration": sub_duration,
                            "max_duration": max_sub_duration
                        },
                        suggestion=f"单条字幕最大时长应为 {max_sub_duration} 秒，建议分割"
                    ))
    
    def _check_audio_quality(self, episode_files: EpisodeFiles, issues: List[Issue]) -> None:
        """检查音频质量参数"""
        if not episode_files.audio_path or episode_files.audio_bitrate is None:
            return
        
        target_bitrate = self.audio_config.get('target_bitrate', 128)
        target_sample_rate = self.audio_config.get('target_sample_rate', 44100)
        
        if episode_files.audio_bitrate < target_bitrate:
            issues.append(Issue(
                issue_type=IssueType.AUDIO_QUALITY_ISSUE,
                severity=IssueSeverity.WARNING,
                message=f"音频比特率较低: {episode_files.audio_bitrate} kbps",
                file_path=episode_files.audio_path,
                details={
                    "actual_bitrate": episode_files.audio_bitrate,
                    "target_bitrate": target_bitrate
                },
                suggestion=f"建议使用 {target_bitrate} kbps 或更高的比特率"
            ))
        
        if episode_files.audio_sample_rate != target_sample_rate:
            issues.append(Issue(
                issue_type=IssueType.AUDIO_QUALITY_ISSUE,
                severity=IssueSeverity.INFO,
                message=f"音频采样率与目标值不同: {episode_files.audio_sample_rate} Hz",
                file_path=episode_files.audio_path,
                details={
                    "actual_sample_rate": episode_files.audio_sample_rate,
                    "target_sample_rate": target_sample_rate
                },
                suggestion=f"建议使用 {target_sample_rate} Hz 采样率"
            ))
    
    def _parse_srt(self, filepath: str) -> List[tuple]:
        """解析SRT字幕文件
        
        Returns:
            列表，每个元素为 (开始时间(秒), 结束时间(秒), 字幕文本)
        """
        subtitles = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            blocks = re.split(r'\n\n+', content.strip())
            for block in blocks:
                lines = block.split('\n')
                if len(lines) >= 3:
                    time_line = lines[1]
                    text = ' '.join(lines[2:])
                    
                    match = re.match(
                        r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})',
                        time_line
                    )
                    if match:
                        start = int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3)) + int(match.group(4)) / 1000
                        end = int(match.group(5)) * 3600 + int(match.group(6)) * 60 + int(match.group(7)) + int(match.group(8)) / 1000
                        subtitles.append((start, end, text))
        
        except Exception as e:
            pass
        
        return subtitles
    
    def _format_duration(self, seconds: float) -> str:
        """格式化时长显示"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours}时{minutes}分{secs}秒"
        else:
            return f"{minutes}分{secs}秒"
