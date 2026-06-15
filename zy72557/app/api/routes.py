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
    ManualChangeCreate,
    ManualChangeResponse,
    StatusHistoryResponse,
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
        status_history = workflow_service.get_status_history(evaluation_slice.id)
        manual_changes = workflow_service.get_manual_changes(evaluation_slice.id)
        return {
            "evaluation_slice": EvaluationSliceResponse.model_validate(evaluation_slice),
            "check_results": [CheckResultResponse.model_validate(cr) for cr in check_results],
            "status_history": [StatusHistoryResponse.model_validate(sh) for sh in status_history],
            "manual_changes": [ManualChangeResponse.model_validate(mc) for mc in manual_changes],
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
        status_history = workflow_service.get_status_history(snapshot_data.evaluation_slice_id)
        manual_changes = workflow_service.get_manual_changes(snapshot_data.evaluation_slice_id)
        return {
            "feature_snapshot": FeatureSnapshotResponse.model_validate(feature_snapshot),
            "check_results": [CheckResultResponse.model_validate(cr) for cr in check_results],
            "status_history": [StatusHistoryResponse.model_validate(sh) for sh in status_history],
            "manual_changes": [ManualChangeResponse.model_validate(mc) for mc in manual_changes],
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
        status_history = workflow_service.get_status_history(evaluation_slice_id)
        manual_changes = workflow_service.get_manual_changes(evaluation_slice_id)
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
            "status_history": [StatusHistoryResponse.model_validate(sh) for sh in status_history],
            "manual_changes": [ManualChangeResponse.model_validate(mc) for mc in manual_changes],
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
    status_history = workflow_service.get_status_history(slice_id)
    manual_changes = workflow_service.get_manual_changes(slice_id)

    results_with_history = []
    for cr in slice_check_results:
        cr_dict = CheckResultResponse.model_validate(cr).model_dump()
        cr_manual_changes = [
            {
                "id": mc.id,
                "field_name": mc.field_name,
                "old_value": mc.old_value,
                "new_value": mc.new_value,
                "changed_by": mc.changed_by,
                "change_time": mc.change_time,
                "change_reason": mc.change_reason,
            }
            for mc in manual_changes if mc.check_result_id == cr.id
        ]
        cr_status_history = [
            {
                "id": sh.id,
                "old_status": sh.old_status,
                "new_status": sh.new_status,
                "changed_by": sh.changed_by,
                "change_reason": sh.change_reason,
                "change_time": sh.change_time,
                "step_context": sh.step_context,
            }
            for sh in status_history if sh.check_result_id == cr.id
        ]
        cr_dict["related_manual_changes"] = cr_manual_changes
        cr_dict["related_status_history"] = cr_status_history
        results_with_history.append(cr_dict)

    all_manual_changes = [
        {
            "id": mc.id,
            "check_result_id": mc.check_result_id,
            "field_name": mc.field_name,
            "old_value": mc.old_value,
            "new_value": mc.new_value,
            "changed_by": mc.changed_by,
            "change_time": mc.change_time,
            "change_reason": mc.change_reason,
        }
        for mc in manual_changes
    ]

    all_status_history = [
        {
            "id": sh.id,
            "check_result_id": sh.check_result_id,
            "old_status": sh.old_status,
            "new_status": sh.new_status,
            "changed_by": sh.changed_by,
            "change_reason": sh.change_reason,
            "change_time": sh.change_time,
            "step_context": sh.step_context,
        }
        for sh in status_history
    ]

    return {
        "evaluation_slice": EvaluationSliceResponse.model_validate(slice_obj),
        "feature_snapshots": [FeatureSnapshotResponse.model_validate(s) for s in snapshots],
        "check_results": results_with_history,
        "manual_changes": all_manual_changes,
        "status_history": all_status_history,
        "workflow_steps": [
            WorkflowStepResponse.model_validate(s) for s in slice_obj.workflow_steps
        ],
    }


@router.get("/manual-changes", response_model=List[ManualChangeResponse])
def list_manual_changes(
    evaluation_slice_id: Optional[int] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    workflow_service = WorkflowService(db)
    changes = workflow_service.get_manual_changes(evaluation_slice_id)
    return [ManualChangeResponse.model_validate(c) for c in changes[offset:offset+limit]]


@router.post("/manual-changes", response_model=ManualChangeResponse)
def create_manual_change(
    change_data: ManualChangeCreate,
    db: Session = Depends(get_db),
):
    workflow_service = WorkflowService(db)
    try:
        change = workflow_service.create_manual_change(change_data)
        return ManualChangeResponse.model_validate(change)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status-history", response_model=List[StatusHistoryResponse])
def list_status_history(
    evaluation_slice_id: Optional[int] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    workflow_service = WorkflowService(db)
    history = workflow_service.get_status_history(evaluation_slice_id)
    return [StatusHistoryResponse.model_validate(h) for h in history[offset:offset+limit]]


@router.get("/check-results", response_model=List[dict])
def list_check_results(
    check_status: Optional[str] = Query(None),
    check_type: Optional[str] = Query(None),
    needs_review: Optional[bool] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    check_service = CheckService(db)
    workflow_service = WorkflowService(db)
    results = check_service.get_check_results(
        check_status=check_status,
        check_type=check_type,
        needs_review=needs_review,
        limit=limit,
        offset=offset,
    )

    all_manual_changes = workflow_service.get_manual_changes()
    all_status_history = workflow_service.get_status_history()

    result_list = []
    for r in results:
        r_dict = CheckResultResponse.model_validate(r).model_dump()
        r_dict["related_manual_changes"] = [
            {
                "id": mc.id,
                "field_name": mc.field_name,
                "old_value": mc.old_value,
                "new_value": mc.new_value,
                "changed_by": mc.changed_by,
                "change_time": mc.change_time,
                "change_reason": mc.change_reason,
            }
            for mc in all_manual_changes if mc.evaluation_slice_id == r.evaluation_slice_id
        ]
        r_dict["related_status_history"] = [
            {
                "id": sh.id,
                "old_status": sh.old_status,
                "new_status": sh.new_status,
                "changed_by": sh.changed_by,
                "change_reason": sh.change_reason,
                "change_time": sh.change_time,
            }
            for sh in all_status_history if sh.evaluation_slice_id == r.evaluation_slice_id
        ]
        result_list.append(r_dict)

    return result_list


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
    workflow_service = WorkflowService(db)
    if new_status:
        result = workflow_service.update_check_result_status(
            result_id, new_status, reviewer, review_comment
        )
    else:
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
