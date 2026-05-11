import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import date

from .models import (
    Task, Defect, Milestone, BlockerNote, Risk, ProjectRiskReport,
    RiskStatus
)


class DataStore:
    def __init__(self, storage_path: str = "./risk_data"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        self.tasks_file = self.storage_path / "tasks.json"
        self.defects_file = self.storage_path / "defects.json"
        self.milestones_file = self.storage_path / "milestones.json"
        self.blockers_file = self.storage_path / "blockers.json"
        self.risks_file = self.storage_path / "risks.json"
        self.reports_file = self.storage_path / "reports.json"
        
        self._init_files()
    
    def _init_files(self):
        for file_path in [
            self.tasks_file, self.defects_file, self.milestones_file,
            self.blockers_file, self.risks_file, self.reports_file
        ]:
            if not file_path.exists():
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f)
    
    def _load_json(self, file_path: Path) -> List[Dict]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save_json(self, file_path: Path, data: List[Dict]):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def import_task(self, task: Task) -> bool:
        tasks = self._load_json(self.tasks_file)
        existing = [t for t in tasks if t['id'] == task.id and t['week_number'] == task.week_number]
        if existing:
            return False
        tasks.append(task.to_dict())
        self._save_json(self.tasks_file, tasks)
        return True
    
    def import_defect(self, defect: Defect) -> bool:
        defects = self._load_json(self.defects_file)
        existing = [d for d in defects if d['id'] == defect.id and d['week_number'] == defect.week_number]
        if existing:
            return False
        defects.append(defect.to_dict())
        self._save_json(self.defects_file, defects)
        return True
    
    def import_milestone(self, milestone: Milestone) -> bool:
        milestones = self._load_json(self.milestones_file)
        existing = [m for m in milestones if m['id'] == milestone.id and m['week_number'] == milestone.week_number]
        if existing:
            return False
        milestones.append(milestone.to_dict())
        self._save_json(self.milestones_file, milestones)
        return True
    
    def import_blocker(self, blocker: BlockerNote) -> bool:
        blockers = self._load_json(self.blockers_file)
        existing = [b for b in blockers if b['id'] == blocker.id and b['week_number'] == blocker.week_number]
        if existing:
            return False
        blockers.append(blocker.to_dict())
        self._save_json(self.blockers_file, blockers)
        return True
    
    def get_tasks(self, project: Optional[str] = None, week_number: Optional[int] = None) -> List[Task]:
        tasks_data = self._load_json(self.tasks_file)
        tasks = [Task.from_dict(t) for t in tasks_data]
        if project:
            tasks = [t for t in tasks if t.project == project]
        if week_number is not None:
            tasks = [t for t in tasks if t.week_number == week_number]
        return tasks
    
    def get_defects(self, project: Optional[str] = None, week_number: Optional[int] = None) -> List[Defect]:
        defects_data = self._load_json(self.defects_file)
        defects = [Defect.from_dict(d) for d in defects_data]
        if project:
            defects = [d for d in defects if d.project == project]
        if week_number is not None:
            defects = [d for d in defects if d.week_number == week_number]
        return defects
    
    def get_milestones(self, project: Optional[str] = None, week_number: Optional[int] = None) -> List[Milestone]:
        milestones_data = self._load_json(self.milestones_file)
        milestones = [Milestone.from_dict(m) for m in milestones_data]
        if project:
            milestones = [m for m in milestones if m.project == project]
        if week_number is not None:
            milestones = [m for m in milestones if m.week_number == week_number]
        return milestones
    
    def get_blockers(self, project: Optional[str] = None, week_number: Optional[int] = None) -> List[BlockerNote]:
        blockers_data = self._load_json(self.blockers_file)
        blockers = [BlockerNote.from_dict(b) for b in blockers_data]
        if project:
            blockers = [b for b in blockers if b.project == project]
        if week_number is not None:
            blockers = [b for b in blockers if b.week_number == week_number]
        return blockers
    
    def save_risks(self, risks: List[Risk], project: str, week_number: int):
        all_risks = self._load_json(self.risks_file)
        all_risks = [
            r for r in all_risks 
            if not (r['project'] == project and r['week_number'] == week_number)
        ]
        all_risks.extend([r.to_dict() for r in risks])
        self._save_json(self.risks_file, all_risks)
    
    def get_risks(self, project: Optional[str] = None, week_number: Optional[int] = None, 
                  risk_id: Optional[str] = None) -> List[Risk]:
        risks_data = self._load_json(self.risks_file)
        risks = [Risk.from_dict(r) for r in risks_data]
        if risk_id:
            return [r for r in risks if r.id == risk_id]
        if project:
            risks = [r for r in risks if r.project == project]
        if week_number is not None:
            risks = [r for r in risks if r.week_number == week_number]
        return risks
    
    def update_risk(self, risk: Risk):
        all_risks = self._load_json(self.risks_file)
        for i, r in enumerate(all_risks):
            if r['id'] == risk.id:
                all_risks[i] = risk.to_dict()
                break
        self._save_json(self.risks_file, all_risks)
    
    def save_report(self, report: ProjectRiskReport):
        reports = self._load_json(self.reports_file)
        reports = [
            r for r in reports 
            if not (r['project'] == report.project and r['week_number'] == report.week_number)
        ]
        reports.append(report.to_dict())
        self._save_json(self.reports_file, reports)
    
    def get_reports(self, project: Optional[str] = None, week_number: Optional[int] = None) -> List[ProjectRiskReport]:
        reports_data = self._load_json(self.reports_file)
        reports = [ProjectRiskReport.from_dict(r) for r in reports_data]
        if project:
            reports = [r for r in reports if r.project == project]
        if week_number is not None:
            reports = [r for r in reports if r.week_number == week_number]
        return reports
    
    def get_projects(self) -> List[str]:
        projects = set()
        for t in self._load_json(self.tasks_file):
            projects.add(t['project'])
        for d in self._load_json(self.defects_file):
            projects.add(d['project'])
        for m in self._load_json(self.milestones_file):
            projects.add(m['project'])
        return sorted(list(projects))
    
    def get_weeks(self, project: Optional[str] = None) -> List[int]:
        weeks = set()
        if project:
            tasks = self.get_tasks(project=project)
            defects = self.get_defects(project=project)
            milestones = self.get_milestones(project=project)
        else:
            tasks = self.get_tasks()
            defects = self.get_defects()
            milestones = self.get_milestones()
        
        for t in tasks:
            weeks.add(t.week_number)
        for d in defects:
            weeks.add(d.week_number)
        for m in milestones:
            weeks.add(m.week_number)
        
        return sorted(list(weeks))
