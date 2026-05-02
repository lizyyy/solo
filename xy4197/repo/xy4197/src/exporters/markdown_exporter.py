"""Markdown导出器 - 导出迁移单"""

from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
import hashlib

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)
from src.rules.rule_engine import AnalysisResult, RuleResult
from src.storage.session_storage import Session, MigrationPlan


class MarkdownExporter:
    """Markdown迁移单导出器"""
    
    def __init__(self):
        self._severity_symbols = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢",
            "info": "⚪",
        }
    
    def export(
        self,
        session: Session,
        analysis_result: Optional[Dict[str, Any]] = None,
        migration_plan: Optional[MigrationPlan] = None,
        export_path: str = "migration_plan.md",
    ) -> str:
        """导出Markdown迁移单"""
        lines = []
        
        # 标题
        lines.append("# 快捷键迁移方案")
        lines.append("")
        
        # 元数据
        lines.append("## 基本信息")
        lines.append("")
        lines.append(f"- **会话名称**: {session.session_name or '未命名会话'}")
        lines.append(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if migration_plan:
            lines.append(f"- **目标平台**: {self._format_platform(migration_plan.target_platform)}")
            if migration_plan.plan_name:
                lines.append(f"- **方案名称**: {migration_plan.plan_name}")
        
        lines.append("")
        
        # 统计概览
        lines.append("## 统计概览")
        lines.append("")
        lines.append("| 类别 | 数量 |")
        lines.append("|------|------|")
        
        # 快捷键统计
        total_shortcuts = len(session.shortcuts)
        total_applications = len(session.applications)
        lines.append(f"| 快捷键总数 | {total_shortcuts} |")
        lines.append(f"| 涉及应用 | {total_applications} |")
        
        # 问题统计（从分析结果）
        if analysis_result:
            conflict_count = len(analysis_result.get("conflicts", []))
            platform_count = len(analysis_result.get("platform_differences", []))
            unreachable_count = len(analysis_result.get("unreachable_shortcuts", []))
            duplicate_count = len(analysis_result.get("duplicate_macros", []))
            
            lines.append(f"| 冲突数量 | {conflict_count} |")
            lines.append(f"| 平台差异 | {platform_count} |")
            lines.append(f"| 不可达组合 | {unreachable_count} |")
            lines.append(f"| 重复宏 | {duplicate_count} |")
        
        # 迁移方案统计
        if migration_plan:
            lines.append(f"| 已修改 | {migration_plan.total_modified} |")
            lines.append(f"| 已保留 | {migration_plan.total_kept} |")
            lines.append(f"| 已忽略 | {migration_plan.total_ignored} |")
        
        lines.append("")
        
        # 应用列表
        lines.append("## 涉及应用")
        lines.append("")
        
        if session.applications:
            for app in session.applications:
                app_name = app.get("name", "未知应用")
                app_type = app.get("app_type", "unknown")
                shortcut_count = sum(1 for s in session.shortcuts if s.get("application_id") == app.get("id"))
                
                lines.append(f"- **{app_name}**")
                lines.append(f"  - 类型: {self._format_app_type(app_type)}")
                lines.append(f"  - 快捷键: {shortcut_count} 个")
                lines.append("")
        else:
            lines.append("无应用数据")
            lines.append("")
        
        # 冲突详情
        if analysis_result and analysis_result.get("conflicts"):
            lines.append("## 冲突详情")
            lines.append("")
            
            conflicts = analysis_result["conflicts"]
            if conflicts:
                for idx, conflict in enumerate(conflicts, 1):
                    severity = conflict.get("severity", "medium")
                    symbol = self._severity_symbols.get(severity, "⚪")
                    key = conflict.get("key", "未知")
                    conflict_type = conflict.get("conflict_type", "unknown")
                    
                    lines.append(f"### {symbol} 冲突 {idx}: {key}")
                    lines.append("")
                    lines.append(f"- **类型**: {self._format_conflict_type(conflict_type)}")
                    lines.append(f"- **严重程度**: {self._format_severity(severity)}")
                    
                    # 涉及的快捷键
                    affected = conflict.get("affected_shortcuts", [])
                    if affected:
                        lines.append(f"- **涉及快捷键**:")
                        for shortcut_id in affected:
                            shortcut = self._find_shortcut(session, shortcut_id)
                            if shortcut:
                                lines.append(f"  - `{shortcut.get('key', '?')}`: {shortcut.get('command', '?')}")
                    
                    # 解决方案
                    if migration_plan:
                        if key in migration_plan.key_mappings:
                            mapping = migration_plan.key_mappings[key]
                            lines.append(f"- **解决方案**: 修改为 `{mapping['new_key']}`")
                            if mapping.get("reason"):
                                lines.append(f"  - 原因: {mapping['reason']}")
                    
                    lines.append("")
        
        # 平台差异
        if analysis_result and analysis_result.get("platform_differences"):
            lines.append("## 平台差异")
            lines.append("")
            
            platform_diffs = analysis_result["platform_differences"]
            if platform_diffs:
                for idx, diff in enumerate(platform_diffs, 1):
                    shortcut_id = diff.get("shortcut_id", "")
                    shortcut = self._find_shortcut(session, shortcut_id)
                    if not shortcut:
                        continue
                    
                    mac_key = diff.get("mac_key", "")
                    win_key = diff.get("win_key", "")
                    issue_type = diff.get("issue_type", "unknown")
                    
                    lines.append(f"### 差异 {idx}: {shortcut.get('command', '未知命令')}")
                    lines.append("")
                    lines.append(f"- **问题类型**: {self._format_platform_issue(issue_type)}")
                    lines.append(f"- **Mac 绑定**: `{mac_key or '无'}`")
                    lines.append(f"- **Windows 绑定**: `{win_key or '无'}`")
                    
                    if shortcut.get("key"):
                        lines.append(f"- **当前绑定**: `{shortcut['key']}`")
                    
                    lines.append("")
        
        # 不可达组合
        if analysis_result and analysis_result.get("unreachable_shortcuts"):
            lines.append("## 不可达组合")
            lines.append("")
            
            unreachable = analysis_result["unreachable_shortcuts"]
            if unreachable:
                for idx, item in enumerate(unreachable, 1):
                    shortcut_id = item.get("shortcut_id", "")
                    shortcut = self._find_shortcut(session, shortcut_id)
                    if not shortcut:
                        continue
                    
                    key = shortcut.get("key", "未知")
                    reason = item.get("reason", "")
                    details = item.get("details", {})
                    
                    lines.append(f"### {idx}. `{key}`")
                    lines.append("")
                    lines.append(f"- **命令**: {shortcut.get('command', '未知')}")
                    lines.append(f"- **问题**: {reason}")
                    
                    if details:
                        if details.get("too_many_modifiers"):
                            lines.append(f"  - 修饰键数量: {details.get('modifier_count', 0)} 个")
                        if details.get("same_hand_conflict"):
                            lines.append(f"  - 同手冲突: 是")
                        if details.get("invalid_combination"):
                            lines.append(f"  - 无效组合: {details.get('combination_info', '')}")
                    
                    lines.append("")
        
        # 重复宏
        if analysis_result and analysis_result.get("duplicate_macros"):
            lines.append("## 重复宏")
            lines.append("")
            
            duplicates = analysis_result["duplicate_macros"]
            if duplicates:
                for idx, item in enumerate(duplicates, 1):
                    macro_id = item.get("macro_id", "")
                    shortcuts = item.get("shortcuts", [])
                    similarity = item.get("similarity", 0)
                    is_exact = item.get("is_exact", False)
                    
                    lines.append(f"### {idx}. 宏 {macro_id}")
                    lines.append("")
                    lines.append(f"- **重复类型**: {'完全相同' if is_exact else f'相似 ({similarity*100:.0f}%)'}")
                    lines.append(f"- **涉及快捷键**:")
                    
                    for shortcut_id in shortcuts:
                        shortcut = self._find_shortcut(session, shortcut_id)
                        if shortcut:
                            lines.append(f"  - `{shortcut.get('key', '?')}`: {shortcut.get('command', '?')}")
                    
                    lines.append("")
        
        # 改键方案
        if migration_plan and migration_plan.key_mappings:
            lines.append("## 改键方案")
            lines.append("")
            lines.append("| 原快捷键 | 新快捷键 | 命令 | 原因 |")
            lines.append("|----------|----------|------|------|")
            
            for original_key, mapping in migration_plan.key_mappings.items():
                new_key = mapping.get("new_key", "")
                shortcut_id = mapping.get("shortcut_id", "")
                reason = mapping.get("reason", "")
                
                shortcut = self._find_shortcut(session, shortcut_id)
                command = shortcut.get("command", "未知") if shortcut else "未知"
                
                lines.append(f"| `{original_key}` | `{new_key}` | {command} | {reason} |")
            
            lines.append("")
        
        # 用户决策
        if migration_plan and migration_plan.user_decisions:
            lines.append("## 用户决策")
            lines.append("")
            lines.append("| 快捷键 | 命令 | 决策 | 备注 |")
            lines.append("|--------|------|------|------|")
            
            for shortcut_id, decision in migration_plan.user_decisions.items():
                shortcut = self._find_shortcut(session, shortcut_id)
                key = shortcut.get("key", "未知") if shortcut else "未知"
                command = shortcut.get("command", "未知") if shortcut else "未知"
                action = decision.get("action", "")
                notes = decision.get("notes", "")
                
                action_display = {
                    "keep": "保留",
                    "remap": "改键",
                    "ignore": "忽略",
                }.get(action, action)
                
                lines.append(f"| `{key}` | {command} | {action_display} | {notes} |")
            
            lines.append("")
        
        # 保留键
        if migration_plan and migration_plan.reserved_keys:
            lines.append("## 保留键")
            lines.append("")
            lines.append("| 快捷键 | 原因 | 应用 |")
            lines.append("|--------|------|------|")
            
            for key_str, info in migration_plan.reserved_keys.items():
                reason = info.get("reason", "")
                app_id = info.get("application_id", "")
                app = self._find_application(session, app_id)
                app_name = app.get("name", "未知") if app else "未知"
                
                lines.append(f"| `{key_str}` | {reason} | {app_name} |")
            
            lines.append("")
        
        # 备注
        if migration_plan and migration_plan.notes:
            lines.append("## 备注")
            lines.append("")
            lines.append(migration_plan.notes)
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append(f"*由快捷键冲突搬家员生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        # 写入文件
        content = "\n".join(lines)
        with open(export_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return export_path
    
    def _find_shortcut(self, session: Session, shortcut_id: str) -> Optional[Dict[str, Any]]:
        """查找快捷键"""
        for shortcut in session.shortcuts:
            if shortcut.get("id") == shortcut_id:
                return shortcut
        return None
    
    def _find_application(self, session: Session, app_id: str) -> Optional[Dict[str, Any]]:
        """查找应用"""
        for app in session.applications:
            if app.get("id") == app_id:
                return app
        return None
    
    def _format_platform(self, platform: str) -> str:
        """格式化平台名称"""
        names = {
            "mac": "macOS",
            "windows": "Windows",
            "linux": "Linux",
            "all": "全平台",
        }
        return names.get(platform, platform)
    
    def _format_app_type(self, app_type: str) -> str:
        """格式化应用类型"""
        names = {
            "vscode": "VS Code",
            "figma": "Figma",
            "photoshop": "Photoshop",
            "browser_plugin": "浏览器插件",
            "unknown": "未知",
        }
        return names.get(app_type, app_type)
    
    def _format_severity(self, severity: str) -> str:
        """格式化严重程度"""
        names = {
            "critical": "致命",
            "high": "高",
            "medium": "中",
            "low": "低",
            "info": "信息",
        }
        return names.get(severity, severity)
    
    def _format_conflict_type(self, conflict_type: str) -> str:
        """格式化冲突类型"""
        names = {
            "same_key": "同一组合键冲突",
            "system_reserved": "系统保留键",
            "user_reserved": "用户标记保留",
            "partial_match": "部分匹配",
        }
        return names.get(conflict_type, conflict_type)
    
    def _format_platform_issue(self, issue_type: str) -> str:
        """格式化平台问题"""
        names = {
            "platform_specific": "平台特定绑定",
            "modifier_mapping_issue": "修饰键映射问题",
            "platform_exclusive_key": "平台独有键",
            "cross_platform_binding": "跨平台绑定差异",
        }
        return names.get(issue_type, issue_type)
