from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import logging

from models import init_db, get_db, Driver, Bus, Student, ParentComplaint, Ruling, Review, mask_sensitive_data
from schemas import (
    DriverCreate, BusCreate, StudentCreate, DriverCheckinCreate, GpsTrackCreate,
    ParentComplaintCreate, RulingCreate, ReviewCreate, BatchImportRequest,
    ExportRequest, BatchResponse
)
from services import (
    create_driver_checkin, create_gps_track, create_parent_complaint,
    create_ruling, auto_match_and_rule, create_review,
    batch_import_with_status, export_rulings_to_excel
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="校车调度责任判定系统", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("数据库初始化完成")

@app.post("/drivers/", response_model=dict)
def create_driver(driver: DriverCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(Driver).filter(
            (Driver.driver_phone == driver.driver_phone) | 
            (Driver.employee_id == driver.employee_id)
        ).first()
        if existing:
            return {"success": False, "data": existing.to_dict_masked(), "message": "司机已存在"}
        
        db_driver = Driver(**driver.dict())
        db.add(db_driver)
        db.commit()
        db.refresh(db_driver)
        return {"success": True, "data": db_driver.to_dict_masked(), "message": "创建成功"}
    except Exception as e:
        logger.error(f"创建司机失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/buses/", response_model=dict)
def create_bus(bus: BusCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(Bus).filter(Bus.bus_number == bus.bus_number).first()
        if existing:
            return {"success": False, "data": {"id": existing.id, "bus_number": existing.bus_number}, "message": "车辆已存在"}
        
        db_bus = Bus(**bus.dict())
        db.add(db_bus)
        db.commit()
        db.refresh(db_bus)
        return {"success": True, "data": {"id": db_bus.id, "bus_number": db_bus.bus_number}, "message": "创建成功"}
    except Exception as e:
        logger.error(f"创建车辆失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/students/", response_model=dict)
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(Student).filter(Student.student_number == student.student_number).first()
        if existing:
            return {"success": False, "data": existing.to_dict_masked(), "message": "学生已存在"}
        
        db_student = Student(**student.dict())
        db.add(db_student)
        db.commit()
        db.refresh(db_student)
        return {"success": True, "data": db_student.to_dict_masked(), "message": "创建成功"}
    except Exception as e:
        logger.error(f"创建学生失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/checkins/", response_model=dict)
def import_checkin(checkin: DriverCheckinCreate, db: Session = Depends(get_db)):
    try:
        obj, is_new = create_driver_checkin(db, checkin)
        return {
            "success": True,
            "data": {"id": obj.id, "idempotency_key": obj.idempotency_key},
            "status": "created" if is_new else "duplicate",
            "message": "创建成功" if is_new else "记录已存在，跳过"
        }
    except Exception as e:
        logger.error(f"导入打卡失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/gps/", response_model=dict)
def import_gps(gps: GpsTrackCreate, db: Session = Depends(get_db)):
    try:
        obj, is_new = create_gps_track(db, gps)
        return {
            "success": True,
            "data": {"id": obj.id, "idempotency_key": obj.idempotency_key},
            "status": "created" if is_new else "duplicate",
            "message": "创建成功" if is_new else "记录已存在，跳过"
        }
    except Exception as e:
        logger.error(f"导入GPS失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complaints/", response_model=dict)
def import_complaint(complaint: ParentComplaintCreate, db: Session = Depends(get_db)):
    try:
        obj, is_new = create_parent_complaint(db, complaint)
        return {
            "success": True,
            "data": obj.to_dict_masked(),
            "status": "created" if is_new else "duplicate",
            "message": "创建成功" if is_new else "记录已存在，跳过"
        }
    except Exception as e:
        logger.error(f"导入申诉失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch/checkins/", response_model=BatchResponse)
def batch_import_checkins(request: BatchImportRequest, db: Session = Depends(get_db)):
    try:
        result = batch_import_with_status(db, request.items, "checkin", request.idempotency_prefix)
        return result
    except Exception as e:
        logger.error(f"批量导入打卡失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch/gps/", response_model=BatchResponse)
def batch_import_gps(request: BatchImportRequest, db: Session = Depends(get_db)):
    try:
        result = batch_import_with_status(db, request.items, "gps", request.idempotency_prefix)
        return result
    except Exception as e:
        logger.error(f"批量导入GPS失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch/complaints/", response_model=BatchResponse)
def batch_import_complaints(request: BatchImportRequest, db: Session = Depends(get_db)):
    try:
        result = batch_import_with_status(db, request.items, "complaint", request.idempotency_prefix)
        return result
    except Exception as e:
        logger.error(f"批量导入申诉失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rulings/auto/{complaint_id}", response_model=dict)
def auto_rule_complaint(complaint_id: int, db: Session = Depends(get_db)):
    try:
        ruling = auto_match_and_rule(db, complaint_id)
        if not ruling:
            raise HTTPException(status_code=404, detail="申诉记录不存在")
        return {
            "success": True,
            "data": {
                "ruling_id": ruling.id,
                "ruling_number": ruling.ruling_number,
                "responsibility": ruling.responsibility,
                "delay_minutes": ruling.delay_minutes,
                "root_cause": ruling.root_cause,
                "gps_evidence": ruling.gps_evidence,
                "checkin_evidence": ruling.checkin_evidence
            },
            "message": "自动裁定完成"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"自动裁定失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rulings/manual/", response_model=dict)
def manual_rule_complaint(ruling: RulingCreate, db: Session = Depends(get_db)):
    try:
        result = create_ruling(db, ruling)
        return {
            "success": True,
            "data": {
                "ruling_id": result.id,
                "ruling_number": result.ruling_number,
                "responsibility": result.responsibility
            },
            "message": "人工裁定完成"
        }
    except Exception as e:
        logger.error(f"人工裁定失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reviews/", response_model=dict)
def review_ruling(review: ReviewCreate, db: Session = Depends(get_db)):
    try:
        result = create_review(db, review)
        return {
            "success": True,
            "data": {
                "review_id": result.id,
                "review_number": result.review_number,
                "review_result": result.review_result,
                "original_responsibility": result.original_responsibility,
                "new_responsibility": result.new_responsibility
            },
            "message": "复核完成"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"复核失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/complaints/{complaint_id}", response_model=dict)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    try:
        complaint = db.query(ParentComplaint).filter(ParentComplaint.id == complaint_id).first()
        if not complaint:
            raise HTTPException(status_code=404, detail="申诉记录不存在")
        
        ruling = db.query(Ruling).filter(Ruling.complaint_id == complaint_id).first()
        reviews = db.query(Review).filter(Review.ruling_id == ruling.id).all() if ruling else []
        
        return {
            "success": True,
            "data": {
                "complaint": complaint.to_dict_masked(),
                "ruling": {
                    "id": ruling.id,
                    "ruling_number": ruling.ruling_number,
                    "responsibility": ruling.responsibility,
                    "delay_minutes": ruling.delay_minutes,
                    "root_cause": ruling.root_cause
                } if ruling else None,
                "reviews_count": len(reviews)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取申诉详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/complaints/", response_model=dict)
def list_complaints(status: str = None, bus_route: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    try:
        query = db.query(ParentComplaint)
        if status:
            query = query.filter(ParentComplaint.status == status)
        if bus_route:
            query = query.filter(ParentComplaint.bus_route == bus_route)
        
        complaints = query.offset(skip).limit(limit).all()
        total = query.count()
        
        return {
            "success": True,
            "data": {
                "total": total,
                "items": [c.to_dict_masked() for c in complaints]
            }
        }
    except Exception as e:
        logger.error(f"获取申诉列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export/rulings")
def export_rulings(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        excel_file = export_rulings_to_excel(
            db,
            start_date=request.start_date,
            end_date=request.end_date,
            status=request.status,
            bus_route=request.bus_route
        )
        
        filename = f"rulings_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return StreamingResponse(
            iter([excel_file.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"导出失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
