from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnalysisType
from ..schemas import (
    APIResponse, ComparisonRequest, ComparisonResponse
)
from ..services import ComparisonService

router = APIRouter()


@router.post("", response_model=APIResponse[dict])
def compare_tasks(
    comparison_request: ComparisonRequest,
    db: Session = Depends(get_db)
):
    comparison_service = ComparisonService(db)
    
    result = comparison_service.compare_tasks(
        task_ids=comparison_request.task_ids,
        analysis_types=comparison_request.analysis_types,
        include_metrics=comparison_request.include_metrics,
        include_recommendations=comparison_request.include_recommendations
    )
    
    return APIResponse(data=result, message="对比分析完成")


@router.get("/best", response_model=APIResponse[dict])
def get_best_task(
    task_ids: List[int] = Query(..., description="要比较的任务ID列表"),
    db: Session = Depends(get_db)
):
    if len(task_ids) < 2:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error_code": "INVALID_INPUT",
                "error_message": "至少需要两个任务进行对比"
            }
        )
    
    comparison_service = ComparisonService(db)
    result = comparison_service.get_best_task(task_ids)
    
    if result is None:
        return APIResponse(
            data={"has_best": False},
            message="无法确定最优任务"
        )
    
    return APIResponse(
        data={
            "has_best": True,
            "best_task": result
        },
        message="已确定最优任务"
    )


@router.post("/export", response_model=APIResponse[dict])
def export_comparison(
    comparison_request: ComparisonRequest,
    export_format: str = Query("markdown", description="导出格式: json, markdown"),
    db: Session = Depends(get_db)
):
    comparison_service = ComparisonService(db)
    
    result = comparison_service.compare_tasks(
        task_ids=comparison_request.task_ids,
        analysis_types=comparison_request.analysis_types,
        include_metrics=comparison_request.include_metrics,
        include_recommendations=comparison_request.include_recommendations
    )
    
    if export_format.lower() == "json":
        return APIResponse(
            data=result,
            message="对比结果已准备好（JSON格式）"
        )
    
    md_content = _generate_comparison_markdown(result)
    
    return APIResponse(
        data={
            "comparison_id": result["comparison_id"],
            "markdown_content": md_content
        },
        message="对比结果已准备好（Markdown格式）"
    )


def _generate_comparison_markdown(result: dict) -> str:
    lines = []
    
    lines.append("# 任务对比分析报告")
    lines.append("")
    lines.append(f"**对比ID**: {result['comparison_id']}")
    lines.append(f"**生成时间**: {result['generated_at']}")
    lines.append("")
    
    lines.append("## 对比任务")
    lines.append("")
    for task_id, task_name in result["task_names"].items():
        lines.append(f"- **任务 {task_id}**: {task_name}")
    lines.append("")
    
    summary = result["summary"]
    lines.append("## 汇总")
    lines.append("")
    lines.append(f"- **对比任务数**: {summary['total_tasks_compared']}")
    lines.append(f"- **分析类型**: {', '.join(summary['analysis_types_compared'])}")
    lines.append(f"- **总发现数**: {summary['total_findings']}")
    lines.append(f"- **严重问题**: {summary['critical_findings']}")
    lines.append(f"- **高优先级问题**: {summary['high_findings']}")
    lines.append("")
    
    lines.append("### 综合评分")
    lines.append("")
    for task_id, score in summary["overall_score"].items():
        lines.append(f"- **任务 {task_id}**: {score}/100")
    lines.append("")
    
    if summary.get("common_findings"):
        lines.append("## 共同问题")
        lines.append("")
        for finding in summary["common_findings"]:
            lines.append(f"### {finding['title']}")
            lines.append("")
            lines.append(f"**严重级别**: {finding['severity'].upper()}")
            lines.append("")
            lines.append(finding["description"])
            lines.append("")
    
    if summary.get("unique_findings"):
        lines.append("## 独有问题")
        lines.append("")
        for task_id, findings in summary["unique_findings"].items():
            if findings:
                lines.append(f"### 任务 {task_id} 独有问题")
                lines.append("")
                for finding in findings:
                    lines.append(f"- **{finding['title']}** ({finding['severity']})")
                lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append("*本报告由数据库性能诊断系统自动生成*")
    
    return "\n".join(lines)
