from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import json

from ..models import (
    AnalysisTask, DiagnosisResult,
    TaskStatus, AnalysisType, SeverityLevel
)
from ..analyzers import (
    AnalyzerRegistry, get_all_analyzers,
    BaseAnalyzer, AnalysisResult as AnalyzerResult,
    Finding, Recommendation
)
from ..exceptions import (
    TaskNotFoundException, TaskNotCompletedException,
    AnalysisFailedException, ResultNotFoundException
)
from .task_service import TaskService


class AnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.task_service = TaskService(db)
    
    def run_analysis(self, task_id: int) -> AnalysisTask:
        task = self.task_service.get_task(task_id)
        
        self.task_service.update_task_status(task_id, TaskStatus.RUNNING)
        
        try:
            inputs = self._prepare_inputs(task_id)
            config = task.config or {}
            
            enabled_analyses = config.get("enabled_analyses")
            if enabled_analyses:
                enabled_types = [AnalysisType(t) for t in enabled_analyses]
            else:
                enabled_types = AnalyzerRegistry.get_available_types()
            
            for analysis_type in enabled_types:
                self._run_single_analysis(task_id, analysis_type, inputs, config)
            
            self.task_service.update_task_status(task_id, TaskStatus.COMPLETED)
            
        except Exception as e:
            self.task_service.update_task_status(
                task_id, TaskStatus.FAILED, error_message=str(e)
            )
            raise AnalysisFailedException(task_id, str(e))
        
        return self.task_service.get_task(task_id)
    
    def _prepare_inputs(self, task_id: int) -> Dict[str, Any]:
        inputs = self.task_service.get_task_inputs(task_id)
        
        prepared = {}
        
        db_profile_input = inputs.get("db_profile", {})
        if db_profile_input.get("content"):
            try:
                prepared["db_profile"] = json.loads(db_profile_input["content"])
            except json.JSONDecodeError:
                prepared["db_profile"] = {}
        else:
            prepared["db_profile"] = db_profile_input.get("metadata", {})
        
        schema_sql_input = inputs.get("schema_sql", {})
        prepared["schema_sql"] = schema_sql_input.get("content", "")
        
        slow_sql_input = inputs.get("slow_sql_log", {})
        prepared["slow_sql_log"] = slow_sql_input.get("content", "")
        
        batch_sample_input = inputs.get("batch_write_sample", {})
        if batch_sample_input.get("content"):
            try:
                prepared["batch_write_sample"] = json.loads(batch_sample_input["content"])
            except json.JSONDecodeError:
                prepared["batch_write_sample"] = batch_sample_input.get("metadata", {})
        else:
            prepared["batch_write_sample"] = batch_sample_input.get("metadata", {})
        
        return prepared
    
    def _run_single_analysis(
        self,
        task_id: int,
        analysis_type: AnalysisType,
        inputs: Dict[str, Any],
        config: Dict[str, Any]
    ) -> DiagnosisResult:
        analyzer_class = AnalyzerRegistry.get(analysis_type)
        if not analyzer_class:
            return None
        
        analyzer = analyzer_class(config=config)
        result = analyzer.analyze(inputs)
        
        diagnosis_result = self._save_result(task_id, analysis_type, result)
        return diagnosis_result
    
    def _save_result(
        self,
        task_id: int,
        analysis_type: AnalysisType,
        result: AnalyzerResult
    ) -> DiagnosisResult:
        findings_data = [
            {
                "id": f.id,
                "title": f.title,
                "description": f.description,
                "severity": f.severity.value,
                "category": f.category,
                "evidence": f.evidence,
                "impact": f.impact
            }
            for f in result.findings
        ]
        
        recommendations_data = [
            {
                "id": r.id,
                "finding_id": r.finding_id,
                "title": r.title,
                "description": r.description,
                "priority": r.priority,
                "estimated_effort": r.estimated_effort,
                "expected_improvement": r.expected_improvement
            }
            for r in result.recommendations
        ]
        
        diagnosis = DiagnosisResult(
            task_id=task_id,
            analysis_type=analysis_type,
            severity=result.severity,
            title=result.title,
            description=result.description,
            findings=findings_data,
            recommendations=recommendations_data,
            metrics=result.metrics,
            raw_data=result.raw_data
        )
        
        self.db.add(diagnosis)
        self.db.commit()
        self.db.refresh(diagnosis)
        return diagnosis
    
    def get_result(self, result_id: int) -> DiagnosisResult:
        result = self.db.query(DiagnosisResult).filter(DiagnosisResult.id == result_id).first()
        if not result:
            raise ResultNotFoundException(result_id)
        return result
    
    def get_task_results(self, task_id: int) -> List[DiagnosisResult]:
        task = self.task_service.get_task(task_id)
        
        if task.status not in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
            raise TaskNotCompletedException(task_id)
        
        return task.results
    
    def get_task_results_by_type(
        self,
        task_id: int,
        analysis_type: AnalysisType
    ) -> Optional[DiagnosisResult]:
        results = self.get_task_results(task_id)
        for result in results:
            if result.analysis_type == analysis_type:
                return result
        return None
    
    def get_task_summary(self, task_id: int) -> Dict[str, Any]:
        task = self.task_service.get_task(task_id)
        
        if task.status not in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
            raise TaskNotCompletedException(task_id)
        
        results = task.results
        
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        }
        
        all_findings = []
        for result in results:
            findings = result.findings or []
            for f in findings:
                severity = f.get("severity", "info").lower()
                if severity in severity_counts:
                    severity_counts[severity] += 1
                all_findings.append(f)
        
        overall_severity = self._calculate_overall_severity(severity_counts)
        
        return {
            "task_id": task_id,
            "task_name": task.name,
            "status": task.status.value,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "total_analyses": len(results),
            "severity_counts": severity_counts,
            "overall_severity": overall_severity,
            "total_findings": len(all_findings)
        }
    
    def _calculate_overall_severity(self, severity_counts: Dict[str, int]) -> str:
        if severity_counts["critical"] > 0:
            return "critical"
        if severity_counts["high"] > 0:
            return "high"
        if severity_counts["medium"] > 0:
            return "medium"
        if severity_counts["low"] > 0:
            return "low"
        return "info"
