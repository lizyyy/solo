"""
规则引擎模块
实现各种质检规则：缺素材、重复素材、时长/格式/采样率检查、静音段和峰值异常
"""

import os
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from audio_metadata import (
    AudioMetadata,
    AudioAnalyzer,
    ProgramScheduleItem,
    AudioFormat
)


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"    # 严重错误，必须修复
    WARNING = "warning"       # 警告，建议检查
    INFO = "info"             # 信息，仅供参考


class IssueType(Enum):
    """问题类型枚举"""
    # 素材相关
    MISSING_AUDIO = "missing_audio"              # 缺少音频文件
    DUPLICATE_AUDIO = "duplicate_audio"          # 音频文件重复（同一文件多次使用）
    UNUSED_AUDIO = "unused_audio"                # 有音频文件未被节目单引用
    
    # 时长相关
    DURATION_TOO_LONG = "duration_too_long"      # 时长超出窗口
    DURATION_TOO_SHORT = "duration_too_short"    # 时长太短
    DURATION_MISMATCH = "duration_mismatch"      # 实际时长与节目单预计时长不符
    
    # 格式/技术参数
    FORMAT_NOT_SUPPORTED = "format_not_supported"    # 不支持的格式
    SAMPLE_RATE_MISMATCH = "sample_rate_mismatch"    # 采样率不符合要求
    CHANNELS_MISMATCH = "channels_mismatch"          # 声道数不符合要求
    BIT_DEPTH_LOW = "bit_depth_low"                   # 位深度太低
    
    # 音频质量
    PEAK_TOO_HIGH = "peak_too_high"              # 音量峰值爆掉
    PEAK_TOO_LOW = "peak_too_low"                # 音量太低
    LEADING_SILENCE_TOO_LONG = "leading_silence_too_long"    # 片头静音太长
    TRAILING_SILENCE_TOO_LONG = "trailing_silence_too_long"  # 片尾静音太长
    
    # 广告/排播相关
    AD_DUPLICATE_IN_TIMELINE = "ad_duplicate_in_timeline"    # 同一广告在时间线上重复
    TIMELINE_OVERLAP = "timeline_overlap"                     # 时间线冲突/重叠


@dataclass
class QualityIssue:
    """质检问题"""
    issue_type: IssueType
    severity: IssueSeverity
    item_id: str = ""           # 关联的节目单条目编号
    audio_file: str = ""        # 关联的音频文件名
    title: str = ""             # 标题/名称
    message: str = ""           # 问题描述
    expected_value: Any = None  # 期望值
    actual_value: Any = None    # 实际值
    
    # 人工处理相关
    resolved: bool = False
    resolution_note: str = ""
    resolution_action: str = ""  # "accept", "reject", "needs_fix", "deferred"
    
    @property
    def issue_type_display(self) -> str:
        """问题类型显示名称"""
        display_map = {
            IssueType.MISSING_AUDIO: "缺少音频",
            IssueType.DUPLICATE_AUDIO: "重复音频",
            IssueType.UNUSED_AUDIO: "未使用音频",
            IssueType.DURATION_TOO_LONG: "时长过长",
            IssueType.DURATION_TOO_SHORT: "时长过短",
            IssueType.DURATION_MISMATCH: "时长不符",
            IssueType.FORMAT_NOT_SUPPORTED: "格式不支持",
            IssueType.SAMPLE_RATE_MISMATCH: "采样率不符",
            IssueType.CHANNELS_MISMATCH: "声道数不符",
            IssueType.BIT_DEPTH_LOW: "位深度过低",
            IssueType.PEAK_TOO_HIGH: "峰值过高",
            IssueType.PEAK_TOO_LOW: "音量过低",
            IssueType.LEADING_SILENCE_TOO_LONG: "片头静音过长",
            IssueType.TRAILING_SILENCE_TOO_LONG: "片尾静音过长",
            IssueType.AD_DUPLICATE_IN_TIMELINE: "广告重复播出",
            IssueType.TIMELINE_OVERLAP: "时间线冲突"
        }
        return display_map.get(self.issue_type, self.issue_type.value)
    
    @property
    def severity_display(self) -> str:
        """严重程度显示"""
        display_map = {
            IssueSeverity.CRITICAL: "严重",
            IssueSeverity.WARNING: "警告",
            IssueSeverity.INFO: "信息"
        }
        return display_map.get(self.severity, self.severity.value)
    
    @property
    def resolution_display(self) -> str:
        """处理状态显示"""
        if self.resolution_action == "accept":
            return "已接受"
        elif self.resolution_action == "reject":
            return "已驳回"
        elif self.resolution_action == "needs_fix":
            return "需修复"
        elif self.resolution_action == "deferred":
            return "延后处理"
        elif self.resolved:
            return "已解决"
        else:
            return "待处理"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "issue_type": self.issue_type.value,
            "issue_type_display": self.issue_type_display,
            "severity": self.severity.value,
            "severity_display": self.severity_display,
            "item_id": self.item_id,
            "audio_file": self.audio_file,
            "title": self.title,
            "message": self.message,
            "expected_value": str(self.expected_value) if self.expected_value is not None else "",
            "actual_value": str(self.actual_value) if self.actual_value is not None else "",
            "resolved": self.resolved,
            "resolution_note": self.resolution_note,
            "resolution_action": self.resolution_action,
            "resolution_display": self.resolution_display
        }


