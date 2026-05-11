from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict

from .models import (
    Task, Defect, Milestone, BlockerNote, Risk, RiskLevel, RiskType, 
    RiskStatus, RiskEvidence, ProjectRiskReport
)


class RiskCalculator:
    def __init__(self, owner_overload_threshold: int = 5, delay_threshold_days: int = 3,
                 defect_backlog_threshold: int = 3, critical_severities: List[str] = None):
        self.owner_overload_threshold = owner_overload_threshold
        self.delay_threshold_days = delay_threshold_days
        self.defect_backlog_threshold = defect_backlog_threshold
        self.critical_severities = critical_severities or ["严重", "致命", "高"]
    
    def calculate(self, tasks: List[Task], defects: List[Defect], 
                  milestones: List[Milestone], blockers: List[BlockerNote],
                  project: str, week_number: int, today: Optional[date] = None) -> List[Risk]:
        risks: List[Risk] = []
        today = today or date.today()
        
        risks.extend(self._check_delays(tasks, project, week_number, today))
        risks.extend(self._check_defect_backlog(defects, tasks, project, week_number))
        risks.extend(self._check_owner_overload(tasks, defects, project, week_number))
        risks.extend(self._check_milestone_deviation(milestones, tasks, project, week_number, today))
        risks.extend(self._check_task_closed_defect_open(defects, tasks, project, week_number))
        risks.extend(self._check_milestone_before_task(milestones, tasks, project, week_number))
        risks.extend(self._check_owner_missing(tasks, defects, project, week_number))
        
        for i, risk in enumerate(risks):
            risk.id = f"R{week_number:02d}{i+1:03d}"
        
        return risks
    
    def _check_delays(self, tasks: List[Task], project: str, week_number: int, today: date) -> List[Risk]:
        risks = []
        delayed_tasks = []
        evidence_items = []
        
        for task in tasks:
            if task.status in ["已完成", "已关闭", "已取消"]:
                continue
            
            if task.actual_end:
                if task.actual_end > task.planned_end:
                    delay_days = (task.actual_end - task.planned_end).days
                    delayed_tasks.append((task, delay_days))
                    evidence_items.append(RiskEvidence(
                        source_type="task",
                        source_id=task.id,
                        source_title=task.title,
                        details={
                            "status": task.status,
                            "planned_end": task.planned_end.isoformat(),
                            "actual_end": task.actual_end.isoformat(),
                            "delay_days": delay_days
                        }
                    ))
            elif today > task.planned_end:
                delay_days = (today - task.planned_end).days
                if delay_days >= self.delay_threshold_days:
                    delayed_tasks.append((task, delay_days))
                    evidence_items.append(RiskEvidence(
                        source_type="task",
                        source_id=task.id,
                        source_title=task.title,
                        details={
                            "status": task.status,
                            "planned_end": task.planned_end.isoformat(),
                            "today": today.isoformat(),
                            "delay_days": delay_days
                        }
                    ))
        
        if delayed_tasks:
            critical_count = sum(1 for _, d in delayed_tasks if d >= 7)
            medium_count = len(delayed_tasks) - critical_count
            
            if critical_count >= 3 or any(d >= 14 for _, d in delayed_tasks):
                level = RiskLevel.CRITICAL
            elif critical_count >= 1 or medium_count >= 5:
                level = RiskLevel.HIGH
            elif medium_count >= 2:
                level = RiskLevel.MEDIUM
            else:
                level = RiskLevel.LOW
            
            risks.append(Risk(
                id="",
                risk_type=RiskType.DELAY,
                level=level,
                status=RiskStatus.IDENTIFIED,
                week_number=week_number,
                project=project,
                title=f"{len(delayed_tasks)}个任务延期",
                description=f"检测到 {len(delayed_tasks)} 个任务存在延期风险，延期天数累计超过阈值。",
                evidence=evidence_items
            ))
        
        return risks
    
    def _check_defect_backlog(self, defects: List[Defect], tasks: List[Task], 
                              project: str, week_number: int) -> List[Risk]:
        risks = []
        open_defects = [d for d in defects if d.status not in ["已修复", "已关闭", "已解决"]]
        
        if not open_defects:
            return risks
        
        critical_defects = [d for d in open_defects if d.severity in self.critical_severities]
        high_priority_defects = [d for d in open_defects if d.severity in ["高", "严重", "致命"]]
        
        evidence_items = [
            RiskEvidence(
                source_type="defect",
                source_id=d.id,
                source_title=d.title,
                details={
                    "severity": d.severity,
                    "status": d.status,
                    "owner": d.owner or "未分配",
                    "related_task_id": d.related_task_id or "无关联任务"
                }
            ) for d in open_defects
        ]
        
        total_open = len(open_defects)
        critical_count = len(critical_defects)
        
        if critical_count >= 3:
            level = RiskLevel.CRITICAL
        elif critical_count >= 1 or total_open >= self.defect_backlog_threshold * 2:
            level = RiskLevel.HIGH
        elif total_open >= self.defect_backlog_threshold:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW
        
        risks.append(Risk(
            id="",
            risk_type=RiskType.DEFECT_BACKLOG,
            level=level,
            status=RiskStatus.IDENTIFIED,
            week_number=week_number,
            project=project,
            title=f"缺陷堆积: {total_open}个待修复",
            description=f"当前有 {total_open} 个未修复缺陷，其中 {critical_count} 个为严重/致命级别。",
            evidence=evidence_items
        ))
        
        return risks
    
    def _check_owner_overload(self, tasks: List[Task], defects: List[Defect],
                               project: str, week_number: int) -> List[Risk]:
        risks = []
        owner_tasks = defaultdict(list)
        owner_defects = defaultdict(list)
        
        for task in tasks:
            if task.owner and task.status not in ["已完成", "已关闭", "已取消"]:
                owner_tasks[task.owner].append(task)
        
        for defect in defects:
            if defect.owner and defect.status not in ["已修复", "已关闭", "已解决"]:
                owner_defects[defect.owner].append(defect)
        
        all_owners = set(owner_tasks.keys()) | set(owner_defects.keys())
        overloaded_owners = []
        evidence_items = []
        
        for owner in all_owners:
            task_count = len(owner_tasks.get(owner, []))
            defect_count = len(owner_defects.get(owner, []))
            total = task_count + defect_count
            
            if total >= self.owner_overload_threshold:
                overloaded_owners.append((owner, task_count, defect_count, total))
                evidence_items.append(RiskEvidence(
                    source_type="owner",
                    source_id=owner,
                    source_title=f"负责人: {owner}",
                    details={
                        "active_tasks": task_count,
                        "open_defects": defect_count,
                        "total_workload": total
                    }
                ))
        
        if overloaded_owners:
            critical_count = sum(1 for _, _, _, t in overloaded_owners if t >= self.owner_overload_threshold * 2)
            
            if critical_count >= 2:
                level = RiskLevel.CRITICAL
            elif len(overloaded_owners) >= 3:
                level = RiskLevel.HIGH
            elif len(overloaded_owners) >= 2:
                level = RiskLevel.MEDIUM
            else:
                level = RiskLevel.LOW
            
            risks.append(Risk(
                id="",
                risk_type=RiskType.OWNER_OVERLOAD,
                level=level,
                status=RiskStatus.IDENTIFIED,
                week_number=week_number,
                project=project,
                title=f"{len(overloaded_owners)}位负责人过载",
                description=f"有 {len(overloaded_owners)} 位负责人工作负载超过阈值（{self.owner_overload_threshold}项）。",
                evidence=evidence_items
            ))
        
        return risks
    
    def _check_milestone_deviation(self, milestones: List[Milestone], tasks: List[Task],
                                    project: str, week_number: int, today: date) -> List[Risk]:
        risks = []
        at_risk_milestones = []
        evidence_items = []
        
        for milestone in milestones:
            if milestone.status in ["已完成", "已达成"]:
                continue
            
            dependent_tasks = [t for t in tasks if t.id in milestone.dependent_tasks]
            incomplete_tasks = [t for t in dependent_tasks if t.status not in ["已完成", "已关闭"]]
            latest_planned_end = max((t.planned_end for t in dependent_tasks), default=milestone.planned_date)
            
            if incomplete_tasks:
                delay_risk = False
                if milestone.planned_date < today:
                    delay_risk = True
                elif latest_planned_end > milestone.planned_date:
                    delay_risk = True
                
                if delay_risk:
                    at_risk_milestones.append((milestone, len(incomplete_tasks), len(dependent_tasks)))
                    evidence_items.append(RiskEvidence(
                        source_type="milestone",
                        source_id=milestone.id,
                        source_title=milestone.title,
                        details={
                            "status": milestone.status,
                            "planned_date": milestone.planned_date.isoformat(),
                            "incomplete_dependent_tasks": len(incomplete_tasks),
                            "total_dependent_tasks": len(dependent_tasks),
                            "latest_task_end": latest_planned_end.isoformat()
                        }
                    ))
        
        if at_risk_milestones:
            if len(at_risk_milestones) >= 3:
                level = RiskLevel.CRITICAL
            elif len(at_risk_milestones) >= 2:
                level = RiskLevel.HIGH
            else:
                level = RiskLevel.MEDIUM
            
            risks.append(Risk(
                id="",
                risk_type=RiskType.MILESTONE_DEVIATION,
                level=level,
                status=RiskStatus.IDENTIFIED,
                week_number=week_number,
                project=project,
                title=f"{len(at_risk_milestones)}个里程碑存在偏差风险",
                description=f"有 {len(at_risk_milestones)} 个里程碑可能无法按时达成。",
                evidence=evidence_items
            ))
        
        return risks
    
    def _check_task_closed_defect_open(self, defects: List[Defect], tasks: List[Task],
                                        project: str, week_number: int) -> List[Risk]:
        risks = []
        anomalies = []
        evidence_items = []
        
        task_dict = {t.id: t for t in tasks}
        
        for defect in defects:
            if defect.status in ["已修复", "已关闭", "已解决"]:
                continue
            
            if defect.related_task_id and defect.related_task_id in task_dict:
                related_task = task_dict[defect.related_task_id]
                if related_task.status in ["已完成", "已关闭"]:
                    anomalies.append((defect, related_task))
                    evidence_items.append(RiskEvidence(
                        source_type="anomaly",
                        source_id=f"{defect.id}-{related_task.id}",
                        source_title=f"缺陷:{defect.title} / 任务:{related_task.title}",
                        details={
                            "defect_status": defect.status,
                            "defect_severity": defect.severity,
                            "task_status": related_task.status,
                            "task_id": related_task.id
                        }
                    ))
        
        if anomalies:
            critical_count = sum(1 for d, _ in anomalies if d.severity in self.critical_severities)
            
            if critical_count >= 2:
                level = RiskLevel.CRITICAL
            elif critical_count >= 1 or len(anomalies) >= 3:
                level = RiskLevel.HIGH
            elif len(anomalies) >= 2:
                level = RiskLevel.MEDIUM
            else:
                level = RiskLevel.LOW
            
            risks.append(Risk(
                id="",
                risk_type=RiskType.TASK_CLOSED_DEFECT_OPEN,
                level=level,
                status=RiskStatus.IDENTIFIED,
                week_number=week_number,
                project=project,
                title=f"{len(anomalies)}个异常: 任务已关闭但缺陷未修复",
                description=f"检测到 {len(anomalies)} 个异常：关联任务已完成/关闭，但缺陷仍未修复。",
                evidence=evidence_items
            ))
        
        return risks
    
    def _check_milestone_before_task(self, milestones: List[Milestone], tasks: List[Task],
                                      project: str, week_number: int) -> List[Risk]:
        risks = []
        anomalies = []
        evidence_items = []
        
        for milestone in milestones:
            dependent_tasks = [t for t in tasks if t.id in milestone.dependent_tasks]
            for task in dependent_tasks:
                if milestone.planned_date < task.planned_end:
                    anomalies.append((milestone, task))
                    evidence_items.append(RiskEvidence(
                        source_type="anomaly",
                        source_id=f"{milestone.id}-{task.id}",
                        source_title=f"里程碑:{milestone.title} / 任务:{task.title}",
                        details={
                            "milestone_planned": milestone.planned_date.isoformat(),
                            "task_planned_end": task.planned_end.isoformat(),
                            "task_id": task.id,
                            "issue": "里程碑日期早于关联任务计划结束日期"
                        }
                    ))
        
        if anomalies:
            unique_milestones = set(m.id for m, _ in anomalies)
            
            if len(unique_milestones) >= 2:
                level = RiskLevel.HIGH
            else:
                level = RiskLevel.MEDIUM
            
            risks.append(Risk(
                id="",
                risk_type=RiskType.MILESTONE_BEFORE_TASK,
                level=level,
                status=RiskStatus.IDENTIFIED,
                week_number=week_number,
                project=project,
                title=f"{len(unique_milestones)}个里程碑日期异常",
                description=f"有 {len(unique_milestones)} 个里程碑的计划日期早于其关联任务的计划结束日期。",
                evidence=evidence_items
            ))
        
        return risks
    
    def _check_owner_missing(self, tasks: List[Task], defects: List[Defect],
                              project: str, week_number: int) -> List[Risk]:
        risks = []
        missing_owner_tasks = []
        missing_owner_defects = []
        evidence_items = []
        
        for task in tasks:
            if not task.owner and task.status not in ["已完成", "已关闭", "已取消"]:
                missing_owner_tasks.append(task)
                evidence_items.append(RiskEvidence(
                    source_type="task",
                    source_id=task.id,
                    source_title=task.title,
                    details={
                        "status": task.status,
                        "planned_end": task.planned_end.isoformat(),
                        "issue": "缺少负责人"
                    }
                ))
        
        for defect in defects:
            if not defect.owner and defect.status not in ["已修复", "已关闭", "已解决"]:
                missing_owner_defects.append(defect)
                evidence_items.append(RiskEvidence(
                    source_type="defect",
                    source_id=defect.id,
                    source_title=defect.title,
                    details={
                        "severity": defect.severity,
                        "status": defect.status,
                        "issue": "缺少负责人"
                    }
                ))
        
        total_missing = len(missing_owner_tasks) + len(missing_owner_defects)
        
        if total_missing > 0:
            critical_defects = [d for d in missing_owner_defects if d.severity in self.critical_severities]
            
            if len(critical_defects) >= 2:
                level = RiskLevel.CRITICAL
            elif critical_defects or total_missing >= 5:
                level = RiskLevel.HIGH
            elif total_missing >= 3:
                level = RiskLevel.MEDIUM
            else:
                level = RiskLevel.LOW
            
            risks.append(Risk(
                id="",
                risk_type=RiskType.OWNER_MISSING,
                level=level,
                status=RiskStatus.IDENTIFIED,
                week_number=week_number,
                project=project,
                title=f"{total_missing}项工作缺少负责人",
                description=f"有 {len(missing_owner_tasks)} 个任务和 {len(missing_owner_defects)} 个缺陷未分配负责人。",
                evidence=evidence_items
            ))
        
        return risks
    
    def calculate_overall_risk(self, risks: List[Risk]) -> RiskLevel:
        if not risks:
            return RiskLevel.LOW
        
        risk_order = {
            RiskLevel.LOW: 0,
            RiskLevel.MEDIUM: 1,
            RiskLevel.HIGH: 2,
            RiskLevel.CRITICAL: 3
        }
        
        max_level = max((risk_order[r.level] for r in risks), default=0)
        critical_count = sum(1 for r in risks if r.level == RiskLevel.CRITICAL)
        high_count = sum(1 for r in risks if r.level == RiskLevel.HIGH)
        
        if critical_count >= 2:
            return RiskLevel.CRITICAL
        elif critical_count == 1:
            return RiskLevel.HIGH
        elif high_count >= 2:
            return RiskLevel.HIGH
        elif high_count == 1:
            return RiskLevel.MEDIUM
        
        for level, value in risk_order.items():
            if value == max_level:
                return level
        
        return RiskLevel.LOW
    
    def generate_summary(self, risks: List[Risk], tasks: List[Task], 
                         defects: List[Defect], milestones: List[Milestone]) -> Dict[str, Any]:
        summary = {
            "risk_count_by_level": {
                "低": sum(1 for r in risks if r.level == RiskLevel.LOW),
                "中": sum(1 for r in risks if r.level == RiskLevel.MEDIUM),
                "高": sum(1 for r in risks if r.level == RiskLevel.HIGH),
                "严重": sum(1 for r in risks if r.level == RiskLevel.CRITICAL)
            },
            "risk_count_by_type": {},
            "task_stats": {
                "total": len(tasks),
                "completed": sum(1 for t in tasks if t.status in ["已完成", "已关闭"]),
                "in_progress": sum(1 for t in tasks if t.status == "进行中"),
                "delayed": sum(1 for t in tasks if t.status not in ["已完成", "已关闭"] and t.actual_end and t.actual_end > t.planned_end)
            },
            "defect_stats": {
                "total": len(defects),
                "open": sum(1 for d in defects if d.status not in ["已修复", "已关闭", "已解决"]),
                "critical": sum(1 for d in defects if d.severity in self.critical_severities and d.status not in ["已修复", "已关闭", "已解决"])
            },
            "milestone_stats": {
                "total": len(milestones),
                "completed": sum(1 for m in milestones if m.status in ["已完成", "已达成"]),
                "at_risk": sum(1 for m in milestones if m.status not in ["已完成", "已达成"])
            }
        }
        
        for risk in risks:
            type_key = risk.risk_type.value
            summary["risk_count_by_type"][type_key] = summary["risk_count_by_type"].get(type_key, 0) + 1
        
        return summary
