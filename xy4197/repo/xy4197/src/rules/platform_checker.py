"""平台差异检查器 - 检测 Mac/Windows/Linux 平台差异"""

from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from src.rules.rule_engine import BaseRule, RuleResult
from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference,
)


class PlatformChecker(BaseRule):
    """平台差异检查器"""
    
    def __init__(self):
        super().__init__()
        self.rule_name = "平台差异检查器"
        self.rule_description = "检测 Mac/Windows/Linux 平台之间的快捷键差异，包括修饰键映射差异等"
        
        # 修饰键平台映射
        self.modifier_mappings = {
            # Mac -> Windows
            "Cmd": "Ctrl",
            "Ctrl": "Win",  # Mac Ctrl -> Windows Win
            "Option": "Alt",
            # Windows -> Mac
            "Ctrl": "Cmd",
            "Win": "Ctrl",
            "Alt": "Option",
        }
        
        # 常见的平台特定快捷键问题
        self.platform_specific_issues = {
            # Mac 独有的组合
            "mac_only": [
                "Cmd+Option+Esc",  # 强制退出
                "Ctrl+Cmd+Q",      # 锁定屏幕
                "Cmd+Space",       # Spotlight
            ],
            # Windows 独有的组合
            "windows_only": [
                "Win+Tab",         # 任务切换
                "Win+D",           # 显示桌面
                "Win+E",           # 文件资源管理器
                "Ctrl+Alt+Del",    # 安全选项
            ],
        }
    
    def execute(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application],
        contexts: List[Context],
        **kwargs
    ) -> RuleResult:
        """执行平台差异检测"""
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description,
        )
        
        try:
            # 过滤掉没有主键的快捷键
            valid_shortcuts = [s for s in shortcuts if s.primary_key]
            result.total_checked = len(valid_shortcuts)
            
            # 1. 检测平台特定的快捷键（只在一个平台上定义）
            platform_specific = self._detect_platform_specific_shortcuts(
                valid_shortcuts, applications
            )
            result.platform_differences.extend(platform_specific)
            
            # 2. 检测修饰键映射问题（跨平台不兼容）
            modifier_issues = self._detect_modifier_mapping_issues(
                valid_shortcuts, applications
            )
            result.platform_differences.extend(modifier_issues)
            
            # 3. 检测平台独有的快捷键（不可移植）
            platform_exclusive = self._detect_platform_exclusive_shortcuts(
                valid_shortcuts, applications
            )
            result.platform_differences.extend(platform_exclusive)
            
            # 4. 检测同一应用内同一功能在不同平台的不同绑定
            cross_platform_conflicts = self._detect_cross_platform_binding_differences(
                valid_shortcuts, applications
            )
            result.platform_differences.extend(cross_platform_conflicts)
            
            # 统计问题数量
            result.issues_found = len(result.platform_differences)
            
        except Exception as e:
            result.success = False
            result.error_message = str(e)
        
        return result
    
    def _detect_platform_specific_shortcuts(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[PlatformDifference]:
        """检测平台特定的快捷键（只在一个平台上定义）"""
        differences = []
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            if shortcut.is_platform_specific:
                key_str = str(shortcut.primary_key)
                
                # 检查应用是否支持多平台
                app = next((a for a in applications if a.id == shortcut.application_id), None)
                app_name = app.display_name if app else "Unknown"
                
                if app and len(app.supported_platforms) > 1:
                    # 应用支持多平台，但快捷键只定义了一个平台
                    difference = PlatformDifference(
                        shortcut_id=shortcut.id,
                        application_id=shortcut.application_id,
                        difference_type="missing",
                        description=f"快捷键 {key_str} ('{shortcut.name}') 只在 {shortcut.platform} 平台定义，但应用 {app_name} 支持多平台",
                        severity=ConflictSeverity.MEDIUM.value,
                        suggestion=f"建议为其他平台定义等效的快捷键，例如将 Cmd 替换为 Ctrl",
                    )
                    
                    if shortcut.platform == "mac":
                        difference.mac_key = key_str
                    elif shortcut.platform == "windows":
                        difference.windows_key = key_str
                    elif shortcut.platform == "linux":
                        difference.linux_key = key_str
                    
                    differences.append(difference)
        
        return differences
    
    def _detect_modifier_mapping_issues(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[PlatformDifference]:
        """检测修饰键映射问题（跨平台不兼容）"""
        differences = []
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key = shortcut.primary_key
            modifiers = key.modifiers
            
            # 检查是否使用了平台特定的修饰键
            has_mac_modifier = "Cmd" in modifiers
            has_windows_modifier = "Win" in modifiers
            
            if has_mac_modifier or has_windows_modifier:
                key_str = str(key)
                
                # 生成等效的其他平台快捷键
                if "Cmd" in modifiers:
                    # Mac Cmd -> Windows Ctrl
                    win_modifiers = [m if m != "Cmd" else "Ctrl" for m in modifiers]
                    win_key = ShortcutKey(key.key, win_modifiers)
                    
                    # Windows Win -> Mac Ctrl
                    mac_modifiers = [m if m != "Win" else "Ctrl" for m in modifiers]
                    mac_key = ShortcutKey(key.key, mac_modifiers)
                    
                    app = next((a for a in applications if a.id == shortcut.application_id), None)
                    
                    difference = PlatformDifference(
                        shortcut_id=shortcut.id,
                        application_id=shortcut.application_id,
                        difference_type="modifier_difference",
                        mac_key=key_str if "Cmd" in modifiers else str(mac_key),
                        windows_key=str(win_key),
                        description=f"快捷键 {key_str} ('{shortcut.name}') 使用了平台特定修饰键，跨平台需要转换",
                        severity=ConflictSeverity.MEDIUM.value,
                        suggestion=f"Mac: {key_str} -> Windows: {str(win_key)}",
                    )
                    differences.append(difference)
            
            # 检查是否同时使用了 Cmd 和 Ctrl（常见的跨平台混乱）
            if "Cmd" in modifiers and "Ctrl" in modifiers:
                key_str = str(key)
                difference = PlatformDifference(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    difference_type="modifier_conflict",
                    description=f"快捷键 {key_str} ('{shortcut.name}') 同时使用了 Cmd 和 Ctrl，这通常是跨平台配置错误",
                    severity=ConflictSeverity.HIGH.value,
                    suggestion="建议为每个平台分别定义快捷键，或使用统一的修饰键方案",
                )
                differences.append(difference)
        
        return differences
    
    def _detect_platform_exclusive_shortcuts(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[PlatformDifference]:
        """检测平台独有的快捷键（不可移植）"""
        differences = []
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            key_str = str(shortcut.primary_key)
            
            # 检查是否是 Mac 独有的
            if key_str in self.platform_specific_issues["mac_only"]:
                difference = PlatformDifference(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    difference_type="platform_exclusive",
                    mac_key=key_str,
                    description=f"快捷键 {key_str} ('{shortcut.name}') 是 macOS 独有的系统快捷键，在 Windows/Linux 上无法使用",
                    severity=ConflictSeverity.HIGH.value,
                    suggestion="建议使用其他组合键以确保跨平台兼容性",
                )
                differences.append(difference)
            
            # 检查是否是 Windows 独有的
            if key_str in self.platform_specific_issues["windows_only"]:
                difference = PlatformDifference(
                    shortcut_id=shortcut.id,
                    application_id=shortcut.application_id,
                    difference_type="platform_exclusive",
                    windows_key=key_str,
                    description=f"快捷键 {key_str} ('{shortcut.name}') 是 Windows 独有的系统快捷键，在 Mac/Linux 上无法使用",
                    severity=ConflictSeverity.HIGH.value,
                    suggestion="建议使用其他组合键以确保跨平台兼容性",
                )
                differences.append(difference)
        
        return differences
    
    def _detect_cross_platform_binding_differences(
        self,
        shortcuts: List[Shortcut],
        applications: List[Application]
    ) -> List[PlatformDifference]:
        """检测同一应用内同一功能在不同平台的不同绑定"""
        differences = []
        
        # 按应用和功能名称分组
        app_function_shortcuts: Dict[str, Dict[str, List[Shortcut]]] = defaultdict(lambda: defaultdict(list))
        
        for shortcut in shortcuts:
            if not shortcut.primary_key:
                continue
            
            app_id = shortcut.application_id
            function_name = shortcut.name or shortcut.action
            
            if function_name:
                app_function_shortcuts[app_id][function_name].append(shortcut)
        
        # 检查同一功能在不同平台的不同绑定
        for app_id, function_map in app_function_shortcuts.items():
            app = next((a for a in applications if a.id == app_id), None)
            app_name = app.display_name if app else "Unknown"
            
            for function_name, shortcut_list in function_map.items():
                if len(shortcut_list) > 1:
                    # 检查这些快捷键是否在不同平台定义
                    platforms = set(s.platform for s in shortcut_list)
                    
                    if len(platforms) > 1 and "all" not in platforms:
                        # 同一功能在不同平台有不同的绑定
                        key_by_platform = {}
                        for s in shortcut_list:
                            if s.primary_key:
                                key_by_platform[s.platform] = str(s.primary_key)
                        
                        mac_key = key_by_platform.get("mac", "")
                        windows_key = key_by_platform.get("windows", "")
                        linux_key = key_by_platform.get("linux", "")
                        
                        # 检查这些键是否是合理的映射
                        is_valid_mapping = self._check_valid_platform_mapping(
                            mac_key, windows_key, linux_key
                        )
                        
                        if not is_valid_mapping:
                            difference = PlatformDifference(
                                shortcut_id=shortcut_list[0].id,
                                application_id=app_id,
                                mac_key=mac_key,
                                windows_key=windows_key,
                                linux_key=linux_key,
                                difference_type="key_difference",
                                description=f"应用 {app_name} 的功能 '{function_name}' 在不同平台使用了不同的快捷键绑定，但这些绑定可能不是标准映射",
                                severity=ConflictSeverity.LOW.value,
                                suggestion="建议检查这些绑定是否遵循标准修饰键映射：Mac Cmd -> Windows Ctrl",
                            )
                            differences.append(difference)
        
        return differences
    
    def _check_valid_platform_mapping(
        self,
        mac_key: str,
        windows_key: str,
        linux_key: str
    ) -> bool:
        """检查平台映射是否有效（标准映射）"""
        # 如果没有足够的信息进行比较，认为是有效的
        if not mac_key or not windows_key:
            return True
        
        # 检查是否是标准的 Cmd <-> Ctrl 映射
        # 例如: Cmd+P -> Ctrl+P 是有效的
        # 但 Cmd+P -> Ctrl+Shift+P 可能不是
        
        try:
            mac_sk = ShortcutKey.from_string(mac_key)
            win_sk = ShortcutKey.from_string(windows_key)
            
            # 检查主键是否相同
            if mac_sk.key != win_sk.key:
                return False
            
            # 检查修饰键映射
            # Mac Cmd 应该映射到 Windows Ctrl
            # Mac Ctrl 应该映射到 Windows Win
            # Mac Option 应该映射到 Windows Alt
            
            mac_modifiers = set(mac_sk.modifiers)
            win_modifiers = set(win_sk.modifiers)
            
            # 转换 Mac 修饰键到 Windows 修饰键
            expected_win_modifiers = set()
            for mod in mac_modifiers:
                if mod == "Cmd":
                    expected_win_modifiers.add("Ctrl")
                elif mod == "Ctrl":
                    expected_win_modifiers.add("Win")
                elif mod == "Option":
                    expected_win_modifiers.add("Alt")
                else:
                    expected_win_modifiers.add(mod)
            
            # 检查是否匹配
            return expected_win_modifiers == win_modifiers
            
        except Exception:
            # 解析失败，认为是无效的
            return False
