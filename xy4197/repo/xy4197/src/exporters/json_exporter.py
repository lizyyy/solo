"""JSON导出器 - 导出审计包"""

from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
import json
import hashlib

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)
from src.rules.rule_engine import AnalysisResult, RuleResult
from src.storage.session_storage import Session, MigrationPlan


class JSONExporter:
    """JSON审计包导出器"""
    
    def export_audit(
        self,
        session: Session,
        analysis_result: Optional[Dict[str, Any]] = None,
        migration_plan: Optional[MigrationPlan] = None,
        export_path: str = "audit_package.json",
        include_all_shortcuts: bool = True,
    ) -> str:
        """导出完整审计包"""
        audit_package = {
            "metadata": {
                "export_version": "1.0",
                "export_time": datetime.now().isoformat(),
                "session_name": session.session_name,
                "session_id": session.session_id,
            },
            "summary": self._build_summary(session, analysis_result, migration_plan),
        }
        
        # 应用和快捷键数据
        if include_all_shortcuts:
            audit_package["applications"] = session.applications
            audit_package["contexts"] = session.contexts
            audit_package["shortcuts"] = session.shortcuts
        
        # 分析结果
        if analysis_result:
            audit_package["analysis"] = {
                "conflicts": analysis_result.get("conflicts", []),
                "platform_differences": analysis_result.get("platform_differences", []),
                "unreachable_shortcuts": analysis_result.get("unreachable_shortcuts", []),
                "duplicate_macros": analysis_result.get("duplicate_macros", []),
                "summary": analysis_result.get("summary", {}),
            }
        
        # 迁移方案
        if migration_plan:
            audit_package["migration_plan"] = migration_plan.to_dict()
        
        # 生成校验和
        audit_package["checksum"] = self._generate_checksum(audit_package)
        
        # 写入文件
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
        
        return export_path
    
    def export_conflicts_only(
        self,
        session: Session,
        analysis_result: Optional[Dict[str, Any]] = None,
        export_path: str = "conflicts.json",
    ) -> str:
        """仅导出冲突数据"""
        conflicts_data = {
            "metadata": {
                "export_version": "1.0",
                "export_time": datetime.now().isoformat(),
                "session_name": session.session_name,
            },
            "conflicts": [],
            "platform_differences": [],
            "unreachable_shortcuts": [],
            "duplicate_macros": [],
        }
        
        if analysis_result:
            # 冲突
            for conflict in analysis_result.get("conflicts", []):
                enriched = self._enrich_conflict(session, conflict)
                conflicts_data["conflicts"].append(enriched)
            
            # 平台差异
            for diff in analysis_result.get("platform_differences", []):
                enriched = self._enrich_platform_diff(session, diff)
                conflicts_data["platform_differences"].append(enriched)
            
            # 不可达组合
            for item in analysis_result.get("unreachable_shortcuts", []):
                enriched = self._enrich_unreachable(session, item)
                conflicts_data["unreachable_shortcuts"].append(enriched)
            
            # 重复宏
            for item in analysis_result.get("duplicate_macros", []):
                enriched = self._enrich_duplicate(session, item)
                conflicts_data["duplicate_macros"].append(enriched)
        
        # 统计
        conflicts_data["summary"] = {
            "total_conflicts": len(conflicts_data["conflicts"]),
            "total_platform_differences": len(conflicts_data["platform_differences"]),
            "total_unreachable": len(conflicts_data["unreachable_shortcuts"]),
            "total_duplicate_macros": len(conflicts_data["duplicate_macros"]),
        }
        
        # 写入文件
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(conflicts_data, f, ensure_ascii=False, indent=2)
        
        return export_path
    
    def _build_summary(
        self,
        session: Session,
        analysis_result: Optional[Dict[str, Any]] = None,
        migration_plan: Optional[MigrationPlan] = None,
    ) -> Dict[str, Any]:
        """构建摘要信息"""
        summary = {
            "applications": {
                "total": len(session.applications),
                "by_type": self._count_by_type(session.applications),
            },
            "shortcuts": {
                "total": len(session.shortcuts),
                "by_application": self._count_by_application(session.shortcuts, session.applications),
            },
        }
        
        if analysis_result:
            summary["issues"] = {
                "conflicts": len(analysis_result.get("conflicts", [])),
                "platform_differences": len(analysis_result.get("platform_differences", [])),
                "unreachable": len(analysis_result.get("unreachable_shortcuts", [])),
                "duplicate_macros": len(analysis_result.get("duplicate_macros", [])),
                "by_severity": self._count_by_severity(analysis_result),
            }
        
        if migration_plan:
            summary["migration"] = {
                "modified": migration_plan.total_modified,
                "kept": migration_plan.total_kept,
                "ignored": migration_plan.total_ignored,
                "target_platform": migration_plan.target_platform,
            }
        
        return summary
    
    def _count_by_type(self, applications: List[Dict[str, Any]]) -> Dict[str, int]:
        """按类型统计应用"""
        counts = {}
        for app in applications:
            app_type = app.get("app_type", "unknown")
            counts[app_type] = counts.get(app_type, 0) + 1
        return counts
    
    def _count_by_application(
        self,
        shortcuts: List[Dict[str, Any]],
        applications: List[Dict[str, Any]],
    ) -> Dict[str, int]:
        """按应用统计快捷键"""
        app_map = {app.get("id"): app.get("name", "未知") for app in applications}
        
        counts = {}
        for shortcut in shortcuts:
            app_id = shortcut.get("application_id", "")
            app_name = app_map.get(app_id, "未知")
            counts[app_name] = counts.get(app_name, 0) + 1
        return counts
    
    def _count_by_severity(self, analysis_result: Dict[str, Any]) -> Dict[str, int]:
        """按严重程度统计"""
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        
        for conflict in analysis_result.get("conflicts", []):
            severity = conflict.get("severity", "medium")
            if severity in counts:
                counts[severity] += 1
        
        return counts
    
    def _enrich_conflict(
        self,
        session: Session,
        conflict: Dict[str, Any],
    ) -> Dict[str, Any]:
        """丰富冲突数据"""
        enriched = dict(conflict)
        
        # 添加涉及的快捷键详情
        affected_details = []
        for shortcut_id in conflict.get("affected_shortcuts", []):
            shortcut = self._find_shortcut(session, shortcut_id)
            if shortcut:
                affected_details.append({
                    "id": shortcut_id,
                    "key": shortcut.get("key", ""),
                    "command": shortcut.get("command", ""),
                    "application": self._get_app_name(session, shortcut.get("application_id", "")),
                })
        
        enriched["affected_details"] = affected_details
        
        return enriched
    
    def _enrich_platform_diff(
        self,
        session: Session,
        diff: Dict[str, Any],
    ) -> Dict[str, Any]:
        """丰富平台差异数据"""
        enriched = dict(diff)
        
        shortcut_id = diff.get("shortcut_id", "")
        shortcut = self._find_shortcut(session, shortcut_id)
        
        if shortcut:
            enriched["shortcut_details"] = {
                "key": shortcut.get("key", ""),
                "command": shortcut.get("command", ""),
                "application": self._get_app_name(session, shortcut.get("application_id", "")),
            }
        
        return enriched
    
    def _enrich_unreachable(
        self,
        session: Session,
        item: Dict[str, Any],
    ) -> Dict[str, Any]:
        """丰富不可达组合数据"""
        enriched = dict(item)
        
        shortcut_id = item.get("shortcut_id", "")
        shortcut = self._find_shortcut(session, shortcut_id)
        
        if shortcut:
            enriched["shortcut_details"] = {
                "key": shortcut.get("key", ""),
                "command": shortcut.get("command", ""),
                "application": self._get_app_name(session, shortcut.get("application_id", "")),
            }
        
        return enriched
    
    def _enrich_duplicate(
        self,
        session: Session,
        item: Dict[str, Any],
    ) -> Dict[str, Any]:
        """丰富重复宏数据"""
        enriched = dict(item)
        
        # 添加涉及的快捷键详情
        shortcut_details = []
        for shortcut_id in item.get("shortcuts", []):
            shortcut = self._find_shortcut(session, shortcut_id)
            if shortcut:
                shortcut_details.append({
                    "id": shortcut_id,
                    "key": shortcut.get("key", ""),
                    "command": shortcut.get("command", ""),
                    "application": self._get_app_name(session, shortcut.get("application_id", "")),
                })
        
        enriched["shortcut_details"] = shortcut_details
        
        return enriched
    
    def _find_shortcut(self, session: Session, shortcut_id: str) -> Optional[Dict[str, Any]]:
        """查找快捷键"""
        for shortcut in session.shortcuts:
            if shortcut.get("id") == shortcut_id:
                return shortcut
        return None
    
    def _get_app_name(self, session: Session, app_id: str) -> str:
        """获取应用名称"""
        for app in session.applications:
            if app.get("id") == app_id:
                return app.get("name", "未知")
        return "未知"
    
    def _generate_checksum(self, data: Dict[str, Any]) -> str:
        """生成校验和"""
        # 移除已有的校验和字段
        checksum_data = {k: v for k, v in data.items() if k != "checksum"}
        
        # 生成稳定的JSON字符串
        json_str = json.dumps(checksum_data, sort_keys=True, ensure_ascii=False)
        
        # 计算MD5
        return hashlib.md5(json_str.encode('utf-8')).hexdigest()
    
    def validate_audit(self, audit_path: str) -> Dict[str, Any]:
        """验证审计包完整性"""
        try:
            with open(audit_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 检查校验和
            stored_checksum = data.get("checksum", "")
            if not stored_checksum:
                return {"valid": False, "error": "缺少校验和"}
            
            # 重新计算校验和
            checksum_data = {k: v for k, v in data.items() if k != "checksum"}
            json_str = json.dumps(checksum_data, sort_keys=True, ensure_ascii=False)
            calculated = hashlib.md5(json_str.encode('utf-8')).hexdigest()
            
            if calculated != stored_checksum:
                return {"valid": False, "error": "校验和不匹配，数据可能已被修改"}
            
            return {
                "valid": True,
                "metadata": data.get("metadata", {}),
                "summary": data.get("summary", {}),
            }
            
        except Exception as e:
            return {"valid": False, "error": str(e)}
