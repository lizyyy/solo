from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
from io import StringIO

from database import engine, get_db, SessionLocal
from models import Base, Room, Course, RoomSwap, Notification, SignInCode, AuditLog
import schemas
import services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="教室调换设备匹配通知确认后端API",
    description="培训中心临时换教室时，学员通知、设备要求和签到码更新的管理系统",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "path": request.url.path,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.post("/api/rooms/", response_model=schemas.Room, tags=["教室管理"])
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db)):
    db_room = Room(**room.model_dump())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


@app.get("/api/rooms/", response_model=List[schemas.Room], tags=["教室管理"])
def get_rooms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Room).offset(skip).limit(limit).all()


@app.post("/api/rooms/{room_id}/devices/", response_model=schemas.RoomDevice, tags=["教室管理"])
def add_room_device(room_id: int, device: schemas.RoomDeviceBase, db: Session = Depends(get_db)):
    db_device = RoomDevice(room_id=room_id, **device.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device


@app.post("/api/courses/", response_model=schemas.Course, tags=["课程管理"])
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    device_reqs = course.device_requirements
    students = course.students
    
    course_data = course.model_dump(exclude={"device_requirements", "students"})
    db_course = Course(**course_data)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    for req in device_reqs:
        db_req = DeviceRequirement(course_id=db_course.id, **req.model_dump())
        db.add(db_req)
    
    for student in students:
        db_student = Student(course_id=db_course.id, **student.model_dump())
        db.add(db_student)
    
    db.commit()
    db.refresh(db_course)
    return db_course


@app.get("/api/courses/", response_model=List[schemas.Course], tags=["课程管理"])
def get_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Course).offset(skip).limit(limit).all()


@app.get("/api/courses/{course_id}", response_model=schemas.Course, tags=["课程管理"])
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    return course


@app.post("/api/swaps/", response_model=schemas.RoomSwap, tags=["教室调换"])
def create_swap(swap: schemas.RoomSwapCreate, db: Session = Depends(get_db)):
    return services.create_room_swap(db, swap)


@app.get("/api/swaps/", response_model=List[schemas.RoomSwap], tags=["教室调换"])
def get_swaps(
    status: Optional[str] = None,
    course_id: Optional[int] = None,
    created_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(RoomSwap)
    
    if status:
        query = query.filter(RoomSwap.status == status)
    if course_id:
        query = query.filter(RoomSwap.course_id == course_id)
    if created_by:
        query = query.filter(RoomSwap.created_by == created_by)
    
    return query.order_by(RoomSwap.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/swaps/{swap_id}", response_model=schemas.RoomSwapDetail, tags=["教室调换"])
def get_swap(swap_id: int, db: Session = Depends(get_db)):
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="调换记录不存在")
    return swap


@app.patch("/api/swaps/{swap_id}/status", tags=["教室调换"])
def update_swap_status(swap_id: int, update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    swap, success, message = services.update_swap_status(
        db, swap_id, update.new_status, update.operator, update.remarks
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": swap}


@app.post("/api/swaps/{swap_id}/notifications", tags=["学员通知"])
def create_notifications(swap_id: int, db: Session = Depends(get_db)):
    notifications, message = services.create_notifications_for_swap(db, swap_id)
    if not notifications:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "count": len(notifications)}


@app.get("/api/swaps/{swap_id}/notifications", response_model=List[schemas.Notification], tags=["学员通知"])
def get_swap_notifications(swap_id: int, db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.swap_id == swap_id).all()


@app.patch("/api/notifications/{notification_id}/confirm", tags=["学员通知"])
def confirm_notification(notification_id: int, confirmed_by: str = Query(...), db: Session = Depends(get_db)):
    notification, success, message = services.confirm_notification(db, notification_id, confirmed_by)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": notification}


@app.post("/api/swaps/{swap_id}/sign-in-code", tags=["签到码"])
def refresh_sign_in_code(swap_id: int, refresh: schemas.SignInCodeRefresh, db: Session = Depends(get_db)):
    code, success, message = services.refresh_sign_in_code(
        db, swap_id, refresh.new_code, refresh.operator
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": code}


@app.get("/api/swaps/{swap_id}/sign-in-code", response_model=Optional[schemas.SignInCode], tags=["签到码"])
def get_sign_in_code(swap_id: int, db: Session = Depends(get_db)):
    return db.query(SignInCode).filter(SignInCode.swap_id == swap_id).first()


@app.post("/api/swaps/{swap_id}/cancel", tags=["教室调换"])
def cancel_swap(swap_id: int, operator: str = Query(...), reason: str = Query(...), db: Session = Depends(get_db)):
    swap, success, message = services.cancel_swap(db, swap_id, operator, reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": swap}


@app.post("/api/swaps/{swap_id}/close", tags=["教室调换"])
def close_swap(swap_id: int, operator: str = Query(...), conclusion: str = Query(...), db: Session = Depends(get_db)):
    swap, success, message = services.close_swap(db, swap_id, operator, conclusion)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": swap}


@app.patch("/api/swaps/{swap_id}/correct", tags=["人工修正"])
def manual_correction(swap_id: int, correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    swap, success, message = services.manual_correction(db, swap_id, correction)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": swap}


@app.get("/api/swaps/{swap_id}/audit-logs", response_model=List[schemas.AuditLog], tags=["审计日志"])
def get_audit_logs(swap_id: int, db: Session = Depends(get_db)):
    return db.query(AuditLog).filter(AuditLog.swap_id == swap_id).order_by(AuditLog.created_at.desc()).all()


@app.get("/api/swaps/{swap_id}/report", response_model=schemas.SwapReport, tags=["报告导出"])
def get_swap_report(swap_id: int, db: Session = Depends(get_db)):
    report = services.generate_swap_report(db, swap_id)
    if not report:
        raise HTTPException(status_code=404, detail="调换记录不存在")
    return report


@app.get("/api/swaps/{swap_id}/export/csv", tags=["报告导出"])
def export_swap_csv(swap_id: int, db: Session = Depends(get_db)):
    report = services.generate_swap_report(db, swap_id)
    if not report:
        raise HTTPException(status_code=404, detail="调换记录不存在")
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["字段", "值"])
    for key, value in report.items():
        writer.writerow([key, str(value)])
    
    writer.writerow([])
    writer.writerow(["通知明细"])
    writer.writerow(["学员ID", "学员姓名", "状态", "确认时间"])
    
    notifications = db.query(Notification).filter(Notification.swap_id == swap_id).all()
    for n in notifications:
        writer.writerow([
            n.student_id,
            n.student.name if n.student else "未知",
            n.status,
            n.confirmed_at.isoformat() if n.confirmed_at else ""
        ])
    
    return JSONResponse(
        content={"csv": output.getvalue()},
        headers={
            "Content-Disposition": f"attachment; filename=swap_{swap_id}_report.csv"
        }
    )


@app.get("/api/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


from models import DeviceRequirement, Student
