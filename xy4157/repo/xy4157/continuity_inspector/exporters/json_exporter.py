"""
JSON 审计包导出器
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from ..models import (
    ProjectData, ContinuityIssue, ScriptNote, CallSheetEntry,
    ShotStatus, IssueCategory, IssueSeverity
)


class JSONExporter:
    """
    导出 JSON 格式的审计包和项目数据
    """
    
    def export(self, project: ProjectData, output_path: str):
        """导出完整的项目数据"""
        self.export_project_data(project, output_path)
    
    def export_project_data(self, project: ProjectData, output_path: str):
        """导出项目数据（用于保存和重新加载）"""
        data = self._project_to_dict(project)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def export_audit(self, project: ProjectData, output_path: str):
        """导出审计包（包含所有审计信息）"""
        audit_data = {
            "audit_version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "project": {
                "name": project.project_name,
                "production_day": project.production_day
            },
            "statistics": self._get_statistics(project),
            "issues": self._issues_to_dicts(project.issues),
            "call_sheet_summary": self._call_sheet_summary(project),
            "script_notes_summary": self._script_notes_summary(project),
            "screenshots_summary": self._screenshots_summary(project),
            "audit_trail": self._audit_to_dicts(project.audit_trail),
            "rules_applied": {
                "costume_rules_count": len(project.costume_rules),
                "prop_rules_count": len(project.prop_rules)
            }
        }
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
    
    def _project_to_dict(self, project: ProjectData) -> Dict[str, Any]:
        """将项目数据转换为字典"""
        return {
            "project_name": project.project_name,
            "production_day": project.production_day,
            "call_sheet_entries": [self._call_sheet_entry_to_dict(e) for e in project.call_sheet_entries],
            "script_notes": [self._script_note_to_dict(n) for n in project.script_notes],
            "screenshots": [self._screenshot_to_dict(s) for s in project.screenshots],
            "costume_rules": [self._costume_rule_to_dict(r) for r in project.costume_rules],
            "prop_rules": [self._prop_rule_to_dict(r) for r in project.prop_rules],
            "issues": self._issues_to_dicts(project.issues),
            "audit_trail": self._audit_to_dicts(project.audit_trail)
        }
    
    def _call_sheet_entry_to_dict(self, entry: CallSheetEntry) -> Dict[str, Any]:
        return {
            "scene_id": entry.scene_id,
            "shot_number": entry.shot_number,
            "description": entry.description,
            "characters": entry.characters,
            "props": entry.props,
            "scheduled_time": entry.scheduled_time,
            "location": entry.location,
            "page_count": entry.page_count
        }
    
    def _script_note_to_dict(self, note: ScriptNote) -> Dict[str, Any]:
        return {
            "scene_id": note.scene_id,
            "shot_number": note.shot_number,
            "take": note.take,
            "status": note.status.value if note.status else None,
            "characters": note.characters,
            "costumes": note.costumes,
            "props": note.props,
            "notes": note.notes,
            "shot_date": note.shot_date,
            "camera_angle": note.camera_angle,
            "lens": note.lens,
            "duration": note.duration
        }
    
    def _screenshot_to_dict(self, screenshot) -> Dict[str, Any]:
        return {
            "file_path": screenshot.file_path,
            "scene_id": screenshot.scene_id,
            "shot_number": screenshot.shot_number,
            "take": screenshot.take,
            "timestamp": screenshot.timestamp
        }
    
    def _costume_rule_to_dict(self, rule) -> Dict[str, Any]:
        return {
            "character": rule.character,
            "scene_id": rule.scene_id,
            "description": rule.description,
            "accessories": rule.accessories,
            "notes": rule.notes
        }
    
    def _prop_rule_to_dict(self, prop) -> Dict[str, Any]:
        return {
            "prop_name": prop.prop_name,
            "scene_id": prop.scene_id,
            "required": prop.required,
            "state": prop.state,
            "notes": prop.notes
        }
    
    def _issues_to_dicts(self, issues: List[ContinuityIssue]) -> List[Dict[str, Any]]:
        result = []
        for issue in issues:
            result.append({
                "issue_id": issue.issue_id,
                "category": issue.category.value,
                "severity": issue.severity.value,
                "scene_id": issue.scene_id,
                "shot_number": issue.shot_number,
                "description": issue.description,
                "details": issue.details,
                "related_shots": issue.related_shots,
                "approved": issue.approved,
                "approval_notes": issue.approval_notes,
                "approved_by": issue.approved_by,
                "approved_at": issue.approved_at
            })
        return result
    
    def _audit_to_dicts(self, audit_trail) -> List[Dict[str, Any]]:
        result = []
        for entry in audit_trail:
            result.append({
                "action": entry.action,
                "timestamp": entry.timestamp,
                "user": entry.user,
                "details": entry.details
            })
        return result
    
    def _get_statistics(self, project: ProjectData) -> Dict[str, Any]:
        from collections import defaultdict
        
        total = len(project.issues)
        approved = sum(1 for i in project.issues if i.approved)
        pending = total - approved
        
        by_category = defaultdict(lambda: {"total": 0, "approved": 0, "pending": 0})
        by_severity = defaultdict(lambda: {"total": 0, "approved": 0, "pending": 0})
        
        for issue in project.issues:
            cat = issue.category.value
            sev = issue.severity.value
            
            by_category[cat]["total"] += 1
            by_severity[sev]["total"] += 1
            
            if issue.approved:
                by_category[cat]["approved"] += 1
                by_severity[sev]["approved"] += 1
            else:
                by_category[cat]["pending"] += 1
                by_severity[sev]["pending"] += 1
        
        return {
            "total_issues": total,
            "approved": approved,
            "pending": pending,
            "by_category": dict(by_category),
            "by_severity": dict(by_severity)
        }
    
    def _call_sheet_summary(self, project: ProjectData) -> Dict[str, Any]:
        from collections import defaultdict
        
        scenes = defaultdict(int)
        for entry in project.call_sheet_entries:
            scenes[entry.scene_id] += 1
        
        return {
            "total_entries": len(project.call_sheet_entries),
            "unique_scenes": len(scenes),
            "scenes": dict(scenes)
        }
    
    def _script_notes_summary(self, project: ProjectData) -> Dict[str, Any]:
        from collections import defaultdict
        
        status_counts = defaultdict(int)
        scenes = defaultdict(int)
        
        for note in project.script_notes:
            status_counts[note.status.value if note.status else '未知'] += 1
            scenes[note.scene_id] += 1
        
        return {
            "total_notes": len(project.script_notes),
            "by_status": dict(status_counts),
            "unique_scenes": len(scenes)
        }
    
    def _screenshots_summary(self, project: ProjectData) -> Dict[str, Any]:
        from collections import defaultdict
        
        scenes = defaultdict(int)
        for screenshot in project.screenshots:
            if screenshot.scene_id:
                scenes[screenshot.scene_id] += 1
        
        return {
            "total_screenshots": len(project.screenshots),
            "unique_scenes": len(scenes)
        }
