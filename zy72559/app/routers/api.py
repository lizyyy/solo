from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models import EvalSlice, FeatureSnapshot, ConflictRecord, ExpandResult, SelfCheckRecord
from app.services.expand_service import (
    import_eval_slice,
    supplement_feature_snapshot,
    run_expand,
    get_abnormal_samples,
    get_all_results,
    review_abnormal_sample,
)
from app.services.conflict_detector import resolve_conflict, get_pending_conflicts
from app.services.self_checker import run_all_checks, get_latest_checks
from app.services.export_service import export_results

router = APIRouter(prefix="/api", tags=["API"])


@router.get("/slices")
def list_slices(db: Session = Depends(get_db)):
    slices = db.query(EvalSlice).order_by(EvalSlice.created_at.desc()).all()
    return {
        "data": [
            {
                "id": s.id,
                "slice_id": s.slice_id,
                "slice_name": s.slice_name,
                "feature_snapshot_id": s.feature_snapshot_id,
                "status": s.status,
                "total_users": s.total_users,
                "import_time": s.import_time.isoformat() if s.import_time else None,
                "imported_by": s.imported_by,
            }
            for s in slices
        ]
    }


@router.get("/slices/{slice_id}")
def get_slice(slice_id: int, db: Session = Depends(get_db)):
    slice_obj = db.query(EvalSlice).filter(EvalSlice.id == slice_id).first()
    if not slice_obj:
        raise HTTPException(status_code=404, detail="评测切片不存在")
    
    pending_conflicts = get_pending_conflicts(db, slice_id)
    self_checks = get_latest_checks(db, slice_id)
    
    results_count = db.query(ExpandResult).filter(ExpandResult.eval_slice_id == slice_id).count()
    abnormal_count = db.query(ExpandResult).filter(
        ExpandResult.eval_slice_id == slice_id,
        ExpandResult.is_abnormal == True
    ).count()
    need_review_count = db.query(ExpandResult).filter(
        ExpandResult.eval_slice_id == slice_id,
        ExpandResult.need_review == True
    ).count()
    
    return {
        "data": {
            "id": slice_obj.id,
            "slice_id": slice_obj.slice_id,
            "slice_name": slice_obj.slice_name,
            "feature_snapshot_id": slice_obj.feature_snapshot_id,
            "status": slice_obj.status,
            "total_users": slice_obj.total_users,
            "time_window_start": slice_obj.time_window_start.isoformat() if slice_obj.time_window_start else None,
            "time_window_end": slice_obj.time_window_end.isoformat() if slice_obj.time_window_end else None,
            "import_time": slice_obj.import_time.isoformat() if slice_obj.import_time else None,
            "imported_by": slice_obj.imported_by,
            "results_count": results_count,
            "abnormal_count": abnormal_count,
            "need_review_count": need_review_count,
        },
        "pending_conflicts": [
            {
                "id": c.id,
                "conflict_type": c.conflict_type,
                "description": c.description,
                "evidence": c.evidence,
                "created_at": c.created_at.isoformat(),
            }
            for c in pending_conflicts
        ],
        "self_checks": [
            {
                "id": s.id,
                "check_type": s.check_type,
                "check_name": s.check_name,
                "passed": s.passed,
                "error_count": s.error_count,
                "details": s.details,
            }
            for s in self_checks
        ],
    }


