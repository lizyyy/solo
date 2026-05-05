from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import json
import os

from sqlalchemy.orm import Session

from ..models import (
    AnalysisTask, DiagnosisResult, ExportRecord,
    TaskStatus, AnalysisType, SeverityLevel, ExportFormat
)
from ..config import settings
from ..exceptions import (
    TaskNotFoundException, TaskNotCompletedException,
    ExportFailedException, ExportNotFoundException
)
from .task_service import TaskService


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.task_service = TaskService(db)
    
    def export_task(
        self,
        task_id: int,
        export_format: ExportFormat,
        analysis_types: Optional[List[AnalysisType]] = None,
        include_severities: Optional[List[str]] = None,
        include_raw_data: bool = False,
        include_metrics: bool = True,
        include_recommendations: bool = True
    ) -> ExportRecord:
        task = self.task_service.get_task(task_id)
        
        if task.status != TaskStatus.COMPLETED:
            raise TaskNotCompletedException(task_id)
        
        results = task.results
        
        if analysis_types:
            results = [r for r in results if r.analysis_type in analysis_types]
        
        if include_severities:
            filtered_results = []
            for r in results:
                if r.findings:
                    filtered_findings = [
                        f for f in r.findings
                        if f.get("severity", "").lower() in [s.lower() for s in include_severities]
                    ]
                    if filtered_findings:
                        r_copy = DiagnosisResult()
                        r_copy.__dict__.update(r.__dict__)
                        r_copy.findings = filtered_findings
                        filtered_results.append(r_copy)
                else:
                    filtered_results.append(r)
            results = filtered_results
        
        export_data = {
            "task": {
                "id": task.id,
                "name": task.name,
                "description": task.description,
                "status": task.status.value,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None
            },
            "export_time": datetime.utcnow().isoformat(),
            "results": []
        }
        
        for result in results:
            result_data = {
                "analysis_type": result.analysis_type.value,
                "severity": result.severity.value,
                "title": result.title,
                "description": result.description
            }
            
            if include_metrics and result.metrics:
                result_data["metrics"] = result.metrics
            
            if result.findings:
                result_data["findings"] = result.findings
            
            if include_recommendations and result.recommendations:
                result_data["recommendations"] = result.recommendations
            
            if include_raw_data and result.raw_data:
                result_data["raw_data"] = result.raw_data
            
            export_data["results"].append(result_data)
        
        file_name = self._generate_filename(task.name, export_format)
        file_path = Path(settings.EXPORT_DIR) / file_name
        
        try:
            if export_format == ExportFormat.JSON:
                self._export_json(file_path, export_data)
            elif export_format == ExportFormat.MARKDOWN:
                self._export_markdown(file_path, export_data)
            elif export_format == ExportFormat.HTML:
                self._export_html(file_path, export_data)
            
            file_size = file_path.stat().st_size
            
            export_record = ExportRecord(
                task_id=task_id,
                export_format=export_format,
                file_path=str(file_path),
                file_name=file_name,
                file_size=file_size,
                export_config={
                    "analysis_types": [t.value for t in analysis_types] if analysis_types else None,
                    "include_severities": include_severities,
                    "include_raw_data": include_raw_data,
                    "include_metrics": include_metrics,
                    "include_recommendations": include_recommendations
                }
            )
            
            self.db.add(export_record)
            self.db.commit()
            self.db.refresh(export_record)
            
            return export_record
            
        except Exception as e:
            raise ExportFailedException(task_id, str(e))
    
    def _generate_filename(self, task_name: str, export_format: ExportFormat) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c if c.isalnum() else "_" for c in task_name)[:30]
        
        extensions = {
            ExportFormat.JSON: "json",
            ExportFormat.MARKDOWN: "md",
            ExportFormat.HTML: "html"
        }
        
        return f"{safe_name}_{timestamp}.{extensions[export_format]}"
    
    def _export_json(self, file_path: Path, data: Dict[str, Any]):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _export_markdown(self, file_path: Path, data: Dict[str, Any]):
        task = data["task"]
        results = data["results"]
        
        lines = []
        
        lines.append(f"# {task['name']}")
        lines.append("")
        lines.append(f"**导出时间**: {data['export_time']}")
        lines.append(f"**任务状态**: {task['status']}")
        lines.append(f"**分析数量**: {len(results)}")
        lines.append("")
        
        if task.get("description"):
            lines.append("## 任务描述")
            lines.append("")
            lines.append(task["description"])
            lines.append("")
        
        lines.append("## 分析结果摘要")
        lines.append("")
        
        total_findings = 0
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        
        for result in results:
            if result.get("findings"):
                for f in result["findings"]:
                    total_findings += 1
                    severity = f.get("severity", "info").lower()
                    if severity in severity_counts:
                        severity_counts[severity] += 1
        
        lines.append(f"- **总发现数**: {total_findings}")
        for sev, count in severity_counts.items():
            if count > 0:
                lines.append(f"- **{sev.upper()}**: {count}")
        lines.append("")
        
        for result in results:
            lines.append(f"---")
            lines.append("")
            lines.append(f"## {result['title']}")
            lines.append("")
            lines.append(f"**严重级别**: {result['severity'].upper()}")
            lines.append("")
            
            if result.get("description"):
                lines.append(result["description"])
                lines.append("")
            
            if result.get("metrics"):
                lines.append("### 指标数据")
                lines.append("")
                lines.append("| 指标 | 值 |")
                lines.append("|------|-----|")
                for key, value in result["metrics"].items():
                    lines.append(f"| {key} | {value} |")
                lines.append("")
            
            if result.get("findings"):
                lines.append("### 发现问题")
                lines.append("")
                for i, finding in enumerate(result["findings"], 1):
                    lines.append(f"#### {i}. {finding['title']}")
                    lines.append("")
                    lines.append(f"**严重级别**: {finding.get('severity', 'info').upper()}")
                    lines.append("")
                    lines.append(finding["description"])
                    lines.append("")
                    if finding.get("impact"):
                        lines.append(f"**影响**: {finding['impact']}")
                        lines.append("")
            
            if result.get("recommendations"):
                lines.append("### 优化建议")
                lines.append("")
                for i, rec in enumerate(result["recommendations"], 1):
                    lines.append(f"#### {i}. {rec['title']}")
                    lines.append("")
                    lines.append(f"**优先级**: {rec.get('priority', 'medium')}")
                    lines.append("")
                    lines.append(rec["description"])
                    lines.append("")
                    if rec.get("expected_improvement"):
                        lines.append(f"**预期效果**: {rec['expected_improvement']}")
                        lines.append("")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    
    def _export_html(self, file_path: Path, data: Dict[str, Any]):
        task = data["task"]
        results = data["results"]
        
        severity_colors = {
            "critical": "#dc2626",
            "high": "#ea580c",
            "medium": "#ca8a04",
            "low": "#2563eb",
            "info": "#16a34a"
        }
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{task['name']} - 数据库性能诊断报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #1a1a1a; border-bottom: 3px solid #2563eb; padding-bottom: 15px; }}
        h2 {{ color: #1a1a1a; margin-top: 30px; }}
        h3 {{ color: #374151; }}
        .meta {{ color: #6b7280; margin-bottom: 20px; }}
        .severity-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-weight: 600; font-size: 12px; }}
        .finding {{ background: #f9fafb; border-left: 4px solid #2563eb; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        .recommendation {{ background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 12px; text-align: left; }}
        th {{ background: #f9fafb; font-weight: 600; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-card {{ background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }}
        .summary-value {{ font-size: 2em; font-weight: bold; color: #2563eb; }}
        .summary-label {{ color: #6b7280; margin-top: 5px; }}
    </style>
</head>
<body>
<div class="container">
    <h1>{task['name']}</h1>
    <div class="meta">
        <p><strong>导出时间:</strong> {data['export_time']}</p>
        <p><strong>任务状态:</strong> {task['status']}</p>
        <p><strong>分析数量:</strong> {len(results)}</p>
    </div>
"""
        
        if task.get("description"):
            html += f"""
    <h2>任务描述</h2>
    <p>{task['description']}</p>
"""
        
        total_findings = 0
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        
        for result in results:
            if result.get("findings"):
                for f in result["findings"]:
                    total_findings += 1
                    severity = f.get("severity", "info").lower()
                    if severity in severity_counts:
                        severity_counts[severity] += 1
        
        html += f"""
    <h2>分析结果摘要</h2>
    <div class="summary-grid">
        <div class="summary-card">
            <div class="summary-value">{total_findings}</div>
            <div class="summary-label">总发现数</div>
        </div>
"""
        
        for sev, count in severity_counts.items():
            if count > 0:
                html += f"""
        <div class="summary-card">
            <div class="summary-value" style="color: {severity_colors[sev]}">{count}</div>
            <div class="summary-label">{sev.upper()}</div>
        </div>
"""
        
        html += """    </div>
"""
        
        for result in results:
            sev_color = severity_colors.get(result["severity"], "#6b7280")
            html += f"""
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <h2>{result['title']}</h2>
    <p><span class="severity-badge" style="background-color: {sev_color}">{result['severity'].upper()}</span></p>
"""
            
            if result.get("description"):
                html += f"    <p>{result['description']}</p>\n"
            
            if result.get("metrics"):
                html += """
    <h3>指标数据</h3>
    <table>
        <tr><th>指标</th><th>值</th></tr>
"""
                for key, value in result["metrics"].items():
                    html += f"        <tr><td>{key}</td><td>{value}</td></tr>\n"
                html += "    </table>\n"
            
            if result.get("findings"):
                html += "    <h3>发现问题</h3>\n"
                for i, finding in enumerate(result["findings"], 1):
                    sev = finding.get("severity", "info").lower()
                    sev_color = severity_colors.get(sev, "#6b7280")
                    html += f"""
    <div class="finding" style="border-left-color: {sev_color};">
        <h4>{i}. {finding['title']} <span class="severity-badge" style="background-color: {sev_color}">{sev.upper()}</span></h4>
        <p>{finding['description']}</p>
"""
                    if finding.get("impact"):
                        html += f"        <p><strong>影响:</strong> {finding['impact']}</p>\n"
                    html += "    </div>\n"
            
            if result.get("recommendations"):
                html += "    <h3>优化建议</h3>\n"
                for i, rec in enumerate(result["recommendations"], 1):
                    html += f"""
    <div class="recommendation">
        <h4>{i}. {rec['title']} <span class="severity-badge" style="background-color: #16a34a">{rec.get('priority', 'medium')}</span></h4>
        <p>{rec['description']}</p>
"""
                    if rec.get("expected_improvement"):
                        html += f"        <p><strong>预期效果:</strong> {rec['expected_improvement']}</p>\n"
                    html += "    </div>\n"
        
        html += """
</div>
</body>
</html>
"""
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)
    
    def get_export_record(self, export_id: int) -> ExportRecord:
        record = self.db.query(ExportRecord).filter(ExportRecord.id == export_id).first()
        if not record:
            raise ExportNotFoundException(export_id)
        return record
    
    def get_task_exports(self, task_id: int) -> List[ExportRecord]:
        task = self.task_service.get_task(task_id)
        return task.export_records
    
    def list_exports(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[List[ExportRecord], int]:
        query = self.db.query(ExportRecord)
        total = query.count()
        records = query.order_by(ExportRecord.created_at.desc()).offset(skip).limit(limit).all()
        return records, total
    
    def get_export_file_path(self, export_id: int) -> str:
        record = self.get_export_record(export_id)
        return record.file_path
