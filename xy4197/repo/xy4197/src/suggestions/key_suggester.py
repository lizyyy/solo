"""改键建议器 - 为冲突快捷键提供替代方案"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict
import itertools

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
)


class SuggestionType(Enum):
    """建议类型枚举"""
    REPLACE_MODIFIER = "replace_modifier"  # 替换修饰键
    REPLACE_KEY = "replace_key"  # 替换主键
    ADD_MODIFIER = "add_modifier"  # 添加修饰键
    REMOVE_MODIFIER = "remove_modifier"  # 移除修饰键
    COMPLETE_REMAP = "complete_remap"  # 完全重新映射
    PLATFORM_ADAPT = "platform_adapt"  # 平台适配


@dataclass
class Suggestion:
    """改键建议"""
    
    # 建议信息
    suggestion_type: str = ""
    suggestion_type: str = ""
    
    # 原始键和建议键
    original_key: str = ""
    suggested_key: str = ""
    
    # 详细信息
    description: str = ""
    reason: str = ""
    
    # 评分和优先级
    score: float = 0.0  # 0.0 - 1.0，越高越好
    priority: int = 0  # 数字越小优先级越高
    
    # 涉及的快捷键
    shortcut_id: str = ""
    application_id: str = ""
    
    # 平台信息
    platform: str = "all"
    
    # 解决的问题类型
    solves_issues: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "suggestion_type": self.suggestion_type,
            "original_key": self.original_key,
            "suggested_key": self.suggested_key,
            "description": self.description,
            "reason": self.reason,
            "score": self.score,
            "priority": self.priority,
            "shortcut_id": self.shortcut_id,
            "application_id": self.application_id,
            "platform": self.platform,
            "solves_issues": self.solves_issues,
        }


class KeySuggester:
    """改键建议器"""
    
    def __init__(self):
        # 易按的键（按易用性排序）
        self.easy_keys = [
            # 主键盘区 - 最容易按的键
            "a", "s", "d", "f", "j", "k", "l", ";",  # 主排
            "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",  # 上排
            "z", "x", "c", "v", "b", "n", "m", ",", ".",  # 下排
            # 数字键
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
            # 功能键（较难按）
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
        ]
        
        # 常用修饰键组合（按易用性排序）
        self.easy_modifier_combos = [
            ["Cmd"], ["Ctrl"], ["Alt"], ["Shift"],
            ["Cmd", "Shift"], ["Ctrl", "Shift"], ["Alt", "Shift"],
            ["Cmd", "Alt"], ["Ctrl", "Alt"],
            ["Cmd", "Ctrl"], ["Cmd", "Alt", "Shift"],
        ]
        
        # 系统保留键（需要避免）
        self.reserved_keys = {
            # Mac 系统保留键
            "Cmd+Tab", "Cmd+Q", "Cmd+W", "Cmd+H", "Cmd+M",
            "Cmd+Space", "Cmd+Option+Esc",
            # Windows 系统保留键
            "Win+Tab", "Win+D", "Win+E", "Win+R", "Win+L",
            "Alt+F4", "Ctrl+Alt+Del",
            # 浏览器保留键
            "Cmd+T", "Cmd+N", "Cmd+W", "Cmd+Q",
            "Ctrl+T", "Ctrl+N", "Ctrl+W", "Ctrl+Q",
        }
        
        # 已占用的键
        self.occupied_keys: Set[str] = set()
        
        # 应用程序信息
        self.applications: List[Application] = []
        self.shortcuts: List[Shortcut] = []
        
        self._initialized = False
    
    def initialize(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ):
        """初始化建议器"""
        self.shortcuts = shortcuts
        self.applications = applications
        
        # 收集所有已占用的键
        self.occupied_keys = set()
        for shortcut in shortcuts:
            if shortcut.primary_key:
                self.occupied_keys.add(str(shortcut.primary_key))
            for secondary_key in shortcut.secondary_keys:
                self.occupied_keys.add(str(secondary_key))
        
        self._initialized = True
    
    def suggest_for_shortcut(
        self,
        shortcut: Shortcut,
        conflict: Optional[Conflict] = None,
        platform: str = "all",
        max_suggestions: int = 10
    ) -> List[Suggestion]:
        """为单个快捷键提供改键建议"""
        if not self._initialized:
            raise RuntimeError("KeySuggester not initialized. Call initialize() first.")
        
        suggestions = []
        
        if not shortcut.primary_key:
            return suggestions
        
        original_key_str = str(shortcut.primary_key)
        
        # 1. 尝试替换修饰键（优先，保持主键
        modifier_suggestions = self._suggest_modifier_replacements(
            shortcut, original_key_str, conflict, platform
        )
        suggestions.extend(modifier_suggestions)
        
        # 2. 尝试替换主键
        key_suggestions = self._suggest_key_replacements(
            shortcut, original_key_str, conflict, platform
        )
        suggestions.extend(key_suggestions)
        
        # 3. 尝试添加/移除修饰键
        modifier_add_remove_suggestions = self._suggest_modifier_add_remove(
            shortcut, original_key_str, conflict, platform
        )
        suggestions.extend(modifier_add_remove_suggestions)
        
        # 4. 尝试完全重新映射
        complete_remap_suggestions = self._suggest_complete_remap(
            shortcut, original_key_str, conflict, platform
        )
        suggestions.extend(complete_remap_suggestions)
        
        # 5. 平台适配建议
        platform_suggestions = self._suggest_platform_adapt(
            shortcut, original_key_str, conflict, platform
        )
        suggestions.extend(platform_suggestions)
        
        # 过滤掉已占用的键
        valid_suggestions = [
            s for s in suggestions 
            if s.suggested_key not in self.occupied_keys
        ]
        
        # 按评分排序
        valid_suggestions.sort(key=lambda x: (x.score, -x.priority), reverse=True)
        
        # 返回前N个
        return valid_suggestions[:max_suggestions]
    
    def suggest_for_conflict(
        self,
        conflict: Conflict,
        shortcuts: List[Shortcut],
        max_suggestions_per_shortcut: int = 5
    ) -> Dict[str, List[Suggestion]]:
        """为冲突中的所有快捷键提供改键建议"""
        result = {}
        
        for shortcut_id in conflict.involved_shortcut_ids:
            shortcut = next((s for s in shortcuts if s.id == shortcut_id), None)
            if shortcut:
                suggestions = self.suggest_for_shortcut(
                    shortcut=shortcut,
                    conflict=conflict,
                    max_suggestions=max_suggestions_per_shortcut
                )
                result[shortcut_id] = suggestions
        
        return result
    
    def _suggest_modifier_replacements(
        self,
        shortcut: Shortcut,
        original_key_str: str,
        conflict: Optional[Conflict],
        platform: str
    ) -> List[Suggestion]:
        """建议替换修饰键"""
        suggestions = []
        
        if not shortcut.primary_key:
            return suggestions
        
        key = shortcut.primary_key
        modifiers = key.modifiers
        main_key = key.key
        
        # 没有修饰键的情况，无法替换
        if not modifiers:
            return suggestions
        
        # 尝试替换修饰键
        # 例如: Cmd -> Ctrl, Ctrl -> Cmd, Alt -> Option 等
        
        # 修饰键替换映射
        modifier_replacements = {
            "Cmd": ["Ctrl", "Alt"],
            "Ctrl": ["Cmd", "Alt"],
            "Alt": ["Cmd", "Ctrl"],
            "Shift": [],  # Shift 通常不单独替换
        }
        
        for i, modifier in enumerate(modifiers):
            if modifier in modifier_replacements:
                for replacement in modifier_replacements[modifier]:
                    # 确保替换后的修饰键组合不存在重复
                    if replacement in modifiers:
                        continue
                    
                    # 创建新的修饰键列表
                    new_modifiers = modifiers.copy()
                    new_modifiers[i] = replacement
                    
                    # 排序以确保一致性
                    new_modifiers = sorted(new_modifiers)
                    
                    # 创建新的快捷键
                    new_key = ShortcutKey(main_key, new_modifiers)
                    new_key_str = str(new_key)
                    
                    # 检查是否已占用
                    if new_key_str in self.occupied_keys:
                        continue
                    
                    # 计算评分
                    score = self._calculate_score(new_modifiers, main_key, platform)
                    
                    # 创建建议
                    suggestion = Suggestion(
                        suggestion_type=SuggestionType.REPLACE_MODIFIER.value,
                        original_key=original_key_str,
                        suggested_key=new_key_str,
                        description=f"将修饰键 '{modifier}' 替换为 '{replacement}'",
                        reason=f"原组合键 {original_key_str} 存在冲突，建议替换修饰键",
                        score=score,
                        priority=1,
                        shortcut_id=shortcut.id,
                        application_id=shortcut.application_id,
                        platform=platform,
                        solves_issues=self._get_solves_issues(conflict),
                    )
                    suggestions.append(suggestion)
        
        return suggestions
    
    def _suggest_key_replacements(
        self,
        shortcut: Shortcut,
        original_key_str: str,
        conflict: Optional[Conflict],
        platform: str
    ) -> List[Suggestion]:
        """建议替换主键"""
        suggestions = []
        
        if not shortcut.primary_key:
            return suggestions
        
        key = shortcut.primary_key
        modifiers = key.modifiers
        main_key = key.key
        
        # 尝试替换主键为其他易按的键
        # 优先选择同区域的键
        
        # 确定主键盘区的键（按易用性排序）
        easy_main_keys = [
            # 主排
            "a", "s", "d", "f", "j", "k", "l",
            # 上排
            "e", "r", "t", "y", "u", "i", "o",
            # 下排
            "c", "v", "b", "n", "m",
            # 数字键
            "1", "2", "3", "4", "5", "6", "7", "8", "9",
        ]
        
        # 排除原键
        if main_key in easy_main_keys:
            easy_main_keys.remove(main_key)
        
        # 尝试替换为其他易按的键
        for new_main_key in easy_main_keys[:20]:  # 只尝试前20个最易按的键
            # 创建新的快捷键
            new_key = ShortcutKey(new_main_key, modifiers.copy())
            new_key_str = str(new_key)
            
            # 检查是否已占用
            if new_key_str in self.occupied_keys:
                continue
            
            # 计算评分
            score = self._calculate_score(modifiers, new_main_key, platform)
            
            # 创建建议
            suggestion = Suggestion(
                suggestion_type=SuggestionType.REPLACE_KEY.value,
                original_key=original_key_str,
                suggested_key=new_key_str,
                description=f"将主键 '{main_key.upper()}' 替换为 '{new_main_key.upper()}'",
                reason=f"原组合键 {original_key_str} 存在冲突，建议替换主键",
                score=score,
                priority=2,
                shortcut_id=shortcut.id,
                application_id=shortcut.application_id,
                platform=platform,
                solves_issues=self._get_solves_issues(conflict),
            )
            suggestions.append(suggestion)
        
        return suggestions
    
    def _suggest_modifier_add_remove(
        self,
        shortcut: Shortcut,
        original_key_str: str,
        conflict: Optional[Conflict],
        platform: str
    ) -> List[Suggestion]:
        """建议添加或移除修饰键"""
        suggestions = []
        
        if not shortcut.primary_key:
            return suggestions
        
        key = shortcut.primary_key
        modifiers = key.modifiers
        main_key = key.key
        
        # 1. 尝试添加修饰键
        # 如果当前修饰键少于3个，可以添加
        if len(modifiers) < 3:
            possible_additions = []
            if "Cmd" not in modifiers and platform in ["all", "mac"]:
                possible_additions.append("Cmd")
            if "Ctrl" not in modifiers and platform in ["all", "windows", "linux"]:
                possible_additions.append("Ctrl")
            if "Alt" not in modifiers:
                possible_additions.append("Alt")
            if "Shift" not in modifiers:
                possible_additions.append("Shift")
            
            for addition in possible_additions:
                new_modifiers = modifiers.copy()
                new_modifiers.append(addition)
                new_modifiers = sorted(new_modifiers)
                
                new_key = ShortcutKey(main_key, new_modifiers)
                new_key_str = str(new_key)
                
                if new_key_str in self.occupied_keys:
                    continue
                
                score = self._calculate_score(new_modifiers, main_key, platform)
                
                suggestion = Suggestion(
                    suggestion_type=SuggestionType.ADD_MODIFIER.value,
                    original_key=original_key_str,
                    suggested_key=new_key_str,
                    description=f"添加修饰键 '{addition}'",
                    reason=f"原组合键 {original_key_str} 存在冲突，建议添加修饰键使其更独特",
                    score=score * 0.9,  # 添加修饰键的评分略低
                    priority=3,
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    platform=platform,
                    solves_issues=self._get_solves_issues(conflict),
                )
                suggestions.append(suggestion)
        
        # 2. 尝试移除修饰键
        # 如果当前有多个修饰键，可以尝试移除
        if len(modifiers) > 1:
            for i in range(len(modifiers)):
                new_modifiers = modifiers[:i] + modifiers[i+1:]
                new_modifiers = sorted(new_modifiers)
                
                new_key = ShortcutKey(main_key, new_modifiers)
                new_key_str = str(new_key)
                
                if new_key_str in self.occupied_keys:
                    continue
                
                # 检查是否是系统保留键
                if new_key_str in self.reserved_keys:
                    continue
                
                score = self._calculate_score(new_modifiers, main_key, platform)
                
                suggestion = Suggestion(
                    suggestion_type=SuggestionType.REMOVE_MODIFIER.value,
                    original_key=original_key_str,
                    suggested_key=new_key_str,
                    description=f"移除修饰键 '{modifiers[i]}'",
                    reason=f"原组合键 {original_key_str} 存在冲突，建议简化修饰键",
                    score=score * 0.8,  # 移除修饰键的评分更低
                    priority=4,
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    platform=platform,
                    solves_issues=self._get_solves_issues(conflict),
                )
                suggestions.append(suggestion)
        
        return suggestions
    
    def _suggest_complete_remap(
        self,
        shortcut: Shortcut,
        original_key_str: str,
        conflict: Optional[Conflict],
        platform: str
    ) -> List[Suggestion]:
        """建议完全重新映射"""
        suggestions = []
        
        if not shortcut.primary_key:
            return suggestions
        
        # 生成一些完全不同的组合
        # 尝试使用功能键
        function_keys = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"]
        
        # 常见的修饰键组合
        modifier_combos = [
            ["Cmd", "Shift"],
            ["Ctrl", "Shift"],
            ["Cmd", "Alt"],
            ["Ctrl", "Alt"],
            ["Cmd", "Option"],
        ]
        
        for fk_count = 0
        for fk in function_keys:
            if fk_count >= 5:
                break
            
            for modifiers in modifier_combos:
                new_key = ShortcutKey(fk, modifiers.copy())
                new_key_str = str(new_key)
                
                if new_key_str in self.occupied_keys:
                    continue
                
                score = self._calculate_score(modifiers, fk, platform)
                
                suggestion = Suggestion(
                    suggestion_type=SuggestionType.COMPLETE_REMAP.value,
                    original_key=original_key_str,
                    suggested_key=new_key_str,
                    description=f"完全重新映射为功能键",
                    reason=f"原组合键 {original_key_str} 存在冲突，建议使用功能键组合",
                    score=score * 0.7,  # 功能键的评分最低
                    priority=5,
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    platform=platform,
                    solves_issues=self._get_solves_issues(conflict),
                )
                suggestions.append(suggestion)
                fk_count += 1
        
        return suggestions
    
    def _suggest_platform_adapt(
        self,
        shortcut: Shortcut,
        original_key_str: str,
        conflict: Optional[Conflict],
        platform: str
    ) -> List[Suggestion]:
        """建议平台适配"""
        suggestions = []
        
        if not shortcut.primary_key:
            return suggestions
        
        key = shortcut.primary_key
        modifiers = key.modifiers
        main_key = key.key
        
        # 检查是否需要平台适配
        # 例如: Mac 的 Cmd 对应 Windows 的 Ctrl
        
        if platform == "windows" and "Cmd" in modifiers:
            # Mac 快捷键适配到 Windows
            new_modifiers = []
            for m in modifiers:
                if m == "Cmd":
                    new_modifiers.append("Ctrl")
                elif m == "Option":
                    new_modifiers.append("Alt")
                else:
                    new_modifiers.append(m)
            
            new_modifiers = sorted(new_modifiers)
            new_key = ShortcutKey(main_key, new_modifiers)
            new_key_str = str(new_key)
            
            if new_key_str not in self.occupied_keys:
                score = self._calculate_score(new_modifiers, main_key, platform)
                
                suggestion = Suggestion(
                    suggestion_type=SuggestionType.PLATFORM_ADAPT.value,
                    original_key=original_key_str,
                    suggested_key=new_key_str,
                    description=f"将 Mac 快捷键适配到 Windows: Cmd -> Ctrl, Option -> Alt",
                    reason=f"原组合键 {original_key_str} 是 Mac 格式，建议适配到 Windows",
                    score=score,
                    priority=0,  # 平台适配优先级最高
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    platform=platform,
                    solves_issues=self._get_solves_issues(conflict),
                )
                suggestions.append(suggestion)
        
        elif platform == "mac" and "Ctrl" in modifiers:
            # Windows 快捷键适配到 Mac
            new_modifiers = []
            for m in modifiers:
                if m == "Ctrl":
                    new_modifiers.append("Cmd")
                elif m == "Alt":
                    new_modifiers.append("Option")
                else:
                    new_modifiers.append(m)
            
            new_modifiers = sorted(new_modifiers)
            new_key = ShortcutKey(main_key, new_modifiers)
            new_key_str = str(new_key)
            
            if new_key_str not in self.occupied_keys:
                score = self._calculate_score(new_modifiers, main_key, platform)
                
                suggestion = Suggestion(
                    suggestion_type=SuggestionType.PLATFORM_ADAPT.value,
                    original_key=original_key_str,
                    suggested_key=new_key_str,
                    description=f"将 Windows 快捷键适配到 Mac: Ctrl -> Cmd, Alt -> Option",
                    reason=f"原组合键 {original_key_str} 是 Windows 格式，建议适配到 Mac",
                    score=score,
                    priority=0,
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    platform=platform,
                    solves_issues=self._get_solves_issues(conflict),
                )
                suggestions.append(suggestion)
        
        return suggestions
    
    def _calculate_score(
        self,
        modifiers: List[str],
        main_key: str,
        platform: str
    ) -> float:
        """计算建议的评分"""
        score = 1.0
        
        # 1. 修饰键数量评分
        # 2-3个修饰键是理想的
        modifier_count = len(modifiers)
        if modifier_count == 2:
            score *= 1.0
        elif modifier_count == 3:
            score *= 0.9
        elif modifier_count == 1:
            score *= 0.8
        else:
            score *= 0.5
        
        # 2. 主键易用性评分
        # 主键盘区的键评分更高
        easy_keys_order = [
            # 主排
            "a", "s", "d", "f", "j", "k", "l",
            # 上排
            "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
            # 下排
            "z", "x", "c", "v", "b", "n", "m",
            # 数字键
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
            # 功能键
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
        ]
        
        if main_key in easy_keys_order:
            key_index = easy_keys_order.index(main_key)
            # 前20个键评分最高
            if key_index < 10:
                score *= 1.0
            elif key_index < 20:
                score *= 0.9
            elif key_index < 30:
                score *= 0.8
            else:
                score *= 0.6
        
        # 3. 修饰键组合评分
        # 常用的组合评分更高
        modifier_tuple = tuple(sorted(modifiers))
        preferred_combos = [
            ("Cmd",), ("Ctrl",), ("Alt",),
            ("Cmd", "Shift"), ("Ctrl", "Shift"),
            ("Cmd", "Alt"), ("Ctrl", "Alt"),
        ]
        
        if modifier_tuple in preferred_combos:
            score *= 1.0
        else:
            score *= 0.8
        
        # 4. 平台适配评分
        # 检查修饰键是否适合目标平台
        if platform == "mac":
            if "Cmd" in modifiers:
                score *= 1.0
            elif "Ctrl" in modifiers:
                score *= 0.7  # Mac 上 Ctrl 不太常用
        elif platform == "windows":
            if "Ctrl" in modifiers:
                score *= 1.0
            elif "Cmd" in modifiers:
                score *= 0.7  # Windows 上 Cmd 不常用
        
        return max(0.0, min(1.0, score))
    
    def _get_solves_issues(self, conflict: Optional[Conflict]) -> List[str]:
        """获取建议解决的问题类型"""
        issues = []
        if conflict:
            issues.append(conflict.conflict_type)
        return issues
    
    def is_key_available(self, key_str: str) -> bool:
        """检查键是否可用"""
        return key_str not in self.occupied_keys and key_str not in self.reserved_keys
    
    def get_available_keys(
        self,
        modifiers: Optional[List[str]] = None,
        platform: str = "all",
        max_count: int = 20
    ) -> List[str]:
        """获取可用的键列表"""
        available = []
        
        # 如果没有指定修饰键，使用常用组合
        if not modifiers:
            modifier_combos = [
                ["Cmd"], ["Ctrl"], ["Alt"],
                ["Cmd", "Shift"], ["Ctrl", "Shift"],
            ]
        else:
            modifier_combos = [modifiers]
        
        for mods in modifier_combos:
            for key in self.easy_keys:
                shortcut_key = ShortcutKey(key, mods.copy())
                key_str = str(shortcut_key)
                
                if self.is_key_available(key_str):
                    available.append(key_str)
                    if len(available) >= max_count:
                        return available
        
        return available
