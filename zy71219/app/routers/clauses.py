from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LcClause, LetterOfCredit
from app.schemas import (
    LcClause as LcClauseSchema,
    LcClauseCreate,
    ClauseParseRequest,
    ClauseParseResult,
    ApiResponse,
)
from app.core import ClauseParser

router = APIRouter(prefix="/api/clauses", tags=["条款解析"])


@router.post("/parse", response_model=ApiResponse)
def parse_clauses(request: ClauseParseRequest):
    if not request.clauses_text:
        raise HTTPException(status_code=400, detail="请提供信用证条款文本")

    parser = ClauseParser()
    results = parser.parse(request.clauses_text)

    return ApiResponse(
        success=True,
        message=f"成功解析 {len(results)} 条条款",
        data={"clauses": [r.model_dump() for r in results]}
    )


@router.get("", response_model=ApiResponse)
def get_clauses(
    lc_id: int = None,
    clause_type: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(LcClause)

    if lc_id:
        query = query.filter(LcClause.lc_id == lc_id)

    if clause_type:
        query = query.filter(LcClause.clause_type == clause_type)

    clauses = query.order_by(LcClause.clause_number).offset(skip).limit(limit).all()

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": query.count(), "items": [LcClauseSchema.model_validate(c) for c in clauses]}
    )


@router.post("", response_model=ApiResponse)
def create_clause(clause_data: LcClauseCreate, lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    clause = LcClause(
        lc_id=lc_id,
        clause_number=clause_data.clause_number,
        clause_type=clause_data.clause_type,
        content=clause_data.content,
        parsed_fields=clause_data.parsed_fields,
        remarks=clause_data.remarks,
    )

    db.add(clause)
    db.commit()
    db.refresh(clause)

    return ApiResponse(
        success=True,
        message="条款创建成功",
        data=LcClauseSchema.model_validate(clause)
    )


@router.post("/{lc_id}/parse-and-save", response_model=ApiResponse)
def parse_and_save_clauses(lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    if not lc.clauses_text:
        return ApiResponse(
            success=False,
            message="信用证没有条款文本，请先更新 clauses_text 字段",
            data={"lc_id": lc_id}
        )

    parser = ClauseParser()
    parsed_clauses = parser.parse(lc.clauses_text)

    saved_clauses = []
    for pc in parsed_clauses:
        existing = db.query(LcClause).filter(
            LcClause.lc_id == lc_id,
            LcClause.clause_number == pc.clause_number,
        ).first()

        if existing:
            existing.content = pc.content
            existing.clause_type = pc.clause_type
            existing.parsed_fields = pc.parsed_fields
            clause = existing
        else:
            clause = LcClause(
                lc_id=lc_id,
                clause_number=pc.clause_number,
                clause_type=pc.clause_type,
                content=pc.content,
                parsed_fields=pc.parsed_fields,
            )
            db.add(clause)

        db.flush()
        saved_clauses.append(LcClauseSchema.model_validate(clause))

    db.commit()

    return ApiResponse(
        success=True,
        message=f"成功解析并保存 {len(saved_clauses)} 条条款",
        data={"clauses": saved_clauses}
    )
