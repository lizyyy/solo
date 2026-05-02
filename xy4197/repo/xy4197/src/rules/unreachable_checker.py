"""不可达组合检查器 - 检测物理上难以或无法按下的快捷键组合"""

from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from src.rules.rule_engine import BaseRule, RuleResult
from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    UnreachableShortcut,
)


class UnreachableChecker(BaseRule):
    """不可达组合检查器"""
    
    def __init__(self):
        super().__init__()
        self.rule_name = "不可达组合检查器"
        self.rule_description = "检测物理上难以或无法按下的快捷键组合，包括过多修饰键、左右手冲突等"
        
        # 修饰键数量限制
        self.max_modifiers = 3  # 最多3个修饰键
        
        # 键盘布局 - 左右手可及的键
        # 基于标准 QWERTY 键盘
        self.left_hand_keys = {
            # 数字行（左）
            "1", "2", "3", "4", "5",
            # 字母行（上排左）
            "q", "w", "e", "r", "t",
            # 字母行（中排左）
            "a", "s", "d", "f", "g",
            # 字母行（下排左）
            "z", "x", "c", "v", "b",
            # 功能键
            "f1", "f2", "f3", "f4", "f5", "f6",
        }
        
        self.right_hand_keys = {
            # 数字行（右）
            "6", "7", "8", "9", "0",
            "-", "=",
            # 字母行（上排右）
            "y", "u", "i", "o", "p",
            "[", "]", "\\",
            # 字母行（中排右）
            "h", "j", "k", "l",
            ";", "'",
            # 字母行（下排右）
            "n", "m",
            ",", ".", "/",
            # 功能键
            "f7", "f8", "f9", "f10", "f11", "f12",
        }
        
        # 左手修饰键位置
        self.left_modifiers = {
            "left_ctrl", "left_shift", "left_alt", "left_cmd",
            "caps_lock",
        }
        
        # 右手修饰键位置
        self.right_modifiers = {
            "right_ctrl", "right_shift", "right_alt", "right_cmd",
            "enter",
        }
        
        # 困难组合的模式
        self.difficult_patterns = [
            # 连续的同手指按键
            {"keys": ["q", "a", "z"], "description": "左手小指连续按键"},
            {"keys": ["p", ";", "/"], "description": "右手小指连续按键"},
            # 同排相邻按键
            {"keys": ["q", "w", "e"], "description": "上排连续按键"},
            {"keys": ["a", "s", "d"], "description": "中排连续按键"},
            {"keys": ["z", "x", "c"], "description": "下排连续按键"},
        ]
    
    def execute(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context],
        **kwargs
    ) -> RuleResult:
        """执行不可达组合检测"""
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description,
        )
        
        try:
            # 过滤掉没有主键的快捷键
            valid_shortcuts = [s for s in shortcuts if s.primary_key]
            result.total_checked = len(valid_shortcuts)
            
            # 1. 检测过多修饰键
            too_many_modifiers = self._detect_too_many_modifiers(valid_shortcuts)
            result.unreachable_shortcuts.extend(too_many_modifiers)
            
            # 2. 检测同手冲突（修饰键和主键在同一只手）
            same_hand_conflicts = self._detect_same_hand_conflicts(valid_shortcuts)
            result.unreachable_shortcuts.extend(same_hand_conflicts)
            
            # 3. 检测无效的修饰键组合
            invalid_modifier_combos = self._detect_invalid_modifier_combos(valid_shortcuts)
            result.unreachable_shortcuts.extend(invalid_modifier_combos)
            
            # 4. 检测主键位置问题
            key_position_issues = self._detect_key_position_issues(valid_shortcuts)
            result.unreachable_shortcuts.extend(key_position_issues)
            
            # 5. 检测无效的键（不在标准键盘上）
            invalid_keys = self._detect_invalid_keys(valid_shortcuts)
            result.unreachable_shortcuts.extend(invalid_keys)
            
            # 统计问题数量
            result.issues_found = len(result.unreachable_shortcuts)
            
        except Exception as e:
            result.success = False
            result.error_message = str(e)
        
        return result
    
    def _detect_too_many_modifiers(
        self,
        shortcuts: List[Shortcut]
    ) -> List[UnreachableShortcut]:
        """检测过多修饰键的情况"""
        unreachable = []
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key = shortcut.primary_key
            modifier_count = len(key.modifiers)
            
            if modifier_count > self.max_modifiers:
                key_str = str(key)
                
                unreachable_item = UnreachableShortcut(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    key_string=key_str,
                    reason="too_many_modifiers",
                    description=f"快捷键 {key_str} ('{shortcut.name}') 使用了 {modifier_count} 个修饰键，超过推荐的 {self.max_modifiers} 个",
                    modifiers=key.modifiers,
                    key=key.key,
                    severity=ConflictSeverity.HIGH.value,
                    suggestion="建议减少修饰键数量，或使用更容易按的组合",
                )
                unreachable.append(unreachable_item)
        
        return unreachable
    
    def _detect_same_hand_conflicts(
        self,
        shortcuts: List[Shortcut]
    ) -> List[UnreachableShortcut]:
        """检测同手冲突（修饰键和主键在同一只手）"""
        unreachable = []
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key = shortcut.primary_key
            main_key = key.key.lower()
            
            # 确定主键在哪只手
            main_key_hand = None
            if main_key in self.left_hand_keys:
                main_key_hand = "left"
            elif main_key in self.right_hand_keys:
                main_key_hand = "right"
            
            if not main_key_hand:
                continue  # 无法确定的键跳过
            
            # 检查是否有同手冲突
            # 典型问题：用左手小指按 Ctrl，同时用左手按主键
            
            # 检查修饰键和主键是否在同一只手
            # 这是一个简化的检查 - 实际需要考虑用户的打字习惯
            
            has_same_hand_issue = False
            issue_description = ""
            
            # 检查常见的同手困难组合
            # 例如: Ctrl+A (左手小指 + 左手小指)
            #       Ctrl+S (左手小指 + 左手无名指)
            #       Ctrl+Z (左手小指 + 左手小指)
            
            # 困难组合：小指修饰键 + 同侧小指/无名指按键
            difficult_left_combos = {
                "a", "s", "d", "z", "x", "c", "q", "w", "e"
            }
            difficult_right_combos = {
                "p", "l", ";", "m", ",", ".", "/", "o", "i"
            }
            
            if main_key_hand == "left" and main_key in difficult_left_combos:
                # 检查是否有左手修饰键
                # Ctrl, Shift, Alt, Cmd 在左边
                has_left_modifier = any(m in ["Ctrl", "Shift", "Alt", "Cmd"] for m in key.modifiers)
                
                if has_left_modifier and len(key.modifiers) >= 1:
                    has_same_hand_issue = True
                    issue_description = f"快捷键 {str(key)} ('{shortcut.name}') 使用了左手修饰键配合左手困难按键 {main_key.upper()}，可能难以按下"
            
            elif main_key_hand == "right" and main_key in difficult_right_combos:
                # 检查是否有右手修饰键
                # 实际上大多数人使用左手修饰键，所以这可能不是问题
                # 但如果使用了多个修饰键，可能会有问题
                if len(key.modifiers) >= 2:
                    has_same_hand_issue = True
                    issue_description = f"快捷键 {str(key)} ('{shortcut.name}') 使用了多个修饰键配合右手按键 {main_key.upper()}，可能难以按下"
            
            # 特殊检查：小指连续按键
            # 例如: Ctrl+A (左小指+左小指)
            #       Shift+P (右小指+右小指)
            if main_key == "a" and "Ctrl" in key.modifiers:
                has_same_hand_issue = True
                issue_description = f"快捷键 {str(key)} ('{shortcut.name}'): Ctrl+A 是左手小指连续按键，非常困难"
            elif main_key == "p" and "Shift" in key.modifiers:
                has_same_hand_issue = True
                issue_description = f"快捷键 {str(key)} ('{shortcut.name}'): Shift+P 是右手小指连续按键，非常困难"
            
            if has_same_hand_issue:
                unreachable_item = UnreachableShortcut(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    key_string=str(key),
                    reason="physically_impossible",
                    description=issue_description,
                    modifiers=key.modifiers,
                    key=key.key,
                    severity=ConflictSeverity.MEDIUM.value,
                    suggestion="建议换用另一只手的按键，或使用功能键",
                )
                unreachable.append(unreachable_item)
        
        return unreachable
    
    def _detect_invalid_modifier_combos(
        self,
        shortcuts: List[Shortcut]
    ) -> List[UnreachableShortcut]:
        """检测无效的修饰键组合"""
        unreachable = []
        
        # 无效的修饰键组合（物理上无法同时按下）
        # 实际上这取决于键盘，但有些组合是不常见的
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key = shortcut.primary_key
            modifiers = key.modifiers
            
            # 检查是否有冲突的修饰键组合
            # 例如: 同时使用 Ctrl 和 Cmd（跨平台混乱）
            #       同时使用 4 个或更多修饰键
            
            has_issue = False
            issue_description = ""
            severity = ConflictSeverity.MEDIUM.value
            
            # 检查是否同时使用了 Cmd 和 Ctrl（常见的跨平台混乱）
            if "Cmd" in modifiers and "Ctrl" in modifiers:
                has_issue = True
                issue_description = f"快捷键 {str(key)} ('{shortcut.name}') 同时使用了 Cmd 和 Ctrl，这通常是跨平台配置错误"
                severity = ConflictSeverity.HIGH.value
            
            # 检查是否使用了不常见的修饰键组合
            # 例如: Alt+Shift+Ctrl+Cmd (四个修饰键)
            # 这在物理上是可能的，但非常困难
            
            if len(modifiers) >= 4:
                has_issue = True
                issue_description = f"快捷键 {str(key)} ('{shortcut.name}') 使用了 {len(modifiers)} 个修饰键，物理上难以同时按下"
                severity = ConflictSeverity.HIGH.value
            
            if has_issue:
                unreachable_item = UnreachableShortcut(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    key_string=str(key),
                    reason="invalid_combination",
                    description=issue_description,
                    modifiers=key.modifiers,
                    key=key.key,
                    severity=severity,
                    suggestion="建议简化修饰键组合",
                )
                unreachable.append(unreachable_item)
        
        return unreachable
    
    def _detect_key_position_issues(
        self,
        shortcuts: List[Shortcut]
    ) -> List[UnreachableShortcut]:
        """检测主键位置问题"""
        unreachable = []
        
        # 难以触及的键
        hard_to_reach_keys = {
            # 数字行
            "1", "2", "0", "-", "=",
            # 功能键
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
            # 边缘键
            "`", "[", "]", "\\", ";", "'", ",", ".", "/",
            # 导航键（没有修饰键时可能会有问题）
            "esc", "tab", "capslock", "enter", "backspace", "delete",
            "insert", "home", "end", "pageup", "pagedown",
            "up", "down", "left", "right",
        }
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key = shortcut.primary_key
            main_key = key.key.lower()
            
            # 检查是否使用了难以触及的键，且没有足够的修饰键
            # 例如: 单独的 F1 键可能被系统占用
            # 但 Ctrl+F1 是可以的
            
            if main_key in hard_to_reach_keys:
                # 检查修饰键数量
                modifier_count = len(key.modifiers)
                
                # 没有修饰键的功能键通常是系统快捷键
                if modifier_count == 0 and main_key.startswith("f"):
                    unreachable_item = UnreachableShortcut(
                        shortcut_id=shortcut.id,
                        application_id=shortcut.application_id,
                        key_string=str(key),
                        reason="invalid_combination",
                        description=f"快捷键 {str(key)} ('{shortcut.name}') 使用了无修饰的功能键 {main_key.upper()}，这通常是系统或应用保留键",
                        modifiers=key.modifiers,
                        key=key.key,
                        severity=ConflictSeverity.MEDIUM.value,
                        suggestion="建议添加修饰键，或使用其他按键",
                    )
                    unreachable.append(unreachable_item)
                
                # 导航键作为主键（没有修饰键）可能会导致意外触发
                elif modifier_count == 0 and main_key in ["esc", "tab", "enter", "backspace", "delete"]:
                    unreachable_item = UnreachableShortcut(
                        shortcut_id=shortcut.id,
                        application_id=shortcut.application_id,
                        key_string=str(key),
                        reason="invalid_combination",
                        description=f"快捷键 {str(key)} ('{shortcut.name}') 使用了导航键 {main_key.upper()} 作为主键且无修饰键，可能会意外触发",
                        modifiers=key.modifiers,
                        key=key.key,
                        severity=ConflictSeverity.LOW.value,
                        suggestion="建议添加修饰键以防止意外触发",
                    )
                    unreachable.append(unreachable_item)
        
        return unreachable
    
    def _detect_invalid_keys(
        self,
        shortcuts: List[Shortcut]
    ) -> List[UnreachableShortcut]:
        """检测无效的键（不在标准键盘上）"""
        unreachable = []
        
        # 标准键盘上的有效键
        valid_keys = (
            self.left_hand_keys | self.right_hand_keys |
            {"space", "tab", "enter", "esc", "backspace", "delete",
             "insert", "home", "end", "pageup", "pagedown",
             "up", "down", "left", "right",
             "num0", "num1", "num2", "num3", "num4", "num5", "num6", "num7", "num8", "num9",
             "num*", "num+", "num-", "num.", "num/", "numlock"}
        )
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key = shortcut.primary_key
            main_key = key.key.lower()
            
            # 检查是否是有效的键
            if main_key not in valid_keys and not main_key.isalpha():
                # 允许字母键（可能是自定义的）
                # 但不允许看起来无效的键
                
                # 检查是否是单个字符的字母或数字
                if len(main_key) == 1 and (main_key.isalpha() or main_key.isdigit()):
                    # 可能是有效的自定义键
                    continue
                
                # 无效的键
                unreachable_item = UnreachableShortcut(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    key_string=str(key),
                    reason="invalid_key",
                    description=f"快捷键 {str(key)} ('{shortcut.name}') 使用了无效的键 '{main_key}'，可能无法在标准键盘上触发",
                    modifiers=key.modifiers,
                    key=key.key,
                    severity=ConflictSeverity.HIGH.value,
                    suggestion="建议使用标准键盘上的有效键",
                )
                unreachable.append(unreachable_item)
        
        return unreachable
