from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, allow_supervisor, allow_reviewer
from app.models import User
from app.schemas import ApiResponse
from app.services import ReplayService

router = APIRouter()


@router.post("/generate-samples", response_model=ApiResponse, dependencies=[Depends(allow_supervisor)])
def generate_sample_records(
    count: int = Query(10, ge=1, le=100, description="生成样例数量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = ReplayService.generate_sample_data(db, current_user.id, count)
    return ApiResponse(
        data={
            "generated_count": len(records),
            "record_ids": [r.id for r in records]
        },
        message=f"成功生成 {len(records)} 条样例验收记录"
    )


@router.post("/generate-bad-data", response_model=ApiResponse, dependencies=[Depends(allow_supervisor)])
def generate_bad_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ReplayService.generate_bad_data(db, current_user.id)
    return ApiResponse(
        data={
            "missing_attachment_id": result["missing_attachment"].id,
            "duplicate_submit_id": result["duplicate_submit"].id,
            "manual_fix_id": result["manual_fix"].id
        },
        message="成功生成3条坏数据样例：缺附件、重复提交、人工改判"
    )


@router.post("/reconcile", response_model=ApiResponse, dependencies=[Depends(allow_reviewer)])
def reconcile_all_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ReplayService.reconcile_records(db, current_user.id)
    return ApiResponse(
        data=result,
        message=f"对账完成：共处理 {result['total_processed']} 条，匹配 {result['matched']} 条，不匹配 {result['unmatched']} 条"
    )


@router.post("/failed/{failed_id}/replay", response_model=ApiResponse, dependencies=[Depends(allow_reviewer)])
def replay_failed_record(
    failed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ReplayService.replay_failed_record(db, failed_id, current_user.id)
    return ApiResponse(
        success=result.get("success", False),
        data=result,
        message=result.get("message", "回放操作完成")
    )
