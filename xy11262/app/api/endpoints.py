from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    Hazard, HazardStatus, HazardLevel,
    Rectification, Review, ReviewResult,
    ImportRecord, ImportType
)
from app.schemas.common import ApiResponse, BadRecordCreate
from app.schemas.hazard import HazardCreate, HazardUpdate
from app.schemas.rectification import RectificationBase
from app.schemas.review import ReviewBase
from app.services.import_service import ImportService
from app.services.workflow_service import WorkflowService
from app.services.export_service import ExportService

api_router = APIRouter()


@api_router.get("/health", response_model=ApiResponse)
async def health_check():
    return ApiResponse(success=True, message="API is healthy", data={"timestamp": datetime.utcnow().isoformat()})


@api_router.get("/hazards", response_model=ApiResponse)
async def get_hazards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    level: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Hazard)
    
    if status:
        try:
            query = query.filter(Hazard.status == HazardStatus(status))
        except ValueError:
            pass
    if level:
        try:
            query = query.filter(Hazard.level == HazardLevel(level))
        except ValueError:
            pass
    if department:
        query = query.filter(Hazard.department == department)
    
    total = query.count()
    hazards = query.order_by(Hazard.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    hazard_list = []
    for h in hazards:
        hazard_dict = {
            'id': h.id,
            'hazard_code': h.hazard_code,
            'title': h.title,
            'description': h.description,
            'location': h.location,
            'level': h.level.value,
            'status': h.status.value,
            'discovered_by': h.discovered_by,
            'discovered_at': h.discovered_at.isoformat() if h.discovered_at else None,
            'department': h.department,
            'category': h.category,
            'responsible_person': h.responsible_person,
            'responsible_phone': h.responsible_phone,
            'deadline': h.deadline.isoformat() if h.deadline else None,
            'closed_at': h.closed_at.isoformat() if h.closed_at else None,
            'closed_by': h.closed_by,
            'created_at': h.created_at.isoformat(),
            'updated_at': h.updated_at.isoformat()
        }
        hazard_list.append(hazard_dict)
    
    return ApiResponse(
        success=True,
        message="获取隐患列表成功",
        data={
            "items": hazard_list,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    )


@api_router.get("/hazards/{hazard_id}", response_model=ApiResponse)
async def get_hazard(hazard_id: int, db: Session = Depends(get_db)):
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    hazard_dict = {
        'id': hazard.id,
        'hazard_code': hazard.hazard_code,
        'title': hazard.title,
        'description': hazard.description,
        'location': hazard.location,
        'level': hazard.level.value,
        'status': hazard.status.value,
        'discovered_by': hazard.discovered_by,
        'discovered_at': hazard.discovered_at.isoformat() if hazard.discovered_at else None,
        'department': hazard.department,
        'category': hazard.category,
        'responsible_person': hazard.responsible_person,
        'responsible_phone': hazard.responsible_phone,
        'deadline': hazard.deadline.isoformat() if hazard.deadline else None,
        'closed_at': hazard.closed_at.isoformat() if hazard.closed_at else None,
        'closed_by': hazard.closed_by,
        'created_at': hazard.created_at.isoformat(),
        'updated_at': hazard.updated_at.isoformat()
    }
    
    return ApiResponse(success=True, message="获取隐患成功", data=hazard_dict)


@api_router.post("/hazards", response_model=ApiResponse)
async def create_hazard(hazard_data: HazardCreate, db: Session = Depends(get_db)):
    existing = db.query(Hazard).filter(Hazard.hazard_code == hazard_data.hazard_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="隐患编号已存在")
    
    hazard = Hazard(
        hazard_code=hazard_data.hazard_code,
        title=hazard_data.title,
        description=hazard_data.description,
        location=hazard_data.location,
        level=hazard_data.level,
        status=HazardStatus.PENDING,
        discovered_by=hazard_data.discovered_by,
        discovered_at=hazard_data.discovered_at,
        department=hazard_data.department,
        category=hazard_data.category,
        responsible_person=hazard_data.responsible_person,
        responsible_phone=hazard_data.responsible_phone,
        deadline=hazard_data.deadline,
        remarks=hazard_data.remarks
    )
    db.add(hazard)
    db.commit()
    db.refresh(hazard)
    
    return ApiResponse(success=True, message="创建隐患成功", data={"id": hazard.id})


@api_router.put("/hazards/{hazard_id}", response_model=ApiResponse)
async def update_hazard(hazard_id: int, hazard_data: HazardUpdate, db: Session = Depends(get_db)):
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    update_data = hazard_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(hazard, field, value)
    
    hazard.updated_at = datetime.utcnow()
    db.commit()
    
    return ApiResponse(success=True, message="更新隐患成功", data={"id": hazard.id})


@api_router.delete("/hazards/{hazard_id}", response_model=ApiResponse)
async def delete_hazard(hazard_id: int, db: Session = Depends(get_db)):
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    db.delete(hazard)
    db.commit()
    
    return ApiResponse(success=True, message="删除隐患成功")


@api_router.post("/hazards/{hazard_id}/assign", response_model=ApiResponse)
async def assign_hazard(
    hazard_id: int,
    responsible_person: str = Query(...),
    responsible_phone: Optional[str] = Query(None),
    deadline: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    service = WorkflowService(db)
    try:
        hazard = service.assign_hazard(hazard_id, responsible_person, responsible_phone, deadline)
        return ApiResponse(success=True, message="分配成功", data={"status": hazard.status.value})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/hazards/{hazard_id}/start-rectification", response_model=ApiResponse)
async def start_rectification(hazard_id: int, db: Session = Depends(get_db)):
    service = WorkflowService(db)
    try:
        hazard = service.start_rectification(hazard_id)
        return ApiResponse(success=True, message="开始整改", data={"status": hazard.status.value})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/hazards/{hazard_id}/complete-rectification", response_model=ApiResponse)
async def complete_rectification(hazard_id: int, rectification_data: RectificationBase, db: Session = Depends(get_db)):
    service = WorkflowService(db)
    try:
        rectification = service.complete_rectification(
            hazard_id=hazard_id,
            rectifier=rectification_data.rectifier or "",
            action_taken=rectification_data.action_taken or "",
            measures=rectification_data.measures,
            cost=rectification_data.cost or 0,
            completed_at=rectification_data.completed_at,
            remarks=rectification_data.remarks
        )
        return ApiResponse(success=True, message="整改完成", data={"rectification_id": rectification.id})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/hazards/{hazard_id}/review", response_model=ApiResponse)
async def submit_review(hazard_id: int, review_data: ReviewBase, db: Session = Depends(get_db)):
    service = WorkflowService(db)
    try:
        review = service.submit_review(
            hazard_id=hazard_id,
            reviewer=review_data.reviewer or "",
            result=review_data.result,
            comments=review_data.comments,
            suggestions=review_data.suggestions,
            next_review_date=review_data.next_review_date,
            reviewed_at=review_data.reviewed_at
        )
        return ApiResponse(success=True, message="复查完成", data={"review_id": review.id, "passed": review.is_passed})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/hazards/{hazard_id}/workflow", response_model=ApiResponse)
async def get_workflow_summary(hazard_id: int, db: Session = Depends(get_db)):
    service = WorkflowService(db)
    try:
        summary = service.get_workflow_summary(hazard_id)
        return ApiResponse(success=True, message="获取流程摘要成功", data=summary)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.post("/import/hazards", response_model=ApiResponse)
async def import_hazards(filename: str, db: Session = Depends(get_db)):
    service = ImportService(db)
    try:
        result = service.import_hazards_csv(filename)
        return ApiResponse(success=True, message="导入完成", data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@api_router.post("/import/photos", response_model=ApiResponse)
async def import_photos(filename: str, db: Session = Depends(get_db)):
    service = ImportService(db)
    try:
        result = service.import_photos_json(filename)
        return ApiResponse(success=True, message="导入完成", data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@api_router.post("/import/reviews", response_model=ApiResponse)
async def import_reviews(filename: str, db: Session = Depends(get_db)):
    service = ImportService(db)
    try:
        result = service.import_review_records(filename)
        return ApiResponse(success=True, message="导入完成", data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@api_router.get("/import/history", response_model=ApiResponse)
async def get_import_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    records = service.get_import_history(skip, limit)
    
    history = []
    for r in records:
        history.append({
            "id": r.id,
            "import_type": r.import_type.value,
            "status": r.status.value,
            "file_name": r.file_name,
            "total_records": r.total_records,
            "success_count": r.success_count,
            "failed_count": r.failed_count,
            "created_at": r.created_at.isoformat()
        })
    
    return ApiResponse(success=True, message="获取导入历史成功", data=history)


@api_router.get("/import/{import_id}/bad-records", response_model=ApiResponse)
async def get_bad_records(import_id: int, db: Session = Depends(get_db)):
    service = ImportService(db)
    bad_records = service.get_bad_records(import_id)
    
    records = []
    for r in bad_records:
        records.append({
            "id": r.id,
            "row_number": r.row_number,
            "original_data": r.original_data,
            "error_type": r.error_type,
            "error_message": r.error_message,
            "suggested_fix": r.suggested_fix,
            "corrected": r.corrected
        })
    
    return ApiResponse(success=True, message="获取坏记录成功", data={"count": len(records), "records": records})


@api_router.post("/export/hazards/csv", response_model=ApiResponse)
async def export_hazards_csv(
    status: Optional[str] = None,
    level: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    
    status_enum = HazardStatus(status) if status else None
    level_enum = HazardLevel(level) if level else None
    
    filename = service.export_hazards_csv(
        status=status_enum,
        level=level_enum,
        department=department
    )
    
    return ApiResponse(success=True, message="导出成功", data={"filename": filename})


@api_router.post("/export/bad-records/{import_id}/csv", response_model=ApiResponse)
async def export_bad_records(import_id: int, db: Session = Depends(get_db)):
    service = ExportService(db)
    filename = service.export_bad_records_csv(import_id)
    
    return ApiResponse(success=True, message="导出成功", data={"filename": filename})


@api_router.get("/reports/monthly/{year}/{month}", response_model=ApiResponse)
async def get_monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    service = ExportService(db)
    try:
        report = service.generate_monthly_report(year, month)
        return ApiResponse(success=True, message="生成月报成功", data=report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成报告失败: {str(e)}")


@api_router.get("/reports/overdue", response_model=ApiResponse)
async def get_overdue_hazards(db: Session = Depends(get_db)):
    service = ExportService(db)
    overdue = service.get_overdue_hazards()
    
    return ApiResponse(success=True, message="获取超期隐患成功", data={"count": len(overdue), "items": overdue})


@api_router.get("/export/files", response_model=ApiResponse)
async def get_exported_files(db: Session = Depends(get_db)):
    service = ExportService(db)
    files = service.get_exported_files()
    
    return ApiResponse(success=True, message="获取导出文件列表成功", data={"count": len(files), "files": files})


@api_router.get("/stats/summary", response_model=ApiResponse)
async def get_stats_summary(db: Session = Depends(get_db)):
    total = db.query(Hazard).count()
    closed = db.query(Hazard).filter(Hazard.status == HazardStatus.CLOSED).count()
    pending = db.query(Hazard).filter(Hazard.status == HazardStatus.PENDING).count()
    rectifying = db.query(Hazard).filter(Hazard.status == HazardStatus.RECTIFYING).count()
    reviewing = db.query(Hazard).filter(Hazard.status == HazardStatus.REVIEWING).count()
    
    closure_rate = round((closed / total * 100), 1) if total > 0 else 0
    
    stats = {
        "total_hazards": total,
        "closed": closed,
        "pending": pending,
        "rectifying": rectifying,
        "reviewing": reviewing,
        "closure_rate": closure_rate
    }
    
    return ApiResponse(success=True, message="获取统计摘要成功", data=stats)
