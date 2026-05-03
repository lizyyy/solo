"""脱敏规则模块 - 负责处理姓名替换和敏感信息脱敏"""

import re
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .parser import (
    AuthorizationData,
    Issue,
    IssueType,
    SensitiveNames,
    SRTContent,
    SubRipFile,
    SubRipItem,
)


@dataclass
class Replacement:
    """替换记录"""
    original: str
    replacement: str
    location: Optional[Dict[str, Any]] = None
    context: Optional[str] = None


@dataclass
class SanitizationResult:
    """脱敏结果"""
    original_text: str
    sanitized_text: str
    replacements: List[Replacement] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    
    @property
    def is_safe(self) -> bool:
        """是否安全（无未处理的敏感信息）"""
        return len([i for i in self.issues if i.severity == "high"]) == 0


class NameSanitizer:
    """姓名脱敏器"""
    
    def __init__(self, authorization_data: Optional[AuthorizationData] = None, 
                 sensitive_names: Optional[SensitiveNames] = None):
        self.authorization_data = authorization_data
        self.sensitive_names = sensitive_names
        self._name_map: Dict[str, str] = {}
        self._build_name_map()
    
    def _build_name_map(self):
        """构建姓名到化名的映射"""
        if not self.authorization_data:
            return
        
        for name, record in self.authorization_data.records.items():
            if record.pseudonym:
                self._name_map[name] = record.pseudonym
        
        if self.sensitive_names:
            for name, sensitive in self.sensitive_names.names.items():
                if sensitive.suggested_pseudonym and name not in self._name_map:
                    self._name_map[name] = sensitive.suggested_pseudonym
    
    def get_all_names(self) -> List[str]:
        """获取所有需要处理的姓名"""
        names = set()
        if self.authorization_data:
            names.update(self.authorization_data.records.keys())
        if self.sensitive_names:
            names.update(self.sensitive_names.names.keys())
        return sorted(names, key=len, reverse=True)
    
    def has_pseudonym(self, name: str) -> bool:
        """检查某个姓名是否有对应的化名"""
        return name in self._name_map
    
    def get_pseudonym(self, name: str) -> Optional[str]:
        """获取化名"""
        return self._name_map.get(name)
    
    def sanitize_text(self, text: str, 
                      subtitle_index: Optional[int] = None,
                      start_time: Optional[timedelta] = None,
                      end_time: Optional[timedelta] = None) -> SanitizationResult:
        """
        脱敏文本
        
        Args:
            text: 原始文本
            subtitle_index: 字幕索引（用于问题定位）
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            脱敏结果
        """
        result = SanitizationResult(original_text=text, sanitized_text=text)
        names = self.get_all_names()
        
        for name in names:
            if name in result.sanitized_text:
                pseudonym = self.get_pseudonym(name)
                
                location = None
                if subtitle_index is not None:
                    location = {
                        "subtitle_index": subtitle_index,
                        "start_time": str(start_time) if start_time else None,
                        "end_time": str(end_time) if end_time else None
                    }
                
                if pseudonym:
                    result.replacements.append(Replacement(
                        original=name,
                        replacement=pseudonym,
                        location=location,
                        context=text
                    ))
                    result.sanitized_text = result.sanitized_text.replace(name, pseudonym)
                else:
                    result.issues.append(Issue(
                        issue_type=IssueType.NAME_LEAK,
                        description=f"发现敏感姓名「{name}」，且无对应化名",
                        severity="high",
                        location=location,
                        context=text
                    ))
        
        return result


class SegmentSanitizer:
    """片段脱敏器（根据授权范围处理）"""
    
    def __init__(self, authorization_data: AuthorizationData):
        self.authorization_data = authorization_data
    
    def check_authorization(self, names: List[str], 
                           start_time: timedelta, 
                           end_time: timedelta) -> Tuple[bool, List[str]]:
        """
        检查某片段的授权状态
        
        Args:
            names: 该片段中出现的敏感姓名列表
            start_time: 片段开始时间
            end_time: 片段结束时间
            
        Returns:
            (是否全部授权, 未授权的姓名列表)
        """
        unauthorized = []
        
        for name in names:
            if not self.authorization_data.is_authorized(name, start_time, end_time):
                unauthorized.append(name)
        
        return len(unauthorized) == 0, unauthorized


