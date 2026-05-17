from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import SessionLocal, engine
import models, schemas, services

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="培训签到补签冲突合并结业资格系统", version="1.0.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/students/", response_model=schemas.Student, tags=["学生管理"])
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    try:
        db_student = db.query(models.Student).filter(models.Student.student_id == student.student_id).first()
        if db_student:
            raise HTTPException(status_code=400, detail="学号已存在")
        db_student = models.Student(**student.dict())
        db.add(db_student)
        db.commit()
        db.refresh(db_student)
        return db_student
    except HTTPException:
        raise
    except Exception as e:
        services.log_exception(db, schemas.ExceptionLogCreate(
            operation_type="create_student",
            original_input=json.dumps(student.dict()),
            handler="system",
            conclusion="failed",
            error_message=str(e)
        ))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/students/", response_model=List[schemas.Student], tags=["学生管理"])
def list_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    students = db.query(models.Student).offset(skip).limit(limit).all()
    return students


@app.post("/api/sessions/", response_model=schemas.CourseSession, tags=["课程场次"])
def create_session(session: schemas.CourseSessionCreate, db: Session = Depends(get_db)):
    try:
        db_session = db.query(models.CourseSession).filter(models.CourseSession.session_code == session.session_code).first()
        if db_session:
            raise HTTPException(status_code=400, detail="场次代码已存在")
        db_session = models.CourseSession(**session.dict())
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session
    except HTTPException:
        raise
    except Exception as e:
        services.log_exception(db, schemas.ExceptionLogCreate(
            operation_type="create_session",
            original_input=json.dumps(session.dict()),
            handler="system",
            conclusion="failed",
            error_message=str(e)
        ))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/", response_model=List[schemas.CourseSession], tags=["课程场次"])
def list_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sessions = db.query(models.CourseSession).offset(skip).limit(limit).all()
    return sessions


@app.post("/api/attendance/", response_model=schemas.AttendanceRecord, tags=["签到记录"])
def create_attendance(attendance: schemas.AttendanceRecordCreate, db: Session = Depends(get_db)):
    try:
        return services.create_attendance_record(db, attendance)
    except Exception as e:
        services.log_exception(db, schemas.ExceptionLogCreate(
            operation_type="create_attendance",
            original_input=json.dumps(attendance.dict()),
            handler="system",
            conclusion="failed",
            error_message=str(e)
        ))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/attendance/", response_model=List[schemas.AttendanceRecord], tags=["签到记录"])
def list_attendance(
    session_code: Optional[str] = None,
    student_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.AttendanceRecord)
    if session_code:
        session = db.query(models.CourseSession).filter(models.CourseSession.session_code == session_code).first()
        if session:
            query = query.filter(models.AttendanceRecord.session_id == session.id)
    if student_id:
        student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
        if student:
            query = query.filter(models.AttendanceRecord.student_id == student.id)
    return query.offset(skip).limit(limit).all()


@app.post("/api/makeup/", response_model=schemas.MakeUpSign, tags=["补签管理"])
def create_makeup(makeup: schemas.MakeUpSignCreate, db: Session = Depends(get_db)):
    try:
        return services.create_makeup_sign(db, makeup)
    except Exception as e:
        services.log_exception(db, schemas.ExceptionLogCreate(
            operation_type="create_makeup",
            original_input=json.dumps(makeup.dict()),
            handler="system",
            conclusion="failed",
            error_message=str(e)
        ))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/makeup/", response_model=List[schemas.MakeUpSign], tags=["补签管理"])
def list_makeup(
    session_code: Optional[str] = None,
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.MakeUpSign)
    if session_code:
        session = db.query(models.CourseSession).filter(models.CourseSession.session_code == session_code).first()
        if session:
            query = query.filter(models.MakeUpSign.session_id == session.id)
    if student_id:
        student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
        if student:
            query = query.filter(models.MakeUpSign.student_id == student.id)
    if status:
        query = query.filter(models.MakeUpSign.status == status)
    return query.offset(skip).limit(limit).all()


@app.put("/api/makeup/{makeup_id}/withdraw", response_model=schemas.MakeUpSign, tags=["补签管理"])
def withdraw_makeup(makeup_id: int, db: Session = Depends(get_db)):
    makeup = services.withdraw_makeup(db, makeup_id)
    if not makeup:
        raise HTTPException(status_code=404, detail="补签记录不存在")
    return makeup


