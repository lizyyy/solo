from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas, crud

router = APIRouter(prefix="/review", tags=["复核管理"])


@router.post("/trigger")
def trigger_review_process(
    request: schemas.ReviewRequest,
    db: Session = Depends(get_db)
):
    db_material = crud.trigger_review(
        db,
        material_id=request.material_id,
        reviewer=request.reviewer,
        review_comment=request.review_comment,
        review_result=request.review_result
    )
    if db_material is None:
        raise HTTPException(status_code=404, detail="材料不存在")
    return {
        "message": "复核流程已触发",
        "material": db_material
    }


@router.post("/complete")
def complete_review_process(
    material_id: int,
    reviewer: str,
    final_conclusion: str,
    change_reason: str,
    db: Session = Depends(get_db)
):
    db_material = crud.complete_review(
        db,
        material_id=material_id,
        reviewer=reviewer,
        final_conclusion=final_conclusion,
        change_reason=change_reason
    )
    if db_material is None:
        raise HTTPException(status_code=404, detail="材料不存在")
    return {
        "message": "复核已完成",
        "material": db_material
    }
