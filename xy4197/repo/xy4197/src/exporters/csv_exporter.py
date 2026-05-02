"""CSV导出器 - 导出冲突表"""

from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
import csv
import io

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)
from src.rules.rule_engine import AnalysisResult, RuleResult
from src.storage.session_storage import Session, MigrationPlan


class CSVExporter:
    """CSV冲突表导出器"""
    
    def export_conflicts(
        self,
        session: Session,
        analysis_result: Optional[Dict[str, Any]] = None,
        export_path: str = "conflicts.csv",
    ) -> str:
        """导出冲突表"""
        rows = []
        
        # 表头
        headers = [
            "冲突类型",
            "严重程度",
            "快捷键",
            "涉及应用",
            "涉及命令",
            "描述",
            "解决方案",
            "状态",
        ]
        rows.append(headers)
        
        # 冲突数据
        if analysis_result:
            # 普通冲突
            conflicts = analysis_result.get("conflicts", [])
            for conflict in conflicts:
                row = self._build_conflict_row(session, conflict, "冲突")
                rows.append(row)
            
            # 平台差异
            platform_diffs = analysis_result.get("platform_differences", [])
            for diff in platform_diffs:
                row = self._build_platform_diff_row(session, diff)
                rows.append(row)
            
            # 不可达组合
            unreachable = analysis_result.get("unreachable_shortcuts", [])
            for item in unreachable:
                row = self._build_unreachable_row(session, item)
                rows.append(row)
            
            # 重复宏
            duplicates = analysis_result.get("duplicate_macros", [])
            for item in duplicates:
                row = self._build_duplicate_row(session, item)
                rows.append(row)
        
        # 写入文件
        with open(export_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return export_path
    
    def export_shortcuts(
        self,
        session: Session,
        export_path: str = "shortcuts.csv",
    ) -> str:
        """导出所有快捷键列表"""
        rows = []
        
        # 表头
        headers = [
            "应用",
            "上下文",
            "快捷键",
            "命令",
            "平台",
            "状态",
        ]
        rows.append(headers)
        
        # 快捷键数据
        for shortcut in session.shortcuts:
            app = self._find_application(session, shortcut.get("application_id", ""))
            ctx = self._find_context(session, shortcut.get("context_id", ""))
            
            app_name = app.get("name", "未知") if app else "未知"
            ctx_name = ctx.get("name", "默认") if ctx else "默认"
            
            row = [
                app_name,
                ctx_name,
                shortcut.get("key", ""),
                shortcut.get("command", ""),
                shortcut.get("platform", "all"),
                "正常",
            ]
            rows.append(row)
        
        # 写入文件
        with open(export_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return export_path
    
    def export_migration_plan(
        self,
        session: Session,
        migration_plan: MigrationPlan,
        export_path: str = "migration_plan.csv",
    ) -> str:
        """导出迁移方案"""
        rows = []
        
        # 表头
        headers = [
            "原快捷键",
            "新快捷键",
            "命令",
            "应用",
            "原因",
            "用户决策",
        ]
        rows.append(headers)
        
        # 改键映射
        for original_key, mapping in migration_plan.key_mappings.items():
            new_key = mapping.get("new_key", "")
            shortcut_id = mapping.get("shortcut_id", "")
            reason = mapping.get("reason", "")
            
            shortcut = self._find_shortcut(session, shortcut_id)
            command = shortcut.get("command", "未知") if shortcut else "未知"
            
            app = self._find_application(session, shortcut.get("application_id", "") if shortcut else "")
            app_name = app.get("name", "未知") if app else "未知"
            
            row = [
                original_key,
                new_key,
                command,
                app_name,
                reason,
                "改键",
            ]
            rows.append(row)
        
        # 用户决策
        for shortcut_id, decision in migration_plan.user_decisions.items():
            shortcut = self._find_shortcut(session, shortcut_id)
            if not shortcut:
                continue
            
            key = shortcut.get("key", "未知")
            command = shortcut.get("command", "未知")
            
            app = self._find_application(session, shortcut.get("application_id", ""))
            app_name = app.get("name", "未知") if app else "未知"
            
            action = decision.get("action", "")
            action_display = {
                "keep": "保留",
                "remap": "改键",
                "ignore": "忽略",
            }.get(action, action)
            
            # 如果已经在改键映射中，跳过
            if key in migration_plan.key_mappings:
                continue
            
            row = [
                key,
                "",
                command,
                app_name,
                decision.get("notes", ""),
                action_display,
            ]
            rows.append(row)
        
        # 写入文件
        with open(export_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return export_path
    
    def _build_conflict_row(
        self,
        session: Session,
        conflict: Dict[str, Any],
        base_type: str,
    ) -> List[str]:
        """构建冲突行"""
        key = conflict.get("key", "未知")
        severity = self._format_severity(conflict.get("severity", "medium"))
        conflict_type = self._format_conflict_type(conflict.get("conflict_type", "unknown"))
        
        # 涉及的应用和命令
        affected = conflict.get("affected_shortcuts", [])
        apps = []
        commands = []
        
        for shortcut_id in affected:
            shortcut = self._find_shortcut(session, shortcut_id)
            if shortcut:
                app = self._find_application(session, shortcut.get("application_id", ""))
                app_name = app.get("name", "未知") if app else "未知"
                apps.append(app_name)
                commands.append(f"{shortcut.get('command', '?')}")
        
        return [
            f"{base_type}: {conflict_type}",
            severity,
            key,
            ", ".join(apps),
            "; ".join(commands),
            conflict.get("description", ""),
            "",
            "待解决",
        ]
    
    def _build_platform_diff_row(
        self,
        session: Session,
        diff: Dict[str, Any],
    ) -> List[str]:
        """构建平台差异行"""
        shortcut_id = diff.get("shortcut_id", "")
        shortcut = self._find_shortcut(session, shortcut_id)
        
        key = shortcut.get("key", "未知") if shortcut else "未知"
        command = shortcut.get("command", "未知") if shortcut else "未知"
        
        app = self._find_application(session, shortcut.get("application_id", "") if shortcut else "")
        app_name = app.get("name", "未知") if app else "未知"
        
        issue_type = self._format_platform_issue(diff.get("issue_type", "unknown"))
        mac_key = diff.get("mac_key", "")
        win_key = diff.get("win_key", "")
        
        return [
            f"平台差异: {issue_type}",
            "中",
            key,
            app_name,
            command,
            f"Mac: {mac_key or '无'}, Windows: {win_key or '无'}",
            "",
            "待解决",
        ]
    
    def _build_unreachable_row(
        self,
        session: Session,
        item: Dict[str, Any],
    ) -> List[str]:
        """构建不可达组合行"""
        shortcut_id = item.get("shortcut_id", "")
        shortcut = self._find_shortcut(session, shortcut_id)
        
        key = shortcut.get("key", "未知") if shortcut else "未知"
        command = shortcut.get("command", "未知") if shortcut else "未知"
        
        app = self._find_application(session, shortcut.get("application_id", "") if shortcut else "")
        app_name = app.get("name", "未知") if app else "未知"
        
        reason = item.get("reason", "")
        details = item.get("details", {})
        
        detail_parts = []
        if details.get("too_many_modifiers"):
            detail_parts.append(f"修饰键过多 ({details.get('modifier_count', 0)})")
        if details.get("same_hand_conflict"):
            detail_parts.append("同手冲突")
        if details.get("invalid_combination"):
            detail_parts.append("无效组合")
        
        description = reason
        if detail_parts:
            description += f" ({', '.join(detail_parts)})"
        
        return [
            "不可达组合",
            "高",
            key,
            app_name,
            command,
            description,
            "",
            "待解决",
        ]
    
    def _build_duplicate_row(
        self,
        session: Session,
        item: Dict[str, Any],
    ) -> List[str]:
        """构建重复宏行"""
        macro_id = item.get("macro_id", "")
        shortcuts = item.get("shortcuts", [])
        is_exact = item.get("is_exact", False)
        similarity = item.get("similarity", 0)
        
        apps = []
        commands = []
        keys = []
        
        for shortcut_id in shortcuts:
            shortcut = self._find_shortcut(session, shortcut_id)
            if shortcut:
                app = self._find_application(session, shortcut.get("application_id", ""))
                app_name = app.get("name", "未知") if app else "未知"
                apps.append(app_name)
                commands.append(f"{shortcut.get('command', '?')}")
                keys.append(shortcut.get("key", "?"))
        
        conflict_type = "完全相同宏" if is_exact else f"相似宏 ({similarity*100:.0f}%)"
        
        return [
            f"重复宏: {conflict_type}",
            "中" if is_exact else "低",
            ", ".join(keys),
            ", ".join(apps),
            "; ".join(commands),
            f"宏ID: {macro_id}",
            "",
            "待解决",
        ]
    
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
    
    def _find_context(self, session: Session, ctx_id: str) -> Optional[Dict[str, Any]]:
        """查找上下文"""
        for ctx in session.contexts:
            if ctx.get("id") == ctx_id:
                return ctx
        return None
    
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
            "same_key": "同一组合键",
            "system_reserved": "系统保留",
            "user_reserved": "用户保留",
            "partial_match": "部分匹配",
        }
        return names.get(conflict_type, conflict_type)
    
    def _format_platform_issue(self, issue_type: str) -> str:
        """格式化平台问题"""
        names = {
            "platform_specific": "平台特定",
            "modifier_mapping_issue": "修饰键映射",
            "platform_exclusive_key": "平台独有",
            "cross_platform_binding": "跨平台差异",
        }
        return names.get(issue_type, issue_type)