@app.get("/api/conflicts/", response_model=List[schemas.ConflictRecord], tags=["冲突处理"])
def list_conflicts(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ConflictRecord)
    if status:
        query = query.filter(models.ConflictRecord.status == status)
    return query.offset(skip).limit(limit).all()


@app.get("/api/conflicts/pending", response_model=List[schemas.ConflictRecord], tags=["冲突处理"])
def get_pending_conflicts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_pending_conflicts(db, skip, limit)


@app.put("/api/conflicts/{conflict_id}/resolve", response_model=schemas.ConflictRecord, tags=["冲突处理"])
def resolve_conflict(
    conflict_id: int,
    resolve_data: schemas.ConflictResolve,
    db: Session = Depends(get_db)
):
    conflict = services.resolve_conflict(db, conflict_id, resolve_data)
    if not conflict:
        raise HTTPException(status_code=404, detail="冲突记录不存在")
    return conflict


@app.put("/api/conflicts/{conflict_id}/close", response_model=schemas.ConflictRecord, tags=["冲突处理"])
def close_conflict(
    conflict_id: int,
    resolved_by: str = Query(..., description="处理人"),
    db: Session = Depends(get_db)
):
    conflict = services.close_conflict(db, conflict_id, resolved_by)
    if not conflict:
        raise HTTPException(status_code=404, detail="冲突记录不存在")
    return conflict


@app.post("/api/merge/", response_model=schemas.MergeResult, tags=["合并处理"])
def merge_records(
    session_code: str = Query(..., description="场次代码"),
    student_id: str = Query(..., description="学号"),
    db: Session = Depends(get_db)
):
    session = db.query(models.CourseSession).filter(models.CourseSession.session_code == session_code).first()
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not session or not student:
        raise HTTPException(status_code=404, detail="场次或学生不存在")
    return services.merge_attendance_records(db, session.id, student.id)


@app.get("/api/stats/", response_model=List[schemas.AttendanceStats], tags=["统计分析"])
def get_attendance_stats(
    session_code: Optional[str] = None,
    student_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return services.calculate_attendance_stats(db, session_code, student_id)


@app.post("/api/graduation-report/", response_model=List[schemas.GraduationReport], tags=["结业资格"])
def create_graduation_report(
    generate_data: schemas.GraduationReportGenerate,
    db: Session = Depends(get_db)
):
    return services.generate_graduation_report(db, generate_data)


@app.get("/api/graduation-report/", response_model=List[schemas.GraduationReport], tags=["结业资格"])
def list_graduation_reports(
    session_code: Optional[str] = None,
    student_id: Optional[str] = None,
    is_eligible: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.GraduationReport)
    if session_code:
        session = db.query(models.CourseSession).filter(models.CourseSession.session_code == session_code).first()
        if session:
            query = query.filter(models.GraduationReport.session_id == session.id)
    if student_id:
        student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
        if student:
            query = query.filter(models.GraduationReport.student_id == student.id)
    if is_eligible is not None:
        query = query.filter(models.GraduationReport.is_eligible == is_eligible)
    return query.offset(skip).limit(limit).all()


@app.post("/api/export/", tags=["数据导出"])
def export_data(export_request: schemas.ExportRequest, db: Session = Depends(get_db)):
    stats = services.calculate_attendance_stats(
        db,
        export_request.session_code,
        export_request.student_id
    )
    
    conflicts = db.query(models.ConflictRecord).all()
    reports = db.query(models.GraduationReport).all()
    
    result = {
        "export_time": datetime.utcnow().isoformat(),
        "attendance_stats": [s.dict() for s in stats],
        "conflicts_count": len(conflicts),
        "graduation_reports_count": len(reports)
    }
    
    if export_request.export_format == "csv":
        return JSONResponse(content={
            "message": "CSV格式需要转换",
            "data": result
        })
    
    return result


@app.get("/api/exception-logs/", tags=["异常日志"])
def get_exception_logs(
    operation_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ExceptionLog)
    if operation_type:
        query = query.filter(models.ExceptionLog.operation_type == operation_type)
    return query.offset(skip).limit(limit).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
