from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from ..core.database import get_db
from ..schemas.schemas import (
    RunRequestCreate, RunRequestUpdate, RunRequest as RunRequestSchema,
    RunRequestListResponse, StudentCreate, Student as StudentSchema,
    LanguageEnvironmentCreate, LanguageEnvironment as LanguageSchema,
    BatchImportRequest, QuotaCheckResponse, ReportData, StatusHistory
)
from ..services.request_service import RequestService
from ..services.quota_service import QuotaService
from ..services.report_service import ReportService
from ..models.models import Student, LanguageEnvironment, RequestStatus

router = APIRouter()


@router.post("/students/", response_model=StudentSchema)
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    db_student = Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


@router.get("/students/", response_model=List[StudentSchema])
def list_students(db: Session = Depends(get_db)):
    return db.query(Student).all()


@router.get("/students/{student_id}/quota", response_model=QuotaCheckResponse)
def check_student_quota(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    quota_info = QuotaService.check_quota(db, student.id)
    return {
        "student_id": student_id,
        **quota_info
    }


@router.post("/languages/", response_model=LanguageSchema)
def create_language(language: LanguageEnvironmentCreate, db: Session = Depends(get_db)):
    db_lang = LanguageEnvironment(**language.model_dump())
    db.add(db_lang)
    db.commit()
    db.refresh(db_lang)
    return db_lang


@router.get("/languages/", response_model=List[LanguageSchema])
def list_languages(db: Session = Depends(get_db)):
    return db.query(LanguageEnvironment).all()


@router.post("/requests/", response_model=RunRequestSchema)
def create_request(request: RunRequestCreate, db: Session = Depends(get_db)):
    try:
        db_request, is_merged = RequestService.create_request(db, request)
        if not is_merged:
            RequestService.execute_request(db_request.request_id)
        return db_request
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/requests/", response_model=RunRequestListResponse)
def list_requests(
    student_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    requests, total = RequestService.list_requests(db, student_id, status, language, page, page_size)
    return {
        "items": requests,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/requests/{request_id}", response_model=RunRequestSchema)
def get_request(request_id: str, db: Session = Depends(get_db)):
    request = RequestService.get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在")
    return request


@router.get("/requests/{request_id}/timeline", response_model=List[StatusHistory])
def get_request_timeline(request_id: str, db: Session = Depends(get_db)):
    timeline = RequestService.get_request_timeline(db, request_id)
    return timeline


@router.patch("/requests/{request_id}", response_model=RunRequestSchema)
def update_request(
    request_id: str,
    update_data: RunRequestUpdate,
    manual: bool = Query(False, description="是否人工修正"),
    db: Session = Depends(get_db)
):
    request = RequestService.update_request_status(db, request_id, update_data, manual)
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在")
    return request


@router.post("/requests/{request_id}/cancel", response_model=RunRequestSchema)
def cancel_request(request_id: str, db: Session = Depends(get_db)):
    request = RequestService.cancel_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在")
    return request


@router.post("/requests/batch-import")
def batch_import_requests(import_data: BatchImportRequest, db: Session = Depends(get_db)):
    results = []
    for item in import_data.items:
        student = db.query(Student).filter(Student.student_id == item.student_id).first()
        if not student:
            results.append({"student_id": item.student_id, "success": False, "error": "学生不存在"})
            continue

        language = db.query(LanguageEnvironment).filter(LanguageEnvironment.name == item.language).first()
        if not language:
            results.append({"student_id": item.student_id, "success": False, "error": f"语言{item.language}不存在"})
            continue

        try:
            request_data = RunRequestCreate(
                student_id=student.id,
                language_id=language.id,
                code_snippet=item.code_snippet,
                input_data=item.input_data
            )
            db_request, is_merged = RequestService.create_request(db, request_data)
            if not is_merged:
                RequestService.execute_request(db_request.request_id)
            results.append({
                "student_id": item.student_id,
                "success": True,
                "request_id": db_request.request_id,
                "status": db_request.status,
                "is_merged": is_merged
            })
        except ValueError as e:
            results.append({"student_id": item.student_id, "success": False, "error": str(e)})

    return {"total": len(import_data.items), "results": results}


@router.get("/report/stats", response_model=ReportData)
def get_report_stats(days: int = Query(7, ge=1, le=30), db: Session = Depends(get_db)):
    return ReportService.generate_report_data(db, days)


@router.get("/report/export/csv")
def export_csv(db: Session = Depends(get_db)):
    csv_data = ReportService.export_to_csv(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=code_runner_report_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )


@router.get("/report/export/excel")
def export_excel(db: Session = Depends(get_db)):
    excel_data = ReportService.export_to_excel(db)
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=code_runner_report_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"}
    )


@router.get("/statuses")
def get_statuses():
    return [status.value for status in RequestStatus]
