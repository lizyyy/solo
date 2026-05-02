"""冲突检测器 - 检测快捷键冲突"""

from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from src.rules.rule_engine import BaseRule, RuleResult
from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
)


class ConflictDetector(BaseRule):
    """冲突检测器"""
    
    def __init__(self):
        super().__init__()
        self.rule_name = "冲突检测器"
        self.rule_description = "检测快捷键冲突，包括同一组合键被多个软件使用、系统保留键覆盖等"
        
        # 系统保留键（跨平台）
        self.system_reserved_keys_mac = {
            "Cmd+Tab", "Cmd+Q", "Cmd+W", "Cmd+H", "Cmd+M",
            "Cmd+Space", "Cmd+Option+Esc",
            "Ctrl+Cmd+Q", "Ctrl+Cmd+Eject",
            "Cmd+Option+D", "Cmd+F1", "Cmd+F2",
        }
        
        self.system_reserved_keys_windows = {
            "Win+Tab", "Win+D", "Win+E", "Win+R", "Win+L",
            "Alt+F4", "Ctrl+Alt+Del",
            "Win+PrntScrn", "Win+Shift+S",
            "Ctrl+Shift+Esc",
        }
        
        # 常见的浏览器保留键
        self.browser_reserved_keys = {
            "Cmd+T", "Cmd+N", "Cmd+W", "Cmd+Q",
            "Ctrl+T", "Ctrl+N", "Ctrl+W", "Ctrl+Q",
            "Cmd+L", "Ctrl+L",  # 地址栏
            "Cmd+R", "Ctrl+R", "F5",  # 刷新
            "Cmd+Shift+N", "Ctrl+Shift+N",  # 无痕/新窗口
        }
    
    def execute(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context],
        **kwargs
    ) -> RuleResult:
        """执行冲突检测"""
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description,
        )
        
        try:
            # 过滤掉没有主键的快捷键
            valid_shortcuts = [s for s in shortcuts if s.primary_key]
            result.total_checked = len(valid_shortcuts)
            
            # 1. 检测同一组合键被多个快捷键使用
            same_key_conflicts = self._detect_same_key_conflicts(
                valid_shortcuts, applications, contexts
            )
            result.conflicts.extend(same_key_conflicts)
            
            # 2. 检测系统保留键
            system_conflicts = self._detect_system_reserved_conflicts(
                valid_shortcuts, applications
            )
            result.conflicts.extend(system_conflicts)
            
            # 3. 检测用户标记的保留键
            user_reserved_conflicts = self._detect_user_reserved_conflicts(
                valid_shortcuts, applications
            )
            result.conflicts.extend(user_reserved_conflicts)
            
            # 统计问题数量
            result.issues_found = len(result.conflicts)
            
        except Exception as e:
            result.success = False
            result.error_message = str(e)
        
        return result
    
    def _detect_same_key_conflicts(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context]
    ) -> List[Conflict]:
        """检测同一组合键被多个快捷键使用的冲突"""
        conflicts = []
        
        # 按主键分组
        key_to_shortcuts: Dict[str, List[Shortcut]] = defaultdict(list)
        
        for shortcut in shortcuts:
            if shortcut.primary_key:
                key_str = str(shortcut.primary_key)
                key_to_shortcuts[key_str].append(shortcut)
        
        # 找出被多个快捷键使用的键
        for key_str, shortcut_list in key_to_shortcuts.items():
            if len(shortcut_list) > 1:
                # 检查这些快捷键是否来自不同的应用或上下文
                app_ids = set(s.application_id for s in shortcut_list)
                context_ids = set(s.context_id for s in shortcut_list)
                
                # 获取应用名称
                app_names = []
                for s in shortcut_list:
                    app = next((a for a in applications if a.id == s.application_id), None)
                    if app:
                        app_names.append(app.display_name)
                    else:
                        app_names.append(s.application_id[:8] if s.application_id else "Unknown")
                
                # 确定严重程度
                if len(app_ids) > 1:
                    # 跨应用冲突 - 严重
                    severity = ConflictSeverity.CRITICAL.value
                    description = f"快捷键 {key_str} 被 {len(shortcut_list)} 个不同应用的快捷键使用: {', '.join(app_names)}"
                elif len(context_ids) > 1:
                    # 同一应用的不同上下文 - 中等
                    severity = ConflictSeverity.MEDIUM.value
                    description = f"快捷键 {key_str} 被同一应用的不同上下文使用"
                else:
                    # 同一上下文的多个快捷键 - 高
                    severity = ConflictSeverity.HIGH.value
                    description = f"快捷键 {key_str} 被同一上下文的多个快捷键定义使用"
                
                # 创建冲突
                conflict = Conflict(
                    conflict_type=ConflictType.SAME_KEY_CONFLICT.value,
                    severity=severity,
                    description=description,
                    involved_shortcut_ids=[s.id for s in shortcut_list],
                    involved_application_ids=list(app_ids),
                    conflicting_key=key_str,
                    rule_name="SameKeyConflict",
                )
                conflicts.append(conflict)
        
        return conflicts
    
    def _detect_system_reserved_conflicts(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[Conflict]:
        """检测系统保留键冲突"""
        conflicts = []
        
        # 获取目标平台（默认检查所有平台）
        target_platforms = ["mac", "windows"]
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key_str = str(shortcut.primary_key)
            
            # 检查 Mac 保留键
            if "mac" in target_platforms and key_str in self.system_reserved_keys_mac:
                conflict = Conflict(
                    conflict_type=ConflictType.SYSTEM_RESERVED.value,
                    severity=ConflictSeverity.CRITICAL.value,
                    description=f"快捷键 {key_str} 是 macOS 系统保留键，可能被系统覆盖",
                    involved_shortcut_ids=[shortcut.id],
                    involved_application_ids=[shortcut.application_id],
                    conflicting_key=key_str,
                    rule_name="SystemReservedMac",
                )
                conflicts.append(conflict)
            
            # 检查 Windows 保留键
            if "windows" in target_platforms and key_str in self.system_reserved_keys_windows:
                conflict = Conflict(
                    conflict_type=ConflictType.SYSTEM_RESERVED.value,
                    severity=ConflictSeverity.CRITICAL.value,
                    description=f"快捷键 {key_str} 是 Windows 系统保留键，可能被系统覆盖",
                    involved_shortcut_ids=[shortcut.id],
                    involved_application_ids=[shortcut.application_id],
                    conflicting_key=key_str,
                    rule_name="SystemReservedWindows",
                )
                conflicts.append(conflict)
            
            # 检查浏览器保留键
            if key_str in self.browser_reserved_keys:
                # 检查是否是浏览器插件
                app = next((a for a in applications if a.id == shortcut.application_id), None)
                if app and ("browser" in app.name.lower() or "extension" in app.name.lower() or "plugin" in app.name.lower()):
                    conflict = Conflict(
                        conflict_type=ConflictType.SYSTEM_RESERVED.value,
                        severity=ConflictSeverity.HIGH.value,
                        description=f"快捷键 {key_str} 是浏览器保留键，浏览器插件可能无法覆盖",
                        involved_shortcut_ids=[shortcut.id],
                        involved_application_ids=[shortcut.application_id],
                        conflicting_key=key_str,
                        rule_name="BrowserReserved",
                    )
                    conflicts.append(conflict)
        
        return conflicts
    
    def _detect_user_reserved_conflicts(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[Conflict]:
        """检测用户标记的保留键冲突"""
        conflicts = []
        
        # 收集所有用户标记为保留的键
        user_reserved_keys: Dict[str, List[str]] = defaultdict(list)  # key_str -> [app_name, ...]
        
        for app in applications:
            for reserved_key in app.system_reserved_keys:
                user_reserved_keys[reserved_key].append(app.display_name)
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key_str = str(shortcut.primary_key)
            
            if key_str in user_reserved_keys:
                # 检查是否是当前应用自己标记的
                app = next((a for a in applications if a.id == shortcut.application_id), None)
                app_name = app.display_name if app else "Unknown"
                
                if app_name not in user_reserved_keys[key_str]:
                    # 其他应用标记的保留键
                    conflict = Conflict(
                        conflict_type=ConflictType.USER_RESERVED.value,
                        severity=ConflictSeverity.HIGH.value,
                        description=f"快捷键 {key_str} 被其他应用标记为保留键: {', '.join(user_reserved_keys[key_str])}",
                        involved_shortcut_ids=[shortcut.id],
                        involved_application_ids=[shortcut.application_id],
                        conflicting_key=key_str,
                        rule_name="UserReserved",
                    )
                    conflicts.append(conflict)
        
        return conflicts