@dataclass
class QualityCheckConfig:
    """质检规则配置"""
    # 格式要求
    allowed_formats: Set[AudioFormat] = field(default_factory=lambda: {
        AudioFormat.MP3, AudioFormat.WAV, AudioFormat.FLAC
    })
    required_sample_rate: int = 44100
    required_channels: int = 2
    min_bit_depth: int = 16
    
    # 时长容差
    max_duration_over_seconds: float = 2.0  # 最多允许超出2秒
    max_duration_under_seconds: float = 1.0  # 最多允许短1秒
    duration_tolerance_percent: float = 5.0   # 时长容差百分比
    
    # 音频质量
    max_peak_dbfs: float = -1.0      # 峰值警告阈值
    critical_peak_dbfs: float = 0.0   # 峰值危险阈值（削波）
    min_rms_dbfs: float = -24.0       # 最低平均音量
    max_leading_silence_seconds: float = 1.0   # 最大片头静音
    max_trailing_silence_seconds: float = 1.0   # 最大片尾静音
    
    # 静音检测参数（与 AudioAnalyzer 保持一致）
    silence_threshold_db: float = -50.0
    silence_min_duration_ms: int = 500
    
    # 广告重复检测
    check_ad_duplicates: bool = True
    min_ad_interval_minutes: float = 30.0  # 同一广告最小间隔（分钟）
    
    # 排播检查
    check_timeline_overlap: bool = True
    allow_gap_between_items: bool = True  # 允许条目之间有空隙
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "allowed_formats": [f.value for f in self.allowed_formats],
            "required_sample_rate": self.required_sample_rate,
            "required_channels": self.required_channels,
            "min_bit_depth": self.min_bit_depth,
            "max_duration_over_seconds": self.max_duration_over_seconds,
            "max_duration_under_seconds": self.max_duration_under_seconds,
            "duration_tolerance_percent": self.duration_tolerance_percent,
            "max_peak_dbfs": self.max_peak_dbfs,
            "critical_peak_dbfs": self.critical_peak_dbfs,
            "min_rms_dbfs": self.min_rms_dbfs,
            "max_leading_silence_seconds": self.max_leading_silence_seconds,
            "max_trailing_silence_seconds": self.max_trailing_silence_seconds,
            "silence_threshold_db": self.silence_threshold_db,
            "silence_min_duration_ms": self.silence_min_duration_ms,
            "check_ad_duplicates": self.check_ad_duplicates,
            "min_ad_interval_minutes": self.min_ad_interval_minutes,
            "check_timeline_overlap": self.check_timeline_overlap,
            "allow_gap_between_items": self.allow_gap_between_items
        }


