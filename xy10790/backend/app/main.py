from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import os
import pandas as pd
from io import BytesIO

from .database import engine, get_db, Base
from . import models, schemas, services

Base.metadata.create_all(bind=engine)

app = FastAPI(title="在线课程进度API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exports")
os.makedirs(EXPORTS_DIR, exist_ok=True)


@app.post("/api/progress", response_model=schemas.ApiResponse)
def create_progress(
    progress_data: schemas.StudentProgressCreate,
    db: Session = Depends(get_db),
    x_request_id: Optional[str] = Header(None)
):
    request_id = progress_data.request_id or x_request_id or str(uuid.uuid4())
    
    existing = services.check_idempotent_request(db, request_id)
    if existing:
        return schemas.ApiResponse(
            success=True,
            message="请求已处理（幂等）",
            data=existing.response_data,
            request_id=request_id
        )
    
    try:
        progress = services.create_student_progress(db, progress_data)
        
        response_data = {"id": progress.id, "student_id": progress.student_id}
        services.save_idempotent_response(db, request_id, "/api/progress", progress_data.model_dump(), response_data)
        
        services.log_operation(db, "create", "progress", str(progress.id), None, response_data, None)
        
        return schemas.ApiResponse(
            success=True,
            message="学员进度创建成功",
            data=response_data,
            request_id=request_id
        )
    except Exception as e:
        services.log_operation(db, "create", "progress", None, None, None, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progress", response_model=schemas.ApiResponse)
def list_progress(
    student_id: Optional[str] = None,
    course_id: Optional[str] = None,
    status: Optional[str] = None,
    has_abnormal_tasks: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    try:
        total, progress_list = services.get_student_progress_list(
            db, student_id, course_id, status, has_abnormal_tasks, page, page_size
        )
        
        return schemas.ApiResponse(
            success=True,
            message="查询成功",
            data={
                "total": total,
                "items": progress_list,
                "page": page,
                "page_size": page_size
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progress/{progress_id}", response_model=schemas.ApiResponse)
def get_progress_detail(progress_id: int, db: Session = Depends(get_db)):
    progress = services.get_progress_by_id(db, progress_id)
    if not progress:
        raise HTTPException(status_code=404, detail="进度记录不存在")
    
    return schemas.ApiResponse(
        success=True,
        message="查询成功",
        data=progress
    )


@app.put("/api/progress/{progress_id}", response_model=schemas.ApiResponse)
def update_progress(
    progress_id: int,
    update_data: schemas.StudentProgressUpdate,
    db: Session = Depends(get_db)
):
    try:
        progress = services.update_student_progress(db, progress_id, update_data)
        if not progress:
            raise HTTPException(status_code=404, detail="进度记录不存在")
        
        services.log_operation(db, "update", "progress", str(progress_id), None, update_data.model_dump(), None)
        
        return schemas.ApiResponse(
            success=True,
            message="更新成功",
            data={"id": progress_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        services.log_operation(db, "update", "progress", str(progress_id), None, None, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/remedial-tasks/review", response_model=schemas.ApiResponse)
def review_remedial_task(
    review_data: schemas.ReviewRemedialTaskRequest,
    db: Session = Depends(get_db)
):
    try:
        task = services.review_remedial_task(db, review_data)
        if not task:
            raise HTTPException(status_code=404, detail="补学任务不存在")
        
        services.log_operation(
            db, "review", "remedial_task", str(review_data.task_id),
            None, review_data.model_dump(), None
        )
        
        return schemas.ApiResponse(
            success=True,
            message="补学任务复核成功",
            data={"task_id": review_data.task_id, "status": review_data.status}
        )
    except HTTPException:
        raise
    except Exception as e:
        services.log_operation(db, "review", "remedial_task", str(review_data.task_id), None, None, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/remedial-tasks/abnormal", response_model=schemas.ApiResponse)
def get_abnormal_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total, tasks = services.get_abnormal_remedial_tasks(db, page, page_size)
    
    return schemas.ApiResponse(
        success=True,
        message="查询成功",
        data={
            "total": total,
            "items": tasks,
            "page": page,
            "page_size": page_size
        }
    )


@app.post("/api/certificates/confirm", response_model=schemas.ApiResponse)
def confirm_certificate_eligibility(
    confirm_data: schemas.ConfirmCertificateRequest,
    db: Session = Depends(get_db)
):
    try:
        eligibility = services.confirm_certificate_eligibility(db, confirm_data)
        if not eligibility:
            raise HTTPException(status_code=404, detail="证书资格记录不存在")
        
        services.log_operation(
            db, "confirm", "certificate", str(confirm_data.eligibility_id),
            None, confirm_data.model_dump(), None
        )
        
        return schemas.ApiResponse(
            success=True,
            message="证书资格确认成功",
            data={
                "eligibility_id": confirm_data.eligibility_id,
                "is_eligible": confirm_data.is_eligible
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        services.log_operation(db, "confirm", "certificate", str(confirm_data.eligibility_id), None, None, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/certificates", response_model=schemas.ApiResponse)
def list_certificates(
    student_id: Optional[str] = None,
    course_id: Optional[str] = None,
    is_eligible: Optional[bool] = None,
    manual_confirmation: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total, certificates = services.get_certificate_list(
        db, student_id, course_id, is_eligible, manual_confirmation, page, page_size
    )
    
    return schemas.ApiResponse(
        success=True,
        message="查询成功",
        data={
            "total": total,
            "items": certificates,
            "page": page,
            "page_size": page_size
        }
    )


@app.post("/api/export", response_model=schemas.ApiResponse)
def export_data(
    export_request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    try:
        report_id = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        file_path = services.export_to_excel(db, export_request, report_id, EXPORTS_DIR)
        
        report = services.create_learning_report(
            db, report_id, export_request.export_type,
            f"{export_request.export_type}_{datetime.now().strftime('%Y%m%d')}",
            "system", file_path, export_request.filters
        )
        
        services.log_operation(db, "export", export_request.export_type, report_id, None, export_request.model_dump(), None)
        
        return schemas.ApiResponse(
            success=True,
            message="导出成功",
            data={
                "report_id": report_id,
                "file_name": os.path.basename(file_path),
                "download_url": f"/api/reports/{report_id}/download"
            }
        )
    except Exception as e:
        services.log_operation(db, "export", export_request.export_type, None, None, None, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports", response_model=schemas.ApiResponse)
def list_reports(
    report_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total, reports = services.get_report_list(db, report_type, page, page_size)
    
    return schemas.ApiResponse(
        success=True,
        message="查询成功",
        data={
            "total": total,
            "items": reports,
            "page": page,
            "page_size": page_size
        }
    )


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db)):
    report = services.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报表不存在")
    
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=report.file_path,
        filename=os.path.basename(report.file_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/api/operation-logs", response_model=schemas.ApiResponse)
def list_operation_logs(
    operation_type: Optional[str] = None,
    target_type: Optional[str] = None,
    has_error: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    total, logs = services.get_operation_logs(db, operation_type, target_type, has_error, page, page_size)
    
    return schemas.ApiResponse(
        success=True,
        message="查询成功",
        data={
            "total": total,
            "items": logs,
            "page": page,
            "page_size": page_size
        }
    )


@app.get("/api/statistics", response_model=schemas.ApiResponse)
def get_statistics(db: Session = Depends(get_db)):
    stats = services.get_statistics(db)
    
    return schemas.ApiResponse(
        success=True,
        message="查询成功",
        data=stats
    )


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
