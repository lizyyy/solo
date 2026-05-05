from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from ..models import (
    AnalysisTask, DiagnosisResult,
    TaskStatus, AnalysisType, SeverityLevel
)
from ..exceptions import (
    TaskNotFoundException, TaskNotCompletedException,
    ComparisonFailedException
)
from .task_service import TaskService
from .analysis_service import AnalysisService


class ComparisonService:
    def __init__(self, db: Session):
        self.db = db
        self.task_service = TaskService(db)
        self.analysis_service = AnalysisService(db)
    
    def compare_tasks(
        self,
        task_ids: List[int],
        analysis_types: Optional[List[AnalysisType]] = None,
        include_metrics: bool = True,
        include_recommendations: bool = True
    ) -> Dict[str, Any]:
        if len(task_ids) < 2:
            raise ComparisonFailedException("至少需要两个任务进行对比")
        
        if len(task_ids) > 5:
            raise ComparisonFailedException("最多支持对比5个任务")
        
        tasks = {}
        results_by_task = {}
        
        for task_id in task_ids:
            task = self.task_service.get_task(task_id)
            
            if task.status != TaskStatus.COMPLETED:
                raise TaskNotCompletedException(task_id)
            
            tasks[task_id] = task
            
            results = task.results
            if analysis_types:
                results = [r for r in results if r.analysis_type in analysis_types]
            
            results_by_task[task_id] = results
        
        comparison_id = str(uuid.uuid4())[:8]
        
        summary = self._generate_summary(tasks, results_by_task)
        
        detailed_comparison = {}
        all_analysis_types = set()
        for results in results_by_task.values():
            for r in results:
                all_analysis_types.add(r.analysis_type)
        
        for analysis_type in all_analysis_types:
            detailed_comparison[analysis_type] = self._compare_analysis_type(
                analysis_type, tasks, results_by_task, include_metrics
            )
        
        return {
            "comparison_id": comparison_id,
            "task_ids": task_ids,
            "task_names": {tid: tasks[tid].name for tid in task_ids},
            "summary": summary,
            "detailed_comparison": detailed_comparison,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def _generate_summary(
        self,
        tasks: Dict[int, AnalysisTask],
        results_by_task: Dict[int, List[DiagnosisResult]]
    ) -> Dict[str, Any]:
        task_ids = list(tasks.keys())
        
        severity_by_task = {}
        findings_by_task = {}
        common_findings = {}
        unique_findings = {}
        
        for task_id in task_ids:
            severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
            task_findings = {}
            
            for result in results_by_task.get(task_id, []):
                if result.findings:
                    for f in result.findings:
                        severity = f.get("severity", "info").lower()
                        if severity in severity_counts:
                            severity_counts[severity] += 1
                        
                        finding_key = f"{f.get('category', 'general')}:{f['title']}"
                        task_findings[finding_key] = f
            
            severity_by_task[task_id] = severity_counts
            findings_by_task[task_id] = task_findings
        
        all_finding_keys = set()
        for findings in findings_by_task.values():
            all_finding_keys.update(findings.keys())
        
        common_findings_list = []
        unique_findings_dict = {tid: [] for tid in task_ids}
        
        for key in all_finding_keys:
            present_in_tasks = [tid for tid in task_ids if key in findings_by_task[tid]]
            
            if len(present_in_tasks) == len(task_ids):
                sample_finding = findings_by_task[present_in_tasks[0]][key]
                common_findings_list.append({
                    "finding_id": key,
                    "title": sample_finding["title"],
                    "severity": sample_finding.get("severity", "info"),
                    "present_in_tasks": present_in_tasks,
                    "description": sample_finding.get("description", "")
                })
            elif len(present_in_tasks) > 0:
                for tid in present_in_tasks:
                    finding = findings_by_task[tid][key]
                    unique_findings_dict[tid].append({
                        "finding_id": key,
                        "title": finding["title"],
                        "severity": finding.get("severity", "info"),
                        "present_in_tasks": present_in_tasks,
                        "description": finding.get("description", "")
                    })
        
        key_metrics = self._extract_key_metrics(results_by_task)
        
        overall_scores = {}
        for task_id in task_ids:
            counts = severity_by_task[task_id]
            score = 100 - (
                counts["critical"] * 20 +
                counts["high"] * 10 +
                counts["medium"] * 5 +
                counts["low"] * 2
            )
            overall_scores[task_id] = max(0, score)
        
        total_findings = sum(
            sum(counts.values()) for counts in severity_by_task.values()
        )
        critical_total = sum(counts["critical"] for counts in severity_by_task.values())
        high_total = sum(counts["high"] for counts in severity_by_task.values())
        
        return {
            "total_tasks_compared": len(task_ids),
            "analysis_types_compared": list(set(
                r.analysis_type.value
                for results in results_by_task.values()
                for r in results
            )),
            "total_findings": total_findings,
            "critical_findings": critical_total,
            "high_findings": high_total,
            "common_findings": common_findings_list,
            "unique_findings": unique_findings_dict,
            "key_metrics": key_metrics,
            "overall_score": overall_scores
        }
    
    def _extract_key_metrics(
        self,
        results_by_task: Dict[int, List[DiagnosisResult]]
    ) -> List[Dict[str, Any]]:
        task_ids = list(results_by_task.keys())
        metric_comparisons = []
        
        all_metrics = set()
        metrics_by_task = {}
        
        for task_id in task_ids:
            task_metrics = {}
            for result in results_by_task.get(task_id, []):
                if result.metrics:
                    for key, value in result.metrics.items():
                        if isinstance(value, (int, float)):
                            metric_key = f"{result.analysis_type.value}:{key}"
                            task_metrics[metric_key] = value
                            all_metrics.add(metric_key)
            metrics_by_task[task_id] = task_metrics
        
        for metric_key in all_metrics:
            values = {}
            for task_id in task_ids:
                values[task_id] = metrics_by_task[task_id].get(metric_key)
            
            valid_values = [v for v in values.values() if v is not None]
            if len(valid_values) >= 2:
                min_val = min(valid_values)
                max_val = max(valid_values)
                
                improvement = None
                trend = "stable"
                
                if len(valid_values) > 1:
                    if max_val > min_val * 1.5:
                        trend = "increasing"
                    elif min_val < max_val * 0.5:
                        trend = "decreasing"
                
                metric_comparisons.append({
                    "metric_name": metric_key,
                    "task_values": values,
                    "improvement": improvement,
                    "trend": trend
                })
        
        return metric_comparisons[:10]
    
    def _compare_analysis_type(
        self,
        analysis_type: AnalysisType,
        tasks: Dict[int, AnalysisTask],
        results_by_task: Dict[int, List[DiagnosisResult]],
        include_metrics: bool
    ) -> Dict[str, Any]:
        task_ids = list(tasks.keys())
        
        comparison = {
            "analysis_type": analysis_type.value,
            "tasks": {}
        }
        
        for task_id in task_ids:
            results = results_by_task.get(task_id, [])
            result = next((r for r in results if r.analysis_type == analysis_type), None)
            
            if result:
                task_data = {
                    "task_name": tasks[task_id].name,
                    "severity": result.severity.value,
                    "finding_count": len(result.findings) if result.findings else 0
                }
                
                if include_metrics and result.metrics:
                    task_data["metrics"] = result.metrics
                
                if result.findings:
                    task_data["findings"] = result.findings
                
                comparison["tasks"][task_id] = task_data
        
        return comparison
    
    def get_best_task(
        self,
        task_ids: List[int]
    ) -> Optional[Dict[str, Any]]:
        if len(task_ids) < 2:
            return None
        
        comparison = self.compare_tasks(task_ids)
        summary = comparison["summary"]
        scores = summary["overall_score"]
        
        best_task_id = max(scores.keys(), key=lambda x: scores[x])
        max_score = scores[best_task_id]
        
        return {
            "task_id": best_task_id,
            "task_name": comparison["task_names"][best_task_id],
            "score": max_score,
            "is_significant": max_score > min(scores.values()) + 10
        }
