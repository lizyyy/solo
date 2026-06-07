from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import (
    EvaluationSliceCreate,
    EvaluationSliceResponse,
    FeatureSnapshotCreate,
    FeatureSnapshotResponse,
    CheckResultResponse,
    WorkflowStepResponse,
    ThresholdUpdate,
    ExportRequest,
    CheckResultSummary,
)
from app.services import CheckService, WorkflowService, ExportService

router = APIRouter(prefix="/api", tags=["feature-leak-check"])


@router.post("/workflow/step1/import", response_model=dict)
def import_evaluation_slice(
    slice_data: EvaluationSliceCreate,
    operator: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    workflow_service = WorkflowService(db)
    try:
        evaluation_slice, check_results = workflow_service.step1_import_evaluation_slice(
            slice_data, operator
        )
        return {
            "evaluation_slice": EvaluationSliceResponse.model_validate(evaluation_slice),
            "check_results": [CheckResultResponse.model_validate(cr) for cr in check_results],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/workflow/step2/supplement", response_model=dict)
def supplement_feature_snapshot(
    snapshot_data: FeatureSnapshotCreate,
    operator: Optional[str] = Query(None),
    is_resupplement: bool = Query(False),
    db: Session = Depends(get_db),
):
    workflow_service = WorkflowService(db)
    try:
        feature_snapshot, check_results = workflow_service.step2_supplement_feature_snapshot(
            snapshot_data, operator, is_resupplement
        )
        return {
            "feature_snapshot": FeatureSnapshotResponse.model_validate(feature_snapshot),
            "check_results": [CheckResultResponse.model_validate(cr) for cr in check_results],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/workflow/step3/update-thresholds", response_model=dict)
def update_hierarchical_metrics(
    evaluation_slice_id: int,
    threshold_updates: List[ThresholdUpdate],
    operator: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    workflow_service = WorkflowService(db)
    try:
        threshold_records, check_results = workflow_service.step3_update_hierarchical_metrics(
            evaluation_slice_id, threshold_updates, operator
        )
        return {
            "threshold_records": [
                {
                    "id": tr.id,
                    "threshold_name": tr.threshold_name,
                    "old_value": tr.old_value,
                    "new_value": tr.new_value,
                    "changed_by": tr.changed_by,
                    "is_applied_in_report": tr.is_applied_in_report,
                }
                for tr in threshold_records
            ],
            "check_results": [CheckResultResponse.model_validate(cr) for cr in check_results],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/workflow/status/{slice_id}", response_model=List[WorkflowStepResponse])
def get_workflow_status(slice_id: int, db: Session = Depends(get_db)):
    workflow_service = WorkflowService(db)
    steps = workflow_service.get_workflow_status(slice_id)
    if not steps:
        raise HTTPException(status_code=404, detail="评测切片不存在或未初始化工作流")
    return [WorkflowStepResponse.model_validate(s) for s in steps]


@router.get("/evaluation-slices/{slice_id}", response_model=dict)
def get_evaluation_slice(slice_id: int, db: Session = Depends(get_db)):
    workflow_service = WorkflowService(db)
    check_service = CheckService(db)

    slice_obj = workflow_service.get_evaluation_slice(slice_id)
    if not slice_obj:
        raise HTTPException(status_code=404, detail="评测切片不存在")

    snapshots = workflow_service.get_feature_snapshots(slice_id)
    check_results = check_service.get_check_results(
        needs_review=None,
        limit=1000,
    )
    slice_check_results = [cr for cr in check_results if cr.evaluation_slice_id == slice_id]

    manual_changes = [
        {
            "id": mc.id,
            "field_name": mc.field_name,
            "old_value": mc.old_value,
            "new_value": mc.new_value,
            "changed_by": mc.changed_by,
            "change_time": mc.change_time,
            "change_reason": mc.change_reason,
        }
        for mc in slice_obj.manual_changes
    ]

    return {
        "evaluation_slice": EvaluationSliceResponse.model_validate(slice_obj),
        "feature_snapshots": [FeatureSnapshotResponse.model_validate(s) for s in snapshots],
        "check_results": [CheckResultResponse.model_validate(cr) for cr in slice_check_results],
        "manual_changes": manual_changes,
        "workflow_steps": [
            WorkflowStepResponse.model_validate(s) for s in slice_obj.workflow_steps
        ],
    }


@router.get("/check-results", response_model=List[CheckResultResponse])
def list_check_results(
    check_status: Optional[str] = Query(None),
    check_type: Optional[str] = Query(None),
    needs_review: Optional[bool] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    check_service = CheckService(db)
    results = check_service.get_check_results(
        check_status=check_status,
        check_type=check_type,
        needs_review=needs_review,
        limit=limit,
        offset=offset,
    )
    return [CheckResultResponse.model_validate(r) for r in results]


@router.get("/check-results/summary", response_model=CheckResultSummary)
def get_check_summary(db: Session = Depends(get_db)):
    check_service = CheckService(db)
    return check_service.get_check_result_summary()


@router.post("/check-results/{result_id}/review", response_model=CheckResultResponse)
def review_check_result(
    result_id: int,
    reviewer: str,
    review_comment: str,
    new_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    check_service = CheckService(db)
    result = check_service.review_check_result(
        result_id, reviewer, review_comment, new_status
    )
    if not result:
        raise HTTPException(status_code=404, detail="检查结果不存在")
    return CheckResultResponse.model_validate(result)


@router.post("/export/excel", response_model=dict)
def export_to_excel(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
):
    export_service = ExportService(db)
    try:
        result = export_service.export_to_excel(export_request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/data", response_model=List[dict])
def get_export_data(
    check_status: Optional[str] = Query(None),
    check_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    export_service = ExportService(db)
    status_filter = [check_status] if check_status else None
    type_filter = [check_type] if check_type else None
    return export_service.get_export_data_for_api(status_filter, type_filter)
