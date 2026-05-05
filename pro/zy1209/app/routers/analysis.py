from typing import Optional, List
from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnalysisType
from ..schemas import (
    APIResponse, DiagnosisResultResponse
)
from ..services import AnalysisService, TaskService

router = APIRouter()


@router.post("/{task_id}/run", response_model=APIResponse[dict])
def run_analysis(
    task_id: int = Path(..., ge=1, description="任务ID"),
    db: Session = Depends(get_db)
):
    analysis_service = AnalysisService(db)
    task = analysis_service.run_analysis(task_id)
    
    return APIResponse(
        data={
            "task_id": task.id,
            "status": task.status.value,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        },
        message="分析任务已启动并完成"
    )


@router.get("/{task_id}/results", response_model=APIResponse[List[DiagnosisResultResponse]])
def get_results(
    task_id: int = Path(..., ge=1, description="任务ID"),
    analysis_type: Optional[AnalysisType] = Query(None, description="分析类型过滤"),
    db: Session = Depends(get_db)
):
    analysis_service = AnalysisService(db)
    
    if analysis_type:
        result = analysis_service.get_task_results_by_type(task_id, analysis_type)
        if result:
            return APIResponse(data=[DiagnosisResultResponse.model_validate(result)])
        return APIResponse(data=[])
    
    results = analysis_service.get_task_results(task_id)
    return APIResponse(
        data=[DiagnosisResultResponse.model_validate(r) for r in results]
    )


@router.get("/results/{result_id}", response_model=APIResponse[DiagnosisResultResponse])
def get_result(
    result_id: int = Path(..., ge=1, description="结果ID"),
    db: Session = Depends(get_db)
):
    analysis_service = AnalysisService(db)
    result = analysis_service.get_result(result_id)
    
    return APIResponse(data=DiagnosisResultResponse.model_validate(result))


@router.get("/types", response_model=APIResponse[List[dict]])
def get_available_analysis_types(
    db: Session = Depends(get_db)
):
    from ..analyzers import AnalyzerRegistry
    
    types_info = []
    for analysis_type in AnalyzerRegistry.get_available_types():
        type_info = {
            "type": analysis_type.value,
            "description": {
                AnalysisType.CONNECTION_POOL: "连接池容量分析",
                AnalysisType.BATCH_WRITE: "批量写入收益分析",
                AnalysisType.INDEX_ANALYSIS: "索引缺失/冗余分析",
                AnalysisType.SLOW_SQL: "慢SQL分析",
                AnalysisType.READ_WRITE_SPLIT: "读写分离路由分析",
                AnalysisType.SHARDING_HOTSPOT: "分库分表热点分析"
            }.get(analysis_type, analysis_type.value)
        }
        types_info.append(type_info)
    
    return APIResponse(data=types_info)
