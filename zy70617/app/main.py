from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import io
import csv

from app.database import get_db, engine, Base
from app import models, schemas, crud
from app.models import RenewalStatus, RetakeStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="证书续期岗位资格补考管理系统",
    description="员工证书管理、课程成绩、补考记录、岗位资格、续期清单管理API",
    version="1.0.0"
)


@app.post("/employees/", response_model=schemas.Employee, tags=["员工管理"])
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = crud.get_employee_by_employee_id(db, employee_id=employee.employee_id)
    if db_employee:
        raise HTTPException(status_code=400, detail="员工编号已存在")
    return crud.create_employee(db=db, employee=employee)


@app.get("/employees/", response_model=List[schemas.Employee], tags=["员工管理"])
def read_employees(skip: int = 0, limit: int = 100, department: str = None, db: Session = Depends(get_db)):
    return crud.get_employees(db, skip=skip, limit=limit, department=department)


@app.get("/employees/{employee_id}", response_model=schemas.Employee, tags=["员工管理"])
def read_employee(employee_id: int, db: Session = Depends(get_db)):
    db_employee = crud.get_employee(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="员工不存在")
    return db_employee


@app.put("/employees/{employee_id}", response_model=schemas.Employee, tags=["员工管理"])
def update_employee(employee_id: int, employee_update: schemas.EmployeeUpdate, db: Session = Depends(get_db)):
    db_employee = crud.update_employee(db, employee_id=employee_id, employee_update=employee_update)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="员工不存在")
    return db_employee


@app.post("/certificate-types/", response_model=schemas.CertificateType, tags=["证书类型"])
def create_certificate_type(cert_type: schemas.CertificateTypeCreate, db: Session = Depends(get_db)):
    db_cert_type = crud.get_certificate_type_by_code(db, type_code=cert_type.type_code)
    if db_cert_type:
        raise HTTPException(status_code=400, detail="证书类型编码已存在")
    return crud.create_certificate_type(db=db, cert_type=cert_type)


@app.get("/certificate-types/", response_model=List[schemas.CertificateType], tags=["证书类型"])
def read_certificate_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_certificate_types(db, skip=skip, limit=limit)


@app.post("/employee-certificates/", response_model=schemas.EmployeeCertificate, tags=["员工证书"])
def create_employee_certificate(cert: schemas.EmployeeCertificateCreate, db: Session = Depends(get_db)):
    return crud.create_employee_certificate(db=db, cert=cert)


