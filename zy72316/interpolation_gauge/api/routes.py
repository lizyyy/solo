from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from interpolation_gauge.database import get_db
from interpolation_gauge.models.payloads import (
    WeightTableImportRequest, WeightRowResponse, WorkflowStateResponse,
    RepairRecordResponse, AuditTrailResponse, ExportDetailResponse,
    ManualOverrideRequest, BoundaryReviewRequest, RollbackRequest,
    QuickFixRequest, CounterexampleUpdateRequest, OldFormulaReviewRequest,
    BatchSummaryResponse,
)
from interpolation_gauge.services import repair_service

router = APIRouter(prefix="/api/interpolation-gauge", tags=["插值曲线仪表修补"])


@router.post("/import", response_model=WorkflowStateResponse, summary="第一步：评分权重表导入")
def import_weight_table(request: WeightTableImportRequest, db: Session = Depends(get_db)):
    return repair_service.import_weight_table(db, request.rows)


@router.post("/review-old-formula", response_model=RepairRecordResponse, summary="第二步：补看旧公式截图")
def review_old_formula(request: OldFormulaReviewRequest, db: Session = Depends(get_db)):
    try:
        return repair_service.review_old_formula(
            db, request.import_batch_id, request.row_id,
            request.screenshot_ref, request.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/update-counterexample", response_model=RepairRecordResponse, summary="第三步：反例列表更新")
def update_counterexample(request: CounterexampleUpdateRequest, db: Session = Depends(get_db)):
    try:
        return repair_service.update_counterexample(
            db, request.import_batch_id, request.row_id, request.counterexample_note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/workflow/{import_batch_id}", response_model=Optional[WorkflowStateResponse], summary="查询流程状态")
def get_workflow_state(import_batch_id: str, db: Session = Depends(get_db)):
    try:
        return repair_service.get_workflow_state(db, import_batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/batch-summary/{import_batch_id}", response_model=BatchSummaryResponse, summary="批次摘要（统一汇总视图，与详情/导出同数据源）")
def get_batch_summary(import_batch_id: str, db: Session = Depends(get_db)):
    try:
        return repair_service.get_batch_summary(db, import_batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/detail/{row_id}", response_model=ExportDetailResponse, summary="单行明细（页面展示/接口返回/导出同一数据源）")
def get_export_detail(row_id: int, db: Session = Depends(get_db)):
    try:
        return repair_service.get_export_detail(db, row_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/batch/{import_batch_id}", response_model=List[ExportDetailResponse], summary="批次全部明细导出")
def get_batch_export(import_batch_id: str, db: Session = Depends(get_db)):
    return repair_service.get_batch_export_details(db, import_batch_id)


@router.get("/boundary-pending/{import_batch_id}", response_model=List[WeightRowResponse], summary="列出待复核的边界等于阈值记录")
def list_boundary_pending(import_batch_id: str, db: Session = Depends(get_db)):
    return repair_service.list_boundary_pending_review(db, import_batch_id)


@router.post("/manual-override", response_model=AuditTrailResponse, summary="人工改动（审计轨迹留痕）")
def manual_override(request: ManualOverrideRequest, db: Session = Depends(get_db)):
    try:
        return repair_service.manual_override(
            db, request.row_id, request.field_name,
            request.new_value, request.change_reason, request.changed_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/boundary-review", response_model=WeightRowResponse, summary="任课老师复核边界值")
def review_boundary(request: BoundaryReviewRequest, db: Session = Depends(get_db)):
    try:
        return repair_service.review_boundary(
            db, request.row_id, request.confirmed_normal,
            request.reviewer, request.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rollback", response_model=WeightRowResponse, summary="回滚")
def rollback_row(request: RollbackRequest, db: Session = Depends(get_db)):
    try:
        return repair_service.rollback_row(db, request.row_id, request.rollback_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/quick-fix", response_model=WeightRowResponse, summary="快捷修补（错口径/补录返工）")
def quick_fix(request: QuickFixRequest, db: Session = Depends(get_db)):
    try:
        if request.error_type.value == "wrong_caliber":
            return repair_service.quick_fix_wrong_caliber(
                db, request.row_id, request.fix_value, request.fix_reason, request.changed_by,
            )
        elif request.error_type.value == "supplementary_rework":
            return repair_service.quick_fix_supplementary_rework(
                db, request.row_id, request.fix_value, request.fix_reason, request.changed_by,
            )
        else:
            raise HTTPException(status_code=400, detail=f"不支持的快捷修补类型: {request.error_type}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/{import_batch_id}/json", summary="导出批次明细（JSON 格式），与详情/列表同数据源")
def export_json(import_batch_id: str, db: Session = Depends(get_db)):
    try:
        return repair_service.export_batch_json(db, import_batch_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/{import_batch_id}/csv", summary="导出批次明细（CSV 格式），与详情/列表同数据源")
def export_csv(import_batch_id: str, db: Session = Depends(get_db)):
    try:
        csv_content = repair_service.export_batch_csv(db, import_batch_id)
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=interpolation_gauge_{import_batch_id}.csv"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
