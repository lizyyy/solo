from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..schemas.schemas import (
    TermMatchRequest,
    TermMatchResponse
)
from ..services import MatchService

router = APIRouter(prefix="/api/match", tags=["命中检测"])

match_service = MatchService()


@router.post("/single", response_model=TermMatchResponse, summary="单词命中检测")
def match_single(request: TermMatchRequest, db: Session = Depends(get_db)):
    try:
        return match_service.match_term(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch", response_model=List[TermMatchResponse], summary="批量命中检测")
def match_batch(
    terms: List[str],
    library_id: Optional[int] = None,
    include_gray: bool = False,
    db: Session = Depends(get_db)
):
    if not terms:
        raise HTTPException(status_code=400, detail="搜索词列表不能为空")
    
    if len(terms) > 100:
        raise HTTPException(status_code=400, detail="单次批量检测最多支持100个词")
    
    return match_service.batch_match_terms(
        db=db,
        terms=terms,
        library_id=library_id,
        include_gray=include_gray
    )


@router.get("/production/summary", summary="获取生产环境命中统计")
def get_production_summary(library_id: Optional[int] = None, db: Session = Depends(get_db)):
    return match_service.get_match_summary(db, library_id)


@router.get("/test-modes", summary="获取支持的匹配模式")
def get_match_modes():
    return {
        "modes": [
            {"code": "exact", "name": "精确匹配", "description": "搜索词与规则词完全一致"},
            {"code": "contains", "name": "包含匹配", "description": "搜索词包含规则词"},
            {"code": "prefix", "name": "前缀匹配", "description": "搜索词以规则词开头"},
            {"code": "suffix", "name": "后缀匹配", "description": "搜索词以规则词结尾"},
            {"code": "regex", "name": "正则匹配", "description": "使用正则表达式匹配"}
        ],
        "priority_order": ["exact", "regex", "prefix", "suffix", "contains"]
    }