@app.get("/employee-certificates/", response_model=List[schemas.EmployeeCertificate], tags=["员工证书"])
def read_employee_certificates(employee_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    certs = crud.get_employee_certificates(db, employee_id=employee_id, skip=skip, limit=limit)
    for cert in certs:
        cert.status = crud.get_certificate_status(cert.expiry_date)
    return certs


@app.put("/employee-certificates/{cert_id}", response_model=schemas.EmployeeCertificate, tags=["员工证书"])
def update_employee_certificate(cert_id: int, cert_update: schemas.EmployeeCertificateUpdate, db: Session = Depends(get_db)):
    db_cert = crud.update_employee_certificate(db, cert_id=cert_id, cert_update=cert_update)
    if db_cert is None:
        raise HTTPException(status_code=404, detail="证书不存在")
    db_cert.status = crud.get_certificate_status(db_cert.expiry_date)
    return db_cert


@app.post("/course-scores/", response_model=schemas.CourseScore, tags=["课程成绩"])
def create_course_score(score: schemas.CourseScoreCreate, db: Session = Depends(get_db)):
    return crud.create_course_score(db=db, score=score)


@app.get("/course-scores/", response_model=List[schemas.CourseScore], tags=["课程成绩"])
def read_course_scores(employee_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_course_scores(db, employee_id=employee_id, skip=skip, limit=limit)


@app.get("/retake-records/", response_model=List[schemas.RetakeRecord], tags=["补考记录"])
def read_retake_records(employee_id: int = None, status: Optional[RetakeStatus] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    status_value = status.value if status else None
    return crud.get_retake_records(db, employee_id=employee_id, status=status_value, skip=skip, limit=limit)


@app.put("/retake-records/{retake_id}", response_model=schemas.RetakeRecord, tags=["补考记录"])
def update_retake_record(retake_id: int, retake_update: schemas.RetakeRecordUpdate, db: Session = Depends(get_db)):
    db_retake = crud.update_retake_record(db, retake_id=retake_id, retake_update=retake_update)
    if db_retake is None:
        raise HTTPException(status_code=404, detail="补考记录不存在")
    return db_retake


@app.post("/position-requirements/", response_model=schemas.PositionRequirement, tags=["岗位要求"])
def create_position_requirement(req: schemas.PositionRequirementCreate, db: Session = Depends(get_db)):
    return crud.create_position_requirement(db=db, req=req)


@app.get("/position-requirements/", response_model=List[schemas.PositionRequirement], tags=["岗位要求"])
def read_position_requirements(position_name: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_position_requirements(db, position_name=position_name, skip=skip, limit=limit)


@app.get("/qualification-check/{employee_id}/{position_name}", response_model=List[schemas.QualificationCheckResult], tags=["岗位资格"])
def check_qualification(employee_id: int, position_name: str, db: Session = Depends(get_db)):
    return crud.check_employee_qualification(db, employee_id=employee_id, position_name=position_name)


@app.post("/renewal-items/", response_model=schemas.RenewalItem, tags=["续期清单"])
def create_renewal_item(renewal: schemas.RenewalItemCreate, db: Session = Depends(get_db)):
    return crud.create_renewal_item(db=db, renewal=renewal)


@app.get("/renewal-items/", response_model=List[schemas.RenewalItem], tags=["续期清单"])
def read_renewal_items(employee_id: int = None, status: Optional[RenewalStatus] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    status_value = status.value if status else None
    return crud.get_renewal_items(db, employee_id=employee_id, status=status_value, skip=skip, limit=limit)


@app.get("/renewal-items/{renewal_id}", response_model=schemas.RenewalItem, tags=["续期清单"])
def read_renewal_item(renewal_id: int, db: Session = Depends(get_db)):
    db_renewal = crud.get_renewal_item(db, renewal_id=renewal_id)
    if db_renewal is None:
        raise HTTPException(status_code=404, detail="续期项不存在")
    return db_renewal


@app.put("/renewal-items/{renewal_id}", response_model=schemas.RenewalItem, tags=["续期清单"])
def update_renewal_item(renewal_id: int, renewal_update: schemas.RenewalItemUpdate, db: Session = Depends(get_db)):
    db_renewal = crud.update_renewal_item(db, renewal_id=renewal_id, renewal_update=renewal_update)
    if db_renewal is None:
        raise HTTPException(status_code=404, detail="续期项不存在")
    return db_renewal


@app.put("/renewal-items/{renewal_id}/advance", response_model=schemas.RenewalItem, tags=["续期清单"])
def advance_renewal_status(renewal_id: int, db: Session = Depends(get_db)):
    db_renewal = crud.get_renewal_item(db, renewal_id=renewal_id)
    if db_renewal is None:
        raise HTTPException(status_code=404, detail="续期项不存在")
    
    status_flow = [RenewalStatus.PENDING, RenewalStatus.IN_PROGRESS, RenewalStatus.COMPLETED]
    current_idx = next((i for i, s in enumerate(status_flow) if s == db_renewal.status), -1)
    
    if current_idx == -1 or current_idx >= len(status_flow) - 1:
        raise HTTPException(status_code=400, detail="当前状态无法推进")
    
    new_status = status_flow[current_idx + 1]
    return crud.update_renewal_item(db, renewal_id=renewal_id, renewal_update=schemas.RenewalItemUpdate(status=new_status))


@app.post("/renewal-items/{renewal_id}/correct", response_model=schemas.RenewalItem, tags=["续期清单"])
def manual_correct_renewal(renewal_id: int, correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    db_renewal = crud.manual_correct_renewal(db, renewal_id=renewal_id, correction=correction)
    if db_renewal is None:
        raise HTTPException(status_code=404, detail="续期项不存在")
    return db_renewal


@app.post("/renewal-items/{renewal_id}/cancel", response_model=schemas.RenewalItem, tags=["续期清单"])
def cancel_renewal(renewal_id: int, handler: str, reason: str, db: Session = Depends(get_db)):
    db_renewal = crud.cancel_renewal(db, renewal_id=renewal_id, handler=handler, reason=reason)
    if db_renewal is None:
        raise HTTPException(status_code=404, detail="续期项不存在")
    return db_renewal


@app.post("/renewal-items/{renewal_id}/close", response_model=schemas.RenewalItem, tags=["续期清单"])
def close_renewal(renewal_id: int, handler: str, conclusion: str, db: Session = Depends(get_db)):
    db_renewal = crud.close_renewal(db, renewal_id=renewal_id, handler=handler, conclusion=conclusion)
    if db_renewal is None:
        raise HTTPException(status_code=404, detail="续期项不存在")
    return db_renewal


@app.get("/renewal-statistics/", response_model=schemas.RenewalStatistics, tags=["续期清单"])
def get_renewal_statistics(db: Session = Depends(get_db)):
    return crud.get_renewal_statistics(db)


@app.get("/certificate-expiry-alerts/", response_model=List[schemas.CertificateExpiryAlert], tags=["过期提醒"])
def get_certificate_expiry_alerts(days_threshold: int = 90, db: Session = Depends(get_db)):
    return crud.get_certificate_expiry_alerts(db, days_threshold=days_threshold)


@app.get("/export/renewal-items/", tags=["导出"])
def export_renewal_items(status: Optional[RenewalStatus] = None, db: Session = Depends(get_db)):
    status_value = status.value if status else None
    items = crud.get_renewal_items(db, status=status_value)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "续期编号", "员工ID", "证书类型ID", "状态", "优先级", "截止日期", "处理人", "备注", "创建时间"
    ])
    
    for item in items:
        writer.writerow([
            item.renewal_code,
            item.employee_id,
            item.certificate_type_id,
            item.status,
            item.priority,
            item.due_date.isoformat() if item.due_date else "",
            item.assigned_to or "",
            item.remarks or "",
            item.created_at.isoformat() if item.created_at else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=renewal_items_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@app.get("/export/certificate-expiry-alerts/", tags=["导出"])
def export_certificate_expiry_alerts(days_threshold: int = 90, db: Session = Depends(get_db)):
    alerts = crud.get_certificate_expiry_alerts(db, days_threshold=days_threshold)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "员工编号", "员工姓名", "证书类型", "证书编号", "过期日期", "剩余天数", "状态"
    ])
    
    for alert in alerts:
        writer.writerow([
            alert.employee_id,
            alert.employee_name,
            alert.certificate_type,
            alert.certificate_number or "",
            alert.expiry_date.isoformat() if alert.expiry_date else "",
            alert.days_until_expiry if alert.days_until_expiry is not None else "",
            alert.status
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=certificate_expiry_alerts_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@app.get("/exception-logs/", response_model=List[schemas.ExceptionLog], tags=["异常日志"])
def read_exception_logs(operation_type: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_exception_logs(db, operation_type=operation_type, skip=skip, limit=limit)
