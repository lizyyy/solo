from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas import (
    MergeInitiateRequest, MergePreviewRequest, 
    MergeReviewRequest, MergeActionRequest,
    MergeQueryRequest,
    APIResponse, MergeRecordResponse,
    MergeHistoryResponse, ManualReviewResponse,
    MemberResponse, TransactionResponse
)
from app.services import MergeService

router = APIRouter(prefix="/api/merges", tags=["并卡管理"])

@router.post("/preview", response_model=APIResponse)
def preview_merge(request: MergePreviewRequest, db: Session = Depends(get_db)):
    try:
        preview = MergeService.preview_merge(db, request.source_member_no, request.target_member_no)
        return APIResponse(
            success=True,
            code="PREVIEW_READY",
            message="资产试算完成",
            data=preview.model_dump()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="PREVIEW_FAILED",
            message=str(e),
            data=None
        )

@router.post("/initiate", response_model=APIResponse)
def initiate_merge(request: MergeInitiateRequest, db: Session = Depends(get_db)):
    try:
        record, status = MergeService.initiate_merge(
            db,
            request.source_member_no,
            request.target_member_no,
            request.reason,
            request.operator or "system",
            request.idempotency_key
        )
        msg = "并卡申请已创建" if status == "new" else "幂等请求，返回已有记录"
        return APIResponse(
            success=True,
            code="MERGE_INITIATED",
            message=msg,
            data={
                "merge": MergeRecordResponse.model_validate(record).model_dump(),
                "is_idempotent": status == "idempotent"
            }
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="INITIATE_FAILED",
            message=str(e),
            data=None
        )

@router.post("/review", response_model=APIResponse)
def review_conflict(request: MergeReviewRequest, db: Session = Depends(get_db)):
    try:
        record = MergeService.review_conflict(
            db,
            request.merge_no,
            request.conflict_type,
            request.decision,
            request.after_value,
            request.explanation,
            request.operator
        )
        return APIResponse(
            success=True,
            code="REVIEW_COMPLETED",
            message=f"冲突审核完成，当前状态: {record.status}",
            data=MergeRecordResponse.model_validate(record).model_dump()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="REVIEW_FAILED",
            message=str(e),
            data=None
        )

@router.post("/confirm", response_model=APIResponse)
def confirm_merge(request: MergeActionRequest, db: Session = Depends(get_db)):
    try:
        record = MergeService.confirm_merge(
            db,
            request.merge_no,
            request.operator or "operator",
            request.remark
        )
        return APIResponse(
            success=True,
            code="MERGE_COMPLETED",
            message=f"并卡执行完成",
            data=MergeRecordResponse.model_validate(record).model_dump()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="CONFIRM_FAILED",
            message=str(e),
            data=None
        )

@router.post("/cancel", response_model=APIResponse)
def cancel_merge(request: MergeActionRequest, db: Session = Depends(get_db)):
    try:
        record = MergeService.cancel_merge(
            db,
            request.merge_no,
            request.operator or "operator",
            request.remark
        )
        return APIResponse(
            success=True,
            code="MERGE_CANCELLED",
            message=f"并卡已撤销",
            data=MergeRecordResponse.model_validate(record).model_dump()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="CANCEL_FAILED",
            message=str(e),
            data=None
        )

@router.get("/{merge_no}", response_model=APIResponse)
def get_merge_detail(merge_no: str, db: Session = Depends(get_db)):
    detail = MergeService.get_merge_detail(db, merge_no)
    if not detail:
        return APIResponse(
            success=False,
            code="MERGE_NOT_FOUND",
            message=f"并卡记录 {merge_no} 不存在",
            data=None
        )
    
    histories = [MergeHistoryResponse.model_validate(h).model_dump() for h in detail["histories"]]
    reviews = [ManualReviewResponse.model_validate(r).model_dump() for r in detail["reviews"]]
    source = MemberResponse.model_validate(detail["source_member"]).model_dump() if detail["source_member"] else None
    target = MemberResponse.model_validate(detail["target_member"]).model_dump() if detail["target_member"] else None
    source_transactions = [TransactionResponse.model_validate(t).model_dump() for t in detail["source_transactions"]]
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "merge": MergeRecordResponse.model_validate(detail["merge"]).model_dump(),
            "histories": histories,
            "reviews": reviews,
            "source_member": source,
            "target_member": target,
            "source_transactions": source_transactions
        }
    )

@router.post("/query", response_model=APIResponse)
def query_merges(request: MergeQueryRequest, db: Session = Depends(get_db)):
    records = MergeService.query_merges(
        db,
        request.merge_no,
        request.status,
        request.phone
    )
    return APIResponse(
        success=True,
        code="OK",
        message=f"找到 {len(records)} 条并卡记录",
        data=[MergeRecordResponse.model_validate(r).model_dump() for r in records]
    )
