from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import pandas as pd
import io
import json

from database import engine, SessionLocal, get_db
from models import Base, RenewalStatus, Employee, EmployeeCertificate
import schemas
from services import (
    EmployeeService, CertificateService, CourseService,
    RetakeService, QualificationService, RenewalService
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="证书续期岗位资格补考管理系统", version="1.0.0")


@app.post("/employees/", response_model=schemas.Employee, tags=["员工管理"])
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    existing = EmployeeService.get_employee(db, employee.employee_id)
    if existing:
        raise HTTPException(status_code=400, detail="员工编号已存在")
    return EmployeeService.create_employee(db, employee)


@app.get("/employees/", response_model=List[schemas.Employee], tags=["员工管理"])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return EmployeeService.get_all_employees(db, skip=skip, limit=limit)


@app.get("/employees/{employee_id}", response_model=schemas.Employee, tags=["员工管理"])
def read_employee(employee_id: str, db: Session = Depends(get_db)):
    employee = EmployeeService.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    return employee


@app.post("/certificate-types/", response_model=schemas.CertificateType, tags=["证书类型"])
def create_certificate_type(cert_type: schemas.CertificateTypeCreate, db: Session = Depends(get_db)):
    return CertificateService.create_certificate_type(db, cert_type)


@app.post("/employee-certificates/", response_model=schemas.EmployeeCertificate, tags=["员工证书"])
def create_employee_certificate(cert: schemas.EmployeeCertificateCreate, db: Session = Depends(get_db)):
    return CertificateService.create_employee_certificate(db, cert)


@app.get("/employee-certificates/expiring/", response_model=List[schemas.EmployeeCertificate], tags=["员工证书"])
def get_expiring_certificates(days: int = 90, db: Session = Depends(get_db)):
    return CertificateService.get_expiring_certificates(db, days=days)


@app.put("/employee-certificates/update-statuses/", tags=["员工证书"])
def update_certificate_statuses(db: Session = Depends(get_db)):
    updated = CertificateService.update_certificate_statuses(db)
    return {"updated_count": updated}


@app.post("/course-scores/", response_model=schemas.CourseScore, tags=["课程成绩"])
def create_course_score(score: schemas.CourseScoreCreate, db: Session = Depends(get_db)):
    return CourseService.create_course_score(db, score)


@app.get("/employees/{employee_id}/courses/", response_model=List[schemas.CourseScore], tags=["课程成绩"])
def get_employee_courses(employee_id: str, db: Session = Depends(get_db)):
    employee = EmployeeService.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    return CourseService.get_employee_courses(db, employee.id)


@app.post("/retake-records/", response_model=schemas.RetakeRecord, tags=["补考记录"])
def create_retake_record(retake: schemas.RetakeRecordCreate, db: Session = Depends(get_db)):
    return RetakeService.create_retake_record(db, retake)


@app.put("/retake-records/{retake_id}", response_model=schemas.RetakeRecord, tags=["补考记录"])
def update_retake_record(retake_id: int, update: schemas.RetakeRecordUpdate, db: Session = Depends(get_db)):
    retake = RetakeService.update_retake_record(db, retake_id, update)
    if not retake:
        raise HTTPException(status_code=404, detail="补考记录不存在")
    return retake


@app.get("/employees/{employee_id}/retakes/", response_model=List[schemas.RetakeRecord], tags=["补考记录"])
def get_employee_retakes(employee_id: str, db: Session = Depends(get_db)):
    employee = EmployeeService.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    return RetakeService.get_employee_retakes(db, employee.id)


@app.post("/position-requirements/", response_model=schemas.PositionRequirement, tags=["岗位资格"])
def create_position_requirement(req: schemas.PositionRequirementCreate, db: Session = Depends(get_db)):
    return QualificationService.create_position_requirement(db, req)


@app.put("/position-requirements/{req_id}/evaluate/", response_model=schemas.PositionRequirement, tags=["岗位资格"])
def evaluate_qualification(req_id: int, db: Session = Depends(get_db)):
    req = QualificationService.evaluate_qualification(db, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="岗位要求不存在")
    return req


@app.get("/employees/{employee_id}/qualifications/", response_model=List[schemas.PositionRequirement], tags=["岗位资格"])
def get_employee_qualifications(employee_id: str, db: Session = Depends(get_db)):
    employee = EmployeeService.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    return QualificationService.get_employee_qualifications(db, employee.id)


