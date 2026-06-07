from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import TodoExtract
from schemas import (
    TodoExtractCreate, TodoExtractUpdate, TodoExtractResponse,
    ManualJudgmentRequest, AuditLogResponse
)
from services.unified_data_service import UnifiedDataService
from services.audit_service import create_manual_judgment, get_todo_audit_logs, get_review_traces

router = APIRouter(prefix="/api/todos", tags=["待办抽取"])


@router.get("", response_model=dict)
def get_todos(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    gray_batch_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return UnifiedDataService.get_page_data(
        db, page=page, page_size=page_size,
        gray_batch_id=gray_batch_id, status=status
    )


@router.get("/{todo_id}", response_model=dict)
def get_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = UnifiedDataService.get_todo_detail(db, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return UnifiedDataService._serialize_todos([todo])[0]


@router.post("", response_model=TodoExtractResponse)
def create_todo(todo_data: TodoExtractCreate, db: Session = Depends(get_db)):
    todo = TodoExtract(**todo_data.dict())
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.put("/{todo_id}", response_model=TodoExtractResponse)
def update_todo(todo_id: int, update_data: TodoExtractUpdate, db: Session = Depends(get_db)):
    todo = db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(todo, key, value)
    db.commit()
    db.refresh(todo)
    return todo


@router.post("/manual-judgment")
def manual_judgment(request: ManualJudgmentRequest, db: Session = Depends(get_db)):
    try:
        todo, judgment = create_manual_judgment(
            db, request.todo_id, request.judge_by,
            request.changes, request.reason
        )
        return {
            "code": 0,
            "message": "人工改判成功",
            "data": {
                "todo_id": todo.id,
                "judgment_id": judgment.id,
                "impact_analysis": judgment.impact_analysis
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{todo_id}/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(todo_id: int, db: Session = Depends(get_db)):
    return get_todo_audit_logs(db, todo_id)


@router.get("/{todo_id}/review-traces")
def get_review_traces_api(todo_id: int, db: Session = Depends(get_db)):
    return get_review_traces(db, todo_id)


@router.get("/export/data")
def export_data_api(
    export_format: str = Query("xlsx", regex="^(xlsx|csv|json)$"),
    gray_batch_id: Optional[int] = None,
    status: Optional[str] = None,
    exported_by: str = "system",
    db: Session = Depends(get_db)
):
    file_content, export_record = UnifiedDataService.export_todos(
        db, export_format=export_format,
        gray_batch_id=gray_batch_id, status=status,
        exported_by=exported_by
    )
    return {
        "code": 0,
        "message": "导出成功",
        "data": {
            "export_id": export_record.id,
            "record_count": export_record.record_count,
            "data_hash": export_record.data_hash,
            "file_format": export_format,
            "note": "数据与页面展示、API接口返回为同一份数据源"
        }
    }


@router.get("/unified/api-response")
def get_unified_api_response(
    todo_ids: Optional[str] = None,
    gray_batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    todo_id_list = [int(x) for x in todo_ids.split(",")] if todo_ids else None
    return UnifiedDataService.get_api_response(db, todo_ids=todo_id_list, gray_batch_id=gray_batch_id)
