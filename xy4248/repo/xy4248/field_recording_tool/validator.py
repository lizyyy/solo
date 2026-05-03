"""
规则校验模块
负责执行各种校验规则，包括命名、时长、采样率、时间码、备注缺失等检查
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class ValidationSeverity(Enum):
    """校验结果严重程度"""
    INFO = "info"        # 信息级别，不影响交付
    WARNING = "warning"  # 警告，建议处理
    ERROR = "error"      # 错误，必须处理


class ValidationCategory(Enum):
    """校验类别"""
    NAMING = "naming"           # 命名问题
    DURATION = "duration"       # 时长问题
    SAMPLE_RATE = "sample_rate" # 采样率问题
    TIMECODE = "timecode"       # 时间码问题
    NOTES = "notes"             # 备注问题
    DUPLICATE = "duplicate"     # 重复文件
    MISSING = "missing"         # 缺失问题
    PRIVACY = "privacy"         # 隐私相关
    TECHNICAL = "technical"     # 技术参数问题


@dataclass
class ValidationIssue:
    """单条校验问题"""
    issue_id: str
    category: ValidationCategory
    severity: ValidationSeverity
    message: str
    file_name: str = ""
    file_path: str = ""
    field_name: str = ""
    expected_value: str = ""
    actual_value: str = ""
    suggestion: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ValidationResult:
    """完整的校验结果"""
    total_files: int = 0
    total_issues: int = 0
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    
    issues_by_category: Dict[ValidationCategory, List[ValidationIssue]] = field(default_factory=dict)
    issues_by_file: Dict[str, List[ValidationIssue]] = field(default_factory=dict)
    all_issues: List[ValidationIssue] = field(default_factory=list)
    
    validation_time: str = field(default_factory=lambda: datetime.now().isoformat())


class Validator:
    """规则校验器"""
    
    # 推荐的文件名正则模式（示例：Scene01_Shot02_Take03_20240115_103000.wav）
    RECOMMENDED_FILENAME_PATTERN = re.compile(
        r'^[A-Za-z0-9_-]+(_[A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$'
    )
    
    # 不推荐的字符（空格、特殊字符等）
    INVALID_FILENAME_CHARS = r'[<>:"/\\|?*\s]'
    
    # 推荐的采样率（专业录音常用）
    RECOMMENDED_SAMPLE_RATES = {44100, 48000, 88200, 96000}
    
    # 推荐的位深
    RECOMMENDED_BIT_DEPTHS = {16, 24, 32}
    
    # 最小/最大合理时长（秒）
    MIN_REASONABLE_DURATION = 1.0  # 至少1秒
    MAX_REASONABLE_DURATION = 3600.0  # 最多1小时
    
    def __init__(self):
        """初始化校验器"""
        self.result = ValidationResult()
        self._issue_counter = 0
    
    def validate_all(self, 
                     audio_files: List[Dict[str, Any]], 
                     parsed_logs: List[Any],
                     duplicates: Dict[str, List[Dict[str, Any]]],
                     config: Optional[Dict[str, Any]] = None) -> ValidationResult:
        """
        执行所有校验规则
        
        Args:
            audio_files: 音频文件信息列表
            parsed_logs: 解析后的场记列表
            duplicates: 重复文件信息
            config: 校验配置（可覆盖默认规则）
            
        Returns:
            完整的校验结果
        """
        self.result = ValidationResult()
        self.result.total_files = len(audio_files)
        
        # 配置校验规则
        if config:
            self._apply_config(config)
        
        # 对每个音频文件执行校验
        for audio_file in audio_files:
            self._validate_single_file(audio_file)
        
        # 校验场记匹配
        if parsed_logs:
            self._validate_log_matching(audio_files, parsed_logs)
        
        # 校验重复文件
        if duplicates:
            self._validate_duplicates(duplicates)
        
        # 更新统计
        self._update_statistics()
        
        return self.result
    
    def _apply_config(self, config: Dict[str, Any]):
        """应用自定义配置"""
        if 'recommended_sample_rates' in config:
            self.RECOMMENDED_SAMPLE_RATES = set(config['recommended_sample_rates'])
        if 'recommended_bit_depths' in config:
            self.RECOMMENDED_BIT_DEPTHS = set(config['recommended_bit_depths'])
        if 'min_duration' in config:
            self.MIN_REASONABLE_DURATION = float(config['min_duration'])
        if 'max_duration' in config:
            self.MAX_REASONABLE_DURATION = float(config['max_duration'])
    
    def _validate_single_file(self, audio_file: Dict[str, Any]):
        """校验单个音频文件"""
        file_path = audio_file.get('file_path', '')
        file_name = audio_file.get('file_name', '')
        
        # 1. 校验文件名
        self._validate_filename(file_name, file_path)
        
        # 2. 校验技术参数（如果有元数据）
        metadata = audio_file.get('metadata', {})
        if metadata:
            self._validate_technical_params(metadata, file_name, file_path)
        
        # 3. 校验备注缺失
        self._validate_notes_presence(audio_file, file_name, file_path)
    
    def _validate_filename(self, file_name: str, file_path: str):
        """校验文件名"""
        issues_found = []
        
        # 检查是否包含非法字符
        if re.search(self.INVALID_FILENAME_CHARS, file_name):
            issues_found.append(ValidationIssue(
                issue_id=self._generate_issue_id(),
                category=ValidationCategory.NAMING,
                severity=ValidationSeverity.WARNING,
                message="文件名包含不推荐的字符（空格或特殊字符）",
                file_name=file_name,
                file_path=file_path,
                field_name="filename",
                actual_value=file_name,
                suggestion="建议使用下划线或连字符代替空格，避免使用特殊字符"
            ))
        
        # 检查是否符合推荐的命名模式
        if not self.RECOMMENDED_FILENAME_PATTERN.match(file_name):
            issues_found.append(ValidationIssue(
                issue_id=self._generate_issue_id(),
                category=ValidationCategory.NAMING,
                severity=ValidationSeverity.INFO,
                message="文件名可能不符合规范命名约定",
                file_name=file_name,
                file_path=file_path,
                field_name="filename",
                actual_value=file_name,
                suggestion="推荐格式：场景_镜头_条数_日期时间.wav"
            ))
        
        # 检查是否包含时间码相关信息
        timecode_pattern = re.compile(r'(\d{1,2}[:;]\d{2}[:;]\d{2})')
        if not timecode_pattern.search(file_name) and '_' not in file_name:
            issues_found.append(ValidationIssue(
                issue_id=self._generate_issue_id(),
                category=ValidationCategory.NAMING,
                severity=ValidationSeverity.INFO,
                message="文件名中未找到场景/镜头/时间码标识",
                file_name=file_name,
                file_path=file_path,
                field_name="filename",
                suggestion="建议在文件名中包含场号、镜号或时间码信息"
            ))
        
        for issue in issues_found:
            self._add_issue(issue)
    
    def _validate_technical_params(self, metadata: Dict[str, Any], file_name: str, file_path: str):
        """校验技术参数"""
        issues_found = []
        
        # 检查采样率
        sample_rate = metadata.get('sample_rate', 0)
        if sample_rate and sample_rate not in self.RECOMMENDED_SAMPLE_RATES:
            issues_found.append(ValidationIssue(
                issue_id=self._generate_issue_id(),
                category=ValidationCategory.SAMPLE_RATE,
                severity=ValidationSeverity.WARNING,
                message="采样率不是专业制作推荐值",
                file_name=file_name,
                file_path=file_path,
                field_name="sample_rate",
                expected_value=f"推荐值: {sorted(self.RECOMMENDED_SAMPLE_RATES)}",
                actual_value=str(sample_rate),
                suggestion="专业制作推荐使用48kHz或96kHz采样率"
            ))
        
        # 检查位深
        bits_per_sample = metadata.get('bits_per_sample', 0)
        if bits_per_sample and bits_per_sample not in self.RECOMMENDED_BIT_DEPTHS:
            issues_found.append(ValidationIssue(
                issue_id=self._generate_issue_id(),
                category=ValidationCategory.TECHNICAL,
                severity=ValidationSeverity.WARNING,
                message="位深不是专业制作推荐值",
                file_name=file_name,
                file_path=file_path,
                field_name="bits_per_sample",
                expected_value=f"推荐值: {sorted(self.RECOMMENDED_BIT_DEPTHS)}",
                actual_value=str(bits_per_sample),
                suggestion="专业制作推荐使用24bit位深"
            ))
        
        # 检查时长合理性
        duration = metadata.get('duration_seconds', 0)
        if duration:
            if duration < self.MIN_REASONABLE_DURATION:
                issues_found.append(ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    category=ValidationCategory.DURATION,
                    severity=ValidationSeverity.INFO,
                    message="音频时长非常短",
                    file_name=file_name,
                    file_path=file_path,
                    field_name="duration",
                    actual_value=f"{duration:.3f}秒",
                    suggestion="请确认这是否是完整的素材"
                ))
            elif duration > self.MAX_REASONABLE_DURATION:
                issues_found.append(ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    category=ValidationCategory.DURATION,
                    severity=ValidationSeverity.WARNING,
                    message="音频时长非常长",
                    file_name=file_name,
                    file_path=file_path,
                    field_name="duration",
                    actual_value=f"{duration/3600:.2f}小时",
                    suggestion="建议检查是否是多段素材合并或需要分割"
                ))
        
        # 检查时间码
        timecode_start = metadata.get('timecode_start')
        if not timecode_start:
            issues_found.append(ValidationIssue(
                issue_id=self._generate_issue_id(),
                category=ValidationCategory.TIMECODE,
                severity=ValidationSeverity.INFO,
                message="未找到嵌入的时间码信息",
                file_name=file_name,
                file_path=file_path,
                field_name="timecode",
                suggestion="如果使用了时间码同步，请确认音频文件包含时间码元数据"
            ))
        
        for issue in issues_found:
            self._add_issue(issue)
    
    def _validate_notes_presence(self, audio_file: Dict[str, Any], file_name: str, file_path: str):
        """校验备注是否缺失"""
        # 检查元数据中是否有备注
        metadata = audio_file.get('metadata', {})
        comment = metadata.get('comment', '')
        description = metadata.get('description', '')
        
        if not comment and not description:
            # 检查文件名中是否有描述性内容
            name_lower = file_name.lower()
            descriptive_words = ['现场', '环境', '采访', '对话', '旁白', 'wild', 'atmosphere', 'interview']
            
            has_descriptive_name = any(word in name_lower for word in descriptive_words)
            
            if not has_descriptive_name:
                self._add_issue(ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    category=ValidationCategory.NOTES,
                    severity=ValidationSeverity.WARNING,
                    message="音频文件缺少描述或备注",
                    file_name=file_name,
                    file_path=file_path,
                    field_name="description",
                    suggestion="建议添加元数据备注或使用更具描述性的文件名"
                ))
    
    def _validate_log_matching(self, audio_files: List[Dict[str, Any]], parsed_logs: List[Any]):
        """校验音频文件与场记的匹配情况"""
        # 收集场记中的场景/镜头信息
        log_entries = []
        for log in parsed_logs:
            if hasattr(log, 'entries'):
                log_entries.extend(log.entries)
        
        if not log_entries:
            return
        
        # 检查每个音频文件是否能匹配到场记
        for audio_file in audio_files:
            file_name = audio_file.get('file_name', '')
            file_path = audio_file.get('file_path', '')
            
            # 尝试从文件名提取场景/镜头信息
            scene_match = re.search(r'[Ss]cene[_-]?(\d+)', file_name)
            shot_match = re.search(r'[Ss]hot[_-]?(\d+)', file_name)
            
            scene_num = scene_match.group(1) if scene_match else None
            shot_num = shot_match.group(1) if shot_match else None
            
            if scene_num or shot_num:
                # 检查场记中是否有对应的条目
                found_match = False
                for entry in log_entries:
                    entry_scene = getattr(entry, 'scene_number', '')
                    entry_shot = getattr(entry, 'shot_number', '')
                    
                    if scene_num and scene_num in str(entry_scene):
                        found_match = True
                        break
                    if shot_num and shot_num in str(entry_shot):
                        found_match = True
                        break
                
                if not found_match:
                    self._add_issue(ValidationIssue(
                        issue_id=self._generate_issue_id(),
                        category=ValidationCategory.MISSING,
                        severity=ValidationSeverity.WARNING,
                        message="音频文件对应的场记条目未找到",
                        file_name=file_name,
                        file_path=file_path,
                        field_name="log_matching",
                        suggestion="请检查场记是否完整或文件名中的场景/镜头编号是否正确"
                    ))
    
    def _validate_duplicates(self, duplicates: Dict[str, List[Dict[str, Any]]]):
        """校验重复文件"""
        for file_hash, duplicate_files in duplicates.items():
            if len(duplicate_files) >= 2:
                file_names = [f.get('file_name', 'unknown') for f in duplicate_files]
                
                self._add_issue(ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    category=ValidationCategory.DUPLICATE,
                    severity=ValidationSeverity.WARNING,
                    message=f"发现 {len(duplicate_files)} 个重复文件",
                    file_name=file_names[0],
                    file_path=duplicate_files[0].get('file_path', ''),
                    field_name="file_hash",
                    actual_value=f"重复文件: {', '.join(file_names)}",
                    suggestion="建议删除重复文件或确认是否需要保留多个副本",
                    metadata={
                        'duplicate_files': duplicate_files,
                        'file_hash': file_hash
                    }
                ))
    
    def _add_issue(self, issue: ValidationIssue):
        """添加问题到结果"""
        self.result.all_issues.append(issue)
        
        # 按类别分类
        if issue.category not in self.result.issues_by_category:
            self.result.issues_by_category[issue.category] = []
        self.result.issues_by_category[issue.category].append(issue)
        
        # 按文件分类
        if issue.file_name:
            if issue.file_name not in self.result.issues_by_file:
                self.result.issues_by_file[issue.file_name] = []
            self.result.issues_by_file[issue.file_name].append(issue)
    
    def _update_statistics(self):
        """更新统计信息"""
        self.result.total_issues = len(self.result.all_issues)
        self.result.error_count = sum(
            1 for issue in self.result.all_issues 
            if issue.severity == ValidationSeverity.ERROR
        )
        self.result.warning_count = sum(
            1 for issue in self.result.all_issues 
            if issue.severity == ValidationSeverity.WARNING
        )
        self.result.info_count = sum(
            1 for issue in self.result.all_issues 
            if issue.severity == ValidationSeverity.INFO
        )
    
    def _generate_issue_id(self) -> str:
        """生成唯一的问题ID"""
        self._issue_counter += 1
        return f"VAL-{datetime.now().strftime('%Y%m%d')}-{self._issue_counter:04d}"


def validate_files(audio_files: List[Dict[str, Any]], 
                   parsed_logs: List[Any] = None,
                   duplicates: Dict[str, List[Dict[str, Any]]] = None,
                   config: Dict[str, Any] = None) -> ValidationResult:
    """
    便捷函数：执行文件校验
    
    Args:
        audio_files: 音频文件信息列表
        parsed_logs: 解析后的场记列表
        duplicates: 重复文件信息
        config: 校验配置
        
    Returns:
        校验结果
    """
    validator = Validator()
    return validator.validate_all(
        audio_files=audio_files,
        parsed_logs=parsed_logs or [],
        duplicates=duplicates or {},
        config=config
    )
