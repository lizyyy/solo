from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.schemas.schemas import (
    RebalancePlanCreate,
    RebalancePlanResponse,
    ApprovalRequest,
    StatusUpdateRequest,
    ExecutionResult,
    ManualCorrectionRequest,
    PaginatedResponse,
    ApprovalRecordResponse,
    ExecutionSummaryResponse,
    FailureRecordResponse,
    ExportRequest,
    RebalanceStatus,
)
from app.services.rebalance_service import RebalanceService
from app.services.export_service import ExportService

router = APIRouter()


@router.post("/plans", response_model=RebalancePlanResponse)
def create_plan(plan_data: RebalancePlanCreate, db: Session = Depends(get_db)):
    try:
        service = RebalanceService(db)
        return service.create_plan(plan_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建计划失败: {str(e)}")


@router.get("/plans/{plan_id}", response_model=RebalancePlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    service = RebalanceService(db)
    plan = service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"计划 {plan_id} 不存在")
    return plan


@router.get("/plans", response_model=PaginatedResponse)
def list_plans(
    status: Optional[RebalanceStatus] = Query(None, description="按状态筛选"),
    source_shard: Optional[str] = Query(None, description="按源分片筛选"),
    created_by: Optional[str] = Query(None, description="按创建人筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
):
    service = RebalanceService(db)
    result = service.list_plans(
        status=status.value if status else None,
        source_shard=source_shard,
        created_by=created_by,
        page=page,
        page_size=page_size,
    )
    return result


@router.post("/plans/{plan_id}/approval", response_model=RebalancePlanResponse)
def process_approval(
    plan_id: int, approval_data: ApprovalRequest, db: Session = Depends(get_db)
):
    try:
        service = RebalanceService(db)
        return service.process_approval(
            plan_id=plan_id,
            approver=approval_data.approver,
            action=approval_data.action,
            comments=approval_data.comments,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"审批操作失败: {str(e)}")


@router.put("/plans/{plan_id}/status", response_model=RebalancePlanResponse)
def update_status(
    plan_id: int, status_data: StatusUpdateRequest, db: Session = Depends(get_db)
):
    try:
        service = RebalanceService(db)
        return service.update_status(
            plan_id=plan_id,
            new_status=status_data.new_status,
            operator=status_data.operator,
            reason=status_data.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"状态更新失败: {str(e)}")


@router.post("/plans/{plan_id}/execution", response_model=ExecutionSummaryResponse)
def record_execution(
    plan_id: int, result_data: ExecutionResult, db: Session = Depends(get_db)
):
    try:
        service = RebalanceService(db)
        return service.record_execution_result(
            plan_id=plan_id,
            success=result_data.success,
            actual_traffic_gb=result_data.actual_traffic_gb,
            execution_details=result_data.execution_details,
            error_message=result_data.error_message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"记录执行结果失败: {str(e)}")


@router.post("/plans/{plan_id}/failure", response_model=FailureRecordResponse)
def record_failure(
    plan_id: int,
    failed_step: str = Query(..., description="失败步骤"),
    final_conclusion: str = Query(..., description="最终结论"),
    error_details: Optional[str] = Query(None, description="错误详情"),
    db: Session = Depends(get_db),
):
    try:
        service = RebalanceService(db)
        plan = service.get_plan(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail=f"计划 {plan_id} 不存在")

        return service.record_failure(
            plan_id=plan_id,
            failed_step=failed_step,
            raw_input_snapshot=plan.raw_input or {},
            processing_evidence={
                "status": plan.status,
                "hot_tenants": plan.hot_tenants,
                "risk_score": plan.risk_score,
            },
            final_conclusion=final_conclusion,
            error_details=error_details,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"记录失败信息失败: {str(e)}")


@router.post("/plans/{plan_id}/correction", response_model=RebalancePlanResponse)
def apply_correction(
    plan_id: int, correction_data: ManualCorrectionRequest, db: Session = Depends(get_db)
):
    try:
        service = RebalanceService(db)
        return service.apply_manual_correction(
            plan_id=plan_id,
            corrected_by=correction_data.corrected_by,
            corrected_values=correction_data.corrected_values,
            correction_reason=correction_data.correction_reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"人工修正失败: {str(e)}")


@router.get("/plans/{plan_id}/approvals", response_model=List[ApprovalRecordResponse])
def get_approvals(plan_id: int, db: Session = Depends(get_db)):
    service = RebalanceService(db)
    plan = service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"计划 {plan_id} 不存在")
    return service.get_approvals(plan_id)


@router.get("/plans/{plan_id}/executions", response_model=List[ExecutionSummaryResponse])
def get_executions(plan_id: int, db: Session = Depends(get_db)):
    service = RebalanceService(db)
    plan = service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"计划 {plan_id} 不存在")
    return service.get_executions(plan_id)


@router.get("/plans/{plan_id}/failures", response_model=List[FailureRecordResponse])
def get_failures(plan_id: int, db: Session = Depends(get_db)):
    service = RebalanceService(db)
    plan = service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"计划 {plan_id} 不存在")
    return service.get_failures(plan_id)


@router.post("/export/excel")
def export_excel(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
):
    try:
        service = ExportService(db)
        excel_data = service.export_plans_to_excel(
            plan_ids=export_request.plan_ids,
            status=export_request.status.value if export_request.status else None,
            start_date=export_request.start_date,
            end_date=export_request.end_date,
        )

        filename = f"rebalance_plans_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        return StreamingResponse(
            excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.post("/export/summary")
def export_summary(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
):
    try:
        service = ExportService(db)
        return service.export_plans_summary(
            plan_ids=export_request.plan_ids,
            status=export_request.status.value if export_request.status else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出汇总失败: {str(e)}")