@router.post("/slices/import")
def api_import_slice(
    slice_id: str = Query(...),
    slice_name: str = Query(...),
    total_users: int = Query(...),
    time_window_start: Optional[str] = Query(None),
    time_window_end: Optional[str] = Query(None),
    feature_snapshot_id: Optional[str] = Query(None),
    operator: str = Query("小孟"),
    db: Session = Depends(get_db),
):
    try:
        eval_slice, conflicts = import_eval_slice(
            db, slice_id, slice_name, total_users,
            time_window_start, time_window_end, feature_snapshot_id, operator
        )
        return {
            "success": True,
            "data": {
                "id": eval_slice.id,
                "slice_id": eval_slice.slice_id,
            },
            "conflicts": conflicts,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slices/{slice_id}/supplement-snapshot")
def api_supplement_snapshot(
    slice_id: int,
    feature_snapshot_id: str = Query(...),
    operator: str = Query("小孟"),
    db: Session = Depends(get_db),
):
    try:
        eval_slice, conflicts = supplement_feature_snapshot(
            db, slice_id, feature_snapshot_id, operator
        )
        return {
            "success": True,
            "data": {
                "id": eval_slice.id,
                "feature_snapshot_id": eval_slice.feature_snapshot_id,
            },
            "conflicts": conflicts,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slices/{slice_id}/run-expand")
def api_run_expand(
    slice_id: int,
    operator: str = Query("小孟"),
    db: Session = Depends(get_db),
):
    try:
        result = run_expand(db, slice_id, operator)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/slices/{slice_id}/results")
def api_get_results(
    slice_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return get_all_results(db, slice_id, page, page_size)


@router.get("/slices/{slice_id}/abnormal-samples")
def api_get_abnormal_samples(
    slice_id: int,
    only_need_review: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return get_abnormal_samples(db, slice_id, only_need_review, page, page_size)


@router.post("/results/{result_id}/review")
def api_review_sample(
    result_id: int,
    review_status: str = Query(...),
    operator: str = Query(...),
    db: Session = Depends(get_db),
):
    if review_status not in ["confirmed_normal", "confirmed_abnormal"]:
        raise HTTPException(status_code=400, detail="无效的复核状态")
    
    result = review_abnormal_sample(db, result_id, review_status, operator)
    if not result:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    return {"success": True}


@router.post("/conflicts/{conflict_id}/resolve")
def api_resolve_conflict(
    conflict_id: int,
    resolution: str = Query(...),
    operator: str = Query("小孟"),
    db: Session = Depends(get_db),
):
    if resolution not in ["confirmed", "rejected"]:
        raise HTTPException(status_code=400, detail="无效的处理方式，必须是 confirmed 或 rejected")
    
    conflict = resolve_conflict(db, conflict_id, resolution, operator)
    if not conflict:
        raise HTTPException(status_code=404, detail="冲突记录不存在")
    
    return {"success": True}


@router.post("/slices/{slice_id}/self-check")
def api_run_self_check(
    slice_id: int,
    db: Session = Depends(get_db),
):
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == slice_id).first()
    if not eval_slice:
        raise HTTPException(status_code=404, detail="评测切片不存在")
    
    checks = run_all_checks(db, eval_slice)
    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "check_type": c.check_type,
                "check_name": c.check_name,
                "passed": c.passed,
                "error_count": c.error_count,
                "details": c.details,
            }
            for c in checks
        ],
    }


@router.get("/slices/{slice_id}/export")
def api_export_results(
    slice_id: int,
    abnormal_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    eval_slice = db.query(EvalSlice).filter(EvalSlice.id == slice_id).first()
    if not eval_slice:
        raise HTTPException(status_code=404, detail="评测切片不存在")
    
    output = export_results(db, slice_id, abnormal_only)
    filename = f"扩展结果_{eval_slice.slice_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/snapshots")
def list_snapshots(db: Session = Depends(get_db)):
    snapshots = db.query(FeatureSnapshot).order_by(FeatureSnapshot.snapshot_time.desc()).all()
    return {
        "data": [
            {
                "id": s.id,
                "snapshot_id": s.snapshot_id,
                "snapshot_name": s.snapshot_name,
                "snapshot_time": s.snapshot_time.isoformat(),
                "feature_version": s.feature_version,
                "total_users": s.total_users,
            }
            for s in snapshots
        ]
    }


@router.post("/snapshots/init")
def init_snapshots(db: Session = Depends(get_db)):
    existing = db.query(FeatureSnapshot).count()
    if existing > 0:
        return {"success": True, "message": "已存在特征快照数据"}
    
    from datetime import timedelta as td
    mock_snapshots = [
        FeatureSnapshot(
            snapshot_id="SNAP_20260501_V1",
            snapshot_name="2026年5月上旬特征快照V1",
            snapshot_time=datetime(2026, 5, 5),
            feature_version="v1.2.0",
            total_users=500000,
        ),
        FeatureSnapshot(
            snapshot_id="SNAP_20260515_V2",
            snapshot_name="2026年5月中旬特征快照V2",
            snapshot_time=datetime(2026, 5, 15),
            feature_version="v1.2.1",
            total_users=520000,
        ),
        FeatureSnapshot(
            snapshot_id="SNAP_20260601_V3",
            snapshot_name="2026年6月上旬特征快照V3",
            snapshot_time=datetime(2026, 6, 5),
            feature_version="v1.3.0",
            total_users=550000,
        ),
    ]
    
    for s in mock_snapshots:
        db.add(s)
    db.commit()
    
    return {"success": True, "count": len(mock_snapshots)}