@app.post("/renewal-items/", response_model=schemas.RenewalItem, tags=["续期清单"])
def create_renewal_item(item: schemas.RenewalItemCreate, db: Session = Depends(get_db)):
    return RenewalService.create_renewal_item(db, item)


@app.post("/renewal-items/batch/", tags=["续期清单"])
def batch_create_renewals(renewal_batch: str, certificate_ids: List[int], 
                           due_date: Optional[date] = None, db: Session = Depends(get_db)):
    items = RenewalService.batch_create_renewals(db, renewal_batch, certificate_ids, due_date)
    return {"created_count": len(items), "items": items}


@app.put("/renewal-items/{item_id}/status/", response_model=schemas.RenewalItem, tags=["续期清单"])
def update_renewal_status(item_id: int, new_status: RenewalStatus, operator: str, 
                           notes: Optional[str] = None, db: Session = Depends(get_db)):
    item = RenewalService.update_renewal_status(db, item_id, new_status, operator, notes)
    if not item:
        raise HTTPException(status_code=404, detail="续期项目不存在")
    return item


@app.post("/renewal-items/{item_id}/manual-correction/", response_model=schemas.RenewalItem, tags=["续期清单"])
def manual_correction(item_id: int, request: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    item = RenewalService.manual_correction(db, item_id, request)
    if not item:
        raise HTTPException(status_code=404, detail="续期项目不存在")
    return item


@app.put("/renewal-items/{item_id}/withdraw/", response_model=schemas.RenewalItem, tags=["续期清单"])
def withdraw_renewal(item_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    item = RenewalService.withdraw_renewal(db, item_id, operator, reason)
    if not item:
        raise HTTPException(status_code=404, detail="续期项目不存在")
    return item


@app.put("/renewal-items/{item_id}/close/", response_model=schemas.RenewalItem, tags=["续期清单"])
def close_renewal(item_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    item = RenewalService.close_renewal(db, item_id, operator, reason)
    if not item:
        raise HTTPException(status_code=404, detail="续期项目不存在")
    return item


@app.get("/renewal-items/", response_model=List[schemas.RenewalItem], tags=["续期清单"])
def get_renewal_items(
    status: Optional[RenewalStatus] = None,
    department: Optional[str] = None,
    renewal_batch: Optional[str] = None,
    employee_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    filters = schemas.RenewalFilterParams(
        status=status,
        department=department,
        renewal_batch=renewal_batch,
        employee_id=employee_id
    )
    return RenewalService.get_renewal_items(db, filters, skip=skip, limit=limit)


@app.get("/renewal-items/statistics/", response_model=schemas.RenewalStatistics, tags=["续期清单"])
def get_statistics(db: Session = Depends(get_db)):
    return RenewalService.get_statistics(db)


@app.get("/renewal-items/export/", tags=["续期清单"])
def export_renewal_items(
    status: Optional[RenewalStatus] = None,
    department: Optional[str] = None,
    renewal_batch: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    filters = schemas.RenewalFilterParams(
        status=status,
        department=department,
        renewal_batch=renewal_batch,
        employee_id=employee_id
    )
    items = RenewalService.get_renewal_items(db, filters)
    
    data = []
    for item in items:
        employee = db.query(Employee).filter(Employee.id == item.employee_id).first()
        cert = None
        if item.employee_certificate_id:
            cert = db.query(EmployeeCertificate).filter(EmployeeCertificate.id == item.employee_certificate_id).first()
        
        data.append({
            "续期编号": item.id,
            "批次": item.renewal_batch,
            "员工编号": employee.employee_id if employee else "",
            "员工姓名": employee.name if employee else "",
            "部门": employee.department if employee else "",
            "状态": item.status,
            "截止日期": item.due_date.isoformat() if item.due_date else "",
            "处理人": item.assigned_to or "",
            "备注": item.notes or "",
            "创建时间": item.created_at.isoformat()
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='续期清单')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=renewal_list_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.get("/operation-logs/", response_model=List[schemas.OperationLog], tags=["操作日志"])
def get_operation_logs(renewal_item_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    from models import OperationLog as DBLog
    query = db.query(DBLog)
    if renewal_item_id:
        query = query.filter(DBLog.renewal_item_id == renewal_item_id)
    return query.order_by(DBLog.created_at.desc()).offset(skip).limit(limit).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
