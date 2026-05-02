"""重复宏检查器 - 检测重复宏定义"""

from typing import List, Dict, Any, Optional, Set
from collections import defaultdict
import hashlib

from src.rules.rule_engine import BaseRule, RuleResult
from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    DuplicateMacro,
)


class DuplicateMacroChecker(BaseRule):
    """重复宏检查器"""
    
    def __init__(self):
        super().__init__()
        self.rule_name = "重复宏检查器"
        self.rule_description = "检测重复的宏定义，包括相同的宏命令被绑定到不同的快捷键"
    
    def execute(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context],
        **kwargs
    ) -> RuleResult:
        """执行重复宏检测"""
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description,
        )
        
        try:
            # 过滤出宏快捷键
            macro_shortcuts = [s for s in shortcuts if s.is_macro and s.macro_commands]
            result.total_checked = len(macro_shortcuts)
            
            # 1. 检测完全相同的宏
            exact_duplicates = self._detect_exact_duplicates(macro_shortcuts, applications)
            result.duplicate_macros.extend(exact_duplicates)
            
            # 2. 检测相似的宏（部分命令相同）
            similar_macros = self._detect_similar_macros(macro_shortcuts, applications)
            result.duplicate_macros.extend(similar_macros)
            
            # 3. 检测同一宏被绑定到不同的键
            different_bindings = self._detect_different_bindings(macro_shortcuts, applications)
            result.duplicate_macros.extend(different_bindings)
            
            # 4. 检测冲突的宏（可能相互影响）
            conflicting_macros = self._detect_conflicting_macros(macro_shortcuts, applications)
            result.duplicate_macros.extend(conflicting_macros)
            
            # 统计问题数量
            result.issues_found = len(result.duplicate_macros)
            
        except Exception as e:
            result.success = False
            result.error_message = str(e)
        
        return result
    
    def _detect_exact_duplicates(
        self,
        macro_shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[DuplicateMacro]:
        """检测完全相同的宏"""
        duplicates = []
        
        # 按宏命令内容分组
        macro_hash_to_shortcuts: Dict[str, List[Shortcut]] = defaultdict(list)
        
        for shortcut in macro_shortcuts:
            # 计算宏命令的哈希
            macro_str = ";".join(shortcut.macro_commands)
            macro_hash = hashlib.md5(macro_str.encode()).hexdigest()
            
            macro_hash_to_shortcuts[macro_hash].append(shortcut)
        
        # 找出被多个快捷键使用的宏
        for macro_hash, shortcut_list in macro_hash_to_shortcuts.items():
            if len(shortcut_list) > 1:
                # 检查这些快捷键是否来自不同的应用
                app_ids = set(s.application_id for s in shortcut_list)
                
                # 获取宏名称
                macro_name = shortcut_list[0].name or "Unknown Macro"
                macro_commands = shortcut_list[0].macro_commands
                
                # 获取不同的绑定键
                different_keys = []
                for s in shortcut_list:
                    if s.primary_key:
                        key_str = str(s.primary_key)
                        if key_str not in different_keys:
                            different_keys.append(key_str)
                
                # 获取应用名称
                app_names = []
                for s in shortcut_list:
                    app = next((a for a in applications if a.id == s.application_id), None)
                    if app:
                        app_names.append(app.display_name)
                    else:
                        app_names.append(s.application_id[:8] if s.application_id else "Unknown")
                
                # 创建重复宏记录
                duplicate = DuplicateMacro(
                    macro_name=macro_name,
                    shortcut_ids=[s.id for s in shortcut_list],
                    application_ids=list(app_ids),
                    macro_commands=macro_commands,
                    description=f"宏 '{macro_name}' 被 {len(shortcut_list)} 个快捷键定义使用",
                    severity=ConflictSeverity.MEDIUM.value,
                    has_different_bindings=len(different_keys) > 1,
                    different_keys=different_keys,
                )
                duplicates.append(duplicate)
        
        return duplicates
    
    def _detect_similar_macros(
        self,
        macro_shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[DuplicateMacro]:
        """检测相似的宏（部分命令相同）"""
        duplicates = []
        
        # 按前缀/后缀分组
        # 检查是否有宏共享大部分命令
        
        # 简化的检查：检查是否有宏以相同的命令开头
        prefix_to_shortcuts: Dict[str, List[Shortcut]] = defaultdict(list)
        
        for shortcut in macro_shortcuts:
            if shortcut.macro_commands:
                # 使用第一个命令作为前缀
                first_command = shortcut.macro_commands[0]
                prefix_to_shortcuts[first_command].append(shortcut)
        
        # 检查是否有多个宏以相同命令开头
        for prefix, shortcut_list in prefix_to_shortcuts.items():
            if len(shortcut_list) > 1:
                # 检查这些宏是否相似（命令重叠度高）
                # 这里使用简化的检查：命令数量相同且第一个命令相同
                
                # 按命令数量分组
                by_length: Dict[int, List[Shortcut]] = defaultdict(list)
                for s in shortcut_list:
                    by_length[len(s.macro_commands)].append(s)
                
                for length, same_length_shortcuts in by_length.items():
                    if len(same_length_shortcuts) > 1:
                        # 检查是否有完全相同的前缀
                        # 这是一个简化的检查
                        # 实际应用中可能需要更复杂的相似度计算
                        
                        # 检查是否所有命令都相同（除了最后一个）
                        for i, s1 in enumerate(same_length_shortcuts):
                            for s2 in same_length_shortcuts[i+1:]:
                                # 计算重叠度
                                overlap = 0
                                for cmd1, cmd2 in zip(s1.macro_commands, s2.macro_commands):
                                    if cmd1 == cmd2:
                                        overlap += 1
                                
                                overlap_ratio = overlap / max(len(s1.macro_commands), 1)
                                
                                # 如果重叠度超过 70%，认为是相似的
                                if overlap_ratio >= 0.7 and overlap_ratio < 1.0:
                                    macro_name = s1.name or "Similar Macro"
                                    
                                    duplicate = DuplicateMacro(
                                        macro_name=macro_name,
                                        shortcut_ids=[s1.id, s2.id],
                                        application_ids=list({s1.application_id, s2.application_id}),
                                        macro_commands=s1.macro_commands,
                                        description=f"宏 '{s1.name}' 和 '{s2.name}' 非常相似（重叠度 {overlap_ratio*100:.0f}%），可能是重复定义",
                                        severity=ConflictSeverity.LOW.value,
                                        has_different_bindings=str(s1.primary_key) != str(s2.primary_key) if (s1.primary_key and s2.primary_key) else False,
                                        different_keys=[str(s1.primary_key), str(s2.primary_key)] if (s1.primary_key and s2.primary_key) else [],
                                    )
                                    duplicates.append(duplicate)
        
        return duplicates
    
    def _detect_different_bindings(
        self,
        macro_shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[DuplicateMacro]:
        """检测同一宏被绑定到不同的键"""
        duplicates = []
        
        # 按宏名称分组（假设相同名称的宏是同一个）
        name_to_shortcuts: Dict[str, List[Shortcut]] = defaultdict(list)
        
        for shortcut in macro_shortcuts:
            if shortcut.name:
                name_to_shortcuts[shortcut.name].append(shortcut)
        
        # 检查是否有同一宏被绑定到不同的键
        for macro_name, shortcut_list in name_to_shortcuts.items():
            if len(shortcut_list) > 1:
                # 收集所有不同的绑定键
                bindings = {}
                for s in shortcut_list:
                    if s.primary_key:
                        key_str = str(s.primary_key)
                        if key_str not in bindings:
                            bindings[key_str] = s
                
                # 如果有多个不同的绑定
                if len(bindings) > 1:
                    # 检查这些绑定是否来自不同的应用
                    app_ids = set(s.application_id for s in shortcut_list)
                    
                    # 获取应用名称
                    app_names = []
                    for s in shortcut_list:
                        app = next((a for a in applications if a.id == s.application_id), None)
                        if app:
                            app_names.append(app.display_name)
                    
                    duplicate = DuplicateMacro(
                        macro_name=macro_name,
                        shortcut_ids=[s.id for s in shortcut_list],
                        application_ids=list(app_ids),
                        macro_commands=shortcut_list[0].macro_commands if shortcut_list else [],
                        description=f"宏 '{macro_name}' 被绑定到 {len(bindings)} 个不同的快捷键: {', '.join(bindings.keys())}",
                        severity=ConflictSeverity.LOW.value,
                        has_different_bindings=True,
                        different_keys=list(bindings.keys()),
                    )
                    duplicates.append(duplicate)
        
        return duplicates
    
    def _detect_conflicting_macros(
        self,
        macro_shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[DuplicateMacro]:
        """检测冲突的宏（可能相互影响）"""
        duplicates = []
        
        # 检查是否有宏使用了相同的快捷键（可能相互覆盖）
        key_to_shortcuts: Dict[str, List[Shortcut]] = defaultdict(list)
        
        for shortcut in macro_shortcuts:
            if shortcut.primary_key:
                key_str = str(shortcut.primary_key)
                key_to_shortcuts[key_str].append(shortcut)
        
        # 检查是否有多个宏使用相同的快捷键
        for key_str, shortcut_list in key_to_shortcuts.items():
            if len(shortcut_list) > 1:
                # 检查这些宏是否来自不同的应用
                app_ids = set(s.application_id for s in shortcut_list)
                
                # 获取宏名称
                macro_names = [s.name or "Unknown" for s in shortcut_list]
                
                # 获取应用名称
                app_names = []
                for s in shortcut_list:
                    app = next((a for a in applications if a.id == s.application_id), None)
                    if app:
                        app_names.append(app.display_name)
                
                # 这实际上是一个冲突，但我们也将其记录为重复宏问题
                duplicate = DuplicateMacro(
                    macro_name=macro_names[0] if macro_names else "Conflicting Macros",
                    shortcut_ids=[s.id for s in shortcut_list],
                    application_ids=list(app_ids),
                    macro_commands=shortcut_list[0].macro_commands if shortcut_list else [],
                    description=f"快捷键 {key_str} 被 {len(shortcut_list)} 个宏使用: {', '.join(macro_names)}，这些宏可能相互冲突",
                    severity=ConflictSeverity.HIGH.value,
                    has_different_bindings=False,
                    different_keys=[key_str],
                )
                duplicates.append(duplicate)
        
        return duplicates
