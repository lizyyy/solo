"""脱敏引擎核心模块 - 敏感字段识别和脱敏处理"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Pattern, Tuple

from ..config.models import (
    MaskingPolicy,
    MaskStrategy,
    SensitiveFieldRule,
    SensitiveFieldType,
)
from ..parser.base import LogEntry
from .fake_generator import FakeValueGenerator


@dataclass
class SensitiveMatch:
    """敏感字段匹配结果"""
    field_type: SensitiveFieldType
    original_value: str
    start_pos: int
    end_pos: int
    rule: SensitiveFieldRule
    masked_value: Optional[str] = None


@dataclass
class MaskingResult:
    """脱敏处理结果"""
    original_content: str
    masked_content: str
    matches: List[SensitiveMatch]
    entry: LogEntry
    processed_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "original_content": self.original_content,
            "masked_content": self.masked_content,
            "matches": [
                {
                    "field_type": m.field_type.value,
                    "original_value": m.original_value,
                    "start_pos": m.start_pos,
                    "end_pos": m.end_pos,
                    "masked_value": m.masked_value,
                }
                for m in self.matches
            ],
            "entry_line": self.entry.line_number,
            "source_file": self.entry.source_file,
            "processed_at": self.processed_at.isoformat(),
        }


class MaskingEngine:
    """脱敏引擎 - 负责敏感字段识别和脱敏处理"""
    
    def __init__(self, policy: MaskingPolicy):
        """
        初始化脱敏引擎
        
        Args:
            policy: 脱敏策略
        """
        self.policy = policy
        self.fake_generator = FakeValueGenerator()
        
        # 编译所有启用的规则的正则表达式
        self._compiled_rules: List[Tuple[SensitiveFieldRule, Pattern]] = []
        self._compile_rules()
    
    def _compile_rules(self) -> None:
        """编译所有启用的规则"""
        self._compiled_rules = []
        for rule in self.policy.get_enabled_rules():
            try:
                pattern = rule.get_compiled_pattern()
                self._compiled_rules.append((rule, pattern))
            except re.error:
                # 跳过无效的正则表达式
                continue
    
    def update_policy(self, policy: MaskingPolicy) -> None:
        """
        更新脱敏策略
        
        Args:
            policy: 新的脱敏策略
        """
        self.policy = policy
        self._compile_rules()
    
    def scan_content(self, content: str) -> List[SensitiveMatch]:
        """
        扫描内容中的敏感字段
        
        Args:
            content: 要扫描的内容
            
        Returns:
            敏感字段匹配列表
        """
        matches: List[SensitiveMatch] = []
        matched_positions: set = set()
        
        # 按优先级顺序扫描
        for rule, pattern in self._compiled_rules:
            for match in pattern.finditer(content):
                start = match.start()
                end = match.end()
                value = match.group()
                
                # 检查是否已经被其他规则匹配（避免重叠）
                if any(start <= pos < end for pos in matched_positions):
                    continue
                
                # 记录匹配位置
                matched_positions.update(range(start, end))
                
                # 创建匹配结果
                sensitive_match = SensitiveMatch(
                    field_type=rule.field_type,
                    original_value=value,
                    start_pos=start,
                    end_pos=end,
                    rule=rule,
                )
                matches.append(sensitive_match)
        
        # 按位置排序
        matches.sort(key=lambda x: x.start_pos)
        
        return matches
    
    def scan_log_entry(self, entry: LogEntry) -> Dict[str, List[str]]:
        """
        扫描日志条目中的敏感字段
        
        Args:
            entry: 日志条目
            
        Returns:
            敏感字段字典，键为字段类型，值为匹配的值列表
        """
        # 扫描原始内容
        raw_matches = self.scan_content(entry.raw_content)
        
        # 扫描解析后的内容
        parsed_matches: List[SensitiveMatch] = []
        if entry.parsed_content:
            for key, value in entry.parsed_content.items():
                if isinstance(value, str):
                    matches = self.scan_content(value)
                    parsed_matches.extend(matches)
        
        # 合并所有匹配
        all_matches = raw_matches + parsed_matches
        
        # 按字段类型分组
        result: Dict[str, List[str]] = {}
        for match in all_matches:
            field_type = match.field_type.value
            if field_type not in result:
                result[field_type] = []
            if match.original_value not in result[field_type]:
                result[field_type].append(match.original_value)
        
        return result
    
    def mask_content(self, content: str, matches: Optional[List[SensitiveMatch]] = None) -> Tuple[str, List[SensitiveMatch]]:
        """
        脱敏内容
        
        Args:
            content: 原始内容
            matches: 可选的预扫描匹配结果，如果不提供则会自动扫描
            
        Returns:
            脱敏后的内容和匹配列表
        """
        if matches is None:
            matches = self.scan_content(content)
        
        if not matches:
            return content, []
        
        # 按位置倒序排列，以便从后往前替换（避免位置偏移）
        sorted_matches = sorted(matches, key=lambda x: x.start_pos, reverse=True)
        
        masked_content = content
        
        for match in sorted_matches:
            # 根据策略生成假值
            masked_value = self._generate_masked_value(match)
            match.masked_value = masked_value
            
            # 替换内容
            masked_content = (
                masked_content[:match.start_pos] + 
                masked_value + 
                masked_content[match.end_pos:]
            )
        
        return masked_content, matches
    
    def _generate_masked_value(self, match: SensitiveMatch) -> str:
        """
        根据匹配结果生成假值
        
        Args:
            match: 敏感字段匹配
            
        Returns:
            生成的假值
        """
        strategy = match.rule.mask_strategy
        field_type = match.field_type
        original = match.original_value
        
        if strategy == MaskStrategy.FAKE_VALUE:
            # 使用假值生成器
            if field_type == SensitiveFieldType.PHONE:
                return self.fake_generator.generate_phone(original)
            elif field_type == SensitiveFieldType.EMAIL:
                return self.fake_generator.generate_email(original)
            elif field_type == SensitiveFieldType.DEVICE_ID:
                return self.fake_generator.generate_device_id(original)
            elif field_type == SensitiveFieldType.USER_NAME:
                return self.fake_generator.generate_user_name(original)
            else:
                # 对于其他类型，使用部分掩码
                return self.fake_generator.generate_partial_mask(original, field_type.value)
        
        elif strategy == MaskStrategy.PARTIAL_MASK:
            # 部分掩码
            return self.fake_generator.generate_partial_mask(original, field_type.value)
        
        elif strategy == MaskStrategy.HASH:
            # 哈希
            return self.fake_generator.generate_hash(original)
        
        elif strategy == MaskStrategy.REPLACE:
            # 替换为固定字符串
            return f"[MASKED_{field_type.value.upper()}]"
        
        else:
            # 默认使用部分掩码
            return self.fake_generator.generate_partial_mask(original, field_type.value)
    
    def mask_log_entry(self, entry: LogEntry) -> MaskingResult:
        """
        脱敏日志条目
        
        Args:
            entry: 日志条目
            
        Returns:
            脱敏结果
        """
        # 扫描敏感字段
        matches = self.scan_content(entry.raw_content)
        
        # 脱敏处理
        masked_content, processed_matches = self.mask_content(entry.raw_content, matches)
        
        # 更新日志条目
        entry.masked_content = masked_content
        entry.sensitive_fields = {}
        for match in processed_matches:
            field_type = match.field_type.value
            if field_type not in entry.sensitive_fields:
                entry.sensitive_fields[field_type] = []
            if match.original_value not in entry.sensitive_fields[field_type]:
                entry.sensitive_fields[field_type].append(match.original_value)
        
        return MaskingResult(
            original_content=entry.raw_content,
            masked_content=masked_content,
            matches=processed_matches,
            entry=entry,
        )
    
    def mask_log_entries(self, entries: List[LogEntry]) -> List[MaskingResult]:
        """
        批量脱敏日志条目
        
        Args:
            entries: 日志条目列表
            
        Returns:
            脱敏结果列表
        """
        results = []
        for entry in entries:
            result = self.mask_log_entry(entry)
            results.append(result)
        return results
    
    def get_mappings(self) -> Dict[str, Dict[str, str]]:
        """
        获取所有的原始值到假值的映射
        
        Returns:
            映射字典
        """
        return self.fake_generator.get_cache()
    
    def load_mappings(self, mappings: Dict[str, Dict[str, str]]) -> None:
        """
        加载已有的映射
        
        Args:
            mappings: 映射字典
        """
        self.fake_generator.load_cache(mappings)
    
    def clear_mappings(self) -> None:
        """清空所有映射"""
        self.fake_generator.clear_cache()
