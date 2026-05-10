from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.schemas import (
    CodeCreate, CodeIssue, CodeRecycle, CodeResponse, CodeListResponse
)
from app.services import generate_codes, get_codes, issue_codes, recycle_codes

router = APIRouter(prefix="/api/codes", tags=["溯源码管理"])


@router.post("/generate", response_model=List[CodeResponse])
def api_generate_codes(
    data: CodeCreate,
    db: Session = Depends(get_db)
):
    codes = generate_codes(db, data.count, data.cooperative_id)
    return codes


@router.get("", response_model=CodeListResponse)
def api_list_codes(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    cooperative_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    codes, total = get_codes(db, skip, limit, status, cooperative_id)
    return {"codes": codes, "total": total}


@router.post("/issue")
def api_issue_codes(
    data: CodeIssue,
    db: Session = Depends(get_db)
):
    issued, invalid = issue_codes(db, data.codes, data.farmer_id, data.cooperative_id)
    return {
        "issued_count": len(issued),
        "invalid_count": len(invalid),
        "issued_codes": [{"id": c.id, "code": c.code} for c in issued],
        "invalid_codes": invalid
    }


@router.post("/recycle")
def api_recycle_codes(
    data: CodeRecycle,
    db: Session = Depends(get_db)
):
    recycled, invalid = recycle_codes(db, data.codes)
    return {
        "recycled_count": len(recycled),
        "invalid_count": len(invalid),
        "recycled_codes": [{"id": c.id, "code": c.code} for c in recycled],
        "invalid_codes": invalid
    }