@dataclass
class QualityCheckResult:
    """质检结果"""
    issues: List[QualityIssue] = field(default_factory=list)
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    warning_count: int = 0
    critical_count: int = 0
    
    # 统计信息
    stats: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def has_critical_issues(self) -> bool:
        """是否有严重问题"""
        return any(i.severity == IssueSeverity.CRITICAL and not i.resolved for i in self.issues)
    
    @property
    def has_warnings(self) -> bool:
        """是否有警告"""
        return any(i.severity == IssueSeverity.WARNING and not i.resolved for i in self.issues)
    
    @property
    def unresolved_issues(self) -> List[QualityIssue]:
        """未解决的问题"""
        return [i for i in self.issues if not i.resolved]
    
    @property
    def resolved_issues(self) -> List[QualityIssue]:
        """已解决的问题"""
        return [i for i in self.issues if i.resolved]
    
    def get_issues_by_type(self, issue_type: IssueType) -> List[QualityIssue]:
        """按类型获取问题"""
        return [i for i in self.issues if i.issue_type == issue_type]
    
    def get_issues_by_severity(self, severity: IssueSeverity) -> List[QualityIssue]:
        """按严重程度获取问题"""
        return [i for i in self.issues if i.severity == severity]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "issues": [i.to_dict() for i in self.issues],
            "total_checks": self.total_checks,
            "passed_checks": self.passed_checks,
            "failed_checks": self.failed_checks,
            "warning_count": self.warning_count,
            "critical_count": self.critical_count,
            "has_critical_issues": self.has_critical_issues,
            "has_warnings": self.has_warnings,
            "unresolved_count": len(self.unresolved_issues),
            "resolved_count": len(self.resolved_issues),
            "stats": self.stats
        }


