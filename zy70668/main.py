from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
import csv

import models, schemas, crud
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="二课学分多源合并驳回原因后端API")


@app.post("/students/", response_model=schemas.Student)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    db_student = crud.get_student_by_student_id(db, student_id=student.student_id)
    if db_student:
        raise HTTPException(status_code=400, detail="学号已存在")
    return crud.create_student(db=db, student=student)


@app.get("/students/{student_id}", response_model=schemas.Student)
def read_student(student_id: str, db: Session = Depends(get_db)):
    db_student = crud.get_student_by_student_id(db, student_id=student_id)
    if db_student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return db_student


@app.post("/activity-types/", response_model=schemas.ActivityType)
def create_activity_type(activity_type: schemas.ActivityTypeCreate, db: Session = Depends(get_db)):
    db_type = crud.get_activity_type_by_code(db, code=activity_type.code)
    if db_type:
        raise HTTPException(status_code=400, detail="活动类型已存在")
    return crud.create_activity_type(db=db, activity_type=activity_type)


@app.get("/activity-types/", response_model=List[schemas.ActivityType])
def read_activity_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.ActivityType).offset(skip).limit(limit).all()


@app.post("/credit-applications/", response_model=schemas.CreditApplication)
def create_credit_application(application: schemas.CreditApplicationCreate, db: Session = Depends(get_db)):
    db_app = crud.create_credit_application(db=db, application=application)
    if db_app is None:
        raise HTTPException(status_code=400, detail="学生或活动类型不存在")
    return db_app


@app.get("/credit-applications/{application_id}", response_model=schemas.CreditApplication)
def read_credit_application(application_id: int, db: Session = Depends(get_db)):
    db_app = crud.get_credit_application(db, application_id=application_id)
    if db_app is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    return db_app


@app.get("/students/{student_id}/credit-applications/", response_model=List[schemas.CreditApplication])
def read_student_applications(student_id: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_credit_applications_by_student(db, student_id=student_id, skip=skip, limit=limit)


@app.put("/credit-applications/{application_id}/status", response_model=schemas.CreditApplication)
def update_application_status(application_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_app = crud.update_application_status(db, application_id=application_id, status_update=status_update)
    if db_app is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    return db_app


@app.put("/credit-applications/{application_id}/manual-correction", response_model=schemas.CreditApplication)
def manual_correction(application_id: int, correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    db_app = crud.manual_correct_credit(db, application_id=application_id, correction=correction)
    if db_app is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    return db_app


@app.put("/credit-applications/{application_id}/withdraw", response_model=schemas.CreditApplication)
def withdraw_application(application_id: int, handler: str, db: Session = Depends(get_db)):
    db_app = crud.withdraw_application(db, application_id=application_id, handler=handler)
    if db_app is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    return db_app


@app.get("/students/{student_id}/credit-summary", response_model=schemas.StudentCreditSummary)
def get_student_credit_summary(student_id: str, db: Session = Depends(get_db)):
    summary = crud.calculate_student_credit(db, student_id=student_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return summary


@app.post("/credit-reports/", response_model=schemas.CreditReport)
def create_credit_report(report_create: schemas.CreditReportCreate, db: Session = Depends(get_db)):
    report = crud.generate_credit_report(db, report_create=report_create)
    if report is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return report


@app.get("/credit-reports/{report_id}", response_model=schemas.CreditReport)
def read_report(report_id: int, db: Session = Depends(get_db)):
    report = crud.get_report(db, report_id=report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@app.get("/students/{student_id}/credit-reports/", response_model=List[schemas.CreditReport])
def read_student_reports(student_id: str, db: Session = Depends(get_db)):
    return crud.get_reports_by_student(db, student_id=student_id)


@app.get("/credit-applications/{application_id}/audit-logs", response_model=List[schemas.AuditLog])
def read_audit_logs(application_id: int, db: Session = Depends(get_db)):
    return crud.get_audit_logs(db, application_id=application_id)


@app.get("/credit-reports/{report_id}/export")
def export_report(report_id: int, db: Session = Depends(get_db)):
    report = crud.get_report(db, report_id=report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["二课学分报告"])
    writer.writerow(["学生学号", report.student.student_id])
    writer.writerow(["学生姓名", report.student.name])
    writer.writerow(["报告生成时间", report.report_date.strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])
    
    writer.writerow(["学分汇总"])
    writer.writerow(["讲座学分", f"{report.lecture_credit:.1f}"])
    writer.writerow(["竞赛学分", f"{report.competition_credit:.1f}"])
    writer.writerow(["志愿服务学分", f"{report.volunteer_credit:.1f}"])
    writer.writerow(["总计", f"{report.total_credit:.1f}"])
    writer.writerow([])
    
    writer.writerow(["申请明细"])
    writer.writerow(["序号", "活动名称", "活动类型", "申请学分", "状态", "驳回原因"])
    
    activity_types = {at.id: at.name for at in db.query(models.ActivityType).all()}
    
    for i, detail in enumerate(report.details, 1):
        activity_type_name = activity_types.get(detail.activity_type_id, "未知")
        writer.writerow([
            i,
            detail.activity_name,
            activity_type_name,
            f"{detail.credit:.1f}",
            detail.status,
            detail.rejection_reason or ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=credit_report_{report_id}.csv"}
    )


@app.get("/")
def root():
    return {"message": "二课学分多源合并驳回原因后端API", "docs": "/docs"}