class SRTSanitizer:
    """SRT 脱敏器"""
    
    def __init__(self, name_sanitizer: NameSanitizer, 
                 segment_sanitizer: Optional[SegmentSanitizer] = None):
        self.name_sanitizer = name_sanitizer
        self.segment_sanitizer = segment_sanitizer
    
    def sanitize_subtitle(self, subtitle: SubRipItem) -> SanitizationResult:
        """脱敏单条字幕"""
        start = timedelta(
            hours=subtitle.start.hours,
            minutes=subtitle.start.minutes,
            seconds=subtitle.start.seconds,
            milliseconds=subtitle.start.milliseconds
        )
        end = timedelta(
            hours=subtitle.end.hours,
            minutes=subtitle.end.minutes,
            seconds=subtitle.end.seconds,
            milliseconds=subtitle.end.milliseconds
        )
        
        return self.name_sanitizer.sanitize_text(
            subtitle.text,
            subtitle_index=subtitle.index,
            start_time=start,
            end_time=end
        )
    
    def sanitize_all(self, subtitles: SubRipFile) -> Tuple[SubRipFile, List[SanitizationResult], List[Issue]]:
        """
        脱敏所有字幕
        
        Returns:
            (脱敏后的字幕文件, 各条字幕的脱敏结果, 所有问题列表)
        """
        from copy import deepcopy
        
        sanitized_subtitles = deepcopy(subtitles)
        all_results: List[SanitizationResult] = []
        all_issues: List[Issue] = []
        
        for i, subtitle in enumerate(sanitized_subtitles):
            result = self.sanitize_subtitle(subtitle)
            subtitle.text = result.sanitized_text
            all_results.append(result)
            all_issues.extend(result.issues)
        
        return sanitized_subtitles, all_results, all_issues


class SanitizationRules:
    """脱敏规则引擎"""
    
    RULES: Dict[str, Callable] = {}
    
    @classmethod
    def register_rule(cls, name: str, rule_func: Callable):
        """注册脱敏规则"""
        cls.RULES[name] = rule_func
    
    @classmethod
    def apply_rules(cls, text: str, rules: List[str]) -> SanitizationResult:
        """应用指定规则"""
        result = SanitizationResult(original_text=text, sanitized_text=text)
        
        for rule_name in rules:
            if rule_name in cls.RULES:
                rule_func = cls.RULES[rule_name]
                rule_result = rule_func(result.sanitized_text)
                result.sanitized_text = rule_result.sanitized_text
                result.replacements.extend(rule_result.replacements)
                result.issues.extend(rule_result.issues)
        
        return result


def phone_sanitizer(text: str) -> SanitizationResult:
    """手机号脱敏规则"""
    result = SanitizationResult(original_text=text, sanitized_text=text)
    
    phone_pattern = re.compile(r'1[3-9]\d{9}')
    
    def replace_func(match):
        original = match.group()
        replacement = original[:3] + '****' + original[7:]
        result.replacements.append(Replacement(
            original=original,
            replacement=replacement,
            context=text
        ))
        return replacement
    
    result.sanitized_text = phone_pattern.sub(replace_func, text)
    return result


def id_card_sanitizer(text: str) -> SanitizationResult:
    """身份证号脱敏规则"""
    result = SanitizationResult(original_text=text, sanitized_text=text)
    
    id_pattern = re.compile(r'\d{17}[\dXx]')
    
    def replace_func(match):
        original = match.group()
        replacement = original[:6] + '********' + original[14:]
        result.replacements.append(Replacement(
            original=original,
            replacement=replacement,
            context=text
        ))
        return replacement
    
    result.sanitized_text = id_pattern.sub(replace_func, text)
    return result


SanitizationRules.register_rule('phone', phone_sanitizer)
SanitizationRules.register_rule('id_card', id_card_sanitizer)