class RulesEngine:
    """规则引擎 - 执行所有质检规则"""
    
    def __init__(self, config: QualityCheckConfig = None):
        """
        初始化规则引擎
        
        Args:
            config: 质检配置，如果为 None 则使用默认配置
        """
        self.config = config or QualityCheckConfig()
    
    def run_all_checks(self,
                       schedule_items: List[ProgramScheduleItem],
                       audio_metadata: Dict[str, AudioMetadata],
                       audio_directory: str = "") -> QualityCheckResult:
        """
        执行所有质检检查
        
        Args:
            schedule_items: 节目单条目列表
            audio_metadata: 音频元数据字典（文件名 -> AudioMetadata）
            audio_directory: 音频文件目录
            
        Returns:
            质检结果
        """
        result = QualityCheckResult()
        issues: List[QualityIssue] = []
        
        # 1. 检查缺少的音频文件
        issues.extend(self._check_missing_audio(schedule_items, audio_metadata))
        
        # 2. 检查未使用的音频文件
        issues.extend(self._check_unused_audio(schedule_items, audio_metadata))
        
        # 3. 检查重复的音频引用
        issues.extend(self._check_duplicate_audio_refs(schedule_items))
        
        # 4. 检查每个条目的技术参数
        for item in schedule_items:
            if item.audio_file and item.audio_file in audio_metadata:
                metadata = audio_metadata[item.audio_file]
                issues.extend(self._check_technical_parameters(item, metadata))
                issues.extend(self._check_duration(item, metadata))
                issues.extend(self._check_audio_quality(item, metadata))
        
        # 5. 检查广告重复播出
        if self.config.check_ad_duplicates:
            issues.extend(self._check_ad_duplicates(schedule_items))
        
        # 6. 检查时间线重叠
        if self.config.check_timeline_overlap:
            issues.extend(self._check_timeline_overlap(schedule_items))
        
        # 统计
        result.issues = issues
        result.total_checks = len(issues)
        result.passed_checks = sum(1 for i in issues if i.resolved)
        result.failed_checks = sum(1 for i in issues if not i.resolved)
        result.warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        result.critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        
        # 额外的统计信息
        result.stats = self._calculate_stats(schedule_items, audio_metadata, issues)
        
        return result
    
    def _check_missing_audio(self,
                            schedule_items: List[ProgramScheduleItem],
                            audio_metadata: Dict[str, AudioMetadata]) -> List[QualityIssue]:
        """检查缺少的音频文件"""
        issues = []
        
        for item in schedule_items:
            audio_file = item.audio_file.strip()
            if audio_file and audio_file not in audio_metadata:
                issue = QualityIssue(
                    issue_type=IssueType.MISSING_AUDIO,
                    severity=IssueSeverity.CRITICAL,
                    item_id=item.item_id,
                    audio_file=audio_file,
                    title=item.title,
                    message=f"节目单中引用的音频文件 '{audio_file}' 不存在于素材目录中",
                    expected_value="文件存在",
                    actual_value="文件缺失"
                )
                issues.append(issue)
        
        return issues
    
    def _check_unused_audio(self,
                           schedule_items: List[ProgramScheduleItem],
                           audio_metadata: Dict[str, AudioMetadata]) -> List[QualityIssue]:
        """检查未使用的音频文件"""
        issues = []
        
        referenced_files = {item.audio_file.strip() for item in schedule_items if item.audio_file.strip()}
        
        for filename, metadata in audio_metadata.items():
            if filename not in referenced_files:
                issue = QualityIssue(
                    issue_type=IssueType.UNUSED_AUDIO,
                    severity=IssueSeverity.INFO,
                    audio_file=filename,
                    title="未使用的素材",
                    message=f"音频文件 '{filename}' 存在但未被节目单引用",
                    expected_value="被节目单引用",
                    actual_value="未引用"
                )
                issues.append(issue)
        
        return issues
    
    def _check_duplicate_audio_refs(self,
                                    schedule_items: List[ProgramScheduleItem]) -> List[QualityIssue]:
        """检查重复的音频引用（同一文件被多个条目使用）"""
        issues = []
        
        audio_to_items: Dict[str, List[ProgramScheduleItem]] = defaultdict(list)
        
        for item in schedule_items:
            if item.audio_file.strip():
                audio_to_items[item.audio_file.strip()].append(item)
        
        for audio_file, items in audio_to_items.items():
            if len(items) > 1:
                item_ids = ", ".join([i.item_id for i in items])
                issue = QualityIssue(
                    issue_type=IssueType.DUPLICATE_AUDIO,
                    severity=IssueSeverity.WARNING,
                    audio_file=audio_file,
                    title=items[0].title,
                    message=f"音频文件 '{audio_file}' 被多个节目条目引用: {item_ids}",
                    expected_value="仅被一个条目引用",
                    actual_value=f"被 {len(items)} 个条目引用"
                )
                issues.append(issue)
        
        return issues
    
    def _check_technical_parameters(self,
                                    item: ProgramScheduleItem,
                                    metadata: AudioMetadata) -> List[QualityIssue]:
        """检查技术参数（格式、采样率、声道数、位深度）"""
        issues = []
        
        # 检查格式
        if metadata.format not in self.config.allowed_formats:
            allowed = ", ".join([f.value.upper() for f in self.config.allowed_formats])
            issue = QualityIssue(
                issue_type=IssueType.FORMAT_NOT_SUPPORTED,
                severity=IssueSeverity.WARNING,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"音频格式 {metadata.format_str} 不在支持列表中。支持格式: {allowed}",
                expected_value=allowed,
                actual_value=metadata.format_str
            )
            issues.append(issue)
        
        # 检查采样率
        if metadata.sample_rate > 0 and metadata.sample_rate != self.config.required_sample_rate:
            issue = QualityIssue(
                issue_type=IssueType.SAMPLE_RATE_MISMATCH,
                severity=IssueSeverity.WARNING,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"采样率 {metadata.sample_rate} Hz 与要求的 {self.config.required_sample_rate} Hz 不符",
                expected_value=f"{self.config.required_sample_rate} Hz",
                actual_value=f"{metadata.sample_rate} Hz"
            )
            issues.append(issue)
        
        # 检查声道数
        if metadata.channels > 0 and metadata.channels != self.config.required_channels:
            channel_type = "单声道" if metadata.channels == 1 else f"{metadata.channels}声道"
            expected_type = "立体声" if self.config.required_channels == 2 else f"{self.config.required_channels}声道"
            issue = QualityIssue(
                issue_type=IssueType.CHANNELS_MISMATCH,
                severity=IssueSeverity.WARNING,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"声道数为 {channel_type}，要求为 {expected_type}",
                expected_value=expected_type,
                actual_value=channel_type
            )
            issues.append(issue)
        
        # 检查位深度
        if metadata.bit_depth > 0 and metadata.bit_depth < self.config.min_bit_depth:
            issue = QualityIssue(
                issue_type=IssueType.BIT_DEPTH_LOW,
                severity=IssueSeverity.INFO,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"位深度 {metadata.bit_depth}bit 低于建议的 {self.config.min_bit_depth}bit",
                expected_value=f">= {self.config.min_bit_depth}bit",
                actual_value=f"{metadata.bit_depth}bit"
            )
            issues.append(issue)
        
        return issues
    
    def _check_duration(self,
                       item: ProgramScheduleItem,
                       metadata: AudioMetadata) -> List[QualityIssue]:
        """检查时长"""
        issues = []
        
        actual_duration = metadata.duration_seconds
        expected_duration = item.duration_seconds
        
        if expected_duration <= 0:
            return issues
        
        # 计算差异
        diff_seconds = actual_duration - expected_duration
        diff_percent = (abs(diff_seconds) / expected_duration) * 100 if expected_duration > 0 else 0
        
        # 检查时长不符（容差范围内不报错）
        if (abs(diff_seconds) > self.config.max_duration_over_seconds and 
            diff_percent > self.config.duration_tolerance_percent):
            
            if diff_seconds > 0:
                # 实际时长比预计长
                issue = QualityIssue(
                    issue_type=IssueType.DURATION_TOO_LONG,
                    severity=IssueSeverity.WARNING,
                    item_id=item.item_id,
                    audio_file=item.audio_file,
                    title=item.title,
                    message=f"实际时长 {metadata.duration_formatted} 比节目单预计的 {item.duration_formatted} 长 {diff_seconds:.2f} 秒",
                    expected_value=item.duration_formatted,
                    actual_value=metadata.duration_formatted
                )
                issues.append(issue)
            else:
                # 实际时长比预计短
                issue = QualityIssue(
                    issue_type=IssueType.DURATION_TOO_SHORT,
                    severity=IssueSeverity.WARNING,
                    item_id=item.item_id,
                    audio_file=item.audio_file,
                    title=item.title,
                    message=f"实际时长 {metadata.duration_formatted} 比节目单预计的 {item.duration_formatted} 短 {abs(diff_seconds):.2f} 秒",
                    expected_value=item.duration_formatted,
                    actual_value=metadata.duration_formatted
                )
                issues.append(issue)
        
        return issues
    
    def _check_audio_quality(self,
                            item: ProgramScheduleItem,
                            metadata: AudioMetadata) -> List[QualityIssue]:
        """检查音频质量（峰值、静音段）"""
        issues = []
        
        # 检查峰值
        if metadata.peak_dbfs > -float('inf'):
            # 危险阈值（0dBFS，削波）
            if metadata.peak_dbfs >= self.config.critical_peak_dbfs:
                issue = QualityIssue(
                    issue_type=IssueType.PEAK_TOO_HIGH,
                    severity=IssueSeverity.CRITICAL,
                    item_id=item.item_id,
                    audio_file=item.audio_file,
                    title=item.title,
                    message=f"音量峰值达到 {metadata.peak_dbfs:.2f} dBFS，可能存在削波失真！",
                    expected_value=f"< {self.config.critical_peak_dbfs} dBFS",
                    actual_value=f"{metadata.peak_dbfs:.2f} dBFS"
                )
                issues.append(issue)
            # 警告阈值
            elif metadata.peak_dbfs >= self.config.max_peak_dbfs:
                issue = QualityIssue(
                    issue_type=IssueType.PEAK_TOO_HIGH,
                    severity=IssueSeverity.WARNING,
                    item_id=item.item_id,
                    audio_file=item.audio_file,
                    title=item.title,
                    message=f"音量峰值 {metadata.peak_dbfs:.2f} dBFS 偏高，建议控制在 {self.config.max_peak_dbfs} dBFS 以下",
                    expected_value=f"< {self.config.max_peak_dbfs} dBFS",
                    actual_value=f"{metadata.peak_dbfs:.2f} dBFS"
                )
                issues.append(issue)
        
        # 检查平均音量是否过低
        if metadata.rms_dbfs > -float('inf') and metadata.rms_dbfs < self.config.min_rms_dbfs:
            issue = QualityIssue(
                issue_type=IssueType.PEAK_TOO_LOW,
                severity=IssueSeverity.INFO,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"平均音量 {metadata.rms_dbfs:.2f} dBFS 偏低，建议提升音量",
                expected_value=f">= {self.config.min_rms_dbfs} dBFS",
                actual_value=f"{metadata.rms_dbfs:.2f} dBFS"
            )
            issues.append(issue)
        
        # 检查片头静音
        if metadata.leading_silence_duration > self.config.max_leading_silence_seconds:
            issue = QualityIssue(
                issue_type=IssueType.LEADING_SILENCE_TOO_LONG,
                severity=IssueSeverity.WARNING,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"片头静音时长 {metadata.leading_silence_duration:.2f} 秒，超过建议的 {self.config.max_leading_silence_seconds} 秒",
                expected_value=f"<= {self.config.max_leading_silence_seconds} 秒",
                actual_value=f"{metadata.leading_silence_duration:.2f} 秒"
            )
            issues.append(issue)
        
        # 检查片尾静音
        if metadata.trailing_silence_duration > self.config.max_trailing_silence_seconds:
            issue = QualityIssue(
                issue_type=IssueType.TRAILING_SILENCE_TOO_LONG,
                severity=IssueSeverity.WARNING,
                item_id=item.item_id,
                audio_file=item.audio_file,
                title=item.title,
                message=f"片尾静音时长 {metadata.trailing_silence_duration:.2f} 秒，超过建议的 {self.config.max_trailing_silence_seconds} 秒",
                expected_value=f"<= {self.config.max_trailing_silence_seconds} 秒",
                actual_value=f"{metadata.trailing_silence_duration:.2f} 秒"
            )
            issues.append(issue)
        
        return issues
    
    def _check_ad_duplicates(self,
                             schedule_items: List[ProgramScheduleItem]) -> List[QualityIssue]:
        """检查广告重复播出"""
        issues = []
        
        # 只检查广告类型的条目
        ad_items = [item for item in schedule_items if item.item_type == 'ad']
        
        # 按音频文件分组
        ad_audio_to_items: Dict[str, List[ProgramScheduleItem]] = defaultdict(list)
        for item in ad_items:
            if item.audio_file.strip():
                ad_audio_to_items[item.audio_file.strip()].append(item)
        
        # 检查每个音频的播出时间间隔
        for audio_file, items in ad_audio_to_items.items():
            if len(items) <= 1:
                continue
            
            # 按开始时间排序
            sorted_items = sorted(items, key=lambda x: x._time_to_seconds(x.start_time))
            
            # 检查相邻广告的间隔
            for i in range(1, len(sorted_items)):
                prev_item = sorted_items[i-1]
                curr_item = sorted_items[i]
                
                prev_end = prev_item.end_time_seconds
                curr_start = curr_item._time_to_seconds(curr_item.start_time)
                
                interval_seconds = curr_start - prev_end
                interval_minutes = interval_seconds / 60
                
                if interval_minutes < self.config.min_ad_interval_minutes:
                    issue = QualityIssue(
                        issue_type=IssueType.AD_DUPLICATE_IN_TIMELINE,
                        severity=IssueSeverity.WARNING,
                        item_id=f"{prev_item.item_id} & {curr_item.item_id}",
                        audio_file=audio_file,
                        title=f"广告重复: {prev_item.title}",
                        message=f"广告 '{audio_file}' 在 {prev_item.start_time} 和 {curr_item.start_time} 重复播出，间隔仅 {interval_minutes:.1f} 分钟（建议间隔 >= {self.config.min_ad_interval_minutes} 分钟）",
                        expected_value=f">= {self.config.min_ad_interval_minutes} 分钟间隔",
                        actual_value=f"{interval_minutes:.1f} 分钟间隔"
                    )
                    issues.append(issue)
        
        return issues
    
    def _check_timeline_overlap(self,
                                schedule_items: List[ProgramScheduleItem]) -> List[QualityIssue]:
        """检查时间线重叠"""
        issues = []
        
        if len(schedule_items) < 2:
            return issues
        
        # 按开始时间排序
        sorted_items = sorted(
            schedule_items,
            key=lambda x: x._time_to_seconds(x.start_time)
        )
        
        for i in range(1, len(sorted_items)):
            prev_item = sorted_items[i-1]
            curr_item = sorted_items[i]
            
            prev_end = prev_item.end_time_seconds
            curr_start = curr_item._time_to_seconds(curr_item.start_time)
            
            if curr_start < prev_end:
                # 有重叠
                overlap_seconds = prev_end - curr_start
                issue = QualityIssue(
                    issue_type=IssueType.TIMELINE_OVERLAP,
                    severity=IssueSeverity.CRITICAL,
                    item_id=f"{prev_item.item_id} & {curr_item.item_id}",
                    title=f"时间重叠: {prev_item.title} / {curr_item.title}",
                    message=f"条目 '{prev_item.item_id}({prev_item.title})' 结束于 {prev_item.end_time_formatted}，与条目 '{curr_item.item_id}({curr_item.title})' 开始于 {curr_item.start_time} 重叠 {overlap_seconds:.1f} 秒",
                    expected_value="无时间重叠",
                    actual_value=f"重叠 {overlap_seconds:.1f} 秒"
                )
                issues.append(issue)
        
        return issues
    
    def _calculate_stats(self,
                        schedule_items: List[ProgramScheduleItem],
                        audio_metadata: Dict[str, AudioMetadata],
                        issues: List[QualityIssue]) -> Dict[str, Any]:
        """计算统计信息"""
        stats = {}
        
        # 节目单统计
        stats["total_items"] = len(schedule_items)
        stats["items_by_type"] = {
            "节目": sum(1 for i in schedule_items if i.item_type == 'program'),
            "广告": sum(1 for i in schedule_items if i.item_type == 'ad'),
            "片花": sum(1 for i in schedule_items if i.item_type == 'jingle'),
        }
        
        # 音频文件统计
        stats["total_audio_files"] = len(audio_metadata)
        if audio_metadata:
            durations = [m.duration_seconds for m in audio_metadata.values()]
            stats["total_audio_duration_seconds"] = sum(durations)
            stats["avg_audio_duration_seconds"] = sum(durations) / len(durations)
        
        # 问题统计
        issue_counts = defaultdict(int)
        for issue in issues:
            issue_counts[issue.issue_type.value] += 1
        stats["issues_by_type"] = dict(issue_counts)
        
        return stats
