from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pathlib import Path
import json

from ..storage.project_storage import ProjectData
from ..models.shot import Shot, ShotList, ShotStatus
from ..models.wardrobe import Wardrobe, Prop, WardrobeAnnotation
from ..models.actor import Actor, ActorNote
from ..models.call_sheet import CallSheet
from ..models.reshoot import ReshootRequirement, ReshootStatus
from ..models.check_result import CheckResult, Issue, IssueType, IssueSeverity, IssueStatus
from ..models.override import OverrideNote, OverrideCollection
from ..query.query_engine import QueryEngine


class JsonExporter:
    
    def __init__(self, project_data: ProjectData):
        self.data = project_data
        self.query_engine = QueryEngine(project_data)
    
    def export_audit_report(
        self,
        output_path: Path,
        include_full_data: bool = True,
        include_issues: bool = True,
        include_overrides: bool = True
    ) -> None:
        report = {
            "report_type": "audit",
            "generated_at": datetime.now().isoformat(),
            "project_info": self._get_project_info(),
            "summary": self._get_summary()
        }
        
        if include_full_data:
            report["full_data"] = self._get_full_data()
        
        if include_issues:
            report["issues"] = self._get_issues_data()
        
        if include_overrides:
            report["overrides"] = self._get_overrides_data()
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=self._json_default)
    
    def export_scene_audit(
        self,
        output_path: Path,
        scene_number: str
    ) -> None:
        summary = self.query_engine.get_scene_summary(scene_number)
        
        report = {
            "report_type": "scene_audit",
            "generated_at": datetime.now().isoformat(),
            "scene_number": scene_number,
            "project_info": self._get_project_info(),
            "scene_summary": summary
        }
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=self._json_default)
    
    def export_check_result(
        self,
        output_path: Path,
        check_result: CheckResult
    ) -> None:
        report = {
            "report_type": "check_result",
            "generated_at": datetime.now().isoformat(),
            "check_result": check_result.to_dict()
        }
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=self._json_default)
    
    def _get_project_info(self) -> Dict[str, Any]:
        return {
            "project_id": self.data.project_id,
            "project_name": self.data.project_name,
            "created_at": self.data.created_at.isoformat() if self.data.created_at else None,
            "updated_at": self.data.updated_at.isoformat() if self.data.updated_at else None
        }
    
    def _get_summary(self) -> Dict[str, Any]:
        stats = self.query_engine.get_project_statistics()
        
        return {
            "statistics": stats,
            "critical_issues": [
                {
                    "issue_id": issue["issue_id"],
                    "title": issue["title"],
                    "scene_number": issue["scene_number"]
                }
                for issue in stats.get("critical_issues", [])
            ],
            "high_issues": [
                {
                    "issue_id": issue["issue_id"],
                    "title": issue["title"],
                    "scene_number": issue["scene_number"]
                }
                for issue in stats.get("high_issues", [])
            ]
        }
    
    def _get_full_data(self) -> Dict[str, Any]:
        return {
            "shots": [shot.to_dict() for shot in self.data.shot_list.shots],
            "wardrobe_items": [item.to_dict() for item in self.data.wardrobe_items.values()],
            "prop_items": [item.to_dict() for item in self.data.prop_items.values()],
            "wardrobe_annotations": [ann.to_dict() for ann in self.data.wardrobe_annotations],
            "actors": [actor.to_dict() for actor in self.data.actors.values()],
            "actor_notes": [note.to_dict() for note in self.data.actor_notes],
            "call_sheets": [cs.to_dict() for cs in self.data.call_sheets.values()],
            "reshoots": [r.to_dict() for r in self.data.reshoots],
            "check_results": [cr.to_dict() for cr in self.data.check_results]
        }
    
    def _get_issues_data(self) -> Dict[str, Any]:
        all_issues: List[Dict[str, Any]] = []
        
        for check_result in self.data.check_results:
            for issue in check_result.issues:
                issue_dict = issue.to_dict()
                issue_dict["check_result_id"] = check_result.result_id
                all_issues.append(issue_dict)
        
        by_type: Dict[str, List[Dict[str, Any]]] = {}
        by_severity: Dict[str, List[Dict[str, Any]]] = {}
        by_status: Dict[str, List[Dict[str, Any]]] = {}
        by_scene: Dict[str, List[Dict[str, Any]]] = {}
        
        for issue in all_issues:
            issue_type = issue["issue_type"]
            severity = issue["severity"]
            status = issue["status"]
            scene = issue.get("scene_number", "unknown")
            
            if issue_type not in by_type:
                by_type[issue_type] = []
            by_type[issue_type].append(issue)
            
            if severity not in by_severity:
                by_severity[severity] = []
            by_severity[severity].append(issue)
            
            if status not in by_status:
                by_status[status] = []
            by_status[status].append(issue)
            
            if scene not in by_scene:
                by_scene[scene] = []
            by_scene[scene].append(issue)
        
        return {
            "total_count": len(all_issues),
            "all_issues": all_issues,
            "by_type": by_type,
            "by_severity": by_severity,
            "by_status": by_status,
            "by_scene": by_scene
        }
    
    def _get_overrides_data(self) -> Dict[str, Any]:
        all_overrides = [o.to_dict() for o in self.data.overrides.overrides]
        
        active_overrides = [o.to_dict() for o in self.data.overrides.get_active_overrides()]
        
        by_type: Dict[str, List[Dict[str, Any]]] = {}
        by_issue: Dict[str, List[Dict[str, Any]]] = {}
        by_scene: Dict[str, List[Dict[str, Any]]] = {}
        
        for override in all_overrides:
            override_type = override["override_type"]
            related_issue = override.get("related_issue_id", "none")
            scene = override.get("scene_number", "unknown")
            
            if override_type not in by_type:
                by_type[override_type] = []
            by_type[override_type].append(override)
            
            if related_issue not in by_issue:
                by_issue[related_issue] = []
            by_issue[related_issue].append(override)
            
            if scene not in by_scene:
                by_scene[scene] = []
            by_scene[scene].append(override)
        
        return {
            "total_count": len(all_overrides),
            "active_count": len(active_overrides),
            "all_overrides": all_overrides,
            "active_overrides": active_overrides,
            "by_type": by_type,
            "by_issue": by_issue,
            "by_scene": by_scene
        }
    
    def _json_default(self, obj: Any) -> Any:
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
